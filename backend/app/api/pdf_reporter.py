"""PDF report generation by rendering the report HTML with headless Chromium.

The report PDF is produced from the exact same HTML returned by
``render_report_html`` so the downloaded/emailed PDF is a faithful, per-report-type
copy of the dashboard HTML view (cards, SVG charts, tables and all).

Rendering runs through Playwright's *sync* API. The report endpoints are sync
FastAPI handlers, so FastAPI executes them in a worker thread with no running
asyncio event loop — which is exactly what the sync API requires. To stay safe
even if called from a thread that does have a loop, the actual work is dispatched
to a dedicated thread.
"""

from __future__ import annotations

import threading
from typing import Any


# A4 landscape print geometry. Landscape gives the wide action-point / analytics
# tables room so cells wrap far less, and its >900px width keeps the report's
# desktop multi-column grid layout instead of collapsing to the responsive
# tablet layout. Margins are kept small so the 1200px-max-width ``.page``
# container has room to breathe.
_PDF_MARGIN = {"top": "8mm", "right": "8mm", "bottom": "8mm", "left": "8mm"}

# Server-friendly Chromium flags. --no-sandbox is required when launching as a
# non-root service account without user-namespace sandboxing.
_CHROMIUM_ARGS = [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
]


def _render(html: str) -> bytes:
    """Render an HTML string to PDF bytes using headless Chromium (sync API)."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(args=_CHROMIUM_ARGS)
        try:
            page = browser.new_page()
            # The report HTML is fully self-contained (inline CSS + inline SVG),
            # so there are no network requests to wait on.
            page.set_content(html, wait_until="load")
            # Emulate screen media so the report keeps its on-screen styling
            # (the HTML has no dedicated @media print rules).
            page.emulate_media(media="screen")
            pdf_bytes = page.pdf(
                format="A4",
                landscape=True,
                print_background=True,
                margin=_PDF_MARGIN,
                prefer_css_page_size=False,
            )
            return pdf_bytes
        finally:
            browser.close()


def html_to_pdf(html: str) -> bytes:
    """Convert report HTML to PDF, isolating Playwright on its own thread.

    Running in a fresh thread guarantees there is no active asyncio event loop in
    scope, which the Playwright sync API forbids.
    """
    result: dict[str, Any] = {}

    def _worker() -> None:
        try:
            result["pdf"] = _render(html)
        except Exception as exc:  # noqa: BLE001 - surfaced to caller below
            result["error"] = exc

    thread = threading.Thread(target=_worker, name="pdf-render", daemon=True)
    thread.start()
    thread.join()

    if "error" in result:
        raise result["error"]

    pdf_bytes = result.get("pdf")
    if not pdf_bytes:
        raise ValueError("PDF generation produced no output")
    return pdf_bytes
