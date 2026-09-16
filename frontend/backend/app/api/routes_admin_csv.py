"""Authenticated FastAPI catalog-import and product-admin routes."""
from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile

from app.api.deps import require_supabase_admin
from app.catalog.csv_images import sniff_image
from app.catalog.csv_normalize import slugify
from app.core.config import settings
from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.services import catalog_import
from app.services import supabase_rest as sb

router = APIRouter(prefix="/admin/live", tags=["admin-catalog"], dependencies=[Depends(require_supabase_admin)])


def _brand_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "slug": row["slug"],
        "description": row.get("description"),
        "is_featured": bool(row.get("is_featured")),
        "discount_percent": row.get("discount_percent"),
        "display_order": int(row.get("display_order") or 0),
    }


def _discount_percent(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 99:
        raise ValidationError(
            "Discount percent must be a whole number from 0 to 99.",
            fields={"discount_percent": "Use a whole number from 0 to 99."},
        )
    return value


def _unique_brand_slug(name: str, current_id: str | None = None) -> str:
    base = slugify(name)
    candidate = base
    suffix = 2
    while True:
        matches = sb.select(
            "brands",
            {"select": "id", "slug": f"eq.{candidate}", "limit": "1"},
        )
        if not matches or (current_id and str(matches[0]["id"]) == current_id):
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


@router.get("/brands")
def list_brands():
    rows = sb.select(
        "brands",
        {
            "select": "id,name,slug,description,is_featured,is_active,display_order,discount_percent",
            "order": "name.asc",
        },
    )
    return [_brand_payload(row) for row in rows if row.get("is_active", True)]


@router.post("/brands", status_code=201)
def create_brand(body: dict[str, Any]):
    name = str(body.get("name") or "").strip()
    if not name:
        raise ValidationError("Brand name is required.", fields={"name": "Required"})
    discount = _discount_percent(body.get("discount_percent"))
    row = sb.insert(
        "brands",
        {
            "name": name,
            "slug": _unique_brand_slug(name),
            "description": body.get("description"),
            "is_featured": bool(body.get("is_featured")),
            "discount_percent": discount,
        },
    )
    return _brand_payload(row)


@router.patch("/brands/{brand_id}")
def patch_brand(brand_id: str, body: dict[str, Any]):
    rows = sb.select("brands", {"select": "*", "id": f"eq.{brand_id}", "limit": "1"})
    if not rows:
        raise NotFoundError("Brand not found.")
    patch: dict[str, Any] = {}
    if "name" in body:
        name = str(body.get("name") or "").strip()
        if not name:
            raise ValidationError("Brand name is required.", fields={"name": "Required"})
        patch["name"] = name
        patch["slug"] = _unique_brand_slug(name, brand_id)
    if "description" in body:
        patch["description"] = body.get("description")
    if "is_featured" in body:
        patch["is_featured"] = bool(body.get("is_featured"))
    if "display_order" in body:
        patch["display_order"] = int(body.get("display_order") or 0)
    if "discount_percent" in body:
        patch["discount_percent"] = _discount_percent(body.get("discount_percent"))
    updated = sb.update("brands", {"id": f"eq.{brand_id}"}, patch) if patch else rows[0]
    if not updated:
        raise NotFoundError("Brand not found.")
    return _brand_payload(updated)


def _public_product(row: dict[str, Any], *, include_cost: bool) -> dict[str, Any]:
    variants = row.get("product_variants") or []
    variant = next(
        (item for item in variants if item and item.get("is_default")),
        variants[0] if variants else {},
    ) or {}
    brand = row.get("brands") or {}
    category = row.get("categories") or {}
    images = row.get("product_images") or []
    primary = next((img for img in images if img.get("is_primary")), images[0] if images else None)
    tags = row.get("product_tags") or []
    dietary_tags = {
        str(tag.get("tag") or "").strip().lower()
        for tag in tags
        if tag.get("tag_type") in {"dietary", "free_from"}
    }
    regular_price = int(variant.get("regular_price_cents") or 0)
    raw_sale_price = variant.get("sale_price_cents")
    sale_price = int(raw_sale_price) if raw_sale_price is not None else None
    on_sale = sale_price is not None and sale_price < regular_price
    effective_price = sale_price if on_sale else regular_price
    discount = round((regular_price - sale_price) * 100 / regular_price) if on_sale and regular_price else None

    def image_url(image: dict[str, Any]) -> str | None:
        path = image.get("storage_path")
        if not path:
            return None
        if str(path).startswith(("http://", "https://")):
            return str(path)
        return f"{settings.supabase_rest_url}/storage/v1/object/public/product-images/{path}"

    image_payload = [
        {
            "id": image.get("id") or index + 1,
            "url": image_url(image),
            "alt_text": image.get("alt_text"),
            "display_order": int(image.get("display_order") or index),
            "is_primary": bool(image.get("is_primary")),
        }
        for index, image in enumerate(images)
        if image_url(image)
    ]
    size = None
    if variant.get("size_value") is not None:
        size = f"{variant['size_value']}{variant.get('size_unit') or ''}"
    payload = {
        "id": row["id"],
        "name": row["name"],
        "slug": row["slug"],
        "brand_name": brand.get("name"),
        "brand_slug": brand.get("slug"),
        "category_name": category.get("name"),
        "category_slug": category.get("slug"),
        "form": variant.get("form"),
        "size": size,
        "count": variant.get("unit_count"),
        "strength_value": variant.get("strength_value"),
        "strength_unit": variant.get("strength_unit"),
        "availability": variant.get("availability") or "in_stock",
        "regular_price_cents": regular_price,
        "sale_price_cents": sale_price,
        "effective_price_cents": effective_price,
        "discount_percent": discount,
        "on_sale": on_sale,
        "sku": variant.get("sku") or "",
        "upc": variant.get("upc"),
        "supplier_sku": variant.get("supplier_sku"),
        "is_featured": bool(row.get("is_featured")),
        "is_bestseller": bool(row.get("is_best_seller")),
        "is_new": bool(row.get("is_new")),
        "is_demo": False,
        "is_active": row.get("status") == "active",
        "is_archived": row.get("status") == "archived",
        "thumbnail_url": image_url(primary) if primary else None,
        "primary_image_url": image_url(primary) if primary else None,
        "short_description": row.get("short_description"),
        "long_description": row.get("description"),
        "search_aliases": row.get("search_aliases") or [],
        "ingredient_highlights": ", ".join(
            str(tag.get("tag")) for tag in tags if tag.get("tag_type") == "ingredient"
        ) or None,
        "usage_text": row.get("suggested_use"),
        "warnings": row.get("warnings"),
        "wellness_tags": [
            str(tag.get("tag")) for tag in tags if tag.get("tag_type") == "health_goal"
        ],
        "images": image_payload,
        "dietary": {
            "vegan": "vegan" in dietary_tags,
            "vegetarian": "vegetarian" in dietary_tags,
            "organic": "organic" in dietary_tags,
            "gluten_free": "gluten_free" in dietary_tags or "gluten-free" in dietary_tags,
            "soy_free": "soy_free" in dietary_tags or "soy-free" in dietary_tags,
            "dairy_free": "dairy_free" in dietary_tags or "dairy-free" in dietary_tags,
            "alcohol_free": "alcohol_free" in dietary_tags or "alcohol-free" in dietary_tags,
            "non_gmo": "non_gmo" in dietary_tags or "non-gmo" in dietary_tags,
        },
        "brand_id": row.get("brand_id") or brand.get("id"),
        "category_id": row.get("category_id") or category.get("id"),
        "flavor": variant.get("flavor"),
        "updated_at": row.get("updated_at"),
        "created_at": row.get("created_at"),
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


@router.patch("/catalog-imports/{batch_id}/rows/{source_row_number}")
def patch_import_row(
    batch_id: str,
    source_row_number: int,
    body: dict[str, Any],
    request: Request,
):
    origin = request.headers.get("origin")
    if origin and origin != settings.frontend_origin:
        raise ForbiddenError("Invalid request origin.")
    return catalog_import.update_preview_row(batch_id, source_row_number, body)


@router.patch("/catalog-imports/{batch_id}/selection")
def patch_import_selection(batch_id: str, body: dict[str, Any], request: Request):
    origin = request.headers.get("origin")
    if origin and origin != settings.frontend_origin:
        raise ForbiddenError("Invalid request origin.")
    included = body.get("included_row_numbers")
    if not isinstance(included, list) or any(not isinstance(value, int) for value in included):
        raise ValidationError("included_row_numbers must be a list of CSV row numbers.")
    return catalog_import.update_preview_selection(batch_id, included)


@router.get("/catalog-imports")
def list_imports():
    return {"items": catalog_import.list_batches()}


@router.get("/catalog-imports/{batch_id}")
def get_import(batch_id: str):
    return catalog_import.get_batch(batch_id)


@router.delete("/catalog-imports/{batch_id}")
def delete_import(batch_id: str, body: dict[str, Any], request: Request):
    origin = request.headers.get("origin")
    if origin and origin != settings.frontend_origin:
        raise ForbiddenError("Invalid request origin.")
    return catalog_import.delete_batch(batch_id, str(body.get("confirmation") or ""))


@router.get("/products")
def list_products(
    q: str | None = Query(default=None, max_length=100),
    brand: str | None = None,
    category: str | None = None,
    availability: str | None = None,
    on_sale: bool | None = None,
    sort: str = "newest",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    select_columns = "id,name,slug,status,brand_id,category_id,is_featured,is_best_seller,is_new,short_description,description,suggested_use,warnings,search_aliases,created_at,updated_at,brands(name,slug),categories(name,slug),product_variants(sku,upc,supplier_sku,form,unit_count,size_value,size_unit,strength_value,strength_unit,regular_price_cents,sale_price_cents,cost_price_cents,availability,is_default),product_images(id,storage_path,is_primary,alt_text,display_order),product_tags(tag_type,tag)"
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        batch = sb.select(
            "products",
            {
                "select": select_columns,
                "order": "updated_at.desc,id.asc",
                "limit": "1000",
                "offset": str(offset),
            },
        )
        rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000

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
    if on_sale is not None:
        items = [item for item in items if bool(item.get("on_sale")) is on_sale]

    if sort == "name_asc":
        items.sort(key=lambda item: str(item.get("name") or "").lower())
    elif sort == "name_desc":
        items.sort(key=lambda item: str(item.get("name") or "").lower(), reverse=True)
    elif sort == "price_asc":
        items.sort(key=lambda item: int(item.get("effective_price_cents") or 0))
    elif sort == "price_desc":
        items.sort(key=lambda item: int(item.get("effective_price_cents") or 0), reverse=True)

    total = len(items)
    start = (page - 1) * page_size
    paged_items = items[start : start + page_size]
    pages = (total + page_size - 1) // page_size if page_size else 0
    return {
        "items": paged_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
    }


@router.get("/products/{product_id}")
def get_product(product_id: str):
    params: dict[str, str] = {
        "select": "id,name,slug,status,brand_id,category_id,is_featured,is_best_seller,is_new,short_description,description,suggested_use,warnings,search_aliases,created_at,updated_at,brands(name,slug),categories(name,slug),product_variants(sku,upc,supplier_sku,form,unit_count,size_value,size_unit,strength_value,strength_unit,flavor,regular_price_cents,sale_price_cents,cost_price_cents,availability,is_default),product_images(id,storage_path,is_primary,alt_text,display_order),product_tags(tag_type,tag)",
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
    if body.get("expected_updated_at") and body["expected_updated_at"] != product.get("updated_at"):
        raise ConflictError("This product changed after you opened it. Refresh before saving again.")
    variants = product.get("product_variants") or []
    variant = next(
        (item for item in variants if item and item.get("is_default")),
        variants[0] if variants else None,
    )
    name = str(body.get("name", product.get("name")) or "").strip()
    if not name:
        raise ValidationError("Product name is required.", fields={"name": "Required"})
    product_patch = {
        "name": name,
        "is_featured": body.get("is_featured", product.get("is_featured")),
        "is_best_seller": body.get("is_bestseller", body.get("is_best_seller", product.get("is_best_seller"))),
        "is_new": body.get("is_new", product.get("is_new")),
    }
    if "brand_id" in body:
        product_patch["brand_id"] = body.get("brand_id")
    if "category_id" in body:
        product_patch["category_id"] = body.get("category_id")
    if "short_description" in body:
        product_patch["short_description"] = body.get("short_description") or None
    if "description" in body or "long_description" in body:
        product_patch["description"] = body.get("description") or body.get("long_description") or None
    if "usage_text" in body:
        product_patch["suggested_use"] = body.get("usage_text") or None
    if "warnings" in body:
        product_patch["warnings"] = body.get("warnings") or None
    if "search_aliases" in body:
        aliases = body.get("search_aliases")
        if not isinstance(aliases, list) or any(not isinstance(alias, str) for alias in aliases):
            raise ValidationError("Search aliases must be a list of text values.")
        product_patch["search_aliases"] = [alias.strip() for alias in aliases if alias.strip()]
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
                "sale_price_cents": None if body.get("remove_sale") else body.get("sale_price_cents", variant.get("sale_price_cents")),
                "cost_price_cents": body.get("cost_price_cents", variant.get("cost_price_cents")),
                "availability": body.get("availability", variant.get("availability")),
            },
        )
    dietary_fields = (
        "vegan",
        "vegetarian",
        "organic",
        "gluten_free",
        "soy_free",
        "dairy_free",
        "alcohol_free",
        "non_gmo",
    )
    if any(field in body for field in dietary_fields):
        sb.delete("product_tags", {"product_id": f"eq.{product_id}", "tag_type": "in.(dietary,free_from)"})
        sb.insert_many(
            "product_tags",
            [
                {"product_id": product_id, "tag_type": "dietary", "tag": field}
                for field in dietary_fields
                if bool(body.get(field))
            ],
        )
    return get_product(product_id)


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


@router.delete("/products/{product_id}/permanent")
def delete_product_permanently(product_id: str, body: dict[str, Any], request: Request):
    origin = request.headers.get("origin")
    if origin and origin != settings.frontend_origin:
        raise ForbiddenError("Invalid request origin.")
    return catalog_import.delete_product(
        product_id,
        str(body.get("confirmation") or ""),
    )


@router.delete("/products/{product_id}")
def archive_product(product_id: str):
    sb.update("products", {"id": f"eq.{product_id}"}, {"status": "archived"})
    return {"id": product_id, "status": "archived"}
