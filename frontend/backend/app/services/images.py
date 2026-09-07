"""Local product-image storage with content validation and safe filenames."""
from __future__ import annotations

import secrets
from pathlib import Path

from app.core.config import settings
from app.core.errors import ValidationError

# (magic-byte prefix, extension, mime)
_SIGNATURES = [
    (b"\xff\xd8\xff", "jpg", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "png", "image/png"),
]


def _detect(content: bytes) -> tuple[str, str]:
    for sig, ext, mime in _SIGNATURES:
        if content.startswith(sig):
            return ext, mime
    # WebP: RIFF....WEBP
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "webp", "image/webp"
    raise ValidationError("Unsupported image. Use JPEG, PNG, or WebP.")


def storage_path() -> Path:
    p = Path(settings.storage_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def save_image(content: bytes, declared_mime: str | None) -> tuple[str, str, int]:
    """Validate and persist an uploaded image. Returns (filename, mime, size)."""
    if not content:
        raise ValidationError("Empty file.")
    if len(content) > settings.max_upload_bytes:
        raise ValidationError(
            f"File too large. Max {settings.max_upload_bytes // 1_000_000} MB."
        )

    ext, mime = _detect(content)  # trust content, not the declared type
    if mime not in settings.allowed_image_mime:
        raise ValidationError("Unsupported image type.")

    # Safe, unique, non-guessable filename. Never derive the path from the
    # client-supplied filename (prevents path traversal / overwrite).
    filename = f"{secrets.token_hex(16)}.{ext}"
    dest = storage_path() / filename
    dest.write_bytes(content)
    return filename, mime, len(content)


def delete_image_file(filename: str) -> None:
    # Only operate within the storage dir; ignore anything path-like.
    if "/" in filename or "\\" in filename or ".." in filename:
        return
    target = storage_path() / filename
    if target.exists():
        target.unlink()
