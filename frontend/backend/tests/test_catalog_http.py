"""HTTP retry and robots handling without live websites."""
from __future__ import annotations

from app.catalog.http import FetchError, PoliteFetcher, build_user_agent
from app.catalog.robots import origin_of


def test_user_agent_does_not_invent_email(monkeypatch):
    monkeypatch.setattr("app.catalog.http.settings.catalog_collector_contact_email", "")
    ua = build_user_agent()
    assert "BronxvilleNaturalMarket-CatalogCollector/1.0" in ua
    assert "@" not in ua


def test_user_agent_includes_configured_email(monkeypatch):
    monkeypatch.setattr("app.catalog.http.settings.catalog_collector_contact_email", "ops@example.com")
    ua = build_user_agent()
    assert "ops@example.com" in ua


def test_origin_of():
    assert origin_of("https://www.nowfoods.com/products/x") == "https://www.nowfoods.com"


def test_retryable_errors():
    assert FetchError("x", status=429, retryable=True).retryable
    assert FetchError("x", status=503, retryable=True).retryable
