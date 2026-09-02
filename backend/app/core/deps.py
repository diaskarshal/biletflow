from collections.abc import Generator

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import decode_token
from app.db.models import User
from app.db.session import SessionLocal

bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise APIError("UNAUTHENTICATED", "Missing bearer token", status_code=401)
    try:
        user_id = decode_token(credentials.credentials, expected_type="access")
    except jwt.PyJWTError as exc:
        raise APIError("UNAUTHENTICATED", "Invalid or expired token", status_code=401) from exc

    user = db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise APIError("UNAUTHENTICATED", "User not found", status_code=401)
    return user
