from pathlib import Path

from alembic import op

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().exec_driver_sql(
        (Path(__file__).parents[1] / "006_negotiation_events.sql").read_text()
    )


def downgrade():
    raise RuntimeError("Financial history migrations are forward-only.")
