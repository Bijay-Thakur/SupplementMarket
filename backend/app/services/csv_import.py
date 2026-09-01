"""CSV catalog importer: template, dry-run preview, and safe commit.

Imported products enter a review/staging state (inactive + approval pending) so
they never appear on the storefront until an admin approves them.
"""
from __future__ import annotations

import csv
import io

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Brand, Category, Product
from app.repositories import products as repo
from app.schemas.imports import ImportCommitResult, ImportPreview, ImportRow
from app.services.pricing import discount_percent

TEMPLATE_COLUMNS = [
    "name",
    "brand",
    "category",
    "sku",
    "upc",
    "form",
    "size",
    "count",
    "strength_value",
    "strength_unit",
    "regular_price",
    "sale_price",
    "availability",
    "short_description",
    "vegan",
    "vegetarian",
    "organic",
    "gluten_free",
    "soy_free",
    "dairy_free",
    "alcohol_free",
    "non_gmo",
    "search_aliases",
    "wellness_tags",
    "ingredient_highlights",
    "source_url",
    "source_type",
]

TRUE_VALUES = {"1", "true", "yes", "y", "x"}


def template_csv() -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(TEMPLATE_COLUMNS)
    w.writerow(
        [
            "Demo Vitamin D3 2000 IU",
            "Demo Brand Co",
            "Vitamin D",
            "DEMO-D3-2000",
            "",
            "softgel",
            "",
            "120",
            "2000",
            "IU",
            "18.99",
            "14.99",
            "in_stock",
            "Demonstration product row.",
            "1",
            "1",
            "0",
            "1",
            "1",
            "1",
            "1",
            "1",
            "vitamin d, d3, cholecalciferol",
            "bone health, immune support",
            "Vitamin D3 (as cholecalciferol)",
            "",
            "owner_spreadsheet",
        ]
    )
    return buf.getvalue()


def _dollars_to_cents(value: str) -> int | None:
    s = (value or "").strip().replace("$", "").replace(",", "")
    if not s:
        return None
    neg = s.startswith("-")
    s = s.lstrip("-")
    if "." in s:
        whole, frac = s.split(".", 1)
    else:
        whole, frac = s, ""
    if not whole.isdigit() or (frac and not frac.isdigit()):
        raise ValueError("Invalid price format.")
    frac = (frac + "00")[:2]
    cents = int(whole or 0) * 100 + int(frac or 0)
    return -cents if neg else cents


def _truthy(v: str) -> bool:
    return (v or "").strip().lower() in TRUE_VALUES


def _parse(content: bytes) -> list[dict[str, str]]:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    return [ {(k or "").strip(): (v or "").strip() for k, v in row.items()} for row in reader ]


def _brand_index(db: Session) -> dict[str, Brand]:
    return {b.name.strip().lower(): b for b in db.execute(select(Brand)).scalars()}


def _category_index(db: Session) -> dict[str, Category]:
    return {c.name.strip().lower(): c for c in db.execute(select(Category)).scalars()}


def preview(db: Session, content: bytes, filename: str | None) -> ImportPreview:
    rows_raw = _parse(content)
    brands = _brand_index(db)
    cats = _category_index(db)
    seen_sku: set[str] = set()
    seen_upc: set[str] = set()

    out: list[ImportRow] = []
    creatable = updatable = invalid = 0

    for idx, r in enumerate(rows_raw, start=2):  # header is line 1
        errors: list[str] = []
        warnings: list[str] = []
        name = r.get("name", "")
        brand = r.get("brand", "")
        category = r.get("category", "")
        sku = r.get("sku", "")
        upc = r.get("upc", "")

        if not name:
            errors.append("Missing name.")
        if not sku:
            errors.append("Missing SKU.")
        if brand.lower() not in brands:
            errors.append(f"Unknown brand '{brand}'. Create it first.")
        if category.lower() not in cats:
            errors.append(f"Unknown category '{category}'. Create it first.")

        reg = sale = None
        try:
            reg = _dollars_to_cents(r.get("regular_price", ""))
            if reg is None:
                errors.append("Missing regular price.")
            elif reg < 0:
                errors.append("Regular price cannot be negative.")
        except ValueError:
            errors.append("Invalid regular price.")
        try:
            sale = _dollars_to_cents(r.get("sale_price", ""))
            if sale is not None and reg is not None and sale >= reg:
                errors.append("Sale price must be less than regular price.")
        except ValueError:
            errors.append("Invalid sale price.")

        is_dupe = False
        if sku and sku in seen_sku:
            errors.append("Duplicate SKU within file.")
            is_dupe = True
        if upc and upc in seen_upc:
            warnings.append("Duplicate UPC within file.")
            is_dupe = True
        if sku:
            seen_sku.add(sku)
        if upc:
            seen_upc.add(upc)

        action = "error"
        if not errors:
            exists = sku and repo.sku_exists(db, sku)
            action = "update" if exists else "create"
            if exists:
                updatable += 1
            else:
                creatable += 1
        else:
            invalid += 1

        out.append(
            ImportRow(
                line=idx,
                action=action,
                name=name or None,
                brand=brand or None,
                sku=sku or None,
                upc=upc or None,
                regular_price_cents=reg,
                sale_price_cents=sale,
                is_duplicate=is_dupe,
                errors=errors,
                warnings=warnings,
            )
        )

    return ImportPreview(
        filename=filename,
        total_rows=len(rows_raw),
        creatable=creatable,
        updatable=updatable,
        invalid=invalid,
        rows=out,
    )


def commit(db: Session, content: bytes) -> ImportCommitResult:
    rows_raw = _parse(content)
    brands = _brand_index(db)
    cats = _category_index(db)
    prev = preview(db, content, None)
    by_line = {r.line: r for r in prev.rows}

    created = updated = skipped = 0
    errors: list[ImportRow] = []

    for idx, r in enumerate(rows_raw, start=2):
        pr = by_line.get(idx)
        if pr is None or pr.action == "error":
            skipped += 1
            if pr:
                errors.append(pr)
            continue

        brand = brands[r["brand"].strip().lower()]
        category = cats[r["category"].strip().lower()]
        reg = pr.regular_price_cents or 0
        sale = pr.sale_price_cents

        if pr.action == "update":
            product = db.execute(
                select(Product).where(Product.sku == r["sku"].strip())
            ).scalars().first()
            if product is None:
                skipped += 1
                continue
            product.regular_price_cents = reg
            product.sale_price_cents = sale
            if r.get("availability"):
                product.availability = r["availability"].strip()
            product.verification_status = "pending_review"
            product.approval_status = "pending"
            product.is_active = False  # re-enters review
            updated += 1
        else:
            from app.core.utils import slugify

            product = Product(
                brand_id=brand.id,
                category_id=category.id,
                name=r["name"].strip(),
                slug=repo.unique_slug(db, slugify(r["name"])),
                sku=r["sku"].strip(),
                upc=r.get("upc") or None,
                regular_price_cents=reg,
                sale_price_cents=sale,
                availability=r.get("availability") or "in_stock",
                form=r.get("form") or None,
                size=r.get("size") or None,
                count=int(r["count"]) if r.get("count", "").isdigit() else None,
                strength_value=float(r["strength_value"]) if r.get("strength_value") else None,
                strength_unit=r.get("strength_unit") or None,
                short_description=r.get("short_description") or None,
                ingredient_highlights=r.get("ingredient_highlights") or None,
                search_aliases=r.get("search_aliases") or None,
                vegan=_truthy(r.get("vegan", "")),
                vegetarian=_truthy(r.get("vegetarian", "")),
                organic=_truthy(r.get("organic", "")),
                gluten_free=_truthy(r.get("gluten_free", "")),
                soy_free=_truthy(r.get("soy_free", "")),
                dairy_free=_truthy(r.get("dairy_free", "")),
                alcohol_free=_truthy(r.get("alcohol_free", "")),
                non_gmo=_truthy(r.get("non_gmo", "")),
                source_url=r.get("source_url") or None,
                source_type=r.get("source_type") or None,
                # Staging/review: not visible on storefront until approved.
                is_active=False,
                verification_status="pending_review",
                approval_status="pending",
                is_demo=True,
            )
            db.add(product)
            created += 1

    db.commit()
    _ = discount_percent  # keep import used for parity/testing surface
    return ImportCommitResult(
        total_rows=len(rows_raw),
        created=created,
        updated=updated,
        skipped=skipped,
        errors=errors,
        message=f"Imported {created} new and {updated} updated product(s) into review. {skipped} skipped.",
    )
