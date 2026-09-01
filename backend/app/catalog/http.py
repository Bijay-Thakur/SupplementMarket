"""Polite HTTP client: 1 connection per domain, delay, retries, cache, size limits."""
from __future__ import annotations

import hashlib
import logging
import random
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

import httpx

from app.catalog.robots import RobotsCache, origin_of
from app.core.config import settings
from app.core.utils import utcnow

logger = logging.getLogger("bnm.catalog")


class FetchError(Exception):
    def __init__(self, message: str, *, status: int | None = None, retryable: bool = False):
        super().__init__(message)
        self.status = status
        self.retryable = retryable


class RobotsBlocked(FetchError):
    def __init__(self, url: str, reason: str):
        super().__init__(f"Blocked by robots.txt ({reason}): {url}", status=None, retryable=False)
        self.reason = reason


@dataclass
class FetchResult:
    url: str
    final_url: str
    status: int
    body: bytes
    content_type: str
    from_cache: bool = False

    @property
    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")


@dataclass
class FetchStats:
    pages_requested: int = 0
    cache_hits: int = 0
    retries: int = 0
    http_status: dict[str, int] = field(default_factory=dict)
    robots_blocked: int = 0

    def bump_status(self, code: int) -> None:
        key = str(code)
        self.http_status[key] = self.http_status.get(key, 0) + 1


def build_user_agent() -> str:
    base = settings.catalog_collector_user_agent.strip()
    email = (settings.catalog_collector_contact_email or "").strip()
    if email:
        return f"{base} (contact: {email})"
    return base


class PoliteFetcher:
    def __init__(
        self,
        *,
        cache_dir: Path | None = None,
        delay_seconds: float | None = None,
        timeout: float | None = None,
        max_bytes: int | None = None,
        user_agent: str | None = None,
        live: bool = True,
    ) -> None:
        self.cache_dir = cache_dir
        self.delay = delay_seconds if delay_seconds is not None else settings.catalog_request_delay_seconds
        self.timeout = timeout if timeout is not None else settings.catalog_request_timeout_seconds
        self.max_bytes = max_bytes if max_bytes is not None else settings.max_catalog_page_bytes
        self.user_agent = user_agent or build_user_agent()
        self.live = live
        self.robots = RobotsCache()
        self.stats = FetchStats()
        self._last_request: dict[str, float] = {}
        self._client: httpx.Client | None = None

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    def __enter__(self) -> PoliteFetcher:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def _client_obj(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(
                headers={"User-Agent": self.user_agent, "Accept": "text/html,application/json;q=0.9,*/*;q=0.8"},
                follow_redirects=True,
                timeout=httpx.Timeout(self.timeout),
            )
        return self._client

    def _cache_path(self, url: str) -> Path | None:
        if not self.cache_dir:
            return None
        h = hashlib.sha256(url.encode("utf-8")).hexdigest()
        return self.cache_dir / f"{h}.bin"

    def _sleep_for(self, host: str, extra_delay: float | None = None) -> None:
        wait = max(self.delay, extra_delay or 0)
        last = self._last_request.get(host, 0)
        elapsed = time.monotonic() - last
        if elapsed < wait:
            time.sleep(wait - elapsed)

    def ensure_robots(self, url: str) -> None:
        origin = origin_of(url)
        if self.robots.decision_for(origin) is not None:
            return
        robots_url = origin.rstrip("/") + "/robots.txt"
        status = None
        body = None
        if not self.live:
            self.robots.load(origin, "User-agent: *\nAllow: /\n", 200)
            return
        try:
            r = self._client_obj().get(robots_url)
            status = r.status_code
            if r.status_code == 200:
                body = r.text
            self.stats.bump_status(r.status_code)
        except httpx.HTTPError as e:
            logger.warning("robots.txt fetch failed for %s: %s", origin, e)
        self.robots.load(origin, body, status)

    def get(self, url: str, *, max_bytes: int | None = None) -> FetchResult:
        self.ensure_robots(url)
        allowed, reason = self.robots.can_fetch(self.user_agent, url)
        if not allowed:
            self.stats.robots_blocked += 1
            raise RobotsBlocked(url, reason)

        cache_path = self._cache_path(url)
        if cache_path and cache_path.exists():
            raw = cache_path.read_bytes()
            # cache format: first line content-type, then \n, then body
            nl = raw.find(b"\n")
            ctype = raw[:nl].decode("ascii", errors="replace") if nl >= 0 else "application/octet-stream"
            body = raw[nl + 1 :] if nl >= 0 else raw
            self.stats.cache_hits += 1
            return FetchResult(url=url, final_url=url, status=200, body=body, content_type=ctype, from_cache=True)

        if not self.live:
            raise FetchError(f"No fixture for {url}", retryable=False)

        host = urlparse(url).netloc
        decision = self.robots.decision_for(origin_of(url))
        extra = decision.crawl_delay if decision else None
        limit = max_bytes or self.max_bytes
        last_error: FetchError | None = None
        for attempt in range(settings.catalog_max_retries + 1):
            self._sleep_for(host, extra)
            self._last_request[host] = time.monotonic()
            self.stats.pages_requested += 1
            try:
                r = self._client_obj().get(url)
            except httpx.HTTPError as e:
                last_error = FetchError(str(e), retryable=True)
                self._backoff(attempt)
                continue
            self.stats.bump_status(r.status_code)
            if r.status_code in (429,) or r.status_code >= 500:
                last_error = FetchError(
                    f"HTTP {r.status_code} for {url}", status=r.status_code, retryable=True
                )
                self.stats.retries += 1
                self._backoff(attempt)
                continue
            if r.status_code >= 400:
                raise FetchError(f"HTTP {r.status_code} for {url}", status=r.status_code)
            body = r.content[: limit + 1]
            if len(body) > limit:
                raise FetchError(f"Response too large for {url}")
            ctype = r.headers.get("content-type", "application/octet-stream").split(";")[0].strip()
            if cache_path:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_bytes(ctype.encode("ascii", errors="replace") + b"\n" + body)
            logger.info(
                "catalog.fetch",
                extra={
                    "url": url,
                    "status": r.status_code,
                    "bytes": len(body),
                    "at": utcnow().isoformat(),
                },
            )
            return FetchResult(
                url=url,
                final_url=str(r.url),
                status=r.status_code,
                body=body,
                content_type=ctype,
            )
        assert last_error is not None
        raise last_error

    def _backoff(self, attempt: int) -> None:
        base = min(20.0, (2**attempt) * self.delay)
        time.sleep(base + random.uniform(0, 0.4))
