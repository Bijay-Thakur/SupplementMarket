"""Reject private, local, and non-HTTPS image URLs before download."""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

import httpx

BLOCKED_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "metadata.google.internal",
}

MAX_IMAGE_BYTES = 5_000_000


def image_url_allowed(url: str) -> tuple[bool, str | None]:
    raw = (url or "").strip()
    if not raw:
        return False, "Image URL is empty."
    parsed = urlparse(raw)
    if parsed.scheme in {"data", "file", "ftp", "http"}:
        return False, "Only HTTPS image URLs are accepted."
    if parsed.scheme != "https":
        return False, "Only HTTPS image URLs are accepted."
    host = (parsed.hostname or "").lower()
    if not host or host in BLOCKED_HOSTS or host.endswith(".local"):
        return False, "Image host is not allowed."
    if host == "169.254.169.254" or host.startswith("169.254."):
        return False, "Image host is not allowed."
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False, "Image host is not allowed."
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except OSError:
        return False, "Image host could not be resolved."
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            return False, "Image host resolves to a private network."
    return True, None


def sniff_image(content: bytes, declared_type: str | None = None) -> tuple[str, str] | None:
    if not content or len(content) > MAX_IMAGE_BYTES:
        return None
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp", "webp"
    if b"ftyp" in content[:32] and (b"avif" in content[:32] or b"avis" in content[:32]):
        return "image/avif", "avif"
    _ = declared_type
    return None


def download_product_image(url: str) -> tuple[bytes, str, str] | None:
    ok, _reason = image_url_allowed(url)
    if not ok:
        return None
    try:
        response = httpx.get(
            url,
            timeout=httpx.Timeout(12.0, connect=5.0),
            follow_redirects=False,
            headers={"User-Agent": "BronxvilleNaturalMarket-CatalogImport/1.0"},
        )
    except httpx.HTTPError:
        return None
    if response.status_code != 200:
        return None
    if len(response.content) > MAX_IMAGE_BYTES:
        return None
    sniffed = sniff_image(response.content, response.headers.get("content-type"))
    if not sniffed:
        return None
    mime, ext = sniffed
    return response.content, mime, ext
