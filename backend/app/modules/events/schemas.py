from datetime import datetime

from pydantic import BaseModel, Field


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


class EventListOut(BaseModel):
    items: list[EventOut]
    next_cursor: str | None
