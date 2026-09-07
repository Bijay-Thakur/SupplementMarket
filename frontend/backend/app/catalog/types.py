"""Dataclasses shared by adapters and the collection pipeline."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any


@dataclass
class ImageCandidate:
    url: str
    alt_text: str | None = None
    is_primary: bool = True


@dataclass
class DiscoveredProduct:
    url: str
    title: str | None = None
    badges: list[str] = field(default_factory=list)
    listing_image_url: str | None = None
    listing_price_text: str | None = None
    category_hint: str | None = None


@dataclass
class ParsedProduct:
    brand: str
    parent_brand: str | None
    product_line: str | None
    name: str
    variant_name: str | None = None
    sku: str | None = None
    upc: str | None = None
    canonical_url: str = ""
    source_domain: str = ""
    source_collection_url: str | None = None
    collected_at: datetime | None = None

    primary_category: str | None = None
    secondary_category: str | None = None
    form: str | None = None
    health_interests: list[str] = field(default_factory=list)
    intended_audience: str | None = None
    search_aliases: list[str] = field(default_factory=list)
    wellness_tags: list[str] = field(default_factory=list)

    strength_value: float | None = None
    strength_unit: str | None = None
    count: int | None = None
    serving_count: int | None = None
    size: str | None = None
    weight: str | None = None
    volume: str | None = None
    flavor: str | None = None
    number_of_servings: int | None = None

    vegan: bool = False
    vegetarian: bool = False
    organic: bool = False
    non_gmo: bool = False
    gluten_free: bool = False
    soy_free: bool = False
    dairy_free: bool = False
    sugar_free: bool = False
    alcohol_free: bool = False
    kosher: bool = False
    halal: bool = False
    certifications: str | None = None

    ingredient_highlights: str | None = None
    other_ingredients: str | None = None
    allergen_info: str | None = None
    suggested_use: str | None = None
    manufacturer_warnings: str | None = None
    supplement_facts: str | None = None
    serving_size: str | None = None
    amount_per_serving: str | None = None
    percent_dv: str | None = None

    official_bestseller: bool = False
    official_featured: bool = False
    official_new: bool = False
    source_price_cents: int | None = None
    source_price_currency: str | None = "USD"
    source_availability: str | None = None

    short_description: str | None = None
    extraction_method: str = "jsonld"
    parser_version: str = "2b.1"
    source_content_hash: str | None = None
    images: list[ImageCandidate] = field(default_factory=list)
    raw_source_attrs: dict[str, Any] = field(default_factory=dict)
    variants: list[dict[str, Any]] = field(default_factory=list)

    def snapshot(self) -> dict[str, Any]:
        data = asdict(self)
        collected = data.get("collected_at")
        if isinstance(collected, datetime):
            data["collected_at"] = collected.isoformat()
        return data
