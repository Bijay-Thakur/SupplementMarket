"""Vercel entrypoint for the authenticated Supabase admin API.

Vercel exposes this file at the exact /api/backend route. The Next.js
server-side proxy supplies the intended FastAPI route in __path; this avoids
a directory-index trailing-slash loop while keeping the Python surface
limited to authenticated live-admin operations.
"""
from __future__ import annotations

import logging
import sys
import uuid
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

_BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.api import routes_admin_csv  # noqa: E402
from app.core.errors import AppError  # noqa: E402

logger = logging.getLogger("bnm.vercel")
_LIVE_ADMIN_PREFIX = "/api/v1/admin/live"

backend_api = FastAPI(
    title="Bronxville Natural Market Admin API",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@backend_api.middleware("http")
async def vercel_path_bridge(request: Request, call_next):
    """Route one Vercel function URL to the restricted FastAPI admin router."""
    forwarded_path = request.query_params.get("__path")
    if request.url.path == "/api/backend" and forwarded_path:
        if not (
            forwarded_path == _LIVE_ADMIN_PREFIX
            or forwarded_path.startswith(f"{_LIVE_ADMIN_PREFIX}/")
        ):
            return JSONResponse(status_code=404, content={"detail": "Not found."})
        request.scope["path"] = forwarded_path
        request.scope["raw_path"] = forwarded_path.encode("utf-8")

    response = await call_next(request)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@backend_api.exception_handler(AppError)
async def app_error(_request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.code, "detail": exc.message, "fields": exc.fields},
    )


@backend_api.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    fields: dict[str, str] = {}
    for error in exc.errors():
        location = ".".join(str(part) for part in error.get("loc", []) if part != "body")
        fields[location or "body"] = error.get("msg", "Invalid value.")
    return JSONResponse(
        status_code=422,
        content={"error": "validation_error", "detail": "Invalid request.", "fields": fields},
    )


@backend_api.exception_handler(Exception)
async def unhandled_error(_request: Request, exc: Exception):
    correlation_id = uuid.uuid4().hex[:12]
    logger.exception("Unhandled admin API error [%s]", correlation_id)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "detail": "Something went wrong.",
            "correlation_id": correlation_id,
        },
    )


@backend_api.get("/api/backend", include_in_schema=False)
def health():
    return {"status": "ok"}


backend_api.include_router(routes_admin_csv.router, prefix="/api/v1")
app = backend_api
