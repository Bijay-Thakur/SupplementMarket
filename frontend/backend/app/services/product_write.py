"""Admin product mutations. Allow-listed fields only (no mass assignment)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.utils import slugify, utcnow
from app.models import Brand, Product, Tag
from app.repositories import products as repo
from app.schemas.product import ProductCreate, ProductUpdate
from app.services.pricing import (
    PricingError,
    sale_price_from_brand_discount,
    sale_price_from_percent,
    validate_prices,
)

_ALLOWED_SCALAR = (
    "short_description",
    "long_description",
    "form",
    "size",
    "count",
    "strength_value",
    "strength_unit",
    "availability",
    "is_featured",
    "is_bestseller",
    "is_new",
    "is_active",
    "vegan",
    "vegetarian",
    "organic",
    "gluten_free",
    "soy_free",
    "dairy_free",
    "alcohol_free",
    "non_gmo",
    "ingredient_highlights",
    "usage_text",
    "warnings",
    "is_demo",
    "source_url",
    "sugar_free",
    "kosher",
    "halal",
    "parent_brand",
    "product_line",
    "price_is_demo",
    "source_domain",
    "extraction_method",
    "parser_version",
    "source_type",
    "source_access_date",
    "image_use_status",
    "verification_status",
    "approval_status",
    "subcategory_id",
)


def _resolve_sale(regular: int, sale: int | None, percent: int | None) -> int | None:
    if sale is not None:
        return sale
    if percent:
        return sale_price_from_percent(regular, percent)
    return None


def _apply_tags(db: Session, product: Product, tag_ids: list[int]) -> None:
    tags = list(db.execute(select(Tag).where(Tag.id.in_(tag_ids))).scalars()) if tag_ids else []
    product.tags = tags


def create_product(db: Session, payload: ProductCreate) -> Product:
    if repo.sku_exists(db, payload.sku):
        raise ConflictError("A product with this SKU already exists.", fields={"sku": "Duplicate SKU."})
    if payload.upc and repo.upc_exists(db, payload.upc):
        raise ConflictError("A product with this UPC already exists.", fields={"upc": "Duplicate UPC."})

    try:
        sale = _resolve_sale(payload.regular_price_cents, payload.sale_price_cents, payload.discount_percent)
        brand = db.get(Brand, payload.brand_id)
        if brand and brand.discount_percent is not None:
            sale = sale_price_from_brand_discount(payload.regular_price_cents, brand.discount_percent)
        validate_prices(payload.regular_price_cents, sale)
    except PricingError as e:
        raise ValidationError(str(e), fields={"sale_price_cents": str(e)})

    base_slug = slugify(payload.slug or payload.name)
    slug = repo.unique_slug(db, base_slug)

    product = Product(
        brand_id=payload.brand_id,
        category_id=payload.category_id,
        subcategory_id=payload.subcategory_id,
        name=payload.name,
        slug=slug,
        sku=payload.sku,
        upc=payload.upc,
        regular_price_cents=payload.regular_price_cents,
        sale_price_cents=sale,
        availability=payload.availability or "in_stock",
        search_aliases=", ".join(payload.search_aliases) if payload.search_aliases else None,
    )
    for f in _ALLOWED_SCALAR:
        val = getattr(payload, f, None)
        if val is not None:
            setattr(product, f, val)

    db.add(product)
    db.flush()
    if payload.tag_ids is not None:
        _apply_tags(db, product, payload.tag_ids)
    db.commit()
    return repo.get_by_id(db, product.id)


def _naive(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=None)


def update_product(db: Session, product_id: int, payload: ProductUpdate) -> Product:
    product = repo.get_by_id(db, product_id)
    if product is None:
        raise NotFoundError("Product not found.")

    if payload.expected_updated_at is not None:
        if _naive(payload.expected_updated_at) != _naive(product.updated_at):
            raise ConflictError(
                "This product was changed by someone else. Reload and try again."
            )

    if payload.sku is not None and payload.sku != product.sku:
        if repo.sku_exists(db, payload.sku, exclude_id=product_id):
            raise ConflictError("A product with this SKU already exists.", fields={"sku": "Duplicate SKU."})
        product.sku = payload.sku
    if payload.upc is not None and payload.upc != product.upc:
        if payload.upc and repo.upc_exists(db, payload.upc, exclude_id=product_id):
            raise ConflictError("A product with this UPC already exists.", fields={"upc": "Duplicate UPC."})
        product.upc = payload.upc

    if payload.brand_id is not None:
        product.brand_id = payload.brand_id
    if payload.category_id is not None:
        product.category_id = payload.category_id
    if payload.name is not None:
        product.name = payload.name
    if payload.slug is not None:
        product.slug = repo.unique_slug(db, slugify(payload.slug), exclude_id=product_id)

    # Pricing normalization.
    new_regular = payload.regular_price_cents if payload.regular_price_cents is not None else product.regular_price_cents
    if payload.remove_sale:
        new_sale = None
    elif payload.sale_price_cents is not None:
        new_sale = payload.sale_price_cents
    elif payload.discount_percent:
        new_sale = sale_price_from_percent(new_regular, payload.discount_percent)
    else:
        new_sale = product.sale_price_cents
    brand = db.get(Brand, product.brand_id)
    if brand and brand.discount_percent is not None:
        new_sale = sale_price_from_brand_discount(new_regular, brand.discount_percent)
    try:
        validate_prices(new_regular, new_sale)
    except PricingError as e:
        raise ValidationError(str(e), fields={"sale_price_cents": str(e)})
    product.regular_price_cents = new_regular
    product.sale_price_cents = new_sale

    if payload.search_aliases is not None:
        product.search_aliases = ", ".join(payload.search_aliases) if payload.search_aliases else None
    for f in _ALLOWED_SCALAR:
        val = getattr(payload, f, None)
        if val is not None:
            setattr(product, f, val)

    if payload.tag_ids is not None:
        _apply_tags(db, product, payload.tag_ids)

    db.commit()
    return repo.get_by_id(db, product_id)


def duplicate_product(db: Session, product_id: int) -> Product:
    src = repo.get_by_id(db, product_id)
    if src is None:
        raise NotFoundError("Product not found.")

    new_name = f"{src.name} (Copy)"
    slug = repo.unique_slug(db, slugify(new_name))
    new_sku = src.sku + "-COPY"
    n = 2
    while repo.sku_exists(db, new_sku):
        new_sku = f"{src.sku}-COPY{n}"
        n += 1

    dup = Product(
        brand_id=src.brand_id,
        category_id=src.category_id,
        subcategory_id=src.subcategory_id,
        name=new_name,
        slug=slug,
        sku=new_sku,
        upc=None,
        short_description=src.short_description,
        long_description=src.long_description,
        form=src.form,
        size=src.size,
        count=src.count,
        strength_value=src.strength_value,
        strength_unit=src.strength_unit,
        regular_price_cents=src.regular_price_cents,
        sale_price_cents=src.sale_price_cents,
        availability=src.availability,
        is_active=False,  # start duplicates as inactive drafts
        vegan=src.vegan,
        vegetarian=src.vegetarian,
        organic=src.organic,
        gluten_free=src.gluten_free,
        soy_free=src.soy_free,
        dairy_free=src.dairy_free,
        alcohol_free=src.alcohol_free,
        non_gmo=src.non_gmo,
        search_aliases=src.search_aliases,
        ingredient_highlights=src.ingredient_highlights,
        usage_text=src.usage_text,
        warnings=src.warnings,
        is_demo=src.is_demo,
    )
    db.add(dup)
    db.flush()
    dup.tags = list(src.tags)
    db.commit()
    return repo.get_by_id(db, dup.id)


def archive_product(db: Session, product_id: int) -> Product:
    product = repo.get_by_id(db, product_id)
    if product is None:
        raise NotFoundError("Product not found.")
    product.is_archived = True
    product.is_active = False
    product.archived_at = utcnow().replace(tzinfo=None)
    db.commit()
    return product


def restore_product(db: Session, product_id: int) -> Product:
    product = repo.get_by_id(db, product_id)
    if product is None:
        raise NotFoundError("Product not found.")
    product.is_archived = False
    product.archived_at = None
    db.commit()
    return product
