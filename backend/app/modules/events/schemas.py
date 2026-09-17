from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.modules.tickets.schemas import TicketTypeCreate, TicketTypeOut


class EventCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str | None = None
    category: str | None = None
    venue_name: str | None = None
    venue_address: str | None = None
    starts_at: datetime
    ends_at: datetime
    display_timezone: str = "Asia/Almaty"
    visibility: str = "public"
    capacity: int | None = None
    registration_opens_at: datetime | None = None
    registration_closes_at: datetime | None = None
    ticket_types: list[TicketTypeCreate] = Field(default_factory=list)


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    venue_name: str | None = None
    venue_address: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    visibility: str | None = None
    capacity: int | None = None
    registration_opens_at: datetime | None = None
    registration_closes_at: datetime | None = None


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
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}
