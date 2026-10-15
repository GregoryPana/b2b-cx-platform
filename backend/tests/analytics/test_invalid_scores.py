"""Out-of-range historical scores must never skew numerators or denominators, and must be counted visibly."""

from __future__ import annotations

import pytest

from helpers import overview


def _b2b(fx, key, scores):
    for index, score in enumerate(scores):
        fx.answer(fx.b2b_visit(fx.business(f"{key}-{index}-{fx._n}"), "Approved"), key, score)
        fx._n += 1


def test_b2b_nps_invalid_scores_are_excluded_and_counted(db, fx):
    _b2b(fx, "q11_recommend_nps", [10, 11, -1, 5, 99])
    nps = overview(db, "B2B")["nps"]
    # valid: 10 (promoter) and 5 (detractor) -> 0.0 ; 11, -1 and 99 are excluded, not counted as promoter/detractor
    assert (nps["promoters"], nps["passives"], nps["detractors"], nps["total_responses"]) == (1, 0, 1, 2)
    assert nps["promoters"] + nps["passives"] + nps["detractors"] == nps["total_responses"]
    assert nps["nps"] == 0.0
    assert nps["excluded_invalid"] == 3


def test_mystery_nps_invalid_scores_are_excluded_and_counted(db, fx):
    loc = fx.location("Inv")
    for score in (9, 12, -3):
        fx.mystery_answer(fx.mystery_visit(loc, "Approved"), "ms_recommend_outlet_nps", score)
    nps = overview(db, "Mystery Shopper")["nps"]
    assert (nps["promoters"], nps["total_responses"], nps["nps"], nps["excluded_invalid"]) == (1, 1, 100.0, 2)


@pytest.mark.parametrize("survey_type", ["B2B", "Mystery Shopper"])
def test_only_invalid_nps_scores_keep_the_no_data_contract(db, fx, survey_type):
    if survey_type == "B2B":
        _b2b(fx, "q11_recommend_nps", [11, -1])
    else:
        loc = fx.location("OnlyInv")
        for score in (11, -1):
            fx.mystery_answer(fx.mystery_visit(loc, "Approved"), "ms_recommend_outlet_nps", score)
    nps = overview(db, survey_type)["nps"]
    assert nps["nps"] is None and nps["total_responses"] == 0
    assert (nps["promoters"], nps["passives"], nps["detractors"]) == (0, 0, 0)
    assert nps["excluded_invalid"] == 2


def test_b2b_csat_uses_declared_bounds(db, fx):
    _b2b(fx, "q12_overall_satisfaction", [9, 8, 11, -1, 100, 4])
    csat = overview(db, "B2B")["customer_satisfaction"]
    # valid 9, 8, 4 -> satisfied+very satisfied 2 of 3 = 66.67 ; mean 7.0 ; 11, -1, 100 excluded
    assert csat["response_count"] == 3 and csat["excluded_invalid"] == 3
    assert csat["csat_score"] == 66.67 and csat["avg_score"] == 7.0
    dist = csat["score_distribution"]
    assert sum(dist.values()) == csat["response_count"]


def test_mystery_csat_uses_declared_bounds_and_counts_exclusions(db, fx):
    visit = fx.mystery_visit(fx.location("CsatInv"), "Approved")
    fx.mystery_scores(visit, staff_sat=12, store_sat=7)
    other = fx.mystery_visit(fx.location("CsatInv2"), "Approved")
    fx.mystery_scores(other, staff_sat=10, store_sat=-2)
    ms = overview(db, "Mystery Shopper")["mystery_shopper"]
    assert ms["csat_response_count"] == 2 and ms["csat_average"] == 8.5  # (7 + 10) / 2
    assert ms["csat_excluded_invalid"] == 2
    breakdown = {r["location_name"]: r["csat_average"] for r in ms["location_breakdown"]}
    assert breakdown == {"CsatInv": 7.0, "CsatInv2": 10.0}  # invalid answers also leave the per-location means


def test_declared_bounds_not_a_fixed_0_10_window(db, fx):
    """A question declaring a narrower scale (1-5) rejects 7 even though it is inside 0-10."""
    from sqlalchemy import text

    db.execute(text("UPDATE questions SET score_min = 1, score_max = 5 WHERE question_key = 'q12_overall_satisfaction'"))
    _b2b(fx, "q12_overall_satisfaction", [5, 4, 7, 0])
    csat = overview(db, "B2B")["customer_satisfaction"]
    assert csat["response_count"] == 2 and csat["excluded_invalid"] == 2
