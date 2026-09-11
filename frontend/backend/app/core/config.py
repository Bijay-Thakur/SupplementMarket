"""Environment-based configuration for the local demo backend."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# The backend source is deployed below frontend; real deployment values come
# from Vercel environment variables, while these files are local-only fallbacks.
_FRONTEND_ROOT = Path(__file__).resolve().parents[3]
_REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            _REPO_ROOT / ".env",
            _REPO_ROOT / "backend" / ".env",  # legacy local-only location
            _FRONTEND_ROOT / ".env.local",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # "development" | "production". Dev-only features (seed/reset, demo admin)
    # are hard-disabled unless this is explicitly "development" — default is
    # "production" so a misconfigured deploy (missing env var) fails closed.
    environment: str = "production"

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
    seed_demo_data: bool = False
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

    app_env: str = "production"
    supabase_url: str = ""
    next_public_supabase_url: str = ""
    next_public_supabase_publishable_key: str = ""
    next_public_supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    admin_internal_secret: str = ""
    fastapi_max_csv_bytes: int = 10_000_000

    @property
    def is_development(self) -> bool:
        return self.environment.lower() == "development" and self.app_env.lower() == "development"

    @property
    def supabase_rest_url(self) -> str:
        return (self.supabase_url or self.next_public_supabase_url).rstrip("/")

    @property
    def supabase_publishable_key(self) -> str:
        # Match the browser/server client selection. Projects transitioning to
        # the newer publishable key can temporarily have both values present;
        # a legacy JWT anon key remains valid and avoids the two runtimes using
        # different credentials because one field contains a stale value.
        anon = self.next_public_supabase_anon_key.strip()
        publishable = self.next_public_supabase_publishable_key.strip()
        if anon.startswith("eyJ"):
            return anon
        return publishable or anon

    @property
    def admin_proxy_secret(self) -> str:
        # ADMIN_INTERNAL_SECRET is preferred. The service-role key is already a
        # server-only shared secret and is a safe fallback during deployment.
        return self.admin_internal_secret.strip() or self.supabase_service_role_key.strip()

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_rest_url and self.supabase_service_role_key)

    @property
    def supabase_auth_configured(self) -> bool:
        return bool(self.supabase_rest_url and self.supabase_publishable_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
