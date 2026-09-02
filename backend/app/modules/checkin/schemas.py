from datetime import datetime

from pydantic import BaseModel


class CheckinRequest(BaseModel):
    qr_token: str
    event_id: int


class CheckinResult(BaseModel):
    ticket_id: int
    attendee_name: str
    checked_in_at: datetime
