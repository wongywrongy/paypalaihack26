"""Durable admission, evidence, attention and reservations."""

from pathlib import Path

from alembic import op

revision = "002"
down_revision = "001"


def upgrade():
    op.get_bind().exec_driver_sql(
        Path(__file__).resolve().parents[1].joinpath("002_coordination.sql").read_text()
    )


def downgrade():
    raise RuntimeError("Financial history must not be dropped.")
