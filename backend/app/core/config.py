from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://biletflow:biletflow@localhost:5432/biletflow"
    jwt_secret: str = "dev-secret-change-me-32-bytes-minimum-for-hs256"
    jwt_access_minutes: int = 30
    jwt_refresh_days: int = 30
    smtp_host: str = "localhost"
    smtp_port: int = 1025


settings = Settings()
