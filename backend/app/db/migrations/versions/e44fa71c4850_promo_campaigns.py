from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e44fa71c4850"
down_revision: str | Sequence[str] | None = "377ded8d5806"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "promo_campaigns",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("discount_type", sa.String(), nullable=False),
        sa.Column("discount_value", sa.Integer(), nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("max_redemptions", sa.Integer(), nullable=True),
        sa.Column("redemptions", sa.Integer(), nullable=False),
        sa.Column("ticket_type_ids", sa.ARRAY(sa.Integer()), nullable=True),
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "discount_type <> 'percent' or discount_value between 1 and 100", name="ck_promo_percent"
        ),
        sa.CheckConstraint("discount_type in ('percent','fixed')", name="ck_promo_discount_type"),
        sa.CheckConstraint(
            "max_redemptions is null or redemptions <= max_redemptions", name="ck_promo_redemptions"
        ),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "code", name="uq_promo_campaigns_event_code"),
        sa.UniqueConstraint("token"),
    )
    op.create_index("ix_promo_campaigns_event_id", "promo_campaigns", ["event_id"])
    op.add_column("orders", sa.Column("promo_campaign_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_orders_promo_campaign_id", "orders", "promo_campaigns", ["promo_campaign_id"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint("fk_orders_promo_campaign_id", "orders", type_="foreignkey")
    op.drop_column("orders", "promo_campaign_id")
    op.drop_index("ix_promo_campaigns_event_id", table_name="promo_campaigns")
    op.drop_table("promo_campaigns")
