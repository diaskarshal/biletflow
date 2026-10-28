from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b63a6df7a578"
down_revision: str | Sequence[str] | None = "ac5d0dcbd5d8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RENAMES = [
    ("alice@biletflow.kz", "Alice Organizer", "aru@biletflow.kz", "Aru Organizer"),
    ("bob@biletflow.kz", "Bob Organizer", "arman@biletflow.kz", "Arman Organizer"),
]


def _rename(old_email: str, new_email: str, new_name: str) -> None:
    params = {"old": old_email, "new": new_email, "name": new_name}
    op.execute(
        sa.text(
            "update users set email = :new, full_name = :name where email = :old "
            "and not exists (select 1 from users where email = :new)"
        ).bindparams(**params)
    )
    op.execute(
        sa.text("update organizer_profiles set contact_email = :new where contact_email = :old").bindparams(
            new=new_email, old=old_email
        )
    )


def upgrade() -> None:
    for old_email, _, new_email, new_name in RENAMES:
        _rename(old_email, new_email, new_name)


def downgrade() -> None:
    for old_email, old_name, new_email, _ in RENAMES:
        _rename(new_email, old_email, old_name)
