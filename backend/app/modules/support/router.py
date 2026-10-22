from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import User
from app.modules.support import service
from app.modules.support.schemas import (
    CaseCreate,
    CaseDetail,
    CaseOut,
    CaseUpdate,
    MessageCreate,
    Status,
)

router = APIRouter(prefix="/support", tags=["support"])


@router.post("/cases", response_model=CaseDetail, status_code=201)
def create_case(body: CaseCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    case = service.create_case(db, user, body.model_dump())
    return service.case_detail(db, user, case)


@router.get("/cases", response_model=list[CaseOut])
def my_cases(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    return [service.case_out(db, user, c) for c in service.list_my_cases(db, user)]


@router.get("/inbox", response_model=list[CaseOut])
def inbox(
    status: Status | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    return [service.case_out(db, user, c) for c in service.list_inbox(db, user, status)]


@router.get("/cases/{case_id}", response_model=CaseDetail)
def get_case(case_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return service.case_detail(db, user, service.get_case(db, user, case_id))


@router.post("/cases/{case_id}/messages", response_model=CaseDetail, status_code=201)
def add_message(
    case_id: int, body: MessageCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    case = service.get_case(db, user, case_id)
    service.add_message(db, user, case, body.body)
    return service.case_detail(db, user, case)


@router.patch("/cases/{case_id}", response_model=CaseDetail)
def update_case(
    case_id: int, body: CaseUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    case = service.get_case(db, user, case_id)
    service.update_case(db, user, case, body.status, body.assignee_id)
    return service.case_detail(db, user, case)
