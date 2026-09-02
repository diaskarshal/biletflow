from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EventStaff(Base):
    __tablename__ = "event_staff"
    __table_args__ = (
        CheckConstraint("role in ('event_admin','organizer_staff')", name="ck_event_staff_role"),
        UniqueConstraint("event_id", "user_id", name="uq_event_staff_event_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    role: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class CheckInRecord(Base):
    __tablename__ = "check_in_records"
    __table_args__ = (
        Index(
            "uq_check_in_records_active_ticket",
            "ticket_id",
            unique=True,
            postgresql_where="reversed_at IS NULL",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"))
    event_admin_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    checked_in_at: Mapped[datetime] = mapped_column(server_default=func.now())
    reversed_at: Mapped[datetime | None]
    device_label: Mapped[str | None]
