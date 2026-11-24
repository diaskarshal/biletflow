from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c3d1e7a9b2f4"
down_revision: str | Sequence[str] | None = "f0ab71186aff"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("events", sa.Column("access_key", sa.String(), nullable=True))
    op.execute("UPDATE events SET access_key = substr(md5(random()::text || id::text), 1, 16)")
    op.alter_column("events", "access_key", nullable=False)
    op.execute("UPDATE events SET capacity = NULL")
    op.create_check_constraint("ck_events_capacity", "events", "capacity IS NULL OR capacity > 0")


def downgrade() -> None:
    op.drop_constraint("ck_events_capacity", "events", type_="check")
    op.drop_column("events", "access_key")
