import jwt
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.errors import APIError
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.db.models import User
from app.modules.auth import service
from app.modules.auth.schemas import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
    VerifyEmailRequest,
)

router = APIRouter(tags=["auth"])


def _tokens_for(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/auth/register", response_model=UserOut, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> User:
    return service.register_user(db, body.email, body.password, body.full_name)


@router.post("/auth/verify-email", response_model=UserOut)
def verify_email(body: VerifyEmailRequest, db: Session = Depends(get_db)) -> User:
    return service.verify_email(db, body.token)


@router.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = service.authenticate(db, body.email, body.password)
    return _tokens_for(user)


@router.post("/auth/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user_id = decode_token(body.refresh_token, expected_type="refresh")
    except jwt.PyJWTError as exc:
        raise APIError("UNAUTHENTICATED", "Invalid or expired refresh token", status_code=401) from exc

    user = db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise APIError("UNAUTHENTICATED", "Invalid or expired refresh token", status_code=401)
    return _tokens_for(user)


@router.post("/auth/logout", status_code=204)
def logout(user: User = Depends(get_current_user)) -> None:
    return None


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
