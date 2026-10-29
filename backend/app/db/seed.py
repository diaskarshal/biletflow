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
        get_or_create_user(db, "admin@biletflow.kz", "Platform Admin").is_admin = True
        aru = get_or_create_user(db, "aru@biletflow.kz", "Aru Organizer")
        arman = get_or_create_user(db, "arman@biletflow.kz", "Arman Organizer")
        aru_org = get_or_create_organizer(db, aru, "Almaty Events Co")
        arman_org = get_or_create_organizer(db, arman, "Astana Community Club")

        draft_event = get_or_create_event(
            db,
            aru_org,
            "draft-standup-night",
            title="Standup Comedy Night (Draft)",
            venue_name="Almaty Arena",
            starts_at=now + timedelta(days=14),
            ends_at=now + timedelta(days=14, hours=2),
            status="draft",
        )
        published_event = get_or_create_event(
            db,
            aru_org,
            "student-tech-meetup",
            title="Student Tech Meetup",
            venue_name="Nazarbayev University",
            starts_at=now + timedelta(days=7),
            ends_at=now + timedelta(days=7, hours=3),
            status="published",
            review_status="approved",
            capacity=200,
        )
        cancelled_event = get_or_create_event(
            db,
            arman_org,
            "cancelled-charity-run",
            title="Charity Run (Cancelled)",
            venue_name="Astana Central Park",
            starts_at=now - timedelta(days=3),
            ends_at=now - timedelta(days=3, hours=-2),
            status="cancelled",
        )

        jazz = get_or_create_event(
            db,
            aru_org,
            "almaty-jazz-night",
            title="Almaty Jazz Night",
            description="An evening of live jazz with local bands.",
            venue_name="Kazakh National Philharmonic",
            venue_address="Tole Bi 35, Almaty",
            starts_at=now + timedelta(days=10),
            ends_at=now + timedelta(days=10, hours=3),
            status="published",
            review_status="approved",
            paid_sales_enabled=True,
            terms_accepted_at=now,
            activation_paid_at=now,
        )
        pitch_day = get_or_create_event(
            db,
            arman_org,
            "astana-startup-pitch-day",
            title="Astana Startup Pitch Day",
            description="Ten student teams pitch their startups to local investors.",
            venue_name="Astana Hub",
            venue_address="Mangilik El 55/8, Astana",
            starts_at=now + timedelta(days=12),
            ends_at=now + timedelta(days=12, hours=4),
            status="published",
            review_status="approved",
        )
        movie_night = get_or_create_event(
            db,
            arman_org,
            "open-air-movie-night",
            title="Open-Air Movie Night",
            description="Classic Kazakh films on a big screen in the park.",
            venue_name="Central Park",
            venue_address="Gogol 1, Almaty",
            starts_at=now + timedelta(days=20),
            ends_at=now + timedelta(days=20, hours=2),
            status="published",
            review_status="approved",
        )
        get_or_create_ticket_type(db, jazz, "Standard", price_kzt=4000, quantity_total=120)
        get_or_create_ticket_type(db, jazz, "VIP", price_kzt=9000, quantity_total=30)
        get_or_create_ticket_type(db, pitch_day, "Visitor", price_kzt=0, quantity_total=80)
        get_or_create_ticket_type(db, movie_night, "Free Entry", price_kzt=0, quantity_total=300)
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
