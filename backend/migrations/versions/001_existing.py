"""Adopt the existing schema without deleting financial records."""

from pathlib import Path

from alembic import op

revision = "001"
down_revision = None


def upgrade():
    op.get_bind().exec_driver_sql(
        Path(__file__).resolve().parents[1].joinpath("001_legacy.sql").read_text()
    )


def downgrade():
    raise RuntimeError(
        "Financial history must not be dropped. Restore a reviewed backup instead."
    )
