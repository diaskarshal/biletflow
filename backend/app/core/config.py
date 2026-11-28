from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPO_ROOT_ENV_FILE, extra="ignore", hide_input_in_errors=True, env_ignore_empty=True
    )

    database_url: str = "postgresql+psycopg://biletflow:biletflow@localhost:5432/biletflow"
    jwt_secret: str = "dev-secret-change-me-32-bytes-minimum-for-hs256"
    jwt_access_minutes: int = 30
    jwt_refresh_days: int = 30
    smtp_host: str = "localhost"
    smtp_enabled: bool = True
    smtp_port: int = 1025
    smtp_username: str = ""
    smtp_password: str = ""
    email_from: str = "no-reply@biletflow.kz"
    frontend_url: str = "http://localhost:5173"
    uploads_dir: Path = Path(__file__).resolve().parents[2] / "uploads"
    uploads_backend: Literal["local", "vercel_blob"] = "local"
    vercel: bool = False
    vercel_env: str = ""

    @field_validator("database_url")
    @classmethod
    def use_psycopg(cls, value: str) -> str:
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix):]
        return value

    @model_validator(mode="after")
    def validate_deployment(self) -> "Settings":
        if not self.vercel or self.vercel_env == "development":
            return self
        database = urlsplit(self.database_url)
        if database.scheme != "postgresql+psycopg" or database.hostname in (
            None, "localhost", "127.0.0.1", "::1", "postgres"
        ):
            raise ValueError("Set DATABASE_URL to a hosted PostgreSQL database")
        if len(self.jwt_secret) < 32 or self.jwt_secret.startswith("dev-secret"):
            raise ValueError("Set JWT_SECRET to a random secret of at least 32 characters")
        frontend = urlsplit(self.frontend_url)
        if frontend.scheme != "https" or not frontend.hostname or frontend.hostname == "localhost":
            raise ValueError("Set FRONTEND_URL to the public HTTPS website URL")
        if self.uploads_backend != "vercel_blob":
            raise ValueError("Set UPLOADS_BACKEND=vercel_blob for persistent uploads on Vercel")
        return self


settings = Settings()
