from sqlalchemy.orm import Session

from app.core.email import send_email
from app.core.errors import APIError
from app.db.models import Order, OrderItem, OrganizerProfile, Ticket, TicketType, User
from app.modules.events import service as events_service
from app.modules.tickets import service as tickets_service


def create_order(db: Session, user: User, event_id: int, items_data: list[dict], idempotency_key: str) -> Order:
    existing = db.query(Order).filter_by(idempotency_key=idempotency_key).one_or_none()
    if existing is not None:
        return existing

    event = events_service.get_event_or_404(db, event_id)
    if event.status != "published":
        raise APIError("EVENT_NOT_PUBLISHED", "This event is not open for registration", status_code=409)

    order = Order(event_id=event.id, user_id=user.id, status="pending", idempotency_key=idempotency_key)
    db.add(order)
    db.flush()

    subtotal = 0
    issued_tickets: list[Ticket] = []

    for item in items_data:
        ticket_type = tickets_service.get_ticket_type_or_404(db, item["ticket_type_id"])
        if ticket_type.event_id != event.id:
            raise APIError(
                "INVALID_TICKET_TYPE", "Ticket type does not belong to this event", status_code=400
            )
        if ticket_type.price_kzt > 0:
            raise APIError(
                "PAID_CHECKOUT_NOT_IMPLEMENTED",
                "Paid ticket checkout is not implemented yet",
                status_code=501,
            )

        quantity = item["quantity"]
        attendees = item["attendees"]
        if len(attendees) != quantity:
            raise APIError(
                "INVALID_REQUEST", "Number of attendees must match quantity", status_code=400
            )

        tickets_service.reserve_inventory(db, ticket_type.id, quantity)

        order_item = OrderItem(
            order_id=order.id,
            ticket_type_id=ticket_type.id,
            quantity=quantity,
            unit_price_kzt=ticket_type.price_kzt,
        )
        db.add(order_item)
        db.flush()

        for attendee in attendees:
            ticket = tickets_service.issue_ticket(
                db, order_item.id, ticket_type.id, attendee["name"], attendee["email"]
            )
            issued_tickets.append(ticket)

        subtotal += ticket_type.price_kzt * quantity

    order.subtotal_kzt = subtotal
    order.total_kzt = subtotal
    order.status = "paid" if subtotal == 0 else "pending"
    db.commit()
    db.refresh(order)

    for ticket in issued_tickets:
        send_email(
            to=ticket.attendee_email,
            subject=f"Your ticket for {event.title}",
            body=f"Ticket #{ticket.id} — QR token: {ticket.qr_token}",
        )

    return order


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
    return db.query(Order).filter_by(user_id=user.id).order_by(Order.id.desc()).all()


def list_attendees(db: Session, event_id: int) -> list[dict]:
    ticket_types = {tt.id: tt for tt in db.query(TicketType).filter_by(event_id=event_id).all()}
    if not ticket_types:
        return []
    tickets = db.query(Ticket).filter(Ticket.ticket_type_id.in_(ticket_types.keys())).all()
    return [
        {
            "ticket_id": t.id,
            "attendee_name": t.attendee_name,
            "attendee_email": t.attendee_email,
            "ticket_type_name": ticket_types[t.ticket_type_id].name,
            "status": t.status,
        }
        for t in tickets
    ]
