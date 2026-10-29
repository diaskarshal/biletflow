from app.db.models import Event
from app.db.session import SessionLocal


def approve(event_id: int) -> None:
    with SessionLocal() as db:
        db.get(Event, event_id).review_status = "approved"
        db.commit()
