"""Installation Assessor aggregates (characterisation: this code is not changed by the analytics patch)."""

from __future__ import annotations

import pytest
from sqlalchemy import text

from app.api.installation_surveys import get_installation_analytics


@pytest.fixture()
def seeded(db):
    db.execute(text("""CREATE TABLE installation_surveys (
        id SERIAL PRIMARY KEY, date_work_done DATE, customer_type TEXT, job_done_by TEXT,
        contractor_name TEXT, overall_score NUMERIC)"""))
    db.execute(text("""CREATE TABLE installation_survey_responses (
        id SERIAL PRIMARY KEY, survey_id INTEGER, question_number INTEGER, question_key TEXT, score INTEGER)"""))
    db.execute(text("""CREATE TABLE installation_questions (
        question_number INTEGER, question_key TEXT, category TEXT, question_text TEXT, active BOOLEAN)"""))
    db.execute(text("""INSERT INTO installation_questions VALUES
        (1,'inst_q1','Setup','Q1',true),(2,'inst_q2','Safety','Q2',true),(3,'inst_q3','Setup','Q3',false)"""))
    rows = [  # id, date, customer, worker, contractor, overall
        (1, "2026-03-05", "B2B", "Field Team", None, 5),
        (2, "2026-03-06", "B2C", "Contractor", "Acme", 3),
        (3, "2026-04-02", "B2C", "Contractor", "Acme", 4),
        (4, "2026-03-20", "B2B", "Contractor", "Beta", 1),
    ]
    for r in rows:
        db.execute(text("INSERT INTO installation_surveys VALUES (:i,:d,:c,:w,:n,:o)"),
                   dict(zip("idcwno", r)))
    for survey_id, qn, score in [(1, 1, 5), (2, 1, 3), (3, 1, 4), (4, 1, 1), (1, 2, 4), (2, 2, 2)]:
        db.execute(text("INSERT INTO installation_survey_responses (survey_id, question_number, question_key, score) "
                        "VALUES (:s,:q,:k,:sc)"), {"s": survey_id, "q": qn, "k": f"inst_q{qn}", "sc": score})
    from app.core.db_inspect import reset_cache

    reset_cache()


def run(db, **kw):
    return get_installation_analytics(
        date_from=kw.get("date_from"), date_to=kw.get("date_to"), customer_type=kw.get("customer_type"),
        worker_type=kw.get("worker_type"), db=db,
    )


def test_summary_and_segments(db, seeded):
    body = run(db)
    # overall (5 + 3 + 4 + 1) / 4
    assert body["summary"] == {"total_surveys": 4, "overall_average_score": 3.25}
    assert {r["customer_type"]: (r["survey_count"], r["average_score"]) for r in body["customer_type_averages"]} == {
        "B2B": (2, 3.0), "B2C": (2, 3.5)}  # B2B (5+1)/2 ; B2C (3+4)/2
    assert {r["worker_type"]: (r["survey_count"], r["average_score"]) for r in body["worker_type_averages"]} == {
        "Field Team": (1, 5.0), "Contractor": (3, 2.67)}  # (3+4+1)/3
    assert [(r["contractor_name"], r["survey_count"], r["average_score"]) for r in body["contractor_breakdown"]] == [
        ("Acme", 2, 3.5), ("Beta", 1, 1.0)]


def test_question_category_and_trend(db, seeded):
    body = run(db)
    questions = {q["question_number"]: (q["average_score"], q["response_count"]) for q in body["question_averages"]}
    assert questions == {1: (3.25, 4), 2: (3.0, 2)}  # q3 inactive -> not listed
    assert {c["category"]: (c["average_score"], c["response_count"]) for c in body["category_averages"]} == {
        "Setup": (3.25, 4), "Safety": (3.0, 2)}
    assert [(p["period"], p["average_score"], p["survey_count"]) for p in body["monthly_trend"]] == [
        ("2026-03-01", 3.0, 3), ("2026-04-01", 4.0, 1)]  # March (5+3+1)/3 ; April 4


def test_filters(db, seeded):
    assert run(db, customer_type="B2C")["summary"] == {"total_surveys": 2, "overall_average_score": 3.5}
    assert run(db, worker_type="Contractor")["summary"]["total_surveys"] == 3
    window = run(db, date_from="2026-03-06", date_to="2026-03-20")["summary"]
    assert window == {"total_surveys": 2, "overall_average_score": 2.0}  # (3 + 1) / 2


def test_no_data_returns_none_not_zero(db, seeded):
    body = run(db, date_from="2030-01-01")
    assert body["summary"] == {"total_surveys": 0, "overall_average_score": None}
    assert all(r["average_score"] is None for r in body["customer_type_averages"])
