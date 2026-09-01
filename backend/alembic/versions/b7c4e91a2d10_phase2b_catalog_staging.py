"""phase 2b catalog staging

Revision ID: b7c4e91a2d10
Revises: 4792df3c68b9
Create Date: 2026-08-31
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "b7c4e91a2d10"
down_revision: str | None = "4792df3c68b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("products") as batch:
        batch.add_column(sa.Column("sugar_free", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("kosher", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("halal", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("parent_brand", sa.String(length=160), nullable=True))
        batch.add_column(sa.Column("product_line", sa.String(length=160), nullable=True))
        batch.add_column(sa.Column("variant_name", sa.String(length=160), nullable=True))
        batch.add_column(sa.Column("certifications", sa.Text(), nullable=True))
        batch.add_column(sa.Column("serving_size", sa.String(length=120), nullable=True))
        batch.add_column(sa.Column("other_ingredients", sa.Text(), nullable=True))
        batch.add_column(sa.Column("allergen_info", sa.Text(), nullable=True))
        batch.add_column(sa.Column("source_price_cents", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("source_price_currency", sa.String(length=3), nullable=True))
        batch.add_column(sa.Column("source_price_collected_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("price_is_demo", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("source_domain", sa.String(length=200), nullable=True))
        batch.add_column(sa.Column("source_collection_url", sa.String(length=600), nullable=True))
        batch.add_column(sa.Column("extraction_method", sa.String(length=40), nullable=True))
        batch.add_column(sa.Column("parser_version", sa.String(length=20), nullable=True))
        batch.add_column(sa.Column("source_content_hash", sa.String(length=64), nullable=True))
        batch.add_column(sa.Column("last_source_verification_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("staged_product_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("intended_audience", sa.String(length=80), nullable=True))
    with op.batch_alter_table("product_images") as batch:
        batch.add_column(sa.Column("source_url", sa.String(length=800), nullable=True))
        batch.add_column(sa.Column("sha256", sa.String(length=64), nullable=True))
        batch.add_column(sa.Column("image_use_status", sa.String(length=40), nullable=True))
        batch.add_column(sa.Column("permission_status", sa.String(length=40), nullable=True))
        batch.add_column(sa.Column("original_path", sa.String(length=500), nullable=True))


def downgrade() -> None:
    pass
