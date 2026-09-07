"""Twinlab public shop pages use /shop/{slug}/ (not /product/)."""
from __future__ import annotations

import re

from app.catalog.adapters.base import BrandAdapter

_TWIN = re.compile(r"/shop/(?!page/|feed/)[a-z0-9][^/?#]*/?$", re.I)


class TwinlabAdapter(BrandAdapter):
    slug = "twinlab"
    product_url_re = _TWIN
    max_pages = 2

    def _page_url(self, start: str, page: int) -> str:
        return "https://twinlab.com/shop/page/{}/".format(page)
