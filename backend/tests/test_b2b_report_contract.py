from pathlib import Path

from app.api.visits_dashboard import _smtp_config, render_report_html

Q18_TEXT = "Would you consider taking the same  competition services that you have now but with cws?"


def _survey_report_payload():
    return {
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
        "analytics_selected": {},
        "analytics_overall": {},
        "yes_no_comparison": [],
        "category_comparison": [],
        "action_points": [
            {
                "response_id": "536",
                "visit_date": "2026-06-10",
                "business_name": "Acme Telecom Ltd",
                "action_required": "Follow up on competitive offer",
                "action_owner": "CX Team",
                "action_timeframe": "<1 month",
                "action_status": "Outstanding",
                "action_support_needed": "Commercial pricing input",
                "action_comments": "High priority account",
            }
        ],
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
                "category": "Category 4: Competitive & Portfolio Intelligence",
                "question_text": "Do you currently use competitor services?",
                "input_type": "yes_no",
                "score_min": None,
                "score_max": None,
                "score": None,
                "answer_text": "Yes",
                "verbatim": "Uses another provider.",
                "actions": [],
            },
            {
                "question_id": 536,
                "question_number": 18,
                "category": "Category 4: Competitive & Portfolio Intelligence",
                "question_text": Q18_TEXT,
                "input_type": "yes_no",
                "score_min": None,
                "score_max": None,
                "score": None,
                "answer_text": "Yes",
                "verbatim": "Would consider switching.",
                "actions": [],
            },
            {
                "question_id": 519,
                "question_number": 19,
                "category": "Category 4: Competitive & Portfolio Intelligence",
                "question_text": "What would influence your decision?",
                "input_type": "text",
                "score_min": None,
                "score_max": None,
                "score": None,
                "answer_text": "Price and SLA",
                "verbatim": "Needs pricing clarity.",
                "actions": [],
            },
            {
                "question_id": 520,
                "question_number": 20,
                "category": "Category 4: Competitive & Portfolio Intelligence",
                "question_text": "Any additional feedback?",
                "input_type": "text",
                "score_min": None,
                "score_max": None,
                "score": None,
                "answer_text": "No",
                "verbatim": "No further comments.",
                "actions": [],
            },
        ],
        "daily_breakdown": [],
        "business_breakdown": [],
        "visit_details": [],
        "pending_visits": [],
        "single_visit_scores": {},
    }


def test_survey_report_html_highlights_required_context_without_business_id_or_q536():
    html = render_report_html(_survey_report_payload(), "CX Admin")

    assert "Survey Date" in html
    assert "2026-06-10" in html
    assert "Business" in html
    assert "Acme Telecom Ltd" in html
    assert "Mary Executive" in html
    assert "Alice Surveyor, Bob Surveyor" in html
    assert "Action Points" in html
    assert '<div class="label">Action Points</div><div class="context-value" style="color:#dc2626;">1</div>' in html

    assert "Business ID" not in html
    assert "Q536" not in html
    assert "Q17" in html
    assert "Q18" in html
    assert "Q19" in html
    assert "Q20" in html
    assert Q18_TEXT in html


def test_canonical_b2b_q18_wording_is_updated_in_runtime_sources():
    repo_root = Path(__file__).resolve().parents[2]
    files_that_drive_runtime_questions = [
        repo_root / "backend" / "app" / "api" / "survey.py",
        repo_root / "backend" / "scripts" / "seed.py",
        repo_root / "backend" / "alembic" / "versions" / "20260415_000016_add_b2b_competitor_switch_question.py",
        repo_root / "backend" / "alembic" / "versions" / "20260610_000024_update_b2b_q18_competitor_switch_wording.py",
        repo_root / "frontend" / "dashboard-blueprint" / "src" / "pages" / "DashboardPage.jsx",
    ]
    for path in files_that_drive_runtime_questions:
        text = path.read_text(encoding="utf-8")
        assert Q18_TEXT in text, f"{path} does not contain the canonical Q18 wording"


def test_report_question_contract_document_exists():
    repo_root = Path(__file__).resolve().parents[2]
    doc = repo_root / "docs" / "testing" / "b2b-report-survey-contract.md"
    assert doc.exists()
    text = doc.read_text(encoding="utf-8")
    assert "generated HTML" in text
    assert "actual survey questions" in text
    assert "fail" in text.lower()


def test_report_email_accepts_common_smtp_aliases(monkeypatch):
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("SMTP_FROM", raising=False)
    monkeypatch.setenv("MAIL_HOST", "smtp.cwsey.example")
    monkeypatch.setenv("MAIL_PORT", "2525")
    monkeypatch.setenv("MAIL_FROM", "cx-reports@example.com")
    monkeypatch.setenv("MAIL_USERNAME", "cx-user")
    monkeypatch.setenv("MAIL_PASSWORD", "cx-pass")
    monkeypatch.setenv("MAIL_USE_TLS", "false")

    config = _smtp_config()

    assert config["host"] == "smtp.cwsey.example"
    assert config["port"] == 2525
    assert config["from"] == "cx-reports@example.com"
    assert config["user"] == "cx-user"
    assert config["password"] == "cx-pass"
    assert config["use_tls"] is False
