"""Audit the stored image URLs for one live catalog brand."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx


REPO_ROOT = Path(__file__).resolve().parents[1]


def load_local_env() -> dict[str, str]:
    values = dict(os.environ)
    for path in (REPO_ROOT / ".env", REPO_ROOT / "frontend" / ".env.local"):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            values.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    return values


ENV = load_local_env()
SUPABASE_URL = (ENV.get("SUPABASE_URL") or ENV.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
SUPABASE_KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY") or ENV.get("SUPABASE_SECRET_KEY") or ""


def select(table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Supabase is not configured.")
    response = httpx.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        params=params,
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    return payload if isinstance(payload, list) else []


def store_image(image_id: str, product_id: str, content: bytes, content_type: str) -> str:
    extensions = {
        "image/avif": "avif",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }
    extension = extensions.get(content_type)
    if not extension:
        raise RuntimeError(f"Unsupported image type: {content_type}")
    object_path = f"garden-of-life/{product_id}/primary.{extension}"
    upload = httpx.post(
        f"{SUPABASE_URL}/storage/v1/object/product-images/{object_path}",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        content=content,
        timeout=30,
    )
    upload.raise_for_status()
    update = httpx.patch(
        f"{SUPABASE_URL}/rest/v1/product_images",
        params={"id": f"eq.{image_id}"},
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        json={"storage_path": object_path},
        timeout=30,
    )
    update.raise_for_status()
    if len(update.json()) != 1:
        raise RuntimeError(f"Expected to update one image row: {image_id}")
    return object_path


def code_key(value: Any) -> str:
    digits = re.sub(r"\D", "", str(value or ""))
    return digits.lstrip("0") or digits


def shopify_matches(base_url: str, images: list[dict[str, Any]]) -> list[tuple[dict[str, Any], str]]:
    by_code: dict[str, str] = {}
    with httpx.Client(follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}, timeout=30) as client:
        for page_number in range(1, 41):
            response = client.get(
                f"{base_url.rstrip('/')}/products.json",
                params={"limit": 250, "page": page_number},
            )
            if response.status_code == 429:
                break
            response.raise_for_status()
            products = response.json().get("products") or []
            for product in products:
                product_images = product.get("images") or []
                default_url = str(product_images[0].get("src") or "") if product_images else ""
                for variant in product.get("variants") or []:
                    barcode = code_key(variant.get("barcode"))
                    if not barcode:
                        continue
                    featured = variant.get("featured_image") or {}
                    url = str(featured.get("src") or default_url)
                    if url:
                        by_code[barcode] = url
            if len(products) < 250:
                break

    matched: list[tuple[dict[str, Any], str]] = []
    for row in images:
        path = str(row.get("storage_path") or "")
        match = re.search(r"/(\d{12,14})-[^/]+$", path.split("?", 1)[0])
        if not match:
            continue
        url = by_code.get(code_key(match.group(1)))
        if url:
            matched.append((row, url))
    return matched


def select_all(table: str, columns: str, **filters: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        page = select(
            table,
            {
                "select": columns,
                "limit": "1000",
                "offset": str(offset),
                **filters,
            },
        )
        rows.extend(page)
        if len(page) < 1000:
            return rows
        offset += 1000


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("brand_slug")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--strip-query", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--prime-origin", action="store_true")
    parser.add_argument("--iherb", action="store_true")
    parser.add_argument("--summary-only", action="store_true")
    parser.add_argument("--commit-iherb", action="store_true")
    parser.add_argument("--shopify-base")
    parser.add_argument("--commit-shopify", action="store_true")
    args = parser.parse_args()

    brands = select(
        "brands",
        {"select": "id,name,slug", "slug": f"eq.{args.brand_slug}", "limit": "1"},
    )
    if not brands:
        raise SystemExit(f"Brand not found: {args.brand_slug}")
    brand = brands[0]
    products = select_all(
        "products",
        "id,name,slug,status",
        brand_id=f"eq.{brand['id']}",
        status="eq.active",
    )
    product_by_id = {str(row["id"]): row for row in products}
    images: list[dict[str, Any]] = []
    product_ids = list(product_by_id)
    for start in range(0, len(product_ids), 40):
        chunk = product_ids[start : start + 40]
        images.extend(
            select(
                "product_images",
                {
                    "select": "id,product_id,storage_path,is_primary",
                    "product_id": f"in.({','.join(chunk)})",
                },
            )
        )

    hosts = Counter(
        urlparse(str(row.get("storage_path") or "")).netloc or "supabase-storage"
        for row in images
    )
    report: dict[str, Any] = {
        "brand": brand,
        "active_products": len(products),
        "image_rows": len(images),
        "products_without_images": len(set(product_by_id) - {str(row["product_id"]) for row in images}),
        "hosts": hosts,
        "sample": [
            {
                "product": product_by_id.get(str(row["product_id"]), {}).get("name"),
                "url": row.get("storage_path"),
            }
            for row in images[:10]
        ],
    }

    if args.shopify_base:
        matches = shopify_matches(args.shopify_base, images)
        committed = 0
        verified = 0
        failures: list[dict[str, Any]] = []
        with httpx.Client(follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}, timeout=30) as client:
            for row, url in matches:
                try:
                    response = client.get(url)
                    content_type = response.headers.get("content-type", "").split(";", 1)[0]
                    response.raise_for_status()
                    if not content_type.startswith("image/"):
                        raise RuntimeError(f"Unexpected content type: {content_type}")
                    verified += 1
                    if args.commit_shopify:
                        store_image(str(row["id"]), str(row["product_id"]), response.content, content_type)
                        committed += 1
                except Exception as exc:
                    failures.append({"product_id": row["product_id"], "url": url, "error": str(exc)})
        report["shopify"] = {
            "source": args.shopify_base,
            "exact_barcode_matches": len(matches),
            "verified": verified,
            "committed": committed,
            "failures": failures[:20],
        }
        print(json.dumps(report, indent=2, default=str))
        return

    if args.check:
        rows_to_check = images[: args.limit] if args.limit else images

        def check(row: dict[str, Any]) -> dict[str, Any]:
            with httpx.Client(
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
                    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                    "Referer": "https://www.gardenoflife.com/",
                },
                timeout=20,
            ) as client:
                if args.prime_origin:
                    client.get("https://www.gardenoflife.com/")
                path = str(row.get("storage_path") or "")
                url = path if path.startswith("http") else (
                    f"{SUPABASE_URL}/storage/v1/object/public/product-images/{path.lstrip('/')}"
                )
                if args.strip_query:
                    url = url.split("?", 1)[0]
                if args.iherb:
                    match = re.search(r"(658010)(\d{5})\d", path)
                    if not match:
                        return {"product_id": row["product_id"], "url": url, "error": "UPC not found", "ok": False}
                    url = (
                        "https://cloudinary.images-iherb.com/image/upload/"
                        f"f_auto,q_auto:eco/images/gol/gol{match.group(2)}/l/1.jpg"
                    )
                try:
                    response = client.get(url)
                    content_type = response.headers.get("content-type", "")
                    ok = response.status_code == 200 and content_type.startswith("image/")
                    storage_path = None
                    if ok and args.commit_iherb:
                        storage_path = store_image(
                            str(row["id"]),
                            str(row["product_id"]),
                            response.content,
                            content_type,
                        )
                    return {
                        "product_id": row["product_id"],
                        "product": product_by_id.get(str(row["product_id"]), {}).get("name"),
                        "url": url,
                        "status": response.status_code,
                        "content_type": content_type,
                        "bytes": len(response.content),
                        "sha256": hashlib.sha256(response.content).hexdigest(),
                        "storage_path": storage_path,
                        "ok": ok,
                    }
                except Exception as exc:
                    return {
                        "product_id": row["product_id"],
                        "product": product_by_id.get(str(row["product_id"]), {}).get("name"),
                        "url": url,
                        "error": str(exc),
                        "ok": False,
                    }

        with ThreadPoolExecutor(max_workers=12) as executor:
            checks = list(executor.map(check, rows_to_check))
        failed_checks = [row for row in checks if not row["ok"]]
        failed_hosts = Counter(urlparse(str(row.get("url") or "")).netloc for row in failed_checks)
        report["checks"] = {
            "ok": sum(1 for row in checks if row["ok"]),
            "failed": len(failed_checks),
            "committed": sum(1 for row in checks if row.get("storage_path")),
            "failed_hosts": failed_hosts,
            "failures": failed_checks[:20] if args.summary_only else failed_checks,
        }

    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()
