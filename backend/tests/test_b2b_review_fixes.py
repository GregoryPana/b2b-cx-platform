"""
Regression tests for the B2B module review fixes (docs/audits/b2b-module-review-2026-10-26.md).

Covers: business create/update/delete, account executive guards, review-decision
guards, Draft-only visit edits, the pending-count endpoint, and B2B-only access to
the dashboard-visits routes.

Integration tests: they need the B2B tables in a reachable PostgreSQL database and
skip themselves otherwise. Every row they create is tagged and removed afterwards.
"""

import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

TAG = f"zz-fixtest-{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def db():
    from app.core.database import SessionLocal, engine

    if engine.dialect.name != "postgresql":
        pytest.skip("requires PostgreSQL")
    try:
        session = SessionLocal()
        for table in ("businesses", "visits", "meeting_attendees", "users"):
            session.execute(text(f"SELECT 1 FROM {table} LIMIT 1"))
    except Exception:
        pytest.skip("B2B tables not available in the configured database")
    _ensure_b2b_scope(session)
    yield session
    session.rollback()
    session.execute(text("DELETE FROM meeting_attendees WHERE visit_id IN (SELECT v.id FROM visits v JOIN businesses b ON b.id = v.business_id WHERE b.name ILIKE :t)"), {"t": f"{TAG}%"})
    session.execute(text("DELETE FROM visits WHERE business_id IN (SELECT id FROM businesses WHERE name ILIKE :t)"), {"t": f"{TAG}%"})
    session.execute(text("DELETE FROM businesses WHERE name ILIKE :t"), {"t": f"{TAG}%"})
    session.execute(text("DELETE FROM account_executives WHERE email ILIKE :t"), {"t": f"{TAG}%"})
    session.commit()
    session.close()


def _ensure_b2b_scope(session):
    """Add whatever these tests need that a trimmed-down schema lacks (all no-ops on a full database)."""
    session.rollback()
    session.execute(text("CREATE TABLE IF NOT EXISTS survey_types (id SERIAL PRIMARY KEY, name TEXT, code TEXT)"))
    session.execute(text(
        "CREATE TABLE IF NOT EXISTS account_executives "
        "(id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE)"
    ))
    for column in ("location VARCHAR(255)", "account_executive_id INTEGER", "created_at TIMESTAMPTZ DEFAULT now()"):
        session.execute(text(f"ALTER TABLE businesses ADD COLUMN IF NOT EXISTS {column}"))
    for column in ("survey_type_id INTEGER", "review_timestamp TIMESTAMPTZ", "change_notes VARCHAR(2000)"):
        session.execute(text(f"ALTER TABLE visits ADD COLUMN IF NOT EXISTS {column}"))
    session.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS survey_type_id INTEGER"))
    if not session.execute(text("SELECT 1 FROM survey_types WHERE lower(name) = 'b2b'")).scalar():
        session.execute(text("INSERT INTO survey_types (name, code) VALUES ('B2B', 'B2B')"))
    session.commit()


def _b2b_survey_type_id(db):
    return db.execute(text("SELECT id FROM survey_types WHERE lower(name) = 'b2b' LIMIT 1")).scalar()


def _any_user_id(db):
    user_id = db.execute(text("SELECT id FROM users ORDER BY id LIMIT 1")).scalar()
    if user_id is None:
        columns = {row[0] for row in db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"))}
        values = {"name": "Fix Test", "email": f"{TAG}-user@example.com", "role": "Surveyor", "active": True}
        used = [column for column in values if column in columns]
        user_id = db.execute(
            text(f"INSERT INTO users ({', '.join(used)}) VALUES ({', '.join(':' + column for column in used)}) RETURNING id"),
            {column: values[column] for column in used},
        ).scalar()
        db.commit()
    return user_id


def _make_business(client, suffix="", **extra):
    res = client.post("/b2b/businesses", json={"name": f"{TAG} {suffix}".strip(), **extra})
    assert res.status_code == 201, res.text
    return res.json()


def _make_visit(db, business_id, status="Draft", with_attendee=False):
    visit_id = str(uuid.uuid4())
    user_id = _any_user_id(db)
    values = {
        "id": visit_id, "business_id": business_id, "visit_date": date.today(), "visit_type": "Planned",
        "status": status, "representative_id": user_id, "created_by": user_id,
        "survey_type_id": _b2b_survey_type_id(db),
    }
    columns = {row[0] for row in db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'visits'"))}
    used = [column for column in values if column in columns]
    db.execute(
        text(f"INSERT INTO visits ({', '.join(used)}) VALUES ({', '.join(':' + column for column in used)})"),
        {column: values[column] for column in used},
    )
    if with_attendee:
        db.execute(
            text("INSERT INTO meeting_attendees (visit_id, name, role) VALUES (:id, 'Team Mate', 'Team Member')"),
            {"id": visit_id},
        )
    db.commit()
    return visit_id


# --------------------------------------------------------------------- businesses

def test_business_create_validates_and_rejects_duplicates(client, db):
    created = _make_business(client, "dup", location="Victoria")
    assert created["id"] and created["active"] is True

    dup = client.post("/b2b/businesses", json={"name": f"{TAG.upper()}  DUP", "location": "victoria"})
    assert dup.status_code == 409

    blank = client.post("/b2b/businesses", json={"name": "   "})
    assert blank.status_code == 422


def test_business_update_can_clear_location_and_account_executive(client, db):
    ae = client.post("/account-executives", json={"name": "Clear Me", "email": f"{TAG}-clear@example.com"}).json()
    biz = _make_business(client, "clear", location="Mahe", account_executive_id=ae["id"])
    assert biz["account_executive_id"] == ae["id"]

    res = client.put(f"/b2b/businesses/{biz['id']}", json={"location": None, "account_executive_id": None})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["location"] is None
    assert body["account_executive_id"] is None
    assert body["name"] == biz["name"]


def test_business_update_unknown_ae_is_400(client, db):
    biz = _make_business(client, "badae")
    res = client.put(f"/b2b/businesses/{biz['id']}", json={"account_executive_id": 99999999})
    assert res.status_code == 400


def test_business_delete_works_when_visits_have_team_members(client, db):
    biz = _make_business(client, "delete")
    visit_id = _make_visit(db, biz["id"], with_attendee=True)

    summary = client.get(f"/b2b/businesses/{biz['id']}/deletion-summary").json()
    assert summary["related_records"]["total_visits"] == 1
    assert summary["related_records"]["visits_by_status"] == {"Draft": 1}
    assert "total_responses" in summary["related_records"]
    assert summary["can_delete"] is True

    res = client.delete(f"/b2b/businesses/{biz['id']}")
    assert res.status_code == 200, res.text
    assert db.execute(text("SELECT COUNT(*) FROM visits WHERE id = :id"), {"id": visit_id}).scalar() == 0
    assert db.execute(text("SELECT COUNT(*) FROM meeting_attendees WHERE visit_id = :id"), {"id": visit_id}).scalar() == 0


# ------------------------------------------------------------ account executives

def test_account_executive_duplicate_email_and_invalid_email(client, db):
    email = f"{TAG}-dupe@example.com"
    assert client.post("/account-executives", json={"name": "A", "email": email}).status_code == 201
    assert client.post("/account-executives", json={"name": "B", "email": email.upper()}).status_code == 409
    assert client.post("/account-executives", json={"name": "C", "email": "not-an-email"}).status_code == 422


def test_account_executive_delete_blocked_when_assigned(client, db):
    ae = client.post("/account-executives", json={"name": "Busy", "email": f"{TAG}-busy@example.com"}).json()
    biz = _make_business(client, "assigned", account_executive_id=ae["id"])

    blocked = client.delete(f"/account-executives/{ae['id']}")
    assert blocked.status_code == 409
    assert "assigned to 1 business" in blocked.json()["detail"]

    client.put(f"/b2b/businesses/{biz['id']}", json={"account_executive_id": None})
    assert client.delete(f"/account-executives/{ae['id']}").status_code == 204


# ------------------------------------------------------------------ visit guards

def test_draft_edit_only_allowed_on_draft_visits(client, db):
    biz = _make_business(client, "draftguard")
    pending = _make_visit(db, biz["id"], status="Pending")
    draft = _make_visit(db, biz["id"], status="Draft")

    blocked = client.put(f"/dashboard-visits/{pending}/draft", json={"visit_type": "Priority"})
    assert blocked.status_code == 409

    ok = client.put(f"/dashboard-visits/{draft}/draft", json={"visit_type": "Priority"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["visit_type"] == "Priority"


def test_review_decisions_require_pending_status_and_notes(client, db):
    biz = _make_business(client, "review")
    draft = _make_visit(db, biz["id"], status="Draft")
    pending = _make_visit(db, biz["id"], status="Pending")

    assert client.put(f"/dashboard-visits/{draft}/approve", json={}).status_code == 409
    assert client.put(f"/dashboard-visits/{pending}/reject", json={}).status_code == 400
    assert client.put(f"/dashboard-visits/{pending}/needs-changes", json={"change_notes": "  "}).status_code == 400

    changes = client.put(f"/dashboard-visits/{pending}/needs-changes", json={"change_notes": "Fix Q3"})
    assert changes.status_code == 200, changes.text
    row = db.execute(text("SELECT status, change_notes FROM visits WHERE id = :id"), {"id": pending}).one()
    db.rollback()
    assert row[0] == "Draft" and row[1] == "Fix Q3"

    listed = client.get("/dashboard-visits/all", params={"status": "Draft"}).json()
    match = next(item for item in listed if str(item["id"]) == pending)
    assert match["change_notes"] == "Fix Q3"

    # Already back to Draft, so a second decision is refused.
    assert client.put(f"/dashboard-visits/{pending}/approve", json={}).status_code == 409


def test_reject_and_approve_pending(client, db):
    biz = _make_business(client, "decide")
    to_reject = _make_visit(db, biz["id"], status="Pending")
    to_approve = _make_visit(db, biz["id"], status="Pending")

    assert client.put(f"/dashboard-visits/{to_reject}/reject", json={"rejection_notes": "Incomplete"}).status_code == 200
    assert client.put(f"/dashboard-visits/{to_approve}/approve", json={}).status_code == 200
    statuses = dict(db.execute(text("SELECT id::text, status FROM visits WHERE id IN (:a, :b)"), {"a": to_reject, "b": to_approve}).all())
    db.rollback()
    assert statuses == {to_reject: "Rejected", to_approve: "Approved"}


def test_pending_count_endpoint(client, db):
    biz = _make_business(client, "count")
    before = client.get("/dashboard-visits/pending-count").json()["count"]
    _make_visit(db, biz["id"], status="Pending")
    after = client.get("/dashboard-visits/pending-count").json()["count"]
    assert after == before + 1


def test_dashboard_visits_closed_to_non_b2b_roles(app, db):
    from app.core.auth.dependencies import get_current_user
    from app.core.auth.entra import AuthUser

    original = app.dependency_overrides[get_current_user]
    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        sub="mystery-only",
        name="Mystery Admin",
        preferred_username="mystery@test.example.com",
        roles=("MYSTERY_ADMIN",),
        claims={"roles": ["MYSTERY_ADMIN"]},
    )
    try:
        other = TestClient(app, raise_server_exceptions=False)
        assert other.get("/dashboard-visits/all").status_code == 403
        assert other.get("/dashboard-visits/actions").status_code == 403
        assert other.get("/dashboard-visits/pending-count").status_code == 403
    finally:
        app.dependency_overrides[get_current_user] = original
