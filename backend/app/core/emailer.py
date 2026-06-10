"""Shared SMTP email helper.

Reads the same SMTP_* environment variables used by the report-email
feature in visits_dashboard: SMTP_HOST, SMTP_PORT, SMTP_USERNAME,
SMTP_PASSWORD, SMTP_FROM (or SMTP_EMAIL/STMP_EMAIL), SMTP_USE_TLS,
SMTP_USE_SSL.
"""

from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import HTTPException


def smtp_configured() -> bool:
    smtp_from = (
        os.getenv("SMTP_FROM", "").strip()
        or os.getenv("SMTP_EMAIL", "").strip()
        or os.getenv("STMP_EMAIL", "").strip()
        or os.getenv("SMTP_USERNAME", "").strip()
    )
    return bool(os.getenv("SMTP_HOST", "").strip() and smtp_from)


def send_email(to: list[str], subject: str, text_body: str, html_body: str | None = None, reply_to: str | None = None) -> None:
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USERNAME", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_from = (
        os.getenv("SMTP_FROM", "").strip()
        or os.getenv("SMTP_EMAIL", "").strip()
        or os.getenv("STMP_EMAIL", "").strip()
        or smtp_user
    )
    smtp_use_tls_raw = os.getenv("SMTP_USE_TLS", "").strip().lower()
    smtp_use_ssl_raw = os.getenv("SMTP_USE_SSL", "").strip().lower()
    smtp_use_tls = (smtp_port == 587) if smtp_use_tls_raw == "" else smtp_use_tls_raw in {"1", "true", "yes"}
    smtp_use_ssl = (smtp_port == 465) if smtp_use_ssl_raw == "" else smtp_use_ssl_raw in {"1", "true", "yes"}

    if not smtp_host or not smtp_from:
        raise HTTPException(status_code=400, detail="SMTP is not configured. Set SMTP_HOST and SMTP_FROM (or SMTP_EMAIL).")

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = smtp_from
    message["To"] = ", ".join(to)
    if reply_to:
        message["Reply-To"] = reply_to
    message.attach(MIMEText(text_body, "plain"))
    if html_body:
        message.attach(MIMEText(html_body, "html"))

    try:
        smtp_client_cls = smtplib.SMTP_SSL if smtp_use_ssl else smtplib.SMTP
        with smtp_client_cls(smtp_host, smtp_port, timeout=20) as server:
            if not smtp_use_ssl:
                try:
                    server.ehlo()
                except Exception:
                    pass
                if smtp_use_tls:
                    if getattr(server, "has_extn", lambda *_args: False)("starttls"):
                        server.starttls()
                        try:
                            server.ehlo()
                        except Exception:
                            pass
                    else:
                        raise HTTPException(
                            status_code=500,
                            detail="SMTP server does not support STARTTLS. Set SMTP_USE_TLS=false or use a TLS-capable port.",
                        )
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, to, message.as_string())
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {exc}") from exc
