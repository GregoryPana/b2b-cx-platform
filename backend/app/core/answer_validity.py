"""Shared server-side completion contract; row presence is not an answer."""
from math import isfinite

from fastapi import HTTPException
from sqlalchemy import text


def answer_is_valid(question, score, answer_text):
    kind = (question.get("input_type") or "score").strip().lower()
    if kind == "score":
        if isinstance(score, bool) or not isinstance(score, (int, float)):
            return False
        if not isfinite(score):
            return False
        lower, upper = question.get("score_min"), question.get("score_max")
        return (lower is None or score >= lower) and (upper is None or score <= upper)
    value = answer_text.strip() if isinstance(answer_text, str) else ""
    if kind == "yes_no":
        return value.lower() in {"y", "n", "yes", "no"}
    if kind == "always_sometimes_never":
        return value.lower() in {"always", "sometimes", "monthly", "never"}
    return bool(value)


def b2b_question_applicability_sql(question_alias="q", visit_alias="v", response_table="b2b_visit_responses"):
    """Current B2B form: only a unique saved, valid Q16=No hides Q17/Q18.

    Keys are scoped to the visit's module plus supported NULL-owned questions.
    Missing/invalid parents and ambiguous keys fail closed (nothing is skipped).
    This is a projection only: historical dependent answers are never deleted.
    Aliases/table are internal SQL identifiers, never request values.
    """
    if response_table not in {"b2b_visit_responses", "responses"}:
        return "TRUE"  # No saved B2B response source: never infer a skip.
    parent = "q16_other_provider_products"
    keys = f"'{parent}', 'q17_competitor_products_services', 'q18_competitor_service_with_cws'"
    scoped = f"(cq.survey_type_id = {visit_alias}.survey_type_id OR cq.survey_type_id IS NULL)"
    return f"""(
        COALESCE({question_alias}.question_key, '') NOT IN
            ('q17_competitor_products_services', 'q18_competitor_service_with_cws')
        OR NOT (
            EXISTS (SELECT 1 FROM survey_types st WHERE st.id = {visit_alias}.survey_type_id
                    AND lower(st.name) = 'b2b')
            AND NOT EXISTS (SELECT cq.question_key FROM questions cq WHERE {scoped}
                            AND cq.question_key IN ({keys}) GROUP BY cq.question_key HAVING COUNT(*) > 1)
            AND (SELECT COUNT(*) FROM questions cq WHERE {scoped} AND cq.question_key = '{parent}') = 1
            AND (SELECT COUNT(*) FROM {response_table} ca JOIN questions cq ON cq.id = ca.question_id
                 WHERE ca.visit_id = {visit_alias}.id AND {scoped} AND cq.question_key = '{parent}') = 1
            AND EXISTS (SELECT 1 FROM {response_table} ca JOIN questions cq ON cq.id = ca.question_id
                        WHERE ca.visit_id = {visit_alias}.id AND {scoped} AND cq.question_key = '{parent}'
                          AND lower(trim(cq.input_type)) = 'yes_no'
                          AND lower(trim(ca.answer_text, ' ' || chr(9) || chr(10) || chr(11) || chr(12) || chr(13))) IN ('n', 'no'))
        )
    )"""


def require_valid_completion(db, visit_id, response_table, *, legacy_questions=False):
    # B2B retains explicitly supported unassigned legacy questions. Mystery
    # never adopts them. EXISTS prevents duplicate response rows inflating totals.
    legacy = "OR q.survey_type_id IS NULL" if legacy_questions else ""
    rows = db.execute(text(f"""
        SELECT q.id, q.question_text, q.input_type, q.score_min, q.score_max,
               q.is_mandatory
        FROM questions q JOIN visits v ON
            (q.survey_type_id = v.survey_type_id {legacy})
        WHERE v.id = :visit_id AND v.survey_type_id IS NOT NULL
          AND {b2b_question_applicability_sql(response_table=response_table) if legacy_questions else "TRUE"}
        ORDER BY q.id
    """), {"visit_id": visit_id}).mappings().all()
    if not rows:
        raise HTTPException(status_code=422, detail="Questionnaire is empty or unavailable")
    answers = db.execute(text(f"""
        SELECT question_id, score, answer_text FROM {response_table}
        WHERE visit_id = :visit_id
    """), {"visit_id": visit_id}).mappings().all()
    missing = [q for q in rows if q["is_mandatory"] and not any(
        a["question_id"] == q["id"]
        and (not legacy_questions or (q["input_type"] or "score").strip().lower() in {"score", "yes_no", "always_sometimes_never", "text"})
        and answer_is_valid(q, a["score"], a["answer_text"])
        for a in answers
    )]
    if missing:
        raise HTTPException(status_code=422, detail={
            "message": f"{len(missing)} mandatory response(s) are missing or invalid.",
            "missing_questions": [{"question_number": q["id"], "question_text": q["question_text"]} for q in missing],
        })


def require_visit_state(db, visit_id, allowed):
    """Lock lifecycle state until the handler commits its transition."""
    state = db.execute(text("SELECT status FROM visits WHERE id=:v FOR UPDATE"), {"v": visit_id}).scalar()
    if state not in allowed:
        raise HTTPException(status_code=409, detail="Visit state does not allow this transition")
