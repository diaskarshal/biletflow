from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, StringConstraints


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class UserUpdate(BaseModel):
    full_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    is_admin: bool
    email_verified_at: datetime | None

    model_config = {"from_attributes": True}


class OrganizerProfileOut(BaseModel):
    id: int
    user_id: int
    display_name: str
    contact_email: str
    phone: str | None
    verification_status: str
    verification_document: str | None
    payout_account: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class OrganizerProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1)
    contact_email: EmailStr | None = None
    phone: str | None = None
    payout_account: str | None = Field(default=None, min_length=1)
