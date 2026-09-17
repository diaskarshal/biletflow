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
    return resp.json()["access_token"], email


@pytest.fixture
def organizer() -> tuple[str, str]:
    return _register_and_login("organizer")


@pytest.fixture
def staff_user() -> tuple[str, str]:
    return _register_and_login("staffuser")


@pytest.fixture
def attendee() -> tuple[str, str]:
    return _register_and_login("attendee")


def test_organizer_profile_auto_create_and_update(organizer: tuple[str, str]):
    token, _email = organizer
    headers = {"Authorization": f"Bearer {token}"}

    profile = client.get("/api/v1/organizer/profile", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["verification_status"] == "none"

    updated = client.patch(
        "/api/v1/organizer/profile",
        headers=headers,
        json={"display_name": "Updated Org Name"},
    )
    assert updated.status_code == 200
    assert updated.json()["display_name"] == "Updated Org Name"


def test_create_event_with_ticket_types_in_one_request(organizer: tuple[str, str]):
    token, _email = organizer
    headers = {"Authorization": f"Bearer {token}"}

    event = client.post(
        "/api/v1/events",
        headers=headers,
        json={
            "title": f"Combined {uuid.uuid4().hex[:6]}",
            "starts_at": "2026-12-01T18:00:00Z",
            "ends_at": "2026-12-01T20:00:00Z",
            "ticket_types": [
                {"name": "General", "price_kzt": 0, "quantity_total": 5},
                {"name": "VIP", "price_kzt": 10000, "quantity_total": 2},
            ],
        },
    )
    assert event.status_code == 201
    body = event.json()
    assert len(body["ticket_types"]) == 2
    assert {tt["name"] for tt in body["ticket_types"]} == {"General", "VIP"}


def test_owner_can_view_draft_others_cannot(organizer: tuple[str, str], attendee: tuple[str, str]):
    org_token, _ = organizer
    att_token, _ = attendee
    org_headers = {"Authorization": f"Bearer {org_token}"}
    att_headers = {"Authorization": f"Bearer {att_token}"}

    event = client.post(
        "/api/v1/events",
        headers=org_headers,
        json={
            "title": f"Draft Visibility {uuid.uuid4().hex[:6]}",
            "starts_at": "2026-12-01T18:00:00Z",
            "ends_at": "2026-12-01T20:00:00Z",
        },
    ).json()
    slug = event["slug"]

    anon = client.get(f"/api/v1/events/{slug}")
    assert anon.status_code == 404

    other_user = client.get(f"/api/v1/events/{slug}", headers=att_headers)
    assert other_user.status_code == 404

    owner_view = client.get(f"/api/v1/events/{slug}", headers=org_headers)
    assert owner_view.status_code == 200


def test_staff_role_check_gates_checkin(
    organizer: tuple[str, str], staff_user: tuple[str, str], attendee: tuple[str, str]
):
    org_token, _ = organizer
    staff_token, staff_email = staff_user
    att_token, att_email = attendee
    org_headers = {"Authorization": f"Bearer {org_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    att_headers = {"Authorization": f"Bearer {att_token}"}

    event = client.post(
        "/api/v1/events",
        headers=org_headers,
        json={
            "title": f"Role Check {uuid.uuid4().hex[:6]}",
            "starts_at": "2026-12-01T18:00:00Z",
            "ends_at": "2026-12-01T20:00:00Z",
            "ticket_types": [{"name": "General", "price_kzt": 0, "quantity_total": 1}],
        },
    ).json()
    event_id = event["id"]
    ticket_type_id = event["ticket_types"][0]["id"]

    client.post(f"/api/v1/events/{event_id}/publish", headers=org_headers)

    order = client.post(
        "/api/v1/orders",
        headers={**att_headers, "Idempotency-Key": uuid.uuid4().hex},
        json={
            "event_id": event_id,
            "items": [
                {
                    "ticket_type_id": ticket_type_id,
                    "quantity": 1,
                    "attendees": [{"name": "Attendee", "email": att_email}],
                }
            ],
        },
    ).json()
    qr_token = order["tickets"][0]["qr_token"]

    before_assignment = client.post(
        "/api/v1/checkin",
        headers=staff_headers,
        json={"qr_token": qr_token, "event_id": event_id},
    )
    assert before_assignment.status_code == 403

    assign = client.post(
        f"/api/v1/events/{event_id}/staff",
        headers=org_headers,
        json={"email": staff_email, "role": "event_admin"},
    )
    assert assign.status_code == 201
    assert assign.json()["role"] == "event_admin"

    staff_list = client.get(f"/api/v1/events/{event_id}/staff", headers=org_headers)
    assert staff_list.status_code == 200
    assert len(staff_list.json()) == 1

    after_assignment = client.post(
        "/api/v1/checkin",
        headers=staff_headers,
        json={"qr_token": qr_token, "event_id": event_id},
    )
    assert after_assignment.status_code == 200
