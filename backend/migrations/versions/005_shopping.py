from pathlib import Path

from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().exec_driver_sql(
        (Path(__file__).parents[1] / "005_shopping.sql").read_text()
    )


def downgrade():
    raise RuntimeError("Financial history migrations are forward-only.")
