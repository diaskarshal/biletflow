from datetime import datetime

from pydantic import BaseModel, Field


class TicketTypeCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    price_kzt: int = Field(ge=0, default=0)
    quantity_total: int = Field(gt=0)
    sales_start_at: datetime | None = None
    sales_end_at: datetime | None = None
    max_per_order: int | None = None
    is_hidden: bool = False


class TicketTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price_kzt: int | None = Field(default=None, ge=0)
    quantity_total: int | None = Field(default=None, gt=0)
    sales_start_at: datetime | None = None
    sales_end_at: datetime | None = None
    max_per_order: int | None = None
    is_hidden: bool | None = None


class TicketTypeOut(BaseModel):
    id: int
    event_id: int
    name: str
    description: str | None
    price_kzt: int
    quantity_total: int
    quantity_sold: int
    quantity_reserved: int
    sales_start_at: datetime | None
    sales_end_at: datetime | None
    max_per_order: int | None
    is_hidden: bool

    model_config = {"from_attributes": True}


class TicketOut(BaseModel):
    id: int
    order_item_id: int
    ticket_type_id: int
    attendee_name: str
    attendee_email: str
    qr_token: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
