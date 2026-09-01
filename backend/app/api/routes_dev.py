"""Development-only endpoints: demo seed/reset and admin dashboard stats.

DEV-ONLY: disabled entirely outside the development environment.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_dev
from app.db.base import get_db
from app.models import Order
from app.repositories import products as repo
from app.schemas.common import OkResponse
from app.seed.demo import seed_demo
from app.services import serialize

router = APIRouter(tags=["dev"], dependencies=[Depends(require_dev)])


@router.post("/dev/seed", response_model=OkResponse)
def seed(db: Session = Depends(get_db)):
    counts = seed_demo(db, reset=True)
    return OkResponse(message=f"Seeded demo data: {counts}")


@router.post("/dev/reset", response_model=OkResponse)
def reset(db: Session = Depends(get_db)):
    """Reset ONLY demonstration data (re-seeds a clean demo set)."""
    counts = seed_demo(db, reset=True)
    return OkResponse(message=f"Demo data reset. {counts}")


@router.get("/admin/dashboard")
def dashboard(db: Session = Depends(get_db)):
    counts = repo.admin_counts(db)
    total_orders = db.execute(select(func.count()).select_from(Order)).scalar_one()
    recent = db.execute(
        select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc()).limit(5)
    ).scalars().all()
    return {
        **counts,
        "total_orders": total_orders,
        "recent_orders": [serialize.admin_order_row(o).model_dump() for o in recent],
    }
