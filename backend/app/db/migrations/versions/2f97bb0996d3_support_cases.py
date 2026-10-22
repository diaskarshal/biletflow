from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "2f97bb0996d3"
down_revision: str | Sequence[str] | None = "e44fa71c4850"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORIES = (
    "category in ('ticket_delivery','payment','refund','seating','event_information',"
    "'check_in','account','activation','technical')"
)


def upgrade() -> None:
    op.create_table(
        "support_cases",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("requester_id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=True),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("ticket_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("assignee_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(CATEGORIES, name="ck_support_cases_category"),
        sa.CheckConstraint("kind in ('attendee','organizer')", name="ck_support_cases_kind"),
        sa.CheckConstraint(
            "status in ('open','in_progress','waiting_for_customer','resolved')", name="ck_support_cases_status"
        ),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_support_cases_event_id", "support_cases", ["event_id"])
    op.create_index("ix_support_cases_requester_id", "support_cases", ["requester_id"])
    op.create_table(
        "support_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["support_cases.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_support_messages_case_id", "support_messages", ["case_id"])


def downgrade() -> None:
    op.drop_index("ix_support_messages_case_id", table_name="support_messages")
    op.drop_table("support_messages")
    op.drop_index("ix_support_cases_requester_id", table_name="support_cases")
    op.drop_index("ix_support_cases_event_id", table_name="support_cases")
    op.drop_table("support_cases")
