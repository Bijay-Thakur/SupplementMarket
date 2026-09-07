"""Garden of Life — robots.txt is blocked (HTTP 403)."""
from __future__ import annotations

from app.catalog.adapters.base import BrandAdapter
from app.catalog.http import PoliteFetcher, RobotsBlocked
from app.catalog.types import DiscoveredProduct, ParsedProduct


class GardenOfLifeAdapter(BrandAdapter):
    slug = "garden-of-life"

    def discover_product_urls(self, fetcher: PoliteFetcher) -> list[DiscoveredProduct]:
        raise RobotsBlocked(self.source.official_url, "source_blocked")

    def parse_product(self, fetcher: PoliteFetcher, url: str) -> ParsedProduct:
        raise RobotsBlocked(url, "source_blocked")
