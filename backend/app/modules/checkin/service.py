from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.db.models import CheckInRecord, Ticket, TicketType, User
from app.modules.events import service as events_service


def check_in(db: Session, event_admin: User, qr_token: str, event_id: int) -> dict:
    event = events_service.get_event_or_404(db, event_id)
    events_service.require_owner(db, event_admin, event)

    ticket = db.query(Ticket).filter_by(qr_token=qr_token).one_or_none()
    if ticket is None:
        raise APIError("TICKET_INVALID", "Ticket not found", status_code=404)

    ticket_type = db.get(TicketType, ticket.ticket_type_id)
    if ticket_type is None or ticket_type.event_id != event_id:
        raise APIError("TICKET_INVALID", "This ticket is not for this event", status_code=400)

    if ticket.status == "cancelled":
        raise APIError("TICKET_CANCELLED", "This ticket has been cancelled", status_code=409)
    if ticket.status == "refunded":
        raise APIError("TICKET_REFUNDED", "This ticket has been refunded", status_code=409)
    if ticket.status == "checked_in":
        raise APIError("ALREADY_CHECKED_IN", "This ticket has already been used", status_code=409)

    record = CheckInRecord(ticket_id=ticket.id, event_admin_id=event_admin.id)
    db.add(record)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise APIError("ALREADY_CHECKED_IN", "This ticket has already been used", status_code=409) from exc

    ticket.status = "checked_in"
    db.commit()
    db.refresh(record)
    return {
        "ticket_id": ticket.id,
        "attendee_name": ticket.attendee_name,
        "checked_in_at": record.checked_in_at,
    }
