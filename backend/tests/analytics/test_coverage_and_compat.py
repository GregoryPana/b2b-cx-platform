"""Legacy /dashboard/coverage (YTD default, repeat businesses) and Mystery category breakdown."""

from __future__ import annotations

from datetime import date

import pytest

import scenarios as S

FAKE_TODAY = date(2030, 6, 15)  # patched clock; every expected figure below is derived relative to it
Y = FAKE_TODAY.year


@pytest.fixture()
def clock(monkeypatch):
    from app.api import dashboard_compat

    monkeypatch.setattr(dashboard_compat, "_today", lambda: FAKE_TODAY)


def _get(client, **params):
    response = client.get("/dashboard/coverage", params=params)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture()
def coverage_data(fx):
    ids = {}
    ids["A"] = fx.business("A repeat x3")
    ids["B"] = fx.business("B once")
    ids["C"] = fx.business("C last year only")
    ids["D"] = fx.business("D draft only")
    ids["E"] = fx.business("E inactive", active=False)
    ids["F"] = fx.business("F pending/rejected")
    ids["G"] = fx.business("G two years ago")
    for month in (1, 3, 5):
        fx.b2b_visit(ids["A"], "Approved", date(Y, month, 10))
    fx.b2b_visit(ids["B"], "Approved", date(Y, 2, 2))
    fx.b2b_visit(ids["C"], "Approved", date(Y - 1, 11, 20))
    fx.b2b_visit(ids["D"], "Draft", date(Y, 4, 4))
    fx.b2b_visit(ids["E"], "Approved", date(Y, 1, 5))
    fx.b2b_visit(ids["E"], "Approved", date(Y, 2, 5))
    fx.b2b_visit(ids["F"], "Pending", date(Y, 3, 3))
    fx.b2b_visit(ids["F"], "Pending", date(Y, 3, 4))
    fx.b2b_visit(ids["F"], "Rejected", date(Y, 3, 5))
    fx.b2b_visit(ids["G"], "Approved", date(Y - 2, 6, 1))
    fx.b2b_visit(ids["G"], "Approved", date(Y - 2, 7, 1))
    return ids


def test_default_period_is_current_year_and_denominator_has_no_visit_fanout(api_client, clock, coverage_data):
    body = _get(api_client, survey_type="B2B")
    # active businesses: A, B, C, D, F, G = 6 (E inactive) - A's three visits must not inflate this
    assert body["total_active_businesses"] == 6
    assert body["businesses_visited_ytd"] == 2  # A and B (C and G only visited in earlier years)
    assert body["coverage_percent"] == 33.33
    assert body["businesses_not_visited"] == 4
    assert body["repeat_visits"] == 1  # businesses with >1 Approved visit (A); NOT the 2 extra visits
    assert body["period"] == {"date_from": f"{Y}-01-01", "date_to": f"{Y}-12-31"}


def test_missing_survey_type_defaults_to_b2b_coverage(api_client, clock, coverage_data):
    assert _get(api_client)["businesses_visited_ytd"] == 2


def test_explicit_range_replaces_the_default_period(api_client, clock, coverage_data):
    body = _get(api_client, survey_type="B2B", date_from=f"{Y - 1}-01-01", date_to=f"{Y - 1}-12-31")
    assert (body["businesses_visited_ytd"], body["repeat_visits"], body["total_active_businesses"]) == (1, 0, 6)  # C
    older = _get(api_client, survey_type="B2B", date_from=f"{Y - 2}-01-01", date_to=f"{Y - 2}-12-31")
    assert (older["businesses_visited_ytd"], older["repeat_visits"]) == (1, 1)  # G visited twice


def test_open_ended_explicit_range_is_not_given_a_default_end(api_client, clock, coverage_data):
    body = _get(api_client, survey_type="B2B", date_from=f"{Y - 1}-01-01")
    assert body["businesses_visited_ytd"] == 3 and body["repeat_visits"] == 1  # A, B, C ; A repeats
    assert body["period"]["date_to"] is None


def test_repeat_rule_ignores_inactive_and_non_approved_visits(api_client, clock, coverage_data):
    # E (inactive, 2 approved), F (2 pending + 1 rejected) and D (draft) never count as repeat or visited
    body = _get(api_client, survey_type="B2B")
    assert body["repeat_visits"] == 1


def test_coverage_unknown_and_mystery_scopes_return_zeros(api_client, clock, coverage_data):
    for survey_type in ("Mystery Shopper", "bogus", "all"):
        body = _get(api_client, survey_type=survey_type)
        assert body["total_active_businesses"] == 0 and body["repeat_visits"] == 0


def test_category_breakdown_mystery_does_not_need_a_business(api_client, fx):
    ns = S.seed_two_modules(fx)
    assert ns.m1  # Mystery visits have business_id NULL
    rows = {r["category"]: r for r in api_client.get(
        "/dashboard/category-breakdown", params={"survey_type": "Mystery Shopper"}).json()}
    # approved m1..m3 only: "Store Environment & Comfort" [3,4,5,2,4,4] -> 22/6 ; "Overall Experience (CSAT & NPS)"
    # [0,4,6,7,8,10,8,9,9] -> 61/9 ; no B2B category leaks in
    assert set(rows) == {"Store Environment & Comfort", "Overall Experience (CSAT & NPS)"}
    assert (rows["Store Environment & Comfort"]["average_score"], rows["Store Environment & Comfort"]["response_count"]) == (3.67, 6)
    assert (rows["Overall Experience (CSAT & NPS)"]["average_score"], rows["Overall Experience (CSAT & NPS)"]["response_count"]) == (6.78, 9)
