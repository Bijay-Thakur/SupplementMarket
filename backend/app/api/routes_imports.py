"""CSV catalog importer (dev-only): template, preview (dry-run), commit."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.api.deps import require_dev
from app.core.errors import ValidationError
from app.db.base import get_db
from app.schemas.imports import ImportCommitResult, ImportPreview
from app.services import csv_import

router = APIRouter(
    prefix="/admin/products/bulk-import",
    tags=["admin:import"],
    dependencies=[Depends(require_dev)],
)

MAX_CSV_BYTES = 2_000_000


@router.get("/template", response_class=PlainTextResponse)
def download_template():
    return PlainTextResponse(
        csv_import.template_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bnm-import-template.csv"},
    )


def _read(file: UploadFile) -> bytes:
    content = file.file.read()
    if len(content) > MAX_CSV_BYTES:
        raise ValidationError("CSV too large.")
    if not content:
        raise ValidationError("Empty file.")
    return content


@router.post("/preview", response_model=ImportPreview)
def preview_import(db: Session = Depends(get_db), file: UploadFile = File(...)):
    return csv_import.preview(db, _read(file), file.filename)


@router.post("/commit", response_model=ImportCommitResult)
def commit_import(db: Session = Depends(get_db), file: UploadFile = File(...)):
    return csv_import.commit(db, _read(file))
