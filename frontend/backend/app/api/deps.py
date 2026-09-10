"""Shared FastAPI dependencies."""
from __future__ import annotations

from dataclasses import dataclass

import httpx
from fastapi import Request

from app.core import ratelimit
from app.core.config import settings
from app.core.errors import (
    ForbiddenError,
    ServiceUnavailableError,
    UnauthorizedError,
    ValidationError,
)


def require_dev() -> None:
    """Guard for development-only SQLite demo surfaces (seed/reset)."""
    if not settings.is_development:
        raise ForbiddenError("This endpoint is only available in development.")


def _client_id(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def rate_limit_search(request: Request) -> None:
    ratelimit.check("search", _client_id(request), settings.rate_limit_search)


def rate_limit_order(request: Request) -> None:
    ratelimit.check("order", _client_id(request), settings.rate_limit_order)


def rate_limit_upload(request: Request) -> None:
    ratelimit.check("upload", _client_id(request), settings.rate_limit_upload)


@dataclass(frozen=True)
class AuthenticatedAdmin:
    user_id: str
    email: str
    access_token: str


def _bearer_token(request: Request) -> str:
    header = request.headers.get("authorization") or request.headers.get("Authorization") or ""
    if not header.lower().startswith("bearer "):
        raise UnauthorizedError("Sign in is required.")
    token = header.split(" ", 1)[1].strip()
    if not token:
        raise UnauthorizedError("Sign in is required.")
    return token


def _verify_access_token(token: str) -> dict:
    if not settings.supabase_auth_configured:
        raise ValidationError("Supabase is not configured.")
    try:
        response = httpx.get(
            f"{settings.supabase_rest_url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.supabase_publishable_key,
            },
            timeout=10.0,
        )
    except httpx.RequestError as exc:
        raise ServiceUnavailableError(
            "Unable to reach Supabase to verify administrator access. "
            "Check the network connection and Supabase configuration, then try again."
        ) from exc
    if response.status_code == 401 or response.status_code == 403:
        raise UnauthorizedError("Sign in is required.")
    if response.status_code >= 500:
        raise ServiceUnavailableError(
            "Supabase authentication is temporarily unavailable. Please try again."
        )
    if response.status_code >= 400:
        raise UnauthorizedError("Sign in is required.")
    try:
        data = response.json()
    except ValueError as exc:
        raise ServiceUnavailableError(
            "Supabase returned an invalid authentication response. Please try again."
        ) from exc
    if not isinstance(data, dict) or not data.get("id"):
        raise UnauthorizedError("Sign in is required.")
    return data


def _role_for_user(user_id: str, access_token: str) -> str | None:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "apikey": settings.supabase_publishable_key,
        "Accept": "application/json",
    }
    try:
        response = httpx.get(
            f"{settings.supabase_rest_url}/rest/v1/user_roles",
            headers=headers,
            params={"user_id": f"eq.{user_id}", "select": "role"},
            timeout=10.0,
        )
    except httpx.RequestError as exc:
        raise ServiceUnavailableError(
            "Unable to reach Supabase to verify the administrator role. "
            "Check the network connection and try again."
        ) from exc
    if response.status_code >= 500:
        raise ServiceUnavailableError(
            "Supabase role verification is temporarily unavailable. Please try again."
        )
    if response.status_code >= 400:
        return None
    try:
        rows = response.json()
    except ValueError as exc:
        raise ServiceUnavailableError(
            "Supabase returned an invalid role response. Please try again."
        ) from exc
    if isinstance(rows, list) and rows:
        role = rows[0].get("role")
        return str(role) if role else None
    return None


def require_supabase_admin(request: Request) -> AuthenticatedAdmin:
    """Validate the user JWT, then require public.user_roles.role = admin.

    User ID and role are taken only from the verified token and database.
    Request bodies are never used as authority.
    """
    token = _bearer_token(request)
    user = _verify_access_token(token)
    user_id = str(user["id"])
    role = _role_for_user(user_id, token)
    if role is None:
        raise ForbiddenError("Your account role is missing.")
    if role != "admin":
        raise ForbiddenError("Administrator access is required.")
    return AuthenticatedAdmin(user_id=user_id, email=str(user.get("email") or ""), access_token=token)
