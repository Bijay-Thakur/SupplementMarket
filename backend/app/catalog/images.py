"""Download, validate, hash, and optimize manufacturer product images."""
from __future__ import annotations

import hashlib
import io
import logging
from dataclasses import dataclass
from pathlib import Path

from app.catalog.http import FetchError, PoliteFetcher, RobotsBlocked
from app.core.config import settings
from app.core.utils import slugify

logger = logging.getLogger("bnm.catalog")

_SIGNATURES = [
    (b"\xff\xd8\xff", "jpg", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "png", "image/png"),
]


@dataclass
class StoredImage:
    original_path: str
    optimized_rel: str
    sha256: str
    mime_type: str
    size_bytes: int
    width: int | None
    height: int | None
    duplicate: bool = False


def detect_image(content: bytes) -> tuple[str, str]:
    if content.lstrip().startswith((b"<", b"<!")):
        raise ValueError("HTML error page saved as image.")
    for sig, ext, mime in _SIGNATURES:
        if content.startswith(sig):
            return ext, mime
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "webp", "image/webp"
    if content[4:8] == b"ftyp" and b"avif" in content[8:20]:
        return "avif", "image/avif"
    raise ValueError("Unsupported image type.")


def descriptive_stem(brand_slug: str, name: str, form: str | None, count: int | None) -> str:
    parts = [brand_slug, slugify(name)]
    if form:
        parts.append(form)
    if count:
        parts.append(f"{count}")
    parts.append("front")
    stem = "-".join(p for p in parts if p)
    return stem[:80].strip("-")


def save_and_optimize(
    content: bytes,
    *,
    brand_slug: str,
    run_id: str,
    name: str,
    form: str | None,
    count: int | None,
    seen_hashes: dict[str, StoredImage],
) -> StoredImage:
    if len(content) > settings.max_upload_bytes:
        raise ValueError("Image exceeds size limit.")
    ext, mime = detect_image(content)
    digest = hashlib.sha256(content).hexdigest()
    if digest in seen_hashes:
        dup = seen_hashes[digest]
        return StoredImage(
            original_path=dup.original_path,
            optimized_rel=dup.optimized_rel,
            sha256=digest,
            mime_type=dup.mime_type,
            size_bytes=dup.size_bytes,
            width=dup.width,
            height=dup.height,
            duplicate=True,
        )

    stem = descriptive_stem(brand_slug, name, form, count)
    originals = Path(settings.catalog_imports_dir) / brand_slug / run_id / "originals"
    originals.mkdir(parents=True, exist_ok=True)
    original = originals / f"{stem}.{ext}"
    original.write_bytes(content)

    optimized_dir = Path(settings.storage_dir) / brand_slug / "optimized"
    optimized_dir.mkdir(parents=True, exist_ok=True)
    rel = f"{brand_slug}/optimized/{stem}.webp"
    dest = Path(settings.storage_dir) / rel
    width = height = None
    try:
        from PIL import Image

        im = Image.open(io.BytesIO(content))
        im = im.convert("RGB") if im.mode in ("P", "RGBA", "LA") else im
        width, height = im.size
        longest = max(width, height)
        if longest > 1600:
            scale = 1600 / longest
            im = im.resize((int(width * scale), int(height * scale)))
            width, height = im.size
        im.save(dest, "WEBP", quality=85, method=6)
    except Exception:
        logger.exception("WebP optimize failed; storing original bytes is not used as storefront asset.")
        dest.write_bytes(content)

    stored = StoredImage(
        original_path=str(original).replace("\\", "/"),
        optimized_rel=rel.replace("\\", "/"),
        sha256=digest,
        mime_type="image/webp",
        size_bytes=dest.stat().st_size if dest.exists() else len(content),
        width=width,
        height=height,
    )
    seen_hashes[digest] = stored
    return stored


def download_image(fetcher: PoliteFetcher, url: str) -> bytes:
    result = fetcher.get(url, max_bytes=settings.max_upload_bytes)
    ctype = result.content_type.lower()
    if "html" in ctype or "json" in ctype or "text/" in ctype:
        raise FetchError("Image URL did not return an image.")
    return result.body


def try_store_image(
    fetcher: PoliteFetcher,
    url: str,
    *,
    brand_slug: str,
    run_id: str,
    name: str,
    form: str | None,
    count: int | None,
    seen_hashes: dict[str, StoredImage],
) -> StoredImage | None:
    try:
        content = download_image(fetcher, url)
        return save_and_optimize(
            content,
            brand_slug=brand_slug,
            run_id=run_id,
            name=name,
            form=form,
            count=count,
            seen_hashes=seen_hashes,
        )
    except (FetchError, RobotsBlocked, ValueError) as e:
        logger.info("image skipped %s: %s", url, e)
        return None
