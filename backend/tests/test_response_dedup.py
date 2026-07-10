"""
Regression tests for the duplicated-survey-response bug.

Background
----------
`b2b_visit_responses` (shared by the B2B and Mystery Shopper flows) originally
had no UNIQUE (visit_id, question_id) constraint and the write paths were plain
INSERTs, so every re-save appended a fresh row per question. A single visit
accumulated 2-3 rows per question, which the review UI rendered as repeated /
duplicated questions and which inflated response counts and report aggregates.

The fix (migration 20260710_000029 + ON CONFLICT ... DO UPDATE on the write
paths) makes duplicates structurally impossible. These tests guard against a
regression of both halves:

  1. Schema guard — the UNIQUE (visit_id, question_id) constraint exists on
     b2b_visit_responses (and its sibling mystery_shopper_answers).
  2. Behavioural guard — saving the same question twice via the API updates the
     existing row instead of inserting a duplicate, and the review detail
     returns each question exactly once.

These are integration tests: they require a real PostgreSQL database at the
configured DATABASE_URL and are skipped automatically when it is unavailable
(e.g. the SQLite fallback used by CI, or a database that is simply down).
"""

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import inspect, text


# ─────────────────────────────────────────────────────────────────────────────
# Skip guard — real PostgreSQL required
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def db_available():
    """Skip the module unless a real, reachable PostgreSQL database is present.

    Unlike a plain dialect check, this also skips (rather than errors) when the
    engine is configured for Postgres but the server is not actually up.
    """
    from app.core.database import engine

    if engine.dialect.name != "postgresql":
        pytest.skip("response-dedup tests require PostgreSQL — skipping under SQLite/CI")
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"PostgreSQL not reachable — skipping response-dedup tests ({exc})")
    return True


def _unique_columns_sets(insp, table):
    """Return a list of column-name sets covered by a UNIQUE constraint or index."""
    sets = []
    for uc in insp.get_unique_constraints(table):
        sets.append(frozenset(uc.get("column_names") or []))
    for ix in insp.get_indexes(table):
        if ix.get("unique"):
            sets.append(frozenset(ix.get("column_names") or []))
    return sets


# ─────────────────────────────────────────────────────────────────────────────
# 1. Schema guard
# ─────────────────────────────────────────────────────────────────────────────

class TestUniqueConstraintExists:
    def test_b2b_visit_responses_unique_visit_question(self, db_available):
        from app.core.database import engine

        insp = inspect(engine)
        if "b2b_visit_responses" not in insp.get_table_names():
            pytest.skip("b2b_visit_responses table not present in this database")
        assert frozenset({"visit_id", "question_id"}) in _unique_columns_sets(
            insp, "b2b_visit_responses"
        ), (
            "b2b_visit_responses must have a UNIQUE (visit_id, question_id) "
            "constraint to prevent duplicate responses (migration 20260710_000029)."
        )

    def test_mystery_answers_unique_visit_question(self, db_available):
        from app.core.database import engine

        insp = inspect(engine)
        if "mystery_shopper_answers" not in insp.get_table_names():
            pytest.skip("mystery_shopper_answers table not present in this database")
        assert frozenset({"visit_id", "question_id"}) in _unique_columns_sets(
            insp, "mystery_shopper_answers"
        ), "mystery_shopper_answers must have a UNIQUE (visit_id, question_id) constraint."


# ─────────────────────────────────────────────────────────────────────────────
# 2. Behavioural guard — B2B save path through the API
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture()
def b2b_visit(db_available):
    """Create a minimal Draft B2B visit and yield its id + two question ids.

    Cleans up the visit and any responses on teardown.
    """
    from app.core.database import SessionLocal

    db = SessionLocal()
    visit_id = str(uuid.uuid4())
    try:
        b2b_stid = db.execute(
            text("SELECT id FROM survey_types WHERE LOWER(name) = 'b2b' LIMIT 1")
        ).scalar()
        if b2b_stid is None:
            pytest.skip("no B2B survey type configured — skipping")

        # Any two real question ids are enough to exercise (visit_id, question_id)
        # uniqueness; the response endpoint does not bind them to a survey type.
        q_ids = [
            r[0]
            for r in db.execute(
                text(
                    """
                    SELECT id FROM questions
                    WHERE survey_type_id = :stid OR survey_type_id IS NULL
                    ORDER BY id
                    LIMIT 2
                    """
                ),
                {"stid": b2b_stid},
            ).fetchall()
        ]
        if len(q_ids) < 2:
            pytest.skip("fewer than 2 B2B questions configured — skipping")

        db.execute(
            text(
                """
                INSERT INTO visits
                  (id, survey_type_id, visit_date, visit_type, status)
                VALUES
                  (:id, :stid, :vdate, 'Planned', 'Draft')
                """
            ),
            {"id": visit_id, "stid": b2b_stid, "vdate": date.today().isoformat()},
        )
        db.commit()
        yield {"visit_id": visit_id, "question_ids": q_ids}
    finally:
        db.rollback()
        for stmt in (
            "DELETE FROM b2b_visit_responses WHERE visit_id = :id",
            "DELETE FROM visits WHERE id = :id",
        ):
            try:
                db.execute(text(stmt), {"id": visit_id})
                db.commit()
            except Exception:
                db.rollback()
        db.close()


class TestB2BResaveDoesNotDuplicate:
    def _post_response(self, client, visit_id, question_id, score, verbatim):
        return client.post(
            f"/dashboard-visits/{visit_id}/responses",
            json={
                "question_id": question_id,
                "score": score,
                "answer_text": None,
                "verbatim": verbatim,
                "actions": [],
            },
        )

    def test_second_save_updates_same_row(self, client, b2b_visit):
        """Saving the same question twice must upsert, not insert a duplicate."""
        visit_id = b2b_visit["visit_id"]
        question_id = b2b_visit["question_ids"][0]

        first = self._post_response(client, visit_id, question_id, 5, "first")
        assert first.status_code == 200, first.text
        second = self._post_response(client, visit_id, question_id, 9, "second")
        assert second.status_code == 200, second.text

        # Same physical row reused (upsert), and the latest values win.
        assert first.json()["response_id"] == second.json()["response_id"]
        assert second.json()["score"] == 9

    def test_review_detail_has_no_duplicate_questions(self, client, b2b_visit):
        """The review detail must return each question exactly once."""
        visit_id = b2b_visit["visit_id"]
        q1, q2 = b2b_visit["question_ids"]

        # Save q1 twice (the duplicate trigger) and q2 once.
        assert self._post_response(client, visit_id, q1, 5, "a").status_code == 200
        assert self._post_response(client, visit_id, q1, 6, "b").status_code == 200
        assert self._post_response(client, visit_id, q2, 7, "c").status_code == 200

        detail = client.get(f"/dashboard-visits/{visit_id}")
        assert detail.status_code == 200, detail.text
        responses = detail.json()["responses"]

        question_ids = [r["question_id"] for r in responses]
        assert len(question_ids) == len(set(question_ids)), (
            f"Duplicate question_ids in review detail: {question_ids}"
        )
        assert set(question_ids) == {q1, q2}
        # q1 reflects the most recent save.
        q1_row = next(r for r in responses if r["question_id"] == q1)
        assert q1_row["score"] == 6
