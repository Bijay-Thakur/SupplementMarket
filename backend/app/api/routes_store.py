"""Store settings: public read, dev-only update."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_dev
from app.db.base import get_db
from app.models import StoreSettings
from app.schemas.store import StoreSettingsOut, StoreSettingsUpdate

router = APIRouter(tags=["store"])


def _get_or_create(db: Session) -> StoreSettings:
    s = db.get(StoreSettings, 1)
    if s is None:
        s = StoreSettings(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.get("/store-settings", response_model=StoreSettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.patch(
    "/admin/store-settings",
    response_model=StoreSettingsOut,
    dependencies=[Depends(require_dev)],
)
def update_settings(payload: StoreSettingsUpdate, db: Session = Depends(get_db)):
    s = _get_or_create(db)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s
