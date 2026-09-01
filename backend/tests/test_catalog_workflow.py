"""Admin catalog import workflow: stage → approve → import → storefront."""
from __future__ import annotations

from datetime import datetime

from app.catalog.import_to_catalog import import_approved
from app.catalog.persist import stage_product
from app.catalog.pipeline import ensure_sources
from app.catalog.review import approve, reject
from app.catalog.types import ParsedProduct
from app.core.utils import public_token
from app.models import CatalogImportRun, Product


def _stage(db, name="Vitamin D3 5000 IU", sku="WFLOW-D3"):
    ensure_sources(db)
    run = CatalogImportRun(
        id=public_token()[:22],
        status="collected",
        brand_slugs=["now-foods"],
        per_brand_limit=6,
        download_images=False,
        dry_run=True,
        stats={},
    )
    db.add(run)
    db.commit()
    parsed = ParsedProduct(
        brand="NOW Foods",
        parent_brand="NOW Foods",
        product_line=None,
        name=name,
        sku=sku,
        upc="733739003458",
        canonical_url=f"https://www.nowfoods.com/products/{sku.lower()}",
        source_domain="www.nowfoods.com",
        primary_category="Vitamin D",
        form="softgel",
        count=120,
        strength_value=5000,
        strength_unit="IU",
        short_description="NOW Foods Vitamin D3 5000 IU. softgel.",
        extraction_method="jsonld",
        parser_version="2b.1",
        source_content_hash="abc",
        collected_at=datetime.utcnow(),
    )
    row = stage_product(
        db,
        run_id=run.id,
        source_id=None,
        parsed=parsed,
        errors=[],
        policy_status="permitted",
        image_rel=None,
        image_hash=None,
        image_status="missing_or_permission_required",
        original_path=None,
        source_url=None,
        mime=None,
        size_bytes=None,
        alt_text=None,
    )
    db.commit()
    return run, row


def test_approve_idempotent_and_import(client, db_session):
    run, row = _stage(db_session)
    n1 = approve(db_session, run.id, [row.id])
    n2 = approve(db_session, run.id, [row.id])
    assert n1 == 1
    assert n2 == 0
    result = import_approved(db_session, run.id, activate=True)
    assert result["created"] == 1
    again = import_approved(db_session, run.id, activate=True)
    assert again["created"] == 0
    product = db_session.get(Product, row.imported_product_id)
    assert product is not None
    assert product.source_url.startswith("https://www.nowfoods.com/")
    assert product.price_is_demo is True
    assert product.source_type == "official_manufacturer_page"
    assert product.parent_brand == "NOW Foods"
    r = client.get("/api/v1/products")
    names = [i["name"] for i in r.json()["items"]]
    assert "Vitamin D3 5000 IU" in names


def test_reimport_does_not_overwrite_admin_fields(db_session):
    run, row = _stage(db_session, name="Magnesium Glycinate", sku="WFLOW-MG")
    approve(db_session, run.id, [row.id])
    import_approved(db_session, run.id, activate=False)
    db_session.refresh(row)
    product = db_session.get(Product, row.imported_product_id)
    product.short_description = "Admin edited description"
    row.admin_edited_fields = ["short_description"]
    db_session.commit()
    row.short_description = "Collector overwrite attempt"
    from app.catalog.import_to_catalog import _refresh_source_only

    _refresh_source_only(product, row)
    db_session.commit()
    db_session.refresh(product)
    assert product.short_description == "Admin edited description"
    assert product.source_url


def test_reject_and_api_list(client, db_session):
    run, row = _stage(db_session, name="Twinlab Daily One", sku="WFLOW-T1")
    reject(db_session, run.id, [row.id])
    r = client.get("/api/v1/admin/catalog-imports")
    assert r.status_code == 200
    assert any(item["id"] == run.id for item in r.json())
    detail = client.get(f"/api/v1/admin/catalog-imports/{run.id}")
    assert detail.status_code == 200
    assert detail.json()["products"][0]["status"] == "rejected"


def test_bulk_approve_reject_api(client, db_session):
    run, row = _stage(db_session, name="Gaia Turmeric", sku="WFLOW-GAIA")
    a = client.post(
        f"/api/v1/admin/catalog-imports/{run.id}/approve",
        json={"ids": [row.id]},
    )
    assert a.status_code == 200
    a2 = client.post(
        f"/api/v1/admin/catalog-imports/{run.id}/approve",
        json={"ids": [row.id]},
    )
    assert a2.json()["updated"] == 0
    rj = client.post(
        f"/api/v1/admin/catalog-imports/{run.id}/reject",
        json={"ids": [row.id]},
    )
    assert rj.status_code == 200


def test_sources_endpoint(client, db_session):
    r = client.get("/api/v1/admin/catalog-sources")
    assert r.status_code == 200
    slugs = {s["slug"] for s in r.json()}
    assert "now-foods" in slugs
    assert "solgar" in slugs
