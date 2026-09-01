"""Opt-in live smoke tests. Run with CATALOG_LIVE=1 — never during normal pytest."""
from __future__ import annotations

import os

import pytest

from app.catalog.adapters import get_adapter
from app.catalog.http import PoliteFetcher, RobotsBlocked
from app.catalog.sources import SOURCES

pytestmark = pytest.mark.skipif(not os.getenv("CATALOG_LIVE"), reason="opt-in live HTTP")


@pytest.mark.parametrize("slug", [s.slug for s in SOURCES])
def test_live_robots_and_optional_discover(slug):
    adapter = get_adapter(slug)
    src = adapter.source
    with PoliteFetcher(live=True, delay_seconds=1.5) as fetcher:
        if src.default_policy == "blocked":
            with pytest.raises(RobotsBlocked):
                adapter.discover_product_urls(fetcher)
            return
        fetcher.ensure_robots(src.official_url)
        found = adapter.discover_product_urls(fetcher)
        assert isinstance(found, list)
