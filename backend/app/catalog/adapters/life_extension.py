"""Life Extension — public product HTML under /vitamins-supplements/."""
from __future__ import annotations

import re

from app.catalog.adapters.base import BrandAdapter

_LE = re.compile(r"/vitamins-supplements/(?!products-a-to-z)[^/?#]+", re.I)


class LifeExtensionAdapter(BrandAdapter):
    slug = "life-extension"
    product_url_re = _LE
    max_pages = 2
