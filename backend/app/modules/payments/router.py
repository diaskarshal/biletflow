from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import User
from app.modules.payments import service
from app.modules.payments.schemas import PaymentOut, SimulateRequest

router = APIRouter(tags=["payments"])


@router.get("/payments/{payment_id}", response_model=PaymentOut)
def get_payment(
    payment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    return service.to_out(db, service.get_payment(db, payment_id, user))


@router.post("/payments/{payment_id}/simulate", response_model=PaymentOut)
def simulate(
    payment_id: int,
    body: SimulateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    payment = service.get_payment(db, payment_id, user)
    return service.to_out(db, service.apply_provider_result(db, payment, body.outcome, user))
