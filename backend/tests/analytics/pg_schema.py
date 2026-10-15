"""Minimal PostgreSQL schema + deterministic seed builders for analytics tests.

The schema mirrors the columns the analytics/report/admin SQL reads. Mystery
Shopper tables, the survey type row and the question catalogue come from the
application's own bootstrap so the tests exercise the real question keys and
scales. Mystery answers are dual-written (authoritative table + mirror in
`b2b_visit_responses`) exactly as the application does, so contamination
cases are realistic.
"""

from __future__ import annotations

import json
import uuid
from datetime import date

from sqlalchemy import text
from sqlalchemy.orm import Session

DDL = [
    "DROP TYPE IF EXISTS visit_status CASCADE",
    "CREATE TYPE visit_status AS ENUM ('Draft','Pending','Needs Changes','Approved','Rejected')",
    """CREATE TABLE survey_types (
        id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, code VARCHAR(50), description TEXT)""",
    """CREATE TABLE businesses (
        id SERIAL PRIMARY KEY, name VARCHAR(200) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
        priority_level VARCHAR(50))""",
    """CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(200))""",
    """CREATE TABLE meeting_attendees (
        id SERIAL PRIMARY KEY, visit_id UUID, name VARCHAR(200), role VARCHAR(100))""",
    """CREATE TABLE b2b_users (
        id SERIAL PRIMARY KEY, name VARCHAR(200), role VARCHAR(40))""",
    """CREATE TABLE visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id INTEGER,
        representative_id INTEGER,
        survey_type_id INTEGER REFERENCES survey_types(id),
        visit_date DATE NOT NULL,
        visit_type VARCHAR(50) NOT NULL DEFAULT 'Planned',
        status visit_status NOT NULL DEFAULT 'Draft',
        account_executive_name VARCHAR(200),
        edited_by_name VARCHAR(255), edited_by_email VARCHAR(255), edited_at TIMESTAMPTZ,
        submitted_by_name VARCHAR(255),
        submitted_by_email VARCHAR(255),
        submitted_at TIMESTAMP,
        approval_timestamp TIMESTAMPTZ,
        approval_notes TEXT,
        rejection_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW())""",
    """CREATE TABLE questions (
        id SERIAL PRIMARY KEY,
        survey_type_id INTEGER,
        question_number INTEGER,
        order_index INTEGER NOT NULL DEFAULT 0,
        category VARCHAR(200) NOT NULL,
        question_key VARCHAR(128) UNIQUE,
        question_text VARCHAR(2000) NOT NULL,
        input_type VARCHAR(80) NOT NULL DEFAULT 'score',
        score_min INTEGER, score_max INTEGER,
        choices TEXT,
        helper_text TEXT,
        requires_issue BOOLEAN NOT NULL DEFAULT FALSE,
        requires_escalation BOOLEAN NOT NULL DEFAULT FALSE,
        is_nps BOOLEAN NOT NULL DEFAULT FALSE,
        is_mandatory BOOLEAN NOT NULL DEFAULT TRUE)""",
    """CREATE TABLE b2b_visit_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        score INTEGER, answer_text TEXT, verbatim TEXT,
        actions JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_b2b_visit_responses_visit_question UNIQUE (visit_id, question_id))""",
]

# (key, text, category, input_type, number, score_min, score_max, is_nps)
B2B_QUESTIONS = [
    ("q01_relationship_strength", "Relationship strength", "Relationship", "score", 1, 0, 10, False),
    ("q02_ae_information_updates", "AE updates", "Relationship", "score", 2, 0, 10, False),
    ("q03_ae_professionalism", "AE professionalism", "Relationship", "score", 3, 0, 10, False),
    ("q04_ae_business_understanding", "AE understands business?", "Relationship", "yes_no", 4, None, None, False),
    ("q05_contacts_visit_satisfaction", "Contacts visit satisfaction", "Relationship", "score", 5, 0, 10, False),
    ("q06_regular_updates", "Regular updates?", "Relationship", "yes_no", 6, None, None, False),
    ("q11_recommend_nps", "Likelihood to recommend", "Loyalty", "score", 11, 0, 10, True),
    ("q12_overall_satisfaction", "Overall C&W satisfaction", "Loyalty", "score", 12, 0, 10, False),
    ("q16_other_provider_products", "Other provider products?", "Competition", "yes_no", 16, None, None, False),
    ("q20_comments", "Free comments", "Comments", "text", 20, None, None, False),
]


def create_schema(db: Session) -> None:
    for statement in DDL:
        db.execute(text(statement))
    db.execute(text("INSERT INTO survey_types (name, code, description) VALUES ('B2B', 'b2b', 'B2B')"))
    db.flush()
    b2b_id = db.execute(text("SELECT id FROM survey_types WHERE name='B2B'")).scalar()
    for key, qtext, cat, itype, number, smin, smax, is_nps in B2B_QUESTIONS:
        db.execute(
            text(
                """INSERT INTO questions
                   (survey_type_id, question_number, order_index, category, question_key, question_text,
                    input_type, score_min, score_max, is_nps)
                   VALUES (:st, :n, :n, :cat, :key, :txt, :it, :smin, :smax, :nps)"""
            ),
            {"st": b2b_id, "n": number, "cat": cat, "key": key, "txt": qtext, "it": itype,
             "smin": smin, "smax": smax, "nps": is_nps},
        )
    # Mystery tables, survey type row and question catalogue come from the app bootstrap.
    from app.api.mystery_shopper import _bootstrap_mystery_shopper_schema

    _bootstrap_mystery_shopper_schema(db)
    db.execute(text("UPDATE survey_types SET code='mystery_shopper' WHERE name='Mystery Shopper'"))
    db.flush()


class Fx:
    """Deterministic seed helper bound to one rolled-back test session."""

    def __init__(self, db: Session):
        self.db = db
        self.b2b_type_id = db.execute(text("SELECT id FROM survey_types WHERE name='B2B'")).scalar()
        self.ms_type_id = db.execute(text("SELECT id FROM survey_types WHERE name='Mystery Shopper'")).scalar()
        self._q = {
            row.question_key: row.id
            for row in db.execute(text("SELECT id, question_key FROM questions")).all()
        }
        self._n = 0

    def qid(self, key: str) -> int:
        return self._q[key]

    def add_survey_type(self, name: str, code: str | None = None) -> int:
        return self.db.execute(
            text("INSERT INTO survey_types (name, code) VALUES (:n, :c) RETURNING id"), {"n": name, "c": code}
        ).scalar()

    def business(self, name: str, active: bool = True) -> int:
        return self.db.execute(
            text("INSERT INTO businesses (name, active) VALUES (:n, :a) RETURNING id"), {"n": name, "a": active}
        ).scalar()

    def location(self, name: str) -> int:
        return self.db.execute(
            text("INSERT INTO mystery_shopper_locations (name) VALUES (:n) RETURNING id"), {"n": name}
        ).scalar()

    def b2b_visit(self, business_id: int, status: str = "Approved", visit_date: date = date(2026, 3, 10),
                  ae: str | None = None) -> str:
        return str(
            self.db.execute(
                text(
                    """INSERT INTO visits (business_id, representative_id, survey_type_id, visit_date, status,
                                           account_executive_name)
                       VALUES (:b, 1, :st, :d, CAST(:s AS visit_status), :ae) RETURNING id"""
                ),
                {"b": business_id, "st": self.b2b_type_id, "d": visit_date, "s": status, "ae": ae},
            ).scalar()
        )

    def mystery_visit(self, location_id: int, status: str = "Approved", visit_date: date = date(2026, 3, 10),
                      staff: str = "Staff A", purpose: str = "Billing") -> str:
        visit_id = str(
            self.db.execute(
                text(
                    """INSERT INTO visits (business_id, representative_id, survey_type_id, visit_date, status)
                       VALUES (NULL, 1, :st, :d, CAST(:s AS visit_status)) RETURNING id"""
                ),
                {"st": self.ms_type_id, "d": visit_date, "s": status},
            ).scalar()
        )
        self._n += 1
        self.db.execute(
            text(
                """INSERT INTO mystery_shopper_assessments
                   (visit_id, location_id, visit_time, purpose_of_visit, staff_on_duty, shopper_name)
                   VALUES (:v, :l, '10:00', :p, :s, 'Shopper')"""
            ),
            {"v": visit_id, "l": location_id, "p": purpose, "s": staff},
        )
        return visit_id

    def answer(self, visit_id: str, key: str, score: int | None = None, text_value: str | None = None,
               *, table: str = "b2b_visit_responses") -> None:
        self.db.execute(
            text(
                f"""INSERT INTO {table} (visit_id, question_id, score, answer_text, verbatim)
                    VALUES (:v, :q, :s, :t, NULL)
                    ON CONFLICT (visit_id, question_id) DO UPDATE SET score=EXCLUDED.score,
                        answer_text=EXCLUDED.answer_text"""
            ),
            {"v": visit_id, "q": self.qid(key), "s": score, "t": text_value},
        )

    def mystery_answer(self, visit_id: str, key: str, score: int | None = None,
                       text_value: str | None = None, *, mirror: bool = True) -> None:
        """Authoritative write + the application's dual-write mirror."""
        self.answer(visit_id, key, score, text_value, table="mystery_shopper_answers")
        if mirror:
            self.answer(visit_id, key, score, text_value, table="b2b_visit_responses")

    def mystery_scores(self, visit_id: str, *, nps: int | None = None, staff_sat: int | None = None,
                       store_sat: int | None = None, mirror: bool = True, **scale5: int) -> None:
        """Seed the NPS/CSAT questions and optional 1-5 scores keyed by question_key."""
        if nps is not None:
            self.mystery_answer(visit_id, "ms_recommend_outlet_nps", nps, mirror=mirror)
        if staff_sat is not None:
            self.mystery_answer(visit_id, "ms_staff_interaction_satisfaction", staff_sat, mirror=mirror)
        if store_sat is not None:
            self.mystery_answer(visit_id, "ms_store_environment_satisfaction", store_sat, mirror=mirror)
        for key, value in scale5.items():
            self.mystery_answer(visit_id, key, value, mirror=mirror)
