from __future__ import annotations

from pathlib import Path

from app.catalog.csv_images import image_url_allowed, sniff_image
from app.catalog.csv_parse import parse_catalog_csv
from app.services.catalog_import import merge_nonblank

FIXTURE = Path(__file__).resolve().parents[3] / "docs" / "Vital Planet Order Form 9.2.26.csv"
MINI_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_private_and_non_https_image_urls_rejected() -> None:
    assert image_url_allowed("http://example.com/a.jpg")[0] is False
    assert image_url_allowed("data:image/png;base64,abc")[0] is False
    assert image_url_allowed("file:///tmp/a.png")[0] is False
    assert image_url_allowed("https://127.0.0.1/a.png")[0] is False
    assert image_url_allowed("https://localhost/a.png")[0] is False
    assert image_url_allowed("https://192.168.1.10/a.png")[0] is False
    assert image_url_allowed("https://10.0.0.8/a.png")[0] is False
    assert image_url_allowed("https://169.254.169.254/latest/meta-data")[0] is False


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


def test_preview_insert_vs_update_and_idempotency(monkeypatch) -> None:
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
    preview = ci.preview_csv(
        FIXTURE.read_bytes(),
        "Vital Planet Order Form 9.2.26.csv",
        brand_name="Vital Planet",
        discount_percent=20,
    )
    actions = {row["detected_action"] for row in preview["rows"]}
    assert "update" in actions or "unchanged" in actions
    assert preview["already_imported"] is True


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
