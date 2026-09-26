"""Find, review, and publish better front-facing catalog product images.

The workflow is deliberately two-step:
1. ``--prepare`` searches by exact UPC, downloads validated image candidates,
   and writes contact sheets plus a selection manifest for visual review.
2. ``--commit`` uploads only the chosen files under content-addressed paths,
   updates the existing image rows, and verifies the public copies.

Search results are treated as untrusted data. Candidate URLs must be ordinary
public HTTP(S) images, decode successfully, meet the minimum dimensions, and
carry either UPC evidence or strong product-name evidence.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import importlib.util
import io
import json
import re
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from PIL import Image, ImageDraw, ImageOps


REPO_ROOT = Path(__file__).resolve().parents[1]
AUDIT_SCRIPT = REPO_ROOT / "scripts" / "audit-product-images.py"
OUTPUT_ROOT = REPO_ROOT / "outputs" / "product-image-remediation"
SEARCH_URL = "https://www.bing.com/images/search"
MIN_EDGE = 400
MAX_BYTES = 6_000_000
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 Chrome/140 Safari/537.36"
)


def load_audit_module() -> Any:
    spec = importlib.util.spec_from_file_location("catalog_image_audit", AUDIT_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the catalog image audit helper.")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


audit = load_audit_module()


def parse_indices(value: str) -> set[int]:
    indices: set[int] = set()
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = (int(piece.strip()) for piece in part.split("-", 1))
            indices.update(range(start, end + 1))
        else:
            indices.add(int(part))
    return indices


def meaningful_tokens(value: str) -> set[str]:
    stop = {
        "solgar", "garden", "life", "rainbow", "light", "with", "the", "for",
        "capsule", "capsules", "tablet", "tablets", "softgel", "softgels",
        "count", "organic", "formulated", "supplement", "health", "product",
    }
    return {
        token
        for token in re.findall(r"[a-z0-9]+", value.casefold())
        if len(token) >= 3 and token not in stop
    }


def search_candidates(
    client: httpx.Client, brand: str, product: str, upc: str
) -> list[dict[str, str]]:
    candidates: list[dict[str, str]] = []
    seen: set[str] = set()
    queries = [f'"{brand}" "{product}"', f"{brand} {product} {upc}"]
    for query in queries:
        try:
            token_page = client.get(
                "https://duckduckgo.com/",
                params={"q": query},
                headers={"User-Agent": USER_AGENT},
                timeout=30,
            )
            token_page.raise_for_status()
            token_match = re.search(r"vqd=['\"]?([0-9-]+)", token_page.text)
            if token_match:
                image_response = client.get(
                    "https://duckduckgo.com/i.js",
                    params={
                        "l": "us-en",
                        "o": "json",
                        "q": query,
                        "vqd": token_match.group(1),
                        "f": ",,,",
                    },
                    headers={"User-Agent": USER_AGENT, "Referer": str(token_page.url)},
                    timeout=30,
                )
                image_response.raise_for_status()
                for result in image_response.json().get("results") or []:
                    image_url = str(result.get("image") or "").strip()
                    if not image_url or image_url in seen:
                        continue
                    seen.add(image_url)
                    candidates.append(
                        {
                            "image_url": image_url,
                            "source_url": str(result.get("url") or "").strip(),
                            "title": html.unescape(str(result.get("title") or "")).strip(),
                        }
                    )
        except (httpx.HTTPError, ValueError, json.JSONDecodeError):
            pass
        if candidates:
            continue
        response = client.get(
            SEARCH_URL,
            params={"q": query, "first": 1, "count": 45},
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
        response.raise_for_status()
        encoded_rows = re.findall(r'\bm="([^"]+)"', response.text)
        if not encoded_rows:
            encoded_rows = [
                next(value for value in match if value)
                for match in re.findall(r"\bm=(?:\"([^\"]+)\"|'([^']+)')", response.text)
            ]
        for raw in encoded_rows:
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
                }
            )
    return candidates


def source_page_candidates(
    client: httpx.Client, source_url: str, upc: str
) -> list[dict[str, str]]:
    if not source_url:
        return []
    candidates: list[dict[str, str]] = []
    seen: set[str] = set()

    if "/products/" in source_url:
        try:
            product_response = client.get(
                f"{source_url.rstrip('/')}.js",
                headers={"User-Agent": USER_AGENT},
                timeout=30,
            )
            product_response.raise_for_status()
            product = product_response.json()
            product_text = json.dumps(product, ensure_ascii=False)
            exact = upc in re.sub(r"\D", "", product_text)
            if exact:
                raw_images = [product.get("featured_image"), *(product.get("images") or [])]
                for raw_image in raw_images:
                    if isinstance(raw_image, dict):
                        image_url = str(raw_image.get("src") or "")
                    else:
                        image_url = str(raw_image or "")
                    if image_url.startswith("//"):
                        image_url = f"https:{image_url}"
                    elif image_url.startswith("/"):
                        parsed_source = urlparse(source_url)
                        image_url = f"{parsed_source.scheme}://{parsed_source.netloc}{image_url}"
                    if image_url and image_url not in seen:
                        seen.add(image_url)
                        candidates.append(
                            {
                                "image_url": image_url,
                                "source_url": source_url,
                                "title": str(product.get("title") or ""),
                            }
                        )
        except (httpx.HTTPError, ValueError, json.JSONDecodeError) as exc:
            print(f"Source feed unavailable for {upc}: {exc}", flush=True)

    try:
        page = client.get(source_url, headers={"User-Agent": USER_AGENT}, timeout=30)
        page.raise_for_status()
        digits = re.sub(r"\D", "", page.text)
        if upc in digits or upc in re.sub(r"\D", "", source_url):
            patterns = [
                r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)',
                r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
            ]
            for pattern in patterns:
                for image_url in re.findall(pattern, page.text, flags=re.IGNORECASE):
                    image_url = html.unescape(image_url)
                    if image_url.startswith("//"):
                        image_url = f"https:{image_url}"
                    elif image_url.startswith("/"):
                        parsed_source = urlparse(source_url)
                        image_url = f"{parsed_source.scheme}://{parsed_source.netloc}{image_url}"
                    if image_url and image_url not in seen:
                        seen.add(image_url)
                        candidates.append(
                            {"image_url": image_url, "source_url": source_url, "title": "source page primary image"}
                        )
    except httpx.HTTPError as exc:
        print(f"Source page unavailable for {upc}: {exc}", flush=True)
    return candidates


def load_shopify_by_upc(client: httpx.Client, base_url: str) -> dict[str, list[dict[str, str]]]:
    matches: dict[str, list[dict[str, str]]] = {}
    for page_number in range(1, 41):
        response = client.get(
            f"{base_url.rstrip('/')}/products.json",
            params={"limit": 250, "page": page_number},
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
        if response.status_code in {429, 502, 503, 504}:
            time.sleep(2)
            retry = client.get(
                f"{base_url.rstrip('/')}/products.json",
                params={"limit": 250, "page": page_number},
                headers={"User-Agent": USER_AGENT},
                timeout=30,
            )
            if retry.status_code != 200:
                break
            response = retry
        response.raise_for_status()
        products = response.json().get("products") or []
        for product in products:
            codes: set[str] = set()
            for variant in product.get("variants") or []:
                digits = re.sub(r"\D", "", str(variant.get("barcode") or ""))
                if 11 <= len(digits) <= 14:
                    codes.add(digits)
            handle = str(product.get("handle") or "")
            codes.update(re.findall(r"(?<!\d)\d{11,14}(?!\d)", handle))
            images = product.get("images") or []
            for code in codes:
                rows = matches.setdefault(code, [])
                for image in images:
                    image_url = str(image.get("src") or "")
                    if image_url:
                        rows.append(
                            {
                                "image_url": image_url,
                                "source_url": f"{base_url.rstrip('/')}/products/{handle}",
                                "title": str(product.get("title") or ""),
                            }
                        )
        if len(products) < 250:
            break
    return matches


def candidate_score(item: dict[str, Any], candidate: dict[str, str]) -> int:
    joined = " ".join(candidate.values()).casefold()
    digits = re.sub(r"\D", "", joined)
    upc = re.sub(r"\D", "", str(item.get("upc") or ""))
    expected = meaningful_tokens(str(item.get("product") or ""))
    observed = meaningful_tokens(joined)
    overlap = len(expected & observed)
    exact_upc = bool(upc and (upc in digits or upc[-6:] in digits))
    if not exact_upc and overlap < min(3, max(1, len(expected))):
        return -1

    score = 120 if exact_upc else 0
    score += min(overlap, 8) * 7
    if re.search(r"(?:^|[-_/])(front|main|primary|hero|01|1)(?:[-_.?/]|$)", joined):
        score += 35
    if any(word in joined for word in ("official", "vitacost", "iherb", "walmart", "target")):
        score += 8
    if any(word in joined for word in ("supplement-facts", "supplement_facts", "nutrition", "back", "rear")):
        score -= 100
    if re.search(r"(?:^|[-_/])(?:02|2|03|3)(?:[-_.?/]|$)", joined):
        score -= 25
    return score


def download_candidate(client: httpx.Client, url: str) -> tuple[bytes, str, str, int, int] | None:
    try:
        response = client.get(url, headers={"User-Agent": USER_AGENT}, timeout=25)
    except httpx.HTTPError:
        return None
    content_type = response.headers.get("content-type", "").split(";", 1)[0].casefold()
    if response.status_code != 200 or not content_type.startswith("image/"):
        return None
    if len(response.content) > MAX_BYTES:
        return None
    try:
        with Image.open(io.BytesIO(response.content)) as image:
            normalized = ImageOps.exif_transpose(image)
            width, height = normalized.size
            normalized.verify()
            image_format = image.format
    except Exception:
        return None
    if min(width, height) < MIN_EDGE:
        return None
    extensions = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp", "AVIF": "avif"}
    extension = extensions.get(str(image_format).upper())
    if not extension:
        return None
    mime = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp", "avif": "image/avif"}[extension]
    return response.content, mime, extension, width, height


def wrap(draw: ImageDraw.ImageDraw, value: str, width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in value.split():
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


def create_selected_sheets(items: list[dict[str, Any]], output: Path) -> list[str]:
    output.mkdir(parents=True, exist_ok=True)
    columns, rows = 5, 5
    cell_width, cell_height, image_height = 230, 245, 185
    paths: list[str] = []
    for page_number, start in enumerate(range(0, len(items), columns * rows), start=1):
        page = items[start : start + columns * rows]
        sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), "white")
        draw = ImageDraw.Draw(sheet)
        for offset, item in enumerate(page):
            column, row_number = offset % columns, offset // columns
            left, top = column * cell_width, row_number * cell_height
            selected = item.get("selected") or {}
            local_path = selected.get("local_path")
            if local_path:
                with Image.open(local_path) as source:
                    image = ImageOps.contain(source.convert("RGB"), (cell_width - 16, image_height - 8))
                sheet.paste(
                    image,
                    (left + (cell_width - image.width) // 2, top + (image_height - image.height) // 2),
                )
            draw.rectangle((left, top, left + cell_width - 1, top + cell_height - 1), outline="#d6d6d6")
            label = f"{item['index']:03d} {item.get('product') or ''}"
            for line_number, line in enumerate(wrap(draw, label, cell_width - 12)[:2]):
                draw.text((left + 6, top + image_height + 2 + line_number * 13), line, fill="black")
            meta = f"UPC {item.get('upc') or '-'}  score {selected.get('score', '-')}"
            draw.text((left + 6, top + cell_height - 15), meta, fill="#555555")
        path = output / f"selected-{page_number:02d}.jpg"
        sheet.save(path, "JPEG", quality=90, optimize=True)
        paths.append(str(path))
    return paths


def prepare(
    brand_slug: str,
    brand_name: str,
    indices: set[int],
    source_cache: Path | None = None,
    shopify_base: str | None = None,
    source_template: str | None = None,
    url_map: Path | None = None,
    image_template: str | None = None,
    include_failed_current: bool = False,
) -> dict[str, Any]:
    audit_manifest_path = REPO_ROOT / "outputs" / "product-image-audit" / brand_slug / "manifest.json"
    manifest = json.loads(audit_manifest_path.read_text(encoding="utf-8"))
    if include_failed_current:
        indices.update(int(item["index"]) for item in manifest if not item.get("downloaded"))
    requested = [item for item in manifest if int(item["index"]) in indices]
    missing = sorted(indices - {int(item["index"]) for item in requested})
    if missing:
        raise RuntimeError(f"Audit indices not found: {missing}")

    brand_root = OUTPUT_ROOT / brand_slug
    candidates_root = brand_root / "candidates"
    candidates_root.mkdir(parents=True, exist_ok=True)
    output_items: list[dict[str, Any]] = []
    cached_sources: dict[str, Any] = {}
    if source_cache:
        cached_sources = json.loads(source_cache.read_text(encoding="utf-8"))
    mapped_urls: dict[str, str] = {}
    if url_map:
        mapped_urls = json.loads(url_map.read_text(encoding="utf-8"))
    with httpx.Client(follow_redirects=True, limits=httpx.Limits(max_connections=6)) as client:
        shopify_by_upc = load_shopify_by_upc(client, shopify_base) if shopify_base else {}
        for position, item in enumerate(requested, start=1):
            candidate_rows: list[dict[str, Any]] = []
            cached = cached_sources.get(str(item.get("upc") or "")) or {}
            source_url = str(cached.get("source_url") or "")
            if source_template:
                source_url = source_template.format(upc=str(item.get("upc") or ""))
            mapped_url = mapped_urls.get(str(item["index"]))
            upc = re.sub(r"\D", "", str(item.get("upc") or ""))
            template_url = (
                image_template.format(upc=upc, upc_middle=upc[6:11])
                if image_template and len(upc) >= 12
                else ""
            )
            if mapped_url or template_url:
                raw_candidates = [
                    {
                        "image_url": mapped_url or template_url,
                        "source_url": "manually reviewed exact product result",
                        "title": str(item.get("product") or ""),
                    }
                ]
            elif shopify_base:
                raw_candidates = shopify_by_upc.get(str(item.get("upc") or ""), [])
            elif (source_cache or source_template) and source_url:
                raw_candidates = source_page_candidates(
                    client, source_url, str(item.get("upc") or "")
                )
            else:
                try:
                    raw_candidates = search_candidates(
                        client, brand_name, str(item.get("product") or ""), str(item.get("upc") or "")
                    )
                except httpx.HTTPError:
                    raw_candidates = []
            ranked = sorted(
                (
                    (
                        250 - index
                        if (source_cache or shopify_base or source_template or mapped_url or template_url)
                        else candidate_score(item, candidate),
                        candidate,
                    )
                    for index, candidate in enumerate(raw_candidates)
                ),
                key=lambda value: value[0],
                reverse=True,
            )
            for score, candidate in ranked:
                if score < 0 or len(candidate_rows) >= 4:
                    continue
                downloaded = download_candidate(client, candidate["image_url"])
                if not downloaded:
                    continue
                content, mime, extension, width, height = downloaded
                digest = hashlib.sha256(content).hexdigest()
                if any(row["sha256"] == digest for row in candidate_rows):
                    continue
                local_path = candidates_root / f"{int(item['index']):04d}-{len(candidate_rows) + 1}.{extension}"
                local_path.write_bytes(content)
                candidate_rows.append(
                    {
                        **candidate,
                        "score": score,
                        "mime": mime,
                        "extension": extension,
                        "width": width,
                        "height": height,
                        "sha256": digest,
                        "local_path": str(local_path),
                    }
                )
            selected = candidate_rows[0] if candidate_rows else None
            output_items.append(
                {
                    **item,
                    "search_results": len(raw_candidates),
                    "search_sample": [
                        {**candidate, "score": score} for score, candidate in ranked[:5]
                    ],
                    "candidates": candidate_rows,
                    "selected": selected,
                }
            )
            if position % 10 == 0 or position == len(requested):
                print(f"Candidate search {brand_slug}: {position}/{len(requested)}", flush=True)
            time.sleep(0.08)

    selection_path = brand_root / "selections.json"
    selection_path.write_text(json.dumps(output_items, indent=2, ensure_ascii=False), encoding="utf-8")
    sheets = create_selected_sheets(output_items, brand_root / "selected-sheets")
    return {
        "requested": len(requested),
        "selected": sum(1 for item in output_items if item.get("selected")),
        "unresolved": [
            {
                "index": item["index"],
                "product": item.get("product"),
                "upc": item.get("upc"),
                "search_results": item.get("search_results"),
            }
            for item in output_items
            if not item.get("selected")
        ],
        "selection_manifest": str(selection_path),
        "selected_sheets": sheets,
    }


def upload_object(path: str, content: bytes, mime: str) -> str:
    response = httpx.post(
        f"{audit.SUPABASE_URL}/storage/v1/object/product-images/{path}",
        headers={
            "apikey": audit.SUPABASE_KEY,
            "Authorization": f"Bearer {audit.SUPABASE_KEY}",
            "Content-Type": mime,
            "x-upsert": "false",
        },
        content=content,
        timeout=30,
    )
    if response.status_code not in {200, 201, 409}:
        response.raise_for_status()
    return audit.public_image_url(path)


def commit(brand_slug: str, excluded_indices: set[int] | None = None) -> dict[str, Any]:
    selection_path = OUTPUT_ROOT / brand_slug / "selections.json"
    items = json.loads(selection_path.read_text(encoding="utf-8"))
    excluded_indices = excluded_indices or set()
    committed: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    for position, item in enumerate(items, start=1):
        if int(item["index"]) in excluded_indices:
            continue
        selected = item.get("selected") or {}
        local_path = Path(str(selected.get("local_path") or ""))
        if not selected or not local_path.is_file():
            continue
        content = local_path.read_bytes()
        digest = hashlib.sha256(content).hexdigest()
        if digest != selected.get("sha256"):
            failures.append({"index": item["index"], "error": "Candidate checksum changed."})
            continue
        object_path = (
            f"products/image-remediation/{brand_slug}/{item['product_id']}/"
            f"{digest[:16]}.{selected['extension']}"
        )
        try:
            public_url = upload_object(object_path, content, selected["mime"])
            response = httpx.patch(
                f"{audit.SUPABASE_URL}/rest/v1/product_images",
                params={"id": f"eq.{item['image_id']}", "product_id": f"eq.{item['product_id']}"},
                headers={
                    "apikey": audit.SUPABASE_KEY,
                    "Authorization": f"Bearer {audit.SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation",
                },
                json={"storage_path": object_path},
                timeout=30,
            )
            response.raise_for_status()
            updated = response.json()
            if len(updated) != 1:
                raise RuntimeError("Expected exactly one product image row to update.")
            verification = audit.download_for_audit(public_url)
            if not verification or hashlib.sha256(verification).hexdigest() != digest:
                raise RuntimeError("The published image did not pass checksum verification.")
            committed.append(
                {
                    "index": item["index"],
                    "product_id": item["product_id"],
                    "product": item.get("product"),
                    "upc": item.get("upc"),
                    "storage_path": object_path,
                }
            )
        except Exception as exc:
            failures.append({"index": item["index"], "product": item.get("product"), "error": str(exc)})
        if position % 10 == 0 or position == len(items):
            print(f"Publish {brand_slug}: {position}/{len(items)}", flush=True)

    return {"committed": len(committed), "failures": failures, "rows": committed}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("brand_slug")
    parser.add_argument("--brand-name", required=True)
    parser.add_argument("--indices", help="Comma-separated audit indices and ranges.")
    parser.add_argument("--source-cache", type=Path)
    parser.add_argument("--shopify-base")
    parser.add_argument("--source-template")
    parser.add_argument("--url-map", type=Path)
    parser.add_argument("--image-template")
    parser.add_argument("--include-failed-current", action="store_true")
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--commit", action="store_true")
    parser.add_argument("--exclude-indices", default="")
    args = parser.parse_args()
    if args.prepare == args.commit:
        raise SystemExit("Choose exactly one of --prepare or --commit.")
    if args.prepare:
        if not args.indices:
            raise SystemExit("--indices is required with --prepare.")
        report = prepare(
            args.brand_slug,
            args.brand_name,
            parse_indices(args.indices),
            args.source_cache,
            args.shopify_base,
            args.source_template,
            args.url_map,
            args.image_template,
            args.include_failed_current,
        )
    else:
        report = commit(args.brand_slug, parse_indices(args.exclude_indices))
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
