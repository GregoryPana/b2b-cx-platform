"""Legacy mounted-path assurance. Identity/DB overrides only; real role guards.

Every rejected mutation reads back the target and its children. Global admin
visibility is deliberately tested as global, not advertised as module isolation.
"""
import csv
from io import StringIO

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text

from test_endpoint_module_boundaries import db, ns, admin_user  # noqa: F401


@pytest.fixture()
def management(db, admin_user):
    from app.api.admin_dashboard import router as admin_router
    from app.programs.b2b.router import router as b2b_router
    from app.core.auth.dependencies import get_current_user, require_roles, DASHBOARD_ROLES, B2B_ROLES
    from app.core.database import get_db
    db.execute(text("ALTER TABLE businesses ADD COLUMN IF NOT EXISTS location text"))
    db.execute(text("ALTER TABLE businesses ADD COLUMN IF NOT EXISTS account_executive_id integer"))
    db.execute(text("ALTER TABLE businesses ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now()"))
    db.execute(text("ALTER TABLE visits ADD COLUMN IF NOT EXISTS assessment_instance_id integer"))
    db.commit()
    app = FastAPI()
    # Match main.py's mount-level guards as well as handler guards.
    app.include_router(admin_router, dependencies=[Depends(require_roles(*DASHBOARD_ROLES))])
    app.include_router(b2b_router, prefix="/b2b", dependencies=[Depends(require_roles(*B2B_ROLES))])
    identity = {"user": admin_user}
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: identity["user"]
    with TestClient(app) as client:
        yield client, identity


def as_role(identity, role):
    from app.core.auth.entra import AuthUser
    identity["user"] = AuthUser(sub="boundary-admin", name="Boundary Admin",
        preferred_username="boundary@example.invalid", roles=(role,), claims={"auth_mode": "entra"})


def get(client, path, **params):
    r = client.get(path, params=params)
    assert r.status_code == 200, r.text
    return r.json()


def snapshot(db, visit_id):
    return {
        table: [dict(r) for r in db.execute(text(
            f"SELECT * FROM {table} WHERE {'id' if table == 'visits' else 'visit_id'}=:id ORDER BY id"
        ), {"id": visit_id}).mappings().all()]
        for table in ("visits", "b2b_visit_responses", "mystery_shopper_answers", "mystery_shopper_assessments")
    }


def test_b2b_compat_crud_has_real_positive_paths_and_foreign_id_denials(management, db, fx, ns):
    c, _ = management
    foreign_before = snapshot(db, ns.m1)
    # Force a foreign association onto an ordinary B2B business.
    db.execute(text("UPDATE visits SET business_id=:b WHERE id=:id"), {"b": ns.b1, "id": ns.m1})
    db.commit()
    foreign_before = snapshot(db, ns.m1)
    own = get(c, "/b2b/visits")
    assert ns.v1 in {r["id"] for r in own}
    assert not {ns.m1, ns.m2} & {r["id"] for r in own}
    assert ns.m1 not in {r["id"] for r in get(c, f"/b2b/businesses/{ns.b1}/visits")}
    for method, payload in (("get", None), ("put", {"status": "Rejected"}), ("delete", None)):
        r = c.request(method, f"/b2b/visits/{ns.m1}", json=payload)
        assert r.status_code == 404, r.text
        assert snapshot(db, ns.m1) == foreign_before
    db.execute(text("UPDATE visits SET assessment_instance_id=712 WHERE id=:v"), {"v": ns.v1})
    assert get(c, f"/b2b/visits/{ns.v1}")["assessment_instance_id"] == 712
    own_before = snapshot(db, ns.v1)
    r = c.put(f"/b2b/visits/{ns.v1}", json={"status": "Needs Changes"})
    assert r.status_code == 403, r.text
    assert snapshot(db, ns.v1) == own_before
    # Non-Draft headers are locked; creation below supplies the editable positive path.
    r = c.put(f"/b2b/visits/{ns.v1}", json={"visit_date": "2026-10-19"})
    assert r.status_code == 409, r.text
    assert snapshot(db, ns.v1) == own_before
    r = c.post("/b2b/visits", json={"business_id": ns.b1, "visit_date": "2026-10-01", "visit_type": "Planned", "representative_id": 999999, "survey_type_id": fx.ms_type_id})
    assert r.status_code == 201, r.text
    created = r.json()["id"]
    r = c.put(f"/b2b/visits/{created}", json={"visit_date": "2026-10-19"})
    assert r.status_code == 200, r.text
    assert get(c, f"/b2b/visits/{created}")["visit_date"] == "2026-10-19"
    row = db.execute(text("SELECT survey_type_id, representative_id FROM visits WHERE id=:id"), {"id": created}).one()
    assert row[0] == fx.b2b_type_id and row[1] != 999999
    fx.answer(created, "q12_overall_satisfaction", 8)
    db.commit()
    assert c.delete(f"/b2b/visits/{created}").status_code == 204
    assert not snapshot(db, created)["b2b_visit_responses"]
    assert db.execute(text("SELECT id FROM visits WHERE id=:id"), {"id": created}).first() is None
    assert snapshot(db, ns.m1) == foreign_before


@pytest.mark.parametrize("ownership", ["mystery", "installation", "null"])
def test_business_cascade_denies_foreign_visits_even_without_assessment(management, db, fx, ns, ownership):
    c, _ = management
    business = fx.business("Cascade foreign probe")
    foreign = fx.b2b_visit(business)
    type_id = {"mystery": fx.ms_type_id, "installation": fx.add_survey_type("Installation Assessment", "installation"), "null": None}[ownership]
    db.execute(text("UPDATE visits SET survey_type_id=:t WHERE id=:id"), {"t": type_id, "id": foreign})
    own = fx.b2b_visit(business)
    fx.answer(own, "q12_overall_satisfaction", 8)
    fx.answer(foreign, "ms_store_cleanliness", 1)
    db.commit()
    before = snapshot(db, foreign)
    own_before = snapshot(db, own)
    summary = get(c, f"/b2b/businesses/{business}/deletion-summary")["related_records"]
    assert summary["total_visits"] == 1
    assert [v["id"] for v in summary["visits"]] == [own]
    assert summary["deletion_blocked"] is True
    r = c.delete(f"/b2b/businesses/{business}")
    assert r.status_code == 409, r.text
    assert snapshot(db, foreign) == before
    assert snapshot(db, own) == own_before
    assert db.execute(text("SELECT 1 FROM businesses WHERE id=:b"), {"b": business}).scalar() == 1


def test_business_cascade_positive_and_mystery_assessment_guard(management, db, fx, ns):
    c, _ = management
    business = fx.business("Owned cascade")
    own = fx.b2b_visit(business)
    fx.answer(own, "q12_overall_satisfaction", 8)
    db.commit()
    foreign_before = snapshot(db, ns.m1)
    summary = get(c, f"/b2b/businesses/{business}/deletion-summary")["related_records"]
    assert summary["total_visits"] == 1 and summary["deletion_blocked"] is False
    r = c.delete(f"/b2b/businesses/{business}")
    assert r.status_code == 200, r.text
    assert r.json()["deleted_response_count"] == 1
    assert not snapshot(db, own)["visits"]
    assert not snapshot(db, own)["b2b_visit_responses"]
    assert snapshot(db, ns.m1) == foreign_before
    # A Mystery assessment attached to a B2B-owned visit must still block the cascade.
    db.execute(text("UPDATE visits SET business_id=:b WHERE id=:id"), {"b": ns.b1, "id": ns.m1})
    db.execute(text("UPDATE visits SET survey_type_id=:t WHERE id=:id"), {"t": fx.b2b_type_id, "id": ns.m1})
    db.commit()
    before = snapshot(db, ns.m1)
    assert c.delete(f"/b2b/businesses/{ns.b1}").status_code == 409
    assert snapshot(db, ns.m1) == before


@pytest.mark.parametrize("module,own_key,foreign_key", [("B2B", "v1", "m1"), ("Mystery Shopper", "m1", "v1")])
def test_admin_scoped_reads_exports_and_foreign_ids(management, db, fx, ns, module, own_key, foreign_key):
    c, _ = management
    own, foreign = getattr(ns, own_key), getattr(ns, foreign_key)
    # Cross-module question contamination must not enter module-specific exports/detail.
    fx.answer(ns.v1, "ms_store_cleanliness", 1)
    fx.answer(ns.m1, "q12_overall_satisfaction", 1, table="mystery_shopper_answers")
    rows = get(c, "/admin-dashboard/visits", survey_type=module)
    assert own in {r["id"] for r in rows["visits"]}
    assert foreign not in {r["id"] for r in rows["visits"]}
    assert rows["pagination"]["total"] == len(rows["visits"])
    assert rows["scope"]["global"] is False
    detail = get(c, f"/admin-dashboard/visits/{own}", survey_type=module)
    assert detail["responses"]
    assert c.get(f"/admin-dashboard/visits/{foreign}", params={"survey_type": module}).status_code == 404
    exported = get(c, "/admin-dashboard/export/responses", survey_type=module)
    assert exported["total_count"] == len(exported["responses"]) > 0
    listed = get(c, "/admin-dashboard/responses", survey_type=module, limit=1000)
    assert listed["responses"] == exported["responses"]
    expected_type = (fx.ms_type_id if own_key == "m1" else fx.b2b_type_id)
    qtypes = dict(db.execute(text("SELECT id, survey_type_id FROM questions")).all())
    assert all(qtypes[r["question_id"]] == expected_type for r in exported["responses"])
    assert all(r["visit_id"] != foreign for r in exported["responses"])
    csv_body = get(c, "/admin-dashboard/export/responses", survey_type=module, format="csv")
    csv_rows = list(csv.DictReader(StringIO(csv_body["data"])))
    assert len(csv_rows) == csv_body["total_count"] == exported["total_count"]
    assert {r["response_id"] for r in csv_rows} == {r["response_id"] for r in exported["responses"]}
    # Detail uses authoritative Mystery score, not a divergent mirror.
    if own_key == "m1":
        qid = fx.qid("ms_store_cleanliness")
        db.execute(text("UPDATE b2b_visit_responses SET score=1 WHERE visit_id=:v AND question_id=:q"), {"v": own, "q": qid})
        detail2 = get(c, f"/admin-dashboard/visits/{own}", survey_type=module)
        assert detail2["responses"] == detail["responses"]


@pytest.mark.parametrize("role,module,own_key,foreign_key", [("B2B_ADMIN", "B2B", "v1", "m1"), ("MYSTERY_ADMIN", "Mystery Shopper", "m1", "v1")])
def test_admin_write_policy_scoped_positive_foreign_denial_global_denial(management, db, fx, ns, role, module, own_key, foreign_key):
    c, identity = management
    as_role(identity, role)
    own, foreign = getattr(ns, own_key), getattr(ns, foreign_key)
    before = snapshot(db, foreign)
    # Valid module administrator cannot turn program_code into cross-module or global authority.
    for params in ({}, {"program_code": "all"}, {"program_code": "Mystery"}):
        assert c.delete(f"/admin-dashboard/visits/{foreign}", params=params).status_code == 403
    assert c.delete(f"/admin-dashboard/visits/{foreign}", params={"survey_type": module}).status_code == 404
    assert snapshot(db, foreign) == before
    response = get(c, f"/admin-dashboard/visits/{own}", survey_type=module)["responses"][0]
    foreign_responses = before["mystery_shopper_answers" if own_key == "v1" else "b2b_visit_responses"]
    rid = str(foreign_responses[0]["id"])
    assert c.delete(f"/admin-dashboard/responses/{rid}", params={"survey_type": module}).status_code == 404
    assert snapshot(db, foreign) == before
    assert c.delete(f"/admin-dashboard/responses/{response['response_id']}", params={"survey_type": module}).status_code == 200
    assert response["response_id"] not in {r["response_id"] for r in get(c, f"/admin-dashboard/visits/{own}", survey_type=module)["responses"]}
    if own_key == "m1":
        assert db.execute(text("SELECT 1 FROM b2b_visit_responses WHERE visit_id=:v AND question_id=:q"), {"v": own, "q": response["question_id"]}).first() is None
    assert c.delete(f"/admin-dashboard/visits/{own}", params={"survey_type": module}).status_code == 200
    assert not snapshot(db, own)["visits"]
    assert not snapshot(db, own)["b2b_visit_responses"]
    assert not snapshot(db, own)["mystery_shopper_answers"]
    assert snapshot(db, foreign) == before


@pytest.mark.parametrize("module,role,foreign_key,total", [("B2B", "B2B_ADMIN", "m1", 8), ("Mystery Shopper", "MYSTERY_ADMIN", "v1", 7)])
def test_scoped_purge_preview_and_execution(management, db, ns, module, role, foreign_key, total):
    c, identity = management
    as_role(identity, role)
    before = snapshot(db, getattr(ns, foreign_key))
    params = {"before_date": "2027-01-01", "survey_type": module}
    preview = c.delete("/admin-dashboard/visits/purge", params=params)
    assert preview.status_code == 200, preview.text
    assert preview.json()["visits_to_delete"] == total
    assert c.delete("/admin-dashboard/visits/purge", params={"before_date": "2027-01-01"}).status_code == 403
    assert snapshot(db, getattr(ns, foreign_key)) == before
    result = c.delete("/admin-dashboard/visits/purge", params={**params, "dry_run": False})
    assert result.status_code == 200, result.text
    assert result.json()["visits_deleted"] == total
    assert get(c, "/admin-dashboard/visits", survey_type=module)["pagination"]["total"] == 0
    assert snapshot(db, getattr(ns, foreign_key)) == before


@pytest.mark.parametrize("role", ["B2B_ADMIN", "MYSTERY_ADMIN", "INSTALL_ADMIN", "CX_SUPER_ADMIN"])
def test_global_read_role_contract_is_explicit_not_module_exclusive(management, db, ns, role):
    c, identity = management
    as_role(identity, role)
    rows = get(c, "/admin-dashboard/visits")
    assert rows["scope"] == {"module": "all", "global": True}
    assert {ns.v1, ns.m1} <= {r["id"] for r in rows["visits"]}
    assert get(c, "/admin-dashboard/analytics")["visits"]["total"] == 15
    exported = get(c, "/admin-dashboard/export/responses")
    assert {ns.v1, ns.m1} <= {r["visit_id"] for r in exported["responses"]}
    assert exported["scope"]["global"] is True
    # Search by business has an exact filtered count; no unfiltered total.
    missing = get(c, "/admin-dashboard/search/visits", query="does-not-exist")
    assert missing["pagination"]["total"] == 0 and not missing["visits"]
    by_representative = get(c, "/admin-dashboard/search/visits", query="Boundary Admin", limit=5)
    assert by_representative["pagination"]["total"] == 15
    assert len(by_representative["visits"]) == 5 and by_representative["pagination"]["has_more"] is True


@pytest.mark.parametrize("role", ["B2B_SURVEYOR", "MYSTERY_SURVEYOR", "INSTALL_SURVEYOR"])
def test_non_admin_roles_cannot_use_global_admin_surfaces(management, ns, role):
    c, identity = management
    as_role(identity, role)
    for path in ("/", "/analytics", "/visits", f"/visits/{ns.m1}", "/responses", "/export/responses", "/search/visits?query=anything"):
        assert c.get("/admin-dashboard" + path).status_code == 403
    assert c.delete(f"/admin-dashboard/visits/{ns.m1}").status_code == 403


@pytest.mark.parametrize("value", ["", "all", "bogus", "Installation Assessment"])
def test_admin_explicit_invalid_scopes_never_fall_back_to_global(management, ns, value):
    c, _ = management
    for path in ("/visits", "/responses", "/export/responses", f"/visits/{ns.v1}"):
        assert c.get("/admin-dashboard"+path, params={"survey_type": value}).status_code == 400
    assert c.delete(f"/admin-dashboard/visits/{ns.v1}", params={"survey_type": value}).status_code == 400


def test_global_super_admin_delete_and_module_role_mismatch(management, db, ns):
    c, identity = management
    as_role(identity, "B2B_ADMIN")
    assert c.get("/admin-dashboard/visits", params={"survey_type": "Mystery Shopper"}).status_code == 403
    as_role(identity, "MYSTERY_ADMIN")
    assert c.get("/admin-dashboard/export/responses", params={"survey_type": "B2B"}).status_code == 403
    assert c.get("/b2b/visits").status_code == 403
    as_role(identity, "CX_SUPER_ADMIN")
    before = snapshot(db, ns.v1)
    assert c.delete(f"/admin-dashboard/visits/{ns.m1}").status_code == 200
    assert all(not rows for rows in snapshot(db, ns.m1).values())
    assert snapshot(db, ns.v1) == before


@pytest.mark.parametrize("ownership", ["installation", "null"])
def test_compat_visits_exclude_unknown_and_third_module_ownership(management, db, fx, ns, ownership):
    c, _ = management
    foreign = fx.b2b_visit(ns.b1)
    type_id = fx.add_survey_type("Installation Assessment", "installation") if ownership == "installation" else None
    db.execute(text("UPDATE visits SET survey_type_id=:t WHERE id=:id"), {"t": type_id, "id": foreign})
    fx.answer(foreign, "q12_overall_satisfaction", 8)
    db.commit()
    before = snapshot(db, foreign)
    assert foreign not in {v["id"] for v in get(c, "/b2b/visits")}
    for method, payload in (("get", None), ("put", {"status": "Rejected"}), ("delete", None)):
        assert c.request(method, f"/b2b/visits/{foreign}", json=payload).status_code == 404
        assert snapshot(db, foreign) == before


def test_b2b_fixed_admin_guard_cannot_be_switched_with_program_code(management, db, ns):
    from app.core.auth.entra import AuthUser
    c, identity = management
    identity["user"] = AuthUser(sub="mixed-roles", name="Mixed Roles", preferred_username="mixed@example.invalid",
        roles=("B2B_SURVEYOR", "MYSTERY_ADMIN"), claims={"auth_mode": "entra"})
    before = snapshot(db, ns.v1)
    assert get(c, f"/b2b/visits/{ns.v1}")["id"] == ns.v1
    assert c.delete(f"/b2b/visits/{ns.v1}", params={"program_code": "Mystery"}).status_code == 403
    assert c.delete(f"/b2b/businesses/{ns.b1}", params={"program_code": "Mystery"}).status_code == 403
    assert snapshot(db, ns.v1) == before


def test_mystery_location_reference_also_blocks_business_cascade(management, db, fx, ns):
    c, _ = management
    business = fx.business("Mystery location shared parent")
    db.execute(text("UPDATE mystery_shopper_locations SET business_id=:b WHERE id=:l"), {"b": business, "l": ns.l1})
    db.commit()
    before = snapshot(db, ns.m1)
    summary = get(c, f"/b2b/businesses/{business}/deletion-summary")["related_records"]
    assert summary["total_visits"] == 0 and summary["deletion_blocked"] is True
    assert c.delete(f"/b2b/businesses/{business}").status_code == 409
    assert snapshot(db, ns.m1) == before
    assert db.execute(text("SELECT business_id FROM mystery_shopper_locations WHERE id=:l"), {"l": ns.l1}).scalar() == business


def test_global_super_admin_response_delete_synchronizes_mystery_and_purge_is_explicit(management, db, fx, ns):
    c, identity = management
    as_role(identity, "CX_SUPER_ADMIN")
    before = snapshot(db, ns.v1)
    rid, qid = db.execute(text("SELECT id, question_id FROM b2b_visit_responses WHERE visit_id=:v ORDER BY question_id LIMIT 1"), {"v": ns.m1}).one()
    assert c.delete(f"/admin-dashboard/responses/{rid}").status_code == 200
    for table in ("b2b_visit_responses", "mystery_shopper_answers"):
        assert db.execute(text(f"SELECT 1 FROM {table} WHERE visit_id=:v AND question_id=:q"), {"v": ns.m1, "q": qid}).first() is None
    assert snapshot(db, ns.v1) == before
    preview = c.delete("/admin-dashboard/visits/purge", params={"before_date": "2027-01-01"})
    assert preview.status_code == 200 and preview.json()["visits_to_delete"] == 15
    assert preview.json()["scope"] == {"module": "all", "global": True}
    assert snapshot(db, ns.v1) == before
    result = c.delete("/admin-dashboard/visits/purge", params={"before_date": "2027-01-01", "dry_run": False})
    assert result.status_code == 200 and result.json()["visits_deleted"] == 15
    assert all(not r for r in snapshot(db, ns.m1).values())
    assert all(not r for r in snapshot(db, ns.v1).values())
    assert get(c, "/admin-dashboard/visits")["pagination"]["total"] == 0


@pytest.mark.parametrize("route_kind", ["b2b_visit", "b2b_business", "admin_b2b", "admin_mystery"])
def test_legacy_response_action_children_are_scoped_and_deleted_without_fk_cascade(management, db, fx, ns, route_kind):
    c, _ = management
    # Native legacy FK shapes: neither relationship has ON DELETE CASCADE.
    db.execute(text("CREATE TABLE responses (id serial PRIMARY KEY, visit_id uuid NOT NULL REFERENCES visits(id), question_id integer)"))
    db.execute(text("CREATE TABLE response_actions (id serial PRIMARY KEY, response_id integer NOT NULL REFERENCES responses(id), action_required text)"))
    own, foreign = (ns.m1, ns.v1) if route_kind == "admin_mystery" else (ns.v1, ns.m1)
    def seed(v):
        rid = db.execute(text("INSERT INTO responses (visit_id) VALUES (:v) RETURNING id"), {"v": v}).scalar_one()
        aid = db.execute(text("INSERT INTO response_actions (response_id, action_required) VALUES (:r, 'preserve exact owner') RETURNING id"), {"r": rid}).scalar_one()
        return rid, aid
    own_rid, own_aid = seed(own)
    foreign_rid, foreign_aid = seed(foreign)
    db.commit()
    before = snapshot(db, foreign)
    if route_kind == "b2b_business":
        response = c.delete(f"/b2b/businesses/{ns.b1}")
    elif route_kind == "b2b_visit":
        response = c.delete(f"/b2b/visits/{own}")
    else:
        response = c.delete(f"/admin-dashboard/visits/{own}", params={"survey_type": "Mystery Shopper" if route_kind == "admin_mystery" else "B2B"})
    assert response.status_code in {200, 204}, response.text
    assert db.execute(text("SELECT 1 FROM responses WHERE id=:r"), {"r": own_rid}).first() is None
    assert db.execute(text("SELECT 1 FROM response_actions WHERE id=:r"), {"r": own_aid}).first() is None
    assert db.execute(text("SELECT visit_id FROM responses WHERE id=:r"), {"r": foreign_rid}).scalar_one() == __import__('uuid').UUID(foreign)
    assert db.execute(text("SELECT action_required FROM response_actions WHERE id=:r"), {"r": foreign_aid}).scalar_one() == "preserve exact owner"
    assert snapshot(db, foreign) == before
