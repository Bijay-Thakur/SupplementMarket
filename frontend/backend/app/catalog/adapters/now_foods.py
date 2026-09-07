"""NOW Foods public supplement catalog HTML."""
from __future__ import annotations

import re

from app.catalog.adapters.base import BrandAdapter

_NOW = re.compile(r"/products/[^/?#]+", re.I)


class NowFoodsAdapter(BrandAdapter):
    slug = "now-foods"
    product_url_re = _NOW
    max_pages = 2

    def discover_product_urls(self, fetcher):
        found = super().discover_product_urls(fetcher)
        return [d for d in found if not d.url.rstrip("/").endswith("all-products")]
