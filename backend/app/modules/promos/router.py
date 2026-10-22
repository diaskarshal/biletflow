from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import Event, User
from app.modules.events import service as events_service
from app.modules.promos import service
from app.modules.promos.schemas import CampaignCreate, CampaignOut, PromoPreview

router = APIRouter(tags=["promos"])


def _campaign_out(db: Session, event: Event, campaign_id: int) -> dict:
    return next(c for c in service.list_campaigns(db, event) if c["id"] == campaign_id)


@router.post("/events/{event_id}/campaigns", response_model=CampaignOut, status_code=201)
def create_campaign(
    event_id: int,
    body: CampaignCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    event = events_service.get_event_or_404(db, event_id)
    events_service.require_owner(db, user, event)
    campaign = service.create_campaign(db, user, event, body.model_dump())
    return _campaign_out(db, event, campaign.id)


@router.get("/events/{event_id}/campaigns", response_model=list[CampaignOut])
def list_campaigns(
    event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    event = events_service.get_event_or_404(db, event_id)
    events_service.require_owner(db, user, event)
    return service.list_campaigns(db, event)


@router.post("/campaigns/{campaign_id}/disable", response_model=CampaignOut)
def disable_campaign(
    campaign_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    campaign = service.get_campaign_or_404(db, campaign_id)
    event = events_service.get_event_or_404(db, campaign.event_id)
    events_service.require_owner(db, user, event)
    service.disable_campaign(db, user, campaign)
    return _campaign_out(db, event, campaign.id)


@router.get("/campaigns/{campaign_id}/qr")
def campaign_qr(
    campaign_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    campaign = service.get_campaign_or_404(db, campaign_id)
    event = events_service.get_event_or_404(db, campaign.event_id)
    events_service.require_owner(db, user, event)
    return Response(content=service.campaign_qr_png(campaign, event), media_type="image/png")


@router.get("/events/{event_id}/promo", response_model=PromoPreview)
def preview_promo(
    event_id: int, code: str | None = None, token: str | None = None, db: Session = Depends(get_db)
) -> dict:
    campaign = service.find_active(db, event_id, code=code, token=token)
    return {
        "code": campaign.code,
        "discount_type": campaign.discount_type,
        "discount_value": campaign.discount_value,
        "ticket_type_ids": campaign.ticket_type_ids,
    }
