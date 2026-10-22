import uuid

from fastapi.testclient import TestClient

from app.db.models import Event, User
from app.db.session import SessionLocal
from app.main import app
from app.modules.admin import service as admin_service

client = TestClient(app)


def _login(role: str, admin: bool = False) -> tuple[dict, str]:
    email = f"{role}-{uuid.uuid4().hex[:8]}@test.kz"
    client.post("/api/v1/auth/register", json={"email": email, "password": "password123", "full_name": role})
    if admin:
        with SessionLocal() as db:
            db.query(User).filter_by(email=email).update({"is_admin": True})
            db.commit()
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"}).json()
    return {"Authorization": f"Bearer {token['access_token']}"}, email


def test_admin_moderation():
    (org, _), (buyer, buyer_email), (admin, _) = _login("organizer"), _login("buyer"), _login("admin", admin=True)
    tag = uuid.uuid4().hex[:6]
    event = client.post(
        "/api/v1/events",
        headers=org,
        json={
            "title": f"Shady {tag}",
            "starts_at": "2026-12-01T13:00:00Z",
            "ends_at": "2026-12-01T15:00:00Z",
            "ticket_types": [{"name": "Paid", "price_kzt": 3000, "quantity_total": 10}],
        },
    ).json()
    event_id, type_id = event["id"], event["ticket_types"][0]["id"]
    client.post(f"/api/v1/events/{event_id}/publish", headers=org)
    with SessionLocal() as db:
        db.get(Event, event_id).paid_sales_enabled = True
        db.commit()
    order = client.post(
        "/api/v1/orders",
        headers={**buyer, "Idempotency-Key": uuid.uuid4().hex},
        json={"event_id": event_id, "items": [{"ticket_type_id": type_id, "quantity": 1, "attendees": [{"name": "B", "email": buyer_email}]}]},
    ).json()
    client.post(f"/api/v1/payments/{order['payment_id']}/simulate", headers=buyer, json={"outcome": "failure"})

    assert client.get("/api/v1/admin/search?q=x", headers=org).status_code == 403
    found = client.get(f"/api/v1/admin/search?q={buyer_email}", headers=admin).json()
    assert [u["email"] for u in found["users"]] == [buyer_email]
    assert [o["id"] for o in found["orders"]] == [order["id"]]
    assert [p["id"] for p in found["payments"]] == [order["payment_id"]]
    assert [e["id"] for e in client.get(f"/api/v1/admin/search?q=shady {tag}", headers=admin).json()["events"]] == [event_id]
    assert order["payment_id"] in [p["id"] for p in client.get("/api/v1/admin/payments?status=failed", headers=admin).json()]

    csv = client.get("/api/v1/admin/export/orders.csv", headers=admin)
    assert csv.headers["content-type"].startswith("text/csv")
    assert csv.text.startswith("id,event_title,buyer_email,status,total_kzt,created_at") and f"{order['id']},Shady {tag}" in csv.text
    assert admin_service._safe_cell("=HYPERLINK(1)") == "'=HYPERLINK(1)" and admin_service._safe_cell("Fine") == "Fine"
    assert client.get("/api/v1/admin/search?q=²", headers=admin).status_code == 200

    client.post(f"/api/v1/events/{event_id}/report", headers=buyer, json={"reason": "Looks odd"})
    client.post(f"/api/v1/events/{event_id}/report", headers=buyer, json={"reason": "Looks fake"})
    [report] = [r for r in client.get("/api/v1/admin/reports", headers=admin).json() if r["event_id"] == event_id]
    assert (report["reason"], report["reporter_email"]) == ("Looks fake", buyer_email)
    pending = client.post(
        "/api/v1/orders",
        headers={**buyer, "Idempotency-Key": uuid.uuid4().hex},
        json={"event_id": event_id, "items": [{"ticket_type_id": type_id, "quantity": 1, "attendees": [{"name": "B", "email": buyer_email}]}]},
    ).json()
    client.post(f"/api/v1/admin/events/{event_id}/suspension", headers=admin, json={"suspended": True})
    paid = client.post(f"/api/v1/payments/{pending['payment_id']}/simulate", headers=buyer, json={"outcome": "success"}).json()
    assert paid["status"] == "failed"
    assert client.get(f"/api/v1/orders/{pending['id']}", headers=buyer).json()["status"] == "failed"
    assert client.patch(f"/api/v1/events/{event_id}", headers=org, json={"venue_name": "Scam"}).json()["error"]["code"] == "EVENT_SUSPENDED"
    assert client.post(f"/api/v1/events/{event_id}/duplicate", headers=org).json()["error"]["code"] == "EVENT_SUSPENDED"
    assert event_id not in [r["event_id"] for r in client.get("/api/v1/admin/reports", headers=admin).json()]
    assert client.get(f"/api/v1/events/{event['slug']}").status_code == 404
    assert client.get(f"/api/v1/events/{event['slug']}", headers=org).json()["suspended_at"] is not None
    retry = client.post(
        "/api/v1/orders",
        headers={**buyer, "Idempotency-Key": uuid.uuid4().hex},
        json={"event_id": event_id, "items": [{"ticket_type_id": type_id, "quantity": 1, "attendees": [{"name": "B", "email": buyer_email}]}]},
    )
    assert retry.json()["error"]["code"] == "EVENT_SUSPENDED"
    client.post(f"/api/v1/admin/events/{event_id}/suspension", headers=admin, json={"suspended": False})
    assert client.get(f"/api/v1/events/{event['slug']}").status_code == 200

    buyer_id = found["users"][0]["id"]
    client.post(f"/api/v1/admin/users/{buyer_id}/suspension", headers=admin, json={"suspended": True})
    assert client.get("/api/v1/me", headers=buyer).json()["error"]["code"] == "ACCOUNT_SUSPENDED"
    login = client.post("/api/v1/auth/login", json={"email": buyer_email, "password": "password123"})
    assert login.json()["error"]["code"] == "ACCOUNT_SUSPENDED"
    client.post(f"/api/v1/admin/users/{buyer_id}/suspension", headers=admin, json={"suspended": False})
    assert client.get("/api/v1/me", headers=buyer).status_code == 200
