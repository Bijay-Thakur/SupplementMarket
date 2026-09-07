"""Per-brand adapter tests against sanitized fixtures."""
from __future__ import annotations

import pytest

from app.catalog.adapters import all_adapter_slugs, get_adapter
from app.catalog.adapters.solgar import SolgarAdapter
from app.catalog.adapters.garden_of_life import GardenOfLifeAdapter
from app.catalog.http import FetchResult, PoliteFetcher, RobotsBlocked
from app.catalog.types import DiscoveredProduct
from tests.catalog_helpers import read_fixture

COLLECTION = read_fixture("shopify_collection.html")
PRODUCT = read_fixture("shopify_product.html")


class FixtureFetcher(PoliteFetcher):
    def __init__(self) -> None:
        super().__init__(live=False)
        self.robots.load("https://naturesway.com", "User-agent: *\nAllow: /\n", 200)
        self.robots.load("https://www.naturesway.com", "User-agent: *\nAllow: /\n", 200)
        self.pages = {
            "collection": COLLECTION,
            "product": PRODUCT,
        }

    def get(self, url: str, *, max_bytes: int | None = None) -> FetchResult:  # type: ignore[override]
        html = self.pages["product"] if "/products/" in url else self.pages["collection"]
        return FetchResult(url=url, final_url=url, status=200, body=html.encode(), content_type="text/html")


@pytest.mark.parametrize("slug", all_adapter_slugs())
def test_adapter_registered(slug):
    adapter = get_adapter(slug)
    assert adapter.slug == slug
    assert adapter.source.official_url.startswith("http")


def test_shopify_adapter_discover_and_parse():
    adapter = get_adapter("natures-way")
    fetcher = FixtureFetcher()
    found = adapter.discover_product_urls(fetcher)
    assert len(found) >= 6
    selected = adapter.select_candidate_products(found, 6)
    parsed = adapter.parse_product(fetcher, selected[0].url if selected else found[0].url)
    assert parsed.name
    assert parsed.extraction_method in ("jsonld", "embedded_json", "semantic_html", "css")
    errs = adapter.validate_product(parsed)
    assert isinstance(errs, list)
    images = adapter.collect_image_candidates(parsed)
    assert isinstance(images, list)


def test_blocked_adapters_raise():
    with pytest.raises(RobotsBlocked):
        SolgarAdapter().discover_product_urls(FixtureFetcher())
    with pytest.raises(RobotsBlocked):
        GardenOfLifeAdapter().parse_product(FixtureFetcher(), "https://www.gardenoflife.com/products/x")


def test_pagination_limit_on_base(monkeypatch):
    adapter = get_adapter("now-foods")
    assert adapter.max_pages <= 3
