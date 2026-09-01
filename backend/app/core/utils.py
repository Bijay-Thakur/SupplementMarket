"""Small pure helpers shared across services."""
from __future__ import annotations

import re
import secrets
import unicodedata
from datetime import datetime, timezone

_slug_re = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = value.lower().strip()
    value = _slug_re.sub("-", value)
    return value.strip("-") or "item"


def public_token() -> str:
    """High-entropy, URL-safe token for guest order lookup (no sequential ids)."""
    return secrets.token_urlsafe(24)


def order_number() -> str:
    """Human-readable, non-sequential order reference, e.g. BNM-7F3K9Q2A."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    suffix = "".join(secrets.choice(alphabet) for _ in range(8))
    return f"BNM-{suffix}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
