"""Mounted role/lifecycle regressions. Identity/DB only are overridden.

Every mutation assertion reads the actual disposable PostgreSQL target back.
"""
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from test_endpoint_module_boundaries import db, ns

ROLES = [(r,) for r in ("CX_SUPER_ADMIN", "B2B_ADMIN", "B2B_SURVEYOR", "MYSTERY_ADMIN", "MYSTERY_SURVEYOR", "INSTALL_ADMIN", "INSTALL_SURVEYOR")] + [(), ("MYSTERY_ADMIN", "B2B_SURVEYOR"), ("B2B_ADMIN", "MYSTERY_SURVEYOR")]
PROGRAMS = [None, "B2B", "MYSTERY", "MYSTERY_SHOPPER", "INSTALL", "unknown"]


def client(db, roles):
    from app.api import visits_dashboard, mystery_shopper, survey, admin_dashboard
    from app.programs.b2b.router import router as b2b
    from app.core.auth.dependencies import get_current_user, require_roles, ALL_PLATFORM_ROLES, MYSTERY_ROLES, B2B_ROLES, DASHBOARD_ROLES
    from app.core.auth.entra import AuthUser
    from app.core.database import get_db
    # Production review metadata omitted from the minimal analytics fixture.
    for column in ("review_timestamp timestamptz", "rejection_notes text", "change_notes text"):
        db.execute(text(f"ALTER TABLE visits ADD COLUMN IF NOT EXISTS {column}"))
    db.commit()
    app = FastAPI()
    for router, guards, prefix in [(visits_dashboard.router, ALL_PLATFORM_ROLES, ""), (mystery_shopper.router, MYSTERY_ROLES, ""), (survey.router, ALL_PLATFORM_ROLES, ""), (admin_dashboard.router, DASHBOARD_ROLES, ""), (b2b, B2B_ROLES, "/b2b")]:
        app.include_router(router, prefix=prefix, dependencies=[Depends(require_roles(*guards))])
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: AuthUser(sub="boundary-admin", name="Boundary Admin", preferred_username="boundary@example.invalid", roles=roles, claims={"auth_mode": "entra"})
    return TestClient(app, raise_server_exceptions=False)


def snapshot(db, visit):
    return db.execute(text("SELECT to_jsonb(v) FROM visits v WHERE id=:v"), {"v": visit}).scalar()


@pytest.mark.parametrize("roles", ROLES)
@pytest.mark.parametrize("program", PROGRAMS)
@pytest.mark.parametrize("module", ["B2B", "MYSTERY"])
@pytest.mark.parametrize("action,target", [("approve", "Approved"), ("reject", "Rejected"), ("needs-changes", "Draft")])
def test_review_fixed_role_matrix(db, ns, roles, program, module, action, target):
    c = client(db, roles)
    visit = ns.v1 if module == "B2B" else ns.m1
    prefix = "/dashboard-visits" if module == "B2B" else "/mystery-shopper/visits"
    db.execute(text("UPDATE visits SET status='Pending' WHERE id=:v"), {"v": visit}); db.commit()
    before = snapshot(db, visit)
    result = c.put(f"{prefix}/{visit}/{action}", params={} if program is None else {"program_code": program}, json={"approval_notes": "review", "rejection_notes": "review", "change_notes": "review"})
    allowed = bool(set(roles) & {"CX_SUPER_ADMIN", module + "_ADMIN"})
    assert result.status_code == (200 if allowed else 403), result.text
    after = snapshot(db, visit)
    if allowed:
        assert after["status"] == target
    else:
        assert after == before


@pytest.mark.parametrize("roles", ROLES)
@pytest.mark.parametrize("program", PROGRAMS)
def test_b2b_workspace_write_and_read_fixed_matrix(db, fx, ns, roles, program):
    c = client(db, roles)
    qid = fx.qid("q12_overall_satisfaction")
    before = db.execute(text("SELECT to_jsonb(r) FROM b2b_visit_responses r WHERE visit_id=:v AND question_id=:q"), {"v": ns.v1, "q": qid}).scalar()
    params = {} if program is None else {"program_code": program}
    result = c.post(f"/dashboard-visits/{ns.v1}/responses", params=params, json={"question_id": qid, "score": 2})
    allowed = bool(set(roles) & {"CX_SUPER_ADMIN", "B2B_ADMIN", "B2B_SURVEYOR"})
    assert result.status_code == (200 if allowed else 403), result.text
    after = db.execute(text("SELECT to_jsonb(r) FROM b2b_visit_responses r WHERE visit_id=:v AND question_id=:q"), {"v": ns.v1, "q": qid}).scalar()
    assert after["score"] == 2 if allowed else after == before
    for path in ("/dashboard-visits/all", "/b2b/visits", "/survey-responses/" + ns.v1):
        read = c.get(path, params=params)
        assert read.status_code == (200 if allowed else 403), (path, read.text)


@pytest.mark.parametrize("roles", [("MYSTERY_ADMIN",), ("MYSTERY_SURVEYOR",), ("INSTALL_ADMIN",), ("INSTALL_SURVEYOR",)])
def test_entire_b2b_router_endpoint_inventory_denies_foreign_roles(db, ns, roles):
    """Audit all methods, not only the original five attack examples."""
    from app.api.visits_dashboard import router as visits
    from app.programs.b2b.router import router as compat
    c = client(db, roles)
    before = snapshot(db, ns.v1)
    answers_before = db.execute(text("SELECT to_jsonb(r) FROM b2b_visit_responses r WHERE visit_id=:v ORDER BY id"), {"v": ns.v1}).scalars().all()
    for router, prefix in [(visits, ""), (compat, "/b2b")]:
        for route in router.routes:
            path = prefix + route.path
            for key, value in {"visit_id": ns.v1, "business_id": str(ns.b1), "ae_id": "1", "response_id": "00000000-0000-0000-0000-000000000001"}.items():
                path = path.replace("{" + key + "}", value)
            for method in route.methods:
                for program in PROGRAMS:
                    response = c.request(method, path, params={} if program is None else {"program_code": program}, json={})
                    assert response.status_code == 403, (method, path, response.text)
    assert snapshot(db, ns.v1) == before
    assert db.execute(text("SELECT to_jsonb(r) FROM b2b_visit_responses r WHERE visit_id=:v ORDER BY id"), {"v": ns.v1}).scalars().all() == answers_before


@pytest.mark.parametrize("status", [None, "Draft", "Pending", "Approved", "Rejected", "unknown"])
def test_compat_create_server_draft_and_update_never_sets_status(db, ns, status):
    c = client(db, ("B2B_SURVEYOR",))
    body = {"business_id": ns.b1, "visit_date": "2026-10-16", "status": status} if status is not None else {"business_id": ns.b1, "visit_date": "2026-10-16"}
    result = c.post("/b2b/visits", json=body)
    assert result.status_code == 201, result.text
    visit = result.json()["id"]
    assert snapshot(db, visit)["status"] == "Draft"
    before = snapshot(db, visit)
    result = c.put(f"/b2b/visits/{visit}", json={"status": status, "visit_type": "Ad-hoc"})
    assert result.status_code == 403, result.text
    assert snapshot(db, visit) == before


@pytest.mark.parametrize("module", ["B2B", "MYSTERY"])
@pytest.mark.parametrize("kind,score,answer,valid", [
    ("score", None, "", False), ("score", None, "10", False), ("score", -1, None, False), ("score", 11, None, False), ("score", 0, None, True), ("score", 10, None, True),
    (None, None, "text", False), (None, 5, None, True),
    ("text", 5, "  ", False), ("text", None, "answered", True),
    ("yes_no", 1, "", False), ("yes_no", None, "maybe", False), ("yes_no", None, "No", True), ("yes_no", None, "Y", True),
    ("always_sometimes_never", None, "garbage", False), ("always_sometimes_never", None, "Monthly", True),
])
def test_completion_uses_answer_validity_not_presence(db, fx, ns, module, kind, score, answer, valid):
    c = client(db, (module + "_SURVEYOR",))
    visit, qid, tid, table, prefix = (ns.v5, fx.qid("q12_overall_satisfaction"), fx.b2b_type_id, "b2b_visit_responses", "/dashboard-visits") if module == "B2B" else (ns.m1, fx.qid("ms_store_cleanliness"), fx.ms_type_id, "mystery_shopper_answers", "/mystery-shopper/visits")
    db.execute(text("UPDATE questions SET is_mandatory=false WHERE survey_type_id=:t"), {"t": tid})
    if kind is None:
        db.execute(text("ALTER TABLE questions ALTER COLUMN input_type DROP NOT NULL"))
    db.execute(text("UPDATE questions SET is_mandatory=true, input_type=:kind, score_min=0, score_max=10 WHERE id=:q"), {"q": qid, "kind": kind})
    db.execute(text(f"DELETE FROM {table} WHERE visit_id=:v AND question_id=:q"), {"v": visit, "q": qid})
    db.execute(text(f"INSERT INTO {table} (visit_id,question_id,score,answer_text) VALUES (:v,:q,:s,:a)"), {"v": visit, "q": qid, "s": score, "a": answer})
    db.execute(text("UPDATE visits SET status='Draft' WHERE id=:v"), {"v": visit}); db.commit()
    before = snapshot(db, visit)
    detail = c.get(f"{prefix}/{visit}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["is_completed"] == valid
    response = c.put(f"{prefix}/{visit}/submit", json={})
    assert response.status_code == (200 if valid else 422), response.text
    assert snapshot(db, visit)["status"] == "Pending" if valid else snapshot(db, visit) == before


@pytest.mark.parametrize("module", ["B2B", "MYSTERY"])
@pytest.mark.parametrize("state", ["Draft", "Pending", "Approved", "Rejected"])
def test_dedicated_lifecycle_transitions(db, ns, module, state):
    c = client(db, (module + "_ADMIN",))
    visit = ns.v1 if module == "B2B" else ns.m1
    prefix = "/dashboard-visits" if module == "B2B" else "/mystery-shopper/visits"
    for action in ("approve", "reject", "needs-changes"):
        db.execute(text("UPDATE visits SET status=:s WHERE id=:v"), {"s": state, "v": visit}); db.commit()
        before = snapshot(db, visit)
        # B2B requires a reason for reject / needs-changes; extra keys are ignored elsewhere.
        notes = {"approval_notes": "ok", "rejection_notes": "reason", "change_notes": "please fix"}
        response = c.put(f"{prefix}/{visit}/{action}", json=notes)
        assert response.status_code == (200 if state == "Pending" else 409), response.text
        if state != "Pending":
            assert snapshot(db, visit) == before
    if state != "Draft":
        db.execute(text("UPDATE visits SET status=:s WHERE id=:v"), {"s": state, "v": visit}); db.commit()
        before = snapshot(db, visit)
        response = c.put(f"{prefix}/{visit}/submit", json={})
        assert response.status_code == 409, response.text
        assert snapshot(db, visit) == before


def test_legacy_unassigned_question_is_required_only_by_b2b(db, fx, ns):
    c = client(db, ("CX_SUPER_ADMIN",))
    db.execute(text("UPDATE questions SET is_mandatory=false"))
    qid = fx.qid("q12_overall_satisfaction")
    db.execute(text("UPDATE questions SET survey_type_id=NULL, is_mandatory=true WHERE id=:q"), {"q": qid})
    db.execute(text("UPDATE visits SET status='Draft' WHERE id IN (:b,:m)"), {"b": ns.v5, "m": ns.m1}); db.commit()
    before = snapshot(db, ns.v5)
    assert c.put(f"/dashboard-visits/{ns.v5}/submit", json={}).status_code == 422
    assert snapshot(db, ns.v5) == before
    assert c.put(f"/mystery-shopper/visits/{ns.m1}/submit", json={}).status_code == 200
