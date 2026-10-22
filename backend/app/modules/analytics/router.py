from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import User
from app.modules.analytics import service
from app.modules.analytics.schemas import Analytics
from app.modules.events import service as events_service

router = APIRouter(tags=["analytics"])


@router.get("/events/{event_id}/analytics", response_model=Analytics)
def event_analytics(
    event_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    ticket_type_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    event = events_service.get_event_or_404(db, event_id)
    events_service.require_owner(db, user, event)
    return service.event_analytics(db, event, date_from, date_to, ticket_type_id)
