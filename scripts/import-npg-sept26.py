"""Validate, enrich, and safely import active NPG September catalog products.

The source CSV is treated strictly as data. Only active Solgar, American
Health, and Home Health rows are imported. Duplicate approval requires an exact UPC match.
Images are found with exact barcode searches, validated as real image bytes,
cached locally, and copied into the project's product-images bucket before the
catalog commit so the storefront does not depend on retailer hotlinks.
"""
from __future__ import annotations

import argparse
import csv
import html
import io
import json
import re
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "frontend" / "backend"))

from app.catalog.csv_images import image_url_allowed, sniff_image
from app.catalog.csv_parse import parse_catalog_csv
from app.services import catalog_import
from app.services import supabase_rest as sb


CSV_FIELDS = [
    "product_full_name",
    "brand",
    "category",
    "sku",
    "supplier_sku",
    "upc",
    "msrp",
    "store_srp",
    "cost_price",
    "availability",
    "size",
    "form",
    "strength",
    "image_url",
]
SEARCH_URL = "https://www.bing.com/images/async"
OUTPUT_ROOT = REPO_ROOT / "outputs" / "npg-sept26-import"
IMAGE_CACHE = OUTPUT_ROOT / "images"
SEARCH_CACHE_PATH = OUTPUT_ROOT / "search-cache.json"
USER_AGENT = "BronxvilleNaturalMarket-CatalogEnrichment/1.0"
# Catalog cards display at roughly 160–300 px depending on the viewport. A
# verified 250 px source remains sharp enough without accepting tiny thumbnails.
MIN_IMAGE_EDGE = 250
MAX_IMAGE_BYTES = 5_000_000
SUPPORTED_BRANDS = {
    "solgar": {
        "name": "Solgar",
        "slug": "solgar",
        "official_domains": ("solgar.com",),
    },
    "american health": {
        "name": "American Health",
        "slug": "american-health",
        "official_domains": ("americanhealthus.com",),
    },
    "home health": {
        "name": "Home Health",
        "slug": "home-health",
        "official_domains": ("homehealthus.com",),
    },
}


def read_source(path: Path) -> tuple[list[dict[str, str]], dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        all_rows = [
            {key: str(value or "").strip() for key, value in row.items()}
            for row in csv.DictReader(handle)
        ]
    if not all_rows:
        raise ValueError("The Solgar CSV is empty.")
    missing = [field for field in CSV_FIELDS if field not in all_rows[0]]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    supported = [
        row for row in all_rows if row["brand"].casefold() in SUPPORTED_BRANDS
    ]
    active = [row for row in supported if row["availability"].casefold() == "active"]
    discontinued = [
        row for row in supported if row["availability"].casefold() == "discontinued"
    ]
    unsupported = [
        row
        for row in supported
        if row["availability"].casefold() not in {"active", "discontinued"}
    ]
    if unsupported:
        raise ValueError(
            "Supported-brand rows contain unsupported availability values: "
            + ", ".join(sorted({row["availability"] for row in unsupported}))
        )

    upcs = [row["upc"] for row in active]
    duplicates = sorted(upc for upc, count in Counter(upcs).items() if upc and count > 1)
    if duplicates:
        raise ValueError(f"Duplicate active UPCs: {', '.join(duplicates[:20])}")
    if any(not row["upc"] for row in active):
        raise ValueError("Every active row must have a UPC.")
    if any(not row["msrp"] for row in active):
        raise ValueError("Every active row must have an MSRP.")

    for row in active:
        row["availability"] = "in_stock"

    return active, {
        "source_rows": len(all_rows),
        "active_rows": len(active),
        "active_by_brand": dict(sorted(Counter(row["brand"] for row in active).items())),
        "discontinued_skipped": len(discontinued),
        "discontinued_by_brand": dict(
            sorted(Counter(row["brand"] for row in discontinued).items())
        ),
        "unsupported_brands_skipped": len(all_rows) - len(supported),
    }


def csv_bytes(rows: list[dict[str, str]]) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=CSV_FIELDS, lineterminator="\n")
    writer.writeheader()
    writer.writerows({field: row.get(field, "") for field in CSV_FIELDS} for row in rows)
    return output.getvalue().encode("utf-8")


def load_search_cache() -> dict[str, dict[str, str]]:
    if not SEARCH_CACHE_PATH.exists():
        return {}
    try:
        data = json.loads(SEARCH_CACHE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def save_search_cache(cache: dict[str, dict[str, str]]) -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    SEARCH_CACHE_PATH.write_text(
        json.dumps(cache, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )


def search_candidates(client: httpx.Client, row: dict[str, str]) -> list[dict[str, str]]:
    query = f'{row["upc"]} {row["brand"]}'
    response = client.get(
        SEARCH_URL,
        params={"q": query, "first": 1, "count": 35, "scenario": "ImageBasicHover"},
        headers={"User-Agent": "Mozilla/5.0 (compatible; catalog-image-review/1.0)"},
        timeout=30,
    )
    response.raise_for_status()
    candidates: list[dict[str, str]] = []
    seen: set[str] = set()
    for raw in re.findall(r'\bm="([^"]+)"', response.text):
        try:
            metadata = json.loads(html.unescape(raw))
        except (json.JSONDecodeError, TypeError):
            continue
        image_url = str(metadata.get("murl") or "").strip()
        if not image_url or image_url in seen:
            continue
        seen.add(image_url)
        candidates.append(
            {
                "image_url": image_url,
                "source_url": str(metadata.get("purl") or "").strip(),
                "title": html.unescape(str(metadata.get("t") or "")).strip(),
            }
        )
    return candidates


def meaningful_tokens(value: str) -> set[str]:
    stop = {
        "solgar",
        "american",
        "health",
        "home",
        "and",
        "with",
        "the",
        "for",
        "new",
        "vegetable",
        "capsule",
        "capsules",
        "tablet",
        "tablets",
        "softgel",
        "softgels",
    }
    return {
        token
        for token in re.findall(r"[a-z0-9]+", value.casefold())
        if len(token) >= 3 and token not in stop
    }


def candidate_score(row: dict[str, str], candidate: dict[str, str]) -> int:
    joined = " ".join(candidate.values()).casefold()
    digits = re.sub(r"\D", "", joined)
    upc = row["upc"]
    score = 0
    exact_identifier = upc in digits or upc[-6:] in digits
    if exact_identifier:
        score += 100
    host = (urlparse(candidate["image_url"]).hostname or "").casefold()
    source_host = (urlparse(candidate["source_url"]).hostname or "").casefold()
    brand_config = SUPPORTED_BRANDS[row["brand"].casefold()]
    if any(
        host.endswith(domain) or source_host.endswith(domain)
        for domain in brand_config["official_domains"]
    ):
        score += 30

    expected = meaningful_tokens(row["product_full_name"])
    observed = meaningful_tokens(candidate["title"] + " " + candidate["source_url"])
    overlap = len(expected & observed)
    score += min(overlap, 6) * 5
    size = re.sub(r"\D", "", row.get("size", ""))
    size_present = bool(size and re.search(rf"(?<!\d){re.escape(size)}(?!\d)", joined))
    if size_present:
        score += 20

    # UPC evidence is strongest. Without it, require a distinctive title and
    # the package size to avoid assigning another size of the same formula.
    if not exact_identifier and (overlap < 3 or not size_present):
        return -1
    return score


def safe_download(
    client: httpx.Client, url: str
) -> tuple[bytes, str, str, str] | None:
    current = url
    for _ in range(4):
        ok, _reason = image_url_allowed(current)
        if not ok:
            return None
        try:
            response = client.get(
                current,
                headers={"User-Agent": USER_AGENT},
                timeout=httpx.Timeout(20, connect=8),
                follow_redirects=False,
            )
        except httpx.HTTPError:
            return None
        if response.status_code in {301, 302, 303, 307, 308}:
            location = response.headers.get("location")
            if not location:
                return None
            current = urljoin(current, location)
            continue
        if response.status_code != 200 or len(response.content) > MAX_IMAGE_BYTES:
            return None
        sniffed = sniff_image(response.content, response.headers.get("content-type"))
        if not sniffed:
            return None
        mime, ext = sniffed
        try:
            with Image.open(io.BytesIO(response.content)) as image:
                width, height = image.size
                image.verify()
        except Exception:
            return None
        if min(width, height) < MIN_IMAGE_EDGE:
            return None
        return response.content, mime, ext, current
    return None


def enrich_one(row: dict[str, str], cached: dict[str, str] | None) -> dict[str, str]:
    upc = row["upc"]
    IMAGE_CACHE.mkdir(parents=True, exist_ok=True)
    if cached:
        cached_path = Path(cached.get("cache_path", ""))
        if cached_path.exists() and cached_path.is_file():
            return cached

    with httpx.Client(limits=httpx.Limits(max_connections=8, max_keepalive_connections=4)) as client:
        candidates: list[dict[str, str]] = []
        if row.get("image_url"):
            candidates.append(
                {
                    "image_url": row["image_url"],
                    "source_url": "CSV supplied",
                    "title": row["product_full_name"],
                }
            )
        try:
            candidates.extend(search_candidates(client, row))
        except httpx.HTTPError:
            pass
        ranked = sorted(
            (
                (candidate_score(row, candidate), candidate)
                for candidate in candidates
            ),
            key=lambda item: item[0],
            reverse=True,
        )
        for score, candidate in ranked[:15]:
            if score < 0:
                continue
            downloaded = safe_download(client, candidate["image_url"])
            if not downloaded:
                continue
            content, mime, ext, final_url = downloaded
            cache_path = IMAGE_CACHE / f"{upc}.{ext}"
            cache_path.write_bytes(content)
            return {
                "cache_path": str(cache_path),
                "mime": mime,
                "extension": ext,
                "source_url": candidate["source_url"],
                "image_url": final_url,
                "score": str(score),
            }
    return {}


def enrich_images(rows: list[dict[str, str]]) -> tuple[dict[str, dict[str, str]], int]:
    cache = load_search_cache()
    results = dict(cache)
    pending = [row for row in rows if not cache.get(row["upc"], {}).get("cache_path")]
    completed = 0
    lock = threading.Lock()
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(enrich_one, row, cache.get(row["upc"])): row
            for row in pending
        }
        for future in as_completed(futures):
            row = futures[future]
            try:
                match = future.result()
            except Exception:
                match = {}
            with lock:
                results[row["upc"]] = match
                completed += 1
                if completed % 25 == 0 or completed == len(pending):
                    found = sum(1 for value in results.values() if value.get("cache_path"))
                    print(
                        f"Image review {completed}/{len(pending)}; {found} validated matches cached.",
                        flush=True,
                    )
            time.sleep(0.05)
    save_search_cache(results)
    return results, sum(1 for row in rows if results.get(row["upc"], {}).get("cache_path"))


def prepare_preview(
    rows: list[dict[str, str]], discount_percent: int
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    parsed = parse_catalog_csv(
        csv_bytes(rows), default_brand=None, default_discount_percent=discount_percent
    )
    preview_rows: list[dict[str, Any]] = []
    for product in parsed["products"]:
        row = {
            **product,
            "detected_action": "insert",
            "included": True,
            "approved_existing_variant_id": None,
            "edited_fields": [],
        }
        catalog_import._sanitize_image(row)
        preview_rows.append(row)
    catalog_import._analyze_rows(preview_rows, None)
    for row in preview_rows:
        match = row.get("duplicate_match") or {}
        if row.get("upc") and "UPC" in (match.get("matched_fields") or []):
            row["approved_existing_variant_id"] = match["variant_id"]
    catalog_import._analyze_rows(preview_rows, None)
    return preview_rows, catalog_import._stats(preview_rows, parsed["stats"]["section_rows"])


def upload_images(
    rows: list[dict[str, str]], image_matches: dict[str, dict[str, str]]
) -> dict[str, str]:
    uploaded: dict[str, str] = {}

    def upload(row: dict[str, str]) -> tuple[str, str] | None:
        match = image_matches.get(row["upc"]) or {}
        path = Path(match.get("cache_path", ""))
        if not path.exists():
            return None
        brand_slug = SUPPORTED_BRANDS[row["brand"].casefold()]["slug"]
        object_path = f"products/{brand_slug}/{row['upc']}.{match['extension']}"
        content = path.read_bytes()
        for attempt in range(3):
            try:
                public_url = sb.upload_object(
                    "product-images", object_path, content, match["mime"]
                )
                return row["upc"], public_url
            except Exception:
                if attempt == 2:
                    return None
                time.sleep(0.5 * (attempt + 1))
        return None

    candidates = [row for row in rows if image_matches.get(row["upc"], {}).get("cache_path")]
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(upload, row) for row in candidates]
        for index, future in enumerate(as_completed(futures), start=1):
            try:
                result = future.result()
            except Exception:
                result = None
            if result:
                uploaded[result[0]] = result[1]
            if index % 25 == 0 or index == len(futures):
                print(f"Image upload {index}/{len(futures)}.", flush=True)
    return uploaded


def commit_rows(rows: list[dict[str, str]], filename: str, discount_percent: int) -> dict[str, Any]:
    preview = catalog_import.preview_csv(
        csv_bytes(rows),
        filename,
        brand_name=None,
        discount_percent=discount_percent,
        force_reprocess=True,
    )
    batch = catalog_import._BATCHES[preview["id"]]
    for row in batch["rows"]:
        match = row.get("duplicate_match") or {}
        if row.get("upc") and "UPC" in (match.get("matched_fields") or []):
            row["approved_existing_variant_id"] = match["variant_id"]
    catalog_import._analyze_rows(batch["rows"], None)
    batch["stats"] = catalog_import._stats(batch["rows"], len(batch.get("sections") or []))
    blocking = [
        row
        for row in batch["rows"]
        if row.get("included", True) and row["detected_action"] in {"error", "conflict"}
    ]
    if blocking:
        raise RuntimeError(
            "Import preview contains blocking rows: "
            + ", ".join(str(row["source_row_number"]) for row in blocking[:20])
        )
    included = [row["source_row_number"] for row in batch["rows"] if row.get("included", True)]
    result = catalog_import.commit_csv(
        preview["id"], included_row_numbers=included, force_reprocess=True
    )
    return {"batch_id": preview["id"], "preview_stats": batch["stats"], "commit": result}


def select_all(table: str, columns: str) -> list[dict[str, Any]]:
    return catalog_import._select_all(table, columns)


def verify(brand_slug: str, expected_upcs: list[str]) -> dict[str, Any]:
    brands = sb.select(
        "brands",
        {
            "select": "id,name,slug,discount_percent,is_active",
            "slug": f"eq.{brand_slug}",
            "limit": "1",
        },
    )
    if not brands:
        return {"error": f"{brand_slug} brand not found after import."}
    brand = brands[0]
    products = sb.select(
        "products", {"select": "id,status", "brand_id": f"eq.{brand['id']}", "limit": "1000"}
    )
    product_ids = {str(row["id"]) for row in products}
    variants = [
        row
        for row in select_all(
            "product_variants",
            "id,product_id,upc,availability,regular_price_cents,sale_price_cents",
        )
        if str(row.get("product_id")) in product_ids
    ]
    images = [
        row
        for row in select_all("product_images", "product_id,storage_path")
        if str(row.get("product_id")) in product_ids
    ]
    seen = Counter(str(row.get("upc")) for row in variants if row.get("upc"))
    expected = set(expected_upcs)
    expected_product_ids = {
        str(row["product_id"]) for row in variants if str(row.get("upc")) in expected
    }
    image_products = {str(row["product_id"]) for row in images}
    return {
        "brand": brand,
        "active_products": sum(1 for row in products if row.get("status") == "active"),
        "expected_upcs": len(expected),
        "expected_upcs_found_once": sum(1 for upc in expected if seen.get(upc) == 1),
        "duplicate_expected_upcs": sorted(upc for upc in expected if seen.get(upc, 0) > 1),
        "in_stock_variants": sum(
            1 for row in variants if row.get("upc") in expected and row.get("availability") == "in_stock"
        ),
        "positive_regular_prices": sum(
            1
            for row in variants
            if row.get("upc") in expected and int(row.get("regular_price_cents") or 0) > 0
        ),
        "sale_prices_ending_99": sum(
            1
            for row in variants
            if row.get("upc") in expected
            and row.get("sale_price_cents") is not None
            and int(row["sale_price_cents"]) % 100 == 99
        ),
        "products_with_images": len(expected_product_ids & image_products),
        "products_missing_images": len(expected_product_ids - image_products),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", type=Path)
    parser.add_argument("--discount-percent", type=int, default=20)
    parser.add_argument("--skip-image-search", action="store_true")
    parser.add_argument("--commit", action="store_true")
    args = parser.parse_args()

    rows, source_stats = read_source(args.csv)
    image_matches: dict[str, dict[str, str]] = {}
    images_found = 0
    if not args.skip_image_search:
        image_matches, images_found = enrich_images(rows)

    preview_rows = [dict(row) for row in rows]
    for row in preview_rows:
        match = image_matches.get(row["upc"]) or {}
        if match.get("image_url"):
            row["image_url"] = match["image_url"]
    preview, preview_stats = prepare_preview(preview_rows, args.discount_percent)
    blocking = [row for row in preview if row["detected_action"] in {"error", "conflict"}]
    report: dict[str, Any] = {
        "source": source_stats,
        "images": {
            "validated_matches_cached": images_found,
            "missing_after_search": len(rows) - images_found,
        },
        "preview_stats": preview_stats,
        "blocking_rows": [
            {
                "row": row["source_row_number"],
                "name": row.get("name"),
                "errors": row.get("errors"),
            }
            for row in blocking[:20]
        ],
    }
    if blocking:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        raise RuntimeError("Preview contains blocking rows; nothing was committed.")

    if args.commit:
        uploaded = upload_images(rows, image_matches)
        commit_payload = [dict(row) for row in rows]
        for row in commit_payload:
            if row["upc"] in uploaded:
                row["image_url"] = uploaded[row["upc"]]
            else:
                row["image_url"] = ""
        report["images"]["uploaded_to_product_storage"] = len(uploaded)
        report["import"] = commit_rows(commit_payload, args.csv.name, args.discount_percent)
        report["verification"] = {}
        for config in SUPPORTED_BRANDS.values():
            brand_rows = [row for row in rows if row["brand"] == config["name"]]
            brands = sb.select(
                "brands",
                {
                    "select": "id,discount_percent",
                    "slug": f"eq.{config['slug']}",
                    "limit": "1",
                },
            )
            if brands and brands[0].get("discount_percent") != args.discount_percent:
                sb.update(
                    "brands",
                    {"id": f"eq.{brands[0]['id']}"},
                    {"discount_percent": args.discount_percent},
                )
            report["verification"][config["slug"]] = verify(
                config["slug"], [row["upc"] for row in brand_rows]
            )

    print(json.dumps(report, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
