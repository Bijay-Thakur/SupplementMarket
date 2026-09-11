from __future__ import annotations

import hashlib
import hmac
import importlib.util
from pathlib import Path
import time

from fastapi.testclient import TestClient

from app.core.config import settings


def _load_vercel_app():
    entrypoint = Path(__file__).resolve().parents[2] / "api" / "backend.py"
    spec = importlib.util.spec_from_file_location("bnm_vercel_backend", entrypoint)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.app


def test_vercel_health_route() -> None:
    with TestClient(_load_vercel_app()) as client:
        response = client.get("/api/backend")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_vercel_admin_route_fails_closed_without_token() -> None:
    with TestClient(_load_vercel_app()) as client:
        response = client.get(
            "/api/backend",
            params={"__path": "/api/v1/admin/live/products"},
        )
    assert response.status_code == 401
    assert response.json()["error"] == "unauthorized"
    assert "traceback" not in response.text.lower()


def test_vercel_admin_route_accepts_short_lived_internal_assertion(monkeypatch) -> None:
    user_id = "22222222-2222-4222-8222-222222222222"
    timestamp = str(int(time.time()))
    path = "/api/v1/admin/live/products"
    secret = "test-only-internal-secret"
    signature = hmac.new(
        secret.encode(),
        f"{timestamp}\nGET\n{path}\n{user_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    monkeypatch.setattr(settings, "admin_internal_secret", secret)
    monkeypatch.setattr("app.api.routes_admin_csv.sb.select", lambda *_args, **_kwargs: [])

    with TestClient(_load_vercel_app()) as client:
        response = client.get(
            "/api/backend",
            params={"__path": path, "q": "biosil"},
            headers={
                "X-BNM-Admin-User": user_id,
                "X-BNM-Admin-Timestamp": timestamp,
                "X-BNM-Admin-Signature": signature,
            },
        )

    assert response.status_code == 200
    assert response.json()["items"] == []


def test_vercel_admin_route_rejects_invalid_internal_assertion(monkeypatch) -> None:
    monkeypatch.setattr(settings, "admin_internal_secret", "test-only-internal-secret")
    with TestClient(_load_vercel_app()) as client:
        response = client.get(
            "/api/backend",
            params={"__path": "/api/v1/admin/live/brands"},
            headers={
                "X-BNM-Admin-User": "22222222-2222-4222-8222-222222222222",
                "X-BNM-Admin-Timestamp": str(int(time.time())),
                "X-BNM-Admin-Signature": "0" * 64,
            },
        )

    assert response.status_code == 401
    assert response.json()["error"] == "unauthorized"


def test_vercel_does_not_mount_local_dev_routes() -> None:
    with TestClient(_load_vercel_app()) as client:
        response = client.post(
            "/api/backend",
            params={"__path": "/api/v1/dev/reset"},
        )
    assert response.status_code == 404
