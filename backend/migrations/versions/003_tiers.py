"""Requests, negotiated quotes and variable payment amounts; retain old agreements."""

from pathlib import Path

from alembic import op

revision = "003"
down_revision = "002"


def upgrade():
    op.get_bind().exec_driver_sql(
        Path(__file__).resolve().parents[1].joinpath("003_tiers.sql").read_text()
    )


def downgrade():
    raise RuntimeError("Financial history must not be dropped.")
