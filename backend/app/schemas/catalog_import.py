from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CatalogSourceOut(BaseModel):
    id: int
    slug: str
    name: str
    parent_brand: str | None = None
    official_url: str
    collection_url: str
    domain: str
    enabled: bool
    product_limit: int
    policy_status: str
    policy_notes: str | None = None
    robots_status: str | None = None
    last_checked_at: datetime | None = None
    last_run_id: str | None = None
    last_result: str | None = None


class CatalogSourcePatch(BaseModel):
    enabled: bool | None = None
    product_limit: int | None = Field(default=None, ge=1, le=12)


class CatalogImportCreate(BaseModel):
    brand_slugs: list[str] = Field(min_length=1)
    per_brand_limit: int = Field(default=6, ge=1, le=12)
    prioritize_categories: list[str] = Field(default_factory=list)
    download_images: bool = True
    dry_run: bool = False
    collect_now: bool = True


class CatalogRunSummary(BaseModel):
    id: str
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    brand_slugs: list[str] = Field(default_factory=list)
    per_brand_limit: int
    download_images: bool
    dry_run: bool
    stats: dict[str, Any] = Field(default_factory=dict)
    robots_summary: dict[str, Any] = Field(default_factory=dict)
    error_message: str | None = None
    product_count: int = 0


class StagedImageOut(BaseModel):
    id: int
    source_url: str | None = None
    optimized_url: str | None = None
    alt_text: str | None = None
    status: str
    permission_status: str
    sha256: str | None = None


class StagedProductOut(BaseModel):
    id: int
    status: str
    brand: str
    name: str
    variant_name: str | None = None
    primary_category: str | None = None
    form: str | None = None
    strength_value: float | None = None
    strength_unit: str | None = None
    count: int | None = None
    size: str | None = None
    vegan: bool = False
    vegetarian: bool = False
    organic: bool = False
    gluten_free: bool = False
    non_gmo: bool = False
    source_price_cents: int | None = None
    regular_price_cents: int
    discount_percent: int | None = None
    sale_price_cents: int | None = None
    price_is_demo: bool = True
    official_bestseller: bool = False
    official_featured: bool = False
    official_new: bool = False
    image_status: str
    source_policy_status: str | None = None
    validation_errors: list[str] | None = None
    duplicate_key: str | None = None
    canonical_url: str
    short_description: str | None = None
    sku: str | None = None
    upc: str | None = None
    extraction_method: str | None = None
    image_use_status: str | None = None
    imported_product_id: int | None = None
    thumbnail_url: str | None = None
    images: list[StagedImageOut] = Field(default_factory=list)
    source_snapshot: dict[str, Any] | None = None
    admin_edited_fields: list[str] | None = None


class CatalogRunDetail(CatalogRunSummary):
    products: list[StagedProductOut] = Field(default_factory=list)


class IdsPayload(BaseModel):
    ids: list[int] = Field(min_length=1)
    note: str | None = None


class ImportPayload(BaseModel):
    ids: list[int] | None = None
    activate_after_import: bool = False


class StagedPatch(BaseModel):
    name: str | None = None
    variant_name: str | None = None
    primary_category: str | None = None
    form: str | None = None
    short_description: str | None = None
    regular_price_cents: int | None = None
    discount_percent: int | None = Field(default=None, ge=1, le=40)
    vegan: bool | None = None
    vegetarian: bool | None = None
    organic: bool | None = None
    gluten_free: bool | None = None
    non_gmo: bool | None = None
    count: int | None = None
    size: str | None = None
    ingredient_highlights: str | None = None
