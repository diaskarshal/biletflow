from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8a400b848c71"
down_revision: str | Sequence[str] | None = "8a567004f9b7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TICKETS_OLD = "status in ('valid','checked_in','cancelled','refunded')"
TICKETS_NEW = "status in ('pending','valid','checked_in','cancelled','refunded')"
ORDERS_OLD = "status in ('pending','paid','cancelled','refunded','expired')"
ORDERS_NEW = "status in ('pending','paid','failed','cancelled','refunded','expired')"


def upgrade() -> None:
    op.create_table(
        "settings",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )
    op.execute("INSERT INTO settings (key, value) VALUES ('activation_fee_kzt', '5000')")
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("purpose", sa.String(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("amount_kzt", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("purpose in ('order','activation')", name="ck_payments_purpose"),
        sa.CheckConstraint(
            "status in ('pending','succeeded','failed','expired','refunded')", name="ck_payments_status"
        ),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column("events", sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("events", sa.Column("activation_paid_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("events", sa.Column("paid_sales_suspended_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("organizer_profiles", sa.Column("verification_document", sa.String(), nullable=True))
    op.add_column("organizer_profiles", sa.Column("payout_account", sa.String(), nullable=True))
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.drop_constraint("ck_tickets_status", "tickets", type_="check")
    op.create_check_constraint("ck_tickets_status", "tickets", TICKETS_NEW)
    op.drop_constraint("ck_orders_status", "orders", type_="check")
    op.create_check_constraint("ck_orders_status", "orders", ORDERS_NEW)


def downgrade() -> None:
    op.drop_constraint("ck_orders_status", "orders", type_="check")
    op.create_check_constraint("ck_orders_status", "orders", ORDERS_OLD)
    op.drop_constraint("ck_tickets_status", "tickets", type_="check")
    op.create_check_constraint("ck_tickets_status", "tickets", TICKETS_OLD)
    op.drop_column("users", "is_admin")
    op.drop_column("organizer_profiles", "payout_account")
    op.drop_column("organizer_profiles", "verification_document")
    op.drop_column("events", "paid_sales_suspended_at")
    op.drop_column("events", "activation_paid_at")
    op.drop_column("events", "terms_accepted_at")
    op.drop_table("payments")
    op.drop_table("settings")
