"""Safely enrich and import BetterAlt and Vital Planet CSV catalogs.

CSV values are treated only as product data. Existing products are updated only
when the incoming row has the same UPC; name-only matches are never approved.
BetterAlt metadata comes from exact UPC search results, while Vital Planet
images come from exact supplier-SKU matches in the official Shopify catalog.
"""
from __future__ import annotations

import argparse
import csv
import html
import io
import json
import re
import sys
from collections import Counter
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

import httpx

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "frontend" / "backend"))

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
OFFICIAL_VITAL_PLANET = "https://www.vitalplanet.com"
BETTERALT_UPC_SEARCH = "https://www.myotcstore.com/search.php?search_query={}"
BETTERALT_RETAILER = "https://wellnessbetter.com"


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", str(value or "")))).strip()


def money(value: Any) -> Decimal | None:
    raw = re.sub(r"[^0-9.]", "", str(value or ""))
    if not raw:
        return None
    try:
        amount = Decimal(raw)
    except InvalidOperation:
        return None
    return amount if amount > 0 else None


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = [{key: str(value or "").strip() for key, value in row.items()} for row in csv.DictReader(handle)]
    missing = [field for field in CSV_FIELDS if field not in (rows[0] if rows else {})]
    if missing:
        raise ValueError(f"{path.name} is missing required columns: {', '.join(missing)}")
    return rows


def csv_bytes(rows: list[dict[str, str]]) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=CSV_FIELDS, lineterminator="\n")
    writer.writeheader()
    writer.writerows({field: row.get(field, "") for field in CSV_FIELDS} for row in rows)
    return output.getvalue().encode("utf-8")


def fetch_shopify_products(client: httpx.Client, base_url: str) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    for page in range(1, 10):
        response = client.get(
            f"{base_url}/products.json",
            params={"limit": 250, "page": page},
            timeout=30,
        )
        response.raise_for_status()
        page_products = response.json().get("products") or []
        products.extend(page_products)
        if len(page_products) < 250:
            break
    return products


def variant_image(product: dict[str, Any], variant: dict[str, Any]) -> str:
    featured = variant.get("featured_image") or {}
    if featured.get("src"):
        return str(featured["src"])
    variant_id = variant.get("id")
    for image in product.get("images") or []:
        if variant_id in (image.get("variant_ids") or []):
            return str(image.get("src") or "")
    images = product.get("images") or []
    return str(images[0].get("src") or "") if images else ""


def enrich_vital_planet(
    rows: list[dict[str, str]], client: httpx.Client
) -> tuple[list[dict[str, str]], dict[str, Any]]:
    products = fetch_shopify_products(client, OFFICIAL_VITAL_PLANET)
    by_sku: dict[str, list[tuple[dict[str, Any], dict[str, Any]]]] = {}
    for product in products:
        for variant in product.get("variants") or []:
            sku = str(variant.get("sku") or "").strip()
            if sku:
                by_sku.setdefault(sku, []).append((product, variant))

    exact = images_added = 0
    price_differences: list[dict[str, str]] = []
    unmatched: list[dict[str, str]] = []
    enriched: list[dict[str, str]] = []
    for source in rows:
        row = dict(source)
        matches = by_sku.get(row.get("supplier_sku", ""), [])
        if len(matches) == 1:
            product, variant = matches[0]
            exact += 1
            official_price = money(variant.get("price"))
            csv_price = money(row.get("msrp"))
            if official_price is not None and csv_price is not None and official_price != csv_price:
                price_differences.append(
                    {
                        "upc": row.get("upc", ""),
                        "supplier_sku": row.get("supplier_sku", ""),
                        "csv_msrp": f"{csv_price:.2f}",
                        "official_price": f"{official_price:.2f}",
                        "name": row.get("product_full_name", ""),
                    }
                )
            if not row.get("image_url"):
                row["image_url"] = variant_image(product, variant)
                if row["image_url"]:
                    images_added += 1
        else:
            unmatched.append(
                {
                    "upc": row.get("upc", ""),
                    "supplier_sku": row.get("supplier_sku", ""),
                    "name": row.get("product_full_name", ""),
                }
            )
        # Neither CSV reports stock on hand; do not allow checkout by implying
        # inventory that has not been verified by the store.
        row["availability"] = row.get("availability") or "special_order"
        enriched.append(row)
    return enriched, {
        "source_rows": len(rows),
        "official_products_scanned": len(products),
        "exact_supplier_sku_matches": exact,
        "official_images_added": images_added,
        "official_price_differences": price_differences,
        "unmatched_rows": unmatched,
    }


def _first_match(pattern: str, text: str) -> str:
    found = re.search(pattern, text, re.I | re.S)
    return html.unescape(found.group(1)).strip() if found else ""


def exact_betteralt_lookup(client: httpx.Client, upc: str) -> dict[str, str] | None:
    response = client.get(BETTERALT_UPC_SEARCH.format(quote_plus(upc)), timeout=30)
    response.raise_for_status()
    markup = response.text
    count = _first_match(r"data-product-results-toggle.*?data-count=[\"'](\d+)[\"']", markup)
    if count != "1":
        return None

    link = _first_match(r"<h4\s+class=[\"']card-title[\"']>\s*<a[^>]+href=[\"']([^\"']+)", markup)
    title = clean_text(_first_match(r"<h4\s+class=[\"']card-title[\"']>\s*<a[^>]*>(.*?)</a>", markup))
    regular = money(_first_match(r"data-product-non-sale-price-without-tax[^>]*>\s*<small>\s*Was:\s*([^<]+)", markup))
    current = money(_first_match(r"data-product-price-without-tax[^>]*>([^<]+)", markup))
    image_url = _first_match(r"class=[\"'][^\"']*card-image[^\"']*[\"'][^>]+data-src=[\"']([^\"']+)", markup)
    if not link or "better alt" not in title.lower() or upc not in markup:
        return None
    if image_url and upc not in image_url:
        image_url = ""
    selected_price = regular or current
    if selected_price is None:
        return None
    return {
        "title": title,
        "msrp": f"{selected_price:.2f}",
        "listed_price": f"{current:.2f}" if current is not None else "",
        "image_url": image_url,
        "source_url": link,
    }


def exact_betteralt_shopify_lookup(client: httpx.Client, upc: str) -> dict[str, str] | None:
    response = client.get(
        f"{BETTERALT_RETAILER}/search/suggest.json",
        params={"q": upc, "resources[type]": "product", "resources[limit]": 10},
        timeout=30,
    )
    response.raise_for_status()
    products = (
        (((response.json().get("resources") or {}).get("results") or {}).get("products"))
        or []
    )
    if len(products) != 1:
        return None
    suggestion = products[0]
    handle = str(suggestion.get("handle") or "").strip()
    if not handle or str(suggestion.get("vendor") or "").strip().lower() != "betteralt":
        return None
    product_response = client.get(f"{BETTERALT_RETAILER}/products/{handle}.js", timeout=30)
    product_response.raise_for_status()
    product = product_response.json()
    matches = [
        variant
        for variant in product.get("variants") or []
        if re.sub(r"\D", "", str(variant.get("barcode") or "")) == upc
    ]
    if len(matches) != 1:
        return None
    variant = matches[0]
    compare_cents = int(variant.get("compare_at_price") or 0)
    price_cents = int(variant.get("price") or 0)
    regular_cents = compare_cents or price_cents
    if regular_cents <= 0:
        return None
    featured = variant.get("featured_image") or product.get("featured_image") or {}
    if isinstance(featured, dict):
        image_url = str(featured.get("src") or featured.get("url") or "")
    else:
        image_url = str(featured or "")
    if not image_url:
        images = product.get("images") or []
        image_url = str(images[0] if images else "")
    if image_url.startswith("//"):
        image_url = f"https:{image_url}"
    return {
        "title": str(product.get("title") or suggestion.get("title") or "").strip(),
        "msrp": f"{Decimal(regular_cents) / 100:.2f}",
        "listed_price": f"{Decimal(price_cents) / 100:.2f}" if price_cents else "",
        "image_url": image_url,
        "source_url": f"{BETTERALT_RETAILER}/products/{handle}",
    }


def enrich_betteralt(
    rows: list[dict[str, str]], client: httpx.Client
) -> tuple[list[dict[str, str]], dict[str, Any]]:
    enriched: list[dict[str, str]] = []
    unresolved: list[dict[str, str]] = []
    images_added = 0
    source_counts: Counter[str] = Counter()
    for source in rows:
        row = dict(source)
        match = exact_betteralt_lookup(client, row.get("upc", ""))
        match_source = "myotcstore"
        if match is None:
            match = exact_betteralt_shopify_lookup(client, row.get("upc", ""))
            match_source = "wellnessbetter"
        if match is None:
            unresolved.append({"upc": row.get("upc", ""), "name": row.get("product_full_name", "")})
            continue
        source_count = re.match(r"\s*(\d+)\s*CT\b", row.get("size", ""), re.I)
        retailer_count = re.search(r"\b(\d+)\s*Ea\b", match["title"], re.I)
        if source_count and retailer_count and source_count.group(1) != retailer_count.group(1):
            unresolved.append(
                {
                    "upc": row.get("upc", ""),
                    "name": row.get("product_full_name", ""),
                    "reason": (
                        f"Pack count differs: CSV {source_count.group(1)}, "
                        f"barcode-matched retailer {retailer_count.group(1)}."
                    ),
                }
            )
            continue
        source_counts[match_source] += 1
        row["msrp"] = row.get("msrp") or match["msrp"]
        if not row.get("image_url") and match["image_url"]:
            row["image_url"] = match["image_url"]
            images_added += 1
        row["availability"] = row.get("availability") or "special_order"
        enriched.append(row)
    return enriched, {
        "source_rows": len(rows),
        "exact_upc_matches": len(enriched),
        "images_added": images_added,
        "matches_by_source": dict(sorted(source_counts.items())),
        "unresolved_rows": unresolved,
    }


def prepare_preview(rows: list[dict[str, str]], discount_percent: int | None) -> tuple[list[dict[str, Any]], dict[str, int]]:
    parsed = parse_catalog_csv(csv_bytes(rows), default_discount_percent=discount_percent)
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


def commit_rows(
    rows: list[dict[str, str]], filename: str, discount_percent: int | None
) -> dict[str, Any]:
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
    blocking = [row for row in batch["rows"] if row.get("included", True) and row["detected_action"] in {"error", "conflict"}]
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


def verify_brand(brand_slug: str, expected_upcs: list[str]) -> dict[str, Any]:
    brands = sb.select("brands", {"select": "id,name,slug,discount_percent,is_active", "slug": f"eq.{brand_slug}", "limit": "1"})
    if not brands:
        return {"brand": brand_slug, "error": "Brand not found after import."}
    brand = brands[0]
    products = sb.select(
        "products",
        {"select": "id,status", "brand_id": f"eq.{brand['id']}", "limit": "1000"},
    )
    product_ids = {str(row["id"]) for row in products}
    variants = [
        row
        for row in select_all("product_variants", "id,product_id,upc,regular_price_cents,sale_price_cents")
        if str(row.get("product_id")) in product_ids
    ]
    images = [
        row
        for row in select_all("product_images", "product_id,storage_path")
        if str(row.get("product_id")) in product_ids
    ]
    seen_upcs = Counter(str(row.get("upc")) for row in variants if row.get("upc"))
    imported_upcs = set(expected_upcs)
    image_products = {str(row["product_id"]) for row in images}
    expected_product_ids = {
        str(row["product_id"]) for row in variants if str(row.get("upc")) in imported_upcs
    }
    return {
        "brand": brand,
        "active_products": sum(1 for row in products if row.get("status") == "active"),
        "expected_upcs_found": sum(1 for upc in imported_upcs if seen_upcs.get(upc) == 1),
        "expected_upcs": len(imported_upcs),
        "duplicate_expected_upcs": sorted(upc for upc in imported_upcs if seen_upcs.get(upc, 0) > 1),
        "expected_products_with_images": len(expected_product_ids & image_products),
        "expected_products_missing_images": len(expected_product_ids - image_products),
        "positive_regular_prices": sum(
            1
            for row in variants
            if str(row.get("upc")) in imported_upcs and int(row.get("regular_price_cents") or 0) > 0
        ),
        "sale_prices_ending_99": sum(
            1
            for row in variants
            if str(row.get("upc")) in imported_upcs
            and row.get("sale_price_cents") is not None
            and int(row["sale_price_cents"]) % 100 == 99
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--betteralt", type=Path, required=True)
    parser.add_argument("--vital-planet", type=Path, required=True)
    parser.add_argument("--commit", action="store_true")
    args = parser.parse_args()

    betteralt_source = read_csv(args.betteralt)
    vital_source = read_csv(args.vital_planet)
    with httpx.Client(
        follow_redirects=True,
        headers={"User-Agent": "BronxvilleNaturalMarket-CatalogEnrichment/1.0"},
    ) as client:
        betteralt_rows, betteralt_enrichment = enrich_betteralt(betteralt_source, client)
        vital_rows, vital_enrichment = enrich_vital_planet(vital_source, client)

    if len(betteralt_rows) + len(betteralt_enrichment["unresolved_rows"]) != len(betteralt_source):
        raise RuntimeError("BetterAlt row count changed during enrichment; nothing was committed.")
    if len(vital_rows) != len(vital_source):
        raise RuntimeError("Vital Planet row count changed during enrichment; nothing was committed.")

    betteralt_preview, betteralt_stats = prepare_preview(betteralt_rows, 20)
    vital_preview, vital_stats = prepare_preview(vital_rows, 20)
    blocking = {
        "betteralt": [row for row in betteralt_preview if row["detected_action"] in {"error", "conflict"}],
        "vital_planet": [row for row in vital_preview if row["detected_action"] in {"error", "conflict"}],
    }
    report: dict[str, Any] = {
        "betteralt": {
            "enrichment": betteralt_enrichment,
            "preview_stats": betteralt_stats,
            "image_warnings": [
                {"upc": row.get("upc"), "warnings": row.get("warnings")}
                for row in betteralt_preview
                if row.get("warnings") and not row.get("image_url")
            ],
        },
        "vital_planet": {
            "enrichment": vital_enrichment,
            "preview_stats": vital_stats,
            "image_warnings": [
                {"upc": row.get("upc"), "warnings": row.get("warnings")}
                for row in vital_preview
                if row.get("warnings") and not row.get("image_url")
            ],
        },
        "blocking_rows": {
            key: [
                {"row": row["source_row_number"], "name": row.get("name"), "errors": row.get("errors")}
                for row in rows[:20]
            ]
            for key, rows in blocking.items()
        },
    }
    if any(blocking.values()):
        print(json.dumps(report, indent=2, ensure_ascii=False))
        raise RuntimeError("Preview contains blocking rows; nothing was committed.")

    if args.commit:
        print("Committing Vital Planet after clean preview...", flush=True)
        report["vital_planet"]["import"] = commit_rows(vital_rows, args.vital_planet.name, 20)
        print("Vital Planet commit completed.", flush=True)
        if betteralt_rows:
            print("Committing barcode-verified BetterAlt rows...", flush=True)
            report["betteralt"]["import"] = commit_rows(betteralt_rows, args.betteralt.name, 20)
            brands = sb.select("brands", {"select": "id,discount_percent", "slug": "eq.betteralt", "limit": "1"})
            if brands and brands[0].get("discount_percent") != 20:
                sb.update("brands", {"id": f"eq.{brands[0]['id']}"}, {"discount_percent": 20})
            print("BetterAlt commit completed.", flush=True)
        report["verification"] = {
            "betteralt": verify_brand("betteralt", [row["upc"] for row in betteralt_rows]),
            "vital_planet": verify_brand("vital-planet", [row["upc"] for row in vital_rows]),
        }

    print(json.dumps(report, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
