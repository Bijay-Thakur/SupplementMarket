from __future__ import annotations

from pathlib import Path

import pytest

from app.catalog.csv_images import image_url_allowed, sniff_image
from app.catalog.csv_parse import parse_catalog_csv
from app.core.errors import ValidationError
from app.services.catalog_import import merge_nonblank

FIXTURE = Path(__file__).resolve().parents[3] / "docs" / "Vital Planet Order Form 9.2.26.csv"
MINI_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)
TEMPLATE = Path(__file__).resolve().parents[2] / "public" / "templates" / "product-import-template.csv"


def test_private_and_non_https_image_urls_rejected() -> None:
    assert image_url_allowed("http://example.com/a.jpg")[0] is False
    assert image_url_allowed("data:image/png;base64,abc")[0] is False
    assert image_url_allowed("file:///tmp/a.png")[0] is False
    assert image_url_allowed("https://127.0.0.1/a.png")[0] is False
    assert image_url_allowed("https://localhost/a.png")[0] is False
    assert image_url_allowed("https://192.168.1.10/a.png")[0] is False
    assert image_url_allowed("https://10.0.0.8/a.png")[0] is False
    assert image_url_allowed("https://169.254.169.254/latest/meta-data")[0] is False


def test_image_host_dns_is_cached_across_rows(monkeypatch) -> None:
    from app.catalog import csv_images

    calls = 0

    def fake_getaddrinfo(host, port, *, type):
        nonlocal calls
        calls += 1
        assert host == "images.example.test"
        assert port == 443
        return [(2, type, 6, "", ("93.184.216.34", 443))]

    csv_images._resolved_host_allowed.cache_clear()
    monkeypatch.setattr(csv_images.socket, "getaddrinfo", fake_getaddrinfo)
    assert image_url_allowed("https://images.example.test/a.jpg")[0] is True
    assert image_url_allowed("https://images.example.test/b.jpg")[0] is True
    assert calls == 1
    csv_images._resolved_host_allowed.cache_clear()


def test_sniff_image_uses_file_signature() -> None:
    assert sniff_image(MINI_PNG) == ("image/png", "png")
    assert sniff_image(b"not-an-image") is None
    assert sniff_image(b"GIF89a") is None


def test_blank_fields_do_not_overwrite() -> None:
    assert merge_nonblank("kept", "") == "kept"
    assert merge_nonblank("kept", None) == "kept"
    assert merge_nonblank("kept", "new") == "new"
    assert merge_nonblank(None, "new") == "new"


def test_duplicate_upc_is_an_error() -> None:
    csv = (
        "Item #,Product Description,Size,Form,UPC Code,MSRP,Price\n"
        "1,Alpha,30ct,Capsule,850964006651,10.00,6.00\n"
        "2,Beta,60ct,Capsule,850964006651,12.00,7.00\n"
    ).encode()
    result = parse_catalog_csv(csv, default_brand="Vital Planet")
    assert result["stats"]["duplicate_upc_count"] == 1
    assert all(p["errors"] for p in result["products"])


def test_ordinary_flat_csv_header() -> None:
    csv = (
        "Product Name,Brand,UPC,Regular Price,SKU\n"
        "Zinc,NOW,123456789012,19.99,ZN-1\n"
    ).encode()
    result = parse_catalog_csv(csv)
    assert result["stats"]["product_rows"] == 1
    assert result["products"][0]["upc"] == "123456789012"
    assert result["products"][0]["regular_price_cents"] == 1999


def test_direct_ingestion_template_maps_every_header() -> None:
    result = parse_catalog_csv(TEMPLATE.read_bytes())
    assert result["stats"]["product_rows"] == 0
    assert set(result["columns"]) == {
        "name",
        "brand",
        "category",
        "sku",
        "supplier_sku",
        "upc",
        "regular_price",
        "sale_price",
        "cost_price",
        "availability",
        "size",
        "form",
        "strength",
        "image",
    }


def test_direct_headers_parse_store_price_and_availability() -> None:
    csv = (
        "product_full_name,brand,sku,msrp,store_srp,availability\n"
        "Zinc 30 mg,NOW,ZN-30,19.99,14.99,low_stock\n"
    ).encode()
    result = parse_catalog_csv(csv)
    product = result["products"][0]
    assert product["name"] == "Zinc 30 mg"
    assert product["sale_price_cents"] == 1499
    assert product["availability"] == "low_stock"


def test_only_main_fields_are_required_and_optional_values_stay_empty() -> None:
    result = parse_catalog_csv(
        (
            "product_full_name,brand,msrp,sku,supplier_sku,upc,category,image_url\n"
            "Zinc 30 mg,NOW,19.99,,,,,\n"
        ).encode()
    )
    product = result["products"][0]
    assert product["errors"] == []
    assert product["name"] == "Zinc 30 mg"
    assert product["brand"] == "NOW"
    assert product["regular_price_cents"] == 1999
    assert product["sku"] is None
    assert product["supplier_sku"] is None
    assert product["upc"] is None
    assert product["category"] is None
    assert product["image_url"] is None


def test_unknown_headers_can_be_mapped_by_admin() -> None:
    csv = "Item title,Maker,Retail\nZinc 30 mg,NOW,19.99\n".encode()
    unmapped = parse_catalog_csv(csv)
    assert unmapped["header_cells"] == ["Item title", "Maker", "Retail"]
    assert unmapped["products"] == []

    mapped = parse_catalog_csv(
        csv,
        column_overrides={"name": 0, "brand": 1, "regular_price": 2},
    )
    assert mapped["products"][0]["name"] == "Zinc 30 mg"
    assert mapped["products"][0]["errors"] == []


def test_windows_csv_encoding_is_accepted() -> None:
    csv = "product_full_name,brand,msrp\nCrème Capsules,BioSil,24.99\n".encode("cp1252")
    result = parse_catalog_csv(csv)
    assert result["products"][0]["name"] == "Crème Capsules"


def test_preview_is_persisted_as_private_staging_data(monkeypatch) -> None:
    from app.core.config import settings
    from app.services import catalog_import as ci

    monkeypatch.setattr(settings, "next_public_supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "service-role")
    writes: list[tuple[str, dict]] = []

    class DummySb:
        def select(self, _table, _params):
            return []

        def insert(self, table, row):
            writes.append((table, row))
            return row

        def insert_many(self, table, rows):
            writes.append((table, rows))
            return rows

        def update(self, _table, _match, row):
            return row

    monkeypatch.setattr(ci, "sb", DummySb())
    preview = ci.preview_csv(
        (
            "product_full_name,brand,sku,msrp,availability\n"
            "Zinc 30 mg,NOW,ZN-30,19.99,in_stock\n"
        ).encode(),
        "products.csv",
        brand_name=None,
        discount_percent=None,
    )

    batch_write = next(row for table, row in writes if table == "catalog_import_batches")
    row_writes = next(row for table, row in writes if table == "catalog_import_rows")
    assert batch_write["id"] == preview["id"]
    assert batch_write["status"] == "awaiting_confirmation"
    assert batch_write["preview_metadata"]["columns"]["name"]["header"] == "product_full_name"
    assert len(row_writes) == 1
    assert row_writes[0]["normalized_data"]["name"] == "Zinc 30 mg"


def test_pending_review_can_resume_from_database(monkeypatch) -> None:
    from app.core.config import settings
    from app.services import catalog_import as ci

    monkeypatch.setattr(settings, "next_public_supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "service-role")
    batch_id = "11111111-1111-1111-1111-111111111111"

    class DummySb:
        def select(self, table, _params):
            if table == "catalog_import_batches":
                return [
                    {
                        "id": batch_id,
                        "filename": "products.csv",
                        "file_sha256": "abc",
                        "status": "awaiting_confirmation",
                        "default_discount_percent": 0,
                        "force_reprocess": False,
                        "preview_metadata": {
                            "columns": {"name": {"header": "product_full_name", "index": 0}},
                            "header_cells": ["product_full_name"],
                            "sections": [],
                            "brand_name": None,
                        },
                        "created_at": "2026-09-09T12:00:00Z",
                    }
                ]
            if table == "catalog_import_rows":
                return [
                    {
                        "source_row_number": 2,
                        "raw_data": {"name": "Zinc"},
                        "normalized_data": {
                            "name": "Zinc",
                            "brand": "NOW",
                            "included": True,
                            "availability": "in_stock",
                        },
                        "detected_action": "insert",
                        "validation_errors": [],
                        "validation_warnings": [],
                    }
                ]
            return []

    monkeypatch.setattr(ci, "sb", DummySb())
    ci._BATCHES.pop(batch_id, None)
    resumed = ci.get_batch(batch_id)
    assert resumed["id"] == batch_id
    assert resumed["rows"][0]["name"] == "Zinc"
    assert resumed["stats"]["new"] == 1


def test_excluding_one_file_duplicate_revalidates_the_remaining_row(monkeypatch) -> None:
    from app.core.config import settings
    from app.services import catalog_import as ci

    monkeypatch.setattr(settings, "next_public_supabase_url", "")
    monkeypatch.setattr(settings, "supabase_service_role_key", "")
    preview = ci.preview_csv(
        (
            "product_full_name,brand,sku,msrp\n"
            "Zinc 30 mg,NOW,ZN-30,19.99\n"
            "Zinc 60 mg,NOW,ZN-30,24.99\n"
        ).encode(),
        "duplicates.csv",
        brand_name=None,
        discount_percent=None,
    )
    assert preview["stats"]["conflicts"] == 2

    first_row = preview["rows"][0]["source_row_number"]
    reviewed = ci.update_preview_selection(preview["id"], [first_row])
    assert reviewed["stats"]["conflicts"] == 0
    assert reviewed["stats"]["new"] == 1
    assert reviewed["stats"]["skipped"] == 1


def test_live_admin_rejects_missing_token(client) -> None:
    r = client.get("/api/v1/admin/live/products")
    assert r.status_code == 401
    body = r.json()
    assert "password" not in str(body).lower()
    assert "traceback" not in str(body).lower()


def test_live_admin_rejects_internal_token_without_jwt(client) -> None:
    r = client.post(
        "/api/v1/admin/live/catalog-imports/preview",
        headers={"x-bnm-internal-token": "not-the-secret"},
        files={"file": ("x.csv", b"a,b\n", "text/csv")},
    )
    assert r.status_code == 401


def test_optional_image_failure_does_not_raise(monkeypatch) -> None:
    from app.services import catalog_import as ci

    class DummySb:
        def select(self, *_args, **_kwargs):
            return []

    monkeypatch.setattr(ci, "sb", DummySb())
    monkeypatch.setattr(ci, "download_product_image", lambda _url: None)
    row = {"image_url": "https://example.com/a.jpg", "warnings": []}
    ci._try_attach_image(row, "vital-planet", "zinc", "product-id")
    assert any("without an image" in w for w in row["warnings"])


def test_preview_blocks_duplicate_until_admin_approves_update(monkeypatch) -> None:
    from app.core.config import settings
    from app.services import catalog_import as ci

    monkeypatch.setattr(settings, "next_public_supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "service-role")

    class DummySb:
        def select(self, table, params):
            if table == "product_variants":
                return [
                    {
                        "id": "v1",
                        "product_id": "p1",
                        "upc": "850964006651",
                        "supplier_sku": "19050",
                        "source_name": "vital-planet",
                        "regular_price_cents": 6999,
                        "sale_price_cents": None,
                        "form": "capsule",
                        "unit_count": 30,
                        "size_value": None,
                        "size_unit": None,
                        "strength_value": 100,
                        "strength_unit": "Billion CFU",
                        "cost_price_cents": 4199,
                        "label": "30ct",
                    }
                ]
            if table == "products":
                return [{"id": "p1", "name": "Vital Flora 100B, 60 Strain", "slug": "flora", "brand_id": "b1", "category_id": None, "short_description": None, "description": None, "status": "active"}]
            if table == "brands":
                return [{"id": "b1", "name": "Vital Planet", "slug": "vital-planet"}]
            if table == "catalog_import_batches":
                return [{"id": "prev", "filename": "Vital Planet Order Form 9.2.26.csv", "file_sha256": "x", "status": "completed", "inserted_rows": 104, "updated_rows": 0, "unchanged_rows": 0, "created_at": "2026-01-01"}]
            return []

    monkeypatch.setattr(ci, "sb", DummySb())
    monkeypatch.setattr(ci, "_persist_preview_batch", lambda _batch: None)
    monkeypatch.setattr(ci, "_persist_preview_row", lambda _batch, _row: None)
    monkeypatch.setattr(ci, "_persist_preview_stats", lambda _batch: None)
    preview = ci.preview_csv(
        FIXTURE.read_bytes(),
        "Vital Planet Order Form 9.2.26.csv",
        brand_name="Vital Planet",
        discount_percent=20,
    )
    actions = {row["detected_action"] for row in preview["rows"]}
    assert "conflict" in actions
    assert preview["already_imported"] is True
    conflict = next(row for row in preview["rows"] if row["detected_action"] == "conflict")
    assert conflict["duplicate_match"]["product_name"] == "Vital Flora 100B, 60 Strain"

    with pytest.raises(ValidationError, match="Resolve or exclude"):
        ci.commit_csv(
            preview["id"],
            included_row_numbers=[conflict["source_row_number"]],
            force_reprocess=True,
        )

    resolved = ci.update_preview_row(
        preview["id"],
        conflict["source_row_number"],
        {"resolution": "update_existing"},
    )
    resolved_row = next(
        row for row in resolved["rows"] if row["source_row_number"] == conflict["source_row_number"]
    )
    assert resolved_row["detected_action"] in {"update", "unchanged"}
    assert resolved_row["approved_existing_variant_id"] == "v1"


def test_public_admin_payload_hides_cost_when_requested() -> None:
    from app.api.routes_admin_csv import _public_product

    payload = _public_product(
        {
            "id": "p1",
            "name": "Zinc",
            "slug": "zinc",
            "status": "active",
            "is_featured": False,
            "is_best_seller": False,
            "is_new": False,
            "short_description": None,
            "updated_at": None,
            "brands": {"name": "NOW", "slug": "now"},
            "categories": {"name": "Minerals", "slug": "minerals"},
            "product_variants": [
                {
                    "form": "capsule",
                    "unit_count": 30,
                    "regular_price_cents": 1999,
                    "sale_price_cents": None,
                    "cost_price_cents": 800,
                    "availability": "in_stock",
                    "sku": "ZN",
                    "upc": "123",
                }
            ],
            "product_images": [],
        },
        include_cost=False,
    )
    assert "cost_price_cents" not in payload
    assert payload["regular_price_cents"] == 1999
