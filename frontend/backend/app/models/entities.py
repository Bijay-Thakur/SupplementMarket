"""Focused local demo schema.

Design notes:
- Money is stored as integer cents. Discount percentage is NEVER stored as an
  independent source of truth; it is derived from regular + sale price.
- Products carry the default purchasable fields for the demo. `product_variants`
  exists for future multi-variant support without a frontend rewrite.
- Soft-delete via `is_archived`/`archived_at`; hard deletes are avoided for
  order-referenced data.
- `is_demo` marks all seeded content so the safe reset only touches demo rows.
"""
from __future__ import annotations

from datetime import datetime, date

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

AVAILABILITY_VALUES = ("in_stock", "low_stock", "out_of_stock", "coming_soon")
FORM_VALUES = (
    "capsule",
    "tablet",
    "softgel",
    "gummy",
    "liquid",
    "powder",
    "spray",
    "cream",
    "lozenge",
    "chewable",
    "other",
)
FULFILLMENT_VALUES = ("pickup", "delivery")
ORDER_STATUS_VALUES = (
    "placed",
    "confirmed",
    "preparing",
    "ready_for_pickup",
    "out_for_delivery",
    "completed",
    "cancelled",
)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Brand(TimestampMixin, Base):
    __tablename__ = "brands"
    __table_args__ = (
        CheckConstraint(
            "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent < 100)",
            name="ck_brand_discount_percent_range",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    logo_alt: Mapped[str | None] = mapped_column(String(200))
    official_website_url: Mapped[str | None] = mapped_column(String(500))
    logo_use_status: Mapped[str] = mapped_column(String(40), default="permission_pending", nullable=False)
    logo_background: Mapped[str] = mapped_column(String(40), default="cream", nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    discount_percent: Mapped[int | None] = mapped_column(Integer)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    products: Mapped[list["Product"]] = relationship(back_populates="brand")


class Category(TimestampMixin, Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), nullable=False, unique=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))
    description: Mapped[str | None] = mapped_column(Text)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    parent: Mapped["Category | None"] = relationship(remote_side="Category.id")


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("regular_price_cents >= 0", name="ck_regular_price_nonneg"),
        CheckConstraint(
            "sale_price_cents IS NULL OR sale_price_cents >= 0",
            name="ck_sale_price_nonneg",
        ),
        CheckConstraint(
            "sale_price_cents IS NULL OR sale_price_cents < regular_price_cents",
            name="ck_sale_lt_regular",
        ),
        UniqueConstraint("sku", name="uq_product_sku"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    subcategory_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))

    name: Mapped[str] = mapped_column(String(240), nullable=False)
    slug: Mapped[str] = mapped_column(String(260), nullable=False, unique=True)
    short_description: Mapped[str | None] = mapped_column(String(400))
    long_description: Mapped[str | None] = mapped_column(Text)

    # Default variant / supplement details.
    form: Mapped[str | None] = mapped_column(String(20))
    size: Mapped[str | None] = mapped_column(String(80))
    count: Mapped[int | None] = mapped_column(Integer)
    strength_value: Mapped[float | None] = mapped_column(Numeric(12, 3))
    strength_unit: Mapped[str | None] = mapped_column(String(16))
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    upc: Mapped[str | None] = mapped_column(String(32))

    # Pricing (integer cents). Discount % is derived, never stored.
    regular_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    sale_price_cents: Mapped[int | None] = mapped_column(Integer)

    availability: Mapped[str] = mapped_column(String(20), default="in_stock", nullable=False)

    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_bestseller: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_new: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime)

    # Dietary / free-from attributes.
    vegan: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    vegetarian: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    organic: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    gluten_free: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    soy_free: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    dairy_free: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alcohol_free: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    non_gmo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sugar_free: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    kosher: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    halal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Free text used for search + display.
    search_aliases: Mapped[str | None] = mapped_column(Text)  # comma-separated
    ingredient_highlights: Mapped[str | None] = mapped_column(Text)
    usage_text: Mapped[str | None] = mapped_column(Text)
    warnings: Mapped[str | None] = mapped_column(Text)

    # Demo + provenance metadata.
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(600))
    source_type: Mapped[str | None] = mapped_column(String(60))
    source_access_date: Mapped[date | None] = mapped_column(Date)
    image_use_status: Mapped[str | None] = mapped_column(String(40))
    verification_status: Mapped[str] = mapped_column(
        String(40), default="unverified", nullable=False
    )
    approval_status: Mapped[str] = mapped_column(
        String(40), default="approved", nullable=False
    )

    parent_brand: Mapped[str | None] = mapped_column(String(160))
    product_line: Mapped[str | None] = mapped_column(String(160))
    variant_name: Mapped[str | None] = mapped_column(String(160))
    certifications: Mapped[str | None] = mapped_column(Text)
    serving_size: Mapped[str | None] = mapped_column(String(120))
    other_ingredients: Mapped[str | None] = mapped_column(Text)
    allergen_info: Mapped[str | None] = mapped_column(Text)
    source_price_cents: Mapped[int | None] = mapped_column(Integer)
    source_price_currency: Mapped[str | None] = mapped_column(String(3))
    source_price_collected_at: Mapped[datetime | None] = mapped_column(DateTime)
    price_is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source_domain: Mapped[str | None] = mapped_column(String(200))
    source_collection_url: Mapped[str | None] = mapped_column(String(600))
    extraction_method: Mapped[str | None] = mapped_column(String(40))
    parser_version: Mapped[str | None] = mapped_column(String(20))
    source_content_hash: Mapped[str | None] = mapped_column(String(64))
    last_source_verification_at: Mapped[datetime | None] = mapped_column(DateTime)
    staged_product_id: Mapped[int | None] = mapped_column(Integer)
    intended_audience: Mapped[str | None] = mapped_column(String(80))

    brand: Mapped["Brand"] = relationship(back_populates="products")
    category: Mapped["Category"] = relationship(foreign_keys=[category_id])
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.display_order",
    )
    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    tags: Mapped[list["Tag"]] = relationship(secondary="product_tags", back_populates="products")


class ProductVariant(TimestampMixin, Base):
    __tablename__ = "product_variants"
    __table_args__ = (UniqueConstraint("sku", name="uq_variant_sku"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    form: Mapped[str | None] = mapped_column(String(20))
    size: Mapped[str | None] = mapped_column(String(80))
    count: Mapped[int | None] = mapped_column(Integer)
    strength_value: Mapped[float | None] = mapped_column(Numeric(12, 3))
    strength_unit: Mapped[str | None] = mapped_column(String(16))
    regular_price_cents: Mapped[int | None] = mapped_column(Integer)
    sale_price_cents: Mapped[int | None] = mapped_column(Integer)
    availability: Mapped[str | None] = mapped_column(String(20))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="variants")


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255))
    alt_text: Mapped[str | None] = mapped_column(String(300))
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(60))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(800))
    sha256: Mapped[str | None] = mapped_column(String(64))
    image_use_status: Mapped[str | None] = mapped_column(String(40))
    permission_status: Mapped[str | None] = mapped_column(String(40))
    original_path: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    product: Mapped["Product"] = relationship(back_populates="images")


class Tag(TimestampMixin, Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), nullable=False, unique=True)
    # "wellness" | "ingredient" | "general"
    kind: Mapped[str] = mapped_column(String(20), default="wellness", nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    products: Mapped[list["Product"]] = relationship(
        secondary="product_tags", back_populates="tags"
    )


class ProductTag(Base):
    __tablename__ = "product_tags"

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )


class Promotion(TimestampMixin, Base):
    __tablename__ = "promotions"
    __table_args__ = (
        CheckConstraint(
            "discount_percent IS NULL OR (discount_percent > 0 AND discount_percent < 100)",
            name="ck_promo_percent_range",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    discount_percent: Mapped[int | None] = mapped_column(Integer)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    products: Mapped[list["Product"]] = relationship(secondary="promotion_products")


class PromotionProduct(Base):
    __tablename__ = "promotion_products"

    promotion_id: Mapped[int] = mapped_column(
        ForeignKey("promotions.id", ondelete="CASCADE"), primary_key=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), primary_key=True
    )


class Order(TimestampMixin, Base):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("order_number", name="uq_order_number"),
        UniqueConstraint("public_token", name="uq_order_public_token"),
        UniqueConstraint("idempotency_key", name="uq_order_idempotency_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_number: Mapped[str] = mapped_column(String(24), nullable=False)
    public_token: Mapped[str] = mapped_column(String(64), nullable=False)
    idempotency_key: Mapped[str | None] = mapped_column(String(64))

    fulfillment_type: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="placed", nullable=False)

    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(320), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(40), nullable=False)

    delivery_address_line1: Mapped[str | None] = mapped_column(String(240))
    delivery_city: Mapped[str | None] = mapped_column(String(120))
    delivery_state: Mapped[str | None] = mapped_column(String(40))
    delivery_zip: Mapped[str | None] = mapped_column(String(20))
    delivery_instructions: Mapped[str | None] = mapped_column(Text)

    subtotal_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    delivery_fee_cents: Mapped[int | None] = mapped_column(Integer)
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False)

    notes: Mapped[str | None] = mapped_column(Text)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    # Nullable FK: keep the immutable snapshot even if the product is archived.
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"))

    product_name: Mapped[str] = mapped_column(String(240), nullable=False)
    brand_name: Mapped[str | None] = mapped_column(String(160))
    sku: Mapped[str | None] = mapped_column(String(64))
    variant_label: Mapped[str | None] = mapped_column(String(160))
    unit_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total_cents: Mapped[int] = mapped_column(Integer, nullable=False)

    order: Mapped["Order"] = relationship(back_populates="items")


class StoreSettings(TimestampMixin, Base):
    __tablename__ = "store_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    store_name: Mapped[str] = mapped_column(String(200), default="Bronxville Natural Market")
    phone: Mapped[str | None] = mapped_column(String(40))
    phone_is_placeholder: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(320))
    address_line1: Mapped[str] = mapped_column(String(240), default="86 Pondfield Rd")
    city: Mapped[str] = mapped_column(String(120), default="Bronxville")
    state: Mapped[str] = mapped_column(String(40), default="NY")
    zip: Mapped[str] = mapped_column(String(20), default="10708")
    hours_note: Mapped[str | None] = mapped_column(Text)
    announcement: Mapped[str | None] = mapped_column(Text)
    pickup_instructions: Mapped[str | None] = mapped_column(Text)
    delivery_note: Mapped[str | None] = mapped_column(Text)
    min_order_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="America/New_York", nullable=False)


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


# ── Phase 2B catalog ingestion (staging) ──────────────────────────────────────

IMPORT_STATUSES = (
    "discovered",
    "collected",
    "validation_failed",
    "needs_review",
    "approved",
    "rejected",
    "imported",
    "skipped",
    "source_blocked",
)


class CatalogSource(TimestampMixin, Base):
    __tablename__ = "catalog_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    parent_brand: Mapped[str | None] = mapped_column(String(160))
    product_line: Mapped[str | None] = mapped_column(String(160))
    official_url: Mapped[str] = mapped_column(String(600), nullable=False)
    collection_url: Mapped[str] = mapped_column(String(600), nullable=False)
    domain: Mapped[str] = mapped_column(String(200), nullable=False)
    terms_url: Mapped[str | None] = mapped_column(String(600))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    product_limit: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    policy_status: Mapped[str] = mapped_column(String(40), default="unclear", nullable=False)
    policy_notes: Mapped[str | None] = mapped_column(Text)
    robots_status: Mapped[str | None] = mapped_column(String(40))
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_run_id: Mapped[str | None] = mapped_column(String(40))
    last_result: Mapped[str | None] = mapped_column(String(40))
    adapter_key: Mapped[str] = mapped_column(String(80), nullable=False)


class CatalogImportRun(TimestampMixin, Base):
    __tablename__ = "catalog_import_runs"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    brand_slugs: Mapped[list | None] = mapped_column(JSON)
    per_brand_limit: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    prioritize_categories: Mapped[list | None] = mapped_column(JSON)
    download_images: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    stats: Mapped[dict | None] = mapped_column(JSON)
    robots_summary: Mapped[dict | None] = mapped_column(JSON)
    error_message: Mapped[str | None] = mapped_column(Text)

    products: Mapped[list["CatalogStagedProduct"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )
    errors: Mapped[list["CatalogImportError"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )


class CatalogStagedProduct(TimestampMixin, Base):
    __tablename__ = "catalog_staged_products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[str] = mapped_column(
        ForeignKey("catalog_import_runs.id", ondelete="CASCADE"), nullable=False
    )
    source_id: Mapped[int | None] = mapped_column(ForeignKey("catalog_sources.id"))
    status: Mapped[str] = mapped_column(String(24), default="needs_review", nullable=False)

    brand: Mapped[str] = mapped_column(String(160), nullable=False)
    brand_slug: Mapped[str] = mapped_column(String(180), nullable=False)
    parent_brand: Mapped[str | None] = mapped_column(String(160))
    product_line: Mapped[str | None] = mapped_column(String(160))
    name: Mapped[str] = mapped_column(String(240), nullable=False)
    variant_name: Mapped[str | None] = mapped_column(String(160))
    sku: Mapped[str | None] = mapped_column(String(64))
    upc: Mapped[str | None] = mapped_column(String(32))
    canonical_url: Mapped[str] = mapped_column(String(800), nullable=False)
    source_domain: Mapped[str] = mapped_column(String(200), nullable=False)
    source_collection_url: Mapped[str | None] = mapped_column(String(600))
    collected_at: Mapped[datetime | None] = mapped_column(DateTime)

    primary_category: Mapped[str | None] = mapped_column(String(160))
    secondary_category: Mapped[str | None] = mapped_column(String(160))
    form: Mapped[str | None] = mapped_column(String(20))
    health_interests: Mapped[list | None] = mapped_column(JSON)
    intended_audience: Mapped[str | None] = mapped_column(String(80))
    search_aliases: Mapped[str | None] = mapped_column(Text)
    wellness_tags: Mapped[list | None] = mapped_column(JSON)

    strength_value: Mapped[float | None] = mapped_column(Numeric(12, 3))
    strength_unit: Mapped[str | None] = mapped_column(String(16))
    count: Mapped[int | None] = mapped_column(Integer)
    serving_count: Mapped[int | None] = mapped_column(Integer)
    size: Mapped[str | None] = mapped_column(String(80))
    weight: Mapped[str | None] = mapped_column(String(40))
    volume: Mapped[str | None] = mapped_column(String(40))
    flavor: Mapped[str | None] = mapped_column(String(80))
    number_of_servings: Mapped[int | None] = mapped_column(Integer)

    vegan: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    vegetarian: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    organic: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    non_gmo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    gluten_free: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    soy_free: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    dairy_free: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sugar_free: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    alcohol_free: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    kosher: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    halal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    certifications: Mapped[str | None] = mapped_column(Text)

    ingredient_highlights: Mapped[str | None] = mapped_column(Text)
    other_ingredients: Mapped[str | None] = mapped_column(Text)
    allergen_info: Mapped[str | None] = mapped_column(Text)
    suggested_use: Mapped[str | None] = mapped_column(Text)
    manufacturer_warnings: Mapped[str | None] = mapped_column(Text)
    supplement_facts: Mapped[str | None] = mapped_column(Text)
    serving_size: Mapped[str | None] = mapped_column(String(120))
    amount_per_serving: Mapped[str | None] = mapped_column(String(120))
    percent_dv: Mapped[str | None] = mapped_column(String(40))

    official_bestseller: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    official_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    official_new: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source_price_cents: Mapped[int | None] = mapped_column(Integer)
    source_price_currency: Mapped[str | None] = mapped_column(String(3))
    source_price_collected_at: Mapped[datetime | None] = mapped_column(DateTime)
    source_availability: Mapped[str | None] = mapped_column(String(80))
    regular_price_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=999)
    sale_price_cents: Mapped[int | None] = mapped_column(Integer)
    discount_percent: Mapped[int | None] = mapped_column(Integer)
    price_is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    short_description: Mapped[str | None] = mapped_column(String(400))
    extraction_method: Mapped[str | None] = mapped_column(String(40))
    raw_source_attrs: Mapped[dict | None] = mapped_column(JSON)
    parser_version: Mapped[str | None] = mapped_column(String(20))
    source_content_hash: Mapped[str | None] = mapped_column(String(64))
    image_content_hash: Mapped[str | None] = mapped_column(String(64))
    image_status: Mapped[str] = mapped_column(
        String(40), default="missing_or_permission_required", nullable=False
    )
    image_use_status: Mapped[str] = mapped_column(
        String(40), default="permission_pending", nullable=False
    )
    verification_status: Mapped[str] = mapped_column(
        String(40), default="pending_review", nullable=False
    )
    source_policy_status: Mapped[str | None] = mapped_column(String(40))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    duplicate_of_id: Mapped[int | None] = mapped_column(Integer)
    duplicate_key: Mapped[str | None] = mapped_column(String(40))
    validation_errors: Mapped[list | None] = mapped_column(JSON)
    admin_edited_fields: Mapped[list | None] = mapped_column(JSON)
    source_snapshot: Mapped[dict | None] = mapped_column(JSON)
    imported_product_id: Mapped[int | None] = mapped_column(Integer)

    run: Mapped["CatalogImportRun"] = relationship(back_populates="products")
    source: Mapped["CatalogSource | None"] = relationship()
    variants: Mapped[list["CatalogStagedVariant"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    images: Mapped[list["CatalogStagedImage"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    approvals: Mapped[list["CatalogImportApproval"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )


class CatalogStagedVariant(Base):
    __tablename__ = "catalog_staged_variants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("catalog_staged_products.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(64))
    form: Mapped[str | None] = mapped_column(String(20))
    size: Mapped[str | None] = mapped_column(String(80))
    count: Mapped[int | None] = mapped_column(Integer)
    strength_value: Mapped[float | None] = mapped_column(Numeric(12, 3))
    strength_unit: Mapped[str | None] = mapped_column(String(16))
    source_price_cents: Mapped[int | None] = mapped_column(Integer)

    product: Mapped["CatalogStagedProduct"] = relationship(back_populates="variants")


class CatalogStagedImage(Base):
    __tablename__ = "catalog_staged_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("catalog_staged_products.id", ondelete="CASCADE"), nullable=False
    )
    source_url: Mapped[str | None] = mapped_column(String(800))
    original_path: Mapped[str | None] = mapped_column(String(500))
    optimized_filename: Mapped[str | None] = mapped_column(String(255))
    alt_text: Mapped[str | None] = mapped_column(String(300))
    mime_type: Mapped[str | None] = mapped_column(String(60))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    sha256: Mapped[str | None] = mapped_column(String(64))
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    image_use_status: Mapped[str] = mapped_column(
        String(40), default="demo_review_only", nullable=False
    )
    permission_status: Mapped[str] = mapped_column(
        String(40), default="permission_pending", nullable=False
    )
    status: Mapped[str] = mapped_column(String(40), default="pending", nullable=False)

    product: Mapped["CatalogStagedProduct"] = relationship(back_populates="images")


class CatalogImportError(Base):
    __tablename__ = "catalog_import_errors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[str] = mapped_column(
        ForeignKey("catalog_import_runs.id", ondelete="CASCADE"), nullable=False
    )
    brand_slug: Mapped[str | None] = mapped_column(String(80))
    url: Mapped[str | None] = mapped_column(String(800))
    stage: Mapped[str] = mapped_column(String(40), default="collect", nullable=False)
    fatal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    run: Mapped["CatalogImportRun"] = relationship(back_populates="errors")


class CatalogImportApproval(Base):
    __tablename__ = "catalog_import_approvals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("catalog_staged_products.id", ondelete="CASCADE"), nullable=False
    )
    run_id: Mapped[str] = mapped_column(
        ForeignKey("catalog_import_runs.id", ondelete="CASCADE"), nullable=False
    )
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    product: Mapped["CatalogStagedProduct"] = relationship(back_populates="approvals")
