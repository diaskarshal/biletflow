import mimetypes
import smtplib
from email.message import EmailMessage

from app.core.config import settings


def send_email(
    to: str, subject: str, body: str, attachments: dict[str, bytes] | None = None
) -> None:
    message = EmailMessage()
    message["From"] = "no-reply@biletflow.kz"
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    for filename, data in (attachments or {}).items():
        maintype, subtype = mimetypes.guess_type(filename)[0].split("/")
        message.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=5) as smtp:
            smtp.send_message(message)
    except OSError:
        pass
