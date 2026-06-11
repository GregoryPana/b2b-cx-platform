from app.api.installation_surveys import build_installation_report_filename, render_installation_report_pdf
from app.api.mystery_shopper import build_mystery_report_filename, render_mystery_report_pdf
from app.api.visits_dashboard import build_b2b_report_filename, render_report_pdf


def test_b2b_report_filename_includes_platform_type_scope_and_dates():
    payload = {
        "filters": {"report_type": "action_points", "survey_type": "B2B", "business_id": 42, "date_from": "2026-06-01", "date_to": "2026-06-10"},
        "action_points": [{"business_name": "Acme Telecom Ltd", "action_status": "Outstanding"}],
        "business_breakdown": [{"business_name": "Acme Telecom Ltd"}],
        "selected_visit_info": {},
    }

    filename = build_b2b_report_filename(payload, "pdf")

    assert filename.endswith(".pdf")
    assert "b2b" in filename
    assert "action-points-report" in filename
    assert "acme-telecom-ltd" in filename
    assert "2026-06-01-to-2026-06-10" in filename


def test_mystery_report_filename_includes_platform_type_scope_and_date():
    payload = {
        "filters": {"report_type": "survey", "location_id": 8},
        "selected_visit_info": {"location_name": "Half Way Tree", "visit_date": "2026-06-10"},
        "visit_details": [],
    }

    filename = build_mystery_report_filename(payload, "html")

    assert filename.endswith(".html")
    assert "mystery-shopper" in filename
    assert "selected-location-report" in filename
    assert "half-way-tree" in filename
    assert "2026-06-10" in filename


def test_installation_report_filename_includes_type_scope_and_date():
    payload = {
        "filters": {"report_type": "survey", "survey_id": "abc"},
        "survey_detail": {"location": "Portmore", "customer_name": "Jane Doe", "date_work_done": "2026-06-09"},
    }

    filename = build_installation_report_filename(payload, "pdf")

    assert filename.endswith(".pdf")
    assert "installation" in filename
    assert "single-survey-report" in filename
    assert "portmore" in filename
    assert "2026-06-09" in filename


def test_pdf_renderers_generate_pdf_bytes():
    b2b_payload = {
        "filters": {"report_type": "survey", "survey_type": "B2B"},
        "summary": {"total_visits": 1, "total_businesses": 1, "total_responses": 4, "average_score": 8.5},
        "analytics_comparison": {"nps": {"selected": 50, "overall": 42}, "csat": {"selected": 82, "overall": 80}, "relationship_score": {"selected": 4.2, "overall": 4.0}, "competitor_exposure": {"selected": 12, "overall": 18}},
        "selected_visit_info": {"business_name": "Acme Telecom Ltd", "visit_date": "2026-06-10", "status": "Approved", "team_member_names": ["A", "B"]},
        "action_points": [],
        "survey_question_details": [],
        "visit_details": [],
    }
    mystery_payload = {
        "filters": {"report_type": "survey", "location_id": 3},
        "summary": {"total_visits": 1, "total_locations": 1, "average_score": 4.4},
        "mystery_metrics": {"selected_nps": 60, "selected_csat": 4.5, "selected_overall_experience": 4.4, "selected_quality": 4.2},
        "selected_visit_info": {"location_name": "Half Way Tree", "visit_date": "2026-06-10", "status": "Approved", "purpose_of_visit": "Audit"},
        "survey_question_details": [],
        "visit_details": [],
    }
    installation_payload = {
        "filters": {"report_type": "survey", "survey_id": "abc"},
        "summary": {"total_surveys": 1, "overall_average_score": 4.2},
        "survey_detail": {"customer_name": "Jane Doe", "location": "Portmore", "date_work_done": "2026-06-09", "inspector_name": "Inspector", "job_done_by": "Field Team", "overall_score": 4.2, "responses": []},
        "customer_type_averages": [],
        "worker_type_averages": [],
        "category_averages": [],
        "question_averages": [],
        "monthly_trend": [],
        "scoring_range": "1-5",
    }

    assert render_report_pdf(b2b_payload, "Admin").startswith(b"%PDF")
    assert render_mystery_report_pdf(mystery_payload, "Admin").startswith(b"%PDF")
    assert render_installation_report_pdf(installation_payload, "Admin").startswith(b"%PDF")
