"""Very small in-process fixed-window rate limiter for local dev hot paths.

Not for production scale — a shared store (e.g. Redis) is required later. Good
enough to demonstrate throttling on search/order/upload endpoints.
"""
from __future__ import annotations

import time
from collections import defaultdict

from app.core.config import settings
from app.core.errors import RateLimitError

_buckets: dict[str, list[float]] = defaultdict(list)


def check(bucket: str, identifier: str, limit: int) -> None:
    now = time.time()
    window = settings.rate_limit_window_seconds
    key = f"{bucket}:{identifier}"
    hits = [t for t in _buckets[key] if now - t < window]
    if len(hits) >= limit:
        raise RateLimitError("Too many requests. Please slow down.")
    hits.append(now)
    _buckets[key] = hits


def reset() -> None:
    _buckets.clear()
