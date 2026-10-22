import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.db.models import Event
from app.db.session import SessionLocal
from app.main import app

client = TestClient(app)


def _login(role: str) -> dict:
    email = f"{role}-{uuid.uuid4().hex[:8]}@test.kz"
    client.post("/api/v1/auth/register", json={"email": email, "password": "password123", "full_name": role})
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"}).json()
    return {"Authorization": f"Bearer {token['access_token']}"}


def _buy(headers: dict, event_id: int, ticket_type_id: int, code: str | None = None):
    return client.post(
        "/api/v1/orders",
        headers={**headers, "Idempotency-Key": uuid.uuid4().hex},
        json={
            "event_id": event_id,
            "promo_code": code,
            "items": [
                {"ticket_type_id": ticket_type_id, "quantity": 1, "attendees": [{"name": "B", "email": "b@test.kz"}]}
            ],
        },
    ).json()


def _campaign(headers: dict, event_id: int, **body) -> dict:
    return client.post(f"/api/v1/events/{event_id}/campaigns", headers=headers, json={"name": "Promo", **body}).json()


def test_promo_codes_and_campaign_reporting():
    org, buyer = _login("organizer"), _login("buyer")
    event = client.post(
        "/api/v1/events",
        headers=org,
        json={
            "title": f"Promo {uuid.uuid4().hex[:6]}",
            "starts_at": "2026-12-01T13:00:00Z",
            "ends_at": "2026-12-01T15:00:00Z",
            "ticket_types": [
                {"name": "VIP", "price_kzt": 5000, "quantity_total": 20},
                {"name": "Student", "price_kzt": 2000, "quantity_total": 20},
            ],
        },
    ).json()
    event_id = event["id"]
    vip, student = (t["id"] for t in event["ticket_types"])
    client.post(f"/api/v1/events/{event_id}/publish", headers=org)
    with SessionLocal() as db:
        db.get(Event, event_id).paid_sales_enabled = True
        db.commit()

    half = _campaign(org, event_id, code="half50", discount_type="percent", discount_value=50, max_redemptions=1)
    assert half["code"] == "HALF50" and "?promo=" in half["link"]
    token = half["link"].split("?promo=")[1]
    assert client.get(f"/api/v1/events/{event_id}/promo?token={token}").json()["code"] == "HALF50"
    assert client.post("/api/v1/checkin", headers=org, json={"qr_token": token, "event_id": event_id}).status_code == 404
    qr = client.get(f"/api/v1/campaigns/{half['id']}/qr", headers=org)
    assert qr.headers["content-type"] == "image/png" and qr.content.startswith(b"\x89PNG")

    failed = _buy(buyer, event_id, vip, "half50")
    assert (failed["discount_kzt"], failed["total_kzt"]) == (2500, 2500)
    client.post(f"/api/v1/payments/{failed['payment_id']}/simulate", headers=buyer, json={"outcome": "failure"})

    order = _buy(buyer, event_id, vip, "HALF50")
    assert order["total_kzt"] == 2500, "a failed payment must give the redemption back"
    client.post(f"/api/v1/payments/{order['payment_id']}/simulate", headers=buyer, json={"outcome": "success"})
    assert _buy(buyer, event_id, vip, "HALF50")["error"]["code"] == "PROMO_EXHAUSTED"

    [report] = [c for c in client.get(f"/api/v1/events/{event_id}/campaigns", headers=org).json() if c["id"] == half["id"]]
    assert (report["redemptions"], report["orders"], report["tickets_sold"]) == (1, 1, 1)
    assert (report["gross_kzt"], report["discount_kzt"], report["net_kzt"]) == (5000, 2500, 2500)

    free_pass = _campaign(org, event_id, discount_type="fixed", discount_value=99999)
    covered = _buy(buyer, event_id, student, free_pass["code"])
    assert (covered["total_kzt"], covered["status"], covered["payment_id"]) == (0, "paid", None)

    vip_only = _campaign(org, event_id, discount_type="fixed", discount_value=500, ticket_type_ids=[vip])
    assert _buy(buyer, event_id, student, vip_only["code"])["error"]["code"] == "PROMO_NOT_APPLICABLE"

    client.post(f"/api/v1/campaigns/{vip_only['id']}/disable", headers=org)
    assert _buy(buyer, event_id, vip, vip_only["code"])["error"]["code"] == "PROMO_DISABLED"

    yesterday = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    expired = _campaign(org, event_id, discount_type="percent", discount_value=10, valid_until=yesterday)
    assert _buy(buyer, event_id, vip, expired["code"])["error"]["code"] == "PROMO_EXPIRED"
    assert _buy(buyer, event_id, vip, "NOPE")["error"]["code"] == "PROMO_NOT_FOUND"

    bad = client.post(
        f"/api/v1/events/{event_id}/campaigns",
        headers=org,
        json={"name": "x", "discount_type": "percent", "discount_value": 150},
    )
    assert bad.status_code == 422
