from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class StoreSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    store_name: str
    phone: str | None = None
    phone_is_placeholder: bool = True
    email: str | None = None
    address_line1: str
    city: str
    state: str
    zip: str
    hours_note: str | None = None
    announcement: str | None = None
    pickup_instructions: str | None = None
    delivery_note: str | None = None
    min_order_cents: int = 0
    currency: str = "USD"
    timezone: str = "America/New_York"


class StoreSettingsUpdate(BaseModel):
    store_name: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    phone_is_placeholder: bool | None = None
    email: str | None = Field(default=None, max_length=320)
    address_line1: str | None = Field(default=None, max_length=240)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=40)
    zip: str | None = Field(default=None, max_length=20)
    hours_note: str | None = None
    announcement: str | None = None
    pickup_instructions: str | None = None
    delivery_note: str | None = None
    min_order_cents: int | None = Field(default=None, ge=0)
