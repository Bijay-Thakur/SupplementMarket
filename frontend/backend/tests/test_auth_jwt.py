from __future__ import annotations

import httpx

from app.core.config import settings


class FakeResponse:
    def __init__(self, status_code: int, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def test_protected_endpoint_missing_token(client) -> None:
    r = client.get("/api/v1/admin/live/products")
    assert r.status_code == 401
    body = r.json()
    assert "password" not in str(body).lower()
    assert "traceback" not in str(body).lower()


def test_protected_endpoint_customer_token(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "next_public_supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "next_public_supabase_publishable_key", "publishable")

    def fake_get(url, headers=None, params=None, timeout=None):
        if str(url).endswith("/auth/v1/user"):
            return FakeResponse(200, {"id": "11111111-1111-4111-8111-111111111111", "email": "customer@example.com"})
        if "user_roles" in str(url):
            return FakeResponse(200, [{"role": "customer"}])
        return FakeResponse(200, [])

    monkeypatch.setattr("app.api.deps.httpx.get", fake_get)
    r = client.get("/api/v1/admin/live/products", headers={"Authorization": "Bearer customer-token"})
    assert r.status_code == 403
    assert r.json()["error"] == "forbidden"


def test_protected_endpoint_admin_token(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "next_public_supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "next_public_supabase_publishable_key", "publishable")

    def fake_get(url, headers=None, params=None, timeout=None):
        if str(url).endswith("/auth/v1/user"):
            return FakeResponse(200, {"id": "22222222-2222-4222-8222-222222222222", "email": "admin@example.com"})
        if "user_roles" in str(url):
            return FakeResponse(200, [{"role": "admin"}])
        return FakeResponse(200, [])

    monkeypatch.setattr("app.api.deps.httpx.get", fake_get)
    monkeypatch.setattr("app.api.routes_admin_csv.sb.select", lambda *_args, **_kwargs: [])
    r = client.get("/api/v1/admin/live/products", headers={"Authorization": "Bearer admin-token"})
    assert r.status_code == 200
    assert r.json()["items"] == []


def test_invalid_token_is_unauthorized(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "next_public_supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "next_public_supabase_publishable_key", "publishable")
    monkeypatch.setattr(
        "app.api.deps.httpx.get",
        lambda *_args, **_kwargs: FakeResponse(401, {"message": "invalid"}),
    )
    r = client.post(
        "/api/v1/admin/live/products",
        headers={"Authorization": "Bearer not-a-real-token"},
        json={"name": "Zinc", "brand_name": "NOW", "upc": "123", "regular_price_cents": 100},
    )
    assert r.status_code == 401


def test_supabase_connection_failure_is_service_unavailable(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "next_public_supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "next_public_supabase_publishable_key", "publishable")

    def fail_to_connect(*_args, **_kwargs):
        raise httpx.ConnectError("connection blocked")

    monkeypatch.setattr("app.api.deps.httpx.get", fail_to_connect)
    response = client.get(
        "/api/v1/admin/live/products",
        headers={"Authorization": "Bearer admin-token"},
    )

    assert response.status_code == 503
    body = response.json()
    assert body["error"] == "service_unavailable"
    assert "Supabase" in body["detail"]
    assert "traceback" not in str(body).lower()
