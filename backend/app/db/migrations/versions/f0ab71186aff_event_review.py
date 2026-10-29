from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f0ab71186aff"
down_revision: str | Sequence[str] | None = "b63a6df7a578"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("events", sa.Column("review_status", sa.String(), server_default="approved", nullable=False))
    op.alter_column("events", "review_status", server_default="pending")
    op.add_column("events", sa.Column("review_note", sa.String(), nullable=True))
    op.add_column("events", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint(
        "ck_events_review_status", "events", "review_status in ('pending','approved','rejected')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_events_review_status", "events", type_="check")
    op.drop_column("events", "reviewed_at")
    op.drop_column("events", "review_note")
    op.drop_column("events", "review_status")
