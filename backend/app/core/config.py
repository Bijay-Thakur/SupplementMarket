"""Environment-based configuration for the local demo backend."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # "development" | "production". Dev-only features (seed/reset, demo admin)
    # are hard-disabled when this is not "development".
    environment: str = "development"

    api_v1_prefix: str = "/api/v1"
    app_name: str = "Bronxville Natural Market API (Demo)"

    # Narrow CORS: only the configured frontend origin is allowed. Never use a
    # wildcard together with credentials.
    frontend_origin: str = "http://localhost:3000"

    # SQLite for the local demo. The repository/service layers keep this
    # swappable for Supabase Postgres in a later phase.
    database_url: str = "sqlite:///./bnm_demo.db"

    # Local product-image storage (served by FastAPI in dev only).
    storage_dir: str = "storage/products"
    catalog_imports_dir: str = "storage/catalog-imports"
    max_upload_bytes: int = 5_000_000  # 5 MB
    max_catalog_page_bytes: int = 2_000_000
    catalog_request_timeout_seconds: float = 25.0
    catalog_request_delay_seconds: float = 1.5
    catalog_max_retries: int = 3
    allowed_image_mime: tuple[str, ...] = (
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
    )

    # Descriptive collector identity. Do not invent a contact address.
    catalog_collector_user_agent: str = (
        "BronxvilleNaturalMarket-CatalogCollector/1.0 "
        "(local demo catalog review; +https://localhost)"
    )
    catalog_collector_contact_email: str = ""

    # Simple in-process rate limits (requests per window seconds) for hot paths.
    rate_limit_window_seconds: int = 60
    rate_limit_search: int = 120
    rate_limit_order: int = 20
    rate_limit_upload: int = 40

    # Max request body size guard (bytes) for JSON endpoints.
    max_json_body_bytes: int = 1_000_000

    @property
    def is_development(self) -> bool:
        return self.environment.lower() == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
