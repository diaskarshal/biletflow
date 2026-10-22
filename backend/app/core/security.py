from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def _create_token(user_id: int, token_type: str, expires_delta: timedelta, **claims: str) -> str:
    now = datetime.now(UTC)
    payload = {"sub": str(user_id), "type": token_type, "iat": now, "exp": now + expires_delta, **claims}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_access_token(user_id: int, password_hash: str) -> str:
    return _create_token(
        user_id, "access", timedelta(minutes=settings.jwt_access_minutes), pwd=password_fingerprint(password_hash)
    )


def create_refresh_token(user_id: int, password_hash: str) -> str:
    return _create_token(
        user_id, "refresh", timedelta(days=settings.jwt_refresh_days), pwd=password_fingerprint(password_hash)
    )


def create_email_verification_token(user_id: int) -> str:
    return _create_token(user_id, "email_verify", timedelta(hours=24))


def password_fingerprint(password_hash: str) -> str:
    return password_hash[-12:]


def create_password_reset_token(user_id: int, password_hash: str) -> str:
    return _create_token(user_id, "password_reset", timedelta(hours=1), pwd=password_fingerprint(password_hash))


def decode_claims(token: str, expected_type: str) -> dict:
    payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("unexpected token type")
    return payload


def decode_token(token: str, expected_type: str) -> int:
    return int(decode_claims(token, expected_type)["sub"])


def matches_password(claims: dict, password_hash: str) -> bool:
    return claims.get("pwd") == password_fingerprint(password_hash)
