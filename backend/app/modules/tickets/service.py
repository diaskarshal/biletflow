import io
import secrets
from pathlib import Path
from zoneinfo import ZoneInfo

import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import APIError
from app.db.models import Event, Order, OrderItem, OrganizerProfile, Ticket, TicketType, User

FONTS = Path(__file__).resolve().parents[2] / "assets" / "fonts"
pdfmetrics.registerFont(TTFont("DejaVu", FONTS / "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DejaVu-Bold", FONTS / "DejaVuSans-Bold.ttf"))


def create_ticket_type(db: Session, event: Event, data: dict) -> TicketType:
    ticket_type = TicketType(event_id=event.id, **data)
    db.add(ticket_type)
    db.commit()
    db.refresh(ticket_type)
    return ticket_type


def list_ticket_types(db: Session, event: Event) -> list[TicketType]:
    return db.query(TicketType).filter_by(event_id=event.id).order_by(TicketType.id).all()


def get_ticket_type_or_404(db: Session, ticket_type_id: int) -> TicketType:
    ticket_type = db.get(TicketType, ticket_type_id)
    if ticket_type is None:
        raise APIError("TICKET_TYPE_NOT_FOUND", "Ticket type not found", status_code=404)
    return ticket_type


def update_ticket_type(db: Session, actor: User, ticket_type: TicketType, data: dict) -> TicketType:
    taken = ticket_type.quantity_sold + ticket_type.quantity_reserved
    if data.get("quantity_total") is not None and data["quantity_total"] < taken:
        raise APIError(
            "CAPACITY_BELOW_SOLD", f"{taken} tickets are already sold or held for this type", status_code=409
        )
    changes = {
        field: f"{getattr(ticket_type, field)} -> {value}"
        for field, value in data.items()
        if value is not None and getattr(ticket_type, field) != value
    }
    for field, value in data.items():
        if value is not None:
            setattr(ticket_type, field, value)
    if changes:
        audit.record(
            db, actor, "ticket_type.updated", "ticket_type", ticket_type.id, ticket_type.event_id,
            f"Changed {ticket_type.name}: " + ", ".join(f"{k} {v}" for k, v in changes.items()),
            changes,
        )
    db.commit()
    db.refresh(ticket_type)
    return ticket_type


def reserve_inventory(db: Session, ticket_type_id: int, quantity: int, hold: bool = False) -> None:
    column = TicketType.quantity_reserved if hold else TicketType.quantity_sold
    result = db.execute(
        update(TicketType)
        .where(
            TicketType.id == ticket_type_id,
            TicketType.quantity_sold + TicketType.quantity_reserved + quantity <= TicketType.quantity_total,
        )
        .values({column: column + quantity})
    )
    if result.rowcount == 0:
        raise APIError(
            "INVENTORY_UNAVAILABLE", "Not enough tickets remaining for this ticket type", status_code=409
        )


def move_inventory(db: Session, ticket_type_id: int, sold: int = 0, reserved: int = 0) -> None:
    db.execute(
        update(TicketType)
        .where(TicketType.id == ticket_type_id)
        .values(
            quantity_sold=TicketType.quantity_sold + sold,
            quantity_reserved=TicketType.quantity_reserved + reserved,
        )
    )


def issue_ticket(
    db: Session,
    order_item_id: int,
    ticket_type_id: int,
    attendee_name: str,
    attendee_email: str,
    status: str = "valid",
) -> Ticket:
    ticket = Ticket(
        order_item_id=order_item_id,
        ticket_type_id=ticket_type_id,
        attendee_name=attendee_name,
        attendee_email=attendee_email,
        qr_token="T_" + secrets.token_urlsafe(32),
        status=status,
    )
    db.add(ticket)
    db.flush()
    return ticket


def get_ticket_or_404(db: Session, ticket_id: int) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise APIError("TICKET_NOT_FOUND", "Ticket not found", status_code=404)
    return ticket


def require_ticket_access(db: Session, ticket: Ticket, user: User) -> None:
    buyer_id = (
        db.query(Order.user_id)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .filter(OrderItem.id == ticket.order_item_id)
        .scalar()
    )
    if user.id == buyer_id or ticket.attendee_email == user.email:
        return
    ticket_type = db.get(TicketType, ticket.ticket_type_id)
    event = db.get(Event, ticket_type.event_id) if ticket_type else None
    if event is not None:
        organizer = db.query(OrganizerProfile).filter_by(user_id=user.id).one_or_none()
        if organizer is not None and organizer.id == event.organizer_id:
            return
    raise APIError("FORBIDDEN", "You cannot view this ticket", status_code=403)


def qr_png(ticket: Ticket) -> bytes:
    img = qrcode.make(ticket.qr_token)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def ticket_pdf(db: Session, ticket: Ticket) -> bytes:
    ticket_type = db.get(TicketType, ticket.ticket_type_id)
    event = db.get(Event, ticket_type.event_id)
    starts = event.starts_at.astimezone(ZoneInfo(event.display_timezone))
    venue = ", ".join(v for v in (event.venue_name, event.venue_address) if v) or "See event page"
    rows = [
        ("Date", f"{starts:%d %B %Y}"),
        ("Time", f"{starts:%H:%M} ({event.display_timezone})"),
        ("Venue", venue),
        ("Ticket type", ticket_type.name),
        ("Attendee", ticket.attendee_name),
        ("Ticket ID", f"#{ticket.id}"),
        ("Status", ticket.status.replace("_", " ")),
    ]

    buf = io.BytesIO()
    page = canvas.Canvas(buf, pagesize=A4)
    page.setTitle(f"Ticket #{ticket.id} - {event.title}")
    width, height = A4
    left, y = 20 * mm, height - 25 * mm
    page.setFont("DejaVu", 11)
    page.drawString(left, y, "BiletFlow ticket")
    y -= 12 * mm
    page.setFont("DejaVu-Bold", 22)
    for line in simpleSplit(event.title, "DejaVu-Bold", 22, width - 2 * left):
        page.drawString(left, y, line)
        y -= 9 * mm
    y -= 4 * mm
    for label, value in rows:
        page.setFont("DejaVu-Bold", 12)
        page.drawString(left, y, label)
        page.setFont("DejaVu", 12)
        for line in simpleSplit(value, "DejaVu", 12, width - left - 60 * mm):
            page.drawString(left + 40 * mm, y, line)
            y -= 7 * mm
    qr_size = 90 * mm
    y -= qr_size + 5 * mm
    page.drawImage(ImageReader(io.BytesIO(qr_png(ticket))), left, y, qr_size, qr_size)
    page.setFont("DejaVu", 10)
    page.drawString(left, y - 6 * mm, "Show this QR code at the entrance, printed or on your phone.")
    page.drawString(left, y - 11 * mm, "One ticket admits one person. Copies of this page share the same ticket.")
    page.showPage()
    page.save()
    return buf.getvalue()
