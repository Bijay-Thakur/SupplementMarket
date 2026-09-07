"""Order endpoints: public demo-order creation + guest lookup; admin management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import rate_limit_order, require_dev
from app.core.errors import NotFoundError, ValidationError
from app.db.base import get_db
from app.models import Order
from app.models.entities import ORDER_STATUS_VALUES
from app.schemas.common import Page
from app.schemas.order import (
    AdminOrderDetail,
    AdminOrderRow,
    OrderCreate,
    OrderPublicOut,
    OrderStatusUpdate,
)
from app.services import orders as order_service
from app.services import serialize

public = APIRouter(prefix="/orders", tags=["orders"])
admin = APIRouter(prefix="/admin/orders", dependencies=[Depends(require_dev)], tags=["admin:orders"])


@public.post("", response_model=OrderPublicOut, status_code=201)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit_order),
):
    order = order_service.create_order(db, payload)
    db.refresh(order)
    return serialize.order_public(order)


@public.get("/{public_token}", response_model=OrderPublicOut)
def get_order(public_token: str, db: Session = Depends(get_db)):
    order = db.execute(
        select(Order).where(Order.public_token == public_token).options(
            selectinload(Order.items)
        )
    ).scalars().first()
    if order is None:
        raise NotFoundError("Order not found.")
    return serialize.order_public(order)


@admin.get("", response_model=Page[AdminOrderRow])
def list_orders(
    db: Session = Depends(get_db),
    q: str | None = None,
    status: str | None = None,
    fulfillment_type: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    stmt = select(Order).options(selectinload(Order.items))
    if status:
        stmt = stmt.where(Order.status == status)
    if fulfillment_type:
        stmt = stmt.where(Order.fulfillment_type == fulfillment_type)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            func.lower(Order.order_number).like(like)
            | func.lower(Order.customer_name).like(like)
        )
    count = db.execute(select(func.count()).select_from(stmt.order_by(None).subquery())).scalar_one()
    stmt = stmt.order_by(Order.created_at.desc()).limit(page_size).offset((page - 1) * page_size)
    items = list(db.execute(stmt).scalars().unique().all())
    pages = (count + page_size - 1) // page_size if page_size else 0
    return Page[AdminOrderRow](
        items=[serialize.admin_order_row(o) for o in items],
        total=count,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@admin.get("/{order_id}", response_model=AdminOrderDetail)
def get_admin_order(order_id: int, db: Session = Depends(get_db)):
    order = db.execute(
        select(Order).where(Order.id == order_id).options(selectinload(Order.items))
    ).scalars().first()
    if order is None:
        raise NotFoundError("Order not found.")
    return serialize.admin_order_detail(order)


@admin.patch("/{order_id}/status", response_model=AdminOrderDetail)
def update_status(order_id: int, payload: OrderStatusUpdate, db: Session = Depends(get_db)):
    order = db.execute(
        select(Order).where(Order.id == order_id).options(selectinload(Order.items))
    ).scalars().first()
    if order is None:
        raise NotFoundError("Order not found.")
    if payload.status not in ORDER_STATUS_VALUES:
        raise ValidationError(f"Invalid status. Allowed: {', '.join(ORDER_STATUS_VALUES)}")
    order.status = payload.status
    db.commit()
    db.refresh(order)
    return serialize.admin_order_detail(order)
