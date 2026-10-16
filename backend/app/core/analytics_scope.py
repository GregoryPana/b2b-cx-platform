"""Fail-closed module scoping for analytics queries.

`visits` and `b2b_visit_responses` are shared by the B2B and Mystery Shopper
modules (Mystery answers are mirrored into `b2b_visit_responses` by the
dual-write), so every analytics query must be pinned to exactly one module:

* missing/blank `survey_type`      -> B2B (legacy callers keep B2B semantics)
* Mystery aliases / code / name    -> Mystery Shopper (authoritative table
  `mystery_shopper_answers`, never the B2B mirror)
* anything else (``all``, unknown, other survey types) -> `AnalyticsScopeError`;
  callers turn it into an HTTP 400 or an empty payload. Never an unfiltered query.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import text
from sqlalchemy.orm import Session

from .db_inspect import has_column, has_table

MYSTERY_ALIASES = frozenset({"mystery shopper", "mystery_shopper", "mystery", "mysteryshopper"})
B2B_ALIASES = frozenset({"b2b"})
MODULE_SURVEY_TYPE_NAMES = {"b2b": "b2b", "mystery": "mystery shopper"}


class AnalyticsScopeError(ValueError):
    """Raised when a requested survey_type cannot be mapped to a supported module."""


class AnalyticsSchemaError(RuntimeError):
    """Raised when the schema lacks the module metadata needed to scope analytics safely.

    `visits.survey_type_id` and `questions.survey_type_id` are the only module boundaries on the
    shared tables; without them a query cannot be proven single-module, so we refuse (fail closed)
    instead of silently reporting mixed modules.
    """


@dataclass(frozen=True)
class ModuleScope:
    module: str  # "b2b" | "mystery"
    survey_type_id: int | None
    response_table: str | None
    visit_filter: str  # SQL fragment on alias ``v`` (visits)
    question_filter: str  # SQL fragment on aliases ``q``/``v`` (use only where both are joined)
    params: dict = field(default_factory=dict)

    @property
    def is_mystery(self) -> bool:
        return self.module == "mystery"


def _module_from_survey_types_table(db: Session, raw: str) -> str | None:
    if not has_table(db, "survey_types"):
        return None
    has_code = has_column(db, "survey_types", "code")
    code_clause = "OR lower(code) = lower(:st)" if has_code else ""
    row = db.execute(
        text(
            f"""
            SELECT lower(name) FROM survey_types
            WHERE lower(name) = lower(:st) {code_clause}
               OR replace(lower(name), ' ', '') = replace(lower(:st), ' ', '')
            LIMIT 1
            """
        ),
        {"st": raw},
    ).scalar()
    if row == MODULE_SURVEY_TYPE_NAMES["b2b"]:
        return "b2b"
    if row == MODULE_SURVEY_TYPE_NAMES["mystery"]:
        return "mystery"
    return None


def resolve_module_scope(db: Session, survey_type: str | None) -> ModuleScope:
    raw = (survey_type or "").strip()
    key = raw.lower()
    if not raw:
        module = "b2b"
    elif key in MYSTERY_ALIASES:
        module = "mystery"
    elif key in B2B_ALIASES:
        module = "b2b"
    else:
        module = _module_from_survey_types_table(db, raw)
        if module is None:
            raise AnalyticsScopeError(
                f"Unsupported or unknown survey_type {raw!r}; analytics supports 'B2B' or 'Mystery Shopper'"
            )

    type_id = None
    if has_table(db, "survey_types"):
        type_id = db.execute(
            text("SELECT id FROM survey_types WHERE lower(name) = :name LIMIT 1"),
            {"name": MODULE_SURVEY_TYPE_NAMES[module]},
        ).scalar()

    params: dict = {}
    if not has_column(db, "visits", "survey_type_id"):
        raise AnalyticsSchemaError("visits.survey_type_id is missing; analytics cannot be scoped to a module")
    if not has_column(db, "questions", "survey_type_id"):
        raise AnalyticsSchemaError("questions.survey_type_id is missing; analytics cannot be scoped to a module")

    if type_id is not None:
        visit_filter = " AND v.survey_type_id = :survey_type_id"
        params["survey_type_id"] = int(type_id)
        if module == "mystery":
            question_filter = " AND q.survey_type_id = :survey_type_id"
        else:
            # Legacy B2B questions may carry no module; they are only ever accepted under B2B.
            question_filter = " AND (q.survey_type_id IS NULL OR q.survey_type_id = :survey_type_id)"
    else:
        # Module row missing: nothing can belong to it.
        visit_filter = " AND 1 = 0"
        question_filter = " AND 1 = 0"

    if module == "mystery":
        response_table = "mystery_shopper_answers" if has_table(db, "mystery_shopper_answers") else None
    elif has_table(db, "b2b_visit_responses"):
        response_table = "b2b_visit_responses"
    elif has_table(db, "responses"):
        response_table = "responses"
    else:
        response_table = None

    return ModuleScope(
        module=module,
        survey_type_id=int(type_id) if type_id is not None else None,
        response_table=response_table,
        visit_filter=visit_filter,
        question_filter=question_filter,
        params=params,
    )
