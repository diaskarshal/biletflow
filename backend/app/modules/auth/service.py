from datetime import UTC, datetime

import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email import send_email
from app.core.errors import APIError
from app.core.security import (
    create_email_verification_token,
    create_password_reset_token,
    decode_password_reset_token,
    decode_token,
    hash_password,
    password_fingerprint,
    verify_password,
)
from app.db.models import OrganizerProfile, User


def register_user(db: Session, email: str, password: str, full_name: str) -> User:
    if db.query(User).filter_by(email=email).one_or_none() is not None:
        raise APIError("EMAIL_TAKEN", "An account with this email already exists", status_code=409)

    user = User(email=email, password_hash=hash_password(password), full_name=full_name)
    db.add(user)
    db.commit()
    db.refresh(user)
    send_verification_email(user)
    return user


def send_verification_email(user: User) -> None:
    token = create_email_verification_token(user.id)
    send_email(
        to=user.email,
        subject="Verify your BiletFlow account",
        body=f"Welcome to BiletFlow. Confirm your email address here:\n{settings.frontend_url}/verify-email?token={token}\n",
    )


def request_password_reset(db: Session, email: str) -> None:
    user = db.query(User).filter_by(email=email).one_or_none()
    if user is None or user.deleted_at is not None:
        return
    token = create_password_reset_token(user.id, user.password_hash)
    send_email(
        to=user.email,
        subject="Reset your BiletFlow password",
        body=(
            "Someone asked to reset the password for this account. If it was you, choose a new password here "
            f"within one hour:\n{settings.frontend_url}/reset-password?token={token}\n\n"
            "If it was not you, ignore this email."
        ),
    )


def reset_password(db: Session, token: str, password: str) -> None:
    invalid = APIError("INVALID_TOKEN", "This reset link is invalid or has expired", status_code=400)
    try:
        user_id, fingerprint = decode_password_reset_token(token)
    except jwt.PyJWTError as exc:
        raise invalid from exc
    user = db.get(User, user_id)
    if user is None or password_fingerprint(user.password_hash) != fingerprint:
        raise invalid
    user.password_hash = hash_password(password)
    db.commit()


def update_name(db: Session, user: User, full_name: str) -> User:
    user.full_name = full_name.strip()
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, current: str, new: str) -> None:
    if not verify_password(current, user.password_hash):
        raise APIError("WRONG_PASSWORD", "The current password is incorrect", status_code=400)
    user.password_hash = hash_password(new)
    db.commit()


def verify_email(db: Session, token: str) -> User:
    try:
        user_id = decode_token(token, expected_type="email_verify")
    except jwt.PyJWTError as exc:
        raise APIError("INVALID_TOKEN", "Verification link is invalid or expired", status_code=400) from exc

    user = db.get(User, user_id)
    if user is None:
        raise APIError("INVALID_TOKEN", "Verification link is invalid or expired", status_code=400)

    user.email_verified_at = datetime.now(UTC)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.query(User).filter_by(email=email).one_or_none()
    if user is None or user.deleted_at is not None or not verify_password(password, user.password_hash):
        raise APIError("INVALID_CREDENTIALS", "Incorrect email or password", status_code=401)
    if user.suspended_at is not None:
        raise APIError("ACCOUNT_SUSPENDED", "This account has been suspended", status_code=403)
    return user


def get_or_create_organizer_profile(db: Session, user: User) -> OrganizerProfile:
    profile = db.query(OrganizerProfile).filter_by(user_id=user.id).one_or_none()
    if profile is not None:
        return profile

    profile = OrganizerProfile(
        user_id=user.id,
        display_name=user.full_name,
        contact_email=user.email,
        verification_status="none",
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_organizer_profile(db: Session, profile: OrganizerProfile, data: dict) -> OrganizerProfile:
    for field, value in data.items():
        if value is not None:
            setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


def submit_verification(db: Session, profile: OrganizerProfile, filename: str) -> OrganizerProfile:
    if profile.verification_status == "approved":
        raise APIError("ALREADY_VERIFIED", "This organizer is already verified", status_code=409)
    profile.verification_document = filename
    profile.verification_status = "pending"
    db.commit()
    db.refresh(profile)
    return profile
