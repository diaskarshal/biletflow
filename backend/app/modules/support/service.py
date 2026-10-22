from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.email import send_email
from app.core.errors import APIError
from app.db.models import (
    Event,
    EventStaff,
    Order,
    OrderItem,
    OrganizerProfile,
    SupportCase,
    SupportMessage,
    Ticket,
    User,
)
from app.modules.events import service as events_service

ORGANIZER_CATEGORIES = {"account", "activation", "payment", "technical"}
STATUS_LABEL = {
    "open": "Open",
    "in_progress": "In progress",
    "waiting_for_customer": "Waiting for customer",
    "resolved": "Resolved",
}


def _handled_event_ids(db: Session, user: User) -> list[int]:
    owned = [
        e.id
        for e in db.query(Event.id).join(OrganizerProfile, OrganizerProfile.id == Event.organizer_id).filter(
            OrganizerProfile.user_id == user.id
        )
    ]
    staffed = [s.event_id for s in db.query(EventStaff).filter_by(user_id=user.id, role="organizer_staff")]
    return owned + staffed


def can_manage(db: Session, user: User, case: SupportCase) -> bool:
    if user.is_admin:
        return True
    return case.kind == "attendee" and case.event_id in _handled_event_ids(db, user)


def get_case(db: Session, user: User, case_id: int) -> SupportCase:
    case = db.get(SupportCase, case_id)
    if case is None or (case.requester_id != user.id and not can_manage(db, user, case)):
        raise APIError("CASE_NOT_FOUND", "Support case not found", status_code=404)
    return case


def _order_for_requester(db: Session, user: User, order_id: int) -> Order:
    order = db.get(Order, order_id)
    if order is None or order.user_id != user.id:
        raise APIError("ORDER_NOT_FOUND", "Order not found", status_code=404)
    return order


def create_case(db: Session, user: User, data: dict) -> SupportCase:
    event_id, order_id, ticket_id = data["event_id"], data["order_id"], data["ticket_id"]
    if ticket_id is not None:
        ticket = db.get(Ticket, ticket_id)
        item = db.get(OrderItem, ticket.order_item_id) if ticket else None
        if item is None:
            raise APIError("TICKET_NOT_FOUND", "Ticket not found", status_code=404)
        order_id = item.order_id
    if order_id is not None:
        event_id = _order_for_requester(db, user, order_id).event_id
    if event_id is not None:
        event = events_service.get_event_or_404(db, event_id)
        if data["kind"] == "organizer":
            events_service.require_owner(db, user, event)

    if data["kind"] == "attendee" and event_id is None:
        raise APIError("EVENT_REQUIRED", "Choose the event this request is about", status_code=400)
    if data["kind"] == "organizer" and data["category"] not in ORGANIZER_CATEGORIES:
        raise APIError("INVALID_CATEGORY", "This category is for attendee requests", status_code=400)
    if data["kind"] == "attendee" and data["category"] == "activation":
        raise APIError("INVALID_CATEGORY", "This category is for organizer requests", status_code=400)

    case = SupportCase(
        kind=data["kind"],
        requester_id=user.id,
        event_id=event_id,
        order_id=order_id,
        ticket_id=ticket_id,
        category=data["category"],
        subject=data["subject"],
    )
    db.add(case)
    db.flush()
    db.add(SupportMessage(case_id=case.id, author_id=user.id, body=data["message"]))
    db.commit()
    db.refresh(case)
    _notify_handler(db, case, f"New support request #{case.id}: {case.subject}", data["message"])
    return case


def add_message(db: Session, user: User, case: SupportCase, body: str) -> None:
    db.add(SupportMessage(case_id=case.id, author_id=user.id, body=body))
    case.updated_at = datetime.now(UTC)
    if case.requester_id == user.id and case.status == "waiting_for_customer":
        case.status = "open"
    db.commit()
    subject = f"New reply in support case #{case.id}: {case.subject}"
    if case.requester_id == user.id:
        _notify_handler(db, case, subject, body)
    else:
        _notify(db.get(User, case.requester_id), case, subject, body)


def update_case(db: Session, user: User, case: SupportCase, status: str | None, assignee_id: int | None) -> None:
    if not can_manage(db, user, case):
        raise APIError("FORBIDDEN", "Only support staff can change this case", status_code=403)
    assignee = None
    if assignee_id is not None:
        assignee = db.get(User, assignee_id)
        if assignee is None or not can_manage(db, assignee, case):
            raise APIError("INVALID_ASSIGNEE", "This user cannot handle this case", status_code=400)
        case.assignee_id = assignee.id
    status_changed = status is not None and status != case.status
    if status_changed:
        audit.record(
            db, user, "support.status", "support_case", case.id, case.event_id,
            f"Support case #{case.id} moved from {STATUS_LABEL[case.status]} to {STATUS_LABEL[status]}",
        )
        case.status = status
    case.updated_at = datetime.now(UTC)
    db.commit()
    if assignee is not None and assignee.id != user.id:
        _notify(assignee, case, f"Support case #{case.id} was assigned to you", case.subject)
    if status_changed:
        _notify(
            db.get(User, case.requester_id),
            case,
            f"Support case #{case.id} is now {STATUS_LABEL[case.status]}",
            case.subject,
        )


def _notify_handler(db: Session, case: SupportCase, subject: str, body: str) -> None:
    if case.assignee_id is not None:
        _notify(db.get(User, case.assignee_id), case, subject, body)
    elif case.kind == "attendee":
        event = db.get(Event, case.event_id)
        organizer = db.get(OrganizerProfile, event.organizer_id)
        _notify(db.get(User, organizer.user_id), case, subject, body)


def _notify(user: User, case: SupportCase, subject: str, body: str) -> None:
    send_email(user.email, subject, f"{body}\n\nOpen the conversation: {settings.frontend_url}/support/{case.id}\n")


def list_my_cases(db: Session, user: User) -> list[SupportCase]:
    return db.query(SupportCase).filter_by(requester_id=user.id).order_by(SupportCase.updated_at.desc()).all()


def list_inbox(db: Session, user: User, status: str | None) -> list[SupportCase]:
    query = db.query(SupportCase)
    if not user.is_admin:
        query = query.filter(SupportCase.kind == "attendee", SupportCase.event_id.in_(_handled_event_ids(db, user)))
    if status:
        query = query.filter(SupportCase.status == status)
    return query.order_by(SupportCase.updated_at.desc()).all()


def case_out(db: Session, user: User, case: SupportCase) -> dict:
    requester = db.get(User, case.requester_id)
    assignee = db.get(User, case.assignee_id) if case.assignee_id else None
    event = db.get(Event, case.event_id) if case.event_id else None
    return {
        "id": case.id,
        "kind": case.kind,
        "category": case.category,
        "subject": case.subject,
        "status": case.status,
        "requester_name": requester.full_name,
        "requester_email": requester.email,
        "event_id": case.event_id,
        "event_title": event.title if event else None,
        "order_id": case.order_id,
        "ticket_id": case.ticket_id,
        "assignee_id": case.assignee_id,
        "assignee_name": assignee.full_name if assignee else None,
        "can_manage": can_manage(db, user, case),
        "created_at": case.created_at,
        "updated_at": case.updated_at,
    }


def case_detail(db: Session, user: User, case: SupportCase) -> dict:
    rows = (
        db.query(SupportMessage, User.full_name)
        .join(User, User.id == SupportMessage.author_id)
        .filter(SupportMessage.case_id == case.id)
        .order_by(SupportMessage.id)
    )
    return {
        **case_out(db, user, case),
        "messages": [
            {
                "id": m.id,
                "author_name": name,
                "from_requester": m.author_id == case.requester_id,
                "body": m.body,
                "created_at": m.created_at,
            }
            for m, name in rows
        ],
    }
