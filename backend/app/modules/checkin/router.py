from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import Event, User
from app.modules.checkin import service
from app.modules.checkin.schemas import (
    CheckinRequest,
    CheckinResult,
    CheckinSummary,
    TicketCheckinRequest,
)
from app.modules.events import service as events_service
from app.modules.events.schemas import EventOut
from app.modules.orders.schemas import AttendeeOut

router = APIRouter(tags=["checkin"])


@router.get("/checkin/events", response_model=list[EventOut])
def checkin_events(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Event]:
    return events_service.list_checkin_events(db, user)


@router.post("/checkin", response_model=CheckinResult)
def checkin(
    body: CheckinRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    return service.check_in(db, user, body.qr_token, body.event_id)


@router.post("/checkin/tickets/{ticket_id}", response_model=CheckinResult)
def checkin_ticket(
    ticket_id: int,
    body: TicketCheckinRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return service.check_in_ticket(db, user, ticket_id, body.event_id)


@router.post("/checkin/tickets/{ticket_id}/undo", status_code=204)
def undo_checkin(
    ticket_id: int,
    body: TicketCheckinRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    service.undo_check_in(db, user, ticket_id, body.event_id)


@router.get("/checkin/events/{event_id}/summary", response_model=CheckinSummary)
def checkin_summary(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    return service.summary(db, user, event_id)


@router.get("/checkin/events/{event_id}/attendees", response_model=list[AttendeeOut])
def checkin_search(
    event_id: int, q: str = "", user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    return service.search(db, user, event_id, q)
