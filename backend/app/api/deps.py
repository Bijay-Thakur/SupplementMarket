"""Shared FastAPI dependencies."""
from __future__ import annotations

from fastapi import Request

from app.core import ratelimit
from app.core.config import settings
from app.core.errors import ForbiddenError


def require_dev() -> None:
    """Guard for development-only surfaces (admin APIs, seed/reset).

    THIS IS NOT AUTHENTICATION. In Phase 2 there is no auth; these endpoints are
    simply disabled outside development. Before deployment they MUST be placed
    behind Supabase auth + server-verified admin authorization.
    """
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
