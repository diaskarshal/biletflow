from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint("visibility in ('public','unlisted','private')", name="ck_events_visibility"),
        CheckConstraint(
            "status in ('draft','published','cancelled','completed')", name="ck_events_status"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    organizer_id: Mapped[int] = mapped_column(ForeignKey("organizer_profiles.id"))
    slug: Mapped[str] = mapped_column(unique=True)
    title: Mapped[str]
    description: Mapped[str | None]
    category: Mapped[str | None]
    venue_name: Mapped[str | None]
    venue_address: Mapped[str | None]
    cover_image_url: Mapped[str | None]
    starts_at: Mapped[datetime] = mapped_column(index=True)
    ends_at: Mapped[datetime]
    display_timezone: Mapped[str] = mapped_column(default="Asia/Almaty")
    visibility: Mapped[str] = mapped_column(default="public")
    status: Mapped[str] = mapped_column(default="draft")
    capacity: Mapped[int | None]
    registration_opens_at: Mapped[datetime | None]
    registration_closes_at: Mapped[datetime | None]
    paid_sales_enabled: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    deleted_at: Mapped[datetime | None]
