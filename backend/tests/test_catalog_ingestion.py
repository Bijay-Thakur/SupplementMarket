"""Catalog ingestion tests using sanitized fixtures (no live HTTP)."""
from __future__ import annotations

import hashlib

import pytest

from app.catalog.classify import classify_name, enrich
from app.catalog.dedupe import find_duplicate
from app.catalog.description import short_description, strip_claims
from app.catalog.extract import (
    parse_jsonld_scripts,
    parsed_from_jsonld,
    parsed_from_semantic_html,
)
from app.catalog.http import FetchError, PoliteFetcher
from app.catalog.images import detect_image, descriptive_stem, save_and_optimize
from app.catalog.pricing_demo import demo_prices
from app.catalog.robots import RobotsCache
from app.catalog.types import ParsedProduct
from app.catalog.validate import validate_product
from app.models import CatalogStagedProduct, Product
from app.services.pricing import sale_price_from_percent
from tests.catalog_helpers import read_fixture
from tests.test_api import MINI_PNG


def test_jsonld_extraction():
    html = read_fixture("shopify_product.html")
    nodes = parse_jsonld_scripts(html)
    assert nodes
    parsed = parsed_from_jsonld(
        nodes[0],
        page_url="https://naturesway.com/products/vitamin-d3-5000-iu",
        brand="Nature's Way",
        parent_brand="Nature's Way",
    )
    assert parsed.name == "Vitamin D3 5000 IU"
    assert parsed.sku == "NW-D3-5000"
    assert parsed.upc == "033674154321"
    assert parsed.source_price_cents == 1499
    assert parsed.images


def test_html_fallback():
    html = read_fixture("semantic.html")
    parsed = parsed_from_semantic_html(
        html, page_url="https://example.com/products/vitamin-c", brand="Demo", parent_brand="Demo"
    )
    assert parsed is not None
    assert "Vitamin C" in parsed.name
    assert parsed.sku == "C-1000"
    assert parsed.extraction_method == "semantic_html"


def test_canonical_and_selection_balancing():
    from app.catalog.adapters.natures_way import NaturesWayAdapter
    from app.catalog.extract import extract_hrefs, _HREF_PRODUCT
    from app.catalog.types import DiscoveredProduct

    html = read_fixture("shopify_collection.html")
    urls = extract_hrefs(html, _HREF_PRODUCT, "https://naturesway.com/collections/all")
    assert len(urls) >= 6
    discovered = [
        DiscoveredProduct(url=u, title=u.rsplit("/", 1)[-1].replace("-", " "), badges=["bestseller"] if i == 0 else [])
        for i, u in enumerate(urls)
    ]
    picked = NaturesWayAdapter().select_candidate_products(discovered, 6)
    assert len(picked) == 6
    assert picked[0].url.endswith("daily-multivitamin")


def test_demo_prices_deterministic_and_sale_math():
    a = demo_prices("NOW Foods", "Vitamin D3", None, 120)
    b = demo_prices("NOW Foods", "Vitamin D3", None, 120)
    assert a == b
    regular, sale, pct = a
    assert 999 <= regular <= 7999
    assert regular % 100 == 99
    if sale is not None:
        assert pct in (10, 20, 30, 40)
        assert sale == sale_price_from_percent(regular, pct)


def test_claim_stripping_and_neutral_copy():
    p = ParsedProduct(
        brand="NOW Foods",
        parent_brand="NOW Foods",
        product_line=None,
        name="Vitamin D3 5000 IU",
        form="softgel",
        count=120,
        vegan=True,
    )
    text = short_description(p)
    assert "NOW Foods" in text
    assert "diagnose" in text.lower()  # FDA disclaimer preserved
    assert "miracle" not in strip_claims("miracle cure treat prevent")


def test_woodstock_not_supplement():
    cat, *_ = classify_name("Organic Black Beans", is_food=True)
    assert cat == "Natural Foods"


def test_ashwagandha_is_herbal_not_omega():
    cat, *_ = classify_name("Ashwagandha Root")
    assert cat == "Herbal Supplements"


def test_robots_exclusion():
    cache = RobotsCache()
    cache.load("https://example.com", read_fixture("robots_deny.txt"), 200)
    ok, reason = cache.can_fetch("TestBot/1.0", "https://example.com/products/x")
    assert ok is False
    assert reason == "robots_disallow"
    cache2 = RobotsCache()
    cache2.load("https://ok.example", read_fixture("robots_allow.txt"), 200)
    ok2, _ = cache2.can_fetch("TestBot/1.0", "https://ok.example/products/x")
    assert ok2 is True
    blocked = cache2.load("https://blocked.example", None, 403)
    assert blocked.status == "blocked"
    assert blocked.allowed is False


def test_image_mime_and_size_and_dedup(tmp_path, monkeypatch):
    monkeypatch.setattr("app.catalog.images.settings.catalog_imports_dir", str(tmp_path / "imports"))
    monkeypatch.setattr("app.catalog.images.settings.storage_dir", str(tmp_path / "products"))
    monkeypatch.setattr("app.catalog.images.settings.max_upload_bytes", 5_000_000)
    ext, mime = detect_image(MINI_PNG)
    assert mime == "image/png"
    with pytest.raises(ValueError):
        detect_image(b"<html>not an image</html>")
    seen = {}
    a = save_and_optimize(
        MINI_PNG, brand_slug="now-foods", run_id="r1", name="Vitamin D3", form="softgel", count=120, seen_hashes=seen
    )
    b = save_and_optimize(
        MINI_PNG, brand_slug="now-foods", run_id="r1", name="Vitamin D3 copy", form="softgel", count=90, seen_hashes=seen
    )
    assert a.sha256 == hashlib.sha256(MINI_PNG).hexdigest()
    assert b.duplicate is True
    stem = descriptive_stem("now-foods", "Vitamin D3 5000 IU 120 Softgels", "softgel", 120)
    assert stem.startswith("now-foods-")
    assert "front" in stem


def test_validate_rejects_retailer_url():
    p = ParsedProduct(
        brand="X",
        parent_brand="X",
        product_line=None,
        name="Thing",
        canonical_url="https://www.amazon.com/dp/abc",
    )
    errs = validate_product(p)
    assert any("Retailer" in e for e in errs)


def test_duplicate_keys(db_session, brand, category):
    existing = Product(
        brand_id=brand.id,
        category_id=category.id,
        name="Existing D3",
        slug="existing-d3",
        sku="NW-D3-5000",
        upc="033674154321",
        regular_price_cents=1499,
        is_demo=True,
        source_url="https://naturesway.com/products/vitamin-d3-5000-iu",
    )
    db_session.add(existing)
    db_session.commit()
    parsed = ParsedProduct(
        brand="Nature's Way",
        parent_brand="Nature's Way",
        product_line=None,
        name="Vitamin D3 5000 IU",
        sku="NW-D3-5000",
        upc="033674154321",
        canonical_url="https://naturesway.com/products/vitamin-d3-5000-iu",
    )
    dup = find_duplicate(db_session, parsed)
    assert dup is not None
    assert dup[0] == "upc"


def test_retry_flag_on_fetch_error():
    e = FetchError("HTTP 503", status=503, retryable=True)
    assert e.retryable is True
    e2 = FetchError("HTTP 404", status=404, retryable=False)
    assert e2.retryable is False


def test_fetcher_uses_cache(tmp_path):
    cache = tmp_path / "c"
    cache.mkdir()
    url = "https://example.com/p"
    h = hashlib.sha256(url.encode()).hexdigest()
    (cache / f"{h}.bin").write_bytes(b"text/html\n<html>cached</html>")
    f = PoliteFetcher(cache_dir=cache, live=False)
    f.robots.load("https://example.com", "User-agent: *\nAllow: /\n", 200)
    r = f.get(url)
    assert r.from_cache is True
    assert "cached" in r.text
