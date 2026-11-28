import os
from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.core.security import hash_password
from app.core.storage import save_cover_bytes
from app.db.models import Event, OrganizerProfile, TicketType, User
from app.db.session import SessionLocal

now = datetime.now(UTC)
COVERS = Path(__file__).parent / "seed_covers"
def dec(day: int, hour: int) -> datetime:
    return datetime(2026, 12, day, hour, tzinfo=ZoneInfo("Asia/Almaty"))


DATES = {
    "draft-standup-night": (dec(26, 19), dec(26, 21)),
    "cancelled-charity-run": (dec(13, 9), dec(13, 12)),
    "almaty-jazz-night": (dec(12, 19), dec(12, 22)),
    "astana-startup-pitch-day": (dec(5, 10), dec(5, 14)),
    "movie-night": (dec(19, 20), dec(19, 22)),
}


def get_or_create_user(db, email: str, full_name: str) -> User:
    user = db.query(User).filter_by(email=email).one_or_none()
    if user:
        return user
    password = os.environ.get("DEMO_PASSWORD", "password123")
    user = User(email=email, password_hash=hash_password(password), full_name=full_name)
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
    starts_at, ends_at = DATES[slug]
    event = Event(organizer_id=organizer.id, slug=slug, starts_at=starts_at, ends_at=ends_at, **fields)
    db.add(event)
    db.flush()
    return event


def set_cover(event: Event) -> None:
    name = f"{event.slug}.jpg"
    event.cover_image_url = save_cover_bytes(
        name, (COVERS / name).read_bytes(), "image/jpeg", overwrite=True
    )


def get_or_create_ticket_type(db, event: Event, name: str, **fields) -> TicketType:
    tt = db.query(TicketType).filter_by(event_id=event.id, name=name).one_or_none()
    if tt:
        return tt
    tt = TicketType(event_id=event.id, name=name, **fields)
    db.add(tt)
    db.flush()
    return tt


def seed() -> None:
    if settings.vercel and len(os.environ.get("DEMO_PASSWORD", "")) < 8:
        raise ValueError("Set DEMO_PASSWORD to at least 8 characters before seeding Vercel")
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
            status="draft",
        )
        db.query(Event).filter_by(slug="student-tech-meetup", deleted_at=None).update({"deleted_at": now})
        db.query(Event).filter_by(slug="open-air-movie-night").update({"slug": "movie-night"})
        cancelled_event = get_or_create_event(
            db,
            arman_org,
            "cancelled-charity-run",
            title="Charity Run (Cancelled)",
            venue_name="Astana Central Park",
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
            status="published",
            review_status="approved",
        )
        movie_night = get_or_create_event(
            db,
            arman_org,
            "movie-night",
            title="Movie Night",
            description="Classic Kazakh films on a big screen in the park.",
            venue_name="Central Park",
            venue_address="Gogol 1, Almaty",
            status="published",
            review_status="approved",
        )
        movie_night.title = "Movie Night"
        for event in (draft_event, cancelled_event, jazz, pitch_day, movie_night):
            event.starts_at, event.ends_at = DATES[event.slug]
        for event in (jazz, pitch_day, movie_night):
            set_cover(event)
        get_or_create_ticket_type(db, jazz, "Standard", price_kzt=4000, quantity_total=120)
        get_or_create_ticket_type(db, jazz, "VIP", price_kzt=9000, quantity_total=30)
        get_or_create_ticket_type(db, pitch_day, "Visitor", price_kzt=0, quantity_total=80)
        get_or_create_ticket_type(db, movie_night, "Free Entry", price_kzt=0, quantity_total=300)
        get_or_create_ticket_type(
            db, draft_event, "General Admission", price_kzt=0, quantity_total=100
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
