import io
from types import SimpleNamespace

import pytest
from fastapi import UploadFile
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError

from app.core import storage
from app.core.config import Settings, settings
from app.core.errors import APIError
from app.modules.events.service import save_cover


def deployment_settings(**overrides):
    values = {
        "vercel": True,
        "vercel_env": "production",
        "database_url": "postgresql://user:encoded%40password@db.example.com/biletflow?sslmode=require",
        "jwt_secret": "a" * 48,
        "frontend_url": "https://biletflow.example.com",
        "uploads_backend": "vercel_blob",
    }
    return Settings(_env_file=None, **(values | overrides))


def test_hosted_database_uses_installed_psycopg_driver():
    value = deployment_settings().database_url
    assert value.startswith("postgresql+psycopg://")
    assert "encoded%40password" in value and value.endswith("?sslmode=require")


@pytest.mark.parametrize("overrides", [
    {"jwt_secret": ""},
    {"jwt_secret": "dev-secret-change-me-32-bytes-minimum-for-hs256"},
    {"database_url": "postgresql://user:password@localhost/biletflow"},
    {"frontend_url": "http://localhost:5173"},
    {"uploads_backend": "local"},
])
def test_vercel_rejects_development_settings(overrides):
    with pytest.raises(ValidationError):
        deployment_settings(**overrides)


def test_vercel_cover_upload_uses_persistent_storage_without_disk_writes(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "uploads_backend", "vercel_blob")
    monkeypatch.setattr(settings, "uploads_dir", tmp_path / "read-only")
    calls = []

    def put(pathname, data, **options):
        calls.append((pathname, data, options))
        return SimpleNamespace(url="https://store.public.blob.vercel-storage.com/covers/image.png")

    monkeypatch.setattr(storage.blob, "put_blob", put)
    image = io.BytesIO()
    Image.new("RGB", (2, 2)).save(image, format="PNG")
    image.seek(0)
    url = save_cover(UploadFile(filename="image.png", file=image))
    assert url == "https://store.public.blob.vercel-storage.com/covers/image.png"
    assert not settings.uploads_dir.exists()
    assert calls[0][0].startswith("covers/")
    assert calls[0][2]["access"] == "public"
    assert calls[0][2]["content_type"] == "image/png"


def test_local_cover_urls_remain_compatible(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "uploads_backend", "local")
    monkeypatch.setattr(settings, "uploads_dir", tmp_path)
    assert storage.save_cover_bytes("cover.png", b"image", "image/png") == "/uploads/cover.png"
    assert (tmp_path / "cover.png").read_bytes() == b"image"


def test_storage_failure_is_reported_without_exposing_provider_details(monkeypatch):
    monkeypatch.setattr(settings, "uploads_backend", "vercel_blob")

    def fail(*args, **kwargs):
        raise storage.blob.BlobError("private provider details")

    monkeypatch.setattr(storage.blob, "put_blob", fail)
    with pytest.raises(APIError) as error:
        storage.save_cover_bytes("cover.png", b"image", "image/png")
    assert error.value.status_code == 503
    assert error.value.code == "UPLOAD_UNAVAILABLE"
    assert "private" not in error.value.message


def test_health_returns_failure_when_database_is_unavailable(monkeypatch):
    from app import main

    def unavailable():
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(main, "SessionLocal", unavailable)
    response = TestClient(main.app).get("/health")
    assert response.status_code == 503
    assert response.json() == {"status": "error", "db": "error"}
