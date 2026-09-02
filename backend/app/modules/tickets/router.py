from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import Ticket, TicketType, User
from app.modules.events import service as events_service
from app.modules.tickets import service
from app.modules.tickets.schemas import TicketOut, TicketTypeCreate, TicketTypeOut, TicketTypeUpdate

router = APIRouter(tags=["tickets"])


@router.post("/events/{event_id}/ticket-types", response_model=TicketTypeOut, status_code=201)
def create_ticket_type(
    event_id: int,
    body: TicketTypeCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketType:
    event = events_service.get_event_or_404(db, event_id)
    events_service.require_owner(db, user, event)
    return service.create_ticket_type(db, event, body.model_dump())


@router.get("/events/{event_id}/ticket-types", response_model=list[TicketTypeOut])
def list_ticket_types(event_id: int, db: Session = Depends(get_db)) -> list[TicketType]:
    event = events_service.get_event_or_404(db, event_id)
    return service.list_ticket_types(db, event)


@router.patch("/ticket-types/{ticket_type_id}", response_model=TicketTypeOut)
def update_ticket_type(
    ticket_type_id: int,
    body: TicketTypeUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketType:
    ticket_type = service.get_ticket_type_or_404(db, ticket_type_id)
    event = events_service.get_event_or_404(db, ticket_type.event_id)
    events_service.require_owner(db, user, event)
    return service.update_ticket_type(db, ticket_type, body.model_dump(exclude_unset=True))


@router.get("/tickets/{ticket_id}", response_model=TicketOut)
def get_ticket(
    ticket_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Ticket:
    ticket = service.get_ticket_or_404(db, ticket_id)
    service.require_ticket_access(db, ticket, user)
    return ticket


@router.get("/tickets/{ticket_id}/qr")
def get_ticket_qr(
    ticket_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    ticket = service.get_ticket_or_404(db, ticket_id)
    service.require_ticket_access(db, ticket, user)
    return Response(content=service.qr_png(ticket), media_type="image/png")
