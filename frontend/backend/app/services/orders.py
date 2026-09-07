"""Order creation with idempotency and authoritative, server-side totals.

Client-provided prices are never trusted: every line total is recomputed from
current database prices. Retries carrying the same idempotency key return the
same order; the same key with a different body is a conflict.
"""
from __future__ import annotations

import hashlib
import json

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.errors import ConflictError, ValidationError
from app.core.utils import order_number, public_token
from app.models import IdempotencyKey, Order, OrderItem, Product
from app.schemas.order import OrderCreate
from app.services.pricing import effective_price_cents

# Availability states that cannot be ordered.
BLOCKED_AVAILABILITY = {"out_of_stock", "coming_soon"}


def _request_hash(payload: OrderCreate) -> str:
    canonical = {
        "fulfillment_type": payload.fulfillment_type,
        "customer_email": payload.customer_email.lower(),
        "items": sorted([(i.product_id, i.quantity) for i in payload.items]),
        "delivery_zip": payload.delivery_zip,
    }
    raw = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def create_order(db: Session, payload: OrderCreate) -> Order:
    req_hash = _request_hash(payload)

    # Idempotency short-circuit.
    existing = db.get(IdempotencyKey, payload.idempotency_key)
    if existing is not None:
        if existing.request_hash != req_hash:
            raise ConflictError(
                "This idempotency key was already used with a different request."
            )
        if existing.order_id is not None:
            order = db.get(Order, existing.order_id)
            if order is not None:
                return order

    if payload.fulfillment_type == "delivery":
        missing = {}
        if not payload.delivery_address_line1:
            missing["delivery_address_line1"] = "Required for delivery."
        if not payload.delivery_city:
            missing["delivery_city"] = "Required for delivery."
        if not payload.delivery_state:
            missing["delivery_state"] = "Required for delivery."
        if not payload.delivery_zip:
            missing["delivery_zip"] = "Required for delivery."
        if missing:
            raise ValidationError("Delivery address is incomplete.", fields=missing)

    # Load products and build immutable snapshots with server-authoritative prices.
    product_ids = [i.product_id for i in payload.items]
    products = {
        p.id: p
        for p in db.execute(
            select(Product).where(Product.id.in_(product_ids)).options(
                selectinload(Product.brand)
            )
        ).scalars()
    }

    items: list[OrderItem] = []
    subtotal = 0
    for line in payload.items:
        product = products.get(line.product_id)
        if product is None or not product.is_active or product.is_archived:
            raise ValidationError(
                f"A product in your cart is no longer available (id {line.product_id})."
            )
        if product.availability in BLOCKED_AVAILABILITY:
            raise ValidationError(
                f"'{product.name}' is not currently available to order."
            )
        unit = effective_price_cents(product.regular_price_cents, product.sale_price_cents)
        line_total = unit * line.quantity
        subtotal += line_total
        items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                brand_name=product.brand.name if product.brand else None,
                sku=product.sku,
                variant_label=None,
                unit_price_cents=unit,
                quantity=line.quantity,
                line_total_cents=line_total,
            )
        )

    # Delivery fee/eligibility is confirmed by the store (demo): not charged here.
    delivery_fee = None
    total = subtotal

    order = Order(
        order_number=order_number(),
        public_token=public_token(),
        idempotency_key=payload.idempotency_key,
        fulfillment_type=payload.fulfillment_type,
        status="placed",
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        delivery_address_line1=payload.delivery_address_line1,
        delivery_city=payload.delivery_city,
        delivery_state=payload.delivery_state,
        delivery_zip=payload.delivery_zip,
        delivery_instructions=payload.delivery_instructions,
        subtotal_cents=subtotal,
        delivery_fee_cents=delivery_fee,
        total_cents=total,
        notes=payload.notes,
        is_demo=True,
        items=items,
    )
    db.add(order)
    db.flush()

    db.add(
        IdempotencyKey(
            key=payload.idempotency_key, request_hash=req_hash, order_id=order.id
        )
    )
    try:
        db.commit()
    except IntegrityError:
        # Concurrent retry raced us; return the already-persisted order.
        db.rollback()
        again = db.get(IdempotencyKey, payload.idempotency_key)
        if again is not None and again.order_id is not None:
            return db.get(Order, again.order_id)
        raise
    db.refresh(order)
    return order
