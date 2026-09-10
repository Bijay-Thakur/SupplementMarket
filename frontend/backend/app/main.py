"""FastAPI application factory for the local Phase 2 demo."""
from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select

from app.api import (
    routes_admin_products,
    routes_catalog,
    routes_catalog_imports,
    routes_dev,
    routes_images,
    routes_imports,
    routes_orders,
    routes_products,
    routes_promotions,
    routes_store,
)
from app.core.config import settings
from app.core.errors import AppError
from app.db.base import Base, SessionLocal, engine

logger = logging.getLogger("bnm")


def _ensure_schema_and_demo() -> None:
    """Create tables if missing and seed demo data when the catalog is empty.

    Alembic remains the source of truth for schema evolution; create_all is a
    convenience so `uvicorn` works on a clean checkout without a separate
    migrate step. Seed only inserts demonstration rows.
    """
    Base.metadata.create_all(bind=engine)
    from app.db.schema_patch import patch_sqlite

    patch_sqlite(engine)
    if not settings.is_development or not settings.seed_demo_data:
        return
    db = SessionLocal()
    try:
        from app.models import Product
        from app.seed.demo import seed_demo

        n = db.execute(select(func.count()).select_from(Product)).scalar_one()
        if n == 0:
            seed_demo(db, reset=False)
            logger.info("Empty catalog detected — demonstration data seeded.")
        from app.catalog.pipeline import ensure_sources

        ensure_sources(db)
    except Exception:
        logger.exception("Demo seed on startup failed.")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    storage = Path(settings.storage_dir)
    storage.mkdir(parents=True, exist_ok=True)
    Path(settings.catalog_imports_dir).mkdir(parents=True, exist_ok=True)
    _ensure_schema_and_demo()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        description=(
            "Local backend. Live catalog-admin routes require a verified Supabase "
            "administrator JWT. SQLite demo seed/reset remain development-only."
        ),
    )

    # Narrow CORS to the configured frontend origin (no wildcard-with-credentials).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    storage = Path(settings.storage_dir)
    storage.mkdir(parents=True, exist_ok=True)
    app.mount("/media/products", StaticFiles(directory=str(storage)), name="media")

    @app.exception_handler(AppError)
    async def _app_error(_request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.code, "detail": exc.message, "fields": exc.fields},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_request: Request, exc: RequestValidationError):
        fields = {}
        for err in exc.errors():
            loc = ".".join(str(p) for p in err.get("loc", []) if p not in ("body",))
            fields[loc or "body"] = err.get("msg", "Invalid value.")
        return JSONResponse(
            status_code=422,
            content={"error": "validation_error", "detail": "Invalid request.", "fields": fields},
        )

    @app.exception_handler(Exception)
    async def _unhandled(_request: Request, exc: Exception):
        correlation_id = uuid.uuid4().hex[:12]
        logger.exception("Unhandled error [%s]", correlation_id)
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_error",
                "detail": "Something went wrong.",
                "correlation_id": correlation_id,
            },
        )

    @app.get("/health", tags=["health"])
    def health():
        return {"status": "ok", "environment": settings.environment}

    v1 = settings.api_v1_prefix
    app.include_router(routes_products.router, prefix=v1)
    app.include_router(routes_catalog.public, prefix=v1)
    app.include_router(routes_images.router, prefix=v1)
    app.include_router(routes_orders.public, prefix=v1)
    app.include_router(routes_store.router, prefix=v1)
    app.include_router(routes_promotions.public, prefix=v1)

    # Dev-only surfaces (SQLite demo admin/seed/reset, no real auth) are only
    # gated by the `require_dev` dependency, which fails open if the deploy
    # forgets to set ENVIRONMENT/APP_ENV. As defense in depth, don't even
    # mount these routers unless the backend is explicitly running in dev.
    if settings.is_development:
        app.include_router(routes_catalog.admin, prefix=v1)
        app.include_router(routes_admin_products.router, prefix=v1)
        app.include_router(routes_imports.router, prefix=v1)
        app.include_router(routes_catalog_imports.sources_router, prefix=v1)
        app.include_router(routes_catalog_imports.imports_router, prefix=v1)
        app.include_router(routes_orders.admin, prefix=v1)
        app.include_router(routes_promotions.admin, prefix=v1)
        app.include_router(routes_dev.router, prefix=v1)

    from app.api import routes_admin_csv

    app.include_router(routes_admin_csv.router, prefix=v1)
    return app


app = create_app()
