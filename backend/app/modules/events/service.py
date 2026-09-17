import re
import secrets

from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.db.models import Event, EventStaff, OrganizerProfile, User
from app.modules.auth.service import get_or_create_organizer_profile
from app.modules.tickets import service as tickets_service


def _slugify(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "event"
    return base[:60]


def _unique_slug(db: Session, title: str) -> str:
    base = _slugify(title)
    slug = base
    while db.query(Event).filter_by(slug=slug).one_or_none() is not None:
        slug = f"{base}-{secrets.token_hex(3)}"
    return slug


def create_event(db: Session, user: User, data: dict) -> tuple[Event, list]:
    ticket_types_data = data.pop("ticket_types", [])

    organizer = get_or_create_organizer_profile(db, user)
    event = Event(organizer_id=organizer.id, slug=_unique_slug(db, data["title"]), **data)
    db.add(event)
    db.flush()

    ticket_types = [
        tickets_service.create_ticket_type(db, event, tt_data) for tt_data in ticket_types_data
    ]

    db.commit()
    db.refresh(event)
    return event, ticket_types


def get_event_or_404(db: Session, event_id: int) -> Event:
    event = db.get(Event, event_id)
    if event is None or event.deleted_at is not None:
        raise APIError("EVENT_NOT_FOUND", "Event not found", status_code=404)
    return event


def get_published_event_by_slug(db: Session, slug: str) -> Event:
    event = db.query(Event).filter_by(slug=slug).one_or_none()
    if event is None or event.deleted_at is not None or event.status not in ("published", "completed"):
        raise APIError("EVENT_NOT_FOUND", "Event not found", status_code=404)
    return event


def is_owner(db: Session, user: User, event: Event) -> bool:
    organizer = db.query(OrganizerProfile).filter_by(user_id=user.id).one_or_none()
    return organizer is not None and organizer.id == event.organizer_id


def get_event_by_slug_for_viewer(db: Session, slug: str, user: User | None) -> Event:
    event = db.query(Event).filter_by(slug=slug).one_or_none()
    if event is None or event.deleted_at is not None:
        raise APIError("EVENT_NOT_FOUND", "Event not found", status_code=404)
    if event.status in ("published", "completed"):
        return event
    if user is not None and is_owner(db, user, event):
        return event
    raise APIError("EVENT_NOT_FOUND", "Event not found", status_code=404)


def require_owner(db: Session, user: User, event: Event) -> None:
    if not is_owner(db, user, event):
        raise APIError("FORBIDDEN", "You do not manage this event", status_code=403)


def require_event_admin(db: Session, user: User, event: Event) -> None:
    if is_owner(db, user, event):
        return
    staff = (
        db.query(EventStaff)
        .filter_by(event_id=event.id, user_id=user.id, role="event_admin")
        .one_or_none()
    )
    if staff is None:
        raise APIError("FORBIDDEN", "You are not authorized to check in tickets for this event", status_code=403)


def list_published_events(db: Session, limit: int, cursor: int | None) -> tuple[list[Event], int | None]:
    query = db.query(Event).filter(Event.status == "published", Event.deleted_at.is_(None))
    if cursor is not None:
        query = query.filter(Event.id > cursor)
    events = query.order_by(Event.id).limit(limit + 1).all()
    next_cursor = events[limit].id if len(events) > limit else None
    return events[:limit], next_cursor


def list_organizer_events(db: Session, user: User) -> list[Event]:
    organizer = db.query(OrganizerProfile).filter_by(user_id=user.id).one_or_none()
    if organizer is None:
        return []
    return (
        db.query(Event)
        .filter(Event.organizer_id == organizer.id, Event.deleted_at.is_(None))
        .order_by(Event.id.desc())
        .all()
    )


def update_event(db: Session, event: Event, data: dict) -> Event:
    for field, value in data.items():
        if value is not None:
            setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


def publish_event(db: Session, event: Event) -> Event:
    if event.status != "draft":
        raise APIError("INVALID_EVENT_STATUS", "Only draft events can be published", status_code=409)
    event.status = "published"
    db.commit()
    db.refresh(event)
    return event


def cancel_event(db: Session, event: Event) -> Event:
    if event.status in ("cancelled", "completed"):
        raise APIError("INVALID_EVENT_STATUS", "Event is already cancelled or completed", status_code=409)
    event.status = "cancelled"
    db.commit()
    db.refresh(event)
    return event


def add_staff(db: Session, event: Event, email: str, role: str) -> EventStaff:
    target_user = db.query(User).filter_by(email=email).one_or_none()
    if target_user is None:
        raise APIError("USER_NOT_FOUND", "No account exists with this email", status_code=404)

    existing = db.query(EventStaff).filter_by(event_id=event.id, user_id=target_user.id).one_or_none()
    if existing is not None:
        raise APIError("STAFF_ALREADY_ASSIGNED", "This user is already staff on this event", status_code=409)

    staff = EventStaff(event_id=event.id, user_id=target_user.id, role=role)
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


def list_staff(db: Session, event: Event) -> list[EventStaff]:
    return db.query(EventStaff).filter_by(event_id=event.id).order_by(EventStaff.id).all()
