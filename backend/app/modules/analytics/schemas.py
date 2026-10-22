from datetime import date

from pydantic import BaseModel

from app.modules.promos.schemas import CampaignOut


class DaySales(BaseModel):
    day: date
    tickets: int
    revenue_kzt: int


class TypeSales(BaseModel):
    ticket_type_id: int
    name: str
    capacity: int
    sold: int
    revenue_kzt: int


class Analytics(BaseModel):
    capacity: int
    sold: int
    remaining: int
    percent_sold: int
    gross_kzt: int
    discount_kzt: int
    refunds_kzt: int
    net_kzt: int
    sales_by_day: list[DaySales]
    by_ticket_type: list[TypeSales]
    checked_in: int
    absent: int
    checkin_percent: int
    campaigns: list[CampaignOut]
