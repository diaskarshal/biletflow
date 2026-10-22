from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1)
    code: str | None = Field(default=None, min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_-]+$")
    discount_type: Literal["percent", "fixed"]
    discount_value: int = Field(gt=0)
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    max_redemptions: int | None = Field(default=None, gt=0)
    ticket_type_ids: list[int] | None = None

    @model_validator(mode="after")
    def percent_in_range(self):
        if self.discount_type == "percent" and self.discount_value > 100:
            raise ValueError("A percentage discount must be between 1 and 100")
        return self


class CampaignOut(BaseModel):
    id: int
    event_id: int
    name: str
    code: str
    link: str
    discount_type: str
    discount_value: int
    valid_from: datetime | None
    valid_until: datetime | None
    max_redemptions: int | None
    redemptions: int
    ticket_type_ids: list[int] | None
    disabled: bool
    orders: int
    tickets_sold: int
    gross_kzt: int
    discount_kzt: int
    net_kzt: int


class PromoPreview(BaseModel):
    code: str
    discount_type: str
    discount_value: int
    ticket_type_ids: list[int] | None
