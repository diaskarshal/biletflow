import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.db.models import Order, User
from app.db.session import SessionLocal
from app.main import app
from app.modules.orders import service as orders_service
from app.modules.payments import service as payments_service

client = TestClient(app)


def _login(role: str, admin: bool = False) -> dict:
    email = f"{role}-{uuid.uuid4().hex[:8]}@test.kz"
    client.post("/api/v1/auth/register", json={"email": email, "password": "password123", "full_name": role})
    if admin:
        with SessionLocal() as db:
            db.query(User).filter_by(email=email).update({"is_admin": True})
            db.commit()
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"}).json()
    return {"Authorization": f"Bearer {token['access_token']}"}


def _buy(headers: dict, event_id: int, ticket_type_id: int):
    return client.post(
        "/api/v1/orders",
        headers={**headers, "Idempotency-Key": uuid.uuid4().hex},
        json={
            "event_id": event_id,
            "items": [
                {
                    "ticket_type_id": ticket_type_id,
                    "quantity": 1,
                    "attendees": [{"name": "Buyer", "email": "buyer@test.kz"}],
                }
            ],
        },
    )


def _vip(event_id: int) -> dict:
    types = client.get(f"/api/v1/events/{event_id}/ticket-types").json()
    return next(t for t in types if t["name"] == "VIP")


def _pay(headers: dict, payment_id: int, outcome: str):
    return client.post(f"/api/v1/payments/{payment_id}/simulate", headers=headers, json={"outcome": outcome})


def test_paid_sales_activation_and_checkout(monkeypatch: pytest.MonkeyPatch):
    sent = []
    monkeypatch.setattr(orders_service, "send_email", lambda **kw: sent.append(kw))
    monkeypatch.setattr(payments_service, "send_email", lambda **kw: sent.append(kw))
    org, buyer, admin = _login("organizer"), _login("buyer"), _login("admin", admin=True)

    event = client.post(
        "/api/v1/events",
        headers=org,
        json={
            "title": f"Paid {uuid.uuid4().hex[:6]}",
            "starts_at": "2026-12-01T13:00:00Z",
            "ends_at": "2026-12-01T15:00:00Z",
            "ticket_types": [{"name": "VIP", "price_kzt": 5000, "quantity_total": 2}],
        },
    ).json()
    event_id, vip_id = event["id"], event["ticket_types"][0]["id"]
    client.post(f"/api/v1/events/{event_id}/publish", headers=org)

    blocked = _buy(buyer, event_id, vip_id)
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "PAID_SALES_NOT_ACTIVE"

    early = client.post(f"/api/v1/events/{event_id}/activation/payment", headers=org)
    assert early.json()["error"]["code"] == "ACTIVATION_INCOMPLETE"
    assert set(early.json()["error"]["details"]["missing"]) == {
        "organizer_verified",
        "payout_account_set",
        "terms_accepted",
    }

    profile = client.post(
        "/api/v1/organizer/verification", headers=org, files={"document": ("id.pdf", b"%PDF", "application/pdf")}
    ).json()
    assert profile["verification_status"] == "pending"
    client.patch("/api/v1/organizer/profile", headers=org, json={"payout_account": "KZ00 TEST 0000"})
    client.post(f"/api/v1/events/{event_id}/activation/terms", headers=org)
    pending = client.get("/api/v1/admin/organizers?status=pending", headers=admin).json()
    assert profile["id"] in [o["id"] for o in pending]
    assert client.get("/api/v1/admin/organizers", headers=org).status_code == 403
    client.post(f"/api/v1/admin/organizers/{profile['id']}/verification", headers=admin, json={"status": "approved"})

    fee = client.post(f"/api/v1/events/{event_id}/activation/payment", headers=org).json()
    assert _pay(org, fee["payment_id"], "success").json()["status"] == "succeeded"
    status = client.get(f"/api/v1/events/{event_id}/activation", headers=org).json()
    assert status["fee_paid"] and status["paid_sales_enabled"]

    order = _buy(buyer, event_id, vip_id).json()
    assert order["status"] == "pending" and order["payment_id"]
    assert order["tickets"][0]["status"] == "pending"
    assert _vip(event_id)["quantity_reserved"] == 1
    unpaid_scan = client.post(
        "/api/v1/checkin", headers=org, json={"qr_token": order["tickets"][0]["qr_token"], "event_id": event_id}
    )
    assert unpaid_scan.json()["error"]["code"] == "TICKET_UNPAID"
    assert sent == []

    assert _pay(buyer, order["payment_id"], "success").json()["status"] == "succeeded"
    paid = client.get(f"/api/v1/orders/{order['id']}", headers=buyer).json()
    assert paid["status"] == "paid" and paid["tickets"][0]["status"] == "valid"
    assert (_vip(event_id)["quantity_sold"], _vip(event_id)["quantity_reserved"]) == (1, 0)
    assert len(sent) == 1
    assert _pay(buyer, order["payment_id"], "failure").json()["error"]["code"] == "PAYMENT_CLOSED"

    failed = _buy(buyer, event_id, vip_id).json()
    _pay(buyer, failed["payment_id"], "failure")
    failed = client.get(f"/api/v1/orders/{failed['id']}", headers=buyer).json()
    assert failed["status"] == "failed" and failed["tickets"][0]["status"] == "cancelled"
    assert (_vip(event_id)["quantity_sold"], _vip(event_id)["quantity_reserved"]) == (1, 0)
    assert "Payment failed" in sent[-1]["subject"]

    timed_out = _buy(buyer, event_id, vip_id).json()
    _pay(buyer, timed_out["payment_id"], "timeout")
    assert client.get(f"/api/v1/orders/{timed_out['id']}", headers=buyer).json()["status"] == "expired"

    abandoned = _buy(buyer, event_id, vip_id).json()
    assert _buy(buyer, event_id, vip_id).json()["error"]["code"] == "INVENTORY_UNAVAILABLE"
    with SessionLocal() as db:
        db.query(Order).filter_by(id=abandoned["id"]).update(
            {"expires_at": datetime.now(UTC) - timedelta(minutes=1)}
        )
        db.commit()
    client.get("/api/v1/me/orders", headers=buyer)
    assert client.get(f"/api/v1/orders/{abandoned['id']}", headers=buyer).json()["status"] == "expired"
    assert _vip(event_id)["quantity_reserved"] == 0

    suspended = client.post(f"/api/v1/admin/events/{event_id}/paid-sales", headers=admin, json={"suspended": True})
    assert suspended.json()["paid_sales_enabled"] is False
    assert _buy(buyer, event_id, vip_id).json()["error"]["code"] == "PAID_SALES_NOT_ACTIVE"
