"""Legacy /dashboard/* compat endpoints and the mounted /admin-dashboard/analytics counters."""

from __future__ import annotations

import pytest

import scenarios as S


@pytest.fixture()
def ns(fx):
    return S.seed_two_modules(fx)


def _get(client, path, **params):
    response = client.get(path, params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_compat_nps_mystery_has_no_business_requirement(api_client, ns):
    body = _get(api_client, "/dashboard/nps", survey_type="Mystery Shopper")
    assert body == {"nps": -33.33, "promoters": 0, "detractors": 1, "passives": 2, "total_responses": 3}


@pytest.mark.parametrize("survey_type", [None, "B2B"])
def test_compat_nps_b2b_default_scope_excludes_mystery_and_retired_businesses(api_client, ns, survey_type):
    params = {"survey_type": survey_type} if survey_type else {}
    body = _get(api_client, "/dashboard/nps", **params)
    # Active businesses only (existing compat rule): v1 10, v2 6, v4 8 -> 1/1/1 -> 0.0 (retired b3's v3=9 excluded)
    assert body == {"nps": 0.0, "promoters": 1, "detractors": 1, "passives": 1, "total_responses": 3}


@pytest.mark.parametrize("survey_type", ["all", "bogus"])
def test_compat_nps_unresolved_survey_type_is_empty(api_client, ns, survey_type):
    body = _get(api_client, "/dashboard/nps", survey_type=survey_type)
    assert body["nps"] is None and body["total_responses"] == 0


def test_compat_nps_ignores_out_of_range_scores(api_client, fx):
    fx.answer(fx.b2b_visit(fx.business("A"), "Approved"), "q11_recommend_nps", 10)
    fx.answer(fx.b2b_visit(fx.business("B"), "Approved"), "q11_recommend_nps", 11)
    fx.answer(fx.b2b_visit(fx.business("C"), "Approved"), "q11_recommend_nps", -1)
    body = _get(api_client, "/dashboard/nps", survey_type="B2B")
    assert (body["promoters"], body["detractors"], body["total_responses"], body["nps"]) == (1, 0, 1, 100.0)


def test_compat_nps_matches_analytics_when_population_is_identical(api_client, fx):
    """Parity: active-only compat and /analytics agree when every business is active."""
    for index, score in enumerate((10, 9, 8, 3)):
        fx.answer(fx.b2b_visit(fx.business(f"P{index}"), "Approved"), "q11_recommend_nps", score)
    compat = _get(api_client, "/dashboard/nps", survey_type="B2B")
    analytics = _get(api_client, "/analytics", survey_type="B2B")["nps"]
    for key in ("nps", "promoters", "passives", "detractors", "total_responses"):
        assert compat[key] == analytics[key], key


@pytest.fixture()
def clock_2026(monkeypatch):
    """The seeded scenario is dated 2026; pin the clock there so the YTD default is deterministic."""
    from datetime import date

    from app.api import dashboard_compat

    monkeypatch.setattr(dashboard_compat, "_today", lambda: date(2026, 6, 1))


def test_compat_coverage_counts_each_active_business_once(api_client, ns, clock_2026):
    body = _get(api_client, "/dashboard/coverage", survey_type="B2B")
    # active: b1, b2 (b3 retired); both have approved visits (b1 has two) -> 2 of 2
    assert body["total_active_businesses"] == 2
    assert body["businesses_visited_ytd"] == 2
    assert body["coverage_percent"] == 100.0
    assert body["businesses_not_visited"] == 0


def test_compat_coverage_date_window(api_client, ns):
    body = _get(api_client, "/dashboard/coverage", survey_type="B2B", date_from="2026-03-01", date_to="2026-03-03")
    # only v1 (b1) in window -> 1 of 2 active
    assert (body["total_active_businesses"], body["businesses_visited_ytd"], body["coverage_percent"]) == (2, 1, 50.0)


def test_compat_coverage_is_not_widened_by_unknown_survey_type(api_client, ns, clock_2026):
    body = _get(api_client, "/dashboard/coverage", survey_type="bogus")
    assert body["total_active_businesses"] == 0 and body["businesses_visited_ytd"] == 0


def test_compat_category_breakdown_active_businesses_only(api_client, ns):
    rows = {r["category"]: r for r in _get(api_client, "/dashboard/category-breakdown", survey_type="B2B")}
    # Relationship score questions on active-business approved visits: v1 [8, 9], v2 [6], v4 [10, 5, 7] -> 45 / 6
    assert (rows["Relationship"]["average_score"], rows["Relationship"]["response_count"]) == (7.5, 6)
    # Loyalty: v1 [10, 9], v2 [6, 8], v4 [8, 10] -> 51 / 6
    assert (rows["Loyalty"]["average_score"], rows["Loyalty"]["response_count"]) == (8.5, 6)
    assert not [c for c in rows if c.startswith(("External", "Store", "Staff", "Customer", "Time", "Overall"))]


# ------------------------------------------------------------ admin counters
def test_admin_dashboard_counters(api_client, db, fx, ns):
    from sqlalchemy import text

    for role in ("Representative", "Representative", "Manager", "Admin", "Viewer"):
        db.execute(text("INSERT INTO b2b_users (name, role) VALUES ('u', :r)"), {"r": role})
    body = _get(api_client, "/admin-dashboard/analytics")
    # 8 B2B + 7 Mystery visits across all modules (admin counters are global by design)
    assert body["visits"]["total"] == 15
    assert body["scope"] == {"module": "all", "global": True, "population": "all_rows_all_statuses"}
    assert body["visits"]["draft"] == 2 and body["visits"]["pending"] == 2
    assert body["visits"]["approved"] == 7 and body["visits"]["rejected"] == 2
    visits = body["visits"]
    # every known status bucket partitions the total (Completed/Submitted are legacy labels with no rows)
    assert (visits["draft"] + visits["pending"] + visits["needs_changes"] + visits["approved"] + visits["rejected"]
            + visits["completed"] + visits["submitted"]) == visits["total"]
    assert body["visits"]["completed"] == 0 and body["visits"]["submitted"] == 0  # not workflow statuses
    assert body["visits"]["needs_changes"] == 2
    # b2b_visit_responses rows (admin counters read this one table, mirror rows included):
    #   B2B v1 8 + v2 5 + v3 4 + v4 8 + v5 2 = 27 ; Mystery mirror m1 8 + m2 7 + m3 8 + m4 4 + m5 2 + m6 1 = 30
    assert body["responses"]["total"] == 57
    #   rows with a score: B2B 4+3+3+5+1 = 16 ; Mystery 5+5+5+3+2+1 = 21
    assert body["responses"]["scored"] == 37
    assert body["businesses"] == {"total": 3, "active": 2}
    assert body["users"] == {"total": 5, "representatives": 2, "managers": 1, "admins": 1}


def test_admin_dashboard_text_and_average_ignore_nulls(api_client, db, fx):
    v = fx.b2b_visit(fx.business("Solo"), "Approved")
    fx.answer(v, "q12_overall_satisfaction", 8)
    fx.answer(v, "q11_recommend_nps", 6)
    fx.answer(v, "q01_relationship_strength", None)  # unanswered score row
    fx.answer(v, "q20_comments", None, "hello")
    fx.answer(v, "q16_other_provider_products", None, "")
    body = _get(api_client, "/admin-dashboard/analytics")
    assert body["responses"]["total"] == 5
    assert body["responses"]["scored"] == 2
    assert body["responses"]["avg_score"] == 7.0  # (8 + 6) / 2 - NULL is not a zero observation
    assert body["responses"]["text_responses"] == 1
