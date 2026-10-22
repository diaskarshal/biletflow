from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core import audit
from app.core.email import send_email
from app.core.errors import APIError
from app.db.models import Event, Order, Payment, User
from app.modules.events import service as events_service
from app.modules.orders import service as orders_service

OUTCOME_STATUS = {"success": "succeeded", "failure": "failed", "timeout": "expired"}


def get_payment(db: Session, payment_id: int, user: User) -> Payment:
    orders_service.expire_stale_orders(db)
    payment = db.get(Payment, payment_id)
    if payment is None or payment.user_id != user.id:
        raise APIError("PAYMENT_NOT_FOUND", "Payment not found", status_code=404)
    return payment


def to_out(db: Session, payment: Payment) -> dict:
    return {
        "id": payment.id,
        "purpose": payment.purpose,
        "status": payment.status,
        "amount_kzt": payment.amount_kzt,
        "event_id": payment.event_id,
        "event_title": db.get(Event, payment.event_id).title,
        "order_id": payment.order_id,
        "created_at": payment.created_at,
    }


def apply_provider_result(db: Session, payment: Payment, outcome: str, payer: User) -> Payment:
    if payment.status != "pending":
        raise APIError("PAYMENT_CLOSED", "This payment is already completed or expired", status_code=409)

    status = OUTCOME_STATUS[outcome]
    payment.status = status
    payment.completed_at = datetime.now(UTC)
    event = db.get(Event, payment.event_id)
    tickets = []
    if payment.purpose == "activation":
        if status == "succeeded":
            events_service.complete_activation(db, event)
    else:
        order = db.get(Order, payment.order_id)
        if status == "succeeded":
            tickets = orders_service.confirm_order(db, order)
        else:
            orders_service.release_order(db, order, "failed" if status == "failed" else "expired")
    what = "activation fee" if payment.purpose == "activation" else f"order #{payment.order_id}"
    audit.record(
        db, payer, f"payment.{status}", "payment", payment.id, payment.event_id,
        f"Payment #{payment.id} for {what} {status} ({payment.amount_kzt} KZT)",
    )
    db.commit()
    db.refresh(payment)

    if tickets:
        orders_service.send_ticket_emails(db, event, tickets)
    if payment.purpose == "order" and status == "failed":
        send_email(
            to=payer.email,
            subject=f"Payment failed for {event.title}",
            body=(
                f"Hi {payer.full_name},\n\n"
                f"Your payment of {payment.amount_kzt} KZT for {event.title} did not go through, "
                "so no tickets were issued and the seats were released.\n"
                "You can try again from the event page."
            ),
        )
    return payment
