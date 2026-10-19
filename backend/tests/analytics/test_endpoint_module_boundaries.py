"""Adversarial endpoint assurance for B2B/Mystery/Installation boundaries.

Runs against the guarded disposable PostgreSQL fixture. These tests exercise the
real list/detail/review/action/report SQL, including ID-addressed foreign-module
attempts and mixed-module rows on otherwise valid visits.
"""

from __future__ import annotations

import asyncio
import json
from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy import text

import scenarios as S


def run(coro):
    return asyncio.run(coro)


@pytest.fixture()
def db(pg_engine):
    # Endpoint handlers commit/rollback; savepoints keep every request inside
    # this test's owned outer transaction, including rejected writes.
    from sqlalchemy.orm import Session
    from app.core.db_inspect import reset_cache
    reset_cache()
    with pg_engine.connect() as connection:
        outer = connection.begin()
        session = Session(bind=connection, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            session.close()
            outer.rollback()
            reset_cache()


@pytest.fixture()
def ns(fx):
    ns = S.seed_two_modules(fx)
    fx.db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email text UNIQUE"))
    fx.db.execute(text("INSERT INTO users (id, name, email) VALUES (1, 'Boundary Admin', 'boundary@example.invalid') ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email"))
    fx.db.commit()  # release seed savepoint; handler rollback must not erase fixture rows
    return ns


@pytest.fixture()
def admin_user():
    from app.core.auth.entra import AuthUser

    return AuthUser(
        sub="boundary-admin",
        name="Boundary Admin",
        preferred_username="boundary@example.invalid",
        roles=("CX_SUPER_ADMIN", "B2B_ADMIN", "MYSTERY_ADMIN"),
        claims={"auth_mode": "entra"},
    )


def b2b_list(db):
    from app.api.visits_dashboard import get_all_visits

    return get_all_visits(db=db)


def mystery_list(db):
    from app.api.mystery_shopper import list_mystery_admin_visits

    return run(list_mystery_admin_visits(db=db))


def b2b_report(db):
    from app.api.visits_dashboard import build_report_payload

    return build_report_payload(db, "lifetime", "B2B", None, None, None, None, None)


def mystery_report(db):
    from app.api.mystery_shopper import build_mystery_report_payload

    return build_mystery_report_payload(db, "lifetime", None, None, None, None, None)


def action_payload(label: str) -> str:
    return json.dumps([
        {
            "action_required": label,
            "action_owner": "Owner",
            "action_timeframe": "<1 month",
            "action_support_needed": "Support",
            "action_status": "Outstanding",
        }
    ])


def test_mixed_module_injection_leaves_lists_counts_queues_and_reports_unchanged(db, fx, ns):
    """Injecting Mystery and Installation rows cannot alter either module's consumers."""
    from app.api.visits_dashboard import fetch_dashboard_actions

    db.execute(
        text("UPDATE b2b_visit_responses SET actions=CAST(:a AS jsonb) WHERE visit_id=CAST(:v AS uuid) "
             "AND question_id=:q"),
        {"a": action_payload("B2B baseline"), "v": ns.v1, "q": fx.qid("q12_overall_satisfaction")},
    )

    before_b2b_list = b2b_list(db)
    before_mystery_list = mystery_list(db)
    before_b2b_report = b2b_report(db)
    before_mystery_report = mystery_report(db)
    before_actions = fetch_dashboard_actions(db, "B2B", None, None, None, None, None)

    installation_id = fx.add_survey_type("Installation Assessment", "installation")
    installation_visit = str(
        db.execute(
            text("""INSERT INTO visits
                  (business_id, representative_id, survey_type_id, visit_date, status)
                  VALUES (:business, 1, :survey_type, :visit_date, 'Approved') RETURNING id"""),
            {"business": ns.b1, "survey_type": installation_id, "visit_date": date(2026, 4, 20)},
        ).scalar()
    )
    installation_question = db.execute(
        text("""INSERT INTO questions
              (survey_type_id, question_number, order_index, category, question_key, question_text,
               input_type, score_min, score_max, is_nps, is_mandatory)
              VALUES (:survey_type, 1, 1, 'Installation', 'install_boundary_probe',
                      'Installation probe', 'score', 1, 5, false, true) RETURNING id"""),
        {"survey_type": installation_id},
    ).scalar()
    db.execute(
        text("""INSERT INTO b2b_visit_responses
              (visit_id, question_id, score, actions)
              VALUES (CAST(:visit AS uuid), :question, 5, CAST(:actions AS jsonb))"""),
        {"visit": installation_visit, "question": installation_question,
         "actions": action_payload("Installation must stay separate")},
    )
    # Give the Installation visit Mystery-shaped metadata and an authoritative
    # Mystery answer as an adversarial association; visit ownership must still win.
    db.execute(
        text("""INSERT INTO mystery_shopper_assessments
              (visit_id, location_id, visit_time, purpose_of_visit, staff_on_duty, shopper_name)
              VALUES (CAST(:visit AS uuid), :location, '11:00', 'Billing', 'Probe', 'Probe')"""),
        {"visit": installation_visit, "location": ns.l1},
    )
    db.execute(
        text("""INSERT INTO mystery_shopper_answers (visit_id, question_id, score)
              VALUES (CAST(:visit AS uuid), :question, 10)"""),
        {"visit": installation_visit, "question": fx.qid("ms_recommend_outlet_nps")},
    )

    # Bad question ownership on valid visits must not inflate list counts or reports.
    fx.answer(ns.v1, "ms_store_cleanliness", 1)
    fx.answer(ns.m1, "q12_overall_satisfaction", 1, table="mystery_shopper_answers")
    db.execute(
        text("UPDATE b2b_visit_responses SET actions=CAST(:a AS jsonb) WHERE visit_id=CAST(:v AS uuid) "
             "AND question_id=:q"),
        {"a": action_payload("Mystery mirror must not enter B2B actions"), "v": ns.m1,
         "q": fx.qid("ms_recommend_outlet_nps")},
    )

    assert b2b_list(db) == before_b2b_list
    assert mystery_list(db) == before_mystery_list
    assert b2b_report(db) == before_b2b_report
    assert mystery_report(db) == before_mystery_report
    assert fetch_dashboard_actions(db, "B2B", None, None, None, None, None) == before_actions


def test_selected_foreign_visit_and_question_ids_fail_closed_on_details_and_writes(db, fx, ns, admin_user):
    from app.api.mystery_shopper import (
        MysteryResponsePayload,
        approve_mystery_visit,
        create_mystery_response,
        get_mystery_visit_detail,
    )
    from app.api.visits_dashboard import approve_visit, create_response, get_visit_detail

    with pytest.raises(HTTPException) as error:
        get_visit_detail(ns.m1, db=db, current_user=admin_user)
    assert error.value.status_code == 404

    with pytest.raises(HTTPException) as error:
        run(get_mystery_visit_detail(ns.v1, db=db, current_user=admin_user))
    assert error.value.status_code == 404

    with pytest.raises(HTTPException) as error:
        create_response(
            ns.v1,
            {"question_id": fx.qid("ms_store_cleanliness"), "score": 4},
            db=db,
            current_user=admin_user,
        )
    assert error.value.status_code == 404

    with pytest.raises(HTTPException) as error:
        run(create_mystery_response(
            ns.m1,
            MysteryResponsePayload(question_id=fx.qid("q12_overall_satisfaction"), score=9),
            db=db,
            current_user=admin_user,
        ))
    assert error.value.status_code == 404

    with pytest.raises(HTTPException) as error:
        approve_visit(ns.m1, {}, db=db, _manager_access=True)
    assert error.value.status_code == 404
    with pytest.raises(HTTPException) as error:
        run(approve_mystery_visit(ns.v1, {}, db=db))
    assert error.value.status_code == 404

    statuses = dict(db.execute(
        text("SELECT CAST(id AS text), CAST(status AS text) FROM visits WHERE id IN (CAST(:b AS uuid), CAST(:m AS uuid))"),
        {"b": ns.v1, "m": ns.m1},
    ).all())
    assert statuses == {ns.v1: "Approved", ns.m1: "Approved"}


def test_action_status_cannot_mutate_mystery_mirror_response(db, fx, ns):
    from app.api.visits_dashboard import ActionStatusUpdateRequest, update_action_status

    db.execute(
        text("UPDATE b2b_visit_responses SET actions=CAST(:a AS jsonb) WHERE visit_id=CAST(:v AS uuid) "
             "AND question_id=:q"),
        {"a": action_payload("Mystery action"), "v": ns.m1, "q": fx.qid("ms_recommend_outlet_nps")},
    )
    response_id, before = db.execute(
        text("SELECT CAST(id AS text), actions FROM b2b_visit_responses "
             "WHERE visit_id=CAST(:v AS uuid) AND question_id=:q"),
        {"v": ns.m1, "q": fx.qid("ms_recommend_outlet_nps")},
    ).one()

    with pytest.raises(HTTPException) as error:
        update_action_status(
            ActionStatusUpdateRequest(response_id=response_id, action_index=0, status="Completed"),
            db=db,
            _current_user=object(),
        )
    assert error.value.status_code == 404
    after = db.execute(
        text("SELECT actions FROM b2b_visit_responses WHERE CAST(id AS text)=:response_id"),
        {"response_id": response_id},
    ).scalar()
    assert after == before


def test_selected_foreign_visit_ids_are_rejected_by_both_report_builders(db, ns):
    from app.api.mystery_shopper import build_mystery_report_payload
    from app.api.visits_dashboard import build_report_payload

    with pytest.raises(HTTPException) as b2b_error:
        build_report_payload(db, "survey", "B2B", None, ns.m1, None, None, None)
    assert b2b_error.value.status_code == 400

    with pytest.raises(HTTPException) as mystery_error:
        build_mystery_report_payload(db, "survey", None, ns.v1, None, None, None)
    assert mystery_error.value.status_code == 400


def test_unknown_and_installation_scope_never_widen_b2b_lists_or_actions(db, fx, ns):
    from app.api.visits_dashboard import fetch_dashboard_actions, get_all_visits

    installation_id = fx.add_survey_type("Installation Assessment", "installation")
    for survey_type in ("unknown-module", "all", "Installation Assessment"):
        with pytest.raises(HTTPException) as error:
            get_all_visits(survey_type=survey_type, db=db)
        assert error.value.status_code == 400
        with pytest.raises(HTTPException) as error:
            fetch_dashboard_actions(db, survey_type, None, None, None, None, None)
        assert error.value.status_code == 400

    with pytest.raises(HTTPException) as error:
        get_all_visits(survey_type_id=installation_id, db=db)
    assert error.value.status_code == 400


@pytest.fixture()
def boundary_client(db, admin_user):
    """Exercise routing, UUID serialization and existing dependencies as an admin.

    Only identity is overridden; production role dependencies remain installed.
    Auth lifecycle itself is covered by the separate existing auth suite.
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api import mystery_shopper, survey, visits_dashboard
    from app.core.auth.dependencies import get_current_user
    from app.core.database import get_db

    app = FastAPI()
    for module in (visits_dashboard, mystery_shopper, survey):
        app.include_router(module.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: admin_user
    with TestClient(app) as client:
        yield client


@pytest.mark.parametrize("status", ["Draft", "Pending"])
def test_queue_membership_and_counts_in_both_directions(db, fx, ns, admin_user, status):
    from app.api import mystery_shopper as m, visits_dashboard as b, survey as s

    db.execute(text("UPDATE visits SET status=:s"), {"s": status})
    def queues():
        return (
            b.get_draft_visits(db=db) if status == "Draft" else b.get_pending_visits(db=db),
            run(m.list_mystery_drafts(db=db, current_user=admin_user)) if status == "Draft"
            else run(m.list_mystery_admin_visits(status=status, db=db)),
            run(s.get_draft_visits(db=db)) if status == "Draft" else [],
        )
    before = queues()
    assert {str(v["visit_id"]) for v in before[0]} == {ns.v1, ns.v2, ns.v3, ns.v4, ns.v5, ns.v6, ns.v7, ns.v8}
    assert {str(v["id"]) for v in before[1]} == {ns.m1, ns.m2, ns.m3, ns.m4, ns.m5, ns.m6, ns.m7}
    if status == "Draft":
        assert {str(v["id"]) for v in before[2]} == {ns.v1, ns.v2, ns.v3, ns.v4, ns.v5, ns.v6, ns.v7, ns.v8}
    fx.answer(ns.v1, "ms_store_cleanliness", 1)
    fx.answer(ns.m1, "q12_overall_satisfaction", 1, table="mystery_shopper_answers")
    fx.answer(ns.m1, "q12_overall_satisfaction", 1)  # corrupt shared mirror used by draft counts
    assert queues() == before


@pytest.mark.parametrize("module", ["b2b", "mystery"])
@pytest.mark.parametrize("action", ["approve", "reject", "needs-changes", "submit"])
def test_http_review_and_submission_reject_foreign_visits_without_writes(boundary_client, db, ns, module, action):
    root = "/dashboard-visits" if module == "b2b" else "/mystery-shopper/visits"
    foreign_id = ns.m1 if module == "b2b" else ns.v1
    before = db.execute(text("SELECT row_to_json(v) FROM visits v WHERE id=:id"), {"id": foreign_id}).scalar()
    response = boundary_client.put(f"{root}/{foreign_id}/{action}", json={})
    assert response.status_code == 404, response.text
    after = db.execute(text("SELECT row_to_json(v) FROM visits v WHERE id=:id"), {"id": foreign_id}).scalar()
    assert after == before


@pytest.mark.parametrize("path", ["visits", "survey-responses", "survey-actions"])
def test_legacy_survey_uuid_routes_are_scoped_and_work_for_b2b(boundary_client, db, fx, ns, path):
    db.execute(text("UPDATE b2b_visit_responses SET actions=CAST(:a AS jsonb) WHERE visit_id=:v AND question_id=:q"),
               {"a": action_payload("B2B action"), "v": ns.v1, "q": fx.qid("q12_overall_satisfaction")})
    response = boundary_client.get(f"/{path}/{ns.m1}")
    assert response.status_code == 404, response.text
    response = boundary_client.get(f"/{path}/{ns.v1}")
    assert response.status_code == 200, response.text
    assert response.json()  # not a swallowed SQL error / placeholder empty response
    before = response.json()
    fx.answer(ns.v1, "ms_store_cleanliness", 1)
    assert boundary_client.get(f"/{path}/{ns.v1}").json() == before


def test_legacy_history_questions_and_drafts_have_explicit_module_scope(boundary_client, db, fx, ns):
    b_questions = boundary_client.get("/questions", params={"survey_type": "B2B"})
    m_questions = boundary_client.get("/questions", params={"survey_type": "Mystery Shopper"})
    assert b_questions.status_code == m_questions.status_code == 200
    assert fx.qid("q12_overall_satisfaction") in {q["id"] for q in b_questions.json()}
    assert fx.qid("ms_store_cleanliness") not in {q["id"] for q in b_questions.json()}
    assert fx.qid("q12_overall_satisfaction") not in {q["id"] for q in m_questions.json()}
    assert m_questions.json()
    assert boundary_client.get("/questions?survey_type=unknown").status_code == 400
    history = boundary_client.get("/historical-surveys")
    assert history.status_code == 200
    assert {v["id"] for v in history.json()} == {ns.v1, ns.v2, ns.v3, ns.v4}
    fx.answer(ns.v1, "ms_store_cleanliness", 1)
    assert boundary_client.get("/historical-surveys").json() == history.json()
    drafts = boundary_client.get("/visits/drafts")
    assert drafts.status_code == 200, drafts.text
    assert {v["id"] for v in drafts.json()} == {ns.v5}
    assert boundary_client.put(f"/visits/{ns.m1}", json={}).status_code == 404


@pytest.mark.parametrize("module", ["b2b", "mystery"])
@pytest.mark.parametrize("format", ["export", "pdf"])
def test_http_report_downloads_reject_foreign_ids_before_rendering(boundary_client, ns, module, format):
    root = "/dashboard-visits" if module == "b2b" else "/mystery-shopper"
    foreign_id = ns.m1 if module == "b2b" else ns.v1
    response = boundary_client.get(f"{root}/reports/{format}", params={
        "report_type": "survey", "visit_id": foreign_id, "download": "true"})
    assert response.status_code == 400, response.text
    assert "does not belong" in response.json()["detail"]


@pytest.mark.parametrize("module", ["b2b", "mystery"])
def test_response_id_cannot_retarget_foreign_question_on_valid_visit(db, fx, ns, admin_user, module):
    from app.api import mystery_shopper as m, visits_dashboard as b

    if module == "b2b":
        fx.answer(ns.v1, "ms_store_cleanliness", 1)
        table, visit_id, foreign_q, own_q = "b2b_visit_responses", ns.v1, "ms_store_cleanliness", "q11_recommend_nps"
    else:
        fx.answer(ns.m1, "q12_overall_satisfaction", 1, table="mystery_shopper_answers")
        table, visit_id, foreign_q, own_q = "mystery_shopper_answers", ns.m1, "q12_overall_satisfaction", "ms_recommend_outlet_nps"
    # Pick a valid own question absent from the selected visit to avoid a unique
    # collision masking an illicit question-retargeting write.
    db.execute(text(f"DELETE FROM {table} WHERE visit_id=:v AND question_id=:q"),
               {"v": visit_id, "q": fx.qid(own_q)})
    response_id = str(db.execute(text(f"SELECT id FROM {table} WHERE visit_id=:v AND question_id=:q"),
                                {"v": visit_id, "q": fx.qid(foreign_q)}).scalar())
    db.commit()  # persist injected row within outer test transaction before handler rollback
    before = db.execute(text(f"SELECT row_to_json(r) FROM {table} r WHERE CAST(id AS text)=:r"), {"r": response_id}).scalar()
    with pytest.raises(HTTPException) as error:
        if module == "b2b":
            b.update_response(visit_id, response_id, {"question_id": fx.qid(own_q), "score": 8}, db=db, current_user=admin_user)
        else:
            run(m.update_mystery_response(visit_id, response_id, m.MysteryResponsePayload(question_id=fx.qid(own_q), score=8), db=db, current_user=admin_user))
    assert error.value.status_code == 404
    after = db.execute(text(f"SELECT row_to_json(r) FROM {table} r WHERE CAST(id AS text)=:r"), {"r": response_id}).scalar()
    assert after == before


@pytest.mark.parametrize("module", ["b2b", "mystery"])
def test_details_and_html_downloads_exclude_foreign_answers(boundary_client, db, fx, ns, module):
    root = "/dashboard-visits" if module == "b2b" else "/mystery-shopper/visits"
    report_root = "/dashboard-visits" if module == "b2b" else "/mystery-shopper"
    visit_id = ns.v1 if module == "b2b" else ns.m1
    detail = boundary_client.get(f"{root}/{visit_id}")
    assert detail.status_code == 200, detail.text
    report_params = {"report_type": "survey", "visit_id": visit_id}
    report = boundary_client.get(f"{report_root}/reports/export", params=report_params)
    assert report.status_code == 200, report.text
    if module == "b2b":
        fx.answer(visit_id, "ms_store_cleanliness", 1, "FOREIGN_BOUNDARY_SECRET")
    else:
        fx.answer(visit_id, "q12_overall_satisfaction", 1, "FOREIGN_BOUNDARY_SECRET", table="mystery_shopper_answers")
    assert boundary_client.get(f"{root}/{visit_id}").json() == detail.json()
    after = boundary_client.get(f"{report_root}/reports/export", params=report_params)
    assert after.json()["report"] == report.json()["report"]
    downloaded = boundary_client.get(f"{report_root}/reports/export", params={**report_params, "download": "true"})
    assert downloaded.status_code == 200, downloaded.text
    assert "attachment" in downloaded.headers["content-disposition"]
    assert "FOREIGN_BOUNDARY_SECRET" not in downloaded.text
    assert "<html" in downloaded.text.lower()


@pytest.mark.parametrize("module", ["b2b", "mystery"])
@pytest.mark.parametrize("attempt", ["foreign_visit", "foreign_question", "foreign_response"])
def test_http_answer_writes_reject_foreign_ownership(boundary_client, db, fx, ns, module, attempt):
    own_visit, foreign_visit = (ns.v1, ns.m1) if module == "b2b" else (ns.m1, ns.v1)
    own_q, foreign_q = ("q11_recommend_nps", "ms_store_cleanliness") if module == "b2b" else ("ms_recommend_outlet_nps", "q12_overall_satisfaction")
    root = "/dashboard-visits" if module == "b2b" else "/mystery-shopper/visits"
    table = "b2b_visit_responses" if module == "b2b" else "mystery_shopper_answers"
    before = db.execute(text(f"SELECT row_to_json(r) FROM {table} r ORDER BY id")).scalars().all()
    if attempt == "foreign_response":
        # Another visit's valid response ID must not be accepted for the own visit.
        other = ns.v2 if module == "b2b" else ns.m2
        response_id = db.execute(text(f"SELECT id FROM {table} WHERE visit_id=:v AND question_id=:q"),
                                 {"v": other, "q": fx.qid(own_q)}).scalar()
        response = boundary_client.put(f"{root}/{own_visit}/responses/{response_id}", json={"question_id": fx.qid(own_q), "score": 7})
    else:
        response = boundary_client.post(f"{root}/{foreign_visit if attempt == 'foreign_visit' else own_visit}/responses",
                                        json={"question_id": fx.qid(foreign_q if attempt == 'foreign_question' else own_q), "score": 7})
    assert response.status_code == 404, response.text
    assert db.execute(text(f"SELECT row_to_json(r) FROM {table} r ORDER BY id")).scalars().all() == before


@pytest.mark.parametrize("action", ["draft", "delete", "header"])
def test_header_and_draft_mutations_reject_foreign_visits(boundary_client, db, ns, action):
    if action == "header":
        response = boundary_client.put(f"/mystery-shopper/visits/{ns.v1}/header", json={"location_id": ns.l1, "visit_time": "11:00", "purpose_of_visit": "Billing", "staff_on_duty": "Probe", "shopper_name": "Foreign edit"})
    elif action == "draft":
        response = boundary_client.put(f"/dashboard-visits/{ns.m1}/draft", json={"visit_date": "2026-05-01"})
    else:
        response = boundary_client.delete(f"/dashboard-visits/{ns.m1}")
    assert response.status_code == 404, response.text
    assert db.execute(text("SELECT COUNT(*) FROM visits WHERE id IN (:b, :m)"), {"b": ns.v1, "m": ns.m1}).scalar() == 2


def test_report_selection_lists_exclude_cross_associations(boundary_client, db, fx, ns):
    b = boundary_client.get("/dashboard-visits/reports/surveys", params={"business_id": ns.b1})
    m = boundary_client.get("/mystery-shopper/reports/surveys", params={"location_id": ns.l1})
    assert b.status_code == m.status_code == 200
    db.execute(text("UPDATE visits SET business_id=:b WHERE id=:v"), {"b": ns.b1, "v": ns.m1})
    db.execute(text("INSERT INTO mystery_shopper_assessments (visit_id, location_id, visit_time, purpose_of_visit, staff_on_duty, shopper_name) VALUES (:v, :l, '11:00', 'Billing', 'Probe', 'Probe')"), {"v": ns.v1, "l": ns.l1})
    assert boundary_client.get("/dashboard-visits/reports/surveys", params={"business_id": ns.b1}).json() == b.json()
    assert boundary_client.get("/mystery-shopper/reports/surveys", params={"location_id": ns.l1}).json() == m.json()


@pytest.mark.parametrize("module", ["b2b", "mystery"])
def test_email_report_rejects_foreign_visit_before_smtp(boundary_client, ns, monkeypatch, module):
    from app.api import mystery_shopper as m, visits_dashboard as b

    def unexpected_smtp(*args, **kwargs):
        pytest.fail("foreign-module report must never reach SMTP")
    monkeypatch.setenv("SMTP_HOST", "smtp.invalid")
    monkeypatch.setenv("SMTP_FROM", "boundary@example.invalid")
    monkeypatch.setattr(b.smtplib, "SMTP", unexpected_smtp)
    monkeypatch.setattr(b.smtplib, "SMTP_SSL", unexpected_smtp)
    root = "/dashboard-visits" if module == "b2b" else "/mystery-shopper"
    response = boundary_client.post(f"{root}/reports/email", json={
        "to": ["nobody@example.com"], "report_type": "survey",
        "visit_id": ns.m1 if module == "b2b" else ns.v1,
    })
    assert response.status_code == 400, response.text
    assert "does not belong" in response.json()["detail"]


@pytest.mark.parametrize("module", ["b2b", "mystery"])
def test_valid_response_update_still_works_and_mystery_keeps_mirror(db, fx, ns, admin_user, module):
    from app.api import mystery_shopper as m, visits_dashboard as b
    table, visit_id, question = ("b2b_visit_responses", ns.v1, "q11_recommend_nps") if module == "b2b" else ("mystery_shopper_answers", ns.m1, "ms_recommend_outlet_nps")
    qid = fx.qid(question)
    response_id = str(db.execute(text(f"SELECT id FROM {table} WHERE visit_id=:v AND question_id=:q"), {"v": visit_id, "q": qid}).scalar())
    if module == "b2b":
        updated = b.update_response(visit_id, response_id, {"question_id": qid, "score": 7}, db=db, current_user=admin_user)
    else:
        updated = run(m.update_mystery_response(visit_id, response_id, m.MysteryResponsePayload(question_id=qid, score=7), db=db, current_user=admin_user))
    assert updated["score"] == 7
    assert db.execute(text(f"SELECT score FROM {table} WHERE visit_id=:v AND question_id=:q"), {"v": visit_id, "q": qid}).scalar() == 7
    if module == "mystery":
        assert db.execute(text("SELECT score FROM b2b_visit_responses WHERE visit_id=:v AND question_id=:q"), {"v": visit_id, "q": qid}).scalar() == 7


def test_b2b_business_selector_requires_approved_b2b_not_mystery_visit(db, fx, ns, admin_user):
    from app.programs.b2b.router import list_businesses_public

    # Only disposable fixture DDL: production schema is not modified.
    db.execute(text("ALTER TABLE businesses ADD COLUMN location text"))
    db.execute(text("ALTER TABLE businesses ADD COLUMN account_executive_id integer"))
    before = list_businesses_public(with_approved_surveys=True, db=db, current_user=admin_user)
    assert {b["id"] for b in before} == {ns.b1, ns.b2, ns.b3}
    mystery_only_business = fx.business("Mystery association, not B2B survey")
    db.execute(text("UPDATE visits SET business_id=:b WHERE id=:v"), {"b": mystery_only_business, "v": ns.m1})
    assert list_businesses_public(with_approved_surveys=True, db=db, current_user=admin_user) == before
