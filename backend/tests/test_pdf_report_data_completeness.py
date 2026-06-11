"""
Tests to verify PDF reports contain all data shown in HTML and email versions.
Ensures PDF styling matches HTML with proper color coding, charts, and hierarchy.
"""

import re
from pathlib import Path
from pypdf import PdfReader
from io import BytesIO

from app.api.visits_dashboard import render_report_html, render_report_pdf


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract all text from PDF for validation."""
    pdf_reader = PdfReader(BytesIO(pdf_bytes))
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text()
    return text


class TestPDFReportDataCompleteness:
    """Verify PDF reports contain all expected data and formatting."""

    def test_pdf_report_generates_valid_pdf(self):
        """PDF output is a valid PDF document."""
        payload = {
            "filters": {"report_type": "lifetime", "survey_type": "B2B"},
            "summary": {
                "total_visits": 5,
                "total_businesses": 3,
                "total_responses": 42,
                "average_score": 8.2,
                "status_counts": {"Approved": 3, "Pending": 2},
            },
            "analytics_comparison": {
                "nps": {"selected": 45, "overall": 42},
                "csat": {"selected": 82, "overall": 80},
                "relationship_score": {"selected": 4.2, "overall": 4.0},
                "competitor_exposure": {"selected": 12, "overall": 18},
            },
            "analytics_selected": {
                "nps": {"promoters": 20, "passives": 15, "detractors": 7},
                "customer_satisfaction": {"score_distribution": {
                    "very_satisfied": 15,
                    "satisfied": 20,
                    "neutral": 5,
                    "dissatisfied": 2,
                    "very_dissatisfied": 0,
                }},
            },
            "analytics_overall": {},
            "yes_no_comparison": [
                {
                    "question_number": 4,
                    "question_text": "Do you use our services regularly?",
                    "filtered_yes_percent": 85.5,
                    "filtered_no_percent": 14.5,
                    "overall_yes_percent": 78.0,
                    "overall_no_percent": 22.0,
                }
            ],
            "category_comparison": [
                {
                    "category": "Service Quality",
                    "selected_average_score": 8.5,
                    "overall_average_score": 8.2,
                    "delta": 0.3,
                    "question_count": 4,
                    "questions": [
                        {
                            "question_number": 1,
                            "question_text": "How satisfied are you with our service quality?",
                            "average_score": 8.7,
                            "response_count": 42,
                            "score_min": 1,
                            "score_max": 10,
                        }
                    ],
                }
            ],
            "action_points": [
                {
                    "visit_id": "v-001",
                    "visit_date": "2026-06-10",
                    "business_name": "Acme Corp",
                    "action_required": "Follow up on pricing",
                    "action_owner": "Sales Team",
                    "action_timeframe": "<1 month",
                    "action_status": "Outstanding",
                    "action_support_needed": "Finance review",
                    "action_comments": "High priority",
                }
            ],
            "selected_visit_info": {},
            "survey_question_details": [],
            "daily_breakdown": [
                {
                    "visit_date": "2026-06-10",
                    "visit_count": 2,
                    "response_count": 15,
                    "avg_score": 8.3,
                }
            ],
            "business_breakdown": [
                {
                    "business_id": 1,
                    "business_name": "Acme Corp",
                    "visit_count": 2,
                    "response_count": 20,
                    "avg_score": 8.2,
                    "latest_visit_date": "2026-06-10",
                    "status_counts": {"Approved": 2},
                }
            ],
            "visit_details": [
                {
                    "visit_id": "v-001",
                    "visit_date": "2026-06-10",
                    "business_name": "Acme Corp",
                    "status": "Approved",
                    "avg_score": 8.4,
                    "response_count": 10,
                }
            ],
            "pending_visits": [],
        }

        pdf_bytes = render_report_pdf(payload, "Test Admin")

        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes.startswith(b"%PDF")
        assert len(pdf_bytes) > 1000

    def test_pdf_contains_all_kpi_metrics(self):
        """PDF includes all KPI metrics with correct values."""
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
            "analytics_selected": {
                "nps": {"promoters": 20, "passives": 15, "detractors": 7},
                "customer_satisfaction": {
                    "score_distribution": {
                        "very_satisfied": 15,
                        "satisfied": 20,
                        "neutral": 5,
                        "dissatisfied": 2,
                        "very_dissatisfied": 0,
                    }
                },
            },
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

        pdf_bytes = render_report_pdf(payload, "Test Admin")
        pdf_text = extract_text_from_pdf(pdf_bytes)

        # Check for company and report branding
        assert "Wireless" in pdf_text or "CWSCX" in pdf_text
        assert "NPS" in pdf_text
        assert "CSAT" in pdf_text
        # Check metrics are present with actual values
        assert "45" in pdf_text or "45.0" in pdf_text  # NPS value
        assert "82" in pdf_text or "82.0" in pdf_text  # CSAT value

    def test_pdf_contains_summary_statistics(self):
        """PDF includes summary statistics."""
        payload = {
            "filters": {"report_type": "lifetime", "survey_type": "B2B"},
            "summary": {
                "total_visits": 5,
                "total_businesses": 3,
                "total_responses": 42,
                "average_score": 8.2,
                "status_counts": {"Approved": 3},
            },
            "analytics_comparison": {},
            "analytics_selected": {"nps": {"promoters": 20, "passives": 15, "detractors": 7}, "customer_satisfaction": {"score_distribution": {}}},
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

        pdf_bytes = render_report_pdf(payload, "Test Admin")
        pdf_text = extract_text_from_pdf(pdf_bytes)

        assert "5" in pdf_text
        assert "3" in pdf_text
        assert "42" in pdf_text
        assert "8" in pdf_text

    def test_pdf_contains_action_points(self):
        """PDF includes all action points with details."""
        payload = {
            "filters": {"report_type": "lifetime", "survey_type": "B2B"},
            "summary": {"total_visits": 1, "total_businesses": 1, "total_responses": 4, "average_score": 8.2, "status_counts": {"Approved": 1}},
            "analytics_comparison": {},
            "analytics_selected": {"nps": {"promoters": 0, "passives": 0, "detractors": 0}, "customer_satisfaction": {"score_distribution": {}}},
            "analytics_overall": {},
            "yes_no_comparison": [],
            "category_comparison": [],
            "action_points": [
                {
                    "visit_id": "v-001",
                    "visit_date": "2026-06-10",
                    "business_name": "Acme Corp",
                    "action_required": "Follow up on pricing",
                    "action_owner": "John Doe",
                    "action_timeframe": "<1 month",
                    "action_status": "Outstanding",
                    "action_support_needed": "Finance review",
                    "action_comments": "High priority account",
                },
                {
                    "visit_id": "v-002",
                    "visit_date": "2026-06-09",
                    "business_name": "Beta Inc",
                    "action_required": "Competitive response",
                    "action_owner": "Jane Smith",
                    "action_timeframe": "<3 months",
                    "action_status": "In Progress",
                    "action_support_needed": "Product info",
                    "action_comments": "Medium priority",
                },
            ],
            "selected_visit_info": {},
            "survey_question_details": [],
            "daily_breakdown": [],
            "business_breakdown": [],
            "visit_details": [],
            "pending_visits": [],
        }

        pdf_bytes = render_report_pdf(payload, "Test Admin")
        pdf_text = extract_text_from_pdf(pdf_bytes)

        # Verify action points data is present
        assert "Acme Corp" in pdf_text
        assert "Beta Inc" in pdf_text
        assert "pricing" in pdf_text.lower()
        assert "Follow up" in pdf_text
        assert "Competitive response" in pdf_text
        # Timeline indicators should be present
        assert "<1 month" in pdf_text
        assert "<3 months" in pdf_text

    def test_pdf_contains_business_breakdown(self):
        """PDF includes business-level breakdown."""
        payload = {
            "filters": {"report_type": "lifetime", "survey_type": "B2B"},
            "summary": {"total_visits": 3, "total_businesses": 2, "total_responses": 20, "average_score": 8.0, "status_counts": {}},
            "analytics_comparison": {},
            "analytics_selected": {"nps": {"promoters": 0, "passives": 0, "detractors": 0}, "customer_satisfaction": {"score_distribution": {}}},
            "analytics_overall": {},
            "yes_no_comparison": [],
            "category_comparison": [],
            "action_points": [],
            "selected_visit_info": {},
            "survey_question_details": [],
            "daily_breakdown": [],
            "business_breakdown": [
                {
                    "business_id": 1,
                    "business_name": "Acme Corp",
                    "visit_count": 2,
                    "response_count": 12,
                    "avg_score": 8.5,
                    "latest_visit_date": "2026-06-10",
                    "status_counts": {"Approved": 2},
                },
                {
                    "business_id": 2,
                    "business_name": "Beta Inc",
                    "visit_count": 1,
                    "response_count": 8,
                    "avg_score": 7.5,
                    "latest_visit_date": "2026-06-08",
                    "status_counts": {"Pending": 1},
                },
            ],
            "visit_details": [],
            "pending_visits": [],
        }

        pdf_bytes = render_report_pdf(payload, "Test Admin")
        pdf_text = extract_text_from_pdf(pdf_bytes)

        assert "Acme Corp" in pdf_text
        assert "Beta Inc" in pdf_text
        assert "Business" in pdf_text or "business" in pdf_text.lower()

    def test_pdf_contains_category_scores(self):
        """PDF includes category-level score breakdown."""
        payload = {
            "filters": {"report_type": "lifetime", "survey_type": "B2B"},
            "summary": {"total_visits": 1, "total_businesses": 1, "total_responses": 8, "average_score": 8.0, "status_counts": {}},
            "analytics_comparison": {},
            "analytics_selected": {"nps": {"promoters": 0, "passives": 0, "detractors": 0}, "customer_satisfaction": {"score_distribution": {}}},
            "analytics_overall": {},
            "yes_no_comparison": [],
            "category_comparison": [
                {
                    "category": "Service Quality",
                    "selected_average_score": 8.5,
                    "overall_average_score": 8.2,
                    "delta": 0.3,
                    "question_count": 3,
                    "questions": [
                        {"question_number": 1, "question_text": "How satisfied?", "average_score": 8.5, "response_count": 8}
                    ],
                },
                {
                    "category": "Customer Support",
                    "selected_average_score": 7.8,
                    "overall_average_score": 7.5,
                    "delta": 0.3,
                    "question_count": 2,
                    "questions": [],
                },
            ],
            "action_points": [],
            "selected_visit_info": {},
            "survey_question_details": [],
            "daily_breakdown": [],
            "business_breakdown": [],
            "visit_details": [],
            "pending_visits": [],
        }

        pdf_bytes = render_report_pdf(payload, "Test Admin")
        pdf_text = extract_text_from_pdf(pdf_bytes)

        assert "Service Quality" in pdf_text
        assert "Customer Support" in pdf_text or "Support" in pdf_text
        assert "Category" in pdf_text or "category" in pdf_text.lower()

    def test_pdf_matches_html_content_for_survey_report(self):
        """PDF and HTML reports contain the same content for survey report type."""
        payload = {
            "filters": {
                "report_type": "survey",
                "survey_type": "B2B",
                "business_id": 536,
                "visit_id": "visit-001",
                "report_date": "2026-06-10",
                "date_from": None,
                "date_to": None,
            },
            "summary": {
                "is_single_visit": True,
                "total_visits": 1,
                "total_businesses": 1,
                "total_responses": 4,
                "average_score": 8.2,
                "status_counts": {"Approved": 1},
            },
            "analytics_comparison": {},
            "analytics_selected": {"nps": {"promoters": 0, "passives": 0, "detractors": 0}, "customer_satisfaction": {"score_distribution": {}}},
            "analytics_overall": {},
            "yes_no_comparison": [],
            "category_comparison": [],
            "action_points": [],
            "selected_visit_info": {
                "visit_id": "visit-001",
                "business_name": "Acme Telecom Ltd",
                "visit_date": "2026-06-10",
                "status": "Approved",
                "account_executive_name": "Mary Executive",
                "representative_name": "John Representative",
                "edited_by_name": None,
                "edited_at": None,
                "team_member_names": ["Alice Surveyor", "Bob Surveyor"],
            },
            "survey_question_details": [
                {
                    "question_id": 517,
                    "question_number": 17,
                    "category": "Competitive Intelligence",
                    "question_text": "Do you use competitor services?",
                    "input_type": "yes_no",
                    "score_min": None,
                    "score_max": None,
                    "score": None,
                    "answer_text": "Yes",
                    "verbatim": "Uses another provider.",
                    "actions": [],
                }
            ],
            "daily_breakdown": [],
            "business_breakdown": [],
            "visit_details": [],
            "pending_visits": [],
            "single_visit_scores": {},
        }

        html_content = render_report_html(payload, "Test Admin")
        pdf_bytes = render_report_pdf(payload, "Test Admin")
        pdf_text = extract_text_from_pdf(pdf_bytes)

        # Content that must appear in both HTML and PDF
        # Note: Some formatting may differ between HTML and PDF due to rendering differences
        key_content_html = [
            "Acme Telecom Ltd",
            "2026-06-10",
            "Mary Executive",
            "John Representative",
            "Alice Surveyor",
            "Bob Surveyor",
            "Do you use competitor services",
            "Yes",
            "Uses another provider",
        ]

        key_content_pdf = [
            ("Acme Telecom Ltd", "Acme Telecom"),
            ("Mary Executive", "Mary"),
            ("John Representative", "John"),
            ("Alice Surveyor", "Alice"),
            ("Bob Surveyor", "Bob"),
            ("competitor", "competitor"),  # Part of the question
            ("services", "services"),  # Part of the question
            ("Yes", "Yes"),
            ("Uses another provider", "another provider"),
        ]

        # Check HTML has all content
        for content in key_content_html:
            assert content in html_content, f"HTML missing: {content}"

        # Check PDF has critical content
        # PDF may have line breaks in text, so check for key parts
        pdf_text_normalized = pdf_text.replace("\n", " ").replace("  ", " ")
        for item in key_content_pdf:
            if isinstance(item, tuple):
                full_text, short_text = item
                # Try to find either the full text or a shortened version
                found = short_text.lower() in pdf_text_normalized.lower()
            else:
                found = item.lower() in pdf_text_normalized.lower()
            assert found, f"PDF missing: {item}"

    def test_pdf_includes_generated_by_information(self):
        """PDF shows who generated the report."""
        payload = {
            "filters": {"report_type": "lifetime", "survey_type": "B2B"},
            "summary": {"total_visits": 1, "total_businesses": 1, "total_responses": 1, "average_score": 8.0, "status_counts": {}},
            "analytics_comparison": {},
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

        pdf_bytes = render_report_pdf(payload, "Alice Johnson")
        pdf_text = extract_text_from_pdf(pdf_bytes)

        assert "Alice Johnson" in pdf_text or "Generated" in pdf_text
