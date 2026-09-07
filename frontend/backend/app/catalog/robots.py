"""robots.txt evaluation. Never bypass Disallow or fetch when robots cannot be read."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

logger = logging.getLogger("bnm.catalog")


@dataclass
class RobotsDecision:
    allowed: bool
    status: str  # permitted | restricted | blocked | unclear
    robots_url: str
    crawl_delay: float | None = None
    notes: str = ""


class RobotsCache:
    def __init__(self) -> None:
        self._parsers: dict[str, RobotFileParser | None] = {}
        self._status: dict[str, RobotsDecision] = {}

    def decision_for(self, origin: str) -> RobotsDecision | None:
        return self._status.get(origin)

    def load(self, origin: str, robots_body: str | None, http_status: int | None) -> RobotsDecision:
        robots_url = urljoin(origin.rstrip("/") + "/", "robots.txt")
        if http_status in (401, 403) or robots_body is None and http_status and http_status >= 400:
            decision = RobotsDecision(
                allowed=False,
                status="blocked",
                robots_url=robots_url,
                notes=f"robots.txt HTTP {http_status}; automated collection skipped.",
            )
            self._parsers[origin] = None
            self._status[origin] = decision
            return decision
        if robots_body is None:
            decision = RobotsDecision(
                allowed=False,
                status="unclear",
                robots_url=robots_url,
                notes="robots.txt could not be retrieved.",
            )
            self._parsers[origin] = None
            self._status[origin] = decision
            return decision

        rp = RobotFileParser()
        rp.set_url(robots_url)
        try:
            rp.parse(robots_body.splitlines())
        except Exception:
            logger.exception("Failed to parse robots.txt for %s", origin)
            decision = RobotsDecision(
                allowed=False,
                status="unclear",
                robots_url=robots_url,
                notes="robots.txt parse failed; collection skipped.",
            )
            self._parsers[origin] = None
            self._status[origin] = decision
            return decision

        delay = None
        try:
            delay = rp.crawl_delay("*")
        except Exception:
            delay = None
        self._parsers[origin] = rp
        decision = RobotsDecision(
            allowed=True,
            status="permitted",
            robots_url=robots_url,
            crawl_delay=float(delay) if delay else None,
            notes="robots.txt loaded.",
        )
        self._status[origin] = decision
        return decision

    def can_fetch(self, user_agent: str, url: str) -> tuple[bool, str]:
        origin = _origin(url)
        rp = self._parsers.get(origin)
        if origin in self._status and self._status[origin].status == "blocked":
            return False, "source_blocked"
        if rp is None:
            return False, "robots_unavailable"
        try:
            ok = rp.can_fetch(user_agent, url)
        except Exception:
            return False, "robots_error"
        if not ok:
            return False, "robots_disallow"
        return True, "permitted"


def _origin(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}"


def origin_of(url: str) -> str:
    return _origin(url)
