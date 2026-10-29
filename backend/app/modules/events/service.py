import io
import re
import secrets
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.email import send_email
from app.core.errors import APIError
from app.db.models import (
    AuditLog,
    Event,
    EventStaff,
    Order,
    OrganizerProfile,
    Payment,
    Ticket,
    TicketType,
    User,
)
from app.modules.admin import service as admin_service
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
    audit.record(db, user, "event.created", "event", event.id, event.id, f"Created event {event.title}")

    db.commit()
    db.refresh(event)
    return event, ticket_types


def get_event_or_404(db: Session, event_id: int) -> Event:
    event = db.get(Event, event_id)
    if event is None or event.deleted_at is not None:
        raise APIError("EVENT_NOT_FOUND", "Event not found", status_code=404)
    return event


def is_owner(db: Session, user: User, event: Event) -> bool:
    organizer = db.query(OrganizerProfile).filter_by(user_id=user.id).one_or_none()
    return organizer is not None and organizer.id == event.organizer_id


def get_event_by_slug_for_viewer(db: Session, slug: str, user: User | None) -> Event:
    event = db.query(Event).filter_by(slug=slug).one_or_none()
    if event is None or event.deleted_at is not None:
        raise APIError("EVENT_NOT_FOUND", "Event not found", status_code=404)
    if event.status in ("published", "completed") and event.review_status == "approved" and event.suspended_at is None:
        return event
    if user is not None and (user.is_admin or is_owner(db, user, event)):
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
    query = db.query(Event).filter(
        Event.status == "published",
        Event.review_status == "approved",
        Event.deleted_at.is_(None),
        Event.suspended_at.is_(None),
    )
    if cursor is not None:
        query = query.filter(Event.id > cursor)
    events = query.order_by(Event.id).limit(limit + 1).all()
    next_cursor = events[limit - 1].id if len(events) > limit else None
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


def require_not_suspended(event: Event) -> None:
    if event.suspended_at is not None:
        raise APIError("EVENT_SUSPENDED", "This event has been suspended by the platform", status_code=409)


def update_event(db: Session, actor: User, event: Event, data: dict) -> Event:
    require_not_suspended(event)
    changes = {
        field: str(value)
        for field, value in data.items()
        if value is not None and (getattr(event, field) or None) != (value or None)
    }
    for field, value in data.items():
        if value is not None:
            setattr(event, field, value)
    if changes and event.review_status == "rejected":
        event.review_status = "pending"
    if changes:
        audit.record(
            db, actor, "event.updated", "event", event.id, event.id,
            "Changed " + ", ".join(changes), changes,
        )
    db.commit()
    db.refresh(event)
    if event.status == "published" and changes.keys() & NOTIFY_FIELDS:
        _notify_ticket_holders(db, event)
    return event


NOTIFY_FIELDS = {"starts_at", "ends_at", "venue_name", "venue_address"}


def _notify_ticket_holders(db: Session, event: Event) -> None:
    starts = event.starts_at.astimezone(ZoneInfo(event.display_timezone))
    venue = ", ".join(v for v in (event.venue_name, event.venue_address) if v) or "To be announced"
    body = (
        f"The organizer changed the details of {event.title}.\n\n"
        f"When: {starts:%d %b %Y, %H:%M} ({event.display_timezone})\n"
        f"Where: {venue}\n\n"
        f"Your ticket is still valid. Event page: {settings.frontend_url}/events/{event.slug}\n"
    )
    emails = {
        email
        for (email,) in db.query(Ticket.attendee_email)
        .join(TicketType, TicketType.id == Ticket.ticket_type_id)
        .filter(TicketType.event_id == event.id, Ticket.status == "valid")
    }
    for email in sorted(emails):
        send_email(email, f"Update: {event.title}", body)


def publish_event(db: Session, actor: User, event: Event) -> Event:
    if event.status != "draft":
        raise APIError("INVALID_EVENT_STATUS", "Only draft events can be published", status_code=409)
    event.status = "published"
    audit.record(db, actor, "event.published", "event", event.id, event.id, "Published the event")
    db.commit()
    db.refresh(event)
    return event


def unpublish_event(db: Session, actor: User, event: Event) -> Event:
    if event.status != "published":
        raise APIError("INVALID_EVENT_STATUS", "Only published events can be unpublished", status_code=409)
    if db.query(Order).filter(Order.event_id == event.id, Order.status.in_(("paid", "pending"))).first():
        raise APIError(
            "EVENT_HAS_ORDERS", "This event already has registrations. Cancel it instead.", status_code=409
        )
    event.status = "draft"
    audit.record(db, actor, "event.unpublished", "event", event.id, event.id, "Unpublished the event")
    db.commit()
    db.refresh(event)
    return event


COPIED_EVENT_FIELDS = (
    "description", "category", "venue_name", "venue_address", "cover_image_url", "starts_at", "ends_at",
    "display_timezone", "visibility", "capacity", "refund_policy",
)
COPIED_TYPE_FIELDS = (
    "name", "description", "price_kzt", "quantity_total", "sales_start_at", "sales_end_at", "max_per_order",
    "is_hidden",
)


def duplicate_event(db: Session, actor: User, source: Event) -> tuple[Event, list]:
    require_not_suspended(source)
    data = {field: getattr(source, field) for field in COPIED_EVENT_FIELDS}
    data["title"] = f"{source.title} (copy)"
    data["ticket_types"] = [
        {field: getattr(t, field) for field in COPIED_TYPE_FIELDS}
        for t in tickets_service.list_ticket_types(db, source)
    ]
    event, ticket_types = create_event(db, actor, data)
    audit.record(
        db, actor, "event.duplicated", "event", event.id, event.id,
        f"Duplicated from {source.title} (#{source.id})",
    )
    db.commit()
    return event, ticket_types


def require_event_manager(db: Session, user: User, event: Event) -> None:
    if user.is_admin or is_owner(db, user, event):
        return
    if db.query(EventStaff).filter_by(event_id=event.id, user_id=user.id, role="organizer_staff").first() is None:
        raise APIError("FORBIDDEN", "You cannot view this event's history", status_code=403)


def list_activity(
    db: Session, event: Event, date_from: date | None, date_to: date | None, action: str | None
) -> list[dict]:
    tz = ZoneInfo(event.display_timezone)
    query = (
        db.query(AuditLog, User.full_name)
        .outerjoin(User, User.id == AuditLog.actor_user_id)
        .filter(AuditLog.event_id == event.id)
    )
    if date_from:
        query = query.filter(AuditLog.created_at >= datetime.combine(date_from, time.min, tz))
    if date_to:
        query = query.filter(AuditLog.created_at < datetime.combine(date_to + timedelta(days=1), time.min, tz))
    if action:
        query = query.filter(AuditLog.action_type.startswith(action))
    return [
        {
            "id": entry.id,
            "created_at": entry.created_at,
            "actor_name": name or "System",
            "action_type": entry.action_type,
            "entity_type": entry.entity_type,
            "entity_id": entry.entity_id,
            "description": entry.description,
        }
        for entry, name in query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    ]


def add_staff(db: Session, event: Event, email: str, role: str) -> dict:
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
    return _staff_out(staff, target_user)


def list_staff(db: Session, event: Event) -> list[dict]:
    rows = (
        db.query(EventStaff, User)
        .join(User, User.id == EventStaff.user_id)
        .filter(EventStaff.event_id == event.id)
        .order_by(EventStaff.id)
        .all()
    )
    return [_staff_out(staff, user) for staff, user in rows]


def _staff_out(staff: EventStaff, user: User) -> dict:
    return {
        "id": staff.id,
        "event_id": staff.event_id,
        "user_id": staff.user_id,
        "email": user.email,
        "full_name": user.full_name,
        "role": staff.role,
        "created_at": staff.created_at,
    }


def list_checkin_events(db: Session, user: User) -> list[Event]:
    organizer = db.query(OrganizerProfile).filter_by(user_id=user.id).one_or_none()
    staffed = db.query(EventStaff.event_id).filter_by(user_id=user.id, role="event_admin")
    allowed = Event.id.in_(staffed)
    if organizer is not None:
        allowed = or_(allowed, Event.organizer_id == organizer.id)
    return (
        db.query(Event)
        .filter(allowed, Event.deleted_at.is_(None))
        .order_by(Event.starts_at)
        .all()
    )


def activation_status(db: Session, event: Event) -> dict:
    organizer = db.get(OrganizerProfile, event.organizer_id)
    has_paid_type = (
        db.query(TicketType).filter(TicketType.event_id == event.id, TicketType.price_kzt > 0).first()
        is not None
    )
    pending = (
        db.query(Payment)
        .filter_by(event_id=event.id, purpose="activation", status="pending")
        .one_or_none()
    )
    return {
        "fee_kzt": admin_service.get_activation_fee(db),
        "has_paid_ticket_type": has_paid_type,
        "organizer_verified": organizer.verification_status == "approved",
        "payout_account_set": bool(organizer.payout_account),
        "terms_accepted": event.terms_accepted_at is not None,
        "fee_paid": event.activation_paid_at is not None,
        "paid_sales_enabled": event.paid_sales_enabled,
        "suspended": event.paid_sales_suspended_at is not None,
        "pending_payment_id": pending.id if pending else None,
    }


def accept_terms(db: Session, event: Event) -> None:
    event.terms_accepted_at = event.terms_accepted_at or datetime.now(UTC)
    db.commit()


def start_activation_payment(db: Session, user: User, event: Event) -> Payment:
    status = activation_status(db, event)
    if status["fee_paid"]:
        raise APIError("ALREADY_ACTIVATED", "Paid sales are already activated for this event", status_code=409)
    missing = [
        key
        for key in ("has_paid_ticket_type", "organizer_verified", "payout_account_set", "terms_accepted")
        if not status[key]
    ]
    if missing:
        raise APIError(
            "ACTIVATION_INCOMPLETE",
            "Complete the activation checklist before paying the fee",
            status_code=409,
            details={"missing": missing},
        )
    if status["pending_payment_id"]:
        return db.get(Payment, status["pending_payment_id"])
    payment = Payment(
        purpose="activation", event_id=event.id, user_id=user.id, amount_kzt=status["fee_kzt"]
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def complete_activation(db: Session, event: Event) -> None:
    event.activation_paid_at = datetime.now(UTC)
    event.paid_sales_enabled = event.paid_sales_suspended_at is None


def set_paid_sales_suspended(db: Session, actor: User, event: Event, suspended: bool) -> Event:
    event.paid_sales_suspended_at = datetime.now(UTC) if suspended else None
    event.paid_sales_enabled = not suspended and event.activation_paid_at is not None
    audit.record(
        db, actor, "paid_sales.suspended" if suspended else "paid_sales.resumed", "event",
        event.id, event.id,
        "Platform admin suspended paid sales" if suspended else "Platform admin resumed paid sales",
    )
    db.commit()
    db.refresh(event)
    return event


def list_activations(db: Session) -> list[Event]:
    return (
        db.query(Event)
        .filter(Event.activation_paid_at.is_not(None))
        .order_by(Event.activation_paid_at.desc())
        .all()
    )


MAX_COVER_BYTES = 5 * 1024 * 1024
COVER_FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}


def save_cover(file: UploadFile) -> str:
    data = file.file.read(MAX_COVER_BYTES + 1)
    if len(data) > MAX_COVER_BYTES:
        raise APIError("IMAGE_TOO_LARGE", "The image must be 5 MB or smaller", status_code=413)
    try:
        image = Image.open(io.BytesIO(data))
        image.verify()
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise APIError("INVALID_IMAGE", "Upload a JPEG, PNG or WebP image", status_code=400) from exc
    extension = COVER_FORMATS.get(image.format or "")
    if extension is None:
        raise APIError("INVALID_IMAGE", "Upload a JPEG, PNG or WebP image", status_code=400)
    name = f"{secrets.token_hex(16)}.{extension}"
    (settings.uploads_dir / name).write_bytes(data)
    return name
