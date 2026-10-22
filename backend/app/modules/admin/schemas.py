from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class OrganizerReviewOut(BaseModel):
    id: int
    display_name: str
    email: str
    verification_status: str
    verification_document: str | None
    payout_account: str | None


class VerificationDecision(BaseModel):
    status: Literal["approved", "rejected"]


class ActivationFee(BaseModel):
    amount_kzt: int = Field(ge=0)


class ActivationOut(BaseModel):
    event_id: int
    title: str
    activation_paid_at: datetime | None
    paid_sales_enabled: bool
    suspended: bool


class SuspendRequest(BaseModel):
    suspended: bool


class UserRow(BaseModel):
    id: int
    email: str
    full_name: str
    is_admin: bool
    suspended: bool


class EventRow(BaseModel):
    id: int
    title: str
    slug: str
    status: str
    suspended: bool


class OrderRow(BaseModel):
    id: int
    event_title: str
    buyer_email: str
    status: str
    total_kzt: int
    created_at: datetime


class PaymentRow(BaseModel):
    id: int
    purpose: str
    event_title: str
    user_email: str
    amount_kzt: int
    status: str
    created_at: datetime


class SearchResult(BaseModel):
    users: list[UserRow]
    events: list[EventRow]
    orders: list[OrderRow]
    payments: list[PaymentRow]


class ReportCreate(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)


class ReportOut(BaseModel):
    id: int
    event_id: int
    event_title: str
    event_suspended: bool
    reporter_email: str
    reason: str
    created_at: datetime


class PromoRow(BaseModel):
    id: int
    event_title: str
    code: str
    name: str
    discount_type: str
    discount_value: int
    redemptions: int
    max_redemptions: int | None
    disabled: bool
    created_at: datetime
