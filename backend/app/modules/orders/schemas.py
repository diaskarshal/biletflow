from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

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
    created_at: datetime
    items: list[OrderItemOut]
    tickets: list[TicketOut]

    model_config = {"from_attributes": True}


class AttendeeOut(BaseModel):
    ticket_id: int
    attendee_name: str
    attendee_email: str
    ticket_type_name: str
    status: str
