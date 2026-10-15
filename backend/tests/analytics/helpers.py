"""Thin wrappers that call the real analytics handlers with explicit arguments."""

from __future__ import annotations

from app.routers import analytics as an


def overview(db, survey_type="B2B", *, business_ids=None, mystery_location_ids=None,
             date_from=None, date_to=None, visit_id=None):
    kwargs = dict(
        survey_type=survey_type, business_ids=business_ids, mystery_location_ids=mystery_location_ids,
        date_from=date_from, date_to=date_to, db=db,
    )
    if visit_id is not None:
        kwargs["visit_id"] = visit_id
    return an.get_comprehensive_analytics(**kwargs)


def question_averages(db, survey_type="B2B", **kw):
    return an.get_question_averages(
        survey_type=survey_type, business_ids=kw.get("business_ids"),
        mystery_location_ids=kw.get("mystery_location_ids"), date_from=kw.get("date_from"),
        date_to=kw.get("date_to"), db=db,
    )["items"]


def by_key(items, key="question_key"):
    return {item[key]: item for item in items}
