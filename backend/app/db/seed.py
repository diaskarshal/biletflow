"""Idempotent demo data: 2 organizers, 3 events (draft/published/cancelled), 5 ticket types.

Run with: uv run python -m app.db.seed
"""

from datetime import UTC, datetime, timedelta

from app.core.security import hash_password
from app.db.models import Event, OrganizerProfile, TicketType, User
from app.db.session import SessionLocal

now = datetime.now(UTC)


def get_or_create_user(db, email: str, full_name: str) -> User:
    user = db.query(User).filter_by(email=email).one_or_none()
    if user:
        return user
    user = User(email=email, password_hash=hash_password("password123"), full_name=full_name)
    db.add(user)
    db.flush()
    return user


def get_or_create_organizer(db, user: User, display_name: str) -> OrganizerProfile:
    organizer = db.query(OrganizerProfile).filter_by(user_id=user.id).one_or_none()
    if organizer:
        return organizer
    organizer = OrganizerProfile(
        user_id=user.id,
        display_name=display_name,
        contact_email=user.email,
        verification_status="approved",
    )
    db.add(organizer)
    db.flush()
    return organizer


def get_or_create_event(db, organizer: OrganizerProfile, slug: str, **fields) -> Event:
    event = db.query(Event).filter_by(slug=slug).one_or_none()
    if event:
        return event
    event = Event(organizer_id=organizer.id, slug=slug, **fields)
    db.add(event)
    db.flush()
    return event


def get_or_create_ticket_type(db, event: Event, name: str, **fields) -> TicketType:
    tt = db.query(TicketType).filter_by(event_id=event.id, name=name).one_or_none()
    if tt:
        return tt
    tt = TicketType(event_id=event.id, name=name, **fields)
    db.add(tt)
    db.flush()
    return tt


def seed() -> None:
    with SessionLocal() as db:
        alice = get_or_create_user(db, "alice@biletflow.kz", "Alice Organizer")
        bob = get_or_create_user(db, "bob@biletflow.kz", "Bob Organizer")
        alice_org = get_or_create_organizer(db, alice, "Almaty Events Co")
        bob_org = get_or_create_organizer(db, bob, "Astana Community Club")

        draft_event = get_or_create_event(
            db,
            alice_org,
            "draft-standup-night",
            title="Standup Comedy Night (Draft)",
            venue_name="Almaty Arena",
            starts_at=now + timedelta(days=14),
            ends_at=now + timedelta(days=14, hours=2),
            status="draft",
        )
        published_event = get_or_create_event(
            db,
            alice_org,
            "student-tech-meetup",
            title="Student Tech Meetup",
            venue_name="Nazarbayev University",
            starts_at=now + timedelta(days=7),
            ends_at=now + timedelta(days=7, hours=3),
            status="published",
            capacity=200,
        )
        cancelled_event = get_or_create_event(
            db,
            bob_org,
            "cancelled-charity-run",
            title="Charity Run (Cancelled)",
            venue_name="Astana Central Park",
            starts_at=now - timedelta(days=3),
            ends_at=now - timedelta(days=3, hours=-2),
            status="cancelled",
        )

        get_or_create_ticket_type(
            db, draft_event, "General Admission", price_kzt=0, quantity_total=100
        )
        get_or_create_ticket_type(
            db, published_event, "Free Entry", price_kzt=0, quantity_total=150
        )
        get_or_create_ticket_type(
            db, published_event, "VIP", price_kzt=5000, quantity_total=50
        )
        get_or_create_ticket_type(
            db, cancelled_event, "General Admission", price_kzt=0, quantity_total=300
        )
        get_or_create_ticket_type(
            db, cancelled_event, "Runner + T-Shirt", price_kzt=3000, quantity_total=100
        )

        db.commit()


if __name__ == "__main__":
    seed()
    print("Seed complete.")
