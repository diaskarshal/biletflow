from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class PaymentOut(BaseModel):
    id: int
    purpose: str
    status: str
    amount_kzt: int
    event_id: int
    event_title: str
    order_id: int | None
    created_at: datetime


class SimulateRequest(BaseModel):
    outcome: Literal["success", "failure", "timeout"]
