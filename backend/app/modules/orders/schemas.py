from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.modules.events.schemas import EventOut
from app.modules.tickets.schemas import TicketOut


class AttendeeInfo(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr


class OrderItemCreate(BaseModel):
    ticket_type_id: int
    quantity: int = Field(gt=0)
    attendees: list[AttendeeInfo]


class OrderCreate(BaseModel):
    event_id: int
    items: list[OrderItemCreate] = Field(min_length=1)
    promo_code: str | None = None


class OrderItemOut(BaseModel):
    id: int
    ticket_type_id: int
    quantity: int
    unit_price_kzt: int

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: int
    event_id: int
    user_id: int
    status: str
    subtotal_kzt: int
    discount_kzt: int
    fee_kzt: int
    total_kzt: int
    promo_campaign_id: int | None
    created_at: datetime
    expires_at: datetime | None
    payment_id: int | None
    event: EventOut
    items: list[OrderItemOut]
    tickets: list[TicketOut]

    model_config = {"from_attributes": True}


class AttendeeOut(BaseModel):
    ticket_id: int
    order_id: int
    order_total_kzt: int
    attendee_name: str
    attendee_email: str
    ticket_type_name: str
    status: str
