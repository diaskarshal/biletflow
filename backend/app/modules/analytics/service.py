from collections import defaultdict
from datetime import date
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.db.models import Event, Order, OrderItem, Ticket, TicketType
from app.modules.promos import service as promos_service


def _percent(part: int, whole: int) -> int:
    return round(100 * part / whole) if whole else 0


def event_analytics(
    db: Session, event: Event, date_from: date | None, date_to: date | None, ticket_type_id: int | None
) -> dict:
    tz = ZoneInfo(event.display_timezone)
    types = db.query(TicketType).filter_by(event_id=event.id).order_by(TicketType.id).all()
    if ticket_type_id is not None:
        types = [t for t in types if t.id == ticket_type_id]
    type_ids = {t.id for t in types}

    rows = (
        db.query(OrderItem, Order)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.event_id == event.id, Order.status.in_(("paid", "refunded")), OrderItem.ticket_type_id.in_(type_ids))
        .all()
    )
    gross = discount = refunds = 0
    by_day: dict[date, list[int]] = defaultdict(lambda: [0, 0])
    by_type: dict[int, list[int]] = defaultdict(lambda: [0, 0])
    for item, order in rows:
        day = order.created_at.astimezone(tz).date()
        if (date_from and day < date_from) or (date_to and day > date_to):
            continue
        item_gross = item.unit_price_kzt * item.quantity
        item_discount = order.discount_kzt * item_gross // order.subtotal_kzt if order.subtotal_kzt else 0
        gross += item_gross
        discount += item_discount
        if order.status == "refunded":
            refunds += item_gross - item_discount
            continue
        for bucket in (by_day[day], by_type[item.ticket_type_id]):
            bucket[0] += item.quantity
            bucket[1] += item_gross - item_discount

    capacity = sum(t.quantity_total for t in types)
    sold_now = sum(t.quantity_sold for t in types)
    statuses = [
        status
        for (status,) in db.query(Ticket.status).filter(
            Ticket.ticket_type_id.in_(type_ids), Ticket.status.in_(("valid", "checked_in"))
        )
    ]
    checked_in = statuses.count("checked_in")

    return {
        "capacity": capacity,
        "sold": sum(tickets for tickets, _ in by_type.values()),
        "remaining": capacity - sold_now,
        "percent_sold": _percent(sold_now, capacity),
        "gross_kzt": gross,
        "discount_kzt": discount,
        "refunds_kzt": refunds,
        "net_kzt": gross - discount - refunds,
        "sales_by_day": [
            {"day": day, "tickets": tickets, "revenue_kzt": revenue}
            for day, (tickets, revenue) in sorted(by_day.items())
        ],
        "by_ticket_type": [
            {
                "ticket_type_id": t.id,
                "name": t.name,
                "capacity": t.quantity_total,
                "sold": by_type[t.id][0],
                "revenue_kzt": by_type[t.id][1],
            }
            for t in types
        ],
        "checked_in": checked_in,
        "absent": len(statuses) - checked_in,
        "checkin_percent": _percent(checked_in, len(statuses)),
        "campaigns": promos_service.list_campaigns(db, event),
    }
