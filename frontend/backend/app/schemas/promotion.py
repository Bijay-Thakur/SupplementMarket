from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PromotionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str | None = None
    discount_percent: int | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool = True
    is_demo: bool = False


class PromotionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = None
    discount_percent: int | None = Field(default=None, ge=1, le=99)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool = True


class PromotionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    discount_percent: int | None = Field(default=None, ge=1, le=99)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool | None = None
