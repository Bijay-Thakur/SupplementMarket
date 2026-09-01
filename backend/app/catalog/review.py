"""Approve, reject, edit, and import staged catalog products (idempotent)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog.import_to_catalog import import_approved
from app.catalog.persist import recalculate_demo_prices
from app.core.errors import NotFoundError, ValidationError
from app.core.utils import utcnow
from app.models import CatalogImportApproval, CatalogImportRun, CatalogStagedProduct

EDITABLE = (
    "name",
    "variant_name",
    "primary_category",
    "secondary_category",
    "form",
    "short_description",
    "regular_price_cents",
    "sale_price_cents",
    "discount_percent",
    "vegan",
    "vegetarian",
    "organic",
    "non_gmo",
    "gluten_free",
    "soy_free",
    "dairy_free",
    "sugar_free",
    "alcohol_free",
    "kosher",
    "halal",
    "ingredient_highlights",
    "suggested_use",
    "search_aliases",
    "strength_value",
    "strength_unit",
    "count",
    "size",
)


def _rows(db: Session, run_id: str, ids: list[int]) -> list[CatalogStagedProduct]:
    run = db.get(CatalogImportRun, run_id)
    if run is None:
        raise NotFoundError("Import run not found.")
    q = select(CatalogStagedProduct).where(
        CatalogStagedProduct.run_id == run_id,
        CatalogStagedProduct.id.in_(ids),
    )
    found = list(db.execute(q).scalars())
    if len(found) != len(set(ids)):
        raise NotFoundError("One or more staged products were not found in this run.")
    return found


def approve(db: Session, run_id: str, ids: list[int], note: str | None = None) -> int:
    n = 0
    for row in _rows(db, run_id, ids):
        if row.status == "imported":
            continue
        if row.status == "approved":
            continue
        row.status = "approved"
        db.add(
            CatalogImportApproval(
                product_id=row.id, run_id=run_id, action="approve", note=note
            )
        )
        n += 1
    db.commit()
    return n


def reject(db: Session, run_id: str, ids: list[int], note: str | None = None) -> int:
    n = 0
    for row in _rows(db, run_id, ids):
        if row.status == "imported":
            continue
        if row.status == "rejected":
            continue
        row.status = "rejected"
        db.add(
            CatalogImportApproval(
                product_id=row.id, run_id=run_id, action="reject", note=note
            )
        )
        n += 1
    db.commit()
    return n


def edit_staged(db: Session, run_id: str, product_id: int, fields: dict) -> CatalogStagedProduct:
    row = db.get(CatalogStagedProduct, product_id)
    if row is None or row.run_id != run_id:
        raise NotFoundError("Staged product not found.")
    edited = list(row.admin_edited_fields or [])
    for key, value in fields.items():
        if key not in EDITABLE:
            raise ValidationError(f"Field '{key}' cannot be edited here.")
        setattr(row, key, value)
        if key not in edited:
            edited.append(key)
    if "discount_percent" in fields and fields["discount_percent"] and row.regular_price_cents:
        from app.services.pricing import sale_price_from_percent, validate_prices

        sale = sale_price_from_percent(row.regular_price_cents, int(fields["discount_percent"]))
        validate_prices(row.regular_price_cents, sale)
        row.sale_price_cents = sale
    row.admin_edited_fields = edited
    db.commit()
    db.refresh(row)
    return row


def bulk_recalculate(db: Session, run_id: str, ids: list[int] | None = None) -> int:
    q = select(CatalogStagedProduct).where(CatalogStagedProduct.run_id == run_id)
    if ids:
        q = q.where(CatalogStagedProduct.id.in_(ids))
    n = 0
    for row in db.execute(q).scalars():
        if "regular_price_cents" in (row.admin_edited_fields or []):
            continue
        recalculate_demo_prices(row)
        n += 1
    db.commit()
    return n


def do_import(db: Session, run_id: str, *, activate: bool, ids: list[int] | None) -> dict:
    run = db.get(CatalogImportRun, run_id)
    if run is None:
        raise NotFoundError("Import run not found.")
    return import_approved(db, run_id, activate=activate, ids=ids)


def retry_failed(db: Session, run_id: str) -> CatalogImportRun:
    from app.catalog.pipeline import collect_run

    run = db.get(CatalogImportRun, run_id)
    if run is None:
        raise NotFoundError("Import run not found.")
    run.status = "pending"
    run.completed_at = None
    db.commit()
    return collect_run(db, run_id)
