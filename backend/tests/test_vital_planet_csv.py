from __future__ import annotations

from pathlib import Path

from app.catalog.csv_normalize import dollars_to_cents, normalize_upc, parse_size, parse_strength, sale_from_discount
from app.catalog.csv_parse import parse_catalog_csv

FIXTURE = Path(__file__).resolve().parents[2] / "docs" / "Vital Planet Order Form 9.2.26.csv"


def test_vital_planet_order_form_counts() -> None:
    result = parse_catalog_csv(
        FIXTURE.read_bytes(),
        default_brand="Vital Planet",
        default_discount_percent=20,
    )
    stats = result["stats"]
    assert stats["product_rows"] == 104
    assert stats["section_rows"] == 11
    assert stats["upc_present"] == 99
    assert stats["upc_missing"] == 5
    assert stats["duplicate_upc_count"] == 0
    assert result["detected_brand"] == "Vital Planet"
    headings = [s["name"] for s in result["sections"]]
    assert "REFRIGERATED PROBIOTICS" in headings
    assert "BOOKS BY BRENDA WATSON" in headings
    assert not any("candy lane" in (h or "").lower() for h in headings)
    assert not any("restocking" in (h or "").lower() for h in headings)
    books = [p for p in result["products"] if not p["upc"]]
    assert len(books) == 5
    sample = next(p for p in result["products"] if p["supplier_sku"] == "19050")
    assert sample["upc"] == "850964006651"
    assert sample["regular_price_cents"] == 6999
    assert sample["cost_price_cents"] == 4199
    assert sample["sale_price_cents"] == sale_from_discount(6999, 20)
    assert sample["form"] == "capsule"
    assert sample["unit_count"] == 30
    assert sample["name"].startswith("Vital Flora 100B")


def test_currency_and_upc_helpers() -> None:
    assert dollars_to_cents("$1,234.56") == 123456
    assert dollars_to_cents("41.99") == 4199
    upc, warnings = normalize_upc("850964006651")
    assert upc == "850964006651"
    assert isinstance(upc, str)
    leading, _ = normalize_upc("000123456789")
    assert leading == "000123456789"


def test_size_and_strength_parsing() -> None:
    assert parse_size("30ct")["unit_count"] == 30
    assert parse_size("60 ct")["unit_count"] == 60
    oz = parse_size("2 oz")
    assert oz["size_value"] == 2
    assert oz["size_unit"] == "oz"
    strength = parse_strength("Calcium 1000 mg")
    assert strength["strength_value"] == 1000
    assert strength["strength_unit"] == "mg"
    billion = parse_strength("Vital Flora 60B, 60 Strain")
    assert billion["strength_value"] == 60
    assert "Billion" in billion["strength_unit"]


def test_footer_and_case_price_ignored() -> None:
    result = parse_catalog_csv(FIXTURE.read_bytes(), default_brand="Vital Planet")
    names = " ".join(p["name"] or "" for p in result["products"]).lower()
    assert "restocking fee" not in names
    assert "palm harbor" not in names
    sample = next(p for p in result["products"] if p["supplier_sku"] == "19050")
    assert sample["regular_price_cents"] != 50388
    assert sample["sale_price_cents"] is None
