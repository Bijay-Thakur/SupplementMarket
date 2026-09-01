from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class OrderItemIn(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, le=99)


class OrderCreate(BaseModel):
    # Client-generated UUID; the server dedupes retries on this key.
    idempotency_key: str = Field(min_length=8, max_length=64)
    fulfillment_type: str  # "pickup" | "delivery"
    customer_name: str = Field(min_length=1, max_length=200)
    customer_email: str = Field(min_length=3, max_length=320)
    customer_phone: str = Field(min_length=3, max_length=40)
    items: list[OrderItemIn] = Field(min_length=1)

    delivery_address_line1: str | None = Field(default=None, max_length=240)
    delivery_city: str | None = Field(default=None, max_length=120)
    delivery_state: str | None = Field(default=None, max_length=40)
    delivery_zip: str | None = Field(default=None, max_length=20)
    delivery_instructions: str | None = None
    notes: str | None = None

    @field_validator("customer_email")
    @classmethod
    def _email(cls, v: str) -> str:
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email address.")
        return v

    @field_validator("fulfillment_type")
    @classmethod
    def _fulfillment(cls, v: str) -> str:
        if v not in ("pickup", "delivery"):
            raise ValueError("fulfillment_type must be 'pickup' or 'delivery'.")
        return v


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    product_name: str
    brand_name: str | None = None
    sku: str | None = None
    variant_label: str | None = None
    unit_price_cents: int
    quantity: int
    line_total_cents: int


class OrderPublicOut(BaseModel):
    """Minimal, guest-safe confirmation payload keyed by public_token."""
    public_token: str
    order_number: str
    status: str
    fulfillment_type: str
    customer_name: str
    subtotal_cents: int
    delivery_fee_cents: int | None = None
    total_cents: int
    items: list[OrderItemOut]
    created_at: datetime | None = None


class AdminOrderRow(BaseModel):
    id: int
    order_number: str
    customer_name: str
    fulfillment_type: str
    status: str
    total_cents: int
    item_count: int
    is_demo: bool
    created_at: datetime | None = None


class AdminOrderDetail(BaseModel):
    id: int
    order_number: str
    public_token: str
    status: str
    fulfillment_type: str
    customer_name: str
    customer_email: str
    customer_phone: str
    delivery_address_line1: str | None = None
    delivery_city: str | None = None
    delivery_state: str | None = None
    delivery_zip: str | None = None
    delivery_instructions: str | None = None
    subtotal_cents: int
    delivery_fee_cents: int | None = None
    total_cents: int
    notes: str | None = None
    is_demo: bool
    items: list[OrderItemOut]
    created_at: datetime | None = None


class OrderStatusUpdate(BaseModel):
    status: str
