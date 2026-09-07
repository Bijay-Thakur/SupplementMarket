from __future__ import annotations

from pydantic import BaseModel


class ImportRow(BaseModel):
    line: int
    action: str  # "create" | "update" | "error"
    name: str | None = None
    brand: str | None = None
    sku: str | None = None
    upc: str | None = None
    regular_price_cents: int | None = None
    sale_price_cents: int | None = None
    is_duplicate: bool = False
    errors: list[str] = []
    warnings: list[str] = []


class ImportPreview(BaseModel):
    filename: str | None = None
    total_rows: int
    creatable: int
    updatable: int
    invalid: int
    rows: list[ImportRow]


class ImportCommitResult(BaseModel):
    total_rows: int
    created: int
    updated: int
    skipped: int
    errors: list[ImportRow]
    message: str
