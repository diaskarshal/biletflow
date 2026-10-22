from datetime import UTC, datetime

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import APIError
from app.db.models import CheckInRecord, Ticket, TicketType, User
from app.modules.events import service as events_service
from app.modules.orders import service as orders_service


def _require_admin(db: Session, event_admin: User, event_id: int) -> None:
    events_service.require_event_admin(db, event_admin, events_service.get_event_or_404(db, event_id))


def _ticket_for_event(db: Session, ticket: Ticket | None, event_id: int) -> Ticket:
    if ticket is None:
        raise APIError("TICKET_INVALID", "Ticket not found", status_code=404)
    ticket_type = db.get(TicketType, ticket.ticket_type_id)
    if ticket_type is None or ticket_type.event_id != event_id:
        raise APIError("TICKET_INVALID", "This ticket is not for this event", status_code=400)
    return ticket


def _admit(db: Session, event_admin: User, ticket: Ticket, event_id: int) -> dict:
    if ticket.status == "pending":
        raise APIError("TICKET_UNPAID", "This ticket has not been paid for", status_code=409)
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
    audit.record(
        db, event_admin, "checkin", "ticket", ticket.id, event_id,
        f"Checked in {ticket.attendee_name} (ticket #{ticket.id})",
    )
    db.commit()
    db.refresh(record)
    return {
        "ticket_id": ticket.id,
        "attendee_name": ticket.attendee_name,
        "checked_in_at": record.checked_in_at,
    }


def check_in(db: Session, event_admin: User, qr_token: str, event_id: int) -> dict:
    _require_admin(db, event_admin, event_id)
    ticket = db.query(Ticket).filter_by(qr_token=qr_token).one_or_none()
    return _admit(db, event_admin, _ticket_for_event(db, ticket, event_id), event_id)


def check_in_ticket(db: Session, event_admin: User, ticket_id: int, event_id: int) -> dict:
    _require_admin(db, event_admin, event_id)
    return _admit(db, event_admin, _ticket_for_event(db, db.get(Ticket, ticket_id), event_id), event_id)


def undo_check_in(db: Session, event_admin: User, ticket_id: int, event_id: int) -> None:
    _require_admin(db, event_admin, event_id)
    ticket = _ticket_for_event(db, db.get(Ticket, ticket_id), event_id)
    record = db.query(CheckInRecord).filter_by(ticket_id=ticket.id, reversed_at=None).one_or_none()
    if record is None:
        raise APIError("NOT_CHECKED_IN", "This ticket is not checked in", status_code=409)
    record.reversed_at = datetime.now(UTC)
    ticket.status = "valid"
    audit.record(
        db, event_admin, "checkin.reversed", "ticket", ticket.id, event_id,
        f"Undid check-in of {ticket.attendee_name} (ticket #{ticket.id})",
    )
    db.commit()


def summary(db: Session, event_admin: User, event_id: int) -> dict:
    _require_admin(db, event_admin, event_id)
    counts = dict(
        db.query(Ticket.status, func.count(Ticket.id))
        .join(TicketType, TicketType.id == Ticket.ticket_type_id)
        .filter(TicketType.event_id == event_id, Ticket.status.in_(("valid", "checked_in")))
        .group_by(Ticket.status)
    )
    checked_in = counts.get("checked_in", 0)
    return {"registered": checked_in + counts.get("valid", 0), "checked_in": checked_in}


def search(db: Session, event_admin: User, event_id: int, query: str) -> list[dict]:
    _require_admin(db, event_admin, event_id)
    return orders_service.list_attendees(db, event_id, query)[:50]
