from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

CATEGORIES = (
    "ticket_delivery",
    "payment",
    "refund",
    "seating",
    "event_information",
    "check_in",
    "account",
    "activation",
    "technical",
)
STATUSES = ("open", "in_progress", "waiting_for_customer", "resolved")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} in ({','.join(repr(v) for v in values)})"


class SupportCase(Base):
    __tablename__ = "support_cases"
    __table_args__ = (
        CheckConstraint("kind in ('attendee','organizer')", name="ck_support_cases_kind"),
        CheckConstraint(_in("category", CATEGORIES), name="ck_support_cases_category"),
        CheckConstraint(_in("status", STATUSES), name="ck_support_cases_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str]
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id"), index=True)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"))
    ticket_id: Mapped[int | None] = mapped_column(ForeignKey("tickets.id"))
    category: Mapped[str]
    subject: Mapped[str]
    status: Mapped[str] = mapped_column(default="open")
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class SupportMessage(Base):
    __tablename__ = "support_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("support_cases.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
