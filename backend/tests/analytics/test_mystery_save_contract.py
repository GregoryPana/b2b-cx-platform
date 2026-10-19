"""Mystery Save contract against mounted role guards and attested native PostgreSQL.

Auth identity and DB session are fixture substitutions; no customer data/auth bypass
is introduced in application source. POST's mirror ID is deliberately not reused:
the workspace must GET the authoritative answer ID before PUT.
"""
import pytest
from sqlalchemy import text
from test_endpoint_module_boundaries import db, ns  # savepoint-owned fixtures
from test_boundary_security import client


@pytest.fixture()
def contract(db, fx, ns):
    visit = fx.mystery_visit(ns.l1, "Draft")
    db.commit()
    return client(db, ("MYSTERY_SURVEYOR",)), visit


def detail(c, visit):
    result = c.get(f"/mystery-shopper/visits/{visit}")
    assert result.status_code == 200, result.text
    return result.json()


def answers(db, visit):
    return {
        table: db.execute(text(f"SELECT to_jsonb(r) FROM {table} r WHERE visit_id=:v ORDER BY question_id"), {"v": visit}).scalars().all()
        for table in ("mystery_shopper_answers", "b2b_visit_responses")
    }


@pytest.mark.parametrize("key,first,second", [
    ("ms_recommend_outlet_nps", {"score": 0}, {"score": 9}),
    ("ms_final_comments", {"answer_text": "Initial comment"}, {"answer_text": "Revised comment"}),
    ("ms_greeted_within_30_seconds", {"answer_text": "Y"}, {"answer_text": "N"}),
])
def test_mystery_save_contract_post_get_put_retry_keeps_one_authority_and_mirror(db, fx, contract, key, first, second):
    c, visit = contract
    qid = fx.qid(key)
    root = f"/mystery-shopper/visits/{visit}/responses"
    payload = {"question_id": qid, "verbatim": "Synthetic save contract", "actions": [], **first}
    post = c.post(root, json=payload)
    assert post.status_code == 200, post.text
    fresh = detail(c, visit)
    assert fresh["status"] == "Draft"
    row = next(r for r in fresh["responses"] if r["question_id"] == qid)
    for field, value in first.items():
        assert row[field] == value
    assert row["verbatim"] == payload["verbatim"]
    authoritative_id = row["response_id"]
    original_ids = {table: rows[0]["id"] for table, rows in answers(db, visit).items()}
    payload.update(second)
    put = c.put(f"{root}/{authoritative_id}", json=payload)
    assert put.status_code == 200, put.text
    for _ in range(2):
        retry = c.post(root, json=payload)
        assert retry.status_code == 200, retry.text
    fresh = detail(c, visit)
    assert len(fresh["responses"]) == 1
    row = fresh["responses"][0]
    assert row["response_id"] == authoritative_id
    for field, value in second.items():
        assert row[field] == value
    for table, rows in answers(db, visit).items():
        assert len(rows) == 1
        assert rows[0]["id"] == original_ids[table]
        for field, value in second.items():
            assert rows[0][field] == value
        assert rows[0]["verbatim"] == payload["verbatim"]
        assert rows[0]["actions"] == []
    assert detail(c, visit)["status"] == "Draft"


def test_mystery_save_contract_end_save_partial_then_required_failure_keeps_answers(db, fx, contract):
    c, visit = contract
    # Canonical questionnaire mandatory flags are retained, not reduced to a
    # one-question fixture that would conceal missing-question behaviour.
    qid = fx.qid("ms_recommend_outlet_nps")
    root = f"/mystery-shopper/visits/{visit}"
    result = c.post(root + "/responses", json={"question_id": qid, "score": 0})
    assert result.status_code == 200, result.text
    before = answers(db, visit)
    submitted = c.put(root + "/submit")
    assert submitted.status_code == 422, submitted.text
    assert submitted.json()["detail"]["missing_questions"]
    assert detail(c, visit)["status"] == "Draft"
    assert answers(db, visit) == before
    assert detail(c, visit)["responses"][0]["score"] == 0


@pytest.mark.parametrize("attack", ["foreign_question_post", "foreign_question_put", "foreign_visit", "foreign_owner", "foreign_role", "invalid_score"])
def test_mystery_save_contract_rejected_writes_leave_both_stores_unchanged(db, fx, ns, contract, attack):
    c, visit = contract
    qid = fx.qid("ms_recommend_outlet_nps")
    root = f"/mystery-shopper/visits/{visit}"
    assert c.post(root + "/responses", json={"question_id": qid, "score": 0}).status_code == 200
    rid = detail(c, visit)["responses"][0]["response_id"]
    if attack == "foreign_owner":
        db.execute(text("INSERT INTO users (id,name,email) VALUES (2,'Other synthetic shopper','other@example.invalid') ON CONFLICT (id) DO NOTHING"))
        db.execute(text("UPDATE visits SET representative_id=2 WHERE id=:v"), {"v": visit})
        db.commit()
    before = answers(db, visit)
    payload = {"question_id": qid, "score": 8}
    endpoint, method, expected = root + "/responses", "post", 404
    if attack.startswith("foreign_question"):
        payload["question_id"] = fx.qid("q12_overall_satisfaction")
        if attack.endswith("put"):
            endpoint += "/" + rid
            method = "put"
    elif attack == "foreign_visit":
        endpoint = f"/mystery-shopper/visits/{ns.v5}/responses"
    elif attack == "foreign_owner":
        expected = 403
    elif attack == "foreign_role":
        c = client(db, ("B2B_SURVEYOR",))
        expected = 403
    else:
        payload["score"] = 11
        expected = 400
    result = getattr(c, method)(endpoint, json=payload)
    assert result.status_code == expected, result.text
    assert answers(db, visit) == before
    if attack != "foreign_owner":
        assert detail(contract[0], visit)["responses"][0]["score"] == 0
