from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core import audit
from app.core.email import send_email
from app.core.errors import APIError
from app.db.models import (
    Event,
    Order,
    OrderItem,
    OrganizerProfile,
    Payment,
    Ticket,
    TicketType,
    User,
)
from app.modules.events import service as events_service
from app.modules.promos import service as promos_service
from app.modules.tickets import service as tickets_service


def ticket_email_body(event: Event, ticket: Ticket) -> str:
    starts = event.starts_at.astimezone(ZoneInfo(event.display_timezone))
    venue = ", ".join(v for v in (event.venue_name, event.venue_address) if v)
    lines = [
        f"Hi {ticket.attendee_name},",
        "",
        f"You're registered for {event.title}.",
        f"When: {starts:%d %b %Y, %H:%M} ({event.display_timezone})",
    ]
    if venue:
        lines.append(f"Where: {venue}")
    lines += [
        f"Ticket: #{ticket.id}",
        "",
        "Your QR code and a printable PDF ticket are attached. Show either at the entrance.",
        "You can also find it under My tickets on BiletFlow.",
    ]
    return "\n".join(lines)


HOLD_MINUTES = 15


def create_order(
    db: Session,
    user: User,
    event_id: int,
    items_data: list[dict],
    idempotency_key: str,
    promo_code: str | None = None,
) -> Order:
    existing = db.query(Order).filter_by(idempotency_key=idempotency_key).one_or_none()
    if existing is not None:
        return existing

    expire_stale_orders(db)
    event = events_service.get_event_or_404(db, event_id)
    if event.status != "published":
        raise APIError("EVENT_NOT_PUBLISHED", "This event is not open for registration", status_code=409)
    if event.suspended_at is not None:
        raise APIError("EVENT_SUSPENDED", "This event has been suspended by the platform", status_code=409)

    lines = []
    for item in items_data:
        ticket_type = tickets_service.get_ticket_type_or_404(db, item["ticket_type_id"])
        if ticket_type.event_id != event.id:
            raise APIError(
                "INVALID_TICKET_TYPE", "Ticket type does not belong to this event", status_code=400
            )
        if len(item["attendees"]) != item["quantity"]:
            raise APIError(
                "INVALID_REQUEST", "Number of attendees must match quantity", status_code=400
            )
        if ticket_type.max_per_order is not None:
            held = (
                db.query(Ticket)
                .join(OrderItem)
                .join(Order)
                .filter(
                    Order.user_id == user.id,
                    Ticket.ticket_type_id == ticket_type.id,
                    Ticket.status.in_(("pending", "valid", "checked_in")),
                )
                .count()
            )
            if held + item["quantity"] > ticket_type.max_per_order:
                raise APIError(
                    "TICKET_LIMIT_REACHED",
                    f"You can get at most {ticket_type.max_per_order} {ticket_type.name} ticket(s)",
                    status_code=409,
                )
        lines.append((ticket_type, item))

    subtotal = sum(tt.price_kzt * item["quantity"] for tt, item in lines)
    if subtotal > 0 and not event.paid_sales_enabled:
        raise APIError(
            "PAID_SALES_NOT_ACTIVE", "Paid tickets for this event are not on sale yet", status_code=409
        )

    campaign = promos_service.find_active(db, event.id, code=promo_code) if promo_code else None
    discount = (
        promos_service.discount_for(campaign, [(tt, item["quantity"]) for tt, item in lines])
        if campaign
        else 0
    )
    if campaign:
        promos_service.redeem(db, campaign.id)
    total = subtotal - discount
    paid = total > 0

    order = Order(
        event_id=event.id,
        user_id=user.id,
        status="pending" if paid else "paid",
        idempotency_key=idempotency_key,
        subtotal_kzt=subtotal,
        discount_kzt=discount,
        total_kzt=total,
        promo_campaign_id=campaign.id if campaign else None,
        expires_at=datetime.now(UTC) + timedelta(minutes=HOLD_MINUTES) if paid else None,
    )
    db.add(order)
    db.flush()

    tickets: list[Ticket] = []
    for ticket_type, item in lines:
        tickets_service.reserve_inventory(db, ticket_type.id, item["quantity"], hold=paid)
        order_item = OrderItem(
            order_id=order.id,
            ticket_type_id=ticket_type.id,
            quantity=item["quantity"],
            unit_price_kzt=ticket_type.price_kzt,
        )
        db.add(order_item)
        db.flush()
        for attendee in item["attendees"]:
            tickets.append(
                tickets_service.issue_ticket(
                    db,
                    order_item.id,
                    ticket_type.id,
                    attendee["name"],
                    attendee["email"],
                    status="pending" if paid else "valid",
                )
            )

    if paid:
        db.add(
            Payment(
                purpose="order",
                event_id=event.id,
                order_id=order.id,
                user_id=user.id,
                amount_kzt=total,
            )
        )
    db.commit()
    db.refresh(order)

    if not paid:
        send_ticket_emails(db, event, tickets)
    return order


def send_ticket_emails(db: Session, event: Event, tickets: list[Ticket]) -> None:
    for ticket in tickets:
        send_email(
            to=ticket.attendee_email,
            subject=f"Your ticket for {event.title}",
            body=ticket_email_body(event, ticket),
            attachments={
                f"ticket-{ticket.id}.png": tickets_service.qr_png(ticket),
                f"ticket-{ticket.id}.pdf": tickets_service.ticket_pdf(db, ticket),
            },
        )


def confirm_order(db: Session, order: Order) -> list[Ticket]:
    order.status = "paid"
    for item in list_order_items(db, order.id):
        tickets_service.move_inventory(db, item.ticket_type_id, sold=item.quantity, reserved=-item.quantity)
    tickets = list_order_tickets(db, order.id)
    for ticket in tickets:
        ticket.status = "valid"
    return tickets


def release_order(db: Session, order: Order, status: str) -> None:
    order.status = status
    if order.promo_campaign_id:
        promos_service.release(db, order.promo_campaign_id)
    for item in list_order_items(db, order.id):
        tickets_service.move_inventory(db, item.ticket_type_id, reserved=-item.quantity)
    for ticket in list_order_tickets(db, order.id):
        ticket.status = "cancelled"


def expire_stale_orders(db: Session) -> None:
    stale = (
        db.query(Order)
        .filter(Order.status == "pending", Order.expires_at < datetime.now(UTC))
        .with_for_update(skip_locked=True)
        .all()
    )
    for order in stale:
        release_order(db, order, "expired")
        db.query(Payment).filter_by(order_id=order.id, status="pending").update({"status": "expired"})
    if stale:
        db.commit()


def pending_payment_id(db: Session, order: Order) -> int | None:
    payment = db.query(Payment).filter_by(order_id=order.id, status="pending").one_or_none()
    return payment.id if payment else None


def list_order_items(db: Session, order_id: int) -> list[OrderItem]:
    return db.query(OrderItem).filter_by(order_id=order_id).order_by(OrderItem.id).all()


def list_order_tickets(db: Session, order_id: int) -> list[Ticket]:
    item_ids = [item.id for item in list_order_items(db, order_id)]
    if not item_ids:
        return []
    return db.query(Ticket).filter(Ticket.order_item_id.in_(item_ids)).order_by(Ticket.id).all()


def get_order_or_404(db: Session, order_id: int) -> Order:
    order = db.get(Order, order_id)
    if order is None:
        raise APIError("ORDER_NOT_FOUND", "Order not found", status_code=404)
    return order


def require_order_access(db: Session, order: Order, user: User) -> None:
    if order.user_id == user.id:
        return
    event = events_service.get_event_or_404(db, order.event_id)
    organizer = db.query(OrganizerProfile).filter_by(user_id=user.id).one_or_none()
    if organizer is not None and organizer.id == event.organizer_id:
        return
    raise APIError("FORBIDDEN", "You cannot view this order", status_code=403)


def list_my_orders(db: Session, user: User) -> list[Order]:
    expire_stale_orders(db)
    return db.query(Order).filter_by(user_id=user.id).order_by(Order.id.desc()).all()


def list_attendees(db: Session, event_id: int, search: str = "") -> list[dict]:
    query = (
        db.query(Ticket, TicketType.name, Order)
        .join(TicketType, TicketType.id == Ticket.ticket_type_id)
        .join(OrderItem, OrderItem.id == Ticket.order_item_id)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.event_id == event_id, Order.status.in_(("paid", "cancelled", "refunded")))
    )
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(Ticket.attendee_name.ilike(like) | Ticket.attendee_email.ilike(like))
    rows = query.order_by(Ticket.id).all()
    return [
        {
            "ticket_id": t.id,
            "order_id": order.id,
            "order_total_kzt": order.total_kzt,
            "attendee_name": t.attendee_name,
            "attendee_email": t.attendee_email,
            "ticket_type_name": type_name,
            "status": t.status,
        }
        for t, type_name, order in rows
    ]


def _void_order(db: Session, order: Order, status: str) -> None:
    for item in list_order_items(db, order.id):
        tickets_service.move_inventory(db, item.ticket_type_id, sold=-item.quantity)
    for ticket in list_order_tickets(db, order.id):
        ticket.status = status
    order.status = status
    if status == "refunded":
        db.query(Payment).filter_by(order_id=order.id, status="succeeded").update(
            {"status": "refunded", "refunded_at": datetime.now(UTC)}
        )


def _notify_voided(db: Session, event: Event, order: Order, reason: str) -> None:
    buyer = db.get(User, order.user_id)
    money = (
        f"A full refund of {order.total_kzt} KZT was issued to your original payment method."
        if order.status == "refunded"
        else "Your tickets for this order are no longer valid."
    )
    send_email(
        to=buyer.email,
        subject=f"{reason}: {event.title}",
        body=f"Hi {buyer.full_name},\n\n{reason} for {event.title} (order #{order.id}).\n{money}",
    )


def cancel_order(db: Session, actor: User, order: Order) -> Order:
    if order.status != "paid":
        raise APIError(
            "ORDER_NOT_CANCELLABLE", "Only completed orders can be cancelled or refunded", status_code=409
        )
    if any(t.status == "checked_in" for t in list_order_tickets(db, order.id)):
        raise APIError(
            "TICKET_ALREADY_USED", "A ticket in this order was already checked in", status_code=409
        )
    status = "refunded" if order.total_kzt > 0 else "cancelled"
    _void_order(db, order, status)
    audit.record(
        db, actor, f"order.{status}", "order", order.id, order.event_id,
        f"{'Refunded' if status == 'refunded' else 'Cancelled'} order #{order.id} ({order.total_kzt} KZT)",
    )
    db.commit()
    db.refresh(order)
    reason = "Refund completed" if status == "refunded" else "Registration cancelled"
    _notify_voided(db, db.get(Event, order.event_id), order, reason)
    return order


def cancel_event(db: Session, actor: User, event: Event) -> Event:
    if event.status in ("cancelled", "completed"):
        raise APIError("INVALID_EVENT_STATUS", "Event is already cancelled or completed", status_code=409)
    event.status = "cancelled"
    voided = []
    for order in db.query(Order).filter(Order.event_id == event.id, Order.status.in_(("paid", "pending"))):
        if order.status == "pending":
            release_order(db, order, "cancelled")
            db.query(Payment).filter_by(order_id=order.id, status="pending").update({"status": "expired"})
        else:
            _void_order(db, order, "refunded" if order.total_kzt > 0 else "cancelled")
            voided.append(order)
    audit.record(
        db, actor, "event.cancelled", "event", event.id, event.id,
        f"Cancelled the event, {len(voided)} orders cancelled or refunded",
    )
    db.commit()
    db.refresh(event)
    for order in voided:
        _notify_voided(db, event, order, "Event cancelled")
    return event
