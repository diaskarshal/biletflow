import uuid

import pytest
from fastapi.testclient import TestClient

from app.db.models import AuditLog, Event, Payment
from app.db.session import SessionLocal
from app.main import app
from app.modules.orders import service as orders_service
from app.modules.payments import service as payments_service

client = TestClient(app)


def _login(role: str) -> dict:
    email = f"{role}-{uuid.uuid4().hex[:8]}@test.kz"
    client.post("/api/v1/auth/register", json={"email": email, "password": "password123", "full_name": role})
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"}).json()
    return {"Authorization": f"Bearer {token['access_token']}"}


def _order(headers: dict, event_id: int, ticket_type_id: int) -> dict:
    order = client.post(
        "/api/v1/orders",
        headers={**headers, "Idempotency-Key": uuid.uuid4().hex},
        json={
            "event_id": event_id,
            "items": [
                {"ticket_type_id": ticket_type_id, "quantity": 1, "attendees": [{"name": "A", "email": "a@test.kz"}]}
            ],
        },
    ).json()
    if order["payment_id"]:
        client.post(f"/api/v1/payments/{order['payment_id']}/simulate", headers=headers, json={"outcome": "success"})
    return client.get(f"/api/v1/orders/{order['id']}", headers=headers).json()


def _sold(event_id: int) -> dict:
    return {t["name"]: t["quantity_sold"] for t in client.get(f"/api/v1/events/{event_id}/ticket-types").json()}


def test_cancellations_refunds_and_event_cancellation(monkeypatch: pytest.MonkeyPatch):
    sent = []
    monkeypatch.setattr(orders_service, "send_email", lambda **kw: sent.append(kw))
    monkeypatch.setattr(payments_service, "send_email", lambda **kw: sent.append(kw))
    org, buyer, stranger = _login("organizer"), _login("buyer"), _login("stranger")

    event = client.post(
        "/api/v1/events",
        headers=org,
        json={
            "title": f"Refunds {uuid.uuid4().hex[:6]}",
            "starts_at": "2026-12-01T13:00:00Z",
            "ends_at": "2026-12-01T15:00:00Z",
            "refund_policy": "full_anytime",
            "ticket_types": [
                {"name": "Free", "price_kzt": 0, "quantity_total": 10},
                {"name": "Paid", "price_kzt": 3000, "quantity_total": 10},
            ],
        },
    ).json()
    event_id = event["id"]
    free_id, paid_id = (t["id"] for t in event["ticket_types"])
    assert event["refund_policy"] == "full_anytime"
    client.post(f"/api/v1/events/{event_id}/publish", headers=org)
    with SessionLocal() as db:
        db.get(Event, event_id).paid_sales_enabled = True
        db.commit()

    free = _order(buyer, event_id, free_id)
    assert client.post(f"/api/v1/orders/{free['id']}/cancel", headers=stranger).status_code == 403
    cancelled = client.post(f"/api/v1/orders/{free['id']}/cancel", headers=org).json()
    assert cancelled["status"] == "cancelled" and cancelled["tickets"][0]["status"] == "cancelled"
    scan = client.post("/api/v1/checkin", headers=org, json={"qr_token": free["tickets"][0]["qr_token"], "event_id": event_id})
    assert scan.json()["error"]["code"] == "TICKET_CANCELLED"
    assert _sold(event_id)["Free"] == 0

    paid = _order(buyer, event_id, paid_id)
    assert paid["status"] == "paid"
    refunded = client.post(f"/api/v1/orders/{paid['id']}/cancel", headers=org).json()
    assert refunded["status"] == "refunded" and refunded["tickets"][0]["status"] == "refunded"
    assert _sold(event_id)["Paid"] == 0
    with SessionLocal() as db:
        payment = db.query(Payment).filter_by(order_id=paid["id"]).one()
        assert payment.status == "refunded" and payment.refunded_at is not None
    assert sent[-1]["subject"].startswith("Refund completed")

    used = _order(buyer, event_id, free_id)
    client.post("/api/v1/checkin", headers=org, json={"qr_token": used["tickets"][0]["qr_token"], "event_id": event_id})
    assert client.post(f"/api/v1/orders/{used['id']}/cancel", headers=org).json()["error"]["code"] == "TICKET_ALREADY_USED"

    still_paid = _order(buyer, event_id, paid_id)
    sent.clear()
    assert client.post(f"/api/v1/events/{event_id}/cancel", headers=org).json()["status"] == "cancelled"
    assert client.get(f"/api/v1/orders/{still_paid['id']}", headers=buyer).json()["status"] == "refunded"
    assert client.get(f"/api/v1/orders/{used['id']}", headers=buyer).json()["status"] == "cancelled"
    assert {m["subject"] for m in sent} == {f"Event cancelled: {event['title']}"}
    assert len(sent) == 2

    with SessionLocal() as db:
        actions = {a.action_type for a in db.query(AuditLog).filter_by(event_id=event_id)}
    assert {
        "event.created",
        "event.published",
        "order.cancelled",
        "order.refunded",
        "payment.succeeded",
        "checkin",
        "event.cancelled",
    } <= actions
