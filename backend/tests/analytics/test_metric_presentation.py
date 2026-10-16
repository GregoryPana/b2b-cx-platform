"""Traffic-light thresholds: backend report levels must match the shared contract the dashboard tests use."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

CONTRACT = json.loads((Path(__file__).parent / "metric_threshold_contract.json").read_text())

# backend level name -> contract tone
TONE = {"high": "good", "mid": "warning", "low": "bad", "neutral": "neutral"}


def _level(metric, value):
    from app.api import mystery_shopper as ms

    fn = {
        "mystery_nps": ms.mystery_nps_level,
        "mystery_csat": ms.mystery_csat_level,
        "mystery_overall_experience": ms.mystery_overall_experience_level,
        "mystery_quality": ms.mystery_quality_level,
    }[metric]
    return TONE[fn(value)]


@pytest.mark.parametrize("metric,value,tone", [
    (m, case["value"], case["tone"]) for m, cases in CONTRACT["metrics"].items() for case in cases
])
def test_mystery_levels_match_contract(metric, value, tone):
    assert _level(metric, value) == tone


def test_mystery_csat_not_graded_on_percent_scale():
    """Regression: 0-10 CSAT of 8.33 used to be graded against the B2B percent rule (>=80) and showed red."""
    assert _level("mystery_csat", 8.33) == "good"
    assert _level("mystery_csat", 6.0) == "warning"
    assert _level("mystery_csat", 5.99) == "bad"


@pytest.mark.parametrize("metric,value,tone", [
    ("nps", 50, "good"), ("nps", 49.9, "warning"), ("nps", 0, "warning"), ("nps", -0.1, "bad"),
    ("csat", 80, "good"), ("csat", 79.99, "warning"), ("csat", 60, "warning"), ("csat", 59.9, "bad"),
    ("relationship_score", 80, "good"), ("relationship_score", 60, "warning"), ("relationship_score", 10, "bad"),
    ("competitor_exposure", 20, "good"), ("competitor_exposure", 40, "warning"), ("competitor_exposure", 40.1, "bad"),
    ("nps", None, "neutral"), ("csat", "", "neutral"),
])
def test_b2b_thresholds_preserved(metric, value, tone):
    from app.core.traffic_light import get_b2b_metric_grade

    assert get_b2b_metric_grade(metric, value)["tone"] == tone


@pytest.mark.parametrize("value,tone", [(5, "good"), (4, "good"), (3.99, "warning"), (3, "warning"), (2.99, "bad"), (None, "neutral")])
def test_installation_thresholds_preserved(value, tone):
    from app.core.traffic_light import get_installation_metric_grade

    assert get_installation_metric_grade(value)["tone"] == tone
