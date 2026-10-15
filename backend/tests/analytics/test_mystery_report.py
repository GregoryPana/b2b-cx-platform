"""Mystery Shopper report payload: selected vs lifetime filters, single visit, populations, scales."""

from __future__ import annotations

import pytest
from sqlalchemy import text

import scenarios as S


@pytest.fixture()
def ns(fx):
    return S.seed_two_modules(fx)


def payload(db, report_type="lifetime", location_id=None, visit_id=None, report_date=None, date_from=None, date_to=None):
    from app.api.mystery_shopper import build_mystery_report_payload

    return build_mystery_report_payload(db, report_type, location_id, visit_id, report_date, date_from, date_to)


def by_visit(result):
    return {row["visit_id"]: row for row in result["visit_details"]}


def test_lifetime_inventory_vs_scored_population(db, ns):
    result = payload(db)
    summary = result["summary"]
    # Inventory keeps every status; the scored KPI population is Approved only.
    assert summary["total_visits"] == 7
    assert summary["approved_visits"] == 3
    assert summary["visit_status_counts"] == {"Approved": 3, "Draft": 1, "Pending": 1, "Rejected": 1, "Needs Changes": 1}
    assert summary["total_locations"] == 2
    assert summary["kpi_population"] == "approved_only"
    assert summary["inventory_population"] == "all_statuses"
    assert [r["counts_in_kpis"] for r in result["visit_details"] if r["status"] != "Approved"] == [False] * 4


def test_lifetime_headline_metrics(db, ns):
    metrics = payload(db)["mystery_metrics"]
    assert metrics["selected_nps"] == -33.33 and metrics["overall_nps"] == -33.33
    assert metrics["selected_csat"] == 7.67 and metrics["overall_csat"] == 7.67
    # Overall Experience keeps its existing definition: pooled mean of the three
    # "Overall Experience (CSAT & NPS)" questions (NPS included): (0+7+8 + 4+8+9 + 6+10+9) / 9
    assert metrics["selected_overall_experience"] == 6.78
    # Quality = non-overall questions scored on the 1-5 scale: (3+5+4 + 4+2+4) / 6
    assert metrics["selected_quality"] == 3.67


def test_scales_are_explicit_not_inferred(db, ns):
    metrics = payload(db)["mystery_metrics"]
    assert metrics["scales"] == {
        "nps": "-100..100", "csat": "0-10", "overall_experience": "0-10", "quality": "1-5",
    }
    assert metrics["selected_population"] == "approved_only"


def test_quality_uses_question_scale_not_average_heuristic(db, fx):
    """A 1-5 question averaging above 5.2 is impossible, but a 0-10 non-overall question
    averaging below 5.2 must NOT be classed as 1-5 quality (old heuristic did exactly that)."""
    v = fx.mystery_visit(fx.location("Scale"), "Approved")
    fx.mystery_scores(v, ms_store_cleanliness=4)
    db.execute(text("UPDATE questions SET score_min=0, score_max=10 WHERE question_key='ms_space_comfort'"))
    fx.mystery_answer(v, "ms_space_comfort", 3)  # 0-10 scale value of 3 (< 5.2)
    quality = payload(db)["mystery_metrics"]["selected_quality"]
    assert quality == 4.0


def test_summary_totals_use_authoritative_approved_answers(db, ns):
    summary = payload(db)["summary"]
    # answered rows (score or non-empty text) on Approved visits: m1 8 + m2 7 + m3 7 = 22 ('' waiting excluded)
    assert summary["total_responses"] == 22
    # 0-10 scale answers on Approved visits: 0+4+6 + 7+8+10 + 8+9+9 = 61 over 9 -> 6.78 ; 1-5 scale: 22 / 6 -> 3.67
    assert summary["average_score"] == 6.78
    assert summary["average_score_scale"] == "0-10"
    by_scale = {(s["score_min"], s["score_max"]): (s["average"], s["count"]) for s in summary["average_score_by_scale"]}
    assert by_scale == {(0, 10): (6.78, 9), (1, 5): (3.67, 6)}


def test_visit_details_per_visit_values(db, ns):
    rows = by_visit(payload(db))
    expected = {  # visit -> (status, answered rows, mean of 0-10 answers)
        ns.m1: ("Approved", 8, 3.33), ns.m2: ("Approved", 7, 8.33), ns.m3: ("Approved", 7, 8.67),
        ns.m4: ("Draft", 4, 10.0), ns.m5: ("Pending", 2, 10.0), ns.m6: ("Rejected", 1, 10.0),
        ns.m7: ("Needs Changes", 0, None),
    }
    assert {k: (rows[k]["status"], rows[k]["response_count"], rows[k]["avg_score"]) for k in expected} == expected


def test_location_filter_selected_vs_overall(db, ns):
    result = payload(db, "survey", location_id=ns.l1)
    metrics, summary = result["mystery_metrics"], result["summary"]
    assert summary["total_visits"] == 4  # m1, m2, m4, m7
    assert summary["approved_visits"] == 2
    assert metrics["selected_nps"] == -50.0  # [0, 7]
    assert metrics["selected_csat"] == 7.0  # [4, 6, 8, 10]
    # Lifetime overall stays explicit: all locations, all dates, Approved only
    assert metrics["overall_nps"] == -33.33 and metrics["overall_csat"] == 7.67
    assert metrics["overall_scope"] == "all_locations_all_dates_approved"


def test_date_range_filter(db, ns):
    result = payload(db, "date", date_from="2026-03-06", date_to="2026-03-12")
    assert result["summary"]["total_visits"] == 2 and result["summary"]["approved_visits"] == 2
    assert result["mystery_metrics"]["selected_nps"] == 0.0  # [7, 8]
    assert result["mystery_metrics"]["selected_csat"] == 9.0  # [8, 10, 9, 9]
    assert result["mystery_metrics"]["overall_nps"] == -33.33


def test_report_date_is_a_single_day_window(db, ns):
    result = payload(db, "date", report_date="2026-03-12")
    assert [r["visit_id"] for r in result["visit_details"]] == [ns.m3]
    assert result["mystery_metrics"]["selected_nps"] == 0.0  # single passive (8)
    assert result["mystery_metrics"]["selected_csat"] == 9.0


def test_single_visit_selected_metrics_obey_visit_id(db, ns):
    result = payload(db, "survey", location_id=ns.l1, visit_id=ns.m2)
    summary, metrics = result["summary"], result["mystery_metrics"]
    assert summary["is_single_visit"] is True
    assert summary["total_visits"] == 1 and summary["approved_visits"] == 1
    assert [r["visit_id"] for r in result["visit_details"]] == [ns.m2]
    assert metrics["selected_nps"] == 0.0  # single passive (7): 0% promoters - 0% detractors
    assert metrics["selected_csat"] == 9.0  # (8 + 10) / 2
    assert metrics["selected_overall_experience"] == 8.33  # (7 + 8 + 10) / 3
    assert metrics["overall_nps"] == -33.33  # lifetime overall unchanged
    assert result["analytics_selected"]["nps"]["total_responses"] == 1
    assert result["analytics_selected"]["visits"]["total"] == 1


def test_single_visit_details_come_from_authoritative_table(db, ns):
    db.execute(  # stale mirror value must not be shown
        text("UPDATE b2b_visit_responses SET score = 2 WHERE visit_id = CAST(:v AS uuid) AND question_id = "
             "(SELECT id FROM questions WHERE question_key='ms_recommend_outlet_nps')"),
        {"v": ns.m2},
    )
    result = payload(db, "survey", visit_id=ns.m2)
    rows = {r["question_id"]: r for r in result["survey_question_details"]}
    nps_id = db.execute(text("SELECT id FROM questions WHERE question_key='ms_recommend_outlet_nps'")).scalar()
    assert rows[nps_id]["score"] == 7
    assert len(result["survey_question_details"]) == 7
    assert result["selected_visit_info"]["visit_id"] == ns.m2


def test_single_visit_not_approved_has_inventory_but_no_scored_kpis(db, ns):
    result = payload(db, "survey", visit_id=ns.m4)
    assert result["summary"]["total_visits"] == 1
    assert result["summary"]["approved_visits"] == 0
    assert result["visit_details"][0]["status"] == "Draft"
    assert result["mystery_metrics"]["selected_nps"] is None
    assert result["mystery_metrics"]["selected_csat"] is None
    assert result["summary"]["average_score"] is None


def test_survey_report_without_visit_id_is_not_single_visit(db, ns):
    result = payload(db, "survey", location_id=ns.l2)
    assert result["summary"]["is_single_visit"] is False
    assert result["summary"]["total_visits"] == 3  # L2: m3 Approved, m5 Pending, m6 Rejected


def test_html_report_labels_populations(db, ns):
    from app.api.mystery_shopper import render_mystery_report_html

    html = render_mystery_report_html(payload(db), "tester")
    assert "all statuses" in html.lower()
    assert "approved" in html.lower()
    assert "7.67" in html  # selected CSAT


# ------------------------------------------------- module-consistency & formatting (remediation)
def test_report_ignores_rogue_b2b_question_rows_on_a_mystery_visit(db, fx, ns):
    before = payload(db, "survey", visit_id=ns.m1)
    fx.answer(ns.m1, "q12_overall_satisfaction", 1, table="mystery_shopper_answers")
    fx.answer(ns.m1, "q01_relationship_strength", 1, table="mystery_shopper_answers")
    fx.answer(ns.m1, "q20_comments", None, "rogue", table="mystery_shopper_answers")
    after = payload(db, "survey", visit_id=ns.m1)
    assert after["summary"] == before["summary"]                      # totals, per-scale rows, average_score
    assert after["visit_details"] == before["visit_details"]          # per-visit response_count / avg_score
    assert after["survey_question_details"] == before["survey_question_details"]
    assert after["analytics_selected"] == before["analytics_selected"]


def test_report_scale_rows_use_declared_bounds(db, fx):
    visit = fx.mystery_visit(fx.location("BoundsLoc"), "Approved")
    fx.mystery_scores(visit, nps=9, staff_sat=12, ms_store_cleanliness=4)
    summary = payload(db)["summary"]
    by_scale = {(s["score_min"], s["score_max"]): (s["average"], s["count"]) for s in summary["average_score_by_scale"]}
    assert by_scale == {(0, 10): (9.0, 1), (1, 5): (4.0, 1)}   # 12 on a 0-10 question is not an observation


def test_invalid_visit_id_is_a_400(db, ns):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as err:
        payload(db, "survey", visit_id="not-a-uuid")
    assert err.value.status_code == 400


def test_html_nps_uses_two_decimals_like_the_api(db, ns):
    from app.api.mystery_shopper import render_mystery_report_html

    result = payload(db)
    assert result["mystery_metrics"]["selected_nps"] == -33.33
    html = render_mystery_report_html(result, "tester")
    assert "-33.33" in html and ">-33<" not in html


@pytest.mark.parametrize("value,shown", [(-0.004, "0.00"), (-0.4, "-0.40"), (50, "50.00"), (None, "—")])
def test_html_nps_never_renders_negative_zero(db, ns, value, shown):
    from app.api.mystery_shopper import render_mystery_report_html

    result = payload(db)
    result["mystery_metrics"]["selected_nps"] = value
    html = render_mystery_report_html(result, "tester")
    assert "-0.00" not in html and ">-0<" not in html
    assert f">{shown}<" in html or shown in html
