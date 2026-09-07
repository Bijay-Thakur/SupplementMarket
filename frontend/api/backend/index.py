"""Minimal Vercel entrypoint for the authenticated Supabase admin API.

Production intentionally mounts only the Supabase-backed routes that
independently re-check the caller's JWT and administrator role. Local SQLite,
seed/reset, collector, and local-file routes are not deployed.
"""
from __future__ import annotations

import logging
import sys
import uuid
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

_BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.api import routes_admin_csv  # noqa: E402
from app.core.errors import AppError  # noqa: E402

logger = logging.getLogger("bnm.vercel")

backend_api = FastAPI(
    title="Bronxville Natural Market Admin API",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@backend_api.middleware("http")
async def security_headers(request: Request, call_next):
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


@backend_api.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}


backend_api.include_router(routes_admin_csv.router, prefix="/api/v1")

# Nested Python functions receive the full /api/backend/* path.
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/api/backend", backend_api)
