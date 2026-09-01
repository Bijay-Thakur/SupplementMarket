"""API integration tests for catalog, admin mutations, search, orders, CSV, images."""
from __future__ import annotations

import io

from app.services.search import expand_terms
from app.seed.demo import PRODUCTS, seed_demo


MINI_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_inactive_products_hidden(client, product, db_session):
    product.is_active = False
    db_session.commit()
    r = client.get("/api/v1/products")
    assert r.status_code == 200
    assert all(i["slug"] != product.slug for i in r.json()["items"])


def test_product_filters_and_pagination(client, product):
    r = client.get("/api/v1/products", params={"q": "d3", "page": 1, "page_size": 10})
    assert r.status_code == 200
    body = r.json()
    assert body["page"] == 1
    assert any("D3" in i["name"] for i in body["items"])

    r2 = client.get("/api/v1/products", params={"on_sale": True})
    assert r2.status_code == 200
    assert all(i["on_sale"] for i in r2.json()["items"])


def test_search_synonyms():
    terms = expand_terms("fish oil")
    assert "omega 3" in terms
    pain = expand_terms("pain relief")
    assert "joint support" in pain
    assert "treat" not in " ".join(pain)


def test_search_curamin_alias(client, db_session, brand, category):
    from app.models import Product

    p = Product(
        brand_id=brand.id,
        category_id=category.id,
        name="Demo Turmeric Blend",
        slug="demo-turmeric-blend",
        sku="DEMO-CUR-001",
        regular_price_cents=1999,
        availability="in_stock",
        is_active=True,
        is_demo=True,
        search_aliases="curamin, curcumin",
    )
    db_session.add(p)
    db_session.commit()
    r = client.get("/api/v1/products", params={"q": "curamin"})
    names = [i["name"] for i in r.json()["items"]]
    assert "Demo Turmeric Blend" in names


def test_admin_product_crud_and_price_validation(client, brand, category):
    payload = {
        "brand_id": brand.id,
        "category_id": category.id,
        "name": "Demo Magnesium 400",
        "sku": "DEMO-MG-400",
        "regular_price_cents": 2000,
        "sale_price_cents": 1500,
        "availability": "in_stock",
        "is_active": True,
    }
    created = client.post("/api/v1/admin/products", json=payload)
    assert created.status_code == 201
    body = created.json()
    assert body["discount_percent"] == 25
    assert body["effective_price_cents"] == 1500
    pid = body["id"]

    bad = client.patch(
        f"/api/v1/admin/products/{pid}",
        json={"sale_price_cents": 2500},
    )
    assert bad.status_code == 422

    archived = client.delete(f"/api/v1/admin/products/{pid}")
    assert archived.status_code == 200
    assert archived.json()["is_archived"] is True
    hidden = client.get("/api/v1/products")
    assert all(i["id"] != pid for i in hidden.json()["items"])


def test_duplicate_sku_rejected(client, product, brand, category):
    r = client.post(
        "/api/v1/admin/products",
        json={
            "brand_id": brand.id,
            "category_id": category.id,
            "name": "Other",
            "sku": product.sku,
            "regular_price_cents": 1000,
        },
    )
    assert r.status_code == 409


def test_order_recalculates_totals_and_idempotency(client, product):
    payload = {
        "idempotency_key": "test-key-aaaa-bbbb-cccc",
        "fulfillment_type": "pickup",
        "customer_name": "Alex Demo",
        "customer_email": "alex@example.com",
        "customer_phone": "555-0100",
        "items": [{"product_id": product.id, "quantity": 2}],
    }
    first = client.post("/api/v1/orders", json=payload)
    assert first.status_code == 201
    body = first.json()
    assert body["total_cents"] == 1499 * 2
    assert body["public_token"]

    second = client.post("/api/v1/orders", json=payload)
    assert second.status_code in (200, 201)
    assert second.json()["order_number"] == body["order_number"]

    conflict = client.post(
        "/api/v1/orders",
        json={**payload, "items": [{"product_id": product.id, "quantity": 1}]},
    )
    assert conflict.status_code == 409


def test_out_of_stock_cannot_order(client, product, db_session):
    product.availability = "out_of_stock"
    db_session.commit()
    r = client.post(
        "/api/v1/orders",
        json={
            "idempotency_key": "oos-key-1111-2222",
            "fulfillment_type": "pickup",
            "customer_name": "Alex Demo",
            "customer_email": "alex@example.com",
            "customer_phone": "555-0100",
            "items": [{"product_id": product.id, "quantity": 1}],
        },
    )
    assert r.status_code == 422


def test_image_upload_rejects_invalid(client, product):
    r = client.post(
        f"/api/v1/admin/products/{product.id}/images",
        files={"file": ("x.txt", b"not-an-image", "text/plain")},
    )
    assert r.status_code == 422

    ok = client.post(
        f"/api/v1/admin/products/{product.id}/images",
        files={"file": ("dot.png", MINI_PNG, "image/png")},
    )
    assert ok.status_code == 201
    assert ok.json()["is_primary"] is True


def test_csv_preview_and_commit(client, brand, category):
    csv_body = (
        "name,brand,category,sku,upc,form,size,count,strength_value,strength_unit,"
        "regular_price,sale_price,availability,short_description,vegan,vegetarian,"
        "organic,gluten_free,soy_free,dairy_free,alcohol_free,non_gmo,search_aliases,"
        "wellness_tags,ingredient_highlights,source_url,source_type\n"
        f"Imported D3,{brand.name},{category.name},IMP-D3-1,,softgel,,60,2000,IU,"
        "12.00,9.00,in_stock,Demo row,1,1,0,1,1,1,1,1,d3,,,,owner_spreadsheet\n"
        "Bad row,MissingBrand,MissingCat,IMP-BAD,,,,,,,,,,,0,0,0,0,0,0,0,0,,,,,\n"
    )
    preview = client.post(
        "/api/v1/admin/products/bulk-import/preview",
        files={"file": ("cat.csv", csv_body.encode(), "text/csv")},
    )
    assert preview.status_code == 200
    data = preview.json()
    assert data["creatable"] == 1
    assert data["invalid"] == 1

    commit = client.post(
        "/api/v1/admin/products/bulk-import/commit",
        files={"file": ("cat.csv", csv_body.encode(), "text/csv")},
    )
    assert commit.status_code == 200
    assert commit.json()["created"] == 1
    # Imported products stay in review (inactive).
    listed = client.get("/api/v1/products", params={"q": "Imported D3"})
    assert listed.json()["total"] == 0


def test_demo_seed_count(db_session):
    counts = seed_demo(db_session, reset=True)
    assert counts["products"] >= 48
    assert len(PRODUCTS) >= 48


def test_suggestions(client, product):
    r = client.get("/api/v1/products/suggestions", params={"q": "vita"})
    assert r.status_code == 200
    assert any("Vitamin" in i["name"] for i in r.json()["items"])
