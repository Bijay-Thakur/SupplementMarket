"""JSON-LD, embedded product JSON, and semantic HTML extraction."""
from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from app.catalog.types import ImageCandidate, ParsedProduct

_PRODUCT_TYPES = {"product", "http://schema.org/product", "https://schema.org/product"}


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _type_name(node: Any) -> str:
    if not isinstance(node, dict):
        return ""
    t = node.get("@type") or node.get("type") or ""
    if isinstance(t, list):
        t = t[0] if t else ""
    return str(t).lower()


def walk_jsonld(data: Any) -> list[dict]:
    found: list[dict] = []

    def _walk(node: Any) -> None:
        if isinstance(node, list):
            for item in node:
                _walk(item)
            return
        if not isinstance(node, dict):
            return
        if _type_name(node) in _PRODUCT_TYPES:
            found.append(node)
        if "@graph" in node:
            _walk(node["@graph"])
        for v in node.values():
            if isinstance(v, (dict, list)):
                _walk(v)

    _walk(data)
    return found


def parse_jsonld_scripts(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    products: list[dict] = []
    for script in soup.find_all("script"):
        t = (script.get("type") or "").lower()
        if "ld+json" not in t:
            continue
        raw = script.string or script.get_text() or ""
        raw = raw.strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        products.extend(walk_jsonld(data))
    return products


def parse_embedded_product_json(html: str) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.find_all("script"):
        t = (script.get("type") or "").lower()
        ident = (script.get("id") or "") + " " + (script.get("class") and " ".join(script.get("class")) or "")
        if "json" not in t and "ProductJson" not in ident and "product-json" not in ident.lower():
            continue
        raw = (script.string or script.get_text() or "").strip()
        if not raw or not raw.startswith("{") and not raw.startswith("["):
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and (data.get("title") or data.get("name")) and (
            data.get("variants") or data.get("sku") or data.get("url")
        ):
            return data
    return None


def _text(val: Any) -> str | None:
    if val is None:
        return None
    if isinstance(val, dict):
        return _text(val.get("name") or val.get("@value") or val.get("value"))
    if isinstance(val, list):
        return _text(val[0]) if val else None
    s = str(val).strip()
    return s or None


def _price_to_cents(val: Any) -> int | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return int(round(float(val) * 100)) if float(val) < 10000 else int(val)
    s = str(val).replace("$", "").replace(",", "").strip()
    try:
        return int(round(float(s) * 100))
    except ValueError:
        return None


def _images(node: dict, base_url: str) -> list[ImageCandidate]:
    out: list[ImageCandidate] = []
    for img in _as_list(node.get("image")):
        url = None
        alt = None
        if isinstance(img, str):
            url = img
        elif isinstance(img, dict):
            url = img.get("url") or img.get("contentUrl")
            alt = _text(img.get("caption") or img.get("name"))
        if url:
            out.append(ImageCandidate(url=urljoin(base_url, url), alt_text=alt, is_primary=not out))
    return out


def parsed_from_jsonld(node: dict, *, page_url: str, brand: str, parent_brand: str | None) -> ParsedProduct:
    offers = node.get("offers")
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    if not isinstance(offers, dict):
        offers = {}
    sku = _text(node.get("sku") or node.get("mpn"))
    upc = _text(node.get("gtin") or node.get("gtin12") or node.get("gtin13") or node.get("gtin14") or node.get("productID"))
    brand_node = node.get("brand")
    brand_name = _text(brand_node) or brand
    avail = _text(offers.get("availability")) or ""
    price = _price_to_cents(offers.get("price") or node.get("price"))
    currency = _text(offers.get("priceCurrency")) or "USD"
    url = _text(node.get("url") or offers.get("url")) or page_url
    name = _text(node.get("name")) or "Untitled product"
    return ParsedProduct(
        brand=brand_name,
        parent_brand=parent_brand,
        product_line=None,
        name=name,
        sku=sku,
        upc=upc,
        canonical_url=urljoin(page_url, url),
        source_price_cents=price,
        source_price_currency=currency,
        source_availability=avail.split("/")[-1] if avail else None,
        images=_images(node, page_url),
        extraction_method="jsonld",
        raw_source_attrs={"jsonld_keys": sorted(node.keys())[:40]},
    )


def parsed_from_shopify_json(data: dict, *, page_url: str, brand: str, parent_brand: str | None) -> ParsedProduct:
    variants = data.get("variants") or []
    v0 = variants[0] if variants else {}
    images = []
    for i, img in enumerate(data.get("images") or []):
        src = img if isinstance(img, str) else (img.get("src") if isinstance(img, dict) else None)
        if src:
            images.append(ImageCandidate(url=urljoin(page_url, src), is_primary=i == 0))
    price = None
    if v0.get("price") is not None:
        price = _price_to_cents(v0.get("price"))
    return ParsedProduct(
        brand=brand,
        parent_brand=parent_brand,
        product_line=None,
        name=_text(data.get("title") or data.get("name")) or "Untitled product",
        sku=_text(v0.get("sku")),
        upc=_text(v0.get("barcode")),
        variant_name=_text(v0.get("title")) if v0.get("title") not in (None, "Default Title") else None,
        canonical_url=urljoin(page_url, _text(data.get("url")) or page_url),
        source_price_cents=price,
        source_price_currency="USD",
        images=images,
        extraction_method="embedded_json",
        raw_source_attrs={"shopify_handle": data.get("handle")},
        variants=[{"sku": v.get("sku"), "title": v.get("title")} for v in variants[:6] if isinstance(v, dict)],
    )


def parsed_from_semantic_html(html: str, *, page_url: str, brand: str, parent_brand: str | None) -> ParsedProduct | None:
    soup = BeautifulSoup(html, "html.parser")
    og_title = soup.find("meta", property="og:title")
    og_image = soup.find("meta", property="og:image")
    og_url = soup.find("meta", property="og:url")
    name = (og_title.get("content") if og_title else None) or (soup.title.string if soup.title else None)
    if not name:
        h1 = soup.find("h1")
        name = h1.get_text(" ", strip=True) if h1 else None
    if not name:
        return None
    images = []
    if og_image and og_image.get("content"):
        images.append(ImageCandidate(url=urljoin(page_url, og_image["content"]), is_primary=True))
    sku_el = soup.find(attrs={"itemprop": "sku"})
    price_el = soup.find(attrs={"itemprop": "price"}) or soup.find("meta", property="product:price:amount")
    return ParsedProduct(
        brand=brand,
        parent_brand=parent_brand,
        product_line=None,
        name=str(name).strip(),
        sku=sku_el.get_text(" ", strip=True) if sku_el else None,
        canonical_url=urljoin(page_url, og_url["content"]) if og_url and og_url.get("content") else page_url,
        source_price_cents=_price_to_cents(price_el.get("content") if price_el and price_el.get("content") else (price_el.get_text() if price_el else None)),
        images=images,
        extraction_method="semantic_html",
        raw_source_attrs={"og_title": True},
    )


_HREF_PRODUCT = re.compile(r"/products/[^/?#]+", re.I)
_HREF_WOO = re.compile(r"/product/[^/?#]+", re.I)


def extract_hrefs(html: str, pattern: re.Pattern[str], base_url: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    urls: list[str] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].split("?")[0].split("#")[0]
        if not pattern.search(href):
            continue
        full = urljoin(base_url, href)
        if full not in seen:
            seen.add(full)
            urls.append(full)
    return urls


def listing_badges(anchor_text: str, nearby: str) -> list[str]:
    blob = f"{anchor_text} {nearby}".lower()
    badges = []
    if "best seller" in blob or "bestseller" in blob or "best-seller" in blob:
        badges.append("bestseller")
    if "featured" in blob or "popular" in blob:
        badges.append("featured")
    if re.search(r"\bnew\b", blob):
        badges.append("new")
    return badges


def canonical_from_html(html: str, page_url: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    link = soup.find("link", rel="canonical")
    if link and link.get("href"):
        return urljoin(page_url, link["href"].split("?")[0])
    return page_url.split("?")[0]


def dietary_from_text(*parts: str | None) -> dict[str, bool]:
    blob = " ".join(p or "" for p in parts).lower()
    return {
        "vegan": "vegan" in blob,
        "vegetarian": "vegetarian" in blob,
        "organic": bool(re.search(r"\borganic\b", blob)),
        "non_gmo": "non-gmo" in blob or "non gmo" in blob or "nongmo" in blob,
        "gluten_free": "gluten-free" in blob or "gluten free" in blob,
        "soy_free": "soy-free" in blob or "soy free" in blob,
        "dairy_free": "dairy-free" in blob or "dairy free" in blob,
        "sugar_free": "sugar-free" in blob or "sugar free" in blob,
        "alcohol_free": "alcohol-free" in blob or "alcohol free" in blob,
        "kosher": "kosher" in blob,
        "halal": "halal" in blob,
    }
