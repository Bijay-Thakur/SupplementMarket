"""Copy approved staged products into the main catalog without dropping provenance."""
from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.utils import slugify, utcnow
from app.models import Brand, CatalogStagedProduct, Category, Product, ProductImage, Tag
from app.repositories import products as repo
from app.services.pricing import validate_prices

PROTECTED = frozenset(
    {
        "name",
        "short_description",
        "form",
        "primary_category",
        "regular_price_cents",
        "sale_price_cents",
        "vegan",
        "vegetarian",
        "organic",
        "gluten_free",
    }
)


def _ensure_brand(db: Session, name: str, slug: str) -> Brand:
    row = db.execute(select(Brand).where(Brand.slug == slug)).scalar_one_or_none()
    if row:
        return row
    by_name = db.execute(select(Brand).where(Brand.name == name)).scalar_one_or_none()
    if by_name:
        return by_name
    b = Brand(name=name, slug=slug, is_demo=True, description=f"{name} (official manufacturer — demo staging).")
    db.add(b)
    db.flush()
    return b


def _ensure_category(db: Session, name: str) -> Category:
    slug = slugify(name)
    row = db.execute(select(Category).where(Category.slug == slug)).scalar_one_or_none()
    if row:
        return row
    c = Category(name=name, slug=slug, is_demo=True)
    db.add(c)
    db.flush()
    return c


def _ensure_tags(db: Session, names: list[str]) -> list[Tag]:
    tags: list[Tag] = []
    for n in names:
        slug = slugify(n)
        t = db.execute(select(Tag).where(Tag.slug == slug)).scalar_one_or_none()
        if t is None:
            t = Tag(name=n, slug=slug, kind="wellness", is_demo=True)
            db.add(t)
            db.flush()
        tags.append(t)
    return tags


def _sku_for(staged: CatalogStagedProduct) -> str:
    if staged.sku:
        return staged.sku[:64]
    base = f"BNM-{slugify(staged.brand)[:8]}-{slugify(staged.name)[:18]}".upper()
    return base[:64]


def import_approved(
    db: Session,
    run_id: str,
    *,
    activate: bool = False,
    ids: list[int] | None = None,
) -> dict:
    q = select(CatalogStagedProduct).where(
        CatalogStagedProduct.run_id == run_id,
        CatalogStagedProduct.status == "approved",
    )
    if ids:
        q = q.where(CatalogStagedProduct.id.in_(ids))
    rows = list(db.execute(q).scalars())
    created = 0
    updated = 0
    skipped = 0
    for staged in rows:
        if staged.imported_product_id:
            existing = db.get(Product, staged.imported_product_id)
            if existing is not None:
                _refresh_source_only(existing, staged)
                skipped += 1
                continue
        brand = _ensure_brand(db, staged.brand, slugify(staged.brand))
        category = _ensure_category(db, staged.primary_category or "Herbal Supplements")
        sku = _sku_for(staged)
        n = 1
        while repo.sku_exists(db, sku):
            sku = f"{_sku_for(staged)[:58]}-{n}"
            n += 1
        validate_prices(staged.regular_price_cents, staged.sale_price_cents)
        product = Product(
            brand_id=brand.id,
            category_id=category.id,
            name=staged.name,
            slug=repo.unique_slug(db, slugify(f"{staged.brand}-{staged.name}")),
            sku=sku,
            upc=staged.upc,
            short_description=staged.short_description,
            long_description=None,
            form=staged.form,
            size=staged.size,
            count=staged.count,
            strength_value=staged.strength_value,
            strength_unit=staged.strength_unit,
            regular_price_cents=staged.regular_price_cents,
            sale_price_cents=staged.sale_price_cents,
            availability="in_stock",
            is_featured=staged.official_featured,
            is_bestseller=staged.official_bestseller,
            is_new=staged.official_new,
            is_active=activate,
            is_demo=True,
            vegan=staged.vegan,
            vegetarian=staged.vegetarian,
            organic=staged.organic,
            gluten_free=staged.gluten_free,
            soy_free=staged.soy_free,
            dairy_free=staged.dairy_free,
            alcohol_free=staged.alcohol_free,
            non_gmo=staged.non_gmo,
            sugar_free=staged.sugar_free,
            kosher=staged.kosher,
            halal=staged.halal,
            search_aliases=staged.search_aliases,
            ingredient_highlights=staged.ingredient_highlights,
            usage_text=staged.suggested_use,
            warnings=staged.manufacturer_warnings,
            source_url=staged.canonical_url,
            source_type="official_manufacturer_page",
            source_access_date=date.today(),
            image_use_status=staged.image_use_status,
            verification_status="pending_review",
            approval_status="approved",
            parent_brand=staged.parent_brand,
            product_line=staged.product_line,
            variant_name=staged.variant_name,
            certifications=staged.certifications,
            serving_size=staged.serving_size,
            other_ingredients=staged.other_ingredients,
            allergen_info=staged.allergen_info,
            source_price_cents=staged.source_price_cents,
            source_price_currency=staged.source_price_currency,
            source_price_collected_at=staged.source_price_collected_at,
            price_is_demo=True,
            source_domain=staged.source_domain,
            source_collection_url=staged.source_collection_url,
            extraction_method=staged.extraction_method,
            parser_version=staged.parser_version,
            source_content_hash=staged.source_content_hash,
            last_source_verification_at=utcnow().replace(tzinfo=None),
            staged_product_id=staged.id,
            intended_audience=staged.intended_audience,
        )
        db.add(product)
        db.flush()
        tags = _ensure_tags(db, list(staged.wellness_tags or []))
        product.tags = tags
        primary = next((i for i in staged.images if i.is_primary), staged.images[0] if staged.images else None)
        if primary and primary.optimized_filename:
            db.add(
                ProductImage(
                    product_id=product.id,
                    filename=primary.optimized_filename,
                    original_filename=primary.original_path,
                    alt_text=primary.alt_text,
                    display_order=0,
                    is_primary=True,
                    mime_type=primary.mime_type,
                    size_bytes=primary.size_bytes,
                    is_demo=True,
                    source_url=primary.source_url,
                    sha256=primary.sha256,
                    image_use_status=primary.image_use_status,
                    permission_status=primary.permission_status,
                    original_path=primary.original_path,
                )
            )
        staged.status = "imported"
        staged.imported_product_id = product.id
        created += 1
    db.commit()
    return {"created": created, "updated": updated, "skipped": skipped, "total": len(rows)}


def _refresh_source_only(product: Product, staged: CatalogStagedProduct) -> None:
    """Re-import must not overwrite admin-edited merchandising fields."""
    protected = set(staged.admin_edited_fields or [])
    product.source_url = staged.canonical_url
    product.source_content_hash = staged.source_content_hash
    product.last_source_verification_at = utcnow().replace(tzinfo=None)
    product.parser_version = staged.parser_version
    if "source_price_cents" not in protected:
        product.source_price_cents = staged.source_price_cents
        product.source_price_collected_at = staged.source_price_collected_at
    if not protected.intersection(PROTECTED):
        return
