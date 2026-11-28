import logging

from vercel.blob import sync as blob

from app.core.config import settings
from app.core.errors import APIError

logger = logging.getLogger("biletflow")


def save_cover_bytes(
    name: str, data: bytes, content_type: str, *, overwrite: bool = False
) -> str:
    if settings.uploads_backend == "local":
        settings.uploads_dir.mkdir(parents=True, exist_ok=True)
        (settings.uploads_dir / name).write_bytes(data)
        return f"/uploads/{name}"

    try:
        uploaded = blob.put_blob(
            f"covers/{name}",
            data,
            access="public",
            content_type=content_type,
            allow_overwrite=overwrite,
        )
    except blob.BlobError as exc:
        logger.warning("Cover upload failed (%s)", type(exc).__name__)
        raise APIError(
            "UPLOAD_UNAVAILABLE", "Image storage is temporarily unavailable", status_code=503
        ) from exc
    return uploaded.url
