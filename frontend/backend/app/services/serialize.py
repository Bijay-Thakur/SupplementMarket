"""Map ORM entities to API schemas, deriving pricing centrally."""
from __future__ import annotations

from app.models import Order, Product, ProductImage
from app.schemas.order import AdminOrderDetail, AdminOrderRow, OrderItemOut, OrderPublicOut
from app.schemas.product import (
    AdminProductRow,
    DietaryFlags,
    ProductDetail,
    ProductImageOut,
    ProductListItem,
    VariantOut,
)
from app.services.pricing import discount_percent, effective_price_cents

MEDIA_PREFIX = "/media/products"


def image_url(img: ProductImage) -> str:
    return f"{MEDIA_PREFIX}/{img.filename}"


def _primary_image_url(p: Product) -> str | None:
    if not p.images:
        return None
    primary = next((i for i in p.images if i.is_primary), None) or p.images[0]
    return image_url(primary)


def _dietary(p: Product) -> DietaryFlags:
    return DietaryFlags(
        vegan=p.vegan,
        vegetarian=p.vegetarian,
        organic=p.organic,
        gluten_free=p.gluten_free,
        soy_free=p.soy_free,
        dairy_free=p.dairy_free,
        alcohol_free=p.alcohol_free,
        non_gmo=p.non_gmo,
    )


def _aliases(p: Product) -> list[str]:
    if not p.search_aliases:
        return []
    return [a.strip() for a in p.search_aliases.split(",") if a.strip()]


def product_list_item(p: Product) -> ProductListItem:
    disc = discount_percent(p.regular_price_cents, p.sale_price_cents)
    return ProductListItem(
        id=p.id,
        name=p.name,
        slug=p.slug,
        brand_name=p.brand.name if p.brand else "",
        brand_slug=p.brand.slug if p.brand else "",
        category_name=p.category.name if p.category else "",
        category_slug=p.category.slug if p.category else "",
        form=p.form,
        size=p.size,
        count=p.count,
        strength_value=float(p.strength_value) if p.strength_value is not None else None,
        strength_unit=p.strength_unit,
        availability=p.availability,
        regular_price_cents=p.regular_price_cents,
        sale_price_cents=p.sale_price_cents,
        effective_price_cents=effective_price_cents(p.regular_price_cents, p.sale_price_cents),
        discount_percent=disc,
        on_sale=disc is not None,
        is_featured=p.is_featured,
        is_bestseller=p.is_bestseller,
        is_new=p.is_new,
        is_demo=p.is_demo,
        short_description=p.short_description,
        primary_image_url=_primary_image_url(p),
        dietary=_dietary(p),
    )


def product_detail(p: Product) -> ProductDetail:
    base = product_list_item(p).model_dump()
    return ProductDetail(
        **base,
        long_description=p.long_description,
        sku=p.sku,
        upc=p.upc,
        brand_id=p.brand_id,
        category_id=p.category_id,
        ingredient_highlights=p.ingredient_highlights,
        usage_text=p.usage_text,
        warnings=p.warnings,
        search_aliases=_aliases(p),
        wellness_tags=[t.name for t in p.tags],
        images=[
            ProductImageOut(
                id=i.id,
                url=image_url(i),
                alt_text=i.alt_text,
                display_order=i.display_order,
                is_primary=i.is_primary,
            )
            for i in sorted(p.images, key=lambda x: x.display_order)
        ],
        variants=[VariantOut.model_validate(v) for v in p.variants],
        is_active=p.is_active,
        is_archived=p.is_archived,
        source_url=p.source_url,
        source_type=p.source_type,
        verification_status=p.verification_status,
        approval_status=p.approval_status,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def admin_product_row(p: Product) -> AdminProductRow:
    return AdminProductRow(
        id=p.id,
        name=p.name,
        slug=p.slug,
        brand_name=p.brand.name if p.brand else "",
        thumbnail_url=_primary_image_url(p),
        regular_price_cents=p.regular_price_cents,
        sale_price_cents=p.sale_price_cents,
        discount_percent=discount_percent(p.regular_price_cents, p.sale_price_cents),
        availability=p.availability,
        is_featured=p.is_featured,
        is_bestseller=p.is_bestseller,
        is_new=p.is_new,
        is_active=p.is_active,
        is_archived=p.is_archived,
        is_demo=p.is_demo,
        price_is_demo=bool(getattr(p, "price_is_demo", False)),
        image_use_status=getattr(p, "image_use_status", None),
        source_url=p.source_url,
        last_source_verification_at=getattr(p, "last_source_verification_at", None),
        updated_at=p.updated_at,
    )


def _order_items(o: Order) -> list[OrderItemOut]:
    return [
        OrderItemOut(
            product_name=i.product_name,
            brand_name=i.brand_name,
            sku=i.sku,
            variant_label=i.variant_label,
            unit_price_cents=i.unit_price_cents,
            quantity=i.quantity,
            line_total_cents=i.line_total_cents,
        )
        for i in o.items
    ]


def order_public(o: Order) -> OrderPublicOut:
    return OrderPublicOut(
        public_token=o.public_token,
        order_number=o.order_number,
        status=o.status,
        fulfillment_type=o.fulfillment_type,
        customer_name=o.customer_name,
        subtotal_cents=o.subtotal_cents,
        delivery_fee_cents=o.delivery_fee_cents,
        total_cents=o.total_cents,
        items=_order_items(o),
        created_at=o.created_at,
    )


def admin_order_row(o: Order) -> AdminOrderRow:
    return AdminOrderRow(
        id=o.id,
        order_number=o.order_number,
        customer_name=o.customer_name,
        fulfillment_type=o.fulfillment_type,
        status=o.status,
        total_cents=o.total_cents,
        item_count=sum(i.quantity for i in o.items),
        is_demo=o.is_demo,
        created_at=o.created_at,
    )


def admin_order_detail(o: Order) -> AdminOrderDetail:
    return AdminOrderDetail(
        id=o.id,
        order_number=o.order_number,
        public_token=o.public_token,
        status=o.status,
        fulfillment_type=o.fulfillment_type,
        customer_name=o.customer_name,
        customer_email=o.customer_email,
        customer_phone=o.customer_phone,
        delivery_address_line1=o.delivery_address_line1,
        delivery_city=o.delivery_city,
        delivery_state=o.delivery_state,
        delivery_zip=o.delivery_zip,
        delivery_instructions=o.delivery_instructions,
        subtotal_cents=o.subtotal_cents,
        delivery_fee_cents=o.delivery_fee_cents,
        total_cents=o.total_cents,
        notes=o.notes,
        is_demo=o.is_demo,
        items=_order_items(o),
        created_at=o.created_at,
    )
