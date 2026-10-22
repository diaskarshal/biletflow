import io
import secrets
from datetime import UTC, datetime
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import APIError
from app.db.models import Event, Order, OrderItem, PromoCampaign, TicketType, User

FONT = Path(__file__).resolve().parents[2] / "assets" / "fonts" / "DejaVuSans-Bold.ttf"


def campaign_link(campaign: PromoCampaign, event: Event) -> str:
    return f"{settings.frontend_url}/events/{event.slug}?promo={campaign.token}"


def create_campaign(db: Session, actor: User, event: Event, data: dict) -> PromoCampaign:
    code = (data.pop("code") or secrets.token_hex(4)).upper()
    if db.query(PromoCampaign).filter_by(event_id=event.id, code=code).one_or_none() is not None:
        raise APIError("PROMO_CODE_TAKEN", "This event already has this promo code", status_code=409)
    if data["ticket_type_ids"]:
        own = {t.id for t in db.query(TicketType).filter_by(event_id=event.id)}
        if not set(data["ticket_type_ids"]) <= own:
            raise APIError("INVALID_TICKET_TYPE", "Ticket type does not belong to this event", status_code=400)
    campaign = PromoCampaign(event_id=event.id, code=code, token=secrets.token_urlsafe(16), **data)
    db.add(campaign)
    db.flush()
    audit.record(
        db, actor, "promo.created", "promo_campaign", campaign.id, event.id,
        f"Created promo {code} ({campaign.discount_value}{'%' if campaign.discount_type == 'percent' else ' KZT'} off)",
    )
    db.commit()
    db.refresh(campaign)
    return campaign


def get_campaign_or_404(db: Session, campaign_id: int) -> PromoCampaign:
    campaign = db.get(PromoCampaign, campaign_id)
    if campaign is None:
        raise APIError("PROMO_NOT_FOUND", "Promo campaign not found", status_code=404)
    return campaign


def disable_campaign(db: Session, actor: User, campaign: PromoCampaign) -> PromoCampaign:
    campaign.disabled_at = campaign.disabled_at or datetime.now(UTC)
    audit.record(
        db, actor, "promo.disabled", "promo_campaign", campaign.id, campaign.event_id,
        f"Disabled promo {campaign.code}",
    )
    db.commit()
    db.refresh(campaign)
    return campaign


def list_campaigns(db: Session, event: Event) -> list[dict]:
    campaigns = db.query(PromoCampaign).filter_by(event_id=event.id).order_by(PromoCampaign.id).all()
    orders = {
        row[0]: row[1:]
        for row in db.query(
            Order.promo_campaign_id,
            func.count(Order.id),
            func.coalesce(func.sum(Order.subtotal_kzt), 0),
            func.coalesce(func.sum(Order.discount_kzt), 0),
            func.coalesce(func.sum(Order.total_kzt), 0),
        )
        .filter(Order.event_id == event.id, Order.status == "paid", Order.promo_campaign_id.is_not(None))
        .group_by(Order.promo_campaign_id)
    }
    tickets = dict(
        db.query(Order.promo_campaign_id, func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(OrderItem, OrderItem.order_id == Order.id)
        .filter(Order.event_id == event.id, Order.status == "paid", Order.promo_campaign_id.is_not(None))
        .group_by(Order.promo_campaign_id)
    )
    result = []
    for c in campaigns:
        count, gross, discount, net = orders.get(c.id, (0, 0, 0, 0))
        result.append(
            {
                "id": c.id,
                "event_id": c.event_id,
                "name": c.name,
                "code": c.code,
                "link": campaign_link(c, event),
                "discount_type": c.discount_type,
                "discount_value": c.discount_value,
                "valid_from": c.valid_from,
                "valid_until": c.valid_until,
                "max_redemptions": c.max_redemptions,
                "redemptions": c.redemptions,
                "ticket_type_ids": c.ticket_type_ids,
                "disabled": c.disabled_at is not None,
                "orders": count,
                "tickets_sold": tickets.get(c.id, 0),
                "gross_kzt": gross,
                "discount_kzt": discount,
                "net_kzt": net,
            }
        )
    return result


def find_active(db: Session, event_id: int, code: str | None = None, token: str | None = None) -> PromoCampaign:
    query = db.query(PromoCampaign).filter_by(event_id=event_id)
    if token:
        campaign = query.filter_by(token=token).one_or_none()
    else:
        campaign = query.filter_by(code=(code or "").strip().upper()).one_or_none()
    if campaign is None:
        raise APIError("PROMO_NOT_FOUND", "This promo code does not exist for this event", status_code=404)
    now = datetime.now(UTC)
    if campaign.disabled_at is not None:
        raise APIError("PROMO_DISABLED", "This promo code is no longer active", status_code=409)
    if campaign.valid_from and campaign.valid_from > now:
        raise APIError("PROMO_NOT_STARTED", "This promo code is not valid yet", status_code=409)
    if campaign.valid_until and campaign.valid_until < now:
        raise APIError("PROMO_EXPIRED", "This promo code has expired", status_code=409)
    if campaign.max_redemptions is not None and campaign.redemptions >= campaign.max_redemptions:
        raise APIError("PROMO_EXHAUSTED", "This promo code has been fully used", status_code=409)
    return campaign


def discount_for(campaign: PromoCampaign, lines: list[tuple[TicketType, int]]) -> int:
    applicable = sum(
        tt.price_kzt * qty
        for tt, qty in lines
        if campaign.ticket_type_ids is None or tt.id in campaign.ticket_type_ids
    )
    if applicable == 0:
        raise APIError(
            "PROMO_NOT_APPLICABLE", "This promo code does not apply to the selected tickets", status_code=409
        )
    if campaign.discount_type == "percent":
        return applicable * campaign.discount_value // 100
    return min(campaign.discount_value, applicable)


def redeem(db: Session, campaign_id: int) -> None:
    result = db.execute(
        update(PromoCampaign)
        .where(
            PromoCampaign.id == campaign_id,
            PromoCampaign.disabled_at.is_(None),
            PromoCampaign.max_redemptions.is_(None)
            | (PromoCampaign.redemptions < PromoCampaign.max_redemptions),
        )
        .values(redemptions=PromoCampaign.redemptions + 1)
    )
    if result.rowcount == 0:
        raise APIError("PROMO_EXHAUSTED", "This promo code has been fully used", status_code=409)


def release(db: Session, campaign_id: int) -> None:
    db.execute(
        update(PromoCampaign)
        .where(PromoCampaign.id == campaign_id)
        .values(redemptions=PromoCampaign.redemptions - 1)
    )


def campaign_qr_png(campaign: PromoCampaign, event: Event) -> bytes:
    code = qrcode.QRCode()
    code.add_data(campaign_link(campaign, event))
    qr = code.make_image(fill_color="#7a1010", back_color="white").get_image().convert("RGB")
    caption_height = 70
    image = Image.new("RGB", (qr.width, qr.height + caption_height), "white")
    image.paste(qr, (0, 0))
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(FONT), 22)
    for i, text in enumerate((f"PROMO {campaign.code}", "Not an entry ticket")):
        width = draw.textlength(text, font=font)
        draw.text(((qr.width - width) / 2, qr.height - 10 + i * 30), text, fill="#7a1010", font=font)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()
