import io
import secrets

import qrcode
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.db.models import Event, OrganizerProfile, Ticket, TicketType, User


def create_ticket_type(db: Session, event: Event, data: dict) -> TicketType:
    ticket_type = TicketType(event_id=event.id, **data)
    db.add(ticket_type)
    db.commit()
    db.refresh(ticket_type)
    return ticket_type


def list_ticket_types(db: Session, event: Event) -> list[TicketType]:
    return db.query(TicketType).filter_by(event_id=event.id).order_by(TicketType.id).all()


def get_ticket_type_or_404(db: Session, ticket_type_id: int) -> TicketType:
    ticket_type = db.get(TicketType, ticket_type_id)
    if ticket_type is None:
        raise APIError("TICKET_TYPE_NOT_FOUND", "Ticket type not found", status_code=404)
    return ticket_type


def update_ticket_type(db: Session, ticket_type: TicketType, data: dict) -> TicketType:
    for field, value in data.items():
        if value is not None:
            setattr(ticket_type, field, value)
    db.commit()
    db.refresh(ticket_type)
    return ticket_type


def reserve_inventory(db: Session, ticket_type_id: int, quantity: int) -> None:
    result = db.execute(
        update(TicketType)
        .where(
            TicketType.id == ticket_type_id,
            TicketType.quantity_sold + TicketType.quantity_reserved + quantity <= TicketType.quantity_total,
        )
        .values(quantity_sold=TicketType.quantity_sold + quantity)
    )
    if result.rowcount == 0:
        raise APIError(
            "INVENTORY_UNAVAILABLE", "Not enough tickets remaining for this ticket type", status_code=409
        )


def issue_ticket(db: Session, order_item_id: int, ticket_type_id: int, attendee_name: str, attendee_email: str) -> Ticket:
    ticket = Ticket(
        order_item_id=order_item_id,
        ticket_type_id=ticket_type_id,
        attendee_name=attendee_name,
        attendee_email=attendee_email,
        qr_token="T_" + secrets.token_urlsafe(32),
    )
    db.add(ticket)
    db.flush()
    return ticket


def get_ticket_or_404(db: Session, ticket_id: int) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise APIError("TICKET_NOT_FOUND", "Ticket not found", status_code=404)
    return ticket


def require_ticket_access(db: Session, ticket: Ticket, user: User) -> None:
    if ticket.attendee_email == user.email:
        return
    ticket_type = db.get(TicketType, ticket.ticket_type_id)
    event = db.get(Event, ticket_type.event_id) if ticket_type else None
    if event is not None:
        organizer = db.query(OrganizerProfile).filter_by(user_id=user.id).one_or_none()
        if organizer is not None and organizer.id == event.organizer_id:
            return
    raise APIError("FORBIDDEN", "You cannot view this ticket", status_code=403)


def qr_png(ticket: Ticket) -> bytes:
    img = qrcode.make(ticket.qr_token)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
