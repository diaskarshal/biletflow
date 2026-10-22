import uuid

from fastapi.testclient import TestClient

from app.db.models import AuditLog
from app.db.session import SessionLocal
from app.main import app

client = TestClient(app)


def _login(role: str) -> tuple[dict, str]:
    email = f"{role}-{uuid.uuid4().hex[:8]}@test.kz"
    client.post("/api/v1/auth/register", json={"email": email, "password": "password123", "full_name": role})
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"}).json()
    return {"Authorization": f"Bearer {token['access_token']}"}, email


def test_search_manual_checkin_undo_and_counts():
    org, _ = _login("organizer")
    staff, staff_email = _login("doorstaff")
    buyer, _ = _login("buyer")
    event = client.post(
        "/api/v1/events",
        headers=org,
        json={
            "title": f"Desk {uuid.uuid4().hex[:6]}",
            "starts_at": "2026-12-01T13:00:00Z",
            "ends_at": "2026-12-01T15:00:00Z",
            "ticket_types": [{"name": "Free", "price_kzt": 0, "quantity_total": 10}],
        },
    ).json()
    event_id, type_id = event["id"], event["ticket_types"][0]["id"]
    client.post(f"/api/v1/events/{event_id}/publish", headers=org)
    client.post(
        "/api/v1/orders",
        headers={**buyer, "Idempotency-Key": uuid.uuid4().hex},
        json={
            "event_id": event_id,
            "items": [
                {
                    "ticket_type_id": type_id,
                    "quantity": 2,
                    "attendees": [{"name": "Aigerim Sadykova", "email": "aigerim@test.kz"}, {"name": "Bolat", "email": "bolat@test.kz"}],
                }
            ],
        },
    )
    base = f"/api/v1/checkin/events/{event_id}"
    assert client.get(f"{base}/summary", headers=staff).status_code == 403
    client.post(f"/api/v1/events/{event_id}/staff", headers=org, json={"email": staff_email, "role": "event_admin"})

    assert client.get(f"{base}/summary", headers=staff).json() == {"registered": 2, "checked_in": 0}
    [found] = client.get(f"{base}/attendees?q=aiger", headers=staff).json()
    assert found["attendee_name"] == "Aigerim Sadykova"
    assert len(client.get(f"{base}/attendees?q=TEST.KZ", headers=staff).json()) == 2

    ticket = f"/api/v1/checkin/tickets/{found['ticket_id']}"
    body = {"event_id": event_id}
    assert client.post(ticket, headers=staff, json=body).status_code == 200
    assert client.post(ticket, headers=staff, json=body).json()["error"]["code"] == "ALREADY_CHECKED_IN"
    assert client.get(f"{base}/summary", headers=staff).json() == {"registered": 2, "checked_in": 1}

    assert client.post(f"{ticket}/undo", headers=staff, json=body).status_code == 204
    assert client.post(f"{ticket}/undo", headers=staff, json=body).json()["error"]["code"] == "NOT_CHECKED_IN"
    assert client.get(f"{base}/summary", headers=staff).json() == {"registered": 2, "checked_in": 0}
    assert client.post(ticket, headers=staff, json=body).status_code == 200

    with SessionLocal() as db:
        actions = [a.action_type for a in db.query(AuditLog).filter_by(event_id=event_id)]
    assert actions.count("checkin") == 2 and "checkin.reversed" in actions
