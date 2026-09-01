"""Duplicate keys: UPC, SKU+brand, canonical URL, then normalized identity."""
from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog.types import ParsedProduct
from app.core.utils import slugify
from app.models import CatalogStagedProduct, Product


def normalize_identity(brand: str, name: str, strength: str | None, form: str | None, count: int | None) -> str:
    bits = [slugify(brand), slugify(name), slugify(strength or ""), slugify(form or ""), str(count or "")]
    return "|".join(bits)


def strength_label(p: ParsedProduct) -> str | None:
    if p.strength_value is None:
        return None
    val = int(p.strength_value) if float(p.strength_value).is_integer() else p.strength_value
    return f"{val}{p.strength_unit or ''}"


def find_duplicate(db: Session, parsed: ParsedProduct) -> tuple[str, int] | None:
    """Return (key_name, existing_staged_or_product_id_negative_if_product)."""
    if parsed.upc:
        upc = re.sub(r"\D", "", parsed.upc)
        row = db.execute(
            select(CatalogStagedProduct).where(CatalogStagedProduct.upc == parsed.upc)
        ).scalar_one_or_none()
        if row:
            return "upc", row.id
        prod = db.execute(select(Product).where(Product.upc == parsed.upc)).scalar_one_or_none()
        if prod:
            return "upc", -prod.id
        if upc:
            prod = db.execute(select(Product).where(Product.upc == upc)).scalar_one_or_none()
            if prod:
                return "upc", -prod.id
    if parsed.sku:
        row = db.execute(
            select(CatalogStagedProduct).where(
                CatalogStagedProduct.sku == parsed.sku,
                CatalogStagedProduct.brand == parsed.brand,
            )
        ).scalar_one_or_none()
        if row:
            return "sku_brand", row.id
        prod = db.execute(select(Product).where(Product.sku == parsed.sku)).scalar_one_or_none()
        if prod:
            return "sku_brand", -prod.id
    url = (parsed.canonical_url or "").split("?")[0]
    if url:
        row = db.execute(
            select(CatalogStagedProduct).where(CatalogStagedProduct.canonical_url == url)
        ).scalar_one_or_none()
        if row:
            return "canonical_url", row.id
        prod = db.execute(select(Product).where(Product.source_url == url)).scalar_one_or_none()
        if prod:
            return "canonical_url", -prod.id
    ident = normalize_identity(
        parsed.brand, parsed.name, strength_label(parsed), parsed.form, parsed.count
    )
    rows = db.execute(select(CatalogStagedProduct)).scalars()
    for r in rows:
        other = normalize_identity(
            r.brand,
            r.name,
            f"{r.strength_value or ''}{r.strength_unit or ''}" if r.strength_value else None,
            r.form,
            r.count,
        )
        if other == ident:
            return "normalized", r.id
    return None
