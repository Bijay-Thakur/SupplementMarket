"""Development-only catalog ingestion APIs. Not authentication — disabled outside development."""
from __future__ import annotations

import csv
import io
import threading

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_dev
from app.catalog.pipeline import collect_run, ensure_sources
from app.catalog.review import approve, bulk_recalculate, do_import, edit_staged, reject
from app.core.errors import NotFoundError, ValidationError
from app.core.utils import public_token
from app.db.base import SessionLocal, get_db
from app.models import CatalogImportError, CatalogImportRun, CatalogSource, CatalogStagedProduct
from app.schemas.catalog_import import (
    CatalogImportCreate,
    CatalogRunDetail,
    CatalogRunSummary,
    CatalogSourceOut,
    CatalogSourcePatch,
    IdsPayload,
    ImportPayload,
    StagedImageOut,
    StagedPatch,
    StagedProductOut,
)
from app.services.serialize import MEDIA_PREFIX

sources_router = APIRouter(
    prefix="/admin/catalog-sources",
    tags=["admin:catalog-imports"],
    dependencies=[Depends(require_dev)],
)
imports_router = APIRouter(
    prefix="/admin/catalog-imports",
    tags=["admin:catalog-imports"],
    dependencies=[Depends(require_dev)],
)


def _source_out(s: CatalogSource) -> CatalogSourceOut:
    return CatalogSourceOut(
        id=s.id,
        slug=s.slug,
        name=s.name,
        parent_brand=s.parent_brand,
        official_url=s.official_url,
        collection_url=s.collection_url,
        domain=s.domain,
        enabled=s.enabled,
        product_limit=s.product_limit,
        policy_status=s.policy_status,
        policy_notes=s.policy_notes,
        robots_status=s.robots_status,
        last_checked_at=s.last_checked_at,
        last_run_id=s.last_run_id,
        last_result=s.last_result,
    )


def _thumb(p: CatalogStagedProduct) -> str | None:
    img = next((i for i in p.images if i.optimized_filename), None)
    if img and img.optimized_filename:
        return f"{MEDIA_PREFIX}/{img.optimized_filename}"
    return None


def _product_out(p: CatalogStagedProduct, *, include_snapshot: bool = False) -> StagedProductOut:
    return StagedProductOut(
        id=p.id,
        status=p.status,
        brand=p.brand,
        name=p.name,
        variant_name=p.variant_name,
        primary_category=p.primary_category,
        form=p.form,
        strength_value=float(p.strength_value) if p.strength_value is not None else None,
        strength_unit=p.strength_unit,
        count=p.count,
        size=p.size,
        vegan=p.vegan,
        vegetarian=p.vegetarian,
        organic=p.organic,
        gluten_free=p.gluten_free,
        non_gmo=p.non_gmo,
        source_price_cents=p.source_price_cents,
        regular_price_cents=p.regular_price_cents,
        discount_percent=p.discount_percent,
        sale_price_cents=p.sale_price_cents,
        price_is_demo=p.price_is_demo,
        official_bestseller=p.official_bestseller,
        official_featured=p.official_featured,
        official_new=p.official_new,
        image_status=p.image_status,
        source_policy_status=p.source_policy_status,
        validation_errors=p.validation_errors,
        duplicate_key=p.duplicate_key,
        canonical_url=p.canonical_url,
        short_description=p.short_description,
        sku=p.sku,
        upc=p.upc,
        extraction_method=p.extraction_method,
        image_use_status=p.image_use_status,
        imported_product_id=p.imported_product_id,
        thumbnail_url=_thumb(p),
        images=[
            StagedImageOut(
                id=i.id,
                source_url=i.source_url,
                optimized_url=f"{MEDIA_PREFIX}/{i.optimized_filename}" if i.optimized_filename else None,
                alt_text=i.alt_text,
                status=i.status,
                permission_status=i.permission_status,
                sha256=i.sha256,
            )
            for i in p.images
        ],
        source_snapshot=p.source_snapshot if include_snapshot else None,
        admin_edited_fields=p.admin_edited_fields,
    )


def _run_summary(run: CatalogImportRun, count: int | None = None) -> CatalogRunSummary:
    n = count if count is not None else len(run.products or [])
    return CatalogRunSummary(
        id=run.id,
        status=run.status,
        started_at=run.started_at,
        completed_at=run.completed_at,
        brand_slugs=list(run.brand_slugs or []),
        per_brand_limit=run.per_brand_limit,
        download_images=run.download_images,
        dry_run=run.dry_run,
        stats=run.stats or {},
        robots_summary=run.robots_summary or {},
        error_message=run.error_message,
        product_count=n,
    )


def _bg_collect(run_id: str) -> None:
    db = SessionLocal()
    try:
        collect_run(db, run_id)
    except Exception:
        run = db.get(CatalogImportRun, run_id)
        if run:
            run.status = "failed"
            db.commit()
    finally:
        db.close()


@sources_router.get("", response_model=list[CatalogSourceOut])
def list_sources(db: Session = Depends(get_db)):
    ensure_sources(db)
    rows = list(db.execute(select(CatalogSource).order_by(CatalogSource.name)).scalars())
    return [_source_out(s) for s in rows]


@sources_router.patch("/{source_id}", response_model=CatalogSourceOut)
def patch_source(source_id: int, payload: CatalogSourcePatch, db: Session = Depends(get_db)):
    row = db.get(CatalogSource, source_id)
    if row is None:
        raise NotFoundError("Source not found.")
    if payload.enabled is not None:
        row.enabled = payload.enabled
    if payload.product_limit is not None:
        row.product_limit = payload.product_limit
    db.commit()
    db.refresh(row)
    return _source_out(row)


@imports_router.post("", response_model=CatalogRunSummary, status_code=201)
def create_import(payload: CatalogImportCreate, db: Session = Depends(get_db)):
    ensure_sources(db)
    known = {s.slug for s in db.execute(select(CatalogSource)).scalars()}
    unknown = [s for s in payload.brand_slugs if s not in known]
    if unknown:
        raise ValidationError("Unknown brand slug(s).", fields={"brand_slugs": ", ".join(unknown)})
    run = CatalogImportRun(
        id=public_token()[:22],
        status="pending",
        brand_slugs=payload.brand_slugs,
        per_brand_limit=payload.per_brand_limit,
        prioritize_categories=payload.prioritize_categories,
        download_images=payload.download_images and not payload.dry_run,
        dry_run=payload.dry_run,
        stats={},
    )
    db.add(run)
    db.commit()
    if payload.collect_now:
        threading.Thread(target=_bg_collect, args=(run.id,), daemon=True).start()
        run.status = "collecting"
        db.commit()
    return _run_summary(run, 0)


@imports_router.get("", response_model=list[CatalogRunSummary])
def list_imports(db: Session = Depends(get_db)):
    rows = list(db.execute(select(CatalogImportRun).order_by(CatalogImportRun.created_at.desc())).scalars())
    out = []
    for run in rows:
        n = db.execute(
            select(CatalogStagedProduct).where(CatalogStagedProduct.run_id == run.id)
        ).scalars()
        out.append(_run_summary(run, len(list(n))))
    return out


@imports_router.get("/{run_id}", response_model=CatalogRunDetail)
def get_import(
    run_id: str,
    db: Session = Depends(get_db),
    q: str | None = Query(default=None, max_length=100),
    brand: str | None = None,
    category: str | None = None,
    status: str | None = None,
    image_status: str | None = None,
    duplicate: bool | None = None,
):
    run = db.get(CatalogImportRun, run_id)
    if run is None:
        raise NotFoundError("Import run not found.")
    stmt = (
        select(CatalogStagedProduct)
        .where(CatalogStagedProduct.run_id == run_id)
        .options(selectinload(CatalogStagedProduct.images))
    )
    rows = list(db.execute(stmt).scalars())
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in r.name.lower() or ql in r.brand.lower()]
    if brand:
        rows = [r for r in rows if r.brand_slug == brand or r.brand.lower() == brand.lower()]
    if category:
        rows = [r for r in rows if (r.primary_category or "").lower() == category.lower()]
    if status:
        rows = [r for r in rows if r.status == status]
    if image_status:
        rows = [r for r in rows if r.image_status == image_status]
    if duplicate is True:
        rows = [r for r in rows if r.duplicate_key]
    if duplicate is False:
        rows = [r for r in rows if not r.duplicate_key]
    detail = CatalogRunDetail(
        **_run_summary(run, len(rows)).model_dump(),
        products=[_product_out(p, include_snapshot=True) for p in rows],
    )
    return detail


@imports_router.post("/{run_id}/collect", response_model=CatalogRunSummary)
def start_collect(run_id: str, db: Session = Depends(get_db)):
    run = db.get(CatalogImportRun, run_id)
    if run is None:
        raise NotFoundError("Import run not found.")
    threading.Thread(target=_bg_collect, args=(run_id,), daemon=True).start()
    run.status = "collecting"
    db.commit()
    return _run_summary(run, 0)


@imports_router.post("/{run_id}/approve")
def approve_products(run_id: str, payload: IdsPayload, db: Session = Depends(get_db)):
    n = approve(db, run_id, payload.ids, payload.note)
    return {"ok": True, "updated": n}


@imports_router.post("/{run_id}/reject")
def reject_products(run_id: str, payload: IdsPayload, db: Session = Depends(get_db)):
    n = reject(db, run_id, payload.ids, payload.note)
    return {"ok": True, "updated": n}


@imports_router.post("/{run_id}/import")
def import_products(run_id: str, payload: ImportPayload, db: Session = Depends(get_db)):
    result = do_import(db, run_id, activate=payload.activate_after_import, ids=payload.ids)
    return {"ok": True, **result}


@imports_router.post("/{run_id}/recalculate")
def recalculate(run_id: str, payload: IdsPayload | None = None, db: Session = Depends(get_db)):
    ids = payload.ids if payload else None
    n = bulk_recalculate(db, run_id, ids)
    return {"ok": True, "updated": n}


@imports_router.patch("/{run_id}/products/{product_id}", response_model=StagedProductOut)
def patch_staged(run_id: str, product_id: int, payload: StagedPatch, db: Session = Depends(get_db)):
    fields = payload.model_dump(exclude_unset=True)
    row = edit_staged(db, run_id, product_id, fields)
    db.refresh(row)
    return _product_out(row, include_snapshot=True)


@imports_router.get("/{run_id}/export")
def export_csv(run_id: str, db: Session = Depends(get_db)):
    run = db.get(CatalogImportRun, run_id)
    if run is None:
        raise NotFoundError("Import run not found.")
    rows = list(db.execute(select(CatalogStagedProduct).where(CatalogStagedProduct.run_id == run_id)).scalars())
    buf = io.StringIO()
    fields = [
        "id",
        "brand",
        "name",
        "variant_name",
        "primary_category",
        "form",
        "sku",
        "upc",
        "canonical_url",
        "source_price_cents",
        "regular_price_cents",
        "discount_percent",
        "sale_price_cents",
        "image_status",
        "status",
        "duplicate_key",
    ]
    w = csv.DictWriter(buf, fieldnames=fields)
    w.writeheader()
    for r in rows:
        w.writerow({k: getattr(r, k) for k in fields})
    return PlainTextResponse(
        buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=catalog-run-{run_id}.csv"},
    )


@imports_router.get("/{run_id}/errors")
def export_errors(run_id: str, db: Session = Depends(get_db)):
    run = db.get(CatalogImportRun, run_id)
    if run is None:
        raise NotFoundError("Import run not found.")
    rows = list(db.execute(select(CatalogImportError).where(CatalogImportError.run_id == run_id)).scalars())
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "brand_slug", "url", "fatal", "message", "created_at"])
    for r in rows:
        w.writerow([r.id, r.brand_slug, r.url, r.fatal, r.message, r.created_at])
    return PlainTextResponse(
        buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=catalog-run-{run_id}-errors.csv"},
    )


@imports_router.post("/{run_id}/retry-failed", response_model=CatalogRunSummary)
def retry(run_id: str, db: Session = Depends(get_db)):
    threading.Thread(target=_bg_collect, args=(run_id,), daemon=True).start()
    run = db.get(CatalogImportRun, run_id)
    if run is None:
        raise NotFoundError("Import run not found.")
    run.status = "collecting"
    db.commit()
    return _run_summary(run, 0)
