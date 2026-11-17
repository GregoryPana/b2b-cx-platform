"""Optional walkthrough-video attachment for enrollment emails.

OFF by default. Nothing changes for any email unless ALL of these are set on the
backend that sends the email (the internal backend):

  ENROLLMENT_VIDEO_ATTACH=true
  ENROLLMENT_VIDEO_DIR=/path/to/folder/with/the/videos      (on the sending VM's disk)
  ENROLLMENT_VIDEO_FILES=enrollment-desktop-email.mp4,enrollment-mobile-email.mp4
  ENROLLMENT_VIDEO_MAX_MB=12                                 (optional; total raw size cap)

If it is enabled but misconfigured (missing file, too big, unsafe name) the
email is still sent WITHOUT the video and without any mention of one: a missing
video must never block an enrollment. The reason is logged.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from .emailer import EmailAttachment

logger = logging.getLogger(__name__)

_MIME = {".mp4": "video/mp4", ".webm": "video/webm", ".vtt": "text/vtt"}


def _enabled() -> bool:
    return os.getenv("ENROLLMENT_VIDEO_ATTACH", "").strip().lower() in {"1", "true", "yes"}


def load_enrollment_video_attachments() -> list[EmailAttachment]:
    """Return the attachments to send, or [] when disabled or not possible."""
    if not _enabled():
        return []
    directory = os.getenv("ENROLLMENT_VIDEO_DIR", "").strip()
    names = [n.strip() for n in os.getenv("ENROLLMENT_VIDEO_FILES", "").split(",") if n.strip()]
    if not directory or not names:
        logger.warning("Enrollment video attachment enabled but ENROLLMENT_VIDEO_DIR/FILES not set; sending without video.")
        return []
    try:
        max_bytes = int(float(os.getenv("ENROLLMENT_VIDEO_MAX_MB", "12")) * 1024 * 1024)
    except ValueError:
        max_bytes = 12 * 1024 * 1024

    base = Path(directory).resolve()
    attachments: list[EmailAttachment] = []
    total = 0
    for name in names:
        # Plain file names only: no paths, no traversal.
        if Path(name).name != name or name.startswith("."):
            logger.warning("Enrollment video file name %r is not a plain file name; sending without video.", name)
            return []
        path = (base / name).resolve()
        if path.parent != base or not path.is_file():
            logger.warning("Enrollment video file %s not found in %s; sending without video.", name, base)
            return []
        mime = _MIME.get(path.suffix.lower())
        if not mime:
            logger.warning("Enrollment video file %s has an unsupported type; sending without video.", name)
            return []
        data = path.read_bytes()
        total += len(data)
        if total > max_bytes:
            logger.warning("Enrollment video attachments exceed %d bytes; sending without video.", max_bytes)
            return []
        attachments.append((name, data, mime))
    return attachments
