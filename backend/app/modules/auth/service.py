from datetime import UTC, datetime

import jwt
from sqlalchemy.orm import Session

from app.core.email import send_email
from app.core.errors import APIError
from app.core.security import (
    create_email_verification_token,
    decode_token,
    hash_password,
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

    token = create_email_verification_token(user.id)
    send_email(
        to=user.email,
        subject="Verify your BiletFlow account",
        body=f"Welcome to BiletFlow. Verify your email with this token: {token}",
    )
    return user


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
