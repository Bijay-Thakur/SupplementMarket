"""Authenticated FastAPI catalog-import and product-admin routes."""
from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from app.api.deps import require_supabase_admin
from app.catalog.csv_images import sniff_image
from app.catalog.csv_normalize import slugify
from app.core.config import settings
from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.services import catalog_import
from app.services import supabase_rest as sb

router = APIRouter(prefix="/admin/live", tags=["admin-catalog"], dependencies=[Depends(require_supabase_admin)])


def _public_product(row: dict[str, Any], *, include_cost: bool) -> dict[str, Any]:
    variant = (row.get("product_variants") or [None])[0] or {}
    brand = row.get("brands") or {}
    category = row.get("categories") or {}
    images = row.get("product_images") or []
    primary = next((img for img in images if img.get("is_primary")), images[0] if images else None)
    payload = {
        "id": row["id"],
        "name": row["name"],
        "slug": row["slug"],
        "brand_name": brand.get("name"),
        "brand_slug": brand.get("slug"),
        "category_name": category.get("name"),
        "category_slug": category.get("slug"),
        "form": variant.get("form"),
        "size": None,
        "count": variant.get("unit_count"),
        "strength_value": variant.get("strength_value"),
        "strength_unit": variant.get("strength_unit"),
        "availability": variant.get("availability") or "in_stock",
        "regular_price_cents": variant.get("regular_price_cents"),
        "sale_price_cents": variant.get("sale_price_cents"),
        "sku": variant.get("sku"),
        "upc": variant.get("upc"),
        "supplier_sku": variant.get("supplier_sku"),
        "is_featured": row.get("is_featured"),
        "is_bestseller": row.get("is_best_seller"),
        "is_new": row.get("is_new"),
        "is_active": row.get("status") == "active",
        "is_archived": row.get("status") == "archived",
        "thumbnail_url": (
            f"{settings.supabase_rest_url}/storage/v1/object/public/product-images/{primary['storage_path']}"
            if primary and primary.get("storage_path")
            else None
        ),
        "short_description": row.get("short_description"),
        "long_description": row.get("description"),
        "search_aliases": row.get("search_aliases") or [],
        "brand_id": row.get("brand_id") or brand.get("id"),
        "category_id": row.get("category_id") or category.get("id"),
        "flavor": variant.get("flavor"),
        "updated_at": row.get("updated_at"),
        "status": row.get("status"),
    }
    if include_cost:
        payload["cost_price_cents"] = variant.get("cost_price_cents")
    return payload


@router.post("/catalog-imports/preview")
async def preview(
    request: Request,
    file: UploadFile = File(...),
    brand_name: str | None = Form(default=None),
    discount_percent: int | None = Form(default=None),
    force_reprocess: bool = Form(default=False),
    column_map: str | None = Form(default=None),
):
    origin = request.headers.get("origin")
    if origin and origin != settings.frontend_origin:
        raise ForbiddenError("Invalid request origin.")
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise ValidationError("Only .csv files are accepted.")
    content = await file.read()
    if len(content) > settings.fastapi_max_csv_bytes:
        raise ValidationError("CSV exceeds the 10 MB limit.")
    overrides = None
    if column_map:
        try:
            parsed_map = json.loads(column_map)
            overrides = {str(k): int(v) for k, v in parsed_map.items()}
        except (json.JSONDecodeError, TypeError, ValueError):
            raise ValidationError("column_map must be JSON of field-to-index mappings.")
    return catalog_import.preview_csv(
        content,
        file.filename,
        brand_name=brand_name,
        discount_percent=discount_percent or None,
        force_reprocess=force_reprocess,
        column_overrides=overrides,
    )


@router.post("/catalog-imports/{batch_id}/commit")
def commit(batch_id: str, body: dict[str, Any], request: Request):
    origin = request.headers.get("origin")
    if origin and origin != settings.frontend_origin:
        raise ForbiddenError("Invalid request origin.")
    included = body.get("included_row_numbers")
    if included is not None and not isinstance(included, list):
        raise ValidationError("included_row_numbers must be a list.")
    return catalog_import.commit_csv(
        batch_id,
        included_row_numbers=included,
        force_reprocess=bool(body.get("force_reprocess")),
    )


@router.get("/catalog-imports")
def list_imports():
    return {"items": catalog_import.list_batches()}


@router.get("/catalog-imports/{batch_id}")
def get_import(batch_id: str):
    return catalog_import.get_batch(batch_id)


@router.get("/products")
def list_products(q: str | None = None, brand: str | None = None, category: str | None = None, availability: str | None = None):
    params: dict[str, str] = {
        "select": "id,name,slug,status,is_featured,is_best_seller,is_new,short_description,updated_at,brands(name,slug),categories(name,slug),product_variants(sku,upc,supplier_sku,form,unit_count,strength_value,strength_unit,regular_price_cents,sale_price_cents,cost_price_cents,availability,is_default),product_images(storage_path,is_primary,alt_text)",
        "order": "updated_at.desc",
        "limit": "200",
    }
    rows = sb.select("products", params)
    items = [_public_product(row, include_cost=True) for row in rows]
    needle = (q or "").strip().lower()
    if needle:
        items = [
            item
            for item in items
            if needle in " ".join(
                str(item.get(k) or "")
                for k in ("name", "upc", "sku", "supplier_sku", "brand_name")
            ).lower()
        ]
    if brand:
        items = [item for item in items if item.get("brand_slug") == brand]
    if category:
        items = [item for item in items if item.get("category_slug") == category]
    if availability:
        items = [item for item in items if item.get("availability") == availability]
    return {"items": items, "total": len(items), "page": 1, "page_size": len(items), "pages": 1}


@router.get("/products/{product_id}")
def get_product(product_id: str):
    params: dict[str, str] = {
        "select": "id,name,slug,status,brand_id,category_id,is_featured,is_best_seller,is_new,short_description,description,search_aliases,updated_at,brands(name,slug),categories(name,slug),product_variants(sku,upc,supplier_sku,form,unit_count,size_value,size_unit,strength_value,strength_unit,flavor,regular_price_cents,sale_price_cents,cost_price_cents,availability,is_default),product_images(storage_path,is_primary,alt_text)",
        "id": f"eq.{product_id}",
        "limit": "1",
    }
    rows = sb.select("products", params)
    if not rows:
        raise NotFoundError("Product not found.")
    return _public_product(rows[0], include_cost=True)


@router.post("/products")
def create_product(body: dict[str, Any]):
    name = (body.get("name") or "").strip()
    brand_name = (body.get("brand_name") or body.get("brand") or "").strip()
    brand_id = body.get("brand_id")
    if not name:
        raise ValidationError("Product name and brand are required.", fields={"name": "Required"})
    brand = None
    if brand_id:
        found = sb.select("brands", {"select": "*", "id": f"eq.{brand_id}", "limit": "1"})
        brand = found[0] if found else None
    if brand is None and brand_name:
        brand = catalog_import._upsert_brand(brand_name)
    if brand is None:
        raise ValidationError("Product name and brand are required.", fields={"brand": "Required"})
    if not any(body.get(k) for k in ("upc", "sku", "supplier_sku")):
        raise ValidationError("Provide a UPC, SKU, or supplier SKU.")
    regular = body.get("regular_price_cents")
    if not isinstance(regular, int) or regular < 0:
        raise ValidationError("Regular price must be integer cents.")
    sale = body.get("sale_price_cents")
    if sale is not None and (not isinstance(sale, int) or sale >= regular):
        raise ValidationError("Sale price must be lower than regular price.")
    category_name = body.get("category_name") or body.get("category")
    category = None
    if body.get("category_id"):
        found = sb.select("categories", {"select": "*", "id": f"eq.{body['category_id']}", "limit": "1"})
        category = found[0] if found else None
    if category is None:
        category = catalog_import._upsert_category(category_name)
    product = sb.insert(
        "products",
        {
            "name": name,
            "slug": catalog_import._unique_slug(name),
            "brand_id": brand["id"],
            "category_id": category["id"] if category else None,
            "short_description": body.get("short_description"),
            "description": body.get("description") or body.get("long_description"),
            "search_aliases": body.get("search_aliases") or [],
            "status": "active",
            "is_featured": bool(body.get("is_featured")),
            "is_best_seller": bool(body.get("is_bestseller") or body.get("is_best_seller")),
            "is_new": bool(body.get("is_new")),
            "data_source": "manual",
        },
    )
    sb.insert(
        "product_variants",
        {
            "product_id": product["id"],
            "label": body.get("size") or "Default",
            "sku": body.get("sku") or body.get("supplier_sku"),
            "upc": body.get("upc"),
            "supplier_sku": body.get("supplier_sku"),
            "form": body.get("form"),
            "size_unit": None,
            "unit_count": body.get("count"),
            "strength_value": body.get("strength_value"),
            "strength_unit": body.get("strength_unit"),
            "flavor": body.get("flavor"),
            "regular_price_cents": regular,
            "sale_price_cents": body.get("sale_price_cents"),
            "cost_price_cents": body.get("cost_price_cents"),
            "availability": body.get("availability") or "in_stock",
            "is_default": True,
            "is_active": True,
            "source_name": brand["slug"],
        },
    )
    return {"id": product["id"], "slug": product["slug"]}


@router.patch("/products/{product_id}")
def patch_product(product_id: str, body: dict[str, Any]):
    rows = sb.select("products", {"select": "*,product_variants(*)", "id": f"eq.{product_id}", "limit": "1"})
    if not rows:
        raise ValidationError("Product not found.")
    product = rows[0]
    variant = (product.get("product_variants") or [None])[0]
    product_patch = {
        "name": catalog_import.merge_nonblank(product.get("name"), body.get("name")),
        "short_description": catalog_import.merge_nonblank(product.get("short_description"), body.get("short_description")),
        "description": catalog_import.merge_nonblank(product.get("description"), body.get("description") or body.get("long_description")),
        "is_featured": body.get("is_featured", product.get("is_featured")),
        "is_best_seller": body.get("is_bestseller", body.get("is_best_seller", product.get("is_best_seller"))),
        "is_new": body.get("is_new", product.get("is_new")),
    }
    if "is_active" in body:
        product_patch["status"] = "active" if body.get("is_active") else "archived"
    if "is_archived" in body:
        product_patch["status"] = "archived" if body.get("is_archived") else product.get("status")
    sb.update("products", {"id": f"eq.{product_id}"}, product_patch)
    if variant:
        sb.update(
            "product_variants",
            {"id": f"eq.{variant['id']}"},
            {
                "upc": catalog_import.merge_nonblank(variant.get("upc"), body.get("upc")),
                "sku": catalog_import.merge_nonblank(variant.get("sku"), body.get("sku")),
                "supplier_sku": catalog_import.merge_nonblank(variant.get("supplier_sku"), body.get("supplier_sku")),
                "form": catalog_import.merge_nonblank(variant.get("form"), body.get("form")),
                "unit_count": catalog_import.merge_nonblank(variant.get("unit_count"), body.get("count")),
                "strength_value": catalog_import.merge_nonblank(variant.get("strength_value"), body.get("strength_value")),
                "strength_unit": catalog_import.merge_nonblank(variant.get("strength_unit"), body.get("strength_unit")),
                "flavor": catalog_import.merge_nonblank(variant.get("flavor"), body.get("flavor")),
                "regular_price_cents": body.get("regular_price_cents", variant.get("regular_price_cents")),
                "sale_price_cents": body.get("sale_price_cents", variant.get("sale_price_cents")),
                "cost_price_cents": catalog_import.merge_nonblank(variant.get("cost_price_cents"), body.get("cost_price_cents")),
                "availability": body.get("availability", variant.get("availability")),
            },
        )
    return {"id": product_id, "ok": True}


@router.post("/products/{product_id}/image")
async def upload_product_image(
    product_id: str,
    file: UploadFile = File(...),
    alt_text: str = Form(default=""),
):
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise ValidationError("Image exceeds the 5 MB limit.")
    sniffed = sniff_image(content, file.content_type)
    if not sniffed:
        raise ValidationError("Only JPEG, PNG, WebP, or AVIF images are accepted.")
    mime, ext = sniffed
    rows = sb.select(
        "products",
        {"select": "id,slug,brands(slug)", "id": f"eq.{product_id}", "limit": "1"},
    )
    if not rows:
        raise NotFoundError("Product not found.")
    product = rows[0]
    brand_slug = (product.get("brands") or {}).get("slug") or "brand"
    object_path = f"{slugify(brand_slug)}/{slugify(product.get('slug') or product_id)}/{uuid.uuid4()}.{ext}"
    sb.upload_object("product-images", object_path, content, mime)
    sb.insert(
        "product_images",
        {
            "product_id": product_id,
            "storage_path": object_path,
            "alt_text": alt_text or product.get("name"),
            "is_primary": True,
            "display_order": 0,
        },
    )
    return {"ok": True, "storage_path": object_path}


@router.delete("/products/{product_id}")
def archive_product(product_id: str):
    sb.update("products", {"id": f"eq.{product_id}"}, {"status": "archived"})
    return {"id": product_id, "status": "archived"}
