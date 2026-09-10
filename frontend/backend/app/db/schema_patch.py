"""Add Phase 2B columns on existing SQLite files (create_all does not ALTER)."""
from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger("bnm")

_PRODUCT_COLS = [
    ("sugar_free", "BOOLEAN DEFAULT 0 NOT NULL"),
    ("kosher", "BOOLEAN DEFAULT 0 NOT NULL"),
    ("halal", "BOOLEAN DEFAULT 0 NOT NULL"),
    ("parent_brand", "VARCHAR(160)"),
    ("product_line", "VARCHAR(160)"),
    ("variant_name", "VARCHAR(160)"),
    ("certifications", "TEXT"),
    ("serving_size", "VARCHAR(120)"),
    ("other_ingredients", "TEXT"),
    ("allergen_info", "TEXT"),
    ("source_price_cents", "INTEGER"),
    ("source_price_currency", "VARCHAR(3)"),
    ("source_price_collected_at", "DATETIME"),
    ("price_is_demo", "BOOLEAN DEFAULT 0 NOT NULL"),
    ("source_domain", "VARCHAR(200)"),
    ("source_collection_url", "VARCHAR(600)"),
    ("extraction_method", "VARCHAR(40)"),
    ("parser_version", "VARCHAR(20)"),
    ("source_content_hash", "VARCHAR(64)"),
    ("last_source_verification_at", "DATETIME"),
    ("staged_product_id", "INTEGER"),
    ("intended_audience", "VARCHAR(80)"),
]

_IMAGE_COLS = [
    ("source_url", "VARCHAR(800)"),
    ("sha256", "VARCHAR(64)"),
    ("image_use_status", "VARCHAR(40)"),
    ("permission_status", "VARCHAR(40)"),
    ("original_path", "VARCHAR(500)"),
]

_BRAND_COLS = [
    ("discount_percent", "INTEGER"),
]


def patch_sqlite(engine: Engine) -> None:
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    if "products" not in tables:
        return
    existing = {c["name"] for c in insp.get_columns("products")}
    with engine.begin() as conn:
        if "brands" in tables:
            brand_existing = {c["name"] for c in insp.get_columns("brands")}
            for name, ddl in _BRAND_COLS:
                if name in brand_existing:
                    continue
                conn.execute(text(f"ALTER TABLE brands ADD COLUMN {name} {ddl}"))
                logger.info("Added brands.%s", name)
        for name, ddl in _PRODUCT_COLS:
            if name in existing:
                continue
            conn.execute(text(f"ALTER TABLE products ADD COLUMN {name} {ddl}"))
            logger.info("Added products.%s", name)
        if "product_images" in tables:
            img_existing = {c["name"] for c in insp.get_columns("product_images")}
            for name, ddl in _IMAGE_COLS:
                if name in img_existing:
                    continue
                conn.execute(text(f"ALTER TABLE product_images ADD COLUMN {name} {ddl}"))
                logger.info("Added product_images.%s", name)
