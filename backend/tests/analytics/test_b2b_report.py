"""B2B report payload (lifetime / selected business / date / single visit) on real SQL with hand-computed values."""

from __future__ import annotations

from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy import text

import scenarios as S


@pytest.fixture()
def ns(fx):
    return S.seed_two_modules(fx)


def report(db, report_type="lifetime", survey_type="B2B", business_id=None, visit_id=None, report_date=None,
           date_from=None, date_to=None):
    from app.api.visits_dashboard import build_report_payload

    return build_report_payload(db, report_type, survey_type, business_id, visit_id, report_date, date_from, date_to)


def rows(result):
    return {row["visit_id"]: row for row in result["visit_details"]}


# ---------------------------------------------------------------- lifetime
def test_lifetime_inventory_is_b2b_only_and_lists_every_status(db, ns):
    result = report(db)
    summary = result["summary"]
    assert summary["total_visits"] == 8 and summary["total_businesses"] == 3
    assert summary["status_counts"] == {"Draft": 1, "Pending": 1, "Approved": 4, "Rejected": 1, "Needs Changes": 1}
    # response rows: v1 8, v2 5, v3 4, v4 8, v5 2 ; Mystery mirror rows never appear
    assert summary["total_responses"] == 27
    assert not set(rows(result)) & {ns.m1, ns.m2, ns.m3, ns.m4, ns.m5, ns.m6, ns.m7}
    # existing (unchanged) formula: per-visit mean of numeric scores weighted by that visit's answered rows
    # (9.0*8 + 6.6667*5 + 6.0*4 + 8.0*8 + 0.0*2) / 27 = 7.16
    assert summary["average_score"] == 7.16


def test_lifetime_kpi_comparison_matches_analytics_values(db, ns):
    kpi = report(db)["analytics_comparison"]
    assert kpi["nps"] == {"selected": 25.0, "overall": 25.0}
    assert kpi["csat"] == {"selected": 75.0, "overall": 75.0}
    assert kpi["relationship_score"] == {"selected": 64.0, "overall": 64.0}
    assert kpi["competitor_exposure"] == {"selected": 33.33, "overall": 33.33}


def test_selected_business_vs_overall_comparison(db, ns):
    result = report(db, "lifetime", business_id=ns.b1)
    kpi = result["analytics_comparison"]
    assert kpi["nps"] == {"selected": 50.0, "overall": 25.0}      # b1 approved NPS [10, 8]
    assert kpi["csat"] == {"selected": 100.0, "overall": 75.0}    # b1 q12 [9, 10]
    assert result["summary"]["total_visits"] == 4 and result["summary"]["total_businesses"] == 1


def test_category_rollups_and_comparison(db, ns):
    result = report(db, "lifetime", business_id=ns.b1)
    comparison = {row["category"]: row for row in result["category_comparison"]}
    assert set(comparison) == {"Relationship", "Loyalty"}
    relationship = comparison["Relationship"]
    # selected (b1): q01 [8,10] mean 9.0 n2 ; q02 [9,5] mean 7.0 n2 ; q05 [7] n1 -> (18+14+7)/5 = 7.8
    assert relationship["selected_average_score"] == 7.8
    # overall: q01 [8,6,4,10] 7.0 n4 ; q02 [9,5] 7.0 n2 ; q05 [7] 7.0 n1 -> 7.0 ; delta 0.8
    assert relationship["overall_average_score"] == 7.0 and relationship["delta"] == 0.8
    questions = {q["question_number"]: q for q in relationship["questions"]}
    assert (questions[1]["average_score"], questions[1]["response_count"]) == (9.0, 2)
    loyalty = comparison["Loyalty"]
    # q11 [10,8] n2 + q12 [9,10] n2 -> 37/4 = 9.25 (not 9.0).
    # exact: (9.0*2 + 9.5*2) / 4 = 9.25 ; overall (8.25*4 + 8.0*4) / 8 = 8.125
    assert loyalty["selected_average_score"] == pytest.approx(9.25, abs=0.006)
    assert loyalty["overall_average_score"] == pytest.approx(8.125, abs=0.006)
    assert loyalty["delta"] == pytest.approx(1.12, abs=0.011)


def test_yes_no_comparison_selected_vs_overall(db, ns):
    items = {i["question_number"]: i for i in report(db, "lifetime", business_id=ns.b1)["yes_no_comparison"]}
    # priority questions 4, 6, 16: b1 approved answers q04 [Yes, No], q06 [No, Yes], q16 [Y, N] -> 50 % each
    assert {n: items[n]["filtered_yes_percent"] for n in (4, 6, 16)} == {4: 50.0, 6: 50.0, 16: 50.0}
    # overall: q04 [Yes, Yes, No] 66.67 ; q06 [No, Yes] 50 ; q16 [Y, Y, N] 66.67
    assert items[4]["overall_yes_percent"] == 66.67 and items[6]["overall_yes_percent"] == 50.0
    assert items[16]["overall_yes_percent"] == 66.67


# ---------------------------------------------------------------- date window
def test_date_report_window_filters_inventory_and_kpis(db, ns):
    result = report(db, "date", date_from="2026-03-05", date_to="2026-03-09")
    assert {r["visit_id"] for r in result["visit_details"]} == {ns.v2, ns.v3}
    kpi = result["analytics_comparison"]
    assert kpi["nps"]["selected"] == 0.0           # [6, 9]
    assert kpi["nps"]["overall"] is None           # overall comparison only on lifetime reports
    assert kpi["csat"]["selected"] == 50.0         # q12 [8, 5]: one satisfied of two


def test_report_date_is_a_single_day(db, ns):
    result = report(db, "date", report_date="2026-03-20")
    assert [r["visit_id"] for r in result["visit_details"]] == [ns.v4]


# ---------------------------------------------------------------- single visit
def test_single_visit_report_details_and_raw_scores(db, ns):
    result = report(db, "survey", visit_id=ns.v4)
    assert result["summary"]["is_single_visit"] is True and result["summary"]["total_visits"] == 1
    assert result["selected_visit_info"]["visit_id"] == ns.v4
    assert len(result["survey_question_details"]) == 8
    scores = result["single_visit_scores"]
    assert (scores["nps_raw_score"], scores["csat_raw_score"]) == (8, 10)
    assert scores["csat_question_text"] == "Overall C&W satisfaction"
    # Selected analytics, question/category rollups and yes/no must share the visit scope,
    # not silently aggregate other visits for the same business.
    assert result["analytics_comparison"]["nps"]["selected"] == 0.0  # sole NPS answer 8
    assert result["analytics_comparison"]["csat"]["selected"] == 100.0  # sole Q12 answer 10
    assert result["analytics_selected"]["nps"]["total_responses"] == 1
    category = {item["category"]: item for item in result["category_comparison"]}
    assert category["Loyalty"]["selected_average_score"] == 9.0  # (8 + 10)/2
    yes_no = {item["question_number"]: item for item in result["yes_no_comparison"]}
    assert yes_no[4]["filtered_yes_percent"] == 0.0
    assert yes_no[6]["filtered_yes_percent"] == 100.0


def test_single_visit_csat_is_q12_not_another_satisfaction_question(db, fx):
    """q05 ("Contacts visit satisfaction", relationship) must never be reported as the CSAT score."""
    visit = fx.b2b_visit(fx.business("Trap"), "Approved", date(2026, 4, 1))
    fx.answer(visit, "q05_contacts_visit_satisfaction", 1)   # inserted first so a LIMIT-1 text match picks it
    fx.answer(visit, "q12_overall_satisfaction", 9)
    fx.answer(visit, "q11_recommend_nps", 7)
    scores = report(db, "survey", visit_id=visit)["single_visit_scores"]
    assert scores["csat_raw_score"] == 9
    assert scores["csat_question_text"] == "Overall C&W satisfaction"
    assert scores["nps_raw_score"] == 7


def test_single_visit_duplicate_legacy_rows_resolve_to_the_freshest(db, fx):
    db.execute(text("ALTER TABLE b2b_visit_responses DROP CONSTRAINT uq_b2b_visit_responses_visit_question"))
    visit = fx.b2b_visit(fx.business("Dup"), "Approved", date(2026, 4, 2))
    q12, nps = fx.qid("q12_overall_satisfaction"), fx.qid("q11_recommend_nps")
    for question_id, score, stamp in [(q12, 2, "2026-01-01"), (q12, 9, "2026-02-01"), (q12, 4, "2026-01-15"),
                                      (nps, 3, "2026-01-01"), (nps, 10, "2026-03-01")]:
        db.execute(text("INSERT INTO b2b_visit_responses (visit_id, question_id, score, updated_at, created_at) "
                        "VALUES (CAST(:v AS uuid), :q, :s, CAST(:t AS timestamptz), CAST(:t AS timestamptz))"),
                   {"v": visit, "q": question_id, "s": score, "t": stamp})
    scores = report(db, "survey", visit_id=visit)["single_visit_scores"]
    assert (scores["csat_raw_score"], scores["nps_raw_score"]) == (9, 10)
    assert report(db, "survey", visit_id=visit)["single_visit_scores"] == scores  # deterministic on repeat


def test_single_visit_scores_ignore_out_of_range_and_other_module_questions(db, fx):
    visit = fx.b2b_visit(fx.business("Bounds"), "Approved", date(2026, 4, 3))
    fx.answer(visit, "q12_overall_satisfaction", 14)           # outside declared 0-10
    fx.answer(visit, "ms_recommend_outlet_nps", 3)             # Mystery NPS question on a B2B visit
    scores = report(db, "survey", visit_id=visit)["single_visit_scores"]
    assert scores["csat_raw_score"] is None and scores["nps_raw_score"] is None


def test_rogue_mystery_question_on_a_b2b_visit_is_not_in_report_totals_or_details(db, fx, ns):
    before = report(db, "survey", visit_id=ns.v4)
    fx.answer(ns.v4, "ms_store_cleanliness", 1)
    fx.answer(ns.v4, "ms_waiting_time", None, "Over 1 hour")
    after = report(db, "survey", visit_id=ns.v4)
    assert after["summary"] == before["summary"]
    assert after["survey_question_details"] == before["survey_question_details"]
    assert after["visit_details"] == before["visit_details"]


# ---------------------------------------------------------------- rejection
def test_mystery_visit_id_is_rejected_by_the_b2b_report(db, ns):
    with pytest.raises(HTTPException) as err:
        report(db, "survey", visit_id=ns.m1)
    assert err.value.status_code == 400


@pytest.mark.parametrize("survey_type", ["Mystery Shopper", "Installation Assessor", "all", "bogus"])
def test_b2b_report_rejects_other_or_unresolved_survey_types(db, fx, ns, survey_type):
    fx.add_survey_type("Installation Assessor", "installation")
    with pytest.raises(HTTPException) as err:
        report(db, "lifetime", survey_type=survey_type)
    assert err.value.status_code == 400


def test_non_uuid_visit_id_is_a_400_not_a_sql_error(db, ns):
    with pytest.raises(HTTPException) as err:
        report(db, "survey", visit_id="not-a-uuid")
    assert err.value.status_code == 400


def test_missing_survey_type_means_b2b_and_never_includes_mystery(db, ns):
    result = report(db, "lifetime", survey_type=None)
    assert result["summary"]["total_visits"] == 8
    assert result["filters"]["survey_type"] == "B2B"
