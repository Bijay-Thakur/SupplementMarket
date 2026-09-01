from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ProductImageOut(BaseModel):
    id: int
    url: str
    alt_text: str | None = None
    display_order: int = 0
    is_primary: bool = False


class VariantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    label: str
    sku: str
    form: str | None = None
    size: str | None = None
    count: int | None = None
    strength_value: float | None = None
    strength_unit: str | None = None
    regular_price_cents: int | None = None
    sale_price_cents: int | None = None
    availability: str | None = None


class DietaryFlags(BaseModel):
    vegan: bool = False
    vegetarian: bool = False
    organic: bool = False
    gluten_free: bool = False
    soy_free: bool = False
    dairy_free: bool = False
    alcohol_free: bool = False
    non_gmo: bool = False


class ProductListItem(BaseModel):
    id: int
    name: str
    slug: str
    brand_name: str
    brand_slug: str
    category_name: str
    category_slug: str
    form: str | None = None
    size: str | None = None
    count: int | None = None
    strength_value: float | None = None
    strength_unit: str | None = None
    availability: str
    regular_price_cents: int
    sale_price_cents: int | None = None
    effective_price_cents: int
    discount_percent: int | None = None
    on_sale: bool = False
    is_featured: bool = False
    is_bestseller: bool = False
    is_new: bool = False
    is_demo: bool = False
    short_description: str | None = None
    primary_image_url: str | None = None
    dietary: DietaryFlags


class ProductDetail(ProductListItem):
    long_description: str | None = None
    sku: str
    upc: str | None = None
    brand_id: int | None = None
    category_id: int | None = None
    ingredient_highlights: str | None = None
    usage_text: str | None = None
    warnings: str | None = None
    search_aliases: list[str] = Field(default_factory=list)
    wellness_tags: list[str] = Field(default_factory=list)
    images: list[ProductImageOut] = Field(default_factory=list)
    variants: list[VariantOut] = Field(default_factory=list)
    is_active: bool = True
    is_archived: bool = False
    source_url: str | None = None
    source_type: str | None = None
    verification_status: str = "unverified"
    approval_status: str = "approved"
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AdminProductRow(BaseModel):
    id: int
    name: str
    slug: str
    brand_name: str
    thumbnail_url: str | None = None
    regular_price_cents: int
    sale_price_cents: int | None = None
    discount_percent: int | None = None
    availability: str
    is_featured: bool
    is_bestseller: bool
    is_new: bool
    is_active: bool
    is_archived: bool
    is_demo: bool
    price_is_demo: bool = False
    image_use_status: str | None = None
    source_url: str | None = None
    last_source_verification_at: datetime | None = None
    updated_at: datetime | None = None


# ── Admin write models (allow-listed fields only; no mass assignment) ─────────
class ProductWriteBase(BaseModel):
    short_description: str | None = Field(default=None, max_length=400)
    long_description: str | None = None
    form: str | None = None
    size: str | None = Field(default=None, max_length=80)
    count: int | None = Field(default=None, ge=0)
    strength_value: float | None = Field(default=None, ge=0)
    strength_unit: str | None = Field(default=None, max_length=16)
    upc: str | None = Field(default=None, max_length=32)
    availability: str | None = None
    is_featured: bool | None = None
    is_bestseller: bool | None = None
    is_new: bool | None = None
    is_active: bool | None = None
    vegan: bool | None = None
    vegetarian: bool | None = None
    organic: bool | None = None
    gluten_free: bool | None = None
    soy_free: bool | None = None
    dairy_free: bool | None = None
    alcohol_free: bool | None = None
    non_gmo: bool | None = None
    search_aliases: list[str] | None = None
    ingredient_highlights: str | None = None
    usage_text: str | None = None
    warnings: str | None = None
    tag_ids: list[int] | None = None
    is_demo: bool | None = None
    source_url: str | None = Field(default=None, max_length=600)
    source_type: str | None = Field(default=None, max_length=60)
    source_access_date: date | None = None
    image_use_status: str | None = None
    verification_status: str | None = None
    approval_status: str | None = None


class ProductCreate(ProductWriteBase):
    brand_id: int
    category_id: int
    subcategory_id: int | None = None
    name: str = Field(min_length=1, max_length=240)
    slug: str | None = Field(default=None, max_length=260)
    sku: str = Field(min_length=1, max_length=64)
    regular_price_cents: int = Field(ge=0)
    # Provide either an explicit sale price or a discount percent (server derives).
    sale_price_cents: int | None = Field(default=None, ge=0)
    discount_percent: int | None = Field(default=None, ge=1, le=99)


class ProductUpdate(ProductWriteBase):
    brand_id: int | None = None
    category_id: int | None = None
    subcategory_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=240)
    slug: str | None = Field(default=None, max_length=260)
    sku: str | None = Field(default=None, min_length=1, max_length=64)
    regular_price_cents: int | None = Field(default=None, ge=0)
    sale_price_cents: int | None = Field(default=None, ge=0)
    discount_percent: int | None = Field(default=None, ge=0, le=99)
    remove_sale: bool = False
    # Optimistic concurrency: reject if the row changed since the client loaded it.
    expected_updated_at: datetime | None = None
