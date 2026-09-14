"""Supabase REST/Storage client.

Catalog import writes use the service role only after FastAPI has independently
verified the caller is an administrator (JWT + public.user_roles). Elevated
access is required so bulk import can persist cost_price_cents, which is not
granted to the authenticated PostgREST role for public/customer reads.
"""
from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import settings
from app.core.errors import AppError, ConflictError, NotFoundError, ValidationError


class SupabaseRestError(AppError):
    code = "upstream_error"


# Reuse TLS connections across the many small catalog requests made by an
# import. Creating a new client for every request made CSV previews slow enough
# to hit serverless request limits for otherwise small files.
_CLIENT = httpx.Client(limits=httpx.Limits(max_connections=20, max_keepalive_connections=10))


def _headers(*, prefer: str | None = None) -> dict[str, str]:
    if not settings.supabase_configured:
        raise ValidationError("Supabase is not configured.")
    headers = {
        "apikey": settings.supabase_admin_key,
        "Authorization": f"Bearer {settings.supabase_admin_key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _url(path: str) -> str:
    return f"{settings.supabase_rest_url}{path}"


def request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json: Any = None,
    prefer: str | None = "return=representation",
    timeout: float = 30.0,
) -> Any:
    response = _CLIENT.request(
        method,
        _url(path),
        headers=_headers(prefer=prefer),
        params=params,
        json=json,
        timeout=timeout,
    )
    if response.status_code == 404:
        raise NotFoundError("Record not found.")
    if response.status_code == 409:
        raise ConflictError("That catalog record already exists.")
    if response.status_code >= 400:
        raise SupabaseRestError("Catalog service is unavailable.")
    if not response.content:
        return None
    return response.json()


def select(table: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    data = request("GET", f"/rest/v1/{table}", params=params, prefer=None)
    return data if isinstance(data, list) else []


def insert(table: str, row: dict[str, Any]) -> dict[str, Any]:
    data = request("POST", f"/rest/v1/{table}", json=row)
    return data[0] if isinstance(data, list) else data


def insert_many(table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not rows:
        return []
    data = request("POST", f"/rest/v1/{table}", json=rows)
    return data if isinstance(data, list) else []


def update(table: str, match: dict[str, str], row: dict[str, Any]) -> dict[str, Any] | None:
    data = request("PATCH", f"/rest/v1/{table}", params=match, json=row)
    if isinstance(data, list):
        return data[0] if data else None
    return data


def delete(table: str, match: dict[str, str]) -> None:
    request("DELETE", f"/rest/v1/{table}", params=match, prefer="return=minimal")


def rpc(function: str, payload: dict[str, Any]) -> Any:
    """Call a service-role-only Postgres function through PostgREST."""
    if not function or not function.replace("_", "").isalnum():
        raise ValidationError("Invalid database function name.")
    return request("POST", f"/rest/v1/rpc/{function}", json=payload, prefer=None)


def upload_object(bucket: str, object_path: str, content: bytes, content_type: str) -> str:
    url = f"{settings.supabase_rest_url}/storage/v1/object/{bucket}/{object_path}"
    response = _CLIENT.post(
        url,
        headers={
            "apikey": settings.supabase_admin_key,
            "Authorization": f"Bearer {settings.supabase_admin_key}",
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        content=content,
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise SupabaseRestError("Image storage is unavailable.")
    return f"{settings.supabase_rest_url}/storage/v1/object/public/{bucket}/{object_path}"


def delete_object(bucket: str, object_path: str) -> None:
    """Remove one known object without allowing path or bucket traversal."""
    safe_bucket = quote(bucket, safe="")
    safe_path = quote(object_path.lstrip("/"), safe="/")
    if not safe_bucket or not safe_path or safe_path.startswith("../") or "/../" in safe_path:
        raise ValidationError("Invalid storage object path.")
    response = _CLIENT.delete(
        f"{settings.supabase_rest_url}/storage/v1/object/{safe_bucket}/{safe_path}",
        headers=_headers(prefer=None),
        timeout=30.0,
    )
    if response.status_code not in {200, 204, 404}:
        raise SupabaseRestError("Image storage cleanup failed.")
