from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import User
from app.modules.checkin import service
from app.modules.checkin.schemas import CheckinRequest, CheckinResult

router = APIRouter(tags=["checkin"])


@router.post("/checkin", response_model=CheckinResult)
def checkin(
    body: CheckinRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    return service.check_in(db, user, body.qr_token, body.event_id)
