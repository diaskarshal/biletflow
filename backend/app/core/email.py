import logging
import mimetypes
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("biletflow")


def send_email(
    to: str, subject: str, body: str, attachments: dict[str, bytes] | None = None
) -> None:
    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    for filename, data in (attachments or {}).items():
        maintype, subtype = mimetypes.guess_type(filename)[0].split("/")
        message.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_username:
                smtp.starttls()
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    except OSError as exc:
        logger.warning("email to %s failed: %s", to, exc)
