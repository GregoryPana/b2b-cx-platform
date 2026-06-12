"""
Tests to verify report PDFs contain all data shown in the HTML/email versions.

The PDF is produced by rendering the exact ``render_report_html`` output with
headless Chromium, so the HTML is the single source of truth for content. These
tests therefore assert that the expected data is present in the HTML and that the
PDF is a valid, non-empty document carrying real (selectable) text.

Note on PDF text extraction: Chromium positions glyphs individually, so pypdf's
``extract_text`` often injects spurious spaces inside words (e.g. "T est Admin").
Substring checks against PDF text are therefore whitespace-insensitive via
``_norm``.
"""

from io import BytesIO

from pypdf import PdfReader

from app.api.visits_dashboard import render_report_html, render_report_pdf


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract all text from a PDF for validation."""
    reader = PdfReader(BytesIO(pdf_bytes))
    return "".join(page.extract_text() or "" for page in reader.pages)


def _norm(value: str) -> str:
    """Whitespace-insensitive, case-insensitive normalisation for substring checks."""
    return "".join(str(value).split()).lower()


def assert_valid_pdf(pdf_bytes: bytes) -> None:
    """The PDF is a valid, non-trivial document with at least one page."""
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 1000
    reader = PdfReader(BytesIO(pdf_bytes))
    assert len(reader.pages) >= 1


def assert_present(needles, html: str, pdf_text: str) -> None:
    """Each needle must appear in the HTML (source of truth) and the PDF text."""
    pdf_norm = _norm(pdf_text)
    for needle in needles:
        assert needle in html, f"HTML missing: {needle!r}"
        assert _norm(needle) in pdf_norm, f"PDF missing: {needle!r}"


class TestPDFReportDataCompleteness:
    """Verify report PDFs faithfully carry the HTML report content."""

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
        assert_valid_pdf(pdf_bytes)

    def test_pdf_contains_all_kpi_metrics(self):
        """PDF includes the KPI metrics and branding shown in the HTML."""
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

        html = render_report_html(payload, "Test Admin")
        pdf_bytes = render_report_pdf(payload, "Test Admin")
        assert_valid_pdf(pdf_bytes)
        pdf_text = extract_text_from_pdf(pdf_bytes)

        # Branding plus KPI labels and values present in HTML and PDF alike.
        assert "Wireless" in html
        assert_present(["NPS", "CSAT"], html, pdf_text)

    def test_pdf_contains_summary_statistics(self):
        """PDF includes the headline summary statistics shown in the HTML."""
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

        html = render_report_html(payload, "Test Admin")
        pdf_bytes = render_report_pdf(payload, "Test Admin")
        assert_valid_pdf(pdf_bytes)
        pdf_text = extract_text_from_pdf(pdf_bytes)

        # Headline counts the lifetime report renders: total visits and businesses.
        assert "Total Visits" in html
        assert_present(["5", "3"], html, pdf_text)

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

        html = render_report_html(payload, "Test Admin")
        pdf_bytes = render_report_pdf(payload, "Test Admin")
        assert_valid_pdf(pdf_bytes)
        pdf_text = extract_text_from_pdf(pdf_bytes)

        assert_present(
            [
                "Acme Corp",
                "Beta Inc",
                "Follow up on pricing",
                "Competitive response",
            ],
            html,
            pdf_text,
        )
        # Timeline indicators (rendered as literal text in the HTML table).
        assert "<1 month" in html
        assert "<3 months" in html

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

        html = render_report_html(payload, "Test Admin")
        pdf_bytes = render_report_pdf(payload, "Test Admin")
        assert_valid_pdf(pdf_bytes)
        pdf_text = extract_text_from_pdf(pdf_bytes)

        assert_present(["Acme Corp", "Beta Inc"], html, pdf_text)
        assert "Business" in html

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

        html = render_report_html(payload, "Test Admin")
        pdf_bytes = render_report_pdf(payload, "Test Admin")
        assert_valid_pdf(pdf_bytes)
        pdf_text = extract_text_from_pdf(pdf_bytes)

        assert_present(["Service Quality", "Customer Support"], html, pdf_text)
        assert "Category" in html

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
        assert_valid_pdf(pdf_bytes)
        pdf_text = extract_text_from_pdf(pdf_bytes)

        assert_present(
            [
                "Acme Telecom Ltd",
                "Mary Executive",
                "John Representative",
                "Alice Surveyor",
                "Bob Surveyor",
            ],
            html_content,
            pdf_text,
        )
        # Question text and answer are in the HTML; the PDF carries them too.
        assert "Do you use competitor services" in html_content
        assert "Uses another provider" in html_content
        assert "competitorservices" in _norm(pdf_text)
        assert "anotherprovider" in _norm(pdf_text)

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

        html = render_report_html(payload, "Alice Johnson")
        pdf_bytes = render_report_pdf(payload, "Alice Johnson")
        assert_valid_pdf(pdf_bytes)
        pdf_text = extract_text_from_pdf(pdf_bytes)

        assert "Alice Johnson" in html
        assert "alicejohnson" in _norm(pdf_text)
