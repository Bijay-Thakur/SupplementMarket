"""Persist parsed products into staging tables."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.catalog.dedupe import find_duplicate
from app.catalog.description import warnings_text
from app.catalog.pricing_demo import demo_prices
from app.catalog.types import ParsedProduct
from app.core.utils import slugify, utcnow
from app.models import CatalogStagedImage, CatalogStagedProduct, CatalogStagedVariant
from app.services.pricing import sale_price_from_percent, validate_prices


def empty_stats() -> dict:
    return {
        "pages_requested": 0,
        "products_discovered": 0,
        "products_selected": 0,
        "products_parsed": 0,
        "products_skipped": 0,
        "images_downloaded": 0,
        "images_rejected": 0,
        "validation_failures": 0,
        "duplicate_matches": 0,
        "retries": 0,
        "http_status": {},
        "robots_blocked": 0,
    }


def stage_product(
    db: Session,
    *,
    run_id: str,
    source_id: int | None,
    parsed: ParsedProduct,
    errors: list[str],
    policy_status: str | None,
    image_rel: str | None,
    image_hash: str | None,
    image_status: str,
    original_path: str | None,
    source_url: str | None,
    mime: str | None,
    size_bytes: int | None,
    alt_text: str | None,
) -> CatalogStagedProduct:
    dup = find_duplicate(db, parsed)
    regular, sale, pct = demo_prices(parsed.brand, parsed.name, parsed.variant_name, parsed.count)
    validate_prices(regular, sale)
    status = "validation_failed" if errors else "needs_review"
    if dup:
        status = "needs_review"
    collected = parsed.collected_at or utcnow().replace(tzinfo=None)
    row = CatalogStagedProduct(
        run_id=run_id,
        source_id=source_id,
        status=status,
        brand=parsed.brand,
        brand_slug=slugify(parsed.brand),
        parent_brand=parsed.parent_brand,
        product_line=parsed.product_line,
        name=parsed.name[:240],
        variant_name=parsed.variant_name,
        sku=parsed.sku,
        upc=parsed.upc,
        canonical_url=parsed.canonical_url.split("?")[0][:800],
        source_domain=parsed.source_domain,
        source_collection_url=parsed.source_collection_url,
        collected_at=collected if isinstance(collected, datetime) else utcnow().replace(tzinfo=None),
        primary_category=parsed.primary_category,
        secondary_category=parsed.secondary_category,
        form=parsed.form,
        health_interests=parsed.health_interests,
        intended_audience=parsed.intended_audience,
        search_aliases=", ".join(parsed.search_aliases),
        wellness_tags=parsed.wellness_tags,
        strength_value=parsed.strength_value,
        strength_unit=parsed.strength_unit,
        count=parsed.count,
        serving_count=parsed.serving_count,
        size=parsed.size,
        weight=parsed.weight,
        volume=parsed.volume,
        flavor=parsed.flavor,
        number_of_servings=parsed.number_of_servings,
        vegan=parsed.vegan,
        vegetarian=parsed.vegetarian,
        organic=parsed.organic,
        non_gmo=parsed.non_gmo,
        gluten_free=parsed.gluten_free,
        soy_free=parsed.soy_free,
        dairy_free=parsed.dairy_free,
        sugar_free=parsed.sugar_free,
        alcohol_free=parsed.alcohol_free,
        kosher=parsed.kosher,
        halal=parsed.halal,
        certifications=parsed.certifications,
        ingredient_highlights=parsed.ingredient_highlights,
        other_ingredients=parsed.other_ingredients,
        allergen_info=parsed.allergen_info,
        suggested_use=parsed.suggested_use,
        manufacturer_warnings=warnings_text(parsed),
        supplement_facts=parsed.supplement_facts,
        serving_size=parsed.serving_size,
        amount_per_serving=parsed.amount_per_serving,
        percent_dv=parsed.percent_dv,
        official_bestseller=parsed.official_bestseller,
        official_featured=parsed.official_featured,
        official_new=parsed.official_new,
        source_price_cents=parsed.source_price_cents,
        source_price_currency=parsed.source_price_currency or "USD",
        source_price_collected_at=utcnow().replace(tzinfo=None) if parsed.source_price_cents else None,
        source_availability=parsed.source_availability,
        regular_price_cents=regular,
        sale_price_cents=sale,
        discount_percent=pct,
        price_is_demo=True,
        short_description=parsed.short_description,
        extraction_method=parsed.extraction_method,
        raw_source_attrs=parsed.raw_source_attrs,
        parser_version=parsed.parser_version,
        source_content_hash=parsed.source_content_hash,
        image_content_hash=image_hash,
        image_status=image_status,
        image_use_status="permission_pending" if image_rel else "demo_review_only",
        verification_status="pending_review",
        source_policy_status=policy_status,
        is_demo=True,
        duplicate_of_id=abs(dup[1]) if dup else None,
        duplicate_key=dup[0] if dup else None,
        validation_errors=errors or None,
        source_snapshot=parsed.snapshot(),
    )
    db.add(row)
    db.flush()
    if parsed.variants:
        for v in parsed.variants[:8]:
            db.add(
                CatalogStagedVariant(
                    product_id=row.id,
                    label=str(v.get("title") or v.get("label") or "Variant")[:160],
                    sku=v.get("sku"),
                )
            )
    if image_rel or source_url:
        db.add(
            CatalogStagedImage(
                product_id=row.id,
                source_url=source_url,
                original_path=original_path,
                optimized_filename=image_rel,
                alt_text=alt_text or f"{parsed.brand} {parsed.name} package",
                mime_type=mime,
                size_bytes=size_bytes,
                sha256=image_hash,
                is_primary=True,
                image_use_status="demo_review_only",
                permission_status="permission_pending",
                status="stored" if image_rel else "missing_or_permission_required",
            )
        )
    return row


def recalculate_demo_prices(row: CatalogStagedProduct) -> None:
    regular, sale, pct = demo_prices(row.brand, row.name, row.variant_name, row.count)
    row.regular_price_cents = regular
    row.sale_price_cents = sale
    row.discount_percent = pct
    if sale is not None:
        # Authoritative sale price from percent, never from the client.
        row.sale_price_cents = sale_price_from_percent(regular, pct or 10)
