"""Admin product management (DEVELOPMENT-ONLY in Phase 2 — no auth yet)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_dev
from app.db.base import get_db
from app.repositories import products as repo
from app.repositories.products import ProductQuery
from app.schemas.common import Page
from app.schemas.product import (
    AdminProductRow,
    ProductCreate,
    ProductDetail,
    ProductUpdate,
)
from app.services import product_write, serialize

router = APIRouter(
    prefix="/admin/products",
    tags=["admin:products"],
    dependencies=[Depends(require_dev)],
)


@router.get("", response_model=Page[AdminProductRow])
def list_admin_products(
    db: Session = Depends(get_db),
    q: str | None = Query(default=None, max_length=100),
    brand: str | None = None,
    category: str | None = None,
    availability: str | None = None,
    on_sale: bool | None = None,
    sort: str = "newest",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    pq = ProductQuery(
        q=q,
        brand=brand,
        category=category,
        availability=availability,
        on_sale=on_sale,
        sort=sort,
        page=page,
        page_size=page_size,
        include_inactive=True,
    )
    items, total = repo.search_products(db, pq)
    pages = (total + pq.page_size - 1) // pq.page_size if pq.page_size else 0
    return Page[AdminProductRow](
        items=[serialize.admin_product_row(p) for p in items],
        total=total,
        page=pq.page,
        page_size=pq.page_size,
        pages=pages,
    )


@router.get("/{product_id}", response_model=ProductDetail)
def get_admin_product(product_id: int, db: Session = Depends(get_db)):
    from app.core.errors import NotFoundError

    product = repo.get_by_id(db, product_id)
    if product is None:
        raise NotFoundError("Product not found.")
    return serialize.product_detail(product)


@router.post("", response_model=ProductDetail, status_code=201)
def create_admin_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = product_write.create_product(db, payload)
    return serialize.product_detail(product)


@router.patch("/{product_id}", response_model=ProductDetail)
def update_admin_product(
    product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)
):
    product = product_write.update_product(db, product_id, payload)
    return serialize.product_detail(product)


@router.delete("/{product_id}", response_model=ProductDetail)
def archive_admin_product(product_id: int, db: Session = Depends(get_db)):
    """Archive (soft-delete) rather than hard-delete."""
    product = product_write.archive_product(db, product_id)
    return serialize.product_detail(product)


@router.post("/{product_id}/restore", response_model=ProductDetail)
def restore_admin_product(product_id: int, db: Session = Depends(get_db)):
    product = product_write.restore_product(db, product_id)
    return serialize.product_detail(product)


@router.post("/{product_id}/duplicate", response_model=ProductDetail, status_code=201)
def duplicate_admin_product(product_id: int, db: Session = Depends(get_db)):
    product = product_write.duplicate_product(db, product_id)
    return serialize.product_detail(product)
