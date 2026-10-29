import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.db.models import Event, Order
from app.db.session import SessionLocal
from app.main import app
from tests.helpers import approve

client = TestClient(app)


def _login(role: str) -> dict:
    email = f"{role}-{uuid.uuid4().hex[:8]}@test.kz"
    client.post("/api/v1/auth/register", json={"email": email, "password": "password123", "full_name": role})
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"}).json()
    return {"Authorization": f"Bearer {token['access_token']}"}


def _paid_order(buyer: dict, event_id: int, type_id: int, quantity: int, code: str | None = None) -> dict:
    order = client.post(
        "/api/v1/orders",
        headers={**buyer, "Idempotency-Key": uuid.uuid4().hex},
        json={
            "event_id": event_id,
            "promo_code": code,
            "items": [{"ticket_type_id": type_id, "quantity": quantity, "attendees": [{"name": "A", "email": "a@test.kz"}] * quantity}],
        },
    ).json()
    client.post(f"/api/v1/payments/{order['payment_id']}/simulate", headers=buyer, json={"outcome": "success"})
    return order


def test_event_analytics():
    org, buyer, stranger = _login("organizer"), _login("buyer"), _login("stranger")
    event = client.post(
        "/api/v1/events",
        headers=org,
        json={
            "title": f"Stats {uuid.uuid4().hex[:6]}",
            "starts_at": "2026-12-01T13:00:00Z",
            "ends_at": "2026-12-01T15:00:00Z",
            "refund_policy": "full_anytime",
            "ticket_types": [
                {"name": "VIP", "price_kzt": 10000, "quantity_total": 10},
                {"name": "Standard", "price_kzt": 2000, "quantity_total": 40},
            ],
        },
    ).json()
    event_id = event["id"]
    vip, standard = (t["id"] for t in event["ticket_types"])
    client.post(f"/api/v1/events/{event_id}/publish", headers=org)
    approve(event_id)
    with SessionLocal() as db:
        db.get(Event, event_id).paid_sales_enabled = True
        db.commit()
    client.post(f"/api/v1/events/{event_id}/campaigns", headers=org, json={"name": "IG", "code": "TEN", "discount_type": "percent", "discount_value": 10})

    old = _paid_order(buyer, event_id, standard, 3)
    with SessionLocal() as db:
        db.get(Order, old["id"]).created_at = datetime.now(UTC) - timedelta(days=5)
        db.commit()
    _paid_order(buyer, event_id, vip, 2, "TEN")
    refunded = _paid_order(buyer, event_id, standard, 1)
    client.post(f"/api/v1/orders/{refunded['id']}/cancel", headers=org)
    staff_ticket = client.get(f"/api/v1/events/{event_id}/attendees", headers=org).json()[0]["ticket_id"]
    client.post(f"/api/v1/checkin/tickets/{staff_ticket}", headers=org, json={"event_id": event_id})

    url = f"/api/v1/events/{event_id}/analytics"
    assert client.get(url, headers=stranger).status_code == 403
    a = client.get(url, headers=org).json()
    assert (a["capacity"], a["sold"], a["remaining"], a["percent_sold"]) == (50, 5, 45, 10)
    assert (a["gross_kzt"], a["discount_kzt"], a["refunds_kzt"], a["net_kzt"]) == (28000, 2000, 2000, 24000)
    assert [(d["tickets"], d["revenue_kzt"]) for d in a["sales_by_day"]] == [(3, 6000), (2, 18000)]
    assert [(t["name"], t["sold"], t["revenue_kzt"]) for t in a["by_ticket_type"]] == [("VIP", 2, 18000), ("Standard", 3, 6000)]
    assert (a["checked_in"], a["absent"], a["checkin_percent"]) == (1, 4, 20)
    [campaign] = a["campaigns"]
    assert (campaign["tickets_sold"], campaign["net_kzt"]) == (2, 18000)

    today = datetime.now(UTC).date().isoformat()
    recent = client.get(f"{url}?date_from={today}", headers=org).json()
    assert (recent["sold"], recent["gross_kzt"], recent["refunds_kzt"]) == (2, 22000, 2000)
    vip_only = client.get(f"{url}?ticket_type_id={vip}", headers=org).json()
    assert (vip_only["capacity"], vip_only["sold"], vip_only["net_kzt"]) == (10, 2, 18000)
