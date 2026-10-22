from collections.abc import Generator

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import decode_claims, matches_password
from app.db.models import User
from app.db.session import SessionLocal

bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _session_user(db: Session, token: str) -> User | None:
    try:
        claims = decode_claims(token, expected_type="access")
    except jwt.PyJWTError:
        return None
    user = db.get(User, int(claims["sub"]))
    if user is None or user.deleted_at is not None or not matches_password(claims, user.password_hash):
        return None
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise APIError("UNAUTHENTICATED", "Missing bearer token", status_code=401)
    user = _session_user(db, credentials.credentials)
    if user is None:
        raise APIError("UNAUTHENTICATED", "Invalid or expired token", status_code=401)
    if user.suspended_at is not None:
        raise APIError("ACCOUNT_SUSPENDED", "This account has been suspended", status_code=403)
    return user


def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise APIError("FORBIDDEN", "Platform admins only", status_code=403)
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    user = _session_user(db, credentials.credentials) if credentials else None
    return user if user is not None and user.suspended_at is None else None
