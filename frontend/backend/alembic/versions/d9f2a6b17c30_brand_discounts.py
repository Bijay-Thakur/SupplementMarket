"""brand discount pricing

Revision ID: d9f2a6b17c30
Revises: c8e1f0a44b21
Create Date: 2026-09-09
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "d9f2a6b17c30"
down_revision: str | None = "c8e1f0a44b21"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("brands") as batch:
        batch.add_column(sa.Column("discount_percent", sa.Integer(), nullable=True))
        batch.create_check_constraint(
            "ck_brand_discount_percent_range",
            "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent < 100)",
        )


def downgrade() -> None:
    with op.batch_alter_table("brands") as batch:
        batch.drop_constraint("ck_brand_discount_percent_range", type_="check")
        batch.drop_column("discount_percent")
