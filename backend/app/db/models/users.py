from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str]
    full_name: Mapped[str]
    is_admin: Mapped[bool] = mapped_column(default=False, server_default=false())
    email_verified_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    deleted_at: Mapped[datetime | None]


class OrganizerProfile(Base):
    __tablename__ = "organizer_profiles"
    __table_args__ = (
        CheckConstraint(
            "verification_status in ('none','pending','approved','rejected')",
            name="ck_organizer_profiles_verification_status",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    display_name: Mapped[str]
    contact_email: Mapped[str]
    phone: Mapped[str | None]
    verification_status: Mapped[str] = mapped_column(default="none")
    verification_document: Mapped[str | None]
    payout_account: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
