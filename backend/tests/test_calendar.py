import uuid

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve

client = TestClient(app)


def test_calendar_export_follows_event_lifecycle():
    email = f"cal-{uuid.uuid4().hex[:8]}@test.kz"
    client.post("/api/v1/auth/register", json={"email": email, "password": "password123", "full_name": "Cal"})
    token = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"}).json()
    org = {"Authorization": f"Bearer {token['access_token']}"}
    event = client.post(
        "/api/v1/events",
        headers=org,
        json={
            "title": "Jazz, wine; and " + "long title " * 8,
            "starts_at": "2026-12-01T13:00:00Z",
            "ends_at": "2026-12-01T15:00:00Z",
            "venue_name": "Hall",
            "venue_address": "Abay 1, Almaty",
            "ticket_types": [{"name": "Free", "price_kzt": 0, "quantity_total": 10}],
        },
    ).json()
    url = f"/api/v1/events/{event['slug']}/calendar.ics"
    assert client.get(url).status_code == 404

    client.post(f"/api/v1/events/{event['id']}/publish", headers=org)
    approve(event["id"])
    first = client.get(url)
    assert first.headers["content-type"].startswith("text/calendar")
    body = first.text
    unfolded = body.replace("\r\n ", "")
    assert all(len(line.encode()) <= 75 for line in body.split("\r\n"))
    assert f"UID:event-{event['id']}@biletflow" in body
    assert "DTSTART;TZID=Asia/Almaty:20261201T180000" in body
    assert "TZOFFSETTO:+0500" in body
    assert r"SUMMARY:Jazz\, wine\; and long title" in unfolded
    assert r"LOCATION:Hall\, Abay 1\, Almaty" in unfolded
    assert f"/events/{event['slug']}" in unfolded
    assert "SEQUENCE:0" in body and "STATUS:CONFIRMED" in body

    client.patch(f"/api/v1/events/{event['id']}", headers=org, json={"venue_name": "Big hall"})
    assert "SEQUENCE:1" in client.get(url).text

    client.post(f"/api/v1/events/{event['id']}/cancel", headers=org)
    cancelled = client.get(url).text
    assert "STATUS:CANCELLED" in cancelled and "SEQUENCE:2" in cancelled
    assert f"UID:event-{event['id']}@biletflow" in cancelled
