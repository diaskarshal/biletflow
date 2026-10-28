from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import text

from app.core.config import settings
from app.core.errors import (
    APIError,
    api_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from app.core.logging import request_id_middleware
from app.db.session import SessionLocal
from app.modules.admin.router import router as admin_router
from app.modules.analytics.router import router as analytics_router
from app.modules.auth.router import router as auth_router
from app.modules.checkin.router import router as checkin_router
from app.modules.events.router import router as events_router
from app.modules.orders.router import router as orders_router
from app.modules.payments.router import router as payments_router
from app.modules.promos.router import router as promos_router
from app.modules.support.router import router as support_router
from app.modules.tickets.router import router as tickets_router

app = FastAPI(title="BiletFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.middleware("http")(request_id_middleware)
app.add_exception_handler(APIError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

settings.uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")

app.include_router(auth_router, prefix="/api/v1")
app.include_router(events_router, prefix="/api/v1")
app.include_router(tickets_router, prefix="/api/v1")
app.include_router(orders_router, prefix="/api/v1")
app.include_router(checkin_router, prefix="/api/v1")
app.include_router(payments_router, prefix="/api/v1")
app.include_router(promos_router, prefix="/api/v1")
app.include_router(support_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")


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
