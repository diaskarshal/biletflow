from datetime import date

from fastapi import APIRouter, Depends, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, get_optional_user
from app.db.models import Event, User
from app.modules.admin import service as admin_service
from app.modules.admin.schemas import ReportCreate
from app.modules.events import service
from app.modules.events.schemas import (
    ActivationStatus,
    ActivityOut,
    EventCreate,
    EventListOut,
    EventOut,
    EventUpdate,
    EventWithTicketTypesOut,
    PaymentRef,
    StaffCreate,
    StaffOut,
    UploadOut,
)
from app.modules.orders import service as orders_service
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
    return service.update_event(db, user, event, body.model_dump(exclude_unset=True))


@router.post("/events/{event_id}/publish", response_model=EventOut)
def publish_event(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Event:
    event = service.get_event_or_404(db, event_id)
    service.require_owner(db, user, event)
    return service.publish_event(db, user, event)


@router.post("/uploads/cover", response_model=UploadOut, status_code=201)
def upload_cover(request: Request, image: UploadFile, _: User = Depends(get_current_user)) -> dict:
    return {"url": str(request.url_for("uploads", path=service.save_cover(image)))}


@router.post("/events/{event_id}/unpublish", response_model=EventOut)
def unpublish_event(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Event:
    event = service.get_event_or_404(db, event_id)
    service.require_owner(db, user, event)
    return service.unpublish_event(db, user, event)


@router.post("/events/{event_id}/duplicate", response_model=EventWithTicketTypesOut, status_code=201)
def duplicate_event(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> EventWithTicketTypesOut:
    source = service.get_event_or_404(db, event_id)
    service.require_owner(db, user, source)
    event, ticket_types = service.duplicate_event(db, user, source)
    return EventWithTicketTypesOut(
        **EventOut.model_validate(event, from_attributes=True).model_dump(),
        ticket_types=[TicketTypeOut.model_validate(tt, from_attributes=True) for tt in ticket_types],
    )


@router.get("/events/{event_id}/activity", response_model=list[ActivityOut])
def event_activity(
    event_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    action: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    event = service.get_event_or_404(db, event_id)
    service.require_event_manager(db, user, event)
    return service.list_activity(db, event, date_from, date_to, action)


@router.post("/events/{event_id}/report", status_code=204)
def report_event(
    event_id: int, body: ReportCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    admin_service.report_event(db, user, service.get_event_or_404(db, event_id), body.reason)


@router.post("/events/{event_id}/cancel", response_model=EventOut)
def cancel_event(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Event:
    event = service.get_event_or_404(db, event_id)
    service.require_owner(db, user, event)
    return orders_service.cancel_event(db, user, event)


@router.post("/events/{event_id}/staff", response_model=StaffOut, status_code=201)
def add_staff(
    event_id: int,
    body: StaffCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    event = service.get_event_or_404(db, event_id)
    service.require_owner(db, user, event)
    return service.add_staff(db, event, body.email, body.role)


@router.get("/events/{event_id}/staff", response_model=list[StaffOut])
def list_staff(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    event = service.get_event_or_404(db, event_id)
    service.require_owner(db, user, event)
    return service.list_staff(db, event)


@router.get("/events/{event_id}/activation", response_model=ActivationStatus)
def activation(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    event = service.get_event_or_404(db, event_id)
    service.require_owner(db, user, event)
    return service.activation_status(db, event)


@router.post("/events/{event_id}/activation/terms", response_model=ActivationStatus)
def accept_terms(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    event = service.get_event_or_404(db, event_id)
    service.require_owner(db, user, event)
    service.accept_terms(db, event)
    return service.activation_status(db, event)


@router.post("/events/{event_id}/activation/payment", response_model=PaymentRef)
def pay_activation_fee(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    event = service.get_event_or_404(db, event_id)
    service.require_owner(db, user, event)
    return {"payment_id": service.start_activation_payment(db, user, event).id}
