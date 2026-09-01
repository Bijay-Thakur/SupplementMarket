"""Deterministic demonstration prices. Sale math is centralized in pricing.py."""
from __future__ import annotations

import hashlib

from app.services.pricing import sale_price_from_percent

DISCOUNT_BUCKETS = (10, 20, 30, 40)
# ~38% of products on sale (97/256).
SALE_THRESHOLD = 97


def demo_prices(
    brand: str,
    name: str,
    variant: str | None,
    count: int | None,
) -> tuple[int, int | None, int | None]:
    """Return (regular_cents, sale_cents, discount_percent).

    Regular price is $9.99–$79.99 ending in .99. Sale price is computed as
    regular × (1 − percent/100), rounded to the nearest cent.
    """
    key = f"{brand}|{name}|{variant or ''}|{count or ''}"
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    dollars = 9 + (digest[0] * 256 + digest[1]) % 71  # 9..79
    regular = dollars * 100 + 99
    if digest[2] < SALE_THRESHOLD:
        percent = DISCOUNT_BUCKETS[digest[3] % 4]
        sale = sale_price_from_percent(regular, percent)
        return regular, sale, percent
    return regular, None, None
