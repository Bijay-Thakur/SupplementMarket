"""Import one brand CSV at a time with exact-UPC dedupe and image enrichment.

Each invocation owns one source file and one import batch. Existing catalog
variants are updated only after an exact UPC match; all other identifier/name
collisions remain blocking. Product images are sourced first from an official
Shopify catalog when possible, then from a barcode-focused image search. Image
bytes are validated and copied to Supabase Storage before the catalog commit.
"""
from __future__ import annotations

import argparse
import csv
import html
import io
import json
import re
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from PIL import Image, ImageDraw, ImageOps


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "frontend" / "backend"))

from app.catalog.classify import classify_name
from app.catalog.csv_images import image_url_allowed, sniff_image
from app.catalog.csv_normalize import slugify
from app.catalog.csv_parse import parse_catalog_csv
from app.services import catalog_import
from app.services import supabase_rest as sb


CSV_FIELDS = [
    "product_full_name",
    "brand",
    "category",
    "sku",
    "supplier_sku",
    "upc",
    "msrp",
    "store_srp",
    "cost_price",
    "availability",
    "size",
    "form",
    "strength",
    "image_url",
]
SEARCH_URL = "https://www.bing.com/images/async"
USER_AGENT = "BronxvilleNaturalMarket-CatalogEnrichment/1.0"
MIN_IMAGE_EDGE = 300
MAX_IMAGE_BYTES = 5_000_000
OUTPUT_ROOT = REPO_ROOT / "outputs" / "brand-catalog-import"


_ORIGINAL_SB_REQUEST = sb.request


def resilient_supabase_request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json: Any = None,
    prefer: str | None = "return=representation",
    timeout: float = 30.0,
) -> Any:
    """Retry only idempotent Supabase requests after transient transport loss."""
    attempts = 5 if method.upper() in {"GET", "PATCH", "DELETE"} else 1
    for attempt in range(attempts):
        try:
            return _ORIGINAL_SB_REQUEST(
                method, path, params=params, json=json, prefer=prefer, timeout=timeout
            )
        except httpx.TransportError:
            if attempt + 1 == attempts:
                raise
            time.sleep(0.5 * (attempt + 1))
    raise RuntimeError("Supabase request retry loop ended unexpectedly.")


sb.request = resilient_supabase_request

_ORIGINAL_EXISTING_MATCHES = catalog_import._existing_matches


def primary_identifier_first_matches(
    row: dict[str, Any],
    indexes: dict[str, dict[Any, dict[str, Any]]],
    default_brand: str | None,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Treat the strongest exact identifier as authoritative after a partial run."""
    upc = row.get("upc")
    packed = indexes["upc"].get(upc) if upc else None
    if packed:
        return [packed], ["UPC"]
    brand_slug = slugify(row.get("brand") or default_brand or "")
    supplier_sku = row.get("supplier_sku")
    packed = indexes["supplier_sku"].get((brand_slug, supplier_sku)) if supplier_sku else None
    if packed:
        return [packed], ["supplier SKU"]
    sku = row.get("sku")
    packed = indexes["sku"].get(sku) if sku else None
    if packed:
        return [packed], ["SKU"]
    return _ORIGINAL_EXISTING_MATCHES(row, indexes, default_brand)


catalog_import._existing_matches = primary_identifier_first_matches


BRAND_SOURCES: dict[str, dict[str, Any]] = {
    "bionutrition": {
        "name": "BioNutrition",
        "official_urls": ("https://bionutritioninc.com",),
        "official_domains": ("bionutritioninc.com",),
    },
    "boiron": {
        "name": "Boiron",
        "official_urls": ("https://www.boironusa.com",),
        "official_domains": ("boironusa.com", "boiron.com"),
    },
    "charlottes-web": {
        "name": "Charlotte's Web",
        "import_name": "Charlottes Web",
        "official_urls": ("https://www.charlottesweb.com",),
        "official_domains": ("charlottesweb.com",),
    },
    "childlife": {
        "name": "ChildLife",
        "official_urls": ("https://childlifenutrition.com",),
        "official_domains": ("childlifenutrition.com",),
    },
    "forces-of-nature": {
        "name": "Forces of Nature",
        "official_urls": ("https://forcesofnaturemedicine.com",),
        "official_domains": ("forcesofnaturemedicine.com",),
    },
    "hylands": {
        "name": "Hyland's",
        "import_name": "Hylands",
        "official_urls": ("https://hylands.com",),
        "official_domains": ("hylands.com",),
    },
    "kyolic": {
        "name": "Kyolic",
        "official_urls": ("https://kyolic.com",),
        "official_domains": ("kyolic.com",),
    },
    "lily-of-the-desert": {
        "name": "Lily of the Desert",
        "official_urls": ("https://lilyofthedesert.com",),
        "official_domains": ("lilyofthedesert.com",),
    },
    "natrol": {
        "name": "Natrol",
        "official_urls": ("https://www.natrol.com",),
        "official_domains": ("natrol.com",),
    },
    "natural-vitality": {
        "name": "Natural Vitality",
        "official_urls": ("https://www.naturalvitality.com",),
        "official_domains": ("naturalvitality.com",),
    },
    "natures-way": {
        "name": "Nature's Way",
        "import_name": "Natures Way",
        "official_urls": ("https://naturesway.com",),
        "official_domains": ("naturesway.com",),
    },
    "nelson-bach": {
        "name": "Nelson Bach",
        "official_urls": ("https://www.nelsons.com/en-us",),
        "official_domains": ("nelsons.com",),
    },
    "north-american": {
        "name": "North American",
        "official_urls": ("https://www.northamericanherbandspice.com",),
        "official_domains": ("northamericanherbandspice.com",),
    },
    "om-mushrooms": {
        "name": "Om Mushrooms",
        "official_urls": ("https://ommushrooms.com",),
        "official_domains": ("ommushrooms.com",),
    },
    "organic-india": {
        "name": "Organic India",
        "official_urls": ("https://shop.organicindiausa.com", "https://www.organicindiausa.com"),
        "official_domains": ("organicindiausa.com",),
    },
    "pacific-resources": {
        "name": "Pacific Resources",
        "official_urls": ("https://www.shoppri.com",),
        "official_domains": ("shoppri.com",),
    },
    "yerba-prima": {
        "name": "Yerba Prima",
        "official_urls": ("https://yerba.com",),
        "official_domains": ("yerba.com",),
    },
    "youtheory": {
        "name": "Youtheory",
        "official_urls": ("https://www.youtheory.com",),
        "official_domains": ("youtheory.com",),
    },
    "bluebonnet-nutrition": {
        "name": "Bluebonnet Nutrition",
        "official_urls": ("https://bluebonnetnutrition.com",),
        "official_domains": ("bluebonnetnutrition.com",),
    },
    "enzymedica": {
        "name": "Enzymedica",
        "official_urls": ("https://enzymedica.com",),
        "official_domains": ("enzymedica.com",),
    },
    "gaia-herbs": {
        "name": "Gaia Herbs",
        "official_urls": ("https://www.gaiaherbs.com",),
        "official_domains": ("gaiaherbs.com",),
    },
    "jarrow-formulas": {
        "name": "Jarrow Formulas",
        "official_urls": ("https://jarrow.com",),
        "official_domains": ("jarrow.com",),
    },
    "megafood": {
        "name": "MegaFood",
        "official_urls": ("https://megafood.com",),
        "official_domains": ("megafood.com",),
    },
    "pluscbd": {
        "name": "+PlusCBD",
        "import_name": "PlusCBD",
        "official_urls": ("https://www.pluscbdoil.com",),
        "official_domains": ("pluscbdoil.com", "cvsciences.com"),
    },
    "plushlth": {
        "name": "+PlusHLTH",
        "import_name": "PlusHLTH",
        "official_urls": ("https://www.pluscbdoil.com",),
        "official_domains": ("pluscbdoil.com", "cvsciences.com"),
    },
}

# Exact UPCs rejected during the generated contact-sheet review. Keeping the
# decisions here makes the import repeatable and prevents a later run from
# attaching the same back/side label or promotional graphic.
VISUALLY_REJECTED_IMAGE_UPCS: dict[str, set[str]] = {
    "bionutrition": {"860009687585", "854936003624", "854936003990", "854936003808", "854936003839"},
    "boiron": {"306969306048", "306969065426", "306969082041"},
    "charlottes-web": {"843119100816", "843119100175"},
    "forces-of-nature": {"830743011229"},
    "hylands": {"354973410213", "354973328419", "354973409415"},
    "kyolic": {"023542102421", "023542150422", "023542200424", "023542250665"},
    "lily-of-the-desert": {"026395057757"},
    "natrol": {"047469082161", "047469082178", "047469080204", "047469073329", "047469078812"},
    "natures-way": {
        "763948078424", "763948040858", "033674101001", "033674146187", "033674153956",
        "033674646007", "033674112502", "033674413104", "033674414101", "033674158197",
        "033674113004", "763948058020", "763948058006", "763948058129", "033674116005",
        "033674004135", "033674003503", "033674153345", "033674100066", "763948077663",
        "763948042500", "763948072361", "033674146163", "033674133156", "033674140017",
        "033674136706", "763948004584", "033674171004", "033674630006", "033674793206",
        "033674156049", "033674402115", "033674178508",
    },
    "nelson-bach": {"741273014515", "741273206811"},
    "north-american": {
        "635824009771", "635824002369", "635824006725", "635824000228", "335824000012",
        "635824006787", "635824006077", "635824009184", "635824006282",
    },
    "om-mushrooms": {"850011996928", "856210008875", "850011996935", "856210008202", "857727004091"},
    "organic-india": {"801541517275"},
    "pacific-resources": {"733726803029", "733726803012", "856824003006", "856824003020", "733726801155"},
    "yerba-prima": {"046352001999", "046352001050"},
    "youtheory": {
        "853244003074", "817598001056", "817598001063", "850021920746",
        "850502007027", "817598001650", "853244003876",
    },
    "bluebonnet-nutrition": {
        "743715000254", "743715000278", "743715000346", "743715000353", "743715000384",
        "743715000476", "743715000490", "743715000629", "743715000643", "743715000841",
        "743715000872", "743715000896", "743715000971", "743715001398", "743715002982",
        "743715003002", "743715003033", "743715003040", "743715003163", "743715003606",
        "743715003620", "743715003644", "743715003729", "743715003743", "743715003767",
        "743715004160", "743715004221", "743715004252", "743715004269", "743715004283",
        "743715004290", "743715004306", "743715004320", "743715004399", "743715004412",
        "743715004436", "743715004443", "743715004450", "743715004467", "743715004498",
        "743715004511", "743715004542", "743715004566", "743715004573", "743715004580",
        "743715004597", "743715004665", "743715004689", "743715005051", "743715005648",
        "743715005686", "743715005693", "743715005761", "743715005808", "743715006003",
        "743715006508", "743715006522", "743715006546", "743715006584", "743715006638",
        "743715006706", "743715006744", "743715006768", "743715006782", "743715006805",
        "743715006881", "743715006928", "743715006973", "743715007215", "743715007222",
        "743715007260", "743715007291", "743715007314", "743715007345", "743715007352",
        "743715007369", "743715007376", "743715007383", "743715007390", "743715007505",
        "743715007529", "743715007925", "743715007932", "743715007994", "743715008311",
        "743715008731", "743715008762", "743715008786", "743715009066", "743715009097",
        "743715009165", "743715009189", "743715009615", "743715009622", "743715009646",
        "743715009806", "743715009837", "743715010123", "743715010147", "743715010161",
        "743715011151", "743715011748", "743715012042", "743715012080", "743715012370",
        "743715012660", "743715012721", "743715013025", "743715013049", "743715013063",
        "743715013124", "743715013162", "743715013209", "743715013216", "743715013285",
        "743715013377", "743715013407", "743715013414", "743715013421", "743715013445",
        "743715013469", "743715013704", "743715013728", "743715013803", "743715013827",
        "743715013872", "743715013957", "743715013971", "743715013988", "743715015081",
        "743715015166", "743715015203", "743715015647", "743715015654", "743715015692",
        "743715015807", "743715015906", "743715015975", "743715017122", "743715017160",
        "743715017207", "743715017245", "743715017306", "743715017467", "743715018402",
        "743715018709", "743715018754", "743715019379", "743715020283", "743715030091",
        "743715030206", "743715030244", "743715030275", "743715030305", "743715040168",
        "743715040175", "743715040182", "743715040199",
    },
    "enzymedica": {
        "supplier-10-98120", "supplier-10-13042", "supplier-10-13043",
        "supplier-10-10187", "supplier-10-10175", "supplier-10-10176",
    },
    "gaia-herbs": {
        "751063996686", "751063151511", "751063152150", "751063340908", "850026260069",
        "751063152143", "751063146739", "751063152563", "751063151719", "751063996648",
        "751063151658", "751063151153", "751063996679", "751063151924",
    },
    "jarrow-formulas": {
        "790011140627", "790011180166", "790011140856", "790011240020", "790011180180",
        "790011350026", "790011160472", "790011300038", "790011290421", "790011290025",
        "790011150435", "790011350002", "790011030010", "790011030669", "790011150619",
        "790011291039", "790011290773", "790011190172", "790011090021", "790011060376",
        "790011010302", "790011140283", "790011300045", "790011090090", "790011030126",
        "790011150206", "790011150565", "790011210146", "790011210030", "790011030218",
    },
    "megafood": {
        "051494102701", "051494101513", "051494104361", "051494102282", "051494102237",
        "051494100233", "051494103333", "051494120019", "051494105672", "051494104415",
        "051494101346", "051494101353", "051494104408", "051494601709", "051494105436",
        "051494104330", "051494105474", "051494105634",
    },
    "pluscbd": {
        "850043735540", "850043735557", "850019274516", "850019274554", "850019274677",
        "850019274691", "850043735403", "850043735397", "850684006474", "850684006511",
        "850684006863", "850684006856", "854521007440", "850043735038", "850043735137",
        "850043735021", "850019274592", "854521007938", "850043735434", "850043735731",
    },
    "plushlth": {"850043735373", "850043735366", "850043735809", "850043735854"},
}

IMAGE_OVERRIDES: dict[str, dict[str, str]] = {
    "850068586264": {
        "image_url": "https://www.naturalvitality.com/cdn/shop/files/maxcalm-magnesium-glycinate-gummies-sour-grape-flavor-50-tasty-gummies-nv27431.jpg?height=606&pad_color=ffffff&v=1782341657&width=606",
        "source_url": "https://www.naturalvitality.com/",
        "title": "Natural Vitality MAXCALM Magnesium Glycinate Gummies Sour Grape 50 Gummies",
        "source_kind": "official_override",
    },
}


def digits(value: Any) -> str:
    return re.sub(r"\D", "", str(value or ""))


def image_key(row: dict[str, Any]) -> str:
    upc = digits(row.get("upc"))
    if upc:
        return upc
    supplier_sku = str(row.get("supplier_sku") or "").strip()
    if supplier_sku:
        return f"supplier-{slugify(supplier_sku)}"
    sku = str(row.get("sku") or "").strip()
    if sku:
        return f"sku-{slugify(sku)}"
    return f"name-{slugify(str(row.get('product_full_name') or row.get('name') or 'product'))}"


def read_source(path: Path, brand_filter: str | None = None) -> tuple[list[dict[str, str]], dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = [
            {key: str(value or "").strip() for key, value in row.items()}
            for row in csv.DictReader(handle)
        ]
    if brand_filter:
        rows = [row for row in rows if row.get("brand", "").casefold() == brand_filter.casefold()]
    if not rows:
        raise ValueError(f"{path.name} has no rows for the requested brand.")
    missing = [field for field in CSV_FIELDS if field not in rows[0]]
    if missing:
        raise ValueError(f"{path.name} is missing columns: {', '.join(missing)}")
    brands = {row["brand"].casefold() for row in rows if row["brand"]}
    if len(brands) != 1:
        raise ValueError(f"{path.name} must contain exactly one brand; found {len(brands)}.")
    brand_name = rows[0]["brand"]
    configured = next(
        (
            (configured_slug, configured_value)
            for configured_slug, configured_value in BRAND_SOURCES.items()
            if configured_value["name"].casefold() == brand_name.casefold()
        ),
        None,
    )
    if not configured:
        raise ValueError(f"Brand is not configured for isolated ingestion: {brand_name}")
    brand_slug, config = configured

    upcs = [digits(row["upc"]) for row in rows]
    duplicates = sorted(upc for upc, count in Counter(upcs).items() if upc and count > 1)
    if duplicates:
        raise ValueError(f"Duplicate UPCs in {path.name}: {', '.join(duplicates[:20])}")
    if any(upc and len(upc) != 12 for upc in upcs):
        raise ValueError(f"Every supplied UPC in {path.name} must have 12 digits.")
    if any(not upc and not row.get("supplier_sku") and not row.get("sku") for row, upc in zip(rows, upcs)):
        raise ValueError(f"Every row in {path.name} needs a UPC, supplier SKU, or SKU.")
    identifier_keys = [
        f"upc:{upc}" if upc else f"supplier:{row.get('supplier_sku')}" if row.get("supplier_sku") else f"sku:{row.get('sku')}"
        for row, upc in zip(rows, upcs)
    ]
    repeated_identifiers = sorted(key for key, count in Counter(identifier_keys).items() if count > 1)
    if repeated_identifiers:
        raise ValueError(f"Duplicate primary identifiers in {path.name}: {', '.join(repeated_identifiers[:20])}")
    if any(not row["msrp"] for row in rows):
        raise ValueError(f"Every row in {path.name} must have an MSRP.")

    for row, upc in zip(rows, upcs):
        row["upc"] = upc
        # Import spelling is chosen so catalog_import's deterministic slugger
        # resolves the preferred public brand slug. The brand row itself keeps
        # the official display name created by ensure_brand_record().
        row["brand"] = str(config.get("import_name") or config["name"])
        row["availability"] = row["availability"] or "in_stock"
        if not row["category"]:
            category, inferred_form, _tags, _audience, _secondary = classify_name(
                row["product_full_name"]
            )
            if category == "Multivitamins" and not re.search(
                r"\bmulti(?:vitamin| vitamin)?s?\b", row["product_full_name"], re.I
            ):
                category = "Specialties"
            row["category"] = category or "Specialties"
            row["form"] = row["form"] or inferred_form or ""

    return rows, {
        "filename": path.name,
        "brand": brand_name,
        "brand_slug": brand_slug,
        "rows": len(rows),
        "categories": dict(sorted(Counter(row["category"] for row in rows).items())),
    }


def csv_bytes(rows: list[dict[str, str]]) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=CSV_FIELDS, lineterminator="\n")
    writer.writeheader()
    writer.writerows({field: row.get(field, "") for field in CSV_FIELDS} for row in rows)
    return output.getvalue().encode("utf-8")


def variant_image(product: dict[str, Any], variant: dict[str, Any]) -> str:
    featured = variant.get("featured_image") or {}
    if isinstance(featured, dict) and (featured.get("src") or featured.get("url")):
        return str(featured.get("src") or featured.get("url"))
    variant_id = variant.get("id")
    for image in product.get("images") or []:
        if isinstance(image, dict) and variant_id in (image.get("variant_ids") or []):
            return str(image.get("src") or "")
    images = product.get("images") or []
    if not images:
        return ""
    first = images[0]
    return str(first.get("src") or "") if isinstance(first, dict) else str(first)


def official_catalog(config: dict[str, Any]) -> tuple[dict[str, dict[str, str]], dict[str, Any]]:
    by_upc: dict[str, dict[str, str]] = {}
    scanned = 0
    endpoints: list[dict[str, Any]] = []
    with httpx.Client(follow_redirects=True, headers={"User-Agent": USER_AGENT}, timeout=30) as client:
        for base_url in config["official_urls"]:
            endpoint = f"{base_url.rstrip('/')}/products.json"
            endpoint_count = 0
            try:
                for page in range(1, 21):
                    response = client.get(endpoint, params={"limit": 250, "page": page})
                    if response.status_code != 200:
                        break
                    payload = response.json()
                    products = payload.get("products") or []
                    if not isinstance(products, list):
                        break
                    scanned += len(products)
                    endpoint_count += len(products)
                    for product in products:
                        for variant in product.get("variants") or []:
                            upc = digits(variant.get("barcode"))
                            url = variant_image(product, variant)
                            if len(upc) != 12 or not url:
                                continue
                            if url.startswith("//"):
                                url = f"https:{url}"
                            by_upc[upc] = {
                                "image_url": url,
                                "source_url": f"{base_url.rstrip('/')}/products/{product.get('handle')}",
                                "title": str(product.get("title") or ""),
                                "source_kind": "official",
                                "score": "1000",
                            }
                    if len(products) < 250:
                        break
            except (httpx.HTTPError, ValueError, TypeError):
                pass
            endpoints.append({"url": endpoint, "products": endpoint_count})
    return by_upc, {"products_scanned": scanned, "exact_upc_images": len(by_upc), "endpoints": endpoints}


def search_candidates(client: httpx.Client, row: dict[str, str]) -> list[dict[str, str]]:
    identifier = row["upc"] or row.get("supplier_sku") or row.get("sku") or ""
    query = f'{identifier} {row["brand"]} {row["product_full_name"]} front'
    response = client.get(
        SEARCH_URL,
        params={"q": query, "first": 1, "count": 35, "scenario": "ImageBasicHover"},
        headers={"User-Agent": "Mozilla/5.0 (compatible; catalog-image-review/1.0)"},
        timeout=30,
    )
    response.raise_for_status()
    candidates: list[dict[str, str]] = []
    seen: set[str] = set()
    for raw in re.findall(r'\bm="([^"]+)"', response.text):
        try:
            metadata = json.loads(html.unescape(raw))
        except (json.JSONDecodeError, TypeError):
            continue
        image_url = str(metadata.get("murl") or "").strip()
        if not image_url or image_url in seen:
            continue
        seen.add(image_url)
        candidates.append(
            {
                "image_url": image_url,
                "source_url": str(metadata.get("purl") or "").strip(),
                "title": html.unescape(str(metadata.get("t") or "")).strip(),
                "source_kind": "barcode_search",
            }
        )
    return candidates


def meaningful_tokens(value: str) -> set[str]:
    stop = {
        "and", "with", "the", "for", "new", "capsule", "capsules", "tablet",
        "tablets", "softgel", "softgels", "supplement", "supplements", "count",
    }
    return {
        token
        for token in re.findall(r"[a-z0-9]+", value.casefold())
        if len(token) >= 3 and token not in stop
    }


def candidate_score(row: dict[str, str], candidate: dict[str, str], config: dict[str, Any]) -> int:
    if candidate.get("source_kind") == "official_override":
        return 2000
    joined = " ".join(candidate.values()).casefold()
    joined_digits = digits(joined)
    source_identifier = row["upc"] or row.get("supplier_sku") or row.get("sku") or ""
    identifier_digits = digits(source_identifier)
    exact_identifier = bool(len(identifier_digits) >= 5 and identifier_digits in joined_digits)
    host = (urlparse(candidate["image_url"]).hostname or "").casefold()
    source_host = (urlparse(candidate["source_url"]).hostname or "").casefold()
    official = any(
        host == domain or host.endswith(f".{domain}") or source_host == domain or source_host.endswith(f".{domain}")
        for domain in config["official_domains"]
    )
    expected = meaningful_tokens(row["product_full_name"])
    observed = meaningful_tokens(candidate["title"] + " " + candidate["source_url"])
    overlap = len(expected & observed)
    size_digits = digits(row.get("size"))
    size_present = bool(size_digits and re.search(rf"(?<!\d){re.escape(size_digits)}(?!\d)", joined_digits))
    score = (120 if exact_identifier else 0) + (35 if official else 0) + min(overlap, 6) * 6
    score += 18 if size_present else 0
    if re.search(r"(?:^|[-_/\s])(front|main|primary)(?:[-_/\s.]|$)", joined):
        score += 20
    if re.search(r"supplement[ _-]?facts|nutrition[ _-]?facts|ingredients|(?:^|[-_/\s])(back|rear|side)(?:[-_/\s.]|$)", joined):
        score -= 180
    if not exact_identifier and not (official and overlap >= 2) and not (overlap >= 3 and size_present):
        return -1
    return score


def safe_download(client: httpx.Client, url: str) -> tuple[bytes, str, str, str, int, int] | None:
    current = url
    for _ in range(4):
        ok, _reason = image_url_allowed(current)
        if not ok:
            return None
        try:
            response = client.get(current, headers={"User-Agent": USER_AGENT}, follow_redirects=False)
        except httpx.HTTPError:
            return None
        if response.status_code in {301, 302, 303, 307, 308}:
            location = response.headers.get("location")
            if not location:
                return None
            current = urljoin(current, location)
            continue
        if response.status_code != 200 or len(response.content) > MAX_IMAGE_BYTES:
            return None
        sniffed = sniff_image(response.content, response.headers.get("content-type"))
        if not sniffed:
            return None
        mime, extension = sniffed
        try:
            with Image.open(io.BytesIO(response.content)) as opened:
                width, height = opened.size
                opened.verify()
        except Exception:
            return None
        if min(width, height) < MIN_IMAGE_EDGE or max(width, height) / min(width, height) > 4.5:
            return None
        return response.content, mime, extension, current, width, height
    return None


def load_cache(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def save_cache(path: Path, cache: dict[str, dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, indent=2, sort_keys=True, ensure_ascii=False), encoding="utf-8")


def enrich_images(
    rows: list[dict[str, str]], brand_slug: str
) -> tuple[dict[str, dict[str, str]], dict[str, Any]]:
    config = BRAND_SOURCES[brand_slug]
    brand_root = OUTPUT_ROOT / brand_slug
    image_root = brand_root / "images"
    cache_path = brand_root / "search-cache.json"
    image_root.mkdir(parents=True, exist_ok=True)
    cache = load_cache(cache_path)
    results = dict(cache)
    for rejected_upc in VISUALLY_REJECTED_IMAGE_UPCS.get(brand_slug, set()):
        rejected = results.get(rejected_upc) or {}
        rejected_path = Path(rejected.get("cache_path", ""))
        if rejected_path.is_file():
            rejected_path.unlink()
        results[rejected_upc] = {"rejected": "visual_front_review"}
    source_upcs = {row["upc"] for row in rows if row["upc"]}
    for override_upc in source_upcs & IMAGE_OVERRIDES.keys():
        override_entry = results.get(override_upc) or {}
        if not Path(override_entry.get("cache_path", "")).is_file():
            results.pop(override_upc, None)
    for row in rows:
        key = image_key(row)
        if key in results and not results[key]:
            results[key] = {"no_verified_match": "true"}
    pending = [
        row
        for row in rows
        if image_key(row) not in results
    ]
    needs_catalog = any(not row["upc"] or row["upc"] not in IMAGE_OVERRIDES for row in pending)
    official, official_stats = (
        official_catalog(config)
        if needs_catalog
        else ({}, {"products_scanned": 0, "exact_upc_images": 0, "endpoints": [], "cache_reused": True})
    )
    lock = threading.Lock()

    def resolve(row: dict[str, str]) -> tuple[str, dict[str, str]]:
        key = image_key(row)
        candidates: list[dict[str, str]] = []
        if row["upc"] and row["upc"] in IMAGE_OVERRIDES:
            candidates.append(IMAGE_OVERRIDES[row["upc"]])
        if row["upc"] and row["upc"] in official:
            candidates.append(official[row["upc"]])
        with httpx.Client(
            limits=httpx.Limits(max_connections=8, max_keepalive_connections=4),
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        ) as client:
            if not candidates:
                try:
                    candidates.extend(search_candidates(client, row))
                except httpx.HTTPError:
                    pass
            ranked = sorted(
                ((candidate_score(row, candidate, config), candidate) for candidate in candidates),
                key=lambda item: item[0],
                reverse=True,
            )
            for score, candidate in ranked[:15]:
                if score < 0:
                    continue
                downloaded = safe_download(client, candidate["image_url"])
                if not downloaded:
                    continue
                content, mime, extension, final_url, width, height = downloaded
                local_path = image_root / f"{key}.{extension}"
                local_path.write_bytes(content)
                return key, {
                    **candidate,
                    "image_url": final_url,
                    "cache_path": str(local_path),
                    "mime": mime,
                    "extension": extension,
                    "score": str(score),
                    "width": str(width),
                    "height": str(height),
                }
        return key, {"no_verified_match": "true"}

    completed = 0
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(resolve, row) for row in pending]
        for future in as_completed(futures):
            upc, match = future.result()
            with lock:
                results[upc] = match
                completed += 1
                if completed % 25 == 0 or completed == len(pending):
                    found = sum(
                        1
                        for row in rows
                        if Path((results.get(image_key(row)) or {}).get("cache_path", "")).is_file()
                    )
                    print(f"Image review {completed}/{len(pending)}; {found}/{len(rows)} found.", flush=True)
                    save_cache(cache_path, results)
            time.sleep(0.03)
    save_cache(cache_path, results)
    found = sum(1 for row in rows if Path((results.get(image_key(row)) or {}).get("cache_path", "")).is_file())
    return results, {"found": found, "missing": len(rows) - found, "official_catalog": official_stats}


def text_lines(draw: ImageDraw.ImageDraw, value: str, width: int) -> list[str]:
    words = value.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def create_contact_sheets(
    rows: list[dict[str, str]], matches: dict[str, dict[str, str]], brand_slug: str
) -> list[str]:
    sheet_root = OUTPUT_ROOT / brand_slug / "sheets"
    sheet_root.mkdir(parents=True, exist_ok=True)
    available = [row for row in rows if Path((matches.get(image_key(row)) or {}).get("cache_path", "")).is_file()]
    columns, rows_per_sheet = 5, 5
    cell_width, cell_height, image_height = 260, 270, 198
    sheet_paths: list[str] = []
    for sheet_number, start in enumerate(range(0, len(available), columns * rows_per_sheet), start=1):
        page = available[start : start + columns * rows_per_sheet]
        sheet = Image.new("RGB", (columns * cell_width, rows_per_sheet * cell_height), "white")
        draw = ImageDraw.Draw(sheet)
        for offset, row in enumerate(page):
            match = matches[image_key(row)]
            column, line = offset % columns, offset // columns
            left, top = column * cell_width, line * cell_height
            with Image.open(match["cache_path"]) as opened:
                normalized = ImageOps.exif_transpose(opened).convert("RGB")
                thumb = ImageOps.contain(normalized, (cell_width - 18, image_height - 10))
            sheet.paste(thumb, (left + (cell_width - thumb.width) // 2, top + (image_height - thumb.height) // 2))
            draw.rectangle((left, top, left + cell_width - 1, top + cell_height - 1), outline="#d6d6d6")
            item_number = start + offset + 1
            for line_number, text in enumerate(text_lines(draw, f"{item_number:03d} {row['product_full_name']}", cell_width - 12)[:2]):
                draw.text((left + 6, top + image_height + 2 + line_number * 13), text, fill="black")
            identifier = f"UPC {row['upc']}" if row["upc"] else f"Supplier {row.get('supplier_sku') or row.get('sku')}"
            meta = f"{identifier}  {match.get('source_kind', '')}"
            draw.text((left + 6, top + cell_height - 16), meta, fill="#555555")
        path = sheet_root / f"sheet-{sheet_number:02d}.jpg"
        sheet.save(path, "JPEG", quality=90, optimize=True)
        sheet_paths.append(str(path))
    return sheet_paths


def prepare_preview(rows: list[dict[str, str]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    parsed = parse_catalog_csv(csv_bytes(rows), default_brand=None, default_discount_percent=None)
    preview_rows: list[dict[str, Any]] = []
    for product in parsed["products"]:
        row = {
            **product,
            "detected_action": "insert",
            "included": True,
            "approved_existing_variant_id": None,
            "edited_fields": [],
        }
        catalog_import._sanitize_image(row)
        preview_rows.append(row)
    catalog_import._analyze_rows(preview_rows, None)
    for row in preview_rows:
        match = row.get("duplicate_match") or {}
        matched_fields = match.get("matched_fields") or []
        exact_primary = (
            bool(row.get("upc") and "UPC" in matched_fields)
            or bool(not row.get("upc") and row.get("supplier_sku") and "supplier SKU" in matched_fields)
            or bool(
                not row.get("upc")
                and not row.get("supplier_sku")
                and row.get("sku")
                and "SKU" in matched_fields
            )
        )
        if exact_primary:
            row["approved_existing_variant_id"] = match["variant_id"]
    catalog_import._analyze_rows(preview_rows, None)
    return preview_rows, catalog_import._stats(preview_rows, parsed["stats"]["section_rows"])


def products_needing_images(preview_rows: list[dict[str, Any]]) -> set[str]:
    product_ids = sorted(
        {
            str((row.get("duplicate_match") or {}).get("product_id"))
            for row in preview_rows
            if (row.get("duplicate_match") or {}).get("product_id")
        }
    )
    products_with_images: set[str] = set()
    for start in range(0, len(product_ids), 40):
        chunk = product_ids[start : start + 40]
        images = sb.select(
            "product_images",
            {"select": "product_id", "product_id": f"in.({','.join(chunk)})"},
        )
        products_with_images.update(str(row["product_id"]) for row in images)
    needed: set[str] = set()
    for row in preview_rows:
        match = row.get("duplicate_match") or {}
        product_id = str(match.get("product_id") or "")
        if not product_id or product_id not in products_with_images:
            needed.add(image_key(row))
    return needed


def upload_images(
    rows: list[dict[str, str]], matches: dict[str, dict[str, str]], brand_slug: str, needed_keys: set[str]
) -> dict[str, str]:
    uploaded: dict[str, str] = {}

    def upload(row: dict[str, str]) -> tuple[str, str] | None:
        key = image_key(row)
        match = matches.get(key) or {}
        path = Path(match.get("cache_path", ""))
        if key not in needed_keys or not path.is_file():
            return None
        object_path = f"products/{brand_slug}/{key}.{match['extension']}"
        for attempt in range(6):
            try:
                public_url = sb.upload_object("product-images", object_path, path.read_bytes(), match["mime"])
                return key, public_url
            except Exception:
                if attempt == 5:
                    return None
                time.sleep(0.5 * (attempt + 1))
        return None

    candidates = [row for row in rows if image_key(row) in needed_keys]
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(upload, row) for row in candidates]
        for index, future in enumerate(as_completed(futures), start=1):
            result = future.result()
            if result:
                uploaded[result[0]] = result[1]
            if index % 25 == 0 or index == len(futures):
                print(f"Image upload {index}/{len(futures)}; {len(uploaded)} stored.", flush=True)
    failures = sorted(
        image_key(row)
        for row in candidates
        if Path((matches.get(image_key(row)) or {}).get("cache_path", "")).is_file()
        and image_key(row) not in uploaded
    )
    if failures:
        raise RuntimeError(
            "Approved images could not be stored after retries: " + ", ".join(failures[:20])
        )
    return uploaded


def commit_rows(rows: list[dict[str, str]], filename: str) -> dict[str, Any]:
    preview = catalog_import.preview_csv(
        csv_bytes(rows), filename, brand_name=None, discount_percent=None, force_reprocess=True
    )
    batch = catalog_import._BATCHES[preview["id"]]
    for row in batch["rows"]:
        match = row.get("duplicate_match") or {}
        matched_fields = match.get("matched_fields") or []
        exact_primary = (
            bool(row.get("upc") and "UPC" in matched_fields)
            or bool(not row.get("upc") and row.get("supplier_sku") and "supplier SKU" in matched_fields)
            or bool(
                not row.get("upc")
                and not row.get("supplier_sku")
                and row.get("sku")
                and "SKU" in matched_fields
            )
        )
        if exact_primary:
            row["approved_existing_variant_id"] = match["variant_id"]
    catalog_import._analyze_rows(batch["rows"], None)
    batch["stats"] = catalog_import._stats(batch["rows"], len(batch.get("sections") or []))
    blocking = [row for row in batch["rows"] if row.get("included", True) and row["detected_action"] in {"error", "conflict"}]
    if blocking:
        raise RuntimeError(
            "Import preview contains blocking rows: "
            + ", ".join(str(row["source_row_number"]) for row in blocking[:20])
        )
    included = [row["source_row_number"] for row in batch["rows"] if row.get("included", True)]
    result = catalog_import.commit_csv(preview["id"], included_row_numbers=included, force_reprocess=True)
    return {"batch_id": preview["id"], "preview_stats": batch["stats"], "commit": result}


def ensure_brand_record(brand_slug: str) -> dict[str, Any]:
    config = BRAND_SOURCES[brand_slug]
    found = sb.select("brands", {"select": "*", "slug": f"eq.{brand_slug}", "limit": "1"})
    if found:
        return found[0]
    return sb.insert(
        "brands",
        {
            "name": config["name"],
            "slug": brand_slug,
            "is_active": True,
        },
    )


def select_all(table: str, columns: str) -> list[dict[str, Any]]:
    return catalog_import._select_all(table, columns)


def verify(brand_slug: str, expected_rows: list[dict[str, str]]) -> dict[str, Any]:
    brands = sb.select(
        "brands",
        {"select": "id,name,slug,discount_percent,is_active", "slug": f"eq.{brand_slug}", "limit": "1"},
    )
    if not brands:
        return {"error": f"Brand not found after import: {brand_slug}"}
    brand = brands[0]
    products = sb.select(
        "products", {"select": "id,status", "brand_id": f"eq.{brand['id']}", "limit": "2000"}
    )
    product_ids = {str(row["id"]) for row in products}
    variants = [
        row
        for row in select_all(
            "product_variants", "id,product_id,upc,sku,supplier_sku,availability,regular_price_cents,cost_price_cents"
        )
        if str(row.get("product_id")) in product_ids
    ]
    images = [
        row
        for row in select_all("product_images", "product_id,storage_path,is_primary")
        if str(row.get("product_id")) in product_ids
    ]
    seen = Counter(image_key(row) for row in variants)
    expected = {image_key(row) for row in expected_rows}
    expected_product_ids = {
        str(row["product_id"]) for row in variants if image_key(row) in expected
    }
    image_products = {str(row["product_id"]) for row in images}
    return {
        "brand": brand,
        "expected_identifiers": len(expected),
        "expected_identifiers_found_once": sum(1 for key in expected if seen.get(key) == 1),
        "missing_identifiers": sorted(key for key in expected if seen.get(key, 0) == 0),
        "duplicate_expected_identifiers": sorted(key for key in expected if seen.get(key, 0) > 1),
        "active_expected_products": sum(
            1 for product in products if str(product["id"]) in expected_product_ids and product["status"] == "active"
        ),
        "positive_regular_prices": sum(
            1 for row in variants if image_key(row) in expected and int(row.get("regular_price_cents") or 0) > 0
        ),
        "products_with_images": len(expected_product_ids & image_products),
        "products_missing_images": len(expected_product_ids - image_products),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", type=Path)
    parser.add_argument("--brand-filter")
    parser.add_argument("--skip-image-search", action="store_true")
    parser.add_argument("--commit", action="store_true")
    args = parser.parse_args()

    rows, source = read_source(args.csv, args.brand_filter)
    brand_slug = source["brand_slug"]
    matches: dict[str, dict[str, str]] = {}
    image_stats: dict[str, Any] = {"found": 0, "missing": len(rows), "skipped": True}
    sheets: list[str] = []
    if not args.skip_image_search:
        matches, image_stats = enrich_images(rows, brand_slug)
        image_stats["skipped"] = False
        sheets = create_contact_sheets(rows, matches, brand_slug)

    preview_payload = [dict(row) for row in rows]
    for row in preview_payload:
        match = matches.get(image_key(row)) or {}
        if match.get("image_url"):
            row["image_url"] = match["image_url"]
    preview_rows, preview_stats = prepare_preview(preview_payload)
    blocking = [row for row in preview_rows if row["detected_action"] in {"error", "conflict"}]
    report: dict[str, Any] = {
        "source": source,
        "images": image_stats,
        "contact_sheets": sheets,
        "preview_stats": preview_stats,
        "blocking_rows": [
            {"row": row["source_row_number"], "name": row.get("name"), "errors": row.get("errors")}
            for row in blocking[:30]
        ],
    }
    if blocking:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        raise RuntimeError("Preview contains blocking rows; nothing was committed.")

    if args.commit:
        ensure_brand_record(brand_slug)
        needed_keys = products_needing_images(preview_rows)
        uploaded = upload_images(rows, matches, brand_slug, needed_keys)
        commit_payload = [dict(row) for row in rows]
        for row in commit_payload:
            row["image_url"] = uploaded.get(image_key(row), "")
        report["images"]["needed_for_products"] = len(needed_keys)
        report["images"]["uploaded_to_storage"] = len(uploaded)
        report["import"] = commit_rows(commit_payload, args.csv.name)
        report["verification"] = verify(brand_slug, rows)

    report_path = OUTPUT_ROOT / brand_slug / ("commit-report.json" if args.commit else "preview-report.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
