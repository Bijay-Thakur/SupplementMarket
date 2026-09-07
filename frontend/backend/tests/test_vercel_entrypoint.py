from __future__ import annotations

import importlib.util
from pathlib import Path

from fastapi.testclient import TestClient


def _load_vercel_app():
    entrypoint = Path(__file__).resolve().parents[2] / "api" / "backend" / "index.py"
    spec = importlib.util.spec_from_file_location("bnm_vercel_backend", entrypoint)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.app


def test_vercel_health_route() -> None:
    with TestClient(_load_vercel_app()) as client:
        response = client.get("/api/backend/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_vercel_admin_route_fails_closed_without_token() -> None:
    with TestClient(_load_vercel_app()) as client:
        response = client.get("/api/backend/api/v1/admin/live/products")
    assert response.status_code == 401
    assert response.json()["error"] == "unauthorized"
    assert "traceback" not in response.text.lower()


def test_vercel_does_not_mount_local_dev_routes() -> None:
    with TestClient(_load_vercel_app()) as client:
        response = client.post("/api/backend/api/v1/dev/reset")
    assert response.status_code == 404
