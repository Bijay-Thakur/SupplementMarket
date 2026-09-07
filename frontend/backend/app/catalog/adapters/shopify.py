from app.catalog.adapters.base import BrandAdapter
from app.catalog.extract import _HREF_PRODUCT


class ShopifyAdapter(BrandAdapter):
    """Public collection/product HTML for Shopify storefronts. No /services or cart.js."""

    product_url_re = _HREF_PRODUCT
    max_pages = 2
