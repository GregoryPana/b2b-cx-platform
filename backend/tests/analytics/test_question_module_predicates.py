"""Question-module predicates on every question-joined aggregate (a question_key alone is not a module boundary)."""

from __future__ import annotations

import copy

import pytest
from sqlalchemy import text

import scenarios as S
from helpers import overview


@pytest.fixture()
def ns(fx):
    return S.seed_two_modules(fx)


def _snapshot(db, survey_type):
    return copy.deepcopy(overview(db, survey_type))


def test_rogue_b2b_questions_on_a_mystery_visit_change_nothing(db, fx, ns):
    before = _snapshot(db, "Mystery Shopper")
    rogue = ns.m1  # Approved Mystery visit, authoritative table
    fx.answer(rogue, "q11_recommend_nps", 0, table="mystery_shopper_answers")      # B2B NPS question
    fx.answer(rogue, "q12_overall_satisfaction", 1, table="mystery_shopper_answers")  # B2B CSAT question
    fx.answer(rogue, "q01_relationship_strength", 1, table="mystery_shopper_answers")  # relationship
    fx.answer(rogue, "q16_other_provider_products", None, "Y", table="mystery_shopper_answers")  # exposure
    fx.answer(rogue, "q20_comments", None, "rogue text", table="mystery_shopper_answers")
    assert _snapshot(db, "Mystery Shopper") == before


def test_rogue_mystery_questions_on_a_b2b_visit_change_nothing(db, fx, ns):
    before = _snapshot(db, "B2B")
    for key, score, value in [
        ("ms_recommend_outlet_nps", 0, None), ("ms_staff_interaction_satisfaction", 1, None),
        ("ms_store_environment_satisfaction", 1, None), ("ms_waiting_time", None, "Over 1 hour"),
        ("ms_greeted_within_30_seconds", None, "Yes"),
    ]:
        fx.answer(ns.v1, key, score, value)  # b2b_visit_responses row on an Approved B2B visit
    assert _snapshot(db, "B2B") == before


@pytest.mark.parametrize("key,survey_type,other", [
    ("q11_recommend_nps", "B2B", "Mystery Shopper"),
    ("q12_overall_satisfaction", "B2B", "Mystery Shopper"),
    ("q01_relationship_strength", "B2B", "Mystery Shopper"),
    ("q16_other_provider_products", "B2B", "Mystery Shopper"),
    ("ms_recommend_outlet_nps", "Mystery Shopper", "B2B"),
    ("ms_staff_interaction_satisfaction", "Mystery Shopper", "B2B"),
    ("ms_store_environment_satisfaction", "Mystery Shopper", "B2B"),
    ("ms_waiting_time", "Mystery Shopper", "B2B"),
    ("ms_service_completion_time", "Mystery Shopper", "B2B"),
])
def test_module_predicate_is_independent_of_question_key(db, fx, ns, key, survey_type, other):
    """Re-label one canonical question to the other module: its answers must leave the metric."""
    before = _snapshot(db, survey_type)
    other_id = fx.ms_type_id if other == "Mystery Shopper" else fx.b2b_type_id
    db.execute(text("UPDATE questions SET survey_type_id = :m WHERE question_key = :k"), {"m": other_id, "k": key})
    after = _snapshot(db, survey_type)
    assert after != before, f"{key} still feeds {survey_type} after being moved to {other}"


def test_legacy_null_question_module_is_accepted_only_under_b2b(db, fx, ns):
    b2b_before = _snapshot(db, "B2B")
    ms_before = _snapshot(db, "Mystery Shopper")
    db.execute(text("UPDATE questions SET survey_type_id = NULL WHERE question_key IN "
                    "('q11_recommend_nps','q12_overall_satisfaction','q01_relationship_strength','q16_other_provider_products')"))
    assert _snapshot(db, "B2B") == b2b_before  # legacy NULL still counts for B2B
    db.execute(text("UPDATE questions SET survey_type_id = NULL WHERE question_key LIKE 'ms\\_%'"))
    after = _snapshot(db, "Mystery Shopper")
    assert after["nps"]["total_responses"] == 0 and after["mystery_shopper"]["csat_response_count"] == 0
    assert after != ms_before


def test_mystery_scope_reports_account_metrics_as_not_applicable(db, ns):
    result = overview(db, "Mystery Shopper")
    exposure, relationship = result["competitive_exposure"], result["relationship_score"]
    assert exposure["applicable"] is False
    assert (exposure["exposure_rate"], exposure["total_accounts"], exposure["accounts_using_competitors"]) == (None, 0, 0)
    assert relationship["applicable"] is False
    assert (relationship["score"], relationship["questions_answered"], relationship["possible_score"]) == (None, 0, 0.0)
    b2b = overview(db, "B2B")
    assert b2b["competitive_exposure"]["applicable"] is True and b2b["relationship_score"]["applicable"] is True


@pytest.mark.parametrize("table", ["visits", "questions"])
@pytest.mark.parametrize("survey_type", [None, "B2B", "Mystery Shopper"])
def test_missing_module_metadata_column_fails_closed(db, api_client, ns, table, survey_type):
    from app.core.db_inspect import reset_cache

    db.execute(text(f"ALTER TABLE {table} DROP COLUMN survey_type_id CASCADE"))
    reset_cache()
    params = {"survey_type": survey_type} if survey_type else {}
    for path in ("/analytics", "/analytics/questions", "/analytics/questions/yes-no"):
        response = api_client.get(path, params=params)
        assert response.status_code == 500, (path, response.text[:200])
        assert "survey_type_id" in response.json()["detail"]
    # legacy compat endpoints return empty payloads rather than an unfiltered dataset
    assert api_client.get("/dashboard/nps", params=params).json()["total_responses"] == 0
    assert api_client.get("/dashboard/category-breakdown", params=params).json() == []
    assert api_client.get("/dashboard/coverage", params=params).json()["total_active_businesses"] == 0
