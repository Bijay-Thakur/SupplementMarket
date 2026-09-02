"""Recover missing official images, clean names, hide synthetic seed, export snapshot."""
from __future__ import annotations

import json
import re
import shutil
import time
from pathlib import Path

from urllib.parse import urljoin

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from bs4 import BeautifulSoup

from app.catalog.extract import parse_jsonld_scripts, parsed_from_jsonld, parsed_from_semantic_html
from app.catalog.http import PoliteFetcher
from app.catalog.images import try_store_image
from app.db.base import SessionLocal
from app.models import Product, ProductImage, StoreSettings
from app.services import serialize

ROOT = Path(__file__).resolve().parents[3]
PUBLIC_MEDIA = ROOT / "public" / "media" / "products"
SNAPSHOT = ROOT / "src" / "data" / "catalog.json"


def _clean_name(name: str) -> str:
    name = re.sub(r"\s*\|\s*WoodstockFoods\s*", "", name, flags=re.I)
    name = name.replace("_", " ").replace("\ufffd", "")
    name = re.sub(r"\s+", " ", name).strip(" |")
    return name[:240]


def _hero_image_urls(html: str, page_url: str) -> list[str]:
    """Official-page hero photos (JSON-LD/og:image often missing on AEM sites)."""
    soup = BeautifulSoup(html, "html.parser")
    urls: list[str] = []
    for im in soup.select("[class*='product-detail-imag'] img, [class*='productDetail'] img"):
        src = im.get("src") or im.get("data-src")
        if src:
            urls.append(urljoin(page_url, src))
    if not urls:
        for im in soup.find_all("img"):
            src = im.get("src") or im.get("data-src") or ""
            parent_cls = " ".join((im.parent.get("class") or []) if im.parent else [])
            if "product-detail" in parent_cls.lower() and src:
                urls.append(urljoin(page_url, src))
    skip = ("logo", "icon", "facebook", "instagram", "tiktok", "privacy", "header")
    out: list[str] = []
    seen: set[str] = set()
    for u in urls:
        low = u.lower()
        if any(s in low for s in skip):
            continue
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def recover_images(db) -> None:
    missing = [
        p
        for p in db.execute(
            select(Product)
            .where(Product.source_type == "official_manufacturer_page")
            .options(selectinload(Product.images), selectinload(Product.brand))
        ).scalars()
        if not p.images and p.source_url
    ]
    print(f"official products missing images: {len(missing)}")
    seen: dict = {}
    with PoliteFetcher(live=True, delay_seconds=1.5) as fetcher:
        for p in missing:
            print("recover", p.id, p.name, p.source_url)
            try:
                page = fetcher.get(p.source_url)
            except Exception as e:
                print("  fetch fail", e)
                continue
            parsed = None
            nodes = parse_jsonld_scripts(page.text)
            if nodes:
                parsed = parsed_from_jsonld(
                    nodes[0], page_url=page.final_url, brand=p.brand.name, parent_brand=p.parent_brand
                )
            html_parsed = parsed_from_semantic_html(
                page.text, page_url=page.final_url, brand=p.brand.name, parent_brand=p.parent_brand
            )
            urls: list[str] = []
            if parsed:
                urls.extend(i.url for i in parsed.images)
            if html_parsed:
                urls.extend(i.url for i in html_parsed.images)
            urls.extend(_hero_image_urls(page.text, page.final_url))
            seen_urls: set[str] = set()
            unique: list[str] = []
            for u in urls:
                if u not in seen_urls:
                    seen_urls.add(u)
                    unique.append(u)
            urls = unique
            if not urls:
                print("  no image candidates")
                continue
            stored = None
            for url in urls[:3]:
                stored = try_store_image(
                    fetcher,
                    url,
                    brand_slug=p.brand.slug,
                    run_id="recover",
                    name=_clean_name(p.name),
                    form=p.form,
                    count=p.count,
                    seen_hashes=seen,
                )
                if stored:
                    break
            if not stored:
                print("  download fail")
                continue
            orig_name = Path(stored.original_path).name[:255]
            db.add(
                ProductImage(
                    product_id=p.id,
                    filename=stored.optimized_rel,
                    original_filename=orig_name,
                    alt_text=f"{p.brand.name} {_clean_name(p.name)} package",
                    display_order=0,
                    is_primary=True,
                    mime_type=stored.mime_type,
                    size_bytes=stored.size_bytes,
                    is_demo=True,
                    source_url=urls[0],
                    sha256=stored.sha256,
                    image_use_status="demo_review_only",
                    permission_status="permission_pending",
                    original_path=stored.original_path,
                )
            )
            p.image_use_status = "permission_pending"
            print("  saved", stored.optimized_rel)
            time.sleep(0.2)
    db.commit()


def polish_catalog(db) -> None:
    settings = db.get(StoreSettings, 1)
    if settings:
        settings.announcement = (
            "Demonstration catalog for Bronxville Natural Market — 86 Pondfield Rd. "
            "Prices shown are demo pricing, not the store’s shelf prices."
        )
        settings.hours_note = (
            "Monday–Saturday, 9 AM–7 PM. Sunday, 10 AM–6 PM."
        )
        settings.pickup_instructions = (
            "We’ll confirm when your order is ready for pickup at 86 Pondfield Rd."
        )
        settings.phone = "+19147793552"
        settings.phone_is_placeholder = False
        settings.email = "bronxvillenatural@gmail.com"
        settings.address_line1 = "86 Pondfield Rd"
        settings.delivery_note = (
            "Local delivery is available in nearby ZIP codes. The store confirms fees and timing."
        )
    for p in db.execute(select(Product).options(selectinload(Product.brand))).scalars():
        if p.source_type != "official_manufacturer_page":
            p.is_active = False
            p.is_archived = True
            continue
        p.name = _clean_name(p.name)
        p.is_active = True
        p.is_archived = False
    # Hide official rows that still have no package photo — placeholders look unfinished in a demo.
    for p in db.execute(select(Product).options(selectinload(Product.images))).scalars():
        if p.source_type == "official_manufacturer_page" and not p.images:
            p.is_active = False
    db.commit()


def export_snapshot(db) -> None:
    from app.models import Brand, Category, CatalogSource, Tag, Promotion

    products = list(
        db.execute(
            select(Product)
            .where(Product.is_active.is_(True), Product.is_archived.is_(False))
            .options(
                selectinload(Product.images),
                selectinload(Product.brand),
                selectinload(Product.category),
                selectinload(Product.tags),
                selectinload(Product.variants),
            )
        )
        .scalars()
        .unique()
    )
    brand_ids = {p.brand_id for p in products}
    cat_ids = {p.category_id for p in products}
    brands = [
        {
            "id": b.id,
            "name": b.name,
            "slug": b.slug,
            "description": b.description,
            "is_featured": b.is_featured,
            "logo_url": getattr(b, "logo_url", None),
            "logo_alt": getattr(b, "logo_alt", None) or b.name,
            "official_website_url": getattr(b, "official_website_url", None),
            "logo_use_status": getattr(b, "logo_use_status", None) or "permission_pending",
            "logo_background": getattr(b, "logo_background", None) or "cream",
            "display_order": getattr(b, "display_order", 0) or 0,
        }
        for b in db.execute(select(Brand).where(Brand.id.in_(brand_ids)).order_by(Brand.name)).scalars()
    ]
    categories = [
        {
            "id": c.id,
            "name": c.name,
            "slug": c.slug,
            "parent_id": c.parent_id,
            "description": c.description,
            "display_order": c.display_order,
        }
        for c in db.execute(select(Category).where(Category.id.in_(cat_ids)).order_by(Category.display_order, Category.name)).scalars()
    ]
    tags = [{"id": t.id, "name": t.name, "slug": t.slug, "kind": t.kind} for t in db.execute(select(Tag)).scalars()]
    promotions = []
    for promo in db.execute(select(Promotion).where(Promotion.is_active.is_(True))).scalars():
        promotions.append(
            {
                "id": promo.id,
                "name": promo.name,
                "description": promo.description,
                "discount_percent": promo.discount_percent,
                "is_active": promo.is_active,
            }
        )
    settings = db.get(StoreSettings, 1)
    sources = [
        {
            "id": s.id,
            "slug": s.slug,
            "name": s.name,
            "parent_brand": s.parent_brand,
            "official_url": s.official_url,
            "collection_url": s.collection_url,
            "domain": s.domain,
            "enabled": s.enabled,
            "product_limit": s.product_limit,
            "policy_status": s.policy_status,
            "policy_notes": s.policy_notes,
            "robots_status": s.robots_status,
            "last_checked_at": s.last_checked_at.isoformat() if s.last_checked_at else None,
            "last_run_id": s.last_run_id,
            "last_result": s.last_result,
        }
        for s in db.execute(select(CatalogSource).order_by(CatalogSource.name)).scalars()
    ]
    payload = {
        "products": [serialize.product_detail(p).model_dump(mode="json") for p in products],
        "brands": brands,
        "categories": categories,
        "tags": tags,
        "promotions": promotions,
        "catalog_sources": sources,
        "settings": {
            "store_name": settings.store_name if settings else "Bronxville Natural Market",
            "phone": settings.phone if settings else None,
            "phone_is_placeholder": True if not settings else settings.phone_is_placeholder,
            "email": settings.email if settings else None,
            "address_line1": settings.address_line1 if settings else "86 Pondfield Rd",
            "city": settings.city if settings else "Bronxville",
            "state": settings.state if settings else "NY",
            "zip": settings.zip if settings else "10708",
            "hours_note": settings.hours_note if settings else None,
            "announcement": settings.announcement if settings else None,
            "pickup_instructions": settings.pickup_instructions if settings else None,
            "delivery_note": settings.delivery_note if settings else None,
            "min_order_cents": settings.min_order_cents if settings else 0,
            "currency": "USD",
            "timezone": "America/New_York",
        },
    }
    SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("wrote", SNAPSHOT, "products", len(payload["products"]))

    src = Path("storage/products")
    if src.exists():
        PUBLIC_MEDIA.mkdir(parents=True, exist_ok=True)
        for item in src.iterdir():
            dest = PUBLIC_MEDIA / item.name
            if item.is_dir():
                if dest.exists():
                    shutil.rmtree(dest)
                shutil.copytree(item, dest)
            elif item.suffix.lower() in {".webp", ".jpg", ".jpeg", ".png"}:
                shutil.copy2(item, dest)
        print("copied images to", PUBLIC_MEDIA)


def main() -> None:
    db = SessionLocal()
    try:
        recover_images(db)
        polish_catalog(db)
        export_snapshot(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
