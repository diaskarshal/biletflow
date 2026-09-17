from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, get_optional_user
from app.db.models import Event, EventStaff, User
from app.modules.events import service
from app.modules.events.schemas import (
    EventCreate,
    EventListOut,
    EventOut,
    EventUpdate,
    EventWithTicketTypesOut,
    StaffCreate,
    StaffOut,
)
from app.modules.tickets.schemas import TicketTypeOut

router = APIRouter(tags=["events"])


@router.post("/events", response_model=EventWithTicketTypesOut, status_code=201)
def create_event(
    body: EventCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> EventWithTicketTypesOut:
    event, ticket_types = service.create_event(db, user, body.model_dump())
    return EventWithTicketTypesOut(
        **EventOut.model_validate(event, from_attributes=True).model_dump(),
        ticket_types=[TicketTypeOut.model_validate(tt, from_attributes=True) for tt in ticket_types],
    )


@router.get("/events", response_model=EventListOut)
def list_events(
    limit: int = Query(20, ge=1, le=100), cursor: int | None = None, db: Session = Depends(get_db)
) -> EventListOut:
    events, next_cursor = service.list_published_events(db, limit, cursor)
    return EventListOut(items=events, next_cursor=str(next_cursor) if next_cursor else None)


@router.get("/organizer/events", response_model=list[EventOut])
def organizer_events(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Event]:
    return service.list_organizer_events(db, user)


@router.get("/events/{slug}", response_model=EventOut)
def get_event(
    slug: str, user: User | None = Depends(get_optional_user), db: Session = Depends(get_db)
) -> Event:
    return service.get_event_by_slug_for_viewer(db, slug, user)


@router.patch("/events/{event_id}", response_model=EventOut)
def update_event(
    event_id: int,
    body: EventUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Event:
    event = service.get_event_or_404(db, event_id)
    service.require_owner(db, user, event)
    return service.update_event(db, event, body.model_dump(exclude_unset=True))


@router.post("/events/{event_id}/publish", response_model=EventOut)
def publish_event(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Event:
    event = service.get_event_or_404(db, event_id)
    service.require_owner(db, user, event)
    return service.publish_event(db, event)


@router.post("/events/{event_id}/cancel", response_model=EventOut)
def cancel_event(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Event:
    event = service.get_event_or_404(db, event_id)
    service.require_owner(db, user, event)
    return service.cancel_event(db, event)


@router.post("/events/{event_id}/staff", response_model=StaffOut, status_code=201)
def add_staff(
    event_id: int,
    body: StaffCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventStaff:
    event = service.get_event_or_404(db, event_id)
    service.require_owner(db, user, event)
    return service.add_staff(db, event, body.email, body.role)


@router.get("/events/{event_id}/staff", response_model=list[StaffOut])
def list_staff(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[EventStaff]:
    event = service.get_event_or_404(db, event_id)
    service.require_owner(db, user, event)
    return service.list_staff(db, event)
