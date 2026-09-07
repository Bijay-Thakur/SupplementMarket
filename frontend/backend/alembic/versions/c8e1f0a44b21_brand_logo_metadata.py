"""brand logo metadata

Revision ID: c8e1f0a44b21
Revises: b7c4e91a2d10
Create Date: 2026-09-02
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "c8e1f0a44b21"
down_revision: str | None = "b7c4e91a2d10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("brands", sa.Column("logo_alt", sa.String(length=200), nullable=True))
    op.add_column("brands", sa.Column("official_website_url", sa.String(length=500), nullable=True))
    op.add_column(
        "brands",
        sa.Column("logo_use_status", sa.String(length=40), nullable=False, server_default="permission_pending"),
    )
    op.add_column(
        "brands",
        sa.Column("logo_background", sa.String(length=40), nullable=False, server_default="cream"),
    )
    op.add_column(
        "brands",
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("brands", "display_order")
    op.drop_column("brands", "logo_background")
    op.drop_column("brands", "logo_use_status")
    op.drop_column("brands", "official_website_url")
    op.drop_column("brands", "logo_alt")
