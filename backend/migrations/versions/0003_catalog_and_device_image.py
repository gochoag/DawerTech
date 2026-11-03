"""Add catalog tables and devices.image_name, which were created outside migrations."""

import sqlalchemy as sa
from alembic import op

revision = "0003_catalog_and_device_image"
down_revision = "0002_add_is_universal"
branch_labels = None
depends_on = None


def upgrade():
    # Bases anteriores ya las tienen: las creaba install_database al arrancar.
    inspector = sa.inspect(op.get_bind())
    tables = inspector.get_table_names()
    for name, length in (("categories", 80), ("variants", 160)):
        if name not in tables:
            op.create_table(
                name,
                sa.Column("id", sa.Integer(), primary_key=True),
                sa.Column("name", sa.String(length), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            )
            op.create_index(f"ix_{name}_name", name, ["name"], unique=True)
    if "image_name" not in {c["name"] for c in inspector.get_columns("devices")}:
        with op.batch_alter_table("devices") as batch_op:
            batch_op.add_column(sa.Column("image_name", sa.String(80)))


def downgrade():
    with op.batch_alter_table("devices") as batch_op:
        batch_op.drop_column("image_name")
    op.drop_table("variants")
    op.drop_table("categories")
