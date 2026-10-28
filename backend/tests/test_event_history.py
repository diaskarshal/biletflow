import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.db.models import Event
from app.db.session import SessionLocal
from app.main import app
from app.modules.events import service as events_service

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


def test_unpublish_duplicate_and_activity(monkeypatch):
    sent = []
    monkeypatch.setattr(events_service, "send_email", lambda to, subject, body: sent.append((to, subject, body)))
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
        json={"event_id": event_id, "items": [{"ticket_type_id": event["ticket_types"][0]["id"], "quantity": 2, "attendees": [{"name": "A", "email": "a@test.kz"}] * 2}]},
    )
    shrink = client.patch(f"/api/v1/ticket-types/{event['ticket_types'][0]['id']}", headers=org, json={"quantity_total": 1})
    assert shrink.json()["error"]["code"] == "CAPACITY_BELOW_SOLD"
    assert client.post(f"/api/v1/events/{event_id}/unpublish", headers=org).json()["error"]["code"] == "EVENT_HAS_ORDERS"
    client.patch(f"/api/v1/events/{event_id}", headers=org, json={"description": "Bring a friend", "venue_address": ""})
    assert sent == []
    assert client.patch(f"/api/v1/events/{event_id}", headers=org, json={"title": "   "}).status_code == 422
    client.patch(f"/api/v1/events/{event_id}", headers=org, json={"venue_name": "Big hall"})
    [(to, subject, body)] = sent
    assert (to, subject) == ("a@test.kz", f"Update: {event['title']}")
    assert "Where: Big hall" in body and "01 Dec 2026, 18:00" in body

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
    assert [h["action_type"] for h in history] == ["event.updated", "event.updated", "event.published", "event.created"]
    assert history[1]["description"] == "Changed description"
    assert history[0]["actor_name"] == "organizer" and history[0]["description"] == "Changed venue_name"
    assert [h["action_type"] for h in client.get(f"{url}?action=event.pub", headers=org).json()] == ["event.published"]
    tomorrow = (datetime.now(UTC) + timedelta(days=2)).date().isoformat()
    assert client.get(f"{url}?date_from={tomorrow}", headers=org).json() == []


def test_public_listing_pages_cover_every_event():
    seen, cursor = [], None
    while True:
        page = client.get("/api/v1/events", params={"limit": 7, **({"cursor": cursor} if cursor else {})}).json()
        seen += [e["id"] for e in page["items"]]
        cursor = page["next_cursor"]
        if cursor is None:
            break
    with SessionLocal() as db:
        expected = [
            e.id
            for e in db.query(Event).filter(Event.status == "published", Event.deleted_at.is_(None), Event.suspended_at.is_(None))
        ]
    assert sorted(seen) == sorted(expected)


def test_cover_upload():
    import io

    from PIL import Image

    org, _ = _login("uploader")
    png = io.BytesIO()
    Image.new("RGB", (40, 50), "navy").save(png, format="PNG")
    uploaded = client.post("/api/v1/uploads/cover", headers=org, files={"image": ("cover.png", png.getvalue(), "image/png")})
    assert uploaded.status_code == 201
    url = uploaded.json()["url"]
    assert url.endswith(".png")
    assert client.get(url).content == png.getvalue()

    text = client.post("/api/v1/uploads/cover", headers=org, files={"image": ("notes.txt", b"hello", "text/plain")})
    assert text.json()["error"]["code"] == "INVALID_IMAGE"
    assert client.post("/api/v1/uploads/cover", files={"image": ("cover.png", png.getvalue(), "image/png")}).status_code == 401
