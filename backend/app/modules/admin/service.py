from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import APIError
from app.db.models import OrganizerProfile, Setting, User

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
