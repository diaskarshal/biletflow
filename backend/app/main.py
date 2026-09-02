from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
from sqlalchemy import text

from app.core.errors import (
    APIError,
    api_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from app.core.logging import request_id_middleware
from app.db.session import SessionLocal

app = FastAPI(title="BiletFlow API")

app.middleware("http")(request_id_middleware)
app.add_exception_handler(APIError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)


class HealthResponse(BaseModel):
    status: str
    db: str


@app.get("/health")
def health() -> HealthResponse:
    db_status = "ok"
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - health check must report, never raise
        db_status = "error"
    return HealthResponse(status="ok", db=db_status)
