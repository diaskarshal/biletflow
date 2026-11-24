import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve

client = TestClient(app)


def _login(role: str) -> dict:
    email = f"{role}-{uuid.uuid4().hex[:8]}@test.kz"
    client.post("/api/v1/auth/register", json={"email": email, "password": "password123", "full_name": role})
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"}).json()
    return {"Authorization": f"Bearer {token['access_token']}"}


def _event(org: dict, **extra) -> dict:
    event = client.post(
        "/api/v1/events",
        headers=org,
        json={
            "title": f"Rules {uuid.uuid4().hex[:6]}",
            "starts_at": "2027-03-01T13:00:00Z",
            "ends_at": "2027-03-01T15:00:00Z",
            "category": "meetup",
            "ticket_types": [
                {"name": "Free", "price_kzt": 0, "quantity_total": 10},
                {"name": "Hidden", "price_kzt": 0, "quantity_total": 10, "is_hidden": True},
            ],
            **extra,
        },
    ).json()
    client.post(f"/api/v1/events/{event['id']}/publish", headers=org)
    approve(event["id"])
    return event


def _order(headers: dict, event: dict, type_index: int = 0, quantity: int = 1, key: str | None = None):
    return client.post(
        "/api/v1/orders",
        headers={**headers, "Idempotency-Key": uuid.uuid4().hex},
        json={
            "event_id": event["id"],
            "access_key": key,
            "items": [{
                "ticket_type_id": event["ticket_types"][type_index]["id"],
                "quantity": quantity,
                "attendees": [{"name": "A", "email": "a@test.kz"}] * quantity,
            }],
        },
    )


def _code(response) -> str:
    return response.json()["error"]["code"]


def test_visibility_capacity_windows_and_hidden_types():
    org, buyer = _login("organizer"), _login("buyer")
    titles = lambda q: [e["title"] for e in client.get("/api/v1/events", params={"q": q}).json()["items"]]

    unlisted = _event(org, visibility="unlisted")
    assert titles(unlisted["title"]) == []
    assert client.get(f"/api/v1/events/{unlisted['slug']}").status_code == 200

    private = _event(org, visibility="private", capacity=3)
    key = next(e["access_key"] for e in client.get("/api/v1/organizer/events", headers=org).json() if e["id"] == private["id"])
    assert titles(private["title"]) == []
    assert client.get(f"/api/v1/events/{private['slug']}").status_code == 404
    assert client.get(f"/api/v1/events/{private['slug']}", params={"key": key}).status_code == 200
    assert client.get(f"/api/v1/events/{private['slug']}/calendar.ics").status_code == 404
    assert f"?key={key}" in client.get(f"/api/v1/events/{private['slug']}/calendar.ics", params={"key": key}).text
    assert _code(_order(buyer, private)) == "EVENT_NOT_FOUND"
    assert _order(buyer, private, quantity=2, key=key).status_code == 201
    assert client.get(f"/api/v1/events/{private['slug']}", headers=buyer).status_code == 200
    assert _code(_order(buyer, private, quantity=2, key=key)) == "INVENTORY_UNAVAILABLE"
    assert _code(_order(buyer, private, type_index=1, key=key)) == "TICKET_TYPE_NOT_FOUND"
    shrink = client.patch(f"/api/v1/events/{private['id']}", headers=org, json={"capacity": 1})
    assert _code(shrink) == "CAPACITY_BELOW_SOLD"
    assert client.patch(f"/api/v1/events/{private['id']}", headers=org, json={"capacity": None}).json()["capacity"] is None

    now = datetime.now(UTC)
    later = _event(org, registration_opens_at=(now + timedelta(days=1)).isoformat())
    assert _code(_order(buyer, later)) == "REGISTRATION_NOT_OPEN"
    closed = _event(org, registration_closes_at=(now - timedelta(days=1)).isoformat())
    assert _code(_order(buyer, closed)) == "REGISTRATION_CLOSED"

    window = _event(org)
    type_id = window["ticket_types"][0]["id"]
    client.patch(f"/api/v1/ticket-types/{type_id}", headers=org, json={"sales_end_at": (now - timedelta(hours=1)).isoformat()})
    assert _code(_order(buyer, window)) == "SALES_CLOSED"
    client.patch(f"/api/v1/ticket-types/{type_id}", headers=org, json={"sales_end_at": None, "description": "Front rows"})
    assert _order(buyer, window).status_code == 201

    stats = client.get(f"/api/v1/events/{window['id']}/analytics", headers=org).json()
    row = stats["by_ticket_type"][0]
    assert (row["available"], row["reserved"], row["refunded"], row["checked_in"]) == (9, 0, 0, 0)
    assert stats["fees_kzt"] == 0 and stats["payout_kzt"] == 0
