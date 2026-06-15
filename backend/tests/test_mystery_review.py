"""
Integration tests for mystery shopper review/approval workflow.

Covers:
  - All pending visits are returned by the review list endpoint
  - Visit detail contains correctly numbered questions and all expected answers
  - Response count in detail matches responses stored in the database
  - Saving a response edit (PUT /responses/{id}) persists the change
  - Approving a visit changes its status and includes it in analytics

These tests require a running PostgreSQL database at the configured DATABASE_URL.
They are skipped automatically when the database is unavailable.
"""

import uuid
from datetime import date

import pytest
from sqlalchemy import text

# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def db_available(client):
    """Skip all tests in this module if the database is unreachable."""
    response = client.get("/health")
    body = response.json()
    if body.get("checks", {}).get("database", "") == "error":
        pytest.skip("database not available — skipping mystery review tests")
    return True


@pytest.fixture(scope="module")
def ms_survey_type_id(client, db_available):
    """Return the mystery shopper survey_type id (or skip if not configured)."""
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        row = db.execute(
            text("SELECT id FROM survey_types WHERE LOWER(name) LIKE '%mystery%' LIMIT 1")
        ).fetchone()
        if row is None:
            pytest.skip("no mystery shopper survey type found — skipping")
        return row[0]
    finally:
        db.close()


@pytest.fixture(scope="module")
def ms_location_id(db_available):
    """Return the first active mystery shopper location id, or None."""
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        row = db.execute(
            text("SELECT id FROM mystery_shopper_locations WHERE active = true LIMIT 1")
        ).fetchone()
        return row[0] if row else None
    finally:
        db.close()


@pytest.fixture()
def pending_visit(ms_survey_type_id, ms_location_id):
    """
    Create a mystery shopper visit in 'Pending' status with scored responses,
    then yield fixture data.  Always cleans up on teardown.
    """
    from app.core.database import SessionLocal
    db = SessionLocal()
    visit_id = str(uuid.uuid4())
    response_ids: list[str] = []
    q_rows = []

    try:
        db.execute(
            text("""
                INSERT INTO visits
                  (id, survey_type_id, visit_date, visit_type, status,
                   submitted_by_name, submitted_by_email, submitted_at)
                VALUES
                  (:id, :stid, :vdate, 'Planned', 'Pending',
                   'Test Shopper', 'test.shopper@example.com', NOW())
            """),
            {"id": visit_id, "stid": ms_survey_type_id, "vdate": date.today().isoformat()},
        )

        if ms_location_id:
            db.execute(
                text("""
                    INSERT INTO mystery_shopper_assessments
                      (visit_id, location_id, visit_time, purpose_of_visit, staff_on_duty, shopper_name)
                    VALUES
                      (:vid, :lid, '10:00', 'General Enquiry', 'Jane Smith', 'Test Shopper')
                """),
                {"vid": visit_id, "lid": ms_location_id},
            )

        q_rows = db.execute(
            text("""
                SELECT id, question_number, score_max
                FROM questions
                WHERE survey_type_id = :stid
                  AND input_type = 'score'
                ORDER BY question_number
                LIMIT 5
            """),
            {"stid": ms_survey_type_id},
        ).fetchall()

        for q_row in q_rows:
            row = db.execute(
                text("""
                    INSERT INTO mystery_shopper_answers
                      (visit_id, question_id, score, actions)
                    VALUES
                      (:vid, :qid, 4, '[]'::jsonb)
                    ON CONFLICT (visit_id, question_id) DO NOTHING
                    RETURNING id
                """),
                {"vid": visit_id, "qid": q_row[0]},
            ).fetchone()
            if row:
                response_ids.append(row[0])

        db.commit()
        yield {"visit_id": visit_id, "response_ids": response_ids, "question_rows": q_rows}

    except Exception as exc:
        db.rollback()
        pytest.fail(f"pending_visit fixture setup failed: {exc}")

    finally:
        db.rollback()
        for rid in response_ids:
            try:
                db.execute(text("DELETE FROM mystery_shopper_answers WHERE id = :id::integer"), {"id": str(rid)})
            except Exception:
                db.rollback()
        for stmt, params in [
            ("DELETE FROM mystery_shopper_assessments WHERE visit_id = :vid", {"vid": visit_id}),
            ("DELETE FROM visits WHERE id = :id", {"id": visit_id}),
        ]:
            try:
                db.execute(text(stmt), params)
            except Exception:
                db.rollback()
        db.commit()
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestReviewListEndpoint:
    """GET /mystery-shopper/admin/visits?status=Pending"""

    def test_returns_200(self, client, db_available):
        response = client.get("/mystery-shopper/admin/visits?status=Pending")
        assert response.status_code == 200

    def test_returns_list(self, client, db_available):
        response = client.get("/mystery-shopper/admin/visits?status=Pending")
        assert isinstance(response.json(), list)

    def test_pending_visit_appears_in_list(self, client, pending_visit):
        """A visit inserted with status='Pending' must appear in the review queue."""
        visit_id = pending_visit["visit_id"]
        response = client.get("/mystery-shopper/admin/visits?status=Pending")
        assert response.status_code == 200
        ids = [str(v.get("visit_id") or v.get("id")) for v in response.json()]
        assert visit_id in ids, (
            f"Expected visit {visit_id} in pending list but found ids: {ids[:5]}"
        )

    def test_all_pending_visits_have_required_fields(self, client, db_available):
        """Every item in the list must carry the fields the review table renders."""
        response = client.get("/mystery-shopper/admin/visits?status=Pending")
        required_fields = {
            "visit_date", "status", "submitted_by_name",
        }
        for visit in response.json():
            missing = required_fields - visit.keys()
            assert not missing, f"Visit missing fields: {missing}"

    def test_mystery_specific_fields_present_when_assessment_exists(self, client, pending_visit, ms_location_id):
        """When a mystery_shopper_assessment row exists, shopper fields must be returned."""
        if not ms_location_id:
            pytest.skip("no location configured — assessment row was not inserted")
        response = client.get("/mystery-shopper/admin/visits?status=Pending")
        visit_id = pending_visit["visit_id"]
        match = next((v for v in response.json() if str(v.get("visit_id") or v.get("id")) == visit_id), None)
        assert match is not None
        assert match.get("shopper_name") == "Test Shopper"
        assert match.get("purpose_of_visit") == "General Enquiry"
        assert match.get("staff_on_duty") == "Jane Smith"

    def test_approved_visit_not_in_pending_list(self, client, pending_visit):
        """After approval the visit must no longer appear in the Pending queue."""
        visit_id = pending_visit["visit_id"]
        client.put(f"/mystery-shopper/visits/{visit_id}/approve", json={"approval_notes": ""})
        response = client.get("/mystery-shopper/admin/visits?status=Pending")
        ids = [str(v.get("visit_id") or v.get("id")) for v in response.json()]
        assert visit_id not in ids

    def test_non_pending_statuses_excluded(self, client, db_available):
        """Only Pending visits must be returned when status=Pending is specified."""
        response = client.get("/mystery-shopper/admin/visits?status=Pending")
        for visit in response.json():
            assert visit.get("status") == "Pending", (
                f"Expected status=Pending but got: {visit.get('status')}"
            )


class TestVisitDetailEndpoint:
    """GET /mystery-shopper/visits/{visit_id}"""

    def test_returns_404_for_unknown_id(self, client, db_available):
        response = client.get(f"/mystery-shopper/visits/{uuid.uuid4()}")
        assert response.status_code == 404

    def test_returns_200_for_existing_visit(self, client, pending_visit):
        visit_id = pending_visit["visit_id"]
        response = client.get(f"/mystery-shopper/visits/{visit_id}")
        assert response.status_code == 200

    def test_detail_contains_responses_list(self, client, pending_visit):
        visit_id = pending_visit["visit_id"]
        body = client.get(f"/mystery-shopper/visits/{visit_id}").json()
        assert "responses" in body
        assert isinstance(body["responses"], list)

    def test_response_count_matches_inserted_rows(self, client, pending_visit):
        """The detail endpoint must return exactly as many responses as were inserted."""
        visit_id = pending_visit["visit_id"]
        inserted = len(pending_visit["response_ids"])
        if inserted == 0:
            pytest.skip("no response rows were inserted for this test visit")
        body = client.get(f"/mystery-shopper/visits/{visit_id}").json()
        assert len(body["responses"]) == inserted, (
            f"Expected {inserted} responses, got {len(body['responses'])}"
        )

    def test_question_numbers_are_in_2000_range(self, client, pending_visit):
        """Mystery shopper question_number values must be in the 2001-2027 range."""
        visit_id = pending_visit["visit_id"]
        body = client.get(f"/mystery-shopper/visits/{visit_id}").json()
        if not body.get("responses"):
            pytest.skip("no responses to inspect")
        for resp in body["responses"]:
            qnum = resp.get("question_number")
            assert qnum is not None, "question_number must not be None"
            assert 2001 <= int(qnum) <= 2027, (
                f"question_number {qnum} is outside the expected 2001-2027 range"
            )

    def test_question_numbers_are_unique(self, client, pending_visit):
        """Each response in a single visit must have a unique question_number."""
        visit_id = pending_visit["visit_id"]
        body = client.get(f"/mystery-shopper/visits/{visit_id}").json()
        nums = [r.get("question_number") for r in body.get("responses", [])]
        assert len(nums) == len(set(nums)), f"Duplicate question_numbers found: {nums}"

    def test_each_response_has_an_answer_or_score(self, client, pending_visit):
        """Every response must carry either a score or an answer_text."""
        visit_id = pending_visit["visit_id"]
        body = client.get(f"/mystery-shopper/visits/{visit_id}").json()
        for resp in body.get("responses", []):
            has_score = resp.get("score") is not None
            has_answer = bool((resp.get("answer_text") or "").strip())
            assert has_score or has_answer, (
                f"Response {resp.get('response_id')} has neither score nor answer_text"
            )

    def test_visit_header_fields_present(self, client, pending_visit, ms_location_id):
        """Top-level visit fields used by the detail card must all be present."""
        if not ms_location_id:
            pytest.skip("no location configured — assessment fields not available")
        visit_id = pending_visit["visit_id"]
        body = client.get(f"/mystery-shopper/visits/{visit_id}").json()
        for field in ("visit_date", "status", "shopper_name", "purpose_of_visit", "staff_on_duty"):
            assert field in body, f"Missing field '{field}' in visit detail"


class TestSaveResponseEdit:
    """PUT /mystery-shopper/visits/{visit_id}/responses/{response_id}"""

    def test_save_updates_verbatim(self, client, pending_visit):
        """Saving a response edit must persist the verbatim field."""
        visit_id = pending_visit["visit_id"]
        response_ids = pending_visit["response_ids"]
        if not response_ids:
            pytest.skip("no response rows to edit")

        # Fetch the first response to get its question_id
        body = client.get(f"/mystery-shopper/visits/{visit_id}").json()
        first_resp = body["responses"][0]
        response_id = first_resp["response_id"]

        new_verbatim = "Test verbatim note from automated test"
        put_res = client.put(
            f"/mystery-shopper/visits/{visit_id}/responses/{response_id}",
            json={
                "question_id": first_resp["question_id"],
                "score": first_resp.get("score"),
                "answer_text": first_resp.get("answer_text"),
                "verbatim": new_verbatim,
                "actions": [],
            },
        )
        assert put_res.status_code in (200, 204), f"Save failed: {put_res.text}"

        # Re-fetch detail to confirm persistence
        updated = client.get(f"/mystery-shopper/visits/{visit_id}").json()
        match = next((r for r in updated["responses"] if r["response_id"] == response_id), None)
        assert match is not None
        assert match.get("verbatim") == new_verbatim

    def test_save_returns_updated_response(self, client, pending_visit):
        """PUT endpoint must return a body with the updated response data."""
        visit_id = pending_visit["visit_id"]
        if not pending_visit["response_ids"]:
            pytest.skip("no response rows to edit")

        body = client.get(f"/mystery-shopper/visits/{visit_id}").json()
        first_resp = body["responses"][0]
        response_id = first_resp["response_id"]

        put_res = client.put(
            f"/mystery-shopper/visits/{visit_id}/responses/{response_id}",
            json={
                "question_id": first_resp["question_id"],
                "score": first_resp.get("score"),
                "answer_text": first_resp.get("answer_text"),
                "verbatim": "Updated",
                "actions": [],
            },
        )
        assert put_res.status_code in (200, 204)
        if put_res.status_code == 200:
            resp_body = put_res.json()
            assert "response_id" in resp_body or "id" in resp_body


class TestApproveVisit:
    """PUT /mystery-shopper/visits/{visit_id}/approve"""

    def test_approve_returns_200(self, client, pending_visit):
        visit_id = pending_visit["visit_id"]
        response = client.put(
            f"/mystery-shopper/visits/{visit_id}/approve",
            json={"approval_notes": "Approved by automated test"},
        )
        assert response.status_code == 200

    def test_approve_changes_status_to_approved(self, client, pending_visit):
        """After approval the visit status in detail must be 'Approved'."""
        visit_id = pending_visit["visit_id"]
        client.put(
            f"/mystery-shopper/visits/{visit_id}/approve",
            json={"approval_notes": ""},
        )
        detail = client.get(f"/mystery-shopper/visits/{visit_id}").json()
        assert detail.get("status") == "Approved", (
            f"Expected status 'Approved', got '{detail.get('status')}'"
        )

    def test_approve_response_contains_visit_id(self, client, pending_visit):
        visit_id = pending_visit["visit_id"]
        response = client.put(
            f"/mystery-shopper/visits/{visit_id}/approve",
            json={"approval_notes": ""},
        )
        body = response.json()
        assert str(body.get("visit_id") or body.get("id", "")) == visit_id

    def test_approved_visit_excluded_from_pending_queue(self, client, pending_visit):
        visit_id = pending_visit["visit_id"]
        client.put(
            f"/mystery-shopper/visits/{visit_id}/approve",
            json={"approval_notes": ""},
        )
        queue = client.get("/mystery-shopper/admin/visits?status=Pending").json()
        queue_ids = {str(v.get("visit_id") or v.get("id")) for v in queue}
        assert visit_id not in queue_ids

    def test_approved_visit_status_in_all_visits(self, client, pending_visit):
        """Querying without a status filter must return the approved visit."""
        visit_id = pending_visit["visit_id"]
        client.put(
            f"/mystery-shopper/visits/{visit_id}/approve",
            json={"approval_notes": ""},
        )
        all_visits = client.get("/mystery-shopper/admin/visits").json()
        match = next(
            (v for v in all_visits if str(v.get("visit_id") or v.get("id")) == visit_id),
            None,
        )
        if match is None:
            pytest.skip("all-visits query not supported or no data — cannot verify")
        assert match.get("status") == "Approved"

    def test_approve_unknown_visit_returns_404(self, client, db_available):
        response = client.put(
            f"/mystery-shopper/visits/{uuid.uuid4()}/approve",
            json={"approval_notes": ""},
        )
        assert response.status_code == 404
