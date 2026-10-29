from typing import Literal

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_db
from app.db.models import Payment, User
from app.modules.admin import service
from app.modules.admin.schemas import (
    ActivationFee,
    ActivationOut,
    OrganizerReviewOut,
    PaymentRow,
    PendingEventRow,
    PromoRow,
    ReportOut,
    ReviewDecision,
    SearchResult,
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


@router.get("/events/pending", response_model=list[PendingEventRow])
def pending_events(_: User = Depends(get_admin_user), db: Session = Depends(get_db)) -> list[dict]:
    return service.list_pending_events(db)


@router.post("/events/{event_id}/review", status_code=204)
def review_event(
    event_id: int, body: ReviewDecision, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)
) -> None:
    service.review_event(db, admin, events_service.get_event_or_404(db, event_id), body.status, body.note)


@router.get("/search", response_model=SearchResult)
def search(q: str, _: User = Depends(get_admin_user), db: Session = Depends(get_db)) -> dict:
    return service.search(db, q)


@router.post("/users/{user_id}/suspension", status_code=204)
def suspend_user(
    user_id: int, body: SuspendRequest, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)
) -> None:
    service.set_user_suspended(db, admin, user_id, body.suspended)


@router.post("/events/{event_id}/suspension", status_code=204)
def suspend_event(
    event_id: int, body: SuspendRequest, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)
) -> None:
    service.set_event_suspended(db, admin, events_service.get_event_or_404(db, event_id), body.suspended)


@router.get("/reports", response_model=list[ReportOut])
def reports(_: User = Depends(get_admin_user), db: Session = Depends(get_db)) -> list[dict]:
    return service.list_reports(db)


@router.post("/reports/{report_id}/dismiss", status_code=204)
def dismiss_report(report_id: int, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)) -> None:
    service.dismiss_report(db, admin, report_id)


@router.get("/payments", response_model=list[PaymentRow])
def payments(
    status: Literal["pending", "succeeded", "failed", "expired", "refunded"] = "failed",
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return service.payment_rows(db, Payment.status == status)


@router.get("/promos", response_model=list[PromoRow])
def promos(_: User = Depends(get_admin_user), db: Session = Depends(get_db)) -> list[dict]:
    return service.list_promos(db)


@router.get("/export/{kind}.csv")
def export(
    kind: Literal["orders", "payments"], _: User = Depends(get_admin_user), db: Session = Depends(get_db)
) -> Response:
    return Response(
        content=service.export_csv(db, kind),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{kind}.csv"'},
    )


def _activation_out(event) -> dict:
    return {
        "event_id": event.id,
        "title": event.title,
        "activation_paid_at": event.activation_paid_at,
        "paid_sales_enabled": event.paid_sales_enabled,
        "suspended": event.paid_sales_suspended_at is not None,
    }
