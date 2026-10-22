import uuid

from fastapi.testclient import TestClient

from app.db.models import User
from app.db.session import SessionLocal
from app.main import app
from app.modules.support import service as support_service

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


def test_support_cases(monkeypatch):
    sent = []
    monkeypatch.setattr(support_service, "send_email", lambda to, subject, body: sent.append((to, subject)))
    (org, org_email), (buyer, buyer_email), (stranger, _) = _login("organizer"), _login("buyer"), _login("stranger")
    staff, staff_email = _login("supportstaff")
    admin, _ = _login("admin", admin=True)
    event = client.post(
        "/api/v1/events",
        headers=org,
        json={
            "title": f"Support {uuid.uuid4().hex[:6]}",
            "starts_at": "2026-12-01T13:00:00Z",
            "ends_at": "2026-12-01T15:00:00Z",
            "ticket_types": [{"name": "Free", "price_kzt": 0, "quantity_total": 10}],
        },
    ).json()
    client.post(f"/api/v1/events/{event['id']}/publish", headers=org)
    order = client.post(
        "/api/v1/orders",
        headers={**buyer, "Idempotency-Key": uuid.uuid4().hex},
        json={
            "event_id": event["id"],
            "items": [{"ticket_type_id": event["ticket_types"][0]["id"], "quantity": 1, "attendees": [{"name": "B", "email": buyer_email}]}],
        },
    ).json()
    ticket_id = order["tickets"][0]["id"]

    request = {"kind": "attendee", "category": "ticket_delivery", "subject": "No email", "message": "Ticket never arrived"}
    assert client.post("/api/v1/support/cases", headers=stranger, json={**request, "ticket_id": ticket_id}).status_code == 404
    case = client.post("/api/v1/support/cases", headers=buyer, json={**request, "ticket_id": ticket_id}).json()
    assert (case["event_id"], case["order_id"], case["status"]) == (event["id"], order["id"], "open")
    assert sent[-1][0] == org_email
    url = f"/api/v1/support/cases/{case['id']}"

    assert client.get(url, headers=stranger).status_code == 404
    assert client.get(url, headers=staff).status_code == 404
    client.post(f"/api/v1/events/{event['id']}/staff", headers=org, json={"email": staff_email, "role": "organizer_staff"})
    assert [c["id"] for c in client.get("/api/v1/support/inbox", headers=staff).json()] == [case["id"]]

    reply = client.post(f"{url}/messages", headers=staff, json={"body": "Resent it"}).json()
    assert [m["from_requester"] for m in reply["messages"]] == [True, False]
    assert sent[-1][0] == buyer_email

    assert client.patch(url, headers=buyer, json={"status": "resolved"}).status_code == 403
    me = client.get("/api/v1/me", headers=staff).json()
    updated = client.patch(url, headers=org, json={"status": "waiting_for_customer", "assignee_id": me["id"]}).json()
    assert (updated["status"], updated["assignee_name"]) == ("waiting_for_customer", "supportstaff")
    assert {to for to, _ in sent[-2:]} == {staff_email, buyer_email}
    stranger_id = client.get("/api/v1/me", headers=stranger).json()["id"]
    assert client.patch(url, headers=org, json={"assignee_id": stranger_id}).json()["error"]["code"] == "INVALID_ASSIGNEE"

    client.post(f"{url}/messages", headers=buyer, json={"body": "Still nothing"})
    assert client.get(url, headers=buyer).json()["status"] == "open"
    assert sent[-1][0] == staff_email

    platform = client.post(
        "/api/v1/support/cases",
        headers=org,
        json={"kind": "organizer", "category": "activation", "subject": "Fee", "message": "Paid twice?"},
    ).json()
    assert client.get(f"/api/v1/support/cases/{platform['id']}", headers=staff).status_code == 404
    assert platform["id"] in [c["id"] for c in client.get("/api/v1/support/inbox", headers=admin).json()]
    assert platform["id"] not in [c["id"] for c in client.get("/api/v1/support/inbox", headers=org).json()]
    bad = client.post("/api/v1/support/cases", headers=org, json={**request, "kind": "organizer"})
    assert bad.json()["error"]["code"] == "INVALID_CATEGORY"
