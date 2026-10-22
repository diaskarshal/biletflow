from datetime import datetime

from sqlalchemy import ARRAY, CheckConstraint, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PromoCampaign(Base):
    __tablename__ = "promo_campaigns"
    __table_args__ = (
        CheckConstraint("discount_type in ('percent','fixed')", name="ck_promo_discount_type"),
        CheckConstraint(
            "discount_type <> 'percent' or discount_value between 1 and 100", name="ck_promo_percent"
        ),
        CheckConstraint(
            "max_redemptions is null or redemptions <= max_redemptions", name="ck_promo_redemptions"
        ),
        UniqueConstraint("event_id", "code", name="uq_promo_campaigns_event_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True)
    name: Mapped[str]
    code: Mapped[str]
    token: Mapped[str] = mapped_column(unique=True)
    discount_type: Mapped[str]
    discount_value: Mapped[int]
    valid_from: Mapped[datetime | None]
    valid_until: Mapped[datetime | None]
    max_redemptions: Mapped[int | None]
    redemptions: Mapped[int] = mapped_column(default=0)
    ticket_type_ids: Mapped[list[int] | None] = mapped_column(ARRAY(Integer))
    disabled_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
