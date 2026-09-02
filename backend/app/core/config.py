from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT_ENV_FILE, extra="ignore")

    database_url: str = "postgresql+psycopg://biletflow:biletflow@localhost:5432/biletflow"
    jwt_secret: str = "dev-secret-change-me-32-bytes-minimum-for-hs256"
    jwt_access_minutes: int = 30
    jwt_refresh_days: int = 30
    smtp_host: str = "localhost"
    smtp_port: int = 1025


settings = Settings()
