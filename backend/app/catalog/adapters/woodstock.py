"""Woodstock Foods — natural foods catalog. Never classified as supplements."""
from __future__ import annotations

import re

from app.catalog.adapters.base import BrandAdapter
from app.catalog.types import ParsedProduct

_WOOD = re.compile(r"/the-goods/product\.[^/?#]+", re.I)


class WoodstockAdapter(BrandAdapter):
    slug = "woodstock-foods"
    product_url_re = _WOOD
    is_food = True
    max_pages = 1

    def after_parse(self, parsed: ParsedProduct, html: str) -> ParsedProduct:
        parsed.primary_category = "Natural Foods"
        parsed.form = parsed.form or "other"
        if parsed.name.lower() in {"woodstockfoods", "home", "the goods"}:
            slug = parsed.canonical_url.rsplit("/", 1)[-1]
            parsed.name = slug.replace("product.", "").replace("-", " ").split(" 042")[0].title()[:240]
        return parsed
