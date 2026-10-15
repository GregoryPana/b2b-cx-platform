"""Executable value coverage for the /analytics metric families (real SQL, disposable PostgreSQL)."""

from __future__ import annotations

import pytest

import scenarios as S
from helpers import by_key, overview, question_averages


@pytest.fixture()
def ns(fx):
    return S.seed_two_modules(fx)


# --------------------------------------------------------------------- NPS
def test_b2b_nps_counts_and_value(db, ns):
    nps = overview(db, "B2B")["nps"]
    for key, expected in S.B2B_NPS.items():
        assert nps[key] == expected, key
    assert (nps["promoter_percentage"], nps["passive_percentage"], nps["detractor_percentage"]) == (50.0, 25.0, 25.0)


def test_mystery_nps_counts_and_value(db, ns):
    nps = overview(db, "Mystery Shopper")["nps"]
    for key, expected in S.MS_NPS.items():
        assert nps[key] == expected, key


def test_nps_excludes_draft_pending_rejected_and_needs_changes(db, ns):
    # m4/m5/m6 (10s) and b2b v5 (0) are not Approved; totals above already exclude them.
    assert overview(db, "Mystery Shopper")["nps"]["total_responses"] == 3
    assert overview(db, "B2B")["nps"]["total_responses"] == 4


@pytest.mark.parametrize("survey_type,question_key", [
    ("B2B", "q11_recommend_nps"),
    ("Mystery Shopper", "ms_recommend_outlet_nps"),
])
def test_nps_threshold_boundaries(db, fx, survey_type, question_key):
    """0-6 detractor, 7-8 passive, 9-10 promoter; NULL score rows are not observations."""
    def visit():
        if survey_type == "B2B":
            return fx.b2b_visit(fx.business(f"b{fx._n}"), "Approved"), fx.answer
        return fx.mystery_visit(fx.location(f"l{fx._n}"), "Approved"), fx.mystery_answer

    for score in (0, 6, 7, 8, 9, 10):
        v, write = visit()
        write(v, question_key, score)
        fx._n += 1
    v, write = visit()
    write(v, question_key, None)  # unanswered NPS row
    nps = overview(db, survey_type)["nps"]
    assert (nps["detractors"], nps["passives"], nps["promoters"], nps["total_responses"]) == (2, 2, 2, 6)
    assert nps["nps"] == 0.0


@pytest.mark.parametrize("survey_type", ["B2B", "Mystery Shopper"])
def test_nps_no_data_is_none_not_zero(db, fx, survey_type):
    nps = overview(db, survey_type)["nps"]
    assert nps["nps"] is None
    assert nps["total_responses"] == 0
    assert (nps["promoters"], nps["passives"], nps["detractors"]) == (0, 0, 0)


@pytest.mark.parametrize("scores,expected", [([9, 10, 9], 100.0), ([0, 3, 6], -100.0), ([7, 8], 0.0)])
def test_nps_extremes(db, fx, scores, expected):
    for score in scores:
        fx.answer(fx.b2b_visit(fx.business(f"b{score}-{fx._n}"), "Approved"), "q11_recommend_nps", score)
        fx._n += 1
    assert overview(db, "B2B")["nps"]["nps"] == expected


# -------------------------------------------------------------------- CSAT
def test_b2b_csat_top_box_and_distribution(db, ns):
    csat = overview(db, "B2B")["customer_satisfaction"]
    assert csat["csat_score"] == S.B2B_CSAT["csat_score"]
    assert csat["response_count"] == S.B2B_CSAT["response_count"]
    assert csat["avg_score"] == S.B2B_CSAT["avg_score"]
    assert csat["score_distribution"] == S.B2B_CSAT["dist"]


def test_b2b_csat_bucket_boundaries(db, fx):
    # 0-2 very dissatisfied, 3-4 dissatisfied, 5-7 neutral, 8 satisfied, 9-10 very satisfied
    for score in (0, 2, 3, 4, 5, 6, 7, 8, 9, 10):
        fx.answer(fx.b2b_visit(fx.business(f"c{score}"), "Approved"), "q12_overall_satisfaction", score)
    fx.answer(fx.b2b_visit(fx.business("cnull"), "Approved"), "q12_overall_satisfaction", None)
    csat = overview(db, "B2B")["customer_satisfaction"]
    assert csat["score_distribution"] == {
        "very_dissatisfied": 2, "dissatisfied": 2, "neutral": 3, "satisfied": 1, "very_satisfied": 2,
    }
    assert csat["response_count"] == 10  # NULL score is not an observation
    assert csat["csat_score"] == 30.0  # (1 + 2) / 10
    assert csat["avg_score"] == 5.4  # 54 / 10


def test_mystery_csat_pooled_mean_and_observation_count(db, ns):
    ms = overview(db, "Mystery Shopper")["mystery_shopper"]
    assert ms["csat_average"] == S.MS_CSAT["csat_average"]
    assert ms["csat_response_count"] == S.MS_CSAT["csat_response_count"]


def test_mystery_csat_count_ignores_null_scores_and_other_questions(db, fx):
    v = fx.mystery_visit(fx.location("Only"), "Approved")
    fx.mystery_scores(v, staff_sat=6, ms_store_cleanliness=5)
    fx.mystery_answer(v, "ms_store_environment_satisfaction", None)  # unanswered CSAT row
    ms = overview(db, "Mystery Shopper")["mystery_shopper"]
    assert ms["csat_response_count"] == 1
    assert ms["csat_average"] == 6.0


def test_no_csat_data_is_none_for_mystery(db, fx):
    fx.mystery_visit(fx.location("Empty"), "Approved")
    ms = overview(db, "Mystery Shopper")["mystery_shopper"]
    assert ms["csat_average"] is None
    assert ms["csat_response_count"] == 0


# ------------------------------------------------- relationship / exposure
def test_relationship_uses_latest_approved_visit_per_business(db, ns):
    rel = overview(db, "B2B")["relationship_score"]
    for key, expected in S.B2B_RELATIONSHIP.items():
        assert rel[key] == expected, key


def test_competitive_exposure_uses_latest_visit_only(db, ns):
    exp = overview(db, "B2B")["competitive_exposure"]
    for key, expected in S.B2B_EXPOSURE.items():
        assert exp[key] == expected, key


def test_exposure_and_relationship_no_data(db, fx):
    result = overview(db, "B2B")
    assert result["competitive_exposure"]["exposure_rate"] == 0.0
    assert result["relationship_score"]["score"] == 0.0


# ----------------------------------------------------------- status counts
def test_b2b_visit_status_counts(db, ns):
    assert overview(db, "B2B")["visits"] == {**S.B2B_VISITS}


def test_mystery_visit_status_counts(db, ns):
    visits = overview(db, "Mystery Shopper")["visits"]
    assert visits == S.MS_VISITS


@pytest.mark.parametrize("survey_type", ["B2B", "Mystery Shopper"])
def test_status_buckets_partition_the_total(db, ns, survey_type):
    """total == sum of every known status bucket; `completed` is an alias of `approved`, not a bucket."""
    visits = overview(db, survey_type)["visits"]
    buckets = ("draft", "pending", "needs_changes", "approved", "rejected")
    assert sum(visits[b] for b in buckets) == visits["total"]
    assert visits["completed"] == visits["approved"]
    assert all(visits[b] >= 1 for b in buckets)  # every bucket is exercised by the scenario


# --------------------------------------------------------- text responses
def test_text_responses_count_only_non_empty_answers(db, ns):
    assert overview(db, "B2B")["responses"]["text_responses"] == S.B2B_TEXT_RESPONSES
    assert overview(db, "Mystery Shopper")["responses"]["text_responses"] == S.MS_TEXT_RESPONSES


# ----------------------------------------------------------- distributions
def test_mystery_distributions(db, ns):
    ms = overview(db, "Mystery Shopper")["mystery_shopper"]
    assert {r["label"]: r["count"] for r in ms["waiting_time_distribution"]} == S.MS_WAITING
    assert {r["label"]: r["count"] for r in ms["service_completion_distribution"]} == S.MS_SERVICE
    assert [(r["location_name"], r["visits"], r["csat_average"]) for r in ms["location_breakdown"]] == S.MS_LOCATIONS
    assert [(r["staff_name"], r["visits"], r["csat_average"]) for r in ms["staff_breakdown"]] == S.MS_STAFF
    assert {r["purpose"]: r["count"] for r in ms["purpose_distribution"]} == S.MS_PURPOSES
    assert [(r["visit_date"], r["visit_count"]) for r in ms["visit_trend"]] == [
        ("2026-03-02", 1), ("2026-03-06", 1), ("2026-03-12", 1),
    ]


def test_mystery_location_filter_selected_values(db, ns):
    result = overview(db, "Mystery Shopper", mystery_location_ids=str(ns.l1))
    # L1 approved NPS answers [0, 7] -> 1 detractor, 1 passive -> -50.0 ; CSAT [4,6,8,10] -> 7.0
    assert result["nps"]["nps"] == -50.0
    assert result["nps"]["total_responses"] == 2
    assert result["mystery_shopper"]["csat_average"] == 7.0
    assert result["mystery_shopper"]["csat_response_count"] == 4


def test_date_range_filter_is_inclusive_on_both_ends(db, ns):
    # m2 (03-06) and m3 (03-12): NPS [7, 8] -> 0.0 ; CSAT [8,10,9,9] -> 9.0
    result = overview(db, "Mystery Shopper", date_from="2026-03-06", date_to="2026-03-12")
    assert result["nps"]["nps"] == 0.0
    assert result["nps"]["total_responses"] == 2
    assert result["mystery_shopper"]["csat_average"] == 9.0
    # B2B: v2 (03-05) and v3 (03-09) -> NPS [6, 9] -> 0.0
    b2b = overview(db, "B2B", date_from="2026-03-05", date_to="2026-03-09")
    assert (b2b["nps"]["total_responses"], b2b["nps"]["nps"]) == (2, 0.0)


def test_business_filter(db, ns):
    result = overview(db, "B2B", business_ids=f"{ns.b2},{ns.b3}")
    # v2 [6], v3 [9] -> 1 promoter, 1 detractor
    assert (result["nps"]["total_responses"], result["nps"]["nps"]) == (2, 0.0)


# -------------------------------------------------------- per-question stats
def test_question_averages_b2b(db, ns):
    items = by_key(question_averages(db, "B2B"))
    # q01 approved [8, 6, 4, 10] -> mean 7.0 ; q12 [9, 8, 5, 10] -> 8.0 ; q11 [10,6,9,8] -> 8.25
    assert (items["q01_relationship_strength"]["average_score"], items["q01_relationship_strength"]["response_count"]) == (7.0, 4)
    assert items["q12_overall_satisfaction"]["average_score"] == 8.0
    assert items["q11_recommend_nps"]["average_score"] == 8.25
    assert (items["q01_relationship_strength"]["min_score"], items["q01_relationship_strength"]["max_score"]) == (4.0, 10.0)
    assert set(items) <= {k for k, *_ in __import__("pg_schema").B2B_QUESTIONS}  # no Mystery question keys


def test_question_averages_mystery_carry_scale(db, ns):
    items = by_key(question_averages(db, "Mystery Shopper"))
    clean = items["ms_store_cleanliness"]  # [3, 5, 4]
    assert (clean["average_score"], clean["response_count"], clean["score_min"], clean["score_max"]) == (4.0, 3, 1, 5)
    assert round(items["ms_space_comfort"]["average_score"], 2) == 3.33  # [4, 2, 4]
    assert items["ms_recommend_outlet_nps"]["average_score"] == 5.0  # [0, 7, 8]
    assert round(items["ms_store_environment_satisfaction"]["average_score"], 2) == 8.33  # [6, 10, 9]
    assert items["ms_staff_interaction_satisfaction"]["average_score"] == 7.0  # [4, 8, 9]
