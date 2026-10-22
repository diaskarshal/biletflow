from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import Event, User
from app.modules.events import service as events_service
from app.modules.events.schemas import EventOut
from app.modules.orders import service
from app.modules.orders.schemas import AttendeeOut, OrderCreate, OrderOut

router = APIRouter(tags=["orders"])


def _to_order_out(db: Session, order) -> OrderOut:
    items = service.list_order_items(db, order.id)
    tickets = service.list_order_tickets(db, order.id)
    return OrderOut(
        id=order.id,
        event_id=order.event_id,
        user_id=order.user_id,
        status=order.status,
        subtotal_kzt=order.subtotal_kzt,
        discount_kzt=order.discount_kzt,
        fee_kzt=order.fee_kzt,
        total_kzt=order.total_kzt,
        promo_campaign_id=order.promo_campaign_id,
        created_at=order.created_at,
        expires_at=order.expires_at,
        payment_id=service.pending_payment_id(db, order),
        event=EventOut.model_validate(db.get(Event, order.event_id)),
        items=items,
        tickets=tickets,
    )


@router.post("/orders", response_model=OrderOut, status_code=201)
def create_order(
    body: OrderCreate,
    idempotency_key: str = Header(alias="Idempotency-Key"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderOut:
    order = service.create_order(
        db,
        user,
        body.event_id,
        [item.model_dump() for item in body.items],
        idempotency_key,
        body.promo_code,
    )
    return _to_order_out(db, order)


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> OrderOut:
    order = service.get_order_or_404(db, order_id)
    service.require_order_access(db, order, user)
    return _to_order_out(db, order)


@router.get("/me/orders", response_model=list[OrderOut])
def my_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[OrderOut]:
    return [_to_order_out(db, order) for order in service.list_my_orders(db, user)]


@router.get("/events/{event_id}/attendees", response_model=list[AttendeeOut])
def attendees(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    event = events_service.get_event_or_404(db, event_id)
    events_service.require_owner(db, user, event)
    return service.list_attendees(db, event_id)


@router.post("/orders/{order_id}/cancel", response_model=OrderOut)
def cancel_order(
    order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> OrderOut:
    order = service.get_order_or_404(db, order_id)
    events_service.require_owner(db, user, events_service.get_event_or_404(db, order.event_id))
    return _to_order_out(db, service.cancel_order(db, user, order))
