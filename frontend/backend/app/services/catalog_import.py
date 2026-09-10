"""CSV preview/review/commit workflow backed by private Supabase staging tables."""
from __future__ import annotations

import hashlib
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

from app.catalog.csv_images import download_product_image, image_url_allowed
from app.catalog.csv_normalize import slugify, trim
from app.catalog.csv_parse import DetectedColumn, parse_catalog_csv, parse_product_row
from app.core.config import settings
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.services import supabase_rest as sb

_BATCHES: dict[str, dict[str, Any]] = {}

EDITABLE_RAW_FIELDS = (
    "name",
    "brand",
    "category",
    "sku",
    "supplier_sku",
    "upc",
    "regular_price",
    "sale_price",
    "cost_price",
    "discount",
    "availability",
    "size",
    "form",
    "strength",
    "image",
)
IDENTITY_FIELDS = {"brand", "sku", "supplier_sku", "upc"}
ANALYSIS_ERROR_PREFIXES = (
    "Duplicate UPC in this file.",
    "Duplicate SKU in this file.",
    "Duplicate supplier SKU in this file.",
    "Duplicate product name in this file.",
    "A product with this ",
    "These identifiers match different existing products.",
)


def merge_nonblank(existing: Any, incoming: Any) -> Any:
    if incoming in (None, "", [], {}):
        return existing
    return incoming


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _public_batch(batch: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in batch.items() if k != "content"}


def _catalog_indexes() -> dict[str, dict[Any, dict[str, Any]]]:
    indexes: dict[str, dict[Any, dict[str, Any]]] = {
        "upc": {},
        "sku": {},
        "supplier_sku": {},
        "name_brand": {},
    }
    if not settings.supabase_configured:
        return indexes
    with ThreadPoolExecutor(max_workers=3) as executor:
        variants_future = executor.submit(
            sb.select,
            "product_variants",
            {
                "select": (
                    "id,product_id,sku,upc,supplier_sku,source_name,regular_price_cents,"
                    "sale_price_cents,form,unit_count,size_value,size_unit,strength_value,"
                    "strength_unit,cost_price_cents,label,availability"
                )
            },
        )
        products_future = executor.submit(
            sb.select,
            "products",
            {"select": "id,name,slug,brand_id,category_id,short_description,description,status"},
        )
        brands_future = executor.submit(
            sb.select,
            "brands",
            {"select": "id,name,slug,discount_percent"},
        )
        variants = variants_future.result()
        products_rows = {row["id"]: row for row in products_future.result()}
        brands = {row["id"]: row for row in brands_future.result()}
    for variant in variants:
        product = products_rows.get(variant["product_id"], {})
        brand = brands.get(product.get("brand_id"), {})
        packed = {"variant": variant, "product": product, "brand": brand}
        if variant.get("upc"):
            indexes["upc"][variant["upc"]] = packed
        if variant.get("sku"):
            indexes["sku"][variant["sku"]] = packed
        source_name = variant.get("source_name") or brand.get("slug")
        if variant.get("supplier_sku") and source_name:
            indexes["supplier_sku"][(source_name, variant["supplier_sku"])] = packed
        if product.get("name") and brand.get("slug"):
            indexes["name_brand"][(brand["slug"], slugify(product["name"]))] = packed
    return indexes


def _existing_matches(
    row: dict[str, Any],
    indexes: dict[str, dict[Any, dict[str, Any]]],
    default_brand: str | None,
) -> tuple[list[dict[str, Any]], list[str]]:
    brand_slug = slugify(row.get("brand") or default_brand or "")
    candidates: list[tuple[str, dict[str, Any] | None]] = [
        ("UPC", indexes["upc"].get(row.get("upc")) if row.get("upc") else None),
        ("SKU", indexes["sku"].get(row.get("sku")) if row.get("sku") else None),
    ]
    supplier_sku = row.get("supplier_sku")
    if supplier_sku:
        candidates.append(
            ("supplier SKU", indexes["supplier_sku"].get((brand_slug, supplier_sku)))
        )
    if row.get("name") and brand_slug:
        candidates.append(
            (
                "brand + product name",
                indexes["name_brand"].get((brand_slug, slugify(row["name"]))),
            )
        )
    matches: dict[str, dict[str, Any]] = {}
    matched_fields: list[str] = []
    for field, packed in candidates:
        if not packed:
            continue
        variant_id = str(packed["variant"]["id"])
        matches[variant_id] = packed
        matched_fields.append(field)
    return list(matches.values()), matched_fields


def _same_as_existing(row: dict[str, Any], packed: dict[str, Any]) -> bool:
    variant = packed["variant"]
    product = packed["product"]
    brand = packed["brand"]
    return all(
        (
            product.get("name") == row.get("name"),
            brand.get("slug") == slugify(row.get("brand") or ""),
            variant.get("sku") == row.get("sku"),
            variant.get("upc") == row.get("upc"),
            variant.get("supplier_sku") == row.get("supplier_sku"),
            variant.get("regular_price_cents") == row.get("regular_price_cents"),
            variant.get("sale_price_cents") == row.get("sale_price_cents"),
            (variant.get("availability") or "in_stock") == (row.get("availability") or "in_stock"),
        )
    )


def _stats(rows: list[dict[str, Any]], section_count: int) -> dict[str, int]:
    blocking = {"error", "conflict"}
    return {
        "total_detected": len(rows),
        "valid": sum(1 for row in rows if row["detected_action"] not in blocking),
        "new": sum(1 for row in rows if row["detected_action"] == "insert"),
        "conflicts": sum(1 for row in rows if row["detected_action"] == "conflict"),
        "blocking": sum(1 for row in rows if row["detected_action"] in blocking),
        "updates": sum(1 for row in rows if row["detected_action"] == "update"),
        "unchanged": sum(1 for row in rows if row["detected_action"] == "unchanged"),
        "errors": sum(1 for row in rows if row["detected_action"] == "error"),
        "skipped": sum(1 for row in rows if row["detected_action"] == "skip"),
        "images_found": sum(1 for row in rows if row.get("image_url")),
        "sections": section_count,
    }


def _analyze_rows(
    rows: list[dict[str, Any]],
    default_brand: str | None,
    *,
    included: set[int] | None = None,
) -> None:
    indexes = _catalog_indexes()
    selected_rows = [
        row
        for row in rows
        if (row["source_row_number"] in included if included is not None else row.get("included", True))
    ]
    duplicate_keys: dict[tuple[str, str], list[int]] = {}
    for row in selected_rows:
        brand_slug = slugify(row.get("brand") or default_brand or "")
        keys = []
        if row.get("upc"):
            keys.append(("UPC", str(row["upc"])))
        if row.get("sku"):
            keys.append(("SKU", str(row["sku"])))
        if row.get("supplier_sku"):
            keys.append(("supplier SKU", f"{brand_slug}|{row['supplier_sku']}"))
        if not keys and row.get("name") and brand_slug:
            keys.append(("product name", f"{brand_slug}|{slugify(row['name'])}"))
        for key in keys:
            duplicate_keys.setdefault(key, []).append(row["source_row_number"])

    for row in rows:
        row["errors"] = [
            error
            for error in (row.get("errors") or [])
            if not any(error.startswith(prefix) for prefix in ANALYSIS_ERROR_PREFIXES)
        ]
        row.pop("duplicate_match", None)
        is_selected = (
            row["source_row_number"] in included if included is not None else row.get("included", True)
        )
        if not is_selected:
            row["detected_action"] = "skip"
            continue

        brand_slug = slugify(row.get("brand") or default_brand or "")
        row_keys = []
        if row.get("upc"):
            row_keys.append(("UPC", str(row["upc"])))
        if row.get("sku"):
            row_keys.append(("SKU", str(row["sku"])))
        if row.get("supplier_sku"):
            row_keys.append(("supplier SKU", f"{brand_slug}|{row['supplier_sku']}"))
        if not row_keys and row.get("name") and brand_slug:
            row_keys.append(("product name", f"{brand_slug}|{slugify(row['name'])}"))
        repeated = [label for label, key in row_keys if len(duplicate_keys.get((label, key), [])) > 1]
        for label in repeated:
            row["errors"].append(f"Duplicate {label} in this file.")

        matches, matched_fields = _existing_matches(row, indexes, default_brand)
        if len(matches) > 1:
            row["errors"].append("These identifiers match different existing products.")
        elif matches:
            packed = matches[0]
            match_id = str(packed["variant"]["id"])
            row["duplicate_match"] = {
                "variant_id": match_id,
                "product_id": packed["product"].get("id"),
                "product_name": packed["product"].get("name"),
                "matched_fields": matched_fields,
            }
            if row.get("approved_existing_variant_id") == match_id and not repeated:
                row["detected_action"] = (
                    "unchanged" if _same_as_existing(row, packed) else "update"
                )
                if row["errors"]:
                    row["detected_action"] = "error"
                continue
            fields = ", ".join(matched_fields)
            row["errors"].append(
                f"A product with this {fields} already exists. Edit the identifiers or approve updating that product."
            )

        if row["errors"]:
            has_duplicate = bool(repeated or matches)
            row["detected_action"] = "conflict" if has_duplicate else "error"
        else:
            row["detected_action"] = "insert"


def _sanitize_image(row: dict[str, Any]) -> None:
    if not row.get("image_url"):
        return
    ok, reason = image_url_allowed(row["image_url"])
    if not ok:
        row.setdefault("warnings", []).append(reason or "Image URL rejected.")
        row["image_url"] = None


def _preview_metadata(batch: dict[str, Any]) -> dict[str, Any]:
    return {
        "detected_brand": batch.get("detected_brand"),
        "columns": batch.get("columns") or {},
        "header_cells": batch.get("header_cells") or [],
        "sections": batch.get("sections") or [],
        "previous_batches": batch.get("previous_batches") or [],
        "already_imported": bool(batch.get("already_imported")),
        "brand_name": batch.get("brand_name"),
        "created_at": batch.get("created_at"),
    }


def _persist_preview_batch(batch: dict[str, Any]) -> None:
    if not settings.supabase_configured:
        return
    sb.insert(
        "catalog_import_batches",
        {
            "id": batch["id"],
            "filename": batch["filename"],
            "file_sha256": batch["file_sha256"],
            "status": "awaiting_confirmation",
            "default_discount_percent": batch.get("default_discount_percent") or 0,
            "total_rows": batch["stats"]["total_detected"],
            "valid_rows": batch["stats"]["valid"],
            "invalid_rows": batch["stats"]["blocking"],
            "force_reprocess": bool(batch.get("force_reprocess")),
            "preview_metadata": _preview_metadata(batch),
            "started_at": batch.get("created_at") or _now(),
        },
    )
    try:
        sb.insert_many(
            "catalog_import_rows",
            [
                {
                    "batch_id": batch["id"],
                    "source_row_number": row["source_row_number"],
                    "raw_data": row.get("raw") or {},
                    "normalized_data": {k: v for k, v in row.items() if k != "raw"},
                    "detected_action": row["detected_action"],
                    "validation_errors": row.get("errors") or [],
                    "validation_warnings": row.get("warnings") or [],
                }
                for row in batch["rows"]
            ],
        )
    except Exception:
        sb.update(
            "catalog_import_batches",
            {"id": f"eq.{batch['id']}"},
            {"status": "failed", "completed_at": _now()},
        )
        raise


def _persist_preview_row(batch: dict[str, Any], row: dict[str, Any]) -> None:
    if not settings.supabase_configured:
        return
    sb.update(
        "catalog_import_rows",
        {
            "batch_id": f"eq.{batch['id']}",
            "source_row_number": f"eq.{row['source_row_number']}",
        },
        {
            "raw_data": row.get("raw") or {},
            "normalized_data": {k: v for k, v in row.items() if k != "raw"},
            "detected_action": row["detected_action"],
            "validation_errors": row.get("errors") or [],
            "validation_warnings": row.get("warnings") or [],
        },
    )


def _persist_preview_stats(batch: dict[str, Any]) -> None:
    if not settings.supabase_configured:
        return
    sb.update(
        "catalog_import_batches",
        {"id": f"eq.{batch['id']}"},
        {
            "valid_rows": batch["stats"]["valid"],
            "invalid_rows": batch["stats"]["blocking"],
            "preview_metadata": _preview_metadata(batch),
        },
    )


def _load_preview_batch(batch_id: str) -> dict[str, Any] | None:
    if not settings.supabase_configured:
        return None
    found = sb.select(
        "catalog_import_batches",
        {"select": "*", "id": f"eq.{batch_id}", "limit": "1"},
    )
    if not found:
        return None
    stored = found[0]
    if stored.get("status") != "awaiting_confirmation":
        return None
    metadata = stored.get("preview_metadata") or {}
    stored_rows = sb.select(
        "catalog_import_rows",
        {"select": "*", "batch_id": f"eq.{batch_id}", "order": "source_row_number.asc"},
    )
    rows = []
    for stored_row in stored_rows:
        normalized = dict(stored_row.get("normalized_data") or {})
        normalized["source_row_number"] = stored_row["source_row_number"]
        normalized["raw"] = stored_row.get("raw_data") or {}
        normalized["detected_action"] = stored_row.get("detected_action") or "error"
        normalized["errors"] = stored_row.get("validation_errors") or []
        normalized["warnings"] = stored_row.get("validation_warnings") or []
        rows.append(normalized)
    batch = {
        "id": stored["id"],
        "filename": stored["filename"],
        "file_sha256": stored["file_sha256"],
        "status": stored["status"],
        "detected_brand": metadata.get("detected_brand"),
        "default_discount_percent": stored.get("default_discount_percent"),
        "columns": metadata.get("columns") or {},
        "header_cells": metadata.get("header_cells") or [],
        "sections": metadata.get("sections") or [],
        "rows": rows,
        "stats": _stats(rows, len(metadata.get("sections") or [])),
        "previous_batches": metadata.get("previous_batches") or [],
        "already_imported": bool(metadata.get("already_imported")),
        "force_reprocess": bool(stored.get("force_reprocess")),
        "brand_name": metadata.get("brand_name"),
        "created_at": metadata.get("created_at") or stored.get("created_at"),
    }
    _BATCHES[batch_id] = batch
    return batch


def _pending_batch(batch_id: str) -> dict[str, Any]:
    batch = _BATCHES.get(batch_id) or _load_preview_batch(batch_id)
    if not batch or batch.get("status") != "awaiting_confirmation":
        raise NotFoundError("Import preview expired or was already completed. Upload the file again.")
    return batch


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
    try:
        parsed = parse_catalog_csv(
            content,
            default_brand=brand_name,
            default_discount_percent=discount_percent if discount_percent else None,
            column_overrides=column_overrides,
        )
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    include = set(included_row_numbers or [])
    preview_rows = []
    for product in parsed["products"]:
        selected = not include or product["source_row_number"] in include
        row = {
            **product,
            "detected_action": "insert",
            "included": selected,
            "approved_existing_variant_id": None,
            "edited_fields": [],
        }
        _sanitize_image(row)
        preview_rows.append(row)
    _analyze_rows(preview_rows, parsed["detected_brand"] or brand_name)

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
    stats = _stats(preview_rows, parsed["stats"]["section_rows"])
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
    try:
        _persist_preview_batch(payload)
    except Exception:
        _BATCHES.pop(batch_id, None)
        raise
    return _public_batch(payload)


def update_preview_row(batch_id: str, source_row_number: int, body: dict[str, Any]) -> dict[str, Any]:
    batch = _pending_batch(batch_id)
    row_index = next(
        (index for index, row in enumerate(batch["rows"]) if row["source_row_number"] == source_row_number),
        None,
    )
    if row_index is None:
        raise NotFoundError("Import row not found.")

    edits = body.get("edits") or {}
    if not isinstance(edits, dict):
        raise ValidationError("edits must be an object.")
    unknown = sorted(set(edits) - set(EDITABLE_RAW_FIELDS))
    if unknown:
        raise ValidationError(f"Unsupported import fields: {', '.join(unknown)}.")
    current = batch["rows"][row_index]
    if edits:
        raw = {field: trim((current.get("raw") or {}).get(field)) for field in EDITABLE_RAW_FIELDS}
        for field, value in edits.items():
            raw[field] = trim(value)
        cells = [raw[field] for field in EDITABLE_RAW_FIELDS]
        mapping = {
            field: DetectedColumn(field=field, header=field, index=index)
            for index, field in enumerate(EDITABLE_RAW_FIELDS)
        }
        parsed = parse_product_row(
            cells,
            mapping,
            source_row_number,
            current_category=raw.get("category") or None,
            default_brand=batch.get("brand_name") or batch.get("detected_brand"),
            default_discount_percent=batch.get("default_discount_percent") or None,
        ).as_preview()
        edited_fields = sorted(set(current.get("edited_fields") or []) | set(edits))
        approved_id = current.get("approved_existing_variant_id")
        if IDENTITY_FIELDS.intersection(edits):
            approved_id = None
        current = {
            **parsed,
            "included": current.get("included", True),
            "detected_action": "insert",
            "approved_existing_variant_id": approved_id,
            "edited_fields": edited_fields,
        }
        _sanitize_image(current)
        batch["rows"][row_index] = current

    _analyze_rows(batch["rows"], batch.get("brand_name") or batch.get("detected_brand"))
    resolution = body.get("resolution")
    if resolution == "update_existing":
        match = batch["rows"][row_index].get("duplicate_match")
        if not match:
            raise ValidationError("This row no longer matches an existing product.")
        batch["rows"][row_index]["approved_existing_variant_id"] = match["variant_id"]
        _analyze_rows(batch["rows"], batch.get("brand_name") or batch.get("detected_brand"))
    elif resolution == "clear":
        batch["rows"][row_index]["approved_existing_variant_id"] = None
        _analyze_rows(batch["rows"], batch.get("brand_name") or batch.get("detected_brand"))
    elif resolution is not None:
        raise ValidationError("resolution must be update_existing or clear.")

    batch["stats"] = _stats(batch["rows"], len(batch.get("sections") or []))
    for row in batch["rows"]:
        _persist_preview_row(batch, row)
    _persist_preview_stats(batch)
    return _public_batch(batch)


def update_preview_selection(batch_id: str, included_row_numbers: list[int]) -> dict[str, Any]:
    batch = _pending_batch(batch_id)
    include = set(included_row_numbers)
    known = {row["source_row_number"] for row in batch["rows"]}
    unknown = sorted(include - known)
    if unknown:
        raise ValidationError(f"Unknown CSV row numbers: {', '.join(str(value) for value in unknown)}.")
    for row in batch["rows"]:
        row["included"] = row["source_row_number"] in include
    _analyze_rows(batch["rows"], batch.get("brand_name") or batch.get("detected_brand"))
    batch["stats"] = _stats(batch["rows"], len(batch.get("sections") or []))
    for row in batch["rows"]:
        _persist_preview_row(batch, row)
    _persist_preview_stats(batch)
    return _public_batch(batch)


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


def _record_import_row(
    batch_id: str,
    row: dict[str, Any],
    detected_action: str,
    *,
    committed_product_id: str | None = None,
    committed_variant_id: str | None = None,
) -> None:
    sb.update(
        "catalog_import_rows",
        {
            "batch_id": f"eq.{batch_id}",
            "source_row_number": f"eq.{row['source_row_number']}",
        },
        {
            "raw_data": row.get("raw") or {},
            "normalized_data": {k: v for k, v in row.items() if k != "raw"},
            "detected_action": detected_action,
            "validation_errors": row.get("errors") or [],
            "validation_warnings": row.get("warnings") or [],
            "committed_product_id": committed_product_id,
            "committed_variant_id": committed_variant_id,
        },
    )


def commit_csv(batch_id: str, *, included_row_numbers: list[int] | None, force_reprocess: bool = False) -> dict[str, Any]:
    batch = _pending_batch(batch_id)
    if not settings.supabase_configured:
        raise ValidationError("Supabase is not configured.")
    if batch.get("already_imported") and not force_reprocess and not batch.get("force_reprocess"):
        raise ConflictError("This file was already imported. Confirm reprocess to continue.")

    include = set(included_row_numbers or [r["source_row_number"] for r in batch["rows"] if r.get("included")])
    if not include:
        raise ValidationError("Select at least one valid row to import.")

    # Re-run duplicate checks immediately before the first write. This prevents a
    # stale preview from overwriting a product created by another administrator.
    _analyze_rows(
        batch["rows"],
        batch.get("brand_name") or batch.get("detected_brand"),
        included=include,
    )
    batch["stats"] = _stats(batch["rows"], len(batch.get("sections") or []))
    blocking = [
        row
        for row in batch["rows"]
        if row["source_row_number"] in include
        and row["detected_action"] in {"error", "conflict"}
    ]
    if blocking:
        rows = ", ".join(str(row["source_row_number"]) for row in blocking[:10])
        raise ValidationError(
            f"Resolve or exclude blocking import rows before confirming: {rows}.",
            fields={"rows": rows},
        )

    selected_rows = [row for row in batch["rows"] if row["source_row_number"] in include]
    batch_brand_name = (
        batch.get("brand_name")
        or batch.get("detected_brand")
        or next((row.get("brand") for row in selected_rows if row.get("brand")), None)
    )
    batch_brand = _upsert_brand(batch_brand_name) if batch_brand_name else None
    brand_cache: dict[str, dict[str, Any]] = {}
    if batch_brand and batch_brand_name:
        brand_cache[slugify(batch_brand_name)] = batch_brand
    sb.update(
        "catalog_import_batches",
        {"id": f"eq.{batch_id}"},
        {
            "source_brand_id": batch_brand["id"] if batch_brand else None,
            "status": "processing",
            "default_discount_percent": batch.get("default_discount_percent") or 0,
            "total_rows": batch["stats"]["total_detected"],
            "valid_rows": batch["stats"]["valid"],
            "invalid_rows": batch["stats"]["blocking"],
            "force_reprocess": force_reprocess,
            "started_at": _now(),
        },
    )
    batch_row = {"id": batch_id}
    inserted = updated = unchanged = skipped = 0
    try:
        for row in batch["rows"]:
            action = row["detected_action"]
            if row["source_row_number"] not in include or action == "skip":
                skipped += 1
                _record_import_row(batch_row["id"], row, "skip")
                continue

            brand_name = row.get("brand") or batch_brand_name
            if not brand_name:
                raise ValidationError(f"Brand is required for row {row['source_row_number']}.")
            brand_key = slugify(brand_name)
            brand = brand_cache.get(brand_key)
            if brand is None:
                brand = _upsert_brand(brand_name)
                brand_cache[brand_key] = brand
            category = _upsert_category(row.get("category"))
            source_name = brand["slug"]
            committed_product_id = None
            committed_variant_id = None

            if action in {"update", "unchanged"}:
                approved_id = row.get("approved_existing_variant_id")
                found = sb.select(
                    "product_variants",
                    {"select": "*", "id": f"eq.{approved_id}", "limit": "1"},
                )
                if not found:
                    raise ConflictError(
                        f"The approved product for row {row['source_row_number']} changed. Preview again."
                    )
                existing = found[0]
                products = sb.select(
                    "products",
                    {"select": "*", "id": f"eq.{existing['product_id']}", "limit": "1"},
                )
                if not products:
                    raise ConflictError(
                        f"The approved product for row {row['source_row_number']} no longer exists."
                    )
                product = products[0]
                sb.update(
                    "products",
                    {"id": f"eq.{product['id']}"},
                    {
                        "name": merge_nonblank(product.get("name"), row.get("name")),
                        "brand_id": brand["id"],
                        "category_id": category["id"] if category else product.get("category_id"),
                        "status": "active",
                    },
                )
                sb.update(
                    "product_variants",
                    {"id": f"eq.{existing['id']}"},
                    {
                        "label": merge_nonblank(
                            existing.get("label"),
                            row.get("size_original") or row.get("form_original"),
                        ),
                        "sku": merge_nonblank(existing.get("sku"), row.get("sku")),
                        "upc": merge_nonblank(existing.get("upc"), row.get("upc")),
                        "supplier_sku": merge_nonblank(
                            existing.get("supplier_sku"), row.get("supplier_sku")
                        ),
                        "form": merge_nonblank(existing.get("form"), row.get("form")),
                        "strength_value": merge_nonblank(
                            existing.get("strength_value"), row.get("strength_value")
                        ),
                        "strength_unit": merge_nonblank(
                            existing.get("strength_unit"), row.get("strength_unit")
                        ),
                        "size_value": merge_nonblank(
                            existing.get("size_value"), row.get("size_value")
                        ),
                        "size_unit": merge_nonblank(
                            existing.get("size_unit"), row.get("size_unit")
                        ),
                        "unit_count": merge_nonblank(
                            existing.get("unit_count"), row.get("unit_count")
                        ),
                        "regular_price_cents": row["regular_price_cents"],
                        "sale_price_cents": row.get("sale_price_cents"),
                        "cost_price_cents": merge_nonblank(
                            existing.get("cost_price_cents"), row.get("cost_price_cents")
                        ),
                        "source_name": source_name,
                        "is_default": True,
                        "is_active": True,
                        "availability": row.get("availability") or "in_stock",
                    },
                )
                committed_product_id = product["id"]
                committed_variant_id = existing["id"]
                if action == "unchanged":
                    unchanged += 1
                else:
                    updated += 1
                detected = action
                _try_attach_image(
                    row,
                    brand["slug"],
                    product.get("slug") or product["id"],
                    product["id"],
                )
            else:
                product = sb.insert(
                    "products",
                    {
                        "brand_id": brand["id"],
                        "category_id": category["id"] if category else None,
                        "name": row["name"],
                        "slug": _unique_slug(
                            f"{row['name']}-{row.get('supplier_sku') or row.get('sku') or row.get('upc') or ''}"
                        ),
                        "status": "active",
                        "data_source": "csv_import",
                    },
                )
                variant = sb.insert(
                    "product_variants",
                    {
                        "product_id": product["id"],
                        "label": row.get("size_original") or row.get("form_original") or "Default",
                        "sku": row.get("sku"),
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
                        "availability": row.get("availability") or "in_stock",
                        "is_default": True,
                        "is_active": True,
                        "source_name": source_name,
                        "source_row_hash": hashlib.sha256(
                            (
                                f"{row.get('upc')}|{row.get('sku')}|{row.get('supplier_sku')}|"
                                f"{row.get('brand')}|{row.get('name')}"
                            ).encode()
                        ).hexdigest(),
                    },
                )
                committed_product_id = product["id"]
                committed_variant_id = variant["id"]
                inserted += 1
                detected = "insert"
                _try_attach_image(row, brand["slug"], product["slug"], product["id"])

            _record_import_row(
                batch_row["id"],
                row,
                detected,
                committed_product_id=committed_product_id,
                committed_variant_id=committed_variant_id,
            )
    except Exception:
        sb.update(
            "catalog_import_batches",
            {"id": f"eq.{batch_row['id']}"},
            {
                "status": "partially_completed" if inserted or updated else "failed",
                "inserted_rows": inserted,
                "updated_rows": updated,
                "unchanged_rows": unchanged,
                "skipped_rows": skipped,
                "completed_at": _now(),
            },
        )
        raise

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
        return _public_batch(_BATCHES[batch_id])
    pending = _load_preview_batch(batch_id)
    if pending:
        return _public_batch(pending)
    found = sb.select("catalog_import_batches", {"select": "*", "id": f"eq.{batch_id}", "limit": "1"})
    if not found:
        raise NotFoundError("Import batch not found.")
    rows = sb.select("catalog_import_rows", {"select": "*", "batch_id": f"eq.{batch_id}", "order": "source_row_number.asc"})
    return {**found[0], "rows": rows}
