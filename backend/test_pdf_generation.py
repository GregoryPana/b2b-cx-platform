#!/usr/bin/env python
"""Test PDF generation to diagnose blank PDF issue."""

from app.api.visits_dashboard import render_report_pdf
import sys

# Create minimal test payload
payload = {
    "filters": {"report_type": "lifetime", "survey_type": "B2B"},
    "summary": {
        "total_visits": 5,
        "total_businesses": 3,
        "total_responses": 42,
        "average_score": 8.2,
        "status_counts": {"Approved": 3},
    },
    "analytics_comparison": {
        "nps": {"selected": 45, "overall": 42},
        "csat": {"selected": 82, "overall": 80},
        "relationship_score": {"selected": 4.2, "overall": 4.0},
        "competitor_exposure": {"selected": 12, "overall": 18},
    },
    "analytics_selected": {"nps": {"promoters": 0, "passives": 0, "detractors": 0}, "customer_satisfaction": {"score_distribution": {}}},
    "analytics_overall": {},
    "yes_no_comparison": [],
    "category_comparison": [],
    "action_points": [],
    "selected_visit_info": {},
    "survey_question_details": [],
    "daily_breakdown": [],
    "business_breakdown": [],
    "visit_details": [],
    "pending_visits": [],
}

try:
    print("Testing PDF generation...")
    pdf_bytes = render_report_pdf(payload, "Test User")
    print(f"[OK] PDF generated successfully")
    print(f"     Size: {len(pdf_bytes)} bytes")
    print(f"     Valid PDF: {pdf_bytes.startswith(b'%PDF')}")

    if len(pdf_bytes) < 1000:
        print(f"[WARNING] PDF is very small ({len(pdf_bytes)} bytes)")

    # Write test PDF to verify
    with open("test_report.pdf", "wb") as f:
        f.write(pdf_bytes)
    print(f"     Saved to: test_report.pdf")

    # Check first 500 bytes
    print(f"\nFirst 200 bytes (hex):")
    print(f"{pdf_bytes[:200].hex()}")

except Exception as e:
    print(f"[ERROR] {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
