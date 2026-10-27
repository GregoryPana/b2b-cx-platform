"""Fail-closed module scoping: B2B vs Mystery Shopper isolation on the shared tables."""

from __future__ import annotations

import pytest
from sqlalchemy import text

import scenarios as S
from helpers import by_key, overview


@pytest.fixture()
def ns(fx):
    return S.seed_two_modules(fx)


MYSTERY_ALIASES = ["Mystery Shopper", "mystery shopper", "MYSTERY_SHOPPER", "mystery", "MysteryShopper", "mystery_shopper "]
B2B_ALIASES = ["B2B", "b2b", " B2B "]


@pytest.mark.parametrize("survey_type", [None, "", "   "] + B2B_ALIASES)
def test_missing_or_b2b_survey_type_is_b2b_only(db, ns, survey_type):
    """Legacy callers that omit survey_type keep B2B semantics and never see mirrored Mystery rows."""
    result = overview(db, survey_type)
    for key, expected in S.B2B_NPS.items():
        assert result["nps"][key] == expected, key
    assert result["visits"] == S.B2B_VISITS
    assert result["responses"]["text_responses"] == S.B2B_TEXT_RESPONSES
    assert result["customer_satisfaction"]["response_count"] == S.B2B_CSAT["response_count"]
    assert result["mystery_shopper"]["csat_average"] is None


@pytest.mark.parametrize("survey_type", MYSTERY_ALIASES)
def test_mystery_aliases_resolve_to_mystery_only(db, ns, survey_type):
    result = overview(db, survey_type)
    for key, expected in S.MS_NPS.items():
        assert result["nps"][key] == expected, key
    assert result["visits"] == S.MS_VISITS
    assert result["mystery_shopper"]["csat_response_count"] == S.MS_CSAT["csat_response_count"]


def test_mystery_code_resolves_through_survey_types_table(db, ns):
    assert overview(db, "mystery_shopper")["nps"]["total_responses"] == 3


ENDPOINTS = [
    ("/analytics", {}),
    ("/analytics/questions", {}),
    ("/analytics/questions/yes-no", {}),
    ("/analytics/account-executives/yes-no-trends", {}),
    ("/analytics/questions/{qid}/trend", {}),
]


@pytest.mark.parametrize("survey_type", ["all", "ALL", "no-such-survey", "Installation Assessor", "mystery-shopper"])
@pytest.mark.parametrize("path,extra", ENDPOINTS)
def test_unresolved_or_unsupported_survey_type_fails_closed(api_client, db, fx, ns, path, extra, survey_type):
    fx.add_survey_type("Installation Assessor", "installation")
    path = path.format(qid=fx.qid("q01_relationship_strength"))
    response = api_client.get(path, params={"survey_type": survey_type, **extra})
    assert response.status_code == 400, (path, survey_type, response.status_code, response.text[:200])
    assert "survey_type" in response.json()["detail"].lower()


def test_mirrored_mystery_rows_do_not_leak_into_b2b_question_stats(api_client, ns):
    for params in ({}, {"survey_type": "B2B"}):
        items = api_client.get("/analytics/questions", params=params).json()["items"]
        assert items, params
        assert not [i["question_key"] for i in items if i["question_key"].startswith("ms_")]


def test_mystery_question_stats_exclude_b2b_questions(api_client, ns):
    items = api_client.get("/analytics/questions", params={"survey_type": "Mystery Shopper"}).json()["items"]
    assert items and not [i["question_key"] for i in items if not i["question_key"].startswith("ms_")]


def test_question_visit_module_mismatch_is_ignored(db, fx, ns, api_client):
    """A Mystery question answered on a B2B visit (bad/legacy data) must not count as B2B data."""
    fx.answer(ns.v1, "ms_store_cleanliness", 1)  # rogue row on an Approved B2B visit
    items = by_key(api_client.get("/analytics/questions", params={"survey_type": "B2B"}).json()["items"])
    assert "ms_store_cleanliness" not in items
    # ...and a B2B question on a Mystery visit must not count as Mystery data
    fx.answer(ns.m1, "q12_overall_satisfaction", 1, table="mystery_shopper_answers")
    ms_items = by_key(api_client.get("/analytics/questions", params={"survey_type": "Mystery Shopper"}).json()["items"])
    assert "q12_overall_satisfaction" not in ms_items


@pytest.mark.parametrize("question_key,survey_type", [
    ("ms_recommend_outlet_nps", "B2B"),
    ("ms_recommend_outlet_nps", None),
    ("q11_recommend_nps", "Mystery Shopper"),
])
def test_trend_for_question_of_other_module_is_404(api_client, fx, ns, question_key, survey_type):
    params = {"survey_type": survey_type} if survey_type else {}
    response = api_client.get(f"/analytics/questions/{fx.qid(question_key)}/trend", params=params)
    assert response.status_code == 404, response.text


def test_mystery_reads_authoritative_answers_not_the_mirror(db, fx):
    visit = fx.mystery_visit(fx.location("Auth"), "Approved")
    fx.mystery_answer(visit, "ms_recommend_outlet_nps", 9, mirror=False)
    fx.answer(visit, "ms_recommend_outlet_nps", 2)  # stale mirror value
    nps = overview(db, "Mystery Shopper")["nps"]
    assert (nps["nps"], nps["promoters"], nps["detractors"]) == (100.0, 1, 0)


def test_mystery_without_answers_table_fails_closed_instead_of_using_mirror(db, ns, api_client):
    db.execute(text("DROP TABLE mystery_shopper_answers"))
    from app.core.db_inspect import reset_cache

    reset_cache()
    response = api_client.get("/analytics", params={"survey_type": "Mystery Shopper"})
    assert response.status_code == 500
    assert "mystery" in response.json()["detail"].lower()
    items = api_client.get("/analytics/questions", params={"survey_type": "Mystery Shopper"}).json()
    assert items == {"items": []}


def test_survey_type_rows_missing_returns_empty_not_everything(db, fx, ns):
    """If the Mystery survey type row does not exist no visit can be Mystery: empty, never B2B."""
    db.execute(text("UPDATE visits SET survey_type_id = NULL WHERE survey_type_id = :s"), {"s": fx.ms_type_id})
    db.execute(text("UPDATE questions SET survey_type_id = NULL WHERE survey_type_id = :s"), {"s": fx.ms_type_id})
    db.execute(text("DELETE FROM mystery_shopper_answers"))
    db.execute(text("DELETE FROM survey_types WHERE id = :s"), {"s": fx.ms_type_id})
    result = overview(db, "Mystery Shopper")
    assert result["nps"]["total_responses"] == 0
    assert result["visits"]["total"] == 0
