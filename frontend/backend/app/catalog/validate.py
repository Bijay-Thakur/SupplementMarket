"""Validation for staged manufacturer products."""
from __future__ import annotations

from app.catalog.types import ParsedProduct
from app.models.entities import FORM_VALUES

REQUIRED = ("name", "brand", "canonical_url")


def validate_product(parsed: ParsedProduct) -> list[str]:
    errors: list[str] = []
    for field in REQUIRED:
        if not getattr(parsed, field, None):
            errors.append(f"Missing {field}.")
    if parsed.form and parsed.form not in FORM_VALUES:
        errors.append(f"Unknown form '{parsed.form}'.")
    if parsed.source_price_cents is not None and parsed.source_price_cents < 0:
        errors.append("Source price cannot be negative.")
    if parsed.count is not None and parsed.count < 0:
        errors.append("Count cannot be negative.")
    if "amazon." in (parsed.canonical_url or "").lower() or "walmart." in (parsed.canonical_url or "").lower():
        errors.append("Retailer URL is not an allowed source.")
    return errors
