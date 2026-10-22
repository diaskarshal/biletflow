import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _login(role: str) -> tuple[dict, str]:
    email = f"{role}-{uuid.uuid4().hex[:8]}@test.kz"
    client.post("/api/v1/auth/register", json={"email": email, "password": "password123", "full_name": role})
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"}).json()
    return {"Authorization": f"Bearer {token['access_token']}"}, email


def _event(org: dict) -> dict:
    return client.post(
        "/api/v1/events",
        headers=org,
        json={
            "title": f"History {uuid.uuid4().hex[:6]}",
            "starts_at": "2026-12-01T13:00:00Z",
            "ends_at": "2026-12-01T15:00:00Z",
            "venue_name": "Hall",
            "ticket_types": [{"name": "Free", "price_kzt": 0, "quantity_total": 10}],
        },
    ).json()


def test_unpublish_duplicate_and_activity():
    org, _ = _login("organizer")
    buyer, _ = _login("buyer")
    helper, helper_email = _login("helper")
    door, door_email = _login("door")

    empty = _event(org)
    client.post(f"/api/v1/events/{empty['id']}/publish", headers=org)
    assert client.post(f"/api/v1/events/{empty['id']}/unpublish", headers=org).json()["status"] == "draft"

    event = _event(org)
    event_id = event["id"]
    client.post(f"/api/v1/events/{event_id}/publish", headers=org)
    client.post(
        "/api/v1/orders",
        headers={**buyer, "Idempotency-Key": uuid.uuid4().hex},
        json={"event_id": event_id, "items": [{"ticket_type_id": event["ticket_types"][0]["id"], "quantity": 1, "attendees": [{"name": "A", "email": "a@test.kz"}]}]},
    )
    assert client.post(f"/api/v1/events/{event_id}/unpublish", headers=org).json()["error"]["code"] == "EVENT_HAS_ORDERS"
    client.patch(f"/api/v1/events/{event_id}", headers=org, json={"venue_name": "Big hall"})

    copy = client.post(f"/api/v1/events/{event_id}/duplicate", headers=org).json()
    assert (copy["status"], copy["venue_name"], copy["title"]) == ("draft", "Big hall", f"{event['title']} (copy)")
    [copied_type] = copy["ticket_types"]
    assert (copied_type["quantity_total"], copied_type["quantity_sold"]) == (10, 0)
    assert client.get(f"/api/v1/events/{copy['id']}/attendees", headers=org).json() == []

    url = f"/api/v1/events/{event_id}/activity"
    client.post(f"/api/v1/events/{event_id}/staff", headers=org, json={"email": helper_email, "role": "organizer_staff"})
    client.post(f"/api/v1/events/{event_id}/staff", headers=org, json={"email": door_email, "role": "event_admin"})
    assert client.get(url, headers=buyer).status_code == 403
    assert client.get(url, headers=door).status_code == 403
    history = client.get(url, headers=helper).json()
    assert [h["action_type"] for h in history] == ["event.updated", "event.published", "event.created"]
    assert history[0]["actor_name"] == "organizer" and history[0]["description"] == "Changed venue_name"
    assert [h["action_type"] for h in client.get(f"{url}?action=event.pub", headers=org).json()] == ["event.published"]
    tomorrow = (datetime.now(UTC) + timedelta(days=2)).date().isoformat()
    assert client.get(f"{url}?date_from={tomorrow}", headers=org).json() == []
