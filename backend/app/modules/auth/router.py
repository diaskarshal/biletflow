import jwt
from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.errors import APIError
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.db.models import User
from app.modules.auth import service
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    OrganizerProfileOut,
    OrganizerProfileUpdate,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserOut,
    UserUpdate,
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


@router.post("/auth/resend-verification", status_code=204)
def resend_verification(user: User = Depends(get_current_user)) -> None:
    if user.email_verified_at is None:
        service.send_verification_email(user)


@router.post("/auth/forgot-password", status_code=204)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)) -> None:
    service.request_password_reset(db, body.email)


@router.post("/auth/reset-password", status_code=204)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)) -> None:
    service.reset_password(db, body.token, body.password)


@router.post("/me/password", status_code=204)
def change_password(
    body: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    service.change_password(db, user, body.current_password, body.new_password)


@router.patch("/me", response_model=UserOut)
def update_me(body: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    return service.update_name(db, user, body.full_name)


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
    if user.suspended_at is not None:
        raise APIError("ACCOUNT_SUSPENDED", "This account has been suspended", status_code=403)
    return _tokens_for(user)


@router.post("/auth/logout", status_code=204)
def logout(user: User = Depends(get_current_user)) -> None:
    return None


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.get("/organizer/profile", response_model=OrganizerProfileOut)
def get_organizer_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_or_create_organizer_profile(db, user)


@router.patch("/organizer/profile", response_model=OrganizerProfileOut)
def update_organizer_profile(
    body: OrganizerProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = service.get_or_create_organizer_profile(db, user)
    return service.update_organizer_profile(db, profile, body.model_dump(exclude_unset=True))


@router.post("/organizer/verification", response_model=OrganizerProfileOut)
def submit_verification(
    document: UploadFile,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = service.get_or_create_organizer_profile(db, user)
    return service.submit_verification(db, profile, document.filename or "document")
