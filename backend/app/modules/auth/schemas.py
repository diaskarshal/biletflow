from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class VerifyEmailRequest(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    email_verified_at: datetime | None

    model_config = {"from_attributes": True}


class OrganizerProfileOut(BaseModel):
    id: int
    user_id: int
    display_name: str
    contact_email: str
    phone: str | None
    verification_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OrganizerProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1)
    contact_email: EmailStr | None = None
    phone: str | None = None
