from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "377ded8d5806"
down_revision: str | Sequence[str] | None = "8a400b848c71"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("audit_log", sa.Column("event_id", sa.Integer(), nullable=True))
    op.create_index("ix_audit_log_event_id", "audit_log", ["event_id"])
    op.create_foreign_key("fk_audit_log_event_id", "audit_log", "events", ["event_id"], ["id"])
    op.add_column(
        "events",
        sa.Column("refund_policy", sa.String(), server_default="full_until_48h", nullable=False),
    )
    op.create_check_constraint(
        "ck_events_refund_policy",
        "events",
        "refund_policy in ('full_until_48h','full_anytime','no_refunds')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_events_refund_policy", "events", type_="check")
    op.drop_column("events", "refund_policy")
    op.drop_constraint("fk_audit_log_event_id", "audit_log", type_="foreignkey")
    op.drop_index("ix_audit_log_event_id", table_name="audit_log")
    op.drop_column("audit_log", "event_id")
