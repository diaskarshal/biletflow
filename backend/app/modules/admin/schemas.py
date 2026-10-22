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
