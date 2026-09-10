"""Vendor-tolerant CSV catalog parser.

Does not write to the database. Preview and commit are separate steps.
"""
from __future__ import annotations

import csv
import hashlib
import io
import re
from dataclasses import asdict, dataclass, field
from typing import Any

from app.catalog.csv_normalize import (
    dollars_to_cents,
    normalize_form,
    normalize_upc,
    parse_size,
    parse_strength,
    sale_from_discount,
    slugify,
    trim,
)

MAX_CSV_BYTES = 10 * 1024 * 1024

COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "upc": ("upc", "upc code", "barcode", "gtin", "12 digit"),
    "sku": ("sku", "product code"),
    "supplier_sku": ("supplier sku", "supplier_sku", "item #", "item number", "item no", "item"),
    "name": (
        "product name",
        "product full name",
        "product_full_name",
        "product description",
        "item description",
        "description",
    ),
    "brand": ("brand", "manufacturer", "vendor"),
    "category": ("category", "department", "section"),
    "size": ("size", "package size"),
    "form": ("form", "dosage form"),
    "strength": ("strength", "potency"),
    "regular_price": ("msrp", "regular price", "regular_price", "retail price"),
    "sale_price": ("sale price", "selling price", "discounted price", "store srp", "store_srp"),
    "cost_price": ("wholesale price", "wholesale", "cost", "cost_price", "unit cost"),
    "discount": ("discount", "discount percent", "discount_percent"),
    "availability": ("availability", "stock status", "inventory status"),
    "image": ("image", "image url", "image_url", "product image", "photo url"),
}

ALLOWED_AVAILABILITY = {
    "in_stock",
    "low_stock",
    "out_of_stock",
    "special_order",
    "discontinued",
}

FOOTER_MARKERS = (
    "details & terms",
    "shipping policies",
    "page 1 subtotal",
    "page 2 subtotal",
    "page 1 net total",
    "page 2 net total",
    "discount percentage",
    "total net order",
    "company contact",
    "contact information",
    "toll-free",
    "important order notes",
    "credit card on first order",
    "payment over 30",
    "past due",
    "case contains 12 units",
    "restocking fee",
    "approved drop-ship",
    "store:",
    "address:",
    "card #",
    "email:",
    "website:",
    "vital planet, 133 candy",
)

SKIP_HEADING_MARKERS = ("qty", "units", "ordered")


@dataclass
class DetectedColumn:
    field: str
    header: str
    index: int


@dataclass
class ParsedRow:
    source_row_number: int
    kind: str  # product | section | skip
    raw: dict[str, str]
    name: str | None = None
    brand: str | None = None
    category: str | None = None
    supplier_sku: str | None = None
    sku: str | None = None
    upc: str | None = None
    size_original: str | None = None
    unit_count: int | None = None
    size_value: float | None = None
    size_unit: str | None = None
    form: str | None = None
    form_original: str | None = None
    strength_value: float | None = None
    strength_unit: str | None = None
    regular_price_cents: int | None = None
    cost_price_cents: int | None = None
    sale_price_cents: int | None = None
    discount_percent: int | None = None
    availability: str = "in_stock"
    image_url: str | None = None
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def as_preview(self) -> dict[str, Any]:
        data = asdict(self)
        return data


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _decode_csv_bytes(content: bytes) -> str:
    if len(content) > MAX_CSV_BYTES:
        raise ValueError("CSV exceeds the 10 MB limit.")
    if content.startswith((b"\xff\xfe", b"\xfe\xff")):
        try:
            return content.decode("utf-16")
        except UnicodeDecodeError as exc:
            raise ValueError("The CSV uses an unsupported text encoding.") from exc
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        # Excel on Windows commonly exports CSV files as Windows-1252.
        try:
            return content.decode("cp1252")
        except UnicodeDecodeError as exc:
            raise ValueError(
                "The CSV could not be read. Save it as UTF-8 CSV and upload it again."
            ) from exc


def _detect_delimiter(sample: str) -> str:
    header_line = ""
    for line in sample.splitlines():
        if "item #" in line.lower() and "product description" in line.lower():
            header_line = line
            break
    try:
        dialect = csv.Sniffer().sniff(header_line or sample[:4096], delimiters=",;\t")
        return dialect.delimiter
    except csv.Error:
        return "," if sample.count(",") >= sample.count(";") else ";"


def _norm_header(value: str) -> str:
    return re.sub(r"\s+", " ", trim(value).lower())


def _is_footer(cells: list[str]) -> bool:
    blob = " ".join(trim(c) for c in cells[:8]).lower()
    return any(marker in blob for marker in FOOTER_MARKERS)


def _nonempty_cells(cells: list[str]) -> list[str]:
    return [trim(c) for c in cells if trim(c)]


def _looks_like_header(cells: list[str]) -> bool:
    joined = " | ".join(_norm_header(c) for c in cells[:12])
    if "item #" in joined and "product description" in joined and "upc" in joined:
        return True
    mapped = map_headers(cells)
    has_identity = any(key in mapped for key in ("upc", "sku", "supplier_sku"))
    return "name" in mapped and has_identity


def map_headers(cells: list[str]) -> dict[str, DetectedColumn]:
    mapping: dict[str, DetectedColumn] = {}
    seen_headers: set[str] = set()
    for idx, raw in enumerate(cells):
        header = _norm_header(raw)
        if not header or header in seen_headers:
            continue
        seen_headers.add(header)
        for field, aliases in COLUMN_ALIASES.items():
            if field in mapping:
                continue
            if header in aliases or any(alias == header for alias in aliases):
                mapping[field] = DetectedColumn(field=field, header=raw.strip(), index=idx)
    # Vital Planet: Price beside MSRP is wholesale, Case/Order are ignored.
    if "regular_price" in mapping and "cost_price" not in mapping:
        for idx, raw in enumerate(cells):
            if _norm_header(raw) == "price" and idx != mapping["regular_price"].index:
                mapping["cost_price"] = DetectedColumn("cost_price", raw.strip(), idx)
                break
    return mapping


def _cell(cells: list[str], mapping: dict[str, DetectedColumn], field: str) -> str:
    col = mapping.get(field)
    if not col or col.index >= len(cells):
        return ""
    return trim(cells[col.index])


def _is_section_row(cells: list[str], mapping: dict[str, DetectedColumn]) -> str | None:
    if _cell(cells, mapping, "supplier_sku") or _cell(cells, mapping, "name"):
        return None
    heading = ""
    nonempty = _nonempty_cells(cells[:6])
    if nonempty:
        heading = nonempty[0]
    if not heading:
        return None
    low = heading.lower()
    if low in SKIP_HEADING_MARKERS:
        return None
    if _is_footer(cells):
        return None
    if heading.endswith(":"):
        return None
    if re.search(r"\d", heading) and len(heading) < 4:
        return None
    return heading


def parse_product_row(
    cells: list[str],
    mapping: dict[str, DetectedColumn],
    source_row_number: int,
    *,
    current_category: str | None,
    default_brand: str | None,
    default_discount_percent: int | None,
) -> ParsedRow:
    raw = {
        field: _cell(cells, mapping, field)
        for field in (
            "upc",
            "sku",
            "supplier_sku",
            "name",
            "brand",
            "category",
            "size",
            "form",
            "strength",
            "regular_price",
            "sale_price",
            "cost_price",
            "discount",
            "availability",
            "image",
        )
    }
    row = ParsedRow(
        source_row_number=source_row_number,
        kind="product",
        raw=raw,
        name=trim(raw["name"]) or None,
        brand=trim(raw["brand"]) or default_brand,
        category=trim(raw["category"]) or current_category,
        supplier_sku=trim(raw["supplier_sku"]) or None,
        sku=trim(raw["sku"]) or None,
        size_original=trim(raw["size"]) or None,
        image_url=trim(raw["image"]) or None,
    )
    availability = trim(raw["availability"]).lower().replace(" ", "_").replace("-", "_")
    if availability:
        if availability in ALLOWED_AVAILABILITY:
            row.availability = availability
        else:
            row.errors.append(
                "Availability must be in_stock, low_stock, out_of_stock, special_order, or discontinued."
            )
    upc, upc_warnings = normalize_upc(raw["upc"])
    row.upc = upc
    row.warnings.extend(upc_warnings)

    form, form_original, form_warnings = normalize_form(raw["form"])
    row.form = form
    row.form_original = form_original
    row.warnings.extend(form_warnings)

    size = parse_size(raw["size"])
    row.unit_count = size["unit_count"]
    row.size_value = size["size_value"]
    row.size_unit = size["size_unit"]
    row.warnings.extend(size["warnings"])

    strength = parse_strength(row.name or "", raw["strength"])
    row.strength_value = strength["strength_value"]
    row.strength_unit = strength["strength_unit"]
    row.warnings.extend(strength["warnings"])

    row.regular_price_cents = dollars_to_cents(raw["regular_price"])
    row.cost_price_cents = dollars_to_cents(raw["cost_price"])
    explicit_sale = dollars_to_cents(raw["sale_price"])
    discount_raw = trim(raw["discount"]).replace("%", "")
    row_discount = None
    if discount_raw:
        try:
            row_discount = int(float(discount_raw))
        except ValueError:
            row.warnings.append("Discount percent was ignored because it was not numeric.")
    chosen = row_discount if row_discount is not None else default_discount_percent
    if explicit_sale is not None:
        row.sale_price_cents = explicit_sale
        if row.regular_price_cents and explicit_sale >= row.regular_price_cents:
            row.errors.append("Sale price must be lower than regular price.")
    elif chosen:
        row.discount_percent = chosen
        if row.regular_price_cents is not None:
            row.sale_price_cents = sale_from_discount(row.regular_price_cents, chosen)
    if row.regular_price_cents is None:
        row.errors.append("Regular price is required.")
    if not row.name:
        row.errors.append("Product name is required.")
    if not row.brand:
        row.errors.append("Brand is required.")
    return row


def parse_catalog_csv(
    content: bytes,
    *,
    default_brand: str | None = None,
    default_discount_percent: int | None = None,
    column_overrides: dict[str, int] | None = None,
) -> dict[str, Any]:
    text = _decode_csv_bytes(content)
    delimiter = _detect_delimiter(text)
    try:
        all_rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    except csv.Error as exc:
        raise ValueError(f"The CSV is malformed: {exc}.") from exc
    mapping: dict[str, DetectedColumn] = {}
    header_cells: list[str] = []
    current_category: str | None = None
    products: list[ParsedRow] = []
    sections: list[ParsedRow] = []
    skipped = 0
    detected_brand = default_brand

    recognized_header_index = next(
        (index for index, cells in enumerate(all_rows) if _looks_like_header(cells)),
        None,
    )
    if recognized_header_index is None:
        recognized_header_index = next(
            (
                index
                for index, cells in enumerate(all_rows)
                if len(_nonempty_cells(cells)) >= 2 and not _is_footer(cells)
            ),
            None,
        )

    if recognized_header_index is not None:
        header_cells = [trim(c) for c in all_rows[recognized_header_index]]
        mapping = map_headers(header_cells)
        if column_overrides:
            for field, idx in column_overrides.items():
                if 0 <= idx < len(header_cells):
                    mapping[field] = DetectedColumn(
                        field,
                        header_cells[idx].strip() or field,
                        idx,
                    )

    for cells in all_rows[: recognized_header_index or 0]:
        joined = " ".join(_nonempty_cells(cells[:8])).lower()
        if "vital planet" in joined:
            detected_brand = detected_brand or "Vital Planet"

    start_index = (recognized_header_index + 1) if recognized_header_index is not None else 0
    skipped += start_index
    for zero_index, cells in enumerate(all_rows[start_index:], start=start_index):
        index = zero_index + 1
        if not _nonempty_cells(cells):
            skipped += 1
            continue
        if not mapping:
            skipped += 1
            continue
        if _looks_like_header(cells):
            skipped += 1
            continue
        if _is_footer(cells):
            skipped += 1
            continue
        name = _cell(cells, mapping, "name")
        if (
            name
            and detected_brand
            and slugify(name) == slugify(detected_brand)
            and not _cell(cells, mapping, "regular_price")
        ):
            skipped += 1
            continue
        # Product name is the only row-level signal required. Identifiers and
        # all descriptive fields may be blank; duplicate checks fall back to
        # brand + product name when no identifier is provided.
        is_product = bool(name)
        if is_product:
            products.append(
                parse_product_row(
                    cells,
                    mapping,
                    index,
                    current_category=current_category,
                    default_brand=detected_brand or default_brand,
                    default_discount_percent=default_discount_percent,
                )
            )
            continue
        heading = _is_section_row(cells, mapping)
        if heading:
            current_category = heading
            sections.append(
                ParsedRow(
                    source_row_number=index,
                    kind="section",
                    raw={"heading": heading},
                    name=heading,
                    category=heading,
                    brand=detected_brand or default_brand,
                )
            )
            continue
        skipped += 1

    upcs = [row.upc for row in products if row.upc]
    dupes = {u for u in upcs if upcs.count(u) > 1}
    for row in products:
        if row.upc and row.upc in dupes:
            row.errors.append("Duplicate UPC in this file.")

    return {
        "delimiter": delimiter,
        "file_sha256": sha256_bytes(content),
        "detected_brand": detected_brand or default_brand,
        "columns": {k: asdict(v) for k, v in mapping.items()},
        "header_cells": header_cells,
        "sections": [asdict(s) for s in sections],
        "products": [asdict(p) for p in products],
        "skipped_row_count": skipped,
        "stats": {
            "product_rows": len(products),
            "section_rows": len(sections),
            "upc_present": sum(1 for p in products if p.upc),
            "upc_missing": sum(1 for p in products if not p.upc),
            "duplicate_upc_count": len(dupes),
        },
    }


def suggested_mappings(columns: dict[str, Any]) -> dict[str, Any]:
    return columns
