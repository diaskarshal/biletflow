import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _login(role: str) -> dict:
    email = f"{role}-{uuid.uuid4().hex[:8]}@test.kz"
    client.post("/api/v1/auth/register", json={"email": email, "password": "password123", "full_name": role})
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"}).json()
    return {"Authorization": f"Bearer {token['access_token']}"}


def _order(headers: dict, event_id: int, type_id: int, quantity: int = 1):
    return client.post(
        "/api/v1/orders",
        headers={**headers, "Idempotency-Key": uuid.uuid4().hex},
        json={
            "event_id": event_id,
            "items": [{"ticket_type_id": type_id, "quantity": quantity, "attendees": [{"name": "A", "email": "a@test.kz"}] * quantity}],
        },
    )


def test_max_tickets_per_person():
    org, alice, bob = _login("organizer"), _login("alice"), _login("bob")
    event = client.post(
        "/api/v1/events",
        headers=org,
        json={
            "title": f"Limit {uuid.uuid4().hex[:6]}",
            "starts_at": "2026-12-01T13:00:00Z",
            "ends_at": "2026-12-01T15:00:00Z",
            "ticket_types": [{"name": "Free", "price_kzt": 0, "quantity_total": 50, "max_per_order": 2}],
        },
    ).json()
    client.post(f"/api/v1/events/{event['id']}/publish", headers=org)
    type_id = event["ticket_types"][0]["id"]
    assert event["ticket_types"][0]["max_per_order"] == 2

    assert _order(alice, event["id"], type_id, 3).json()["error"]["code"] == "TICKET_LIMIT_REACHED"
    assert _order(alice, event["id"], type_id, 2).status_code == 201
    assert _order(alice, event["id"], type_id).json()["error"]["code"] == "TICKET_LIMIT_REACHED"
    assert _order(bob, event["id"], type_id).status_code == 201


def test_limit_must_be_positive():
    org = _login("organizer")
    resp = client.post(
        "/api/v1/events",
        headers=org,
        json={
            "title": "Bad limit",
            "starts_at": "2026-12-01T13:00:00Z",
            "ends_at": "2026-12-01T15:00:00Z",
            "ticket_types": [{"name": "Free", "price_kzt": 0, "quantity_total": 5, "max_per_order": 0}],
        },
    )
    assert resp.status_code == 422


def test_set_and_clear_limit_on_existing_ticket_type():
    org = _login("organizer")
    event = client.post(
        "/api/v1/events",
        headers=org,
        json={
            "title": "Existing",
            "starts_at": "2026-12-01T13:00:00Z",
            "ends_at": "2026-12-01T15:00:00Z",
            "ticket_types": [{"name": "Free", "price_kzt": 0, "quantity_total": 5}],
        },
    ).json()
    url = f"/api/v1/ticket-types/{event['ticket_types'][0]['id']}"

    assert client.patch(url, headers=org, json={"max_per_order": 1}).json()["max_per_order"] == 1
    assert client.patch(url, headers=org, json={"price_kzt": 0}).json()["max_per_order"] == 1
    assert client.patch(url, headers=org, json={"max_per_order": None}).json()["max_per_order"] is None
