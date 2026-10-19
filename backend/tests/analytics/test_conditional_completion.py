"""Canonical B2B conditional form contract on attested native PostgreSQL.

Only literal catalogue metadata is extracted from seed.py; all acceptance checks
exercise mounted production routes, real guards and SQL, and persisted readback.
"""
import ast
from pathlib import Path

import pytest
from sqlalchemy import text
from test_endpoint_module_boundaries import db, ns
from test_boundary_security import client, snapshot

PARENT = "q16_other_provider_products"
DEPENDENTS = ("q17_competitor_products_services", "q18_competitor_service_with_cws")


@pytest.fixture()
def canonical(db, fx, ns):
    source = Path(__file__).resolve().parents[2] / "scripts" / "seed.py"
    blueprint = next(ast.literal_eval(node.value) for node in ast.parse(source.read_text()).body
                     if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "QUESTION_BLUEPRINT" for t in node.targets))
    # Replace only this test transaction's abbreviated B2B catalogue.
    db.execute(text("DELETE FROM questions WHERE survey_type_id=:t"), {"t": fx.b2b_type_id})
    ids = {}
    for q in blueprint:
        ids[q["question_key"]] = db.execute(text("""INSERT INTO questions
            (survey_type_id,question_key,question_text,category,input_type,score_min,score_max,is_mandatory,order_index,question_number)
            VALUES (:t,:k,:txt,:cat,:kind,:lo,:hi,:mandatory,:ord,:ord) RETURNING id"""),
            dict(t=fx.b2b_type_id, k=q["question_key"], txt=q["question_text"], cat=q["category"], kind=q["input_type"],
                 lo=q.get("score_min"), hi=q.get("score_max"), mandatory=q["is_mandatory"], ord=q["order_index"])).scalar()
        if q["question_key"] not in DEPENDENTS:
            answer = "N" if q["input_type"] == "yes_no" else "Always" if q["input_type"] == "always_sometimes_never" else "Canonical answer"
            db.execute(text("INSERT INTO b2b_visit_responses (visit_id,question_id,score,answer_text) VALUES (:v,:q,:s,:a)"),
                       dict(v=ns.v5, q=ids[q["question_key"]], s=q.get("score_min") if q["input_type"] == "score" else None,
                            a=None if q["input_type"] == "score" else answer))
    db.execute(text("UPDATE visits SET status='Draft' WHERE id=:v"), {"v": ns.v5})
    db.commit()
    return ids, sum(q["is_mandatory"] for q in blueprint)


def test_canonical_no_mounted_submit(db, ns, canonical):
    c = client(db, ("B2B_SURVEYOR",))
    before = snapshot(db, ns.v5)
    db.commit()
    response = c.put(f"/dashboard-visits/{ns.v5}/submit", json={})
    after = snapshot(db, ns.v5)
    assert after["status"] == "Pending" if response.status_code == 200 else after == before
    assert response.status_code == 200, response.text


def set_answer(db, visit, qid, answer, score=None):
    db.execute(text("""INSERT INTO b2b_visit_responses (visit_id,question_id,score,answer_text) VALUES (:v,:q,:s,:a)
        ON CONFLICT (visit_id,question_id) DO UPDATE SET score=EXCLUDED.score, answer_text=EXCLUDED.answer_text"""),
        dict(v=visit, q=qid, s=score, a=answer))
    db.commit()


def check(db, ns, c, expected, total, answered):
    detail = c.get(f"/dashboard-visits/{ns.v5}")
    assert detail.status_code == 200, detail.text
    assert (detail.json()["mandatory_total_count"], detail.json()["mandatory_answered_count"], detail.json()["is_completed"]) == (total, answered, expected == 200)
    for path in ("/dashboard-visits/all", "/dashboard-visits/drafts"):
        result = c.get(path)
        assert result.status_code == 200, result.text
        item = next(x for x in result.json() if x.get("id", x.get("visit_id")) == ns.v5)
        assert (item["mandatory_total_count"], item["mandatory_answered_count"], item["is_completed"]) == (total, answered, expected == 200)
    from app.api.visits_dashboard import build_report_payload
    report = build_report_payload(db, "survey", "B2B", None, ns.v5, None, None, None)
    report_visit = next(x for x in report["visit_details"] if x["visit_id"] == ns.v5)
    assert (report_visit["mandatory_total_count"], report_visit["mandatory_answered_count"]) == (total, answered)
    before = snapshot(db, ns.v5)
    rows = db.execute(text("SELECT to_jsonb(r) FROM b2b_visit_responses r WHERE visit_id=:v ORDER BY id"), {"v": ns.v5}).scalars().all()
    db.commit()
    response = c.put(f"/dashboard-visits/{ns.v5}/submit", json={"skip_conditional": True})
    assert response.status_code == expected, response.text
    assert snapshot(db, ns.v5)["status"] == "Pending" if expected == 200 else snapshot(db, ns.v5) == before
    assert db.execute(text("SELECT to_jsonb(r) FROM b2b_visit_responses r WHERE visit_id=:v ORDER BY id"), {"v": ns.v5}).scalars().all() == rows
    return response


@pytest.mark.parametrize("answer", ["N", "No", " no ", "\tNo\n"])
@pytest.mark.parametrize("bound", [0, 10])
def test_canonical_no_absent_dependents(db, ns, canonical, answer, bound):
    ids, total = canonical
    set_answer(db, ns.v5, ids[PARENT], answer)
    set_answer(db, ns.v5, ids["q01_relationship_strength"], None, bound)
    check(db, ns, client(db, ("B2B_SURVEYOR",)), 200, total - 2, total - 2)


@pytest.mark.parametrize("answer", ["Y", "Yes"])
@pytest.mark.parametrize("dependent_answers", [(None, None), (" ", "maybe"), (None, "No"), ("Competitor fibre", None), ("Competitor fibre", "No")])
def test_canonical_yes_requires_both_valid(db, ns, canonical, answer, dependent_answers):
    ids, total = canonical
    set_answer(db, ns.v5, ids[PARENT], answer)
    for key, value in zip(DEPENDENTS, dependent_answers):
        if value is not None:
            set_answer(db, ns.v5, ids[key], value)
    valid = dependent_answers == ("Competitor fibre", "No")
    count = int(bool((dependent_answers[0] or "").strip())) + int(dependent_answers[1] == "No")
    check(db, ns, client(db, ("B2B_SURVEYOR",)), 200 if valid else 422, total, total - 2 + count)


@pytest.mark.parametrize("answer", [None, "", " ", "maybe", "0", "Nov", "Never"])
def test_invalid_parent_cannot_disable_requirements(db, ns, canonical, answer):
    ids, total = canonical
    set_answer(db, ns.v5, ids[PARENT], answer)
    check(db, ns, client(db, ("B2B_SURVEYOR",)), 422, total, total - 3)


def test_yes_to_no_retains_but_ignores_historical_answers(db, ns, canonical):
    ids, total = canonical
    c = client(db, ("B2B_SURVEYOR",))
    set_answer(db, ns.v5, ids[PARENT], "Yes")
    for key, value in zip(DEPENDENTS, ("Historical provider", "Yes")):
        set_answer(db, ns.v5, ids[key], value)
    set_answer(db, ns.v5, ids[PARENT], "No")
    check(db, ns, c, 200, total - 2, total - 2)


@pytest.mark.parametrize("kind,score,answer", [
    ("score", -1, None), ("score", 11, None), ("score", None, "0"),
    ("text", None, "\t\n"), ("yes_no", 1, "maybe"),
    ("always_sometimes_never", None, "unknown"), ("unknown", None, "not valid"),
])
def test_canonical_integrity_remains_strict(db, ns, canonical, kind, score, answer):
    ids, total = canonical
    qid = ids["q01_relationship_strength"]
    db.execute(text("UPDATE questions SET input_type=:k WHERE id=:q"), dict(k=kind, q=qid))
    set_answer(db, ns.v5, qid, answer, score)
    check(db, ns, client(db, ("B2B_SURVEYOR",)), 422, total - 2, total - 3)


@pytest.mark.parametrize("ownership", ["foreign", "null", "null-visit", "foreign-visit", "ambiguous-parent", "ambiguous-dependent", "missing-parent"])
def test_module_and_stable_key_scope(db, fx, ns, canonical, ownership):
    ids, total = canonical
    c = client(db, ("B2B_SURVEYOR",))
    if ownership == "missing-parent":
        db.execute(text("DELETE FROM questions WHERE id=:q"), {"q": ids[PARENT]})
        total -= 1
    elif ownership == "null":
        db.execute(text("UPDATE questions SET survey_type_id=NULL WHERE id IN (:p,:a,:b)"), dict(p=ids[PARENT], a=ids[DEPENDENTS[0]], b=ids[DEPENDENTS[1]]))
    elif ownership in {"null-visit", "foreign-visit"}:
        db.execute(text("UPDATE visits SET survey_type_id=:t WHERE id=:v"), dict(v=ns.v5, t=None if ownership == "null-visit" else fx.ms_type_id))
        db.commit()
        before = snapshot(db, ns.v5)
        assert c.put(f"/dashboard-visits/{ns.v5}/submit", json={}).status_code == 404
        assert snapshot(db, ns.v5) == before
        return
    else:
        # The fixture's global uniqueness is stronger than deployed legacy catalogues;
        # relax only the isolated transaction to test duplicate module-scoped keys.
        db.execute(text("ALTER TABLE questions DROP CONSTRAINT questions_question_key_key"))
        key = DEPENDENTS[0] if ownership == "ambiguous-dependent" else PARENT
        q = db.execute(text("""INSERT INTO questions (survey_type_id,question_key,question_text,category,input_type,is_mandatory)
            VALUES (:t,:k,'Unrelated localized label','Probe','yes_no',false) RETURNING id"""),
            dict(t=fx.ms_type_id if ownership == "foreign" else fx.b2b_type_id, k=key)).scalar()
        set_answer(db, ns.v5, q, "No")
        if ownership == "foreign":
            set_answer(db, ns.v5, ids[PARENT], "Yes")
    db.commit()
    reject = ownership in {"foreign", "ambiguous-parent", "ambiguous-dependent", "missing-parent"}
    check(db, ns, c, 422 if reject else 200, total if reject else total - 2, total - 2)
