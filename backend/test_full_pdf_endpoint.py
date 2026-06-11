#!/usr/bin/env python
"""Test full PDF endpoint to diagnose blank PDF issue."""

import sys
sys.path.insert(0, 'app')

from api.visits_dashboard import build_report_payload, render_report_pdf, render_report_html
from core.database import get_db, SessionLocal

# Create a session
db = SessionLocal()

try:
    print("Testing full PDF endpoint flow...")

    # Build payload as the endpoint would
    print("1. Building report payload...")
    payload = build_report_payload(
        db,
        report_type="lifetime",
        survey_type="B2B",
        business_id=None,
        visit_id=None,
        report_date=None,
        date_from=None,
        date_to=None
    )

    print(f"   Payload keys: {list(payload.keys())}")
    print(f"   Summary: {payload.get('summary')}")
    print(f"   Visit count: {len(payload.get('visit_details', []))}")
    print(f"   Business count: {len(payload.get('business_breakdown', []))}")

    # Test HTML rendering
    print("\n2. Testing HTML rendering...")
    html_content = render_report_html(payload, "Test User")
    print(f"   HTML size: {len(html_content)} characters")
    print(f"   HTML contains 'Cable': {'Cable' in html_content}")
    print(f"   HTML contains 'CWSCX': {'CWSCX' in html_content}")

    # Test PDF rendering
    print("\n3. Testing PDF rendering...")
    pdf_bytes = render_report_pdf(payload, "Test User")
    print(f"   PDF size: {len(pdf_bytes)} bytes")
    print(f"   Valid PDF: {pdf_bytes.startswith(b'%PDF')}")

    with open("test_full_report.pdf", "wb") as f:
        f.write(pdf_bytes)
    print(f"   Saved to: test_full_report.pdf")

    print("\nTest completed successfully!")

except Exception as e:
    print(f"[ERROR] {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
finally:
    db.close()
