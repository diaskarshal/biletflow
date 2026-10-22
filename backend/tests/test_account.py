import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth import service as auth_service

client = TestClient(app)


def _token_from(body: str, path: str) -> str:
    return body.split(f"/{path}?token=")[1].split()[0]


def _login(email: str, password: str):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_verification_reset_and_profile(monkeypatch):
    sent = []
    monkeypatch.setattr(auth_service, "send_email", lambda to, subject, body: sent.append((to, body)))
    email = f"acct-{uuid.uuid4().hex[:8]}@test.kz"
    client.post("/api/v1/auth/register", json={"email": email, "password": "password123", "full_name": "Old Name"})
    [(to, body)] = sent
    assert to == email
    verified = client.post("/api/v1/auth/verify-email", json={"token": _token_from(body, "verify-email")}).json()
    assert verified["email_verified_at"] is not None

    assert client.post("/api/v1/auth/forgot-password", json={"email": "nobody@test.kz"}).status_code == 204
    assert len(sent) == 1
    assert client.post("/api/v1/auth/forgot-password", json={"email": email}).status_code == 204
    assert client.post("/api/v1/auth/forgot-password", json={"email": email}).status_code == 204
    assert len(sent) == 2
    reset_token = _token_from(sent[-1][1], "reset-password")
    assert client.post("/api/v1/auth/reset-password", json={"token": reset_token, "password": "short"}).status_code == 422
    assert client.post("/api/v1/auth/reset-password", json={"token": reset_token, "password": "newpassword1"}).status_code == 204
    reused = client.post("/api/v1/auth/reset-password", json={"token": reset_token, "password": "another123"})
    assert reused.json()["error"]["code"] == "INVALID_TOKEN"
    assert _login(email, "password123").status_code == 401
    headers = {"Authorization": f"Bearer {_login(email, 'newpassword1').json()['access_token']}"}

    wrong = client.post("/api/v1/me/password", headers=headers, json={"current_password": "nope", "new_password": "third12345"})
    assert wrong.json()["error"]["code"] == "WRONG_PASSWORD"
    other_session = _login(email, "newpassword1").json()
    changed = client.post("/api/v1/me/password", headers=headers, json={"current_password": "newpassword1", "new_password": "third12345"}).json()
    assert client.get("/api/v1/me", headers=headers).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": other_session["refresh_token"]}).status_code == 401
    headers = {"Authorization": f"Bearer {changed['access_token']}"}
    assert client.get("/api/v1/me", headers=headers).status_code == 200
    assert _login(email, "third12345").status_code == 200

    assert client.patch("/api/v1/me", headers=headers, json={"full_name": " New Name "}).json()["full_name"] == "New Name"
    assert client.patch("/api/v1/me", headers=headers, json={"full_name": "   "}).status_code == 422
