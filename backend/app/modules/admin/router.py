from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_db
from app.db.models import User
from app.modules.admin import service
from app.modules.admin.schemas import (
    ActivationFee,
    ActivationOut,
    OrganizerReviewOut,
    SuspendRequest,
    VerificationDecision,
)
from app.modules.events import service as events_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/organizers", response_model=list[OrganizerReviewOut])
def organizers(
    status: str | None = None, _: User = Depends(get_admin_user), db: Session = Depends(get_db)
) -> list[dict]:
    return service.list_organizers(db, status)


@router.post("/organizers/{organizer_id}/verification", status_code=204)
def decide_verification(
    organizer_id: int,
    body: VerificationDecision,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> None:
    service.decide_verification(db, admin, organizer_id, body.status)


@router.get("/settings/activation-fee", response_model=ActivationFee)
def get_activation_fee(_: User = Depends(get_admin_user), db: Session = Depends(get_db)) -> dict:
    return {"amount_kzt": service.get_activation_fee(db)}


@router.put("/settings/activation-fee", response_model=ActivationFee)
def set_activation_fee(
    body: ActivationFee, _: User = Depends(get_admin_user), db: Session = Depends(get_db)
) -> dict:
    return {"amount_kzt": service.set_activation_fee(db, body.amount_kzt)}


@router.get("/activations", response_model=list[ActivationOut])
def activations(_: User = Depends(get_admin_user), db: Session = Depends(get_db)) -> list[dict]:
    return [_activation_out(e) for e in events_service.list_activations(db)]


@router.post("/events/{event_id}/paid-sales", response_model=ActivationOut)
def suspend_paid_sales(
    event_id: int,
    body: SuspendRequest,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> dict:
    event = events_service.get_event_or_404(db, event_id)
    return _activation_out(events_service.set_paid_sales_suspended(db, admin, event, body.suspended))


def _activation_out(event) -> dict:
    return {
        "event_id": event.id,
        "title": event.title,
        "activation_paid_at": event.activation_paid_at,
        "paid_sales_enabled": event.paid_sales_enabled,
        "suspended": event.paid_sales_suspended_at is not None,
    }
