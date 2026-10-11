"""Add is_universal column to parts."""

import sqlalchemy as sa
from alembic import op

revision = "0002_add_is_universal"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table(
        "parts",
        table_args=(
            sa.CheckConstraint("purchase_cents >= 0", name="ck_parts_purchase_cents"),
            sa.CheckConstraint("sale_cents >= 0", name="ck_parts_sale_cents"),
            sa.CheckConstraint("min_stock >= 0", name="ck_parts_min_stock"),
        ),
    ) as batch_op:
        batch_op.add_column(
            sa.Column("is_universal", sa.Boolean(), nullable=False, server_default=sa.false())
        )



def downgrade():
    with op.batch_alter_table("parts") as batch_op:
        batch_op.drop_column("is_universal")
