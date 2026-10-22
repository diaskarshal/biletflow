import csv
import io
from datetime import UTC, datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import APIError
from app.db.models import (
    Event,
    EventReport,
    Order,
    OrganizerProfile,
    Payment,
    PromoCampaign,
    Setting,
    User,
)

ACTIVATION_FEE_KEY = "activation_fee_kzt"


def get_activation_fee(db: Session) -> int:
    setting = db.get(Setting, ACTIVATION_FEE_KEY)
    return int(setting.value) if setting else 5000


def set_activation_fee(db: Session, amount_kzt: int) -> int:
    setting = db.get(Setting, ACTIVATION_FEE_KEY) or Setting(key=ACTIVATION_FEE_KEY, value="")
    setting.value = str(amount_kzt)
    db.add(setting)
    db.commit()
    return amount_kzt


def list_organizers(db: Session, status: str | None) -> list[dict]:
    query = db.query(OrganizerProfile, User).join(User, User.id == OrganizerProfile.user_id)
    if status:
        query = query.filter(OrganizerProfile.verification_status == status)
    return [
        {
            "id": profile.id,
            "display_name": profile.display_name,
            "email": user.email,
            "verification_status": profile.verification_status,
            "verification_document": profile.verification_document,
            "payout_account": profile.payout_account,
        }
        for profile, user in query.order_by(OrganizerProfile.id).all()
    ]


def decide_verification(db: Session, actor: User, organizer_id: int, status: str) -> None:
    profile = db.get(OrganizerProfile, organizer_id)
    if profile is None:
        raise APIError("ORGANIZER_NOT_FOUND", "Organizer not found", status_code=404)
    profile.verification_status = status
    audit.record(
        db, actor, f"verification.{status}", "organizer_profile", profile.id, None,
        f"Verification {status} for {profile.display_name}",
    )
    db.commit()


def _order_rows(db: Session, *filters, limit: int | None = 200) -> list[dict]:
    rows = (
        db.query(Order, Event.title, User.email)
        .join(Event, Event.id == Order.event_id)
        .join(User, User.id == Order.user_id)
        .filter(*filters)
        .order_by(Order.id.desc())
        .limit(limit)
    )
    return [
        {
            "id": o.id,
            "event_title": title,
            "buyer_email": email,
            "status": o.status,
            "total_kzt": o.total_kzt,
            "created_at": o.created_at,
        }
        for o, title, email in rows
    ]


def payment_rows(db: Session, *filters, limit: int | None = 200) -> list[dict]:
    rows = (
        db.query(Payment, Event.title, User.email)
        .join(Event, Event.id == Payment.event_id)
        .join(User, User.id == Payment.user_id)
        .filter(*filters)
        .order_by(Payment.id.desc())
        .limit(limit)
    )
    return [
        {
            "id": p.id,
            "purpose": p.purpose,
            "event_title": title,
            "user_email": email,
            "amount_kzt": p.amount_kzt,
            "status": p.status,
            "created_at": p.created_at,
        }
        for p, title, email in rows
    ]


def search(db: Session, q: str) -> dict:
    q = q.strip()
    like = f"%{q}%"
    number = int(q) if q.isdecimal() else -1
    users = (
        db.query(User).filter(or_(User.email.ilike(like), User.full_name.ilike(like))).order_by(User.id.desc()).limit(20)
    )
    events = (
        db.query(Event).filter(or_(Event.title.ilike(like), Event.slug.ilike(like))).order_by(Event.id.desc()).limit(20)
    )
    return {
        "users": [
            {"id": u.id, "email": u.email, "full_name": u.full_name, "is_admin": u.is_admin, "suspended": u.suspended_at is not None}
            for u in users
        ],
        "events": [
            {"id": e.id, "title": e.title, "slug": e.slug, "status": e.status, "suspended": e.suspended_at is not None}
            for e in events
        ],
        "orders": _order_rows(db, or_(Order.id == number, User.email.ilike(like)), limit=20),
        "payments": payment_rows(db, or_(Payment.id == number, User.email.ilike(like)), limit=20),
    }


def set_user_suspended(db: Session, actor: User, user_id: int, suspended: bool) -> None:
    user = db.get(User, user_id)
    if user is None:
        raise APIError("USER_NOT_FOUND", "User not found", status_code=404)
    if user.id == actor.id:
        raise APIError("CANNOT_SUSPEND_SELF", "You cannot suspend your own account", status_code=409)
    user.suspended_at = datetime.now(UTC) if suspended else None
    audit.record(
        db, actor, "user.suspended" if suspended else "user.restored", "user", user.id, None,
        f"{'Suspended' if suspended else 'Restored'} {user.email}",
    )
    db.commit()


def set_event_suspended(db: Session, actor: User, event: Event, suspended: bool) -> None:
    event.suspended_at = datetime.now(UTC) if suspended else None
    if suspended:
        db.query(EventReport).filter_by(event_id=event.id, resolved_at=None).update({"resolved_at": datetime.now(UTC)})
    audit.record(
        db, actor, "event.suspended" if suspended else "event.restored", "event", event.id, event.id,
        f"{'Suspended' if suspended else 'Restored'} the event (platform admin)",
    )
    db.commit()


def report_event(db: Session, user: User, event: Event, reason: str) -> None:
    open_report = db.query(EventReport).filter_by(event_id=event.id, reporter_id=user.id, resolved_at=None).first()
    if open_report is None:
        db.add(EventReport(event_id=event.id, reporter_id=user.id, reason=reason))
    else:
        open_report.reason = reason
    db.commit()


def list_reports(db: Session) -> list[dict]:
    rows = (
        db.query(EventReport, Event, User.email)
        .join(Event, Event.id == EventReport.event_id)
        .join(User, User.id == EventReport.reporter_id)
        .filter(EventReport.resolved_at.is_(None))
        .order_by(EventReport.id.desc())
        .limit(200)
    )
    return [
        {
            "id": r.id,
            "event_id": e.id,
            "event_title": e.title,
            "event_suspended": e.suspended_at is not None,
            "reporter_email": email,
            "reason": r.reason,
            "created_at": r.created_at,
        }
        for r, e, email in rows
    ]


def dismiss_report(db: Session, actor: User, report_id: int) -> None:
    report = db.get(EventReport, report_id)
    if report is None:
        raise APIError("REPORT_NOT_FOUND", "Report not found", status_code=404)
    report.resolved_at = report.resolved_at or datetime.now(UTC)
    audit.record(db, actor, "report.dismissed", "event_report", report.id, report.event_id, "Dismissed a report")
    db.commit()


def list_promos(db: Session) -> list[dict]:
    rows = (
        db.query(PromoCampaign, Event.title)
        .join(Event, Event.id == PromoCampaign.event_id)
        .order_by(PromoCampaign.id.desc())
        .limit(200)
    )
    return [
        {
            "id": c.id,
            "event_title": title,
            "code": c.code,
            "name": c.name,
            "discount_type": c.discount_type,
            "discount_value": c.discount_value,
            "redemptions": c.redemptions,
            "max_redemptions": c.max_redemptions,
            "disabled": c.disabled_at is not None,
            "created_at": c.created_at,
        }
        for c, title in rows
    ]


def export_csv(db: Session, kind: str) -> str:
    rows = _order_rows(db, limit=None) if kind == "orders" else payment_rows(db, limit=None)
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0]) if rows else ["id"])
    writer.writeheader()
    writer.writerows({k: _safe_cell(v) for k, v in row.items()} for row in rows)
    return buf.getvalue()


def _safe_cell(value: object) -> object:
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return value
