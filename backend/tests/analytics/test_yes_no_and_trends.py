"""Yes/no distributions, AE yes-rate trends and question trends."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient  # noqa: F401  (type of api_client)

import scenarios as S


@pytest.fixture()
def ns(fx):
    return S.seed_two_modules(fx)


def _items(client, path, **params):
    response = client.get(path, params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_yes_no_counts_b2b(api_client, ns):
    items = {i["question_key"]: i for i in _items(api_client, "/analytics/questions/yes-no", survey_type="B2B")["items"]}
    # q16 approved: v1 'Y', v2 'Y', v4 'N' (draft v5 'Y' excluded) ; q04: Yes, Yes, No ; q06: No, Yes
    assert (items["q16_other_provider_products"]["yes_count"], items["q16_other_provider_products"]["no_count"],
            items["q16_other_provider_products"]["total_count"]) == (2, 1, 3)
    assert items["q16_other_provider_products"]["yes_percent"] == 66.67
    assert (items["q04_ae_business_understanding"]["yes_count"], items["q04_ae_business_understanding"]["no_count"]) == (2, 1)
    assert (items["q06_regular_updates"]["yes_count"], items["q06_regular_updates"]["total_count"]) == (1, 2)
    assert not any(k.startswith("ms_") for k in items)


def test_yes_no_counts_mystery(api_client, ns):
    items = {i["question_key"]: i for i in _items(api_client, "/analytics/questions/yes-no", survey_type="Mystery Shopper")["items"]}
    greeted = items["ms_greeted_within_30_seconds"]  # approved: Yes, No, Yes (draft m4 excluded)
    assert (greeted["yes_count"], greeted["no_count"], greeted["total_count"]) == (2, 1, 3)
    assert not any(k.startswith("q") for k in items)


def test_account_executive_yes_rates(api_client, ns):
    items = _items(api_client, "/analytics/account-executives/yes-no-trends", survey_type="B2B")["items"]
    got = {(i["account_executive_name"], i["question_number"]): (i["yes_count"], i["total_count"], i["yes_percent"]) for i in items}
    # Alice: q4 [Yes, No] -> 1/2 ; q6 [No, Yes] -> 1/2 ; Bob: q4 [Yes] -> 1/1
    assert got == {("Alice", 4): (1, 2, 50.0), ("Alice", 6): (1, 2, 50.0), ("Bob", 4): (1, 1, 100.0)}


def test_question_trend_monthly_and_daily(api_client, ns, fx):
    q = fx.qid("q01_relationship_strength")
    monthly = _items(api_client, f"/analytics/questions/{q}/trend", survey_type="B2B", interval="month")
    assert monthly["points"] == [{"period": "2026-03-01", "average_score": 7.0, "response_count": 4}]  # [8,6,4,10]
    daily = _items(api_client, f"/analytics/questions/{q}/trend", survey_type="B2B", interval="day")
    assert [(p["period"], p["average_score"], p["response_count"]) for p in daily["points"]] == [
        ("2026-03-01", 8.0, 1), ("2026-03-05", 6.0, 1), ("2026-03-09", 4.0, 1), ("2026-03-20", 10.0, 1),
    ]


def test_mystery_question_trend_uses_approved_authoritative_answers(api_client, ns, fx):
    q = fx.qid("ms_recommend_outlet_nps")
    daily = _items(api_client, f"/analytics/questions/{q}/trend", survey_type="Mystery Shopper", interval="day")
    assert [(p["period"], p["average_score"]) for p in daily["points"]] == [
        ("2026-03-02", 0.0), ("2026-03-06", 7.0), ("2026-03-12", 8.0),
    ]
