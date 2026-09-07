"""Named sale windows (dev-only writes). Customer prices still come from
product regular/sale cents — this is merchandising metadata for the sale manager.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_dev
from app.core.errors import NotFoundError, ValidationError
from app.db.base import get_db
from app.models import Promotion
from app.schemas.common import OkResponse
from app.schemas.promotion import PromotionCreate, PromotionOut, PromotionUpdate

public = APIRouter(tags=["promotions"])
admin = APIRouter(dependencies=[Depends(require_dev)], tags=["admin:promotions"])


def _validate_dates(starts_at, ends_at) -> None:
    if starts_at and ends_at and ends_at <= starts_at:
        raise ValidationError(
            "Promotion end must be after start.",
            fields={"ends_at": "Must be after starts_at."},
        )


@public.get("/promotions", response_model=list[PromotionOut])
def list_public_promotions(db: Session = Depends(get_db)):
    return list(
        db.execute(
            select(Promotion).where(Promotion.is_active.is_(True)).order_by(Promotion.name)
        ).scalars()
    )


@admin.get("/admin/promotions", response_model=list[PromotionOut])
def list_promotions(db: Session = Depends(get_db)):
    return list(db.execute(select(Promotion).order_by(Promotion.name)).scalars())


@admin.post("/admin/promotions", response_model=PromotionOut, status_code=201)
def create_promotion(payload: PromotionCreate, db: Session = Depends(get_db)):
    _validate_dates(payload.starts_at, payload.ends_at)
    promo = Promotion(
        name=payload.name,
        description=payload.description,
        discount_percent=payload.discount_percent,
        starts_at=payload.starts_at.replace(tzinfo=None) if payload.starts_at else None,
        ends_at=payload.ends_at.replace(tzinfo=None) if payload.ends_at else None,
        is_active=payload.is_active,
        is_demo=True,
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return promo


@admin.patch("/admin/promotions/{promotion_id}", response_model=PromotionOut)
def update_promotion(
    promotion_id: int, payload: PromotionUpdate, db: Session = Depends(get_db)
):
    promo = db.get(Promotion, promotion_id)
    if promo is None:
        raise NotFoundError("Promotion not found.")
    data = payload.model_dump(exclude_unset=True)
    starts = data.get("starts_at", promo.starts_at)
    ends = data.get("ends_at", promo.ends_at)
    _validate_dates(starts, ends)
    for f, v in data.items():
        if f in ("starts_at", "ends_at") and v is not None and hasattr(v, "replace"):
            v = v.replace(tzinfo=None)
        setattr(promo, f, v)
    db.commit()
    db.refresh(promo)
    return promo


@admin.delete("/admin/promotions/{promotion_id}", response_model=OkResponse)
def delete_promotion(promotion_id: int, db: Session = Depends(get_db)):
    promo = db.get(Promotion, promotion_id)
    if promo is None:
        raise NotFoundError("Promotion not found.")
    db.delete(promo)
    db.commit()
    return OkResponse(message="Promotion removed.")
