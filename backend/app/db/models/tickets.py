from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TicketType(Base):
    __tablename__ = "ticket_types"
    __table_args__ = (
        CheckConstraint(
            "quantity_sold + quantity_reserved <= quantity_total", name="ck_ticket_types_inventory"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    name: Mapped[str]
    description: Mapped[str | None]
    price_kzt: Mapped[int] = mapped_column(default=0)
    quantity_total: Mapped[int]
    quantity_sold: Mapped[int] = mapped_column(default=0)
    quantity_reserved: Mapped[int] = mapped_column(default=0)
    sales_start_at: Mapped[datetime | None]
    sales_end_at: Mapped[datetime | None]
    max_per_order: Mapped[int | None]
    is_hidden: Mapped[bool] = mapped_column(default=False)


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = (
        CheckConstraint(
            "status in ('valid','checked_in','cancelled','refunded')", name="ck_tickets_status"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_item_id: Mapped[int] = mapped_column(ForeignKey("order_items.id"))
    ticket_type_id: Mapped[int] = mapped_column(ForeignKey("ticket_types.id"))
    attendee_name: Mapped[str]
    attendee_email: Mapped[str]
    qr_token: Mapped[str] = mapped_column(unique=True)
    status: Mapped[str] = mapped_column(default="valid")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
