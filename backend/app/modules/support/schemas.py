from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Category = Literal[
    "ticket_delivery",
    "payment",
    "refund",
    "seating",
    "event_information",
    "check_in",
    "account",
    "activation",
    "technical",
]
Status = Literal["open", "in_progress", "waiting_for_customer", "resolved"]


class CaseCreate(BaseModel):
    kind: Literal["attendee", "organizer"]
    category: Category
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=5000)
    event_id: int | None = None
    order_id: int | None = None
    ticket_id: int | None = None


class CaseUpdate(BaseModel):
    status: Status | None = None
    assignee_id: int | None = None


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class MessageOut(BaseModel):
    id: int
    author_name: str
    from_requester: bool
    body: str
    created_at: datetime


class CaseOut(BaseModel):
    id: int
    kind: str
    category: str
    subject: str
    status: str
    requester_name: str
    requester_email: str
    event_id: int | None
    event_title: str | None
    order_id: int | None
    ticket_id: int | None
    assignee_id: int | None
    assignee_name: str | None
    can_manage: bool
    created_at: datetime
    updated_at: datetime


class CaseDetail(CaseOut):
    messages: list[MessageOut]
