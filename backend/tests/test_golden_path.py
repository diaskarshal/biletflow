import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _register_and_login(role: str) -> str:
    email = f"{role}-{uuid.uuid4().hex[:8]}@test.kz"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": role.title()},
    )
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    return resp.json()["access_token"]


@pytest.fixture
def organizer_token() -> str:
    return _register_and_login("organizer")


@pytest.fixture
def attendee_token() -> str:
    return _register_and_login("attendee")


def test_golden_path(organizer_token: str, attendee_token: str):
    org_headers = {"Authorization": f"Bearer {organizer_token}"}
    att_headers = {"Authorization": f"Bearer {attendee_token}"}

    event = client.post(
        "/api/v1/events",
        headers=org_headers,
        json={
            "title": f"Pytest Meetup {uuid.uuid4().hex[:6]}",
            "starts_at": "2026-12-01T18:00:00Z",
            "ends_at": "2026-12-01T20:00:00Z",
        },
    ).json()
    event_id = event["id"]
    assert event["status"] == "draft"

    published = client.post(f"/api/v1/events/{event_id}/publish", headers=org_headers).json()
    assert published["status"] == "published"

    ticket_type = client.post(
        f"/api/v1/events/{event_id}/ticket-types",
        headers=org_headers,
        json={"name": "General", "price_kzt": 0, "quantity_total": 1},
    ).json()

    order = client.post(
        "/api/v1/orders",
        headers={**att_headers, "Idempotency-Key": uuid.uuid4().hex},
        json={
            "event_id": event_id,
            "items": [
                {
                    "ticket_type_id": ticket_type["id"],
                    "quantity": 1,
                    "attendees": [{"name": "Attendee", "email": "attendee-ticket@test.kz"}],
                }
            ],
        },
    ).json()
    assert order["status"] == "paid"
    ticket = order["tickets"][0]
    assert ticket["status"] == "valid"

    overbuy = client.post(
        "/api/v1/orders",
        headers={**att_headers, "Idempotency-Key": uuid.uuid4().hex},
        json={
            "event_id": event_id,
            "items": [
                {
                    "ticket_type_id": ticket_type["id"],
                    "quantity": 1,
                    "attendees": [{"name": "Nobody", "email": "nobody@test.kz"}],
                }
            ],
        },
    )
    assert overbuy.status_code == 409
    assert overbuy.json()["error"]["code"] == "INVENTORY_UNAVAILABLE"

    checkin = client.post(
        "/api/v1/checkin",
        headers=org_headers,
        json={"qr_token": ticket["qr_token"], "event_id": event_id},
    )
    assert checkin.status_code == 200

    second_scan = client.post(
        "/api/v1/checkin",
        headers=org_headers,
        json={"qr_token": ticket["qr_token"], "event_id": event_id},
    )
    assert second_scan.status_code == 409
    assert second_scan.json()["error"]["code"] == "ALREADY_CHECKED_IN"
