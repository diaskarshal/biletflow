from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8a567004f9b7"
down_revision: str | Sequence[str] | None = "2dd86905e867"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNS = [
    ("audit_log", "created_at"),
    ("check_in_records", "checked_in_at"),
    ("check_in_records", "reversed_at"),
    ("event_staff", "created_at"),
    ("events", "starts_at"),
    ("events", "ends_at"),
    ("events", "registration_opens_at"),
    ("events", "registration_closes_at"),
    ("events", "created_at"),
    ("events", "deleted_at"),
    ("orders", "expires_at"),
    ("orders", "created_at"),
    ("organizer_profiles", "created_at"),
    ("ticket_types", "sales_start_at"),
    ("ticket_types", "sales_end_at"),
    ("tickets", "created_at"),
    ("users", "email_verified_at"),
    ("users", "created_at"),
    ("users", "deleted_at"),
]


def upgrade() -> None:
    for table, column in COLUMNS:
        op.alter_column(
            table,
            column,
            type_=sa.DateTime(timezone=True),
            existing_type=sa.DateTime(),
            postgresql_using=f"{column} AT TIME ZONE 'UTC'",
        )


def downgrade() -> None:
    for table, column in COLUMNS:
        op.alter_column(
            table,
            column,
            type_=sa.DateTime(),
            existing_type=sa.DateTime(timezone=True),
            postgresql_using=f"{column} AT TIME ZONE 'UTC'",
        )
