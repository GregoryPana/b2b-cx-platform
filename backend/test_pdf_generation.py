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
    print(f"Payload summary:")
    print(f"  - Visits: {len(payload.get('visit_details', []))}")
    print(f"  - Businesses: {len(payload.get('business_breakdown', []))}")
    print(f"  - Summary: {payload.get('summary')}")

    pdf_bytes = render_report_pdf(payload, "Test User")
    print(f"[OK] PDF generated successfully")
    print(f"     Size: {len(pdf_bytes)} bytes")
    print(f"     Valid PDF: {pdf_bytes.startswith(b'%PDF')}")

    if len(pdf_bytes) < 3000:
        print(f"[WARNING] PDF is very small ({len(pdf_bytes)} bytes) - may be empty content")

    # Write test PDF to verify
    with open("test_report.pdf", "wb") as f:
        f.write(pdf_bytes)
    print(f"     Saved to: test_report.pdf")

    # Check PDF structure
    print(f"\nPDF Analysis:")
    print(f"  - Starts with: {pdf_bytes[:10]}")
    print(f"  - Contains 'endstream': {b'endstream' in pdf_bytes}")
    print(f"  - Contains 'showpage': {b'showpage' in pdf_bytes}")
    print(f"  - Stream count: {pdf_bytes.count(b'stream')}")

except Exception as e:
    print(f"[ERROR] {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
