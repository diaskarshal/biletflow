from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "status in ('pending','paid','cancelled','refunded','expired')", name="ck_orders_status"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(default="pending")
    subtotal_kzt: Mapped[int] = mapped_column(default=0)
    discount_kzt: Mapped[int] = mapped_column(default=0)
    fee_kzt: Mapped[int] = mapped_column(default=0)
    total_kzt: Mapped[int] = mapped_column(default=0)
    idempotency_key: Mapped[str] = mapped_column(unique=True)
    expires_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    ticket_type_id: Mapped[int] = mapped_column(ForeignKey("ticket_types.id"))
    quantity: Mapped[int]
    unit_price_kzt: Mapped[int]
