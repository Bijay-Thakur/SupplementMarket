"""Central pricing rules. Discount percent is ALWAYS derived here so it never
becomes an independent, drift-prone source of truth."""
from __future__ import annotations


class PricingError(ValueError):
    """Raised when a price combination is invalid."""


def validate_prices(regular_cents: int, sale_cents: int | None) -> None:
    if regular_cents < 0:
        raise PricingError("Regular price cannot be negative.")
    if sale_cents is not None:
        if sale_cents < 0:
            raise PricingError("Sale price cannot be negative.")
        if sale_cents >= regular_cents:
            raise PricingError("Sale price must be less than the regular price.")


def discount_percent(regular_cents: int, sale_cents: int | None) -> int | None:
    """Whole-number discount percent, rounded to nearest, or None when not on sale."""
    if sale_cents is None or regular_cents <= 0 or sale_cents >= regular_cents:
        return None
    return round((regular_cents - sale_cents) * 100 / regular_cents)


def effective_price_cents(regular_cents: int, sale_cents: int | None) -> int:
    """Price a customer pays: sale price when valid, else regular price."""
    if sale_cents is not None and 0 <= sale_cents < regular_cents:
        return sale_cents
    return regular_cents


def sale_price_from_percent(regular_cents: int, percent: int) -> int:
    """Compute a sale price (cents) from a whole-number percent. Rounds to cent."""
    if not (0 < percent < 100):
        raise PricingError("Discount percent must be between 1 and 99.")
    return round(regular_cents * (100 - percent) / 100)


def sale_price_from_brand_discount(regular_cents: int, percent: int) -> int | None:
    """Apply a brand rule; 0 removes Store SRP and 1..99 derives it from MSRP."""
    if regular_cents < 0:
        raise PricingError("Regular price cannot be negative.")
    if not (0 <= percent < 100):
        raise PricingError("Brand discount percent must be between 0 and 99.")
    if percent == 0 or regular_cents == 0:
        return None
    return min(regular_cents - 1, round(regular_cents * (100 - percent) / 100))
