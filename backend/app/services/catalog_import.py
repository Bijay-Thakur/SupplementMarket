"""CSV preview/commit against Supabase. Preview is memory-only."""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any

from app.catalog.csv_images import download_product_image, image_url_allowed
from app.catalog.csv_normalize import slugify, trim
from app.catalog.csv_parse import parse_catalog_csv
from app.core.config import settings
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.services import supabase_rest as sb

_BATCHES: dict[str, dict[str, Any]] = {}


def merge_nonblank(existing: Any, incoming: Any) -> Any:
    if incoming in (None, "", [], {}):
        return existing
    return incoming


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def preview_csv(
    content: bytes,
    filename: str,
    *,
    brand_name: str | None,
    discount_percent: int | None,
    included_row_numbers: list[int] | None = None,
    column_overrides: dict[str, int] | None = None,
    force_reprocess: bool = False,
) -> dict[str, Any]:
    parsed = parse_catalog_csv(
        content,
        default_brand=brand_name,
        default_discount_percent=discount_percent if discount_percent else None,
        column_overrides=column_overrides,
    )
    include = set(included_row_numbers or [])
    products = parsed["products"]
    existing_by_upc: dict[str, dict[str, Any]] = {}
    existing_by_sku: dict[tuple[str, str], dict[str, Any]] = {}
    if settings.supabase_configured:
        variants = sb.select(
            "product_variants",
            {"select": "id,product_id,upc,supplier_sku,source_name,regular_price_cents,sale_price_cents,form,unit_count,size_value,size_unit,strength_value,strength_unit,cost_price_cents,label"},
        )
        products_rows = {
            row["id"]: row
            for row in sb.select("products", {"select": "id,name,slug,brand_id,category_id,short_description,description,status"})
        }
        brands = {row["id"]: row for row in sb.select("brands", {"select": "id,name,slug"})}
        for variant in variants:
            product = products_rows.get(variant["product_id"], {})
            brand = brands.get(product.get("brand_id"), {})
            packed = {"variant": variant, "product": product, "brand": brand}
            if variant.get("upc"):
                existing_by_upc[variant["upc"]] = packed
            if variant.get("supplier_sku") and (variant.get("source_name") or brand.get("slug")):
                key = (variant.get("source_name") or brand.get("slug") or "", variant["supplier_sku"])
                existing_by_sku[key] = packed

    preview_rows = []
    for product in products:
        selected = not include or product["source_row_number"] in include
        action = "skip" if not selected else "insert"
        match = None
        if product.get("upc") and product["upc"] in existing_by_upc:
            match = existing_by_upc[product["upc"]]
        else:
            brand_slug = slugify(product.get("brand") or brand_name or "")
            sku = product.get("supplier_sku")
            if sku and (brand_slug, sku) in existing_by_sku:
                match = existing_by_sku[(brand_slug, sku)]
        if selected and match:
            action = "update"
            same_price = match["variant"].get("regular_price_cents") == product.get("regular_price_cents")
            same_sale = match["variant"].get("sale_price_cents") == product.get("sale_price_cents")
            same_name = match["product"].get("name") == product.get("name")
            if same_price and same_sale and same_name:
                action = "unchanged"
        if product.get("errors"):
            action = "error"
        if product.get("image_url"):
            ok, reason = image_url_allowed(product["image_url"])
            if not ok:
                product.setdefault("warnings", []).append(reason or "Image URL rejected.")
                product["image_url"] = None
        preview_rows.append({**product, "detected_action": action, "included": selected})

    previous = []
    if settings.supabase_configured:
        previous = sb.select(
            "catalog_import_batches",
            {
                "select": "id,filename,file_sha256,status,inserted_rows,updated_rows,unchanged_rows,created_at",
                "file_sha256": f"eq.{parsed['file_sha256']}",
                "order": "created_at.desc",
                "limit": "5",
            },
        )

    batch_id = str(uuid.uuid4())
    stats = {
        "total_detected": len(preview_rows),
        "valid": sum(1 for r in preview_rows if r["detected_action"] != "error"),
        "new": sum(1 for r in preview_rows if r["detected_action"] == "insert"),
        "updates": sum(1 for r in preview_rows if r["detected_action"] == "update"),
        "unchanged": sum(1 for r in preview_rows if r["detected_action"] == "unchanged"),
        "errors": sum(1 for r in preview_rows if r["detected_action"] == "error"),
        "skipped": sum(1 for r in preview_rows if r["detected_action"] == "skip"),
        "images_found": sum(1 for r in preview_rows if r.get("image_url")),
        "sections": parsed["stats"]["section_rows"],
    }
    payload = {
        "id": batch_id,
        "filename": filename,
        "file_sha256": parsed["file_sha256"],
        "status": "awaiting_confirmation",
        "detected_brand": parsed["detected_brand"] or brand_name,
        "default_discount_percent": discount_percent,
        "columns": parsed["columns"],
        "header_cells": parsed.get("header_cells") or [],
        "sections": parsed["sections"],
        "rows": preview_rows,
        "stats": stats,
        "previous_batches": previous,
        "already_imported": any(b.get("status") == "completed" for b in previous),
        "force_reprocess": force_reprocess,
        "content": content,
        "brand_name": brand_name or parsed["detected_brand"],
        "created_at": _now(),
    }
    _BATCHES[batch_id] = payload
    public = {k: v for k, v in payload.items() if k != "content"}
    return public


def _upsert_brand(name: str) -> dict[str, Any]:
    slug = slugify(name)
    found = sb.select("brands", {"select": "*", "slug": f"eq.{slug}", "limit": "1"})
    if found:
        return found[0]
    return sb.insert("brands", {"name": name, "slug": slug, "is_active": True})


def _upsert_category(name: str | None) -> dict[str, Any] | None:
    if not name:
        return None
    slug = slugify(name)
    found = sb.select("categories", {"select": "*", "slug": f"eq.{slug}", "limit": "1"})
    if found:
        return found[0]
    return sb.insert("categories", {"name": name, "slug": slug, "is_active": True})


def _try_attach_image(row: dict[str, Any], brand_slug: str, product_slug: str, product_id: str) -> None:
    url = row.get("image_url")
    if not url:
        return
    existing_imgs = sb.select("product_images", {"select": "id", "product_id": f"eq.{product_id}", "limit": "1"})
    if existing_imgs:
        return
    downloaded = download_product_image(url)
    if not downloaded:
        row.setdefault("warnings", []).append("Image import failed; the product was saved without an image.")
        return
    content, mime, ext = downloaded
    object_path = f"{brand_slug}/{product_slug}/{uuid.uuid4()}.{ext}"
    try:
        sb.upload_object("product-images", object_path, content, mime)
        sb.insert(
            "product_images",
            {
                "product_id": product_id,
                "storage_path": object_path,
                "alt_text": row.get("name"),
                "is_primary": True,
                "display_order": 0,
            },
        )
    except Exception:
        row.setdefault("warnings", []).append("Image import failed; the product was saved without an image.")


def _unique_slug(base: str) -> str:
    slug = slugify(base)
    existing = sb.select("products", {"select": "id", "slug": f"eq.{slug}", "limit": "1"})
    if not existing:
        return slug
    suffix = hashlib.sha1(uuid.uuid4().bytes).hexdigest()[:8]
    return f"{slug}-{suffix}"


def commit_csv(batch_id: str, *, included_row_numbers: list[int] | None, force_reprocess: bool = False) -> dict[str, Any]:
    batch = _BATCHES.get(batch_id)
    if not batch:
        raise NotFoundError("Import preview expired. Upload the file again.")
    if not settings.supabase_configured:
        raise ValidationError("Supabase is not configured.")
    if batch.get("already_imported") and not force_reprocess and not batch.get("force_reprocess"):
        raise ConflictError("This file was already imported. Confirm reprocess to continue.")

    include = set(included_row_numbers or [r["source_row_number"] for r in batch["rows"] if r.get("included")])
    brand = _upsert_brand(batch.get("brand_name") or "Vital Planet")
    batch_row = sb.insert(
        "catalog_import_batches",
        {
            "filename": batch["filename"],
            "file_sha256": batch["file_sha256"],
            "source_brand_id": brand["id"],
            "status": "processing",
            "default_discount_percent": batch.get("default_discount_percent") or 0,
            "total_rows": batch["stats"]["total_detected"],
            "valid_rows": batch["stats"]["valid"],
            "invalid_rows": batch["stats"]["errors"],
            "force_reprocess": force_reprocess,
            "started_at": _now(),
        },
    )
    inserted = updated = unchanged = skipped = 0
    for row in batch["rows"]:
        action = row["detected_action"]
        if row["source_row_number"] not in include or action == "skip":
            skipped += 1
            sb.insert(
                "catalog_import_rows",
                {
                    "batch_id": batch_row["id"],
                    "source_row_number": row["source_row_number"],
                    "raw_data": row.get("raw") or {},
                    "normalized_data": {k: v for k, v in row.items() if k not in {"raw"}},
                    "detected_action": "skip",
                    "validation_errors": row.get("errors") or [],
                    "validation_warnings": row.get("warnings") or [],
                },
            )
            continue
        if action == "error":
            skipped += 1
            sb.insert(
                "catalog_import_rows",
                {
                    "batch_id": batch_row["id"],
                    "source_row_number": row["source_row_number"],
                    "raw_data": row.get("raw") or {},
                    "normalized_data": row,
                    "detected_action": "error",
                    "validation_errors": row.get("errors") or [],
                    "validation_warnings": row.get("warnings") or [],
                },
            )
            continue
        category = _upsert_category(row.get("category"))
        source_name = brand["slug"]
        existing = None
        if row.get("upc"):
            found = sb.select("product_variants", {"select": "*", "upc": f"eq.{row['upc']}", "limit": "1"})
            existing = found[0] if found else None
        if existing is None and row.get("supplier_sku"):
            found = sb.select(
                "product_variants",
                {
                    "select": "*",
                    "supplier_sku": f"eq.{row['supplier_sku']}",
                    "source_name": f"eq.{source_name}",
                    "limit": "1",
                },
            )
            existing = found[0] if found else None

        committed_product_id = None
        committed_variant_id = None
        if existing:
            product = sb.select("products", {"select": "*", "id": f"eq.{existing['product_id']}", "limit": "1"})[0]
            product_patch = {
                "name": merge_nonblank(product.get("name"), row.get("name")),
                "short_description": merge_nonblank(product.get("short_description"), None),
                "category_id": category["id"] if category else product.get("category_id"),
                "status": "active",
            }
            sb.update("products", {"id": f"eq.{product['id']}"}, product_patch)
            variant_patch = {
                "label": merge_nonblank(existing.get("label"), row.get("size_original") or row.get("form_original")),
                "sku": merge_nonblank(existing.get("sku"), row.get("sku") or row.get("supplier_sku")),
                "upc": merge_nonblank(existing.get("upc"), row.get("upc")),
                "supplier_sku": merge_nonblank(existing.get("supplier_sku"), row.get("supplier_sku")),
                "form": merge_nonblank(existing.get("form"), row.get("form")),
                "strength_value": merge_nonblank(existing.get("strength_value"), row.get("strength_value")),
                "strength_unit": merge_nonblank(existing.get("strength_unit"), row.get("strength_unit")),
                "size_value": merge_nonblank(existing.get("size_value"), row.get("size_value")),
                "size_unit": merge_nonblank(existing.get("size_unit"), row.get("size_unit")),
                "unit_count": merge_nonblank(existing.get("unit_count"), row.get("unit_count")),
                "regular_price_cents": row["regular_price_cents"],
                "sale_price_cents": row.get("sale_price_cents"),
                "cost_price_cents": merge_nonblank(existing.get("cost_price_cents"), row.get("cost_price_cents")),
                "source_name": source_name,
                "is_default": True,
                "is_active": True,
                "availability": "in_stock",
            }
            sb.update("product_variants", {"id": f"eq.{existing['id']}"}, variant_patch)
            committed_product_id = product["id"]
            committed_variant_id = existing["id"]
            if action == "unchanged":
                unchanged += 1
            else:
                updated += 1
            detected = "unchanged" if action == "unchanged" else "update"
            _try_attach_image(row, brand["slug"], product.get("slug") or product["id"], product["id"])
        else:
            product = sb.insert(
                "products",
                {
                    "brand_id": brand["id"],
                    "category_id": category["id"] if category else None,
                    "name": row["name"],
                    "slug": _unique_slug(f"{row['name']}-{row.get('supplier_sku') or row.get('upc') or ''}"),
                    "status": "active",
                    "data_source": "csv_import",
                },
            )
            variant = sb.insert(
                "product_variants",
                {
                    "product_id": product["id"],
                    "label": row.get("size_original") or row.get("form_original") or "Default",
                    "sku": row.get("sku") or row.get("supplier_sku"),
                    "upc": row.get("upc"),
                    "supplier_sku": row.get("supplier_sku"),
                    "form": row.get("form"),
                    "strength_value": row.get("strength_value"),
                    "strength_unit": row.get("strength_unit"),
                    "size_value": row.get("size_value"),
                    "size_unit": row.get("size_unit"),
                    "unit_count": row.get("unit_count"),
                    "regular_price_cents": row["regular_price_cents"],
                    "sale_price_cents": row.get("sale_price_cents"),
                    "cost_price_cents": row.get("cost_price_cents"),
                    "availability": "in_stock",
                    "is_default": True,
                    "is_active": True,
                    "source_name": source_name,
                    "source_row_hash": hashlib.sha256(
                        f"{row.get('upc')}|{row.get('supplier_sku')}|{row.get('name')}".encode()
                    ).hexdigest(),
                },
            )
            committed_product_id = product["id"]
            committed_variant_id = variant["id"]
            inserted += 1
            detected = "insert"
            _try_attach_image(row, brand["slug"], product["slug"], product["id"])
        sb.insert(
            "catalog_import_rows",
            {
                "batch_id": batch_row["id"],
                "source_row_number": row["source_row_number"],
                "raw_data": row.get("raw") or {},
                "normalized_data": {k: v for k, v in row.items() if k != "raw"},
                "detected_action": detected,
                "validation_errors": row.get("errors") or [],
                "validation_warnings": row.get("warnings") or [],
                "committed_product_id": committed_product_id,
                "committed_variant_id": committed_variant_id,
            },
        )

    final_status = "completed"
    sb.update(
        "catalog_import_batches",
        {"id": f"eq.{batch_row['id']}"},
        {
            "status": final_status,
            "inserted_rows": inserted,
            "updated_rows": updated,
            "unchanged_rows": unchanged,
            "skipped_rows": skipped,
            "completed_at": _now(),
        },
    )
    batch["status"] = final_status
    return {
        "id": batch_row["id"],
        "preview_id": batch_id,
        "status": final_status,
        "inserted_rows": inserted,
        "updated_rows": updated,
        "unchanged_rows": unchanged,
        "skipped_rows": skipped,
    }


def list_batches() -> list[dict[str, Any]]:
    if not settings.supabase_configured:
        return []
    return sb.select(
        "catalog_import_batches",
        {"select": "*", "order": "created_at.desc", "limit": "50"},
    )


def get_batch(batch_id: str) -> dict[str, Any]:
    if batch_id in _BATCHES:
        public = {k: v for k, v in _BATCHES[batch_id].items() if k != "content"}
        return public
    found = sb.select("catalog_import_batches", {"select": "*", "id": f"eq.{batch_id}", "limit": "1"})
    if not found:
        raise NotFoundError("Import batch not found.")
    rows = sb.select("catalog_import_rows", {"select": "*", "batch_id": f"eq.{batch_id}", "order": "source_row_number.asc"})
    return {**found[0], "rows": rows}
