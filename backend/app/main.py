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
from app.modules.auth.router import router as auth_router
from app.modules.checkin.router import router as checkin_router
from app.modules.events.router import router as events_router
from app.modules.orders.router import router as orders_router
from app.modules.tickets.router import router as tickets_router

app = FastAPI(title="BiletFlow API")

app.middleware("http")(request_id_middleware)
app.add_exception_handler(APIError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(events_router, prefix="/api/v1")
app.include_router(tickets_router, prefix="/api/v1")
app.include_router(orders_router, prefix="/api/v1")
app.include_router(checkin_router, prefix="/api/v1")


class HealthResponse(BaseModel):
    status: str
    db: str


@app.get("/health")
def health() -> HealthResponse:
    db_status = "ok"
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"
    return HealthResponse(status="ok", db=db_status)
