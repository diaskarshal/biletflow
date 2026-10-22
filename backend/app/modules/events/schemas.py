from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.modules.tickets.schemas import TicketTypeCreate, TicketTypeOut

RefundPolicy = Literal["full_until_48h", "full_anytime", "no_refunds"]


class EventCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str | None = None
    category: str | None = None
    venue_name: str | None = None
    venue_address: str | None = None
    cover_image_url: str | None = None
    starts_at: datetime
    ends_at: datetime
    display_timezone: str = "Asia/Almaty"
    visibility: str = "public"
    capacity: int | None = None
    registration_opens_at: datetime | None = None
    registration_closes_at: datetime | None = None
    refund_policy: RefundPolicy = "full_until_48h"
    ticket_types: list[TicketTypeCreate] = Field(default_factory=list)


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    venue_name: str | None = None
    venue_address: str | None = None
    cover_image_url: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    visibility: str | None = None
    capacity: int | None = None
    registration_opens_at: datetime | None = None
    registration_closes_at: datetime | None = None
    refund_policy: RefundPolicy | None = None


class EventOut(BaseModel):
    id: int
    organizer_id: int
    slug: str
    title: str
    description: str | None
    category: str | None
    venue_name: str | None
    venue_address: str | None
    cover_image_url: str | None
    starts_at: datetime
    ends_at: datetime
    display_timezone: str
    visibility: str
    status: str
    capacity: int | None
    registration_opens_at: datetime | None
    registration_closes_at: datetime | None
    paid_sales_enabled: bool
    refund_policy: str
    suspended_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class EventWithTicketTypesOut(EventOut):
    ticket_types: list[TicketTypeOut]


class EventListOut(BaseModel):
    items: list[EventOut]
    next_cursor: str | None


class StaffCreate(BaseModel):
    email: EmailStr
    role: Literal["event_admin", "organizer_staff"]


class StaffOut(BaseModel):
    id: int
    event_id: int
    user_id: int
    email: str
    full_name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivationStatus(BaseModel):
    fee_kzt: int
    has_paid_ticket_type: bool
    organizer_verified: bool
    payout_account_set: bool
    terms_accepted: bool
    fee_paid: bool
    paid_sales_enabled: bool
    suspended: bool
    pending_payment_id: int | None


class PaymentRef(BaseModel):
    payment_id: int


class ActivityOut(BaseModel):
    id: int
    created_at: datetime
    actor_name: str
    action_type: str
    entity_type: str
    entity_id: int
    description: str | None
