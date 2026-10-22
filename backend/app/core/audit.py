from sqlalchemy.orm import Session

from app.db.models import AuditLog, User


def record(
    db: Session,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: int,
    event_id: int | None,
    description: str,
    payload: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor.id if actor else None,
            action_type=action,
            entity_type=entity_type,
            entity_id=entity_id,
            event_id=event_id,
            description=description,
            payload=payload,
        )
    )
