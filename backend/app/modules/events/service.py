import re
import secrets

from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.db.models import Event, OrganizerProfile, User
from app.modules.auth.service import get_or_create_organizer_profile


def _slugify(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "event"
    return base[:60]


def _unique_slug(db: Session, title: str) -> str:
    base = _slugify(title)
    slug = base
    while db.query(Event).filter_by(slug=slug).one_or_none() is not None:
        slug = f"{base}-{secrets.token_hex(3)}"
    return slug


def create_event(db: Session, user: User, data: dict) -> Event:
    organizer = get_or_create_organizer_profile(db, user)
    event = Event(organizer_id=organizer.id, slug=_unique_slug(db, data["title"]), **data)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


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


def require_owner(db: Session, user: User, event: Event) -> None:
    organizer = db.query(OrganizerProfile).filter_by(user_id=user.id).one_or_none()
    if organizer is None or organizer.id != event.organizer_id:
        raise APIError("FORBIDDEN", "You do not manage this event", status_code=403)


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
