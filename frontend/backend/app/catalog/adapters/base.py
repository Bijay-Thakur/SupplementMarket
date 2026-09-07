"""Shared brand adapter contract."""
from __future__ import annotations

import hashlib
import re
from abc import ABC
from typing import TYPE_CHECKING
from urllib.parse import urljoin, urlparse

from app.catalog.classify import enrich, is_foundational
from app.catalog.description import short_description
from app.catalog.extract import (
    _HREF_PRODUCT,
    canonical_from_html,
    dietary_from_text,
    extract_hrefs,
    listing_badges,
    parse_embedded_product_json,
    parse_jsonld_scripts,
    parsed_from_jsonld,
    parsed_from_semantic_html,
    parsed_from_shopify_json,
)
from app.catalog.http import FetchError, RobotsBlocked
from app.catalog.sources import PARSER_VERSION, source_by_slug
from app.catalog.types import DiscoveredProduct, ImageCandidate, ParsedProduct
from app.catalog.validate import validate_product as shared_validate

if TYPE_CHECKING:
    from app.catalog.http import PoliteFetcher


class BrandAdapter(ABC):
    slug: str
    product_url_re: re.Pattern[str] = _HREF_PRODUCT
    max_pages: int = 3
    is_food: bool = False

    @property
    def source(self):
        return source_by_slug(self.slug)

    def start_urls(self) -> list[str]:
        return [self.source.collection_url]

    def discover_product_urls(self, fetcher: PoliteFetcher) -> list[DiscoveredProduct]:
        found: list[DiscoveredProduct] = []
        seen: set[str] = set()
        for start in self.start_urls():
            for page in range(1, self.max_pages + 1):
                url = start if page == 1 else self._page_url(start, page)
                try:
                    result = fetcher.get(url)
                except FetchError as e:
                    if e.status in (401, 403):
                        raise RobotsBlocked(url, "http_blocked") from e
                    break
                except RobotsBlocked:
                    raise
                except Exception:
                    break
                hrefs = extract_hrefs(result.text, self.product_url_re, result.final_url)
                new = 0
                for href in hrefs:
                    canon = href.split("?")[0]
                    if canon in seen:
                        continue
                    seen.add(canon)
                    new += 1
                    found.append(DiscoveredProduct(url=canon))
                self._annotate_listing(result.text, result.final_url, found)
                if new == 0:
                    break
        return found

    def _page_url(self, start: str, page: int) -> str:
        sep = "&" if "?" in start else "?"
        return f"{start}{sep}page={page}"

    def _annotate_listing(self, html: str, base: str, found: list[DiscoveredProduct]) -> None:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        by_url = {d.url: d for d in found}
        for a in soup.find_all("a", href=True):
            href = urljoin(base, a["href"].split("?")[0])
            item = by_url.get(href)
            if not item:
                continue
            text = a.get_text(" ", strip=True)
            parent = a.parent.get_text(" ", strip=True)[:400] if a.parent else ""
            if text and not item.title:
                item.title = text[:200]
            item.badges = list(dict.fromkeys(item.badges + listing_badges(text, parent)))
            img = a.find("img")
            if img and (img.get("src") or img.get("data-src")) and not item.listing_image_url:
                item.listing_image_url = urljoin(base, img.get("src") or img.get("data-src"))

    def parse_product(self, fetcher: PoliteFetcher, url: str) -> ParsedProduct:
        result = fetcher.get(url)
        html = result.text
        src = self.source
        brand = src.name
        parent = src.parent_brand
        method = "css"
        parsed: ParsedProduct | None = None
        nodes = parse_jsonld_scripts(html)
        if nodes:
            parsed = parsed_from_jsonld(nodes[0], page_url=result.final_url, brand=brand, parent_brand=parent)
            method = "jsonld"
        if parsed is None:
            embedded = parse_embedded_product_json(html)
            if embedded:
                parsed = parsed_from_shopify_json(
                    embedded, page_url=result.final_url, brand=brand, parent_brand=parent
                )
                method = "embedded_json"
        if parsed is None:
            parsed = parsed_from_semantic_html(
                html, page_url=result.final_url, brand=brand, parent_brand=parent
            )
            method = "semantic_html"
        if parsed is None:
            parsed = ParsedProduct(
                brand=brand,
                parent_brand=parent,
                product_line=src.product_line,
                name="Untitled product",
                canonical_url=result.final_url,
                extraction_method="css",
            )
        parsed = self.enrich_with_selectors(html, parsed)
        parsed.brand = src.name
        parsed.parent_brand = src.parent_brand
        parsed.product_line = src.product_line
        parsed.name = parsed.name.replace("\ufffd", "").strip()[:240]
        parsed.source_domain = urlparse(src.official_url).netloc
        parsed.source_collection_url = src.collection_url
        parsed.canonical_url = canonical_from_html(html, result.final_url)
        parsed.extraction_method = method
        parsed.parser_version = PARSER_VERSION
        parsed.source_content_hash = hashlib.sha256(result.body).hexdigest()
        dietary = dietary_from_text(html[:15000], parsed.name)
        for k, v in dietary.items():
            if v:
                setattr(parsed, k, True)
        parsed = enrich(parsed, is_food=self.is_food)
        parsed.short_description = short_description(parsed)
        parsed = self.after_parse(parsed, html)
        return parsed

    def enrich_with_selectors(self, html: str, parsed: ParsedProduct) -> ParsedProduct:
        return parsed

    def after_parse(self, parsed: ParsedProduct, html: str) -> ParsedProduct:
        return parsed

    def select_candidate_products(
        self,
        discovered: list[DiscoveredProduct],
        limit: int,
        prioritize: list[str] | None = None,
    ) -> list[DiscoveredProduct]:
        prioritize = [p.lower() for p in (prioritize or [])]
        scored: list[tuple[int, int, DiscoveredProduct]] = []
        for i, d in enumerate(discovered):
            score = 0
            title = (d.title or d.url).lower()
            if "bestseller" in d.badges:
                score += 100
            if "featured" in d.badges:
                score += 80
            if "new" in d.badges:
                score += 20
            if is_foundational(title):
                score += 40
            if d.listing_image_url:
                score += 10
            if any(p in title for p in prioritize):
                score += 30
            if self.is_food:
                score += 5
            scored.append((score, -i, d))
        scored.sort(reverse=True)
        selected: list[DiscoveredProduct] = []
        used_cats: set[str] = set()
        from app.catalog.classify import classify_name

        for score, _, d in scored:
            if len(selected) >= limit:
                break
            cat, form, *_ = classify_name(d.title or "", is_food=self.is_food)
            # Prefer mix of categories but do not invent products.
            if cat in used_cats and len(selected) < limit - 1 and score < 80:
                continue
            selected.append(d)
            used_cats.add(cat)
        if len(selected) < limit:
            for _, _, d in scored:
                if d not in selected:
                    selected.append(d)
                if len(selected) >= limit:
                    break
        return selected[:limit]

    def validate_product(self, parsed: ParsedProduct) -> list[str]:
        return shared_validate(parsed)

    def collect_image_candidates(self, parsed: ParsedProduct) -> list[ImageCandidate]:
        return [img for img in parsed.images if img.url.startswith("http")]
