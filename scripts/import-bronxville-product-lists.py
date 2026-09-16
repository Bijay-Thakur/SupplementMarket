"""Merge, enrich, de-duplicate, and optionally import Bronxville product lists.

The source files overlap heavily. UPC is the authoritative identity key. Prices
and images may be supplemented only from exact UPC matches in official brand
Shopify catalogs; no fuzzy product match is committed.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import httpx

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "frontend" / "backend"))

from app.catalog.classify import classify_name
from app.catalog.csv_images import download_product_image
from app.catalog.csv_normalize import slugify
from app.catalog.csv_parse import parse_catalog_csv
from app.services import catalog_import
from app.services import supabase_rest as sb


OFFICIAL_STORES: dict[str, str] = {
    "solaray": "https://solaray.com",
    "kal": "https://www.kalvitamins.com",
    "zhou nutrition": "https://www.zhounutrition.com",
    "heritage store": "https://heritagestore.com",
    "lifeflo": "https://life-flo.com",
    "emerita": "https://life-flo.com",
    "natures life": "https://natureslife.com",
    "zand": "https://www.zandimmunity.com",
    "honey gardens": "https://www.zandimmunity.com",
    "dynamic health": "https://dynamichealth.com",
}

def digits(value: Any) -> str:
    return re.sub(r"\D", "", str(value or ""))


def code_key(value: Any) -> str:
    value = digits(value)
    return value.lstrip("0") or value


def money(value: Any) -> Decimal | None:
    raw = str(value or "").replace("$", "").replace(",", "").strip()
    if not raw:
        return None
    try:
        parsed = Decimal(raw)
    except InvalidOperation:
        return None
    return parsed if parsed > 0 else None


def clean_category(value: Any) -> str:
    category = str(value or "").strip()
    if category.lower() in {"", "undefined", "none", "n/a"}:
        return ""
    return category.replace("CranActin½", "CranActin")


def read_sources(paths: list[Path]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for path in paths:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                rows.append({**row, "_source": path.name})
    return rows


def fetch_store_products(client: httpx.Client, base_url: str) -> list[dict[str, Any]]:
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


def official_catalog(rows: list[dict[str, str]]) -> dict[str, dict[str, Any]]:
    wanted_brands = {str(row.get("brand") or "").strip().lower() for row in rows}
    stores = sorted({OFFICIAL_STORES[brand] for brand in wanted_brands if brand in OFFICIAL_STORES})
    by_upc: dict[str, dict[str, Any]] = {}
    with httpx.Client(
        follow_redirects=True,
        headers={"User-Agent": "BronxvilleNaturalMarket-CatalogEnrichment/1.0"},
    ) as client:
        for store in stores:
            for product in fetch_store_products(client, store):
                for variant in product.get("variants") or []:
                    key = code_key(variant.get("sku") or variant.get("barcode"))
                    if not key:
                        continue
                    current_price = money(variant.get("price"))
                    compare_price = money(variant.get("compare_at_price"))
                    regular_price = (
                        compare_price
                        if compare_price is not None
                        and current_price is not None
                        and compare_price > current_price
                        else current_price
                    )
                    by_upc[key] = {
                        "name": str(product.get("title") or "").strip(),
                        "product_type": str(product.get("product_type") or "").strip(),
                        "price": regular_price,
                        "image_url": variant_image(product, variant),
                        "source_url": f"{store}/products/{product.get('handle')}",
                    }
    return by_upc


def first_value(rows: list[dict[str, str]], field: str, preferred_sources: list[str]) -> str:
    for source in preferred_sources:
        for row in rows:
            if row["_source"] == source and str(row.get(field) or "").strip():
                return str(row[field]).strip()
    for row in rows:
        if str(row.get(field) or "").strip():
            return str(row[field]).strip()
    return ""


def category_for(name: str, source_category: str, official: dict[str, Any] | None) -> str:
    if source_category:
        return source_category
    official_type = clean_category((official or {}).get("product_type"))
    generic_types = {
        "supplement",
        "supplements",
        "dietary supplement",
        "vitamins & supplements",
        "vitamins and dietary supplements",
    }
    if official_type and official_type.lower() not in generic_types:
        return official_type[:100]
    category, _form, _tags, _audience, _secondary = classify_name(name)
    if category == "Multivitamins" and not re.search(r"\bmulti(?:vitamin| vitamin)?s?\b", name, re.I):
        return "Specialties"
    return category


def merge_rows(rows: list[dict[str, str]], official: dict[str, dict[str, Any]]) -> tuple[list[dict[str, str]], list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    deferred: list[dict[str, Any]] = []
    for index, row in enumerate(rows):
        upc = digits(row.get("upc"))
        if upc:
            identity = f"upc:{code_key(upc)}"
        else:
            identity = "fallback:" + slugify(
                "|".join(
                    [
                        str(row.get("brand") or ""),
                        str(row.get("supplier_sku") or ""),
                        str(row.get("product_full_name") or ""),
                        str(index),
                    ]
                )
            )
        grouped[identity].append(row)

    merged: list[dict[str, str]] = []
    name_sources = [
        "bronxville-product-summary-import.csv",
        "bronxville-top-200-edlp-import.csv",
        "bronxville-top-250-ranking-import.csv",
    ]
    detail_sources = [
        "bronxville-top-250-ranking-import.csv",
        "bronxville-top-200-edlp-import.csv",
        "bronxville-product-summary-import.csv",
    ]
    price_sources = [
        "bronxville-top-200-edlp-import.csv",
        "bronxville-product-summary-import.csv",
        "bronxville-top-250-ranking-import.csv",
    ]

    for identity, candidates in grouped.items():
        upc = first_value(candidates, "upc", price_sources)
        official_match = official.get(code_key(upc)) if upc else None
        brand = first_value(candidates, "brand", name_sources)
        name = first_value(candidates, "product_full_name", name_sources)
        source_price = money(first_value(candidates, "msrp", price_sources))
        regular_price = source_price or ((official_match or {}).get("price"))
        if regular_price is None:
            deferred.append(
                {
                    "identity": identity,
                    "brand": brand,
                    "name": name,
                    "upc": upc,
                    "reason": "No source MSRP and no exact UPC price in the official brand catalog.",
                }
            )
            continue

        source_category = clean_category(first_value(candidates, "category", price_sources))
        form = first_value(candidates, "form", detail_sources)
        if not form:
            _category, inferred_form, _tags, _audience, _secondary = classify_name(name)
            form = inferred_form or ""
        merged.append(
            {
                "product_full_name": name,
                "brand": brand,
                "category": category_for(name, source_category, official_match),
                "sku": first_value(candidates, "sku", price_sources),
                "supplier_sku": first_value(candidates, "supplier_sku", price_sources),
                "upc": upc,
                "msrp": f"{regular_price:.2f}",
                "store_srp": first_value(candidates, "store_srp", price_sources),
                "cost_price": first_value(candidates, "cost_price", price_sources),
                "availability": first_value(candidates, "availability", price_sources) or "in_stock",
                "size": first_value(candidates, "size", detail_sources),
                "form": form,
                "strength": first_value(candidates, "strength", detail_sources),
                "image_url": str((official_match or {}).get("image_url") or ""),
            }
        )
    return merged, deferred


def csv_bytes(rows: list[dict[str, str]]) -> bytes:
    fields = [
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
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


def select_in_chunks(table: str, columns: str, field: str, values: list[str]) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    for start in range(0, len(values), 40):
        chunk = values[start : start + 40]
        found.extend(
            sb.select(
                table,
                {"select": columns, field: f"in.({','.join(chunk)})"},
            )
        )
    return found


def select_all(table: str, columns: str) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    offset = 0
    while True:
        page = sb.select(
            table,
            {"select": columns, "limit": "1000", "offset": str(offset)},
        )
        found.extend(page)
        if len(page) < 1000:
            return found
        offset += 1000


def verify_batch(batch_id: str) -> dict[str, Any]:
    import_rows = sb.select(
        "catalog_import_rows",
        {
            "select": "committed_product_id,committed_variant_id,normalized_data",
            "batch_id": f"eq.{batch_id}",
            "limit": "1000",
        },
    )
    product_ids = [str(row["committed_product_id"]) for row in import_rows if row.get("committed_product_id")]
    variant_ids = [str(row["committed_variant_id"]) for row in import_rows if row.get("committed_variant_id")]
    images = select_in_chunks(
        "product_images",
        "product_id,storage_path",
        "product_id",
        product_ids,
    )
    imported_variants = select_in_chunks(
        "product_variants",
        "id,product_id,upc,regular_price_cents",
        "id",
        variant_ids,
    )
    all_variants = select_all("product_variants", "upc")
    upc_counts = Counter(str(row["upc"]) for row in all_variants if row.get("upc"))
    duplicate_upcs = {upc: count for upc, count in upc_counts.items() if count > 1}
    imaged_products = {str(row["product_id"]) for row in images}
    imported_products = set(product_ids)
    missing_image_rows = [
        row
        for row in import_rows
        if str(row.get("committed_product_id")) not in imaged_products
    ]
    return {
        "import_rows": len(import_rows),
        "imported_variants": len(imported_variants),
        "imported_unique_upcs": len({row.get("upc") for row in imported_variants if row.get("upc")}),
        "imported_valid_prices": sum(
            1 for row in imported_variants if int(row.get("regular_price_cents") or 0) > 0
        ),
        "imported_products_with_images": len(imported_products & imaged_products),
        "imported_products_missing_images": len(imported_products - imaged_products),
        "missing_images_with_source_url": sum(
            1 for row in missing_image_rows if (row.get("normalized_data") or {}).get("image_url")
        ),
        "missing_image_sample": [
            {
                "name": (row.get("normalized_data") or {}).get("name"),
                "brand": (row.get("normalized_data") or {}).get("brand"),
                "upc": (row.get("normalized_data") or {}).get("upc"),
                "image_url": (row.get("normalized_data") or {}).get("image_url"),
            }
            for row in missing_image_rows[:30]
        ],
        "catalog_variants_scanned": len(all_variants),
        "duplicate_upc_groups": len(duplicate_upcs),
    }


def attach_exact_image(spec: str) -> dict[str, Any]:
    """Attach a verified image to one exact UPC that still has no image."""
    if "=" not in spec:
        raise ValueError("Image specification must be UPC=HTTPS_URL.")
    upc, url = (part.strip() for part in spec.split("=", 1))
    if not digits(upc) or not url:
        raise ValueError("Image specification must include both UPC and URL.")
    if download_product_image(url) is None:
        raise ValueError(f"Image for UPC {upc} could not be downloaded or verified.")

    variants = sb.select(
        "product_variants",
        {"select": "product_id,upc", "upc": f"eq.{digits(upc)}", "limit": "2"},
    )
    if len(variants) != 1:
        raise ValueError(f"UPC {upc} resolved to {len(variants)} variants; expected exactly one.")
    product_id = str(variants[0]["product_id"])
    existing = sb.select(
        "product_images",
        {"select": "id,storage_path", "product_id": f"eq.{product_id}", "limit": "1"},
    )
    if existing:
        return {"upc": digits(upc), "status": "already_has_image", "product_id": product_id}
    products = sb.select(
        "products",
        {"select": "name", "id": f"eq.{product_id}", "limit": "1"},
    )
    product_name = str(products[0]["name"]) if products else "Product"
    inserted = sb.insert(
        "product_images",
        {
            "product_id": product_id,
            "storage_path": url,
            "alt_text": product_name,
            "is_primary": True,
            "display_order": 0,
        },
    )
    return {
        "upc": digits(upc),
        "status": "attached",
        "product_id": product_id,
        "image_id": inserted.get("id"),
    }


def preview_and_maybe_commit(rows: list[dict[str, str]], commit: bool) -> dict[str, Any]:
    if not commit:
        parsed = parse_catalog_csv(csv_bytes(rows))
        preview_rows = []
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
        stats = catalog_import._stats(preview_rows, parsed["stats"]["section_rows"])
        blocking = [row for row in preview_rows if row["detected_action"] in {"error", "conflict"}]
        return {
            "preview_stats": stats,
            "blocking_rows": [
                {
                    "row": row["source_row_number"],
                    "name": row.get("name"),
                    "errors": row.get("errors"),
                }
                for row in blocking[:20]
            ],
        }

    preview = catalog_import.preview_csv(
        csv_bytes(rows),
        "bronxville-merged-deduplicated-import.csv",
        brand_name=None,
        discount_percent=None,
        force_reprocess=True,
    )
    batch = catalog_import._BATCHES[preview["id"]]

    # Reprocessing the same source is safe only when the exact UPC resolves to
    # one existing variant. Never approve a name-only or conflicting match.
    for row in batch["rows"]:
        match = row.get("duplicate_match")
        if not match:
            continue
        if row.get("upc") and "UPC" in (match.get("matched_fields") or []):
            row["approved_existing_variant_id"] = match["variant_id"]
    catalog_import._analyze_rows(batch["rows"], None)
    batch["stats"] = catalog_import._stats(batch["rows"], len(batch.get("sections") or []))

    blocking = [
        row
        for row in batch["rows"]
        if row.get("included", True) and row["detected_action"] in {"error", "conflict"}
    ]
    result: dict[str, Any] = {
        "batch_id": preview["id"],
        "preview_stats": batch["stats"],
        "blocking_rows": [
            {
                "row": row["source_row_number"],
                "name": row.get("name"),
                "errors": row.get("errors"),
            }
            for row in blocking[:20]
        ],
    }
    if commit:
        if blocking:
            raise RuntimeError("Import preview contains blocking rows; nothing was committed.")
        included = [row["source_row_number"] for row in batch["rows"] if row.get("included", True)]
        result["commit"] = catalog_import.commit_csv(
            preview["id"],
            included_row_numbers=included,
            force_reprocess=True,
        )
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--summary", type=Path)
    parser.add_argument("--edlp", type=Path)
    parser.add_argument("--ranking", type=Path)
    parser.add_argument("--commit", action="store_true")
    parser.add_argument("--verify-batch")
    parser.add_argument("--attach-image", action="append", default=[], metavar="UPC=HTTPS_URL")
    args = parser.parse_args()

    if args.attach_image:
        print(json.dumps([attach_exact_image(spec) for spec in args.attach_image], indent=2))
        return
    if args.verify_batch:
        print(json.dumps(verify_batch(args.verify_batch), indent=2))
        return
    if not args.summary or not args.edlp or not args.ranking:
        parser.error("--summary, --edlp, and --ranking are required unless --verify-batch is used")

    source_rows = read_sources([args.summary, args.edlp, args.ranking])
    official = official_catalog(source_rows)
    merged, deferred = merge_rows(source_rows, official)
    report: dict[str, Any] = {
        "source_rows": len(source_rows),
        "unique_source_products": len(merged) + len(deferred),
        "ready_to_import": len(merged),
        "deferred_missing_price": len(deferred),
        "exact_official_upc_matches": sum(1 for row in merged if code_key(row["upc"]) in official),
        "images_found": sum(1 for row in merged if row["image_url"]),
        "ready_by_brand": dict(sorted(Counter(row["brand"] for row in merged).items())),
        "ready_categories": dict(sorted(Counter(row["category"] for row in merged).items())),
        "deferred_by_brand": dict(sorted(Counter(row["brand"] for row in deferred).items())),
        "deferred_sample": deferred[:20],
    }
    report.update(preview_and_maybe_commit(merged, args.commit))
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()
