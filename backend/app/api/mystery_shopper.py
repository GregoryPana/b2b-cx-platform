from datetime import datetime, timedelta
import json
import os
import smtplib
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..core.auth.dependencies import get_current_user
from ..core.auth.entra import AuthUser
from ..core.database import get_db

router = APIRouter(prefix="/mystery-shopper", tags=["mystery-shopper"])


class LocationCreate(BaseModel):
    name: str


class LocationUpdate(BaseModel):
    name: str | None = None
    active: bool | None = None


class PurposeCreate(BaseModel):
    name: str


class PurposeUpdate(BaseModel):
    name: str | None = None
    active: bool | None = None


class MysteryVisitCreate(BaseModel):
    location_id: int
    representative_id: int | None = None
    created_by: int | None = None
    visit_date: str
    visit_type: str = "Planned"
    visit_time: str
    purpose_of_visit: str
    staff_on_duty: str
    shopper_name: str


class MysteryHeaderUpdate(BaseModel):
    location_id: int
    visit_time: str
    purpose_of_visit: str
    staff_on_duty: str
    shopper_name: str


class MysteryResponsePayload(BaseModel):
    question_id: int
    score: int | None = None
    answer_text: str | None = None
    verbatim: str | None = None
    actions: list[Any] = []


class MysteryReportEmailRequest(BaseModel):
    to: list[str]
    subject: str | None = None
    report_type: str | None = "lifetime"
    location_id: int | None = None
    visit_id: str | None = None
    report_date: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    message: str | None = None


def has_table(db: Session, table_name: str) -> bool:
    return bool(
        db.execute(
            text(
                """
                SELECT 1
                FROM information_schema.tables
                WHERE table_name = :table_name
                LIMIT 1
                """
            ),
            {"table_name": table_name},
        ).scalar()
    )


def has_column(db: Session, table_name: str, column_name: str) -> bool:
    return bool(
        db.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = :table_name AND column_name = :column_name
                LIMIT 1
                """
            ),
            {"table_name": table_name, "column_name": column_name},
        ).scalar()
    )


def get_response_table(db: Session) -> str | None:
    if has_table(db, "b2b_visit_responses"):
        return "b2b_visit_responses"
    if has_table(db, "responses"):
        return "responses"
    return None


def get_mystery_answer_table(db: Session) -> str | None:
    return "mystery_shopper_answers" if has_table(db, "mystery_shopper_answers") else None


def upsert_mystery_answer(
    db: Session,
    visit_id: str,
    question_id: int,
    score: int | None,
    answer_text: str | None,
    verbatim: str | None,
    actions: list[Any] | None,
) -> None:
    mystery_answer_table = get_mystery_answer_table(db)
    if not mystery_answer_table:
        return

    db.execute(
        text(
            """
            INSERT INTO mystery_shopper_answers (visit_id, question_id, score, answer_text, verbatim, actions)
            VALUES (:visit_id, :question_id, :score, :answer_text, :verbatim, CAST(:actions AS jsonb))
            ON CONFLICT (visit_id, question_id) DO UPDATE SET
                score = EXCLUDED.score,
                answer_text = EXCLUDED.answer_text,
                verbatim = EXCLUDED.verbatim,
                actions = EXCLUDED.actions,
                updated_at = NOW()
            """
        ),
        {
            "visit_id": visit_id,
            "question_id": question_id,
            "score": score,
            "answer_text": answer_text,
            "verbatim": verbatim,
            "actions": json.dumps(actions or []),
        },
    )


def normalize_actions_value(value: Any) -> list[Any]:
    if not value:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except Exception:
            return []
        return parsed if isinstance(parsed, list) else []
    return []


def validate_mystery_response(question_row: Any, payload: MysteryResponsePayload) -> None:
    input_type = question_row.input_type if hasattr(question_row, "input_type") else question_row[2]
    score_min = question_row.score_min if hasattr(question_row, "score_min") else question_row[3]
    score_max = question_row.score_max if hasattr(question_row, "score_max") else question_row[4]
    is_mandatory = bool(question_row.is_mandatory if hasattr(question_row, "is_mandatory") else question_row[5])

    if input_type == "score":
        if payload.score is None:
            raise HTTPException(status_code=400, detail="Score is required for this question")
        min_value = int(score_min if score_min is not None else 0)
        max_value = int(score_max if score_max is not None else 10)
        if payload.score < min_value or payload.score > max_value:
            raise HTTPException(status_code=400, detail=f"Score must be between {min_value} and {max_value}")
        return

    answer_text = (payload.answer_text or "").strip()
    if input_type == "yes_no":
        if answer_text not in {"Y", "N", "Yes", "No"}:
            raise HTTPException(status_code=400, detail="Answer must be Yes or No")
        return

    if is_mandatory and not answer_text:
        raise HTTPException(status_code=400, detail="Answer is required for this question")


def build_mystery_report_payload(
    db: Session,
    report_type: str | None,
    location_id: int | None,
    visit_id: str | None,
    report_date: str | None,
    date_from: str | None,
    date_to: str | None,
) -> dict[str, Any]:
    from ..routers.analytics import get_comprehensive_analytics, get_question_averages

    survey_type_id = _ensure_mystery_shopper_schema(db)
    response_table = get_response_table(db)
    if not response_table:
        raise HTTPException(status_code=500, detail="No response table found")

    normalized_report_type = (report_type or "lifetime").strip().lower()
    if normalized_report_type not in {"lifetime", "survey", "date"}:
        normalized_report_type = "lifetime"

    effective_date_from = date_from
    effective_date_to = date_to
    if report_date:
      effective_date_from = report_date
      effective_date_to = report_date

    where_clauses = ["v.survey_type_id = :survey_type_id"]
    params: dict[str, Any] = {"survey_type_id": survey_type_id}
    if location_id is not None:
        where_clauses.append("m.location_id = :location_id")
        params["location_id"] = location_id
    if effective_date_from:
        where_clauses.append("v.visit_date >= :date_from")
        params["date_from"] = effective_date_from
    if effective_date_to:
        where_clauses.append("v.visit_date <= :date_to")
        params["date_to"] = effective_date_to

    visit_rows = db.execute(
        text(
            f"""
            SELECT
                v.id,
                l.id AS location_id,
                l.name AS location_name,
                v.visit_date,
                v.status,
                m.visit_time,
                m.purpose_of_visit,
                m.staff_on_duty,
                m.shopper_name,
                COUNT(r.id) AS response_count,
                AVG(CASE WHEN r.score IS NOT NULL THEN r.score END)::float AS average_score
            FROM visits v
            JOIN mystery_shopper_assessments m ON m.visit_id = v.id
            JOIN mystery_shopper_locations l ON l.id = m.location_id
            LEFT JOIN {response_table} r ON r.visit_id = v.id
            WHERE {' AND '.join(where_clauses)}
            GROUP BY v.id, l.id, l.name, v.visit_date, v.status, m.visit_time, m.purpose_of_visit, m.staff_on_duty, m.shopper_name
            ORDER BY v.visit_date DESC, m.visit_time DESC NULLS LAST, v.id DESC
            """
        ),
        params,
    ).mappings().all()

    total_responses = sum(int(row["response_count"] or 0) for row in visit_rows)
    total_visits = len(visit_rows)
    total_locations = len({row["location_id"] for row in visit_rows if row["location_id"] is not None})
    weighted_score_sum = sum((float(row["average_score"] or 0.0) * int(row["response_count"] or 0)) for row in visit_rows)
    weighted_score_count = sum(int(row["response_count"] or 0) for row in visit_rows if row["average_score"] is not None)
    average_score = round(weighted_score_sum / weighted_score_count, 2) if weighted_score_count else None

    location_filter = str(location_id) if location_id is not None else None
    analytics_selected = get_comprehensive_analytics(
        survey_type="Mystery Shopper",
        mystery_location_ids=location_filter,
        date_from=effective_date_from,
        date_to=effective_date_to,
        db=db,
    )
    analytics_overall = get_comprehensive_analytics(survey_type="Mystery Shopper", db=db)
    question_averages_selected = get_question_averages(
        survey_type="Mystery Shopper",
        business_ids=None,
        date_from=effective_date_from,
        date_to=effective_date_to,
        db=db,
    )

    def weighted_average(items: list[dict[str, Any]]) -> float | None:
        score_sum = 0.0
        count_sum = 0
        for item in items:
            score = float(item.get("average_score") or 0.0)
            count = int(item.get("response_count") or 0)
            if count <= 0:
                continue
            score_sum += score * count
            count_sum += count
        return round(score_sum / count_sum, 2) if count_sum else None

    question_items = list(question_averages_selected.get("items") or [])
    overall_experience_avg = weighted_average([item for item in question_items if "overall experience" in str(item.get("category") or "").lower()])
    quality_avg = weighted_average([
        item for item in question_items
        if "overall experience" not in str(item.get("category") or "").lower() and float(item.get("average_score") or 0) <= 5.2
    ])

    selected_visit_info = None
    survey_question_details: list[dict[str, Any]] = []
    if normalized_report_type == "survey" and visit_id:
        detail = db.execute(
            text(
                """
                SELECT
                    v.id,
                    l.name AS location_name,
                    v.visit_date,
                    v.status,
                    m.visit_time,
                    m.purpose_of_visit,
                    m.staff_on_duty,
                    m.shopper_name,
                    v.submitted_by_name,
                    v.submitted_by_email,
                    v.submitted_at
                FROM visits v
                JOIN mystery_shopper_assessments m ON m.visit_id = v.id
                JOIN mystery_shopper_locations l ON l.id = m.location_id
                WHERE v.id = :visit_id
                LIMIT 1
                """
            ),
            {"visit_id": visit_id},
        ).mappings().first()
        if detail:
            selected_visit_info = {
                "visit_id": str(detail["id"]),
                "location_name": detail["location_name"],
                "business_name": detail["location_name"],
                "visit_date": detail["visit_date"].isoformat() if detail["visit_date"] else None,
                "status": detail["status"],
                "visit_time": detail["visit_time"],
                "purpose_of_visit": detail["purpose_of_visit"],
                "staff_on_duty": detail["staff_on_duty"],
                "shopper_name": detail["shopper_name"],
                "submitted_by_name": detail["submitted_by_name"],
                "submitted_by_email": detail["submitted_by_email"],
                "submitted_at": detail["submitted_at"].isoformat() if detail["submitted_at"] else None,
            }

        qrows = db.execute(
            text(
                f"""
                SELECT
                    q.id AS question_id,
                    q.question_number,
                    q.category,
                    q.question_text,
                    q.input_type,
                    q.score_min,
                    q.score_max,
                    r.score,
                    r.answer_text,
                    r.verbatim
                FROM {response_table} r
                JOIN questions q ON q.id = r.question_id
                WHERE r.visit_id = :visit_id
                ORDER BY q.question_number, q.id
                """
            ),
            {"visit_id": visit_id},
        ).mappings().all()
        survey_question_details = [dict(row) for row in qrows]

    return {
        "filters": {
            "report_type": normalized_report_type,
            "location_id": location_id,
            "visit_id": visit_id,
            "report_date": report_date,
            "date_from": effective_date_from,
            "date_to": effective_date_to,
        },
        "summary": {
            "total_visits": total_visits,
            "total_locations": total_locations,
            "total_responses": total_responses,
            "average_score": average_score,
            "is_single_visit": normalized_report_type == "survey" and bool(visit_id),
        },
        "mystery_metrics": {
            "selected_nps": (analytics_selected.get("nps") or {}).get("nps"),
            "overall_nps": (analytics_overall.get("nps") or {}).get("nps"),
            "selected_csat": (analytics_selected.get("mystery_shopper") or {}).get("csat_average"),
            "overall_csat": (analytics_overall.get("mystery_shopper") or {}).get("csat_average"),
            "selected_overall_experience": overall_experience_avg,
            "selected_quality": quality_avg,
        },
        "analytics_selected": analytics_selected,
        "analytics_overall": analytics_overall,
        "selected_visit_info": selected_visit_info,
        "survey_question_details": survey_question_details,
        "visit_details": [
            {
                "visit_id": str(row["id"]),
                "visit_date": row["visit_date"].isoformat() if row["visit_date"] else None,
                "status": row["status"],
                "location_id": row["location_id"],
                "location_name": row["location_name"],
                "visit_time": row["visit_time"],
                "purpose_of_visit": row["purpose_of_visit"],
                "staff_on_duty": row["staff_on_duty"],
                "shopper_name": row["shopper_name"],
                "response_count": int(row["response_count"] or 0),
                "avg_score": round(float(row["average_score"]), 2) if row["average_score"] is not None else None,
            }
            for row in visit_rows
        ],
    }


def render_mystery_report_html(payload: dict[str, Any], generated_by: str) -> str:
    filters = payload.get("filters", {}) or {}
    summary = payload.get("summary", {}) or {}
    metrics = payload.get("mystery_metrics", {}) or {}
    selected_visit_info = payload.get("selected_visit_info") or {}
    visit_details = payload.get("visit_details") or []
    survey_question_details = payload.get("survey_question_details") or []

    def fmt(value: Any, suffix: str = "") -> str:
        if value is None or value == "":
            return "--"
        try:
            return f"{float(value):.1f}{suffix}"
        except Exception:
            return f"{value}{suffix}"

    visit_rows = "".join(
        f"<tr><td>{row.get('visit_date') or '--'}</td><td>{row.get('location_name') or '--'}</td><td>{row.get('visit_time') or '--'}</td><td>{row.get('status') or '--'}</td><td>{fmt(row.get('avg_score'))}</td></tr>"
        for row in visit_details
    )

    grouped_questions: dict[str, list[dict[str, Any]]] = {}
    for row in survey_question_details:
        grouped_questions.setdefault(str(row.get("category") or "Uncategorized"), []).append(row)

    def question_answer_display(item: dict[str, Any]) -> str:
        if item.get("score") is not None and item.get("score_max") is not None:
            return f"{item.get('score')} / {item.get('score_max')}"
        return item.get("answer_text") or "--"

    question_sections = "".join(
        f"<h3>{category}</h3><table><thead><tr><th>Question</th><th>Answer</th><th>Verbatim</th></tr></thead><tbody>"
        + "".join(
            f"<tr><td>Q{int(item.get('question_number') or 0)}: {item.get('question_text') or '--'}</td><td>{question_answer_display(item)}</td><td>{item.get('verbatim') or '--'}</td></tr>"
            for item in items
        )
        + "</tbody></table>"
        for category, items in grouped_questions.items()
    )

    return f"""<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>CWSCX Mystery Shopper Report</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #0f172a; background:#f8fafc; }}
    .page {{ max-width: 1120px; margin: 0 auto; background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:28px; }}
    h1,h2,h3 {{ color:#0f172a; }}
    .grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; }}
    .card {{ border:1px solid #e2e8f0; border-radius:10px; padding:14px; background:#fff; }}
    .label {{ font-size:12px; color:#64748b; margin-bottom:6px; }}
    .value {{ font-size:24px; font-weight:700; color:#0b1220; }}
    table {{ width:100%; border-collapse:collapse; margin-top:10px; }}
    th, td {{ border:1px solid #e5e7eb; padding:10px 12px; font-size:13px; text-align:left; }}
    th {{ background:#f1f5f9; }}
  </style>
</head>
<body>
  <div class=\"page\">
    <h1>Mystery Shopper Report</h1>
    <p>Generated by: {generated_by}</p>
    <p>Scope: Location {filters.get('location_id') or 'All'} | Date range: {filters.get('date_from') or 'Any'} to {filters.get('date_to') or 'Any'}</p>
    <div class=\"grid\">
      <div class=\"card\"><div class=\"label\">Total Visits</div><div class=\"value\">{summary.get('total_visits', 0)}</div></div>
      <div class=\"card\"><div class=\"label\">Locations</div><div class=\"value\">{summary.get('total_locations', 0)}</div></div>
      <div class=\"card\"><div class=\"label\">Average Score</div><div class=\"value\">{fmt(summary.get('average_score'))}</div></div>
      <div class=\"card\"><div class=\"label\">Selected NPS</div><div class=\"value\">{fmt(metrics.get('selected_nps'))}</div></div>
      <div class=\"card\"><div class=\"label\">Selected CSAT Avg</div><div class=\"value\">{fmt(metrics.get('selected_csat'))}</div></div>
      <div class=\"card\"><div class=\"label\">Overall Experience</div><div class=\"value\">{fmt(metrics.get('selected_overall_experience'))}</div></div>
    </div>
    {f"<h2>Selected Survey</h2><p>{selected_visit_info.get('location_name') or '--'} | {selected_visit_info.get('visit_date') or '--'} | {selected_visit_info.get('status') or '--'} | {selected_visit_info.get('purpose_of_visit') or '--'}</p>" if selected_visit_info else ""}
    {f"<h2>Survey Details</h2>{question_sections}" if question_sections else ""}
    <h2>Visit Summary</h2>
    <table>
      <thead><tr><th>Date</th><th>Location</th><th>Time</th><th>Status</th><th>Avg Score</th></tr></thead>
      <tbody>{visit_rows or '<tr><td colspan="5">No visits found.</td></tr>'}</tbody>
    </table>
  </div>
</body>
</html>"""


def render_mystery_report_pdf(payload: dict[str, Any], generated_by: str) -> bytes:
    from io import BytesIO
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    story = []

    filters = payload.get("filters", {}) or {}
    summary = payload.get("summary", {}) or {}
    metrics = payload.get("mystery_metrics", {}) or {}
    selected_visit_info = payload.get("selected_visit_info") or {}
    visit_details = payload.get("visit_details") or []
    survey_question_details = payload.get("survey_question_details") or []

    def fmt(value: Any) -> str:
        if value is None or value == "":
            return "--"
        try:
            return f"{float(value):.1f}"
        except Exception:
            return str(value)

    story.append(Paragraph("CWSCX Mystery Shopper Report", styles["Title"]))
    story.append(Paragraph(f"Generated by: {generated_by}", styles["BodyText"]))
    story.append(Paragraph(
        f"Scope: Location {filters.get('location_id') or 'All'} | Date range: {filters.get('date_from') or 'Any'} to {filters.get('date_to') or 'Any'}",
        styles["BodyText"],
    ))
    story.append(Spacer(1, 12))

    summary_rows = [
        ["Total Visits", str(summary.get("total_visits", 0))],
        ["Locations", str(summary.get("total_locations", 0))],
        ["Average Score", fmt(summary.get("average_score"))],
        ["Selected NPS", fmt(metrics.get("selected_nps"))],
        ["Selected CSAT Avg", fmt(metrics.get("selected_csat"))],
        ["Overall Experience", fmt(metrics.get("selected_overall_experience"))],
        ["Service Quality", fmt(metrics.get("selected_quality"))],
    ]
    summary_table = Table(summary_rows, colWidths=[170, 120])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    if selected_visit_info:
        story.append(Paragraph("Selected Survey", styles["Heading2"]))
        story.append(Paragraph(
            f"{selected_visit_info.get('location_name') or '--'} | {selected_visit_info.get('visit_date') or '--'} | {selected_visit_info.get('status') or '--'} | {selected_visit_info.get('purpose_of_visit') or '--'}",
            styles["BodyText"],
        ))
        story.append(Spacer(1, 10))

    if survey_question_details:
        story.append(Paragraph("Survey Details", styles["Heading2"]))
        grouped: dict[str, list[dict[str, Any]]] = {}
        for row in survey_question_details:
            grouped.setdefault(str(row.get("category") or "Uncategorized"), []).append(row)
        for category, items in grouped.items():
            story.append(Paragraph(category, styles["Heading3"]))
            rows = [["Question", "Answer", "Verbatim"]]
            for item in items:
                answer = f"{item.get('score')} / {item.get('score_max')}" if item.get("score") is not None and item.get("score_max") is not None else (item.get("answer_text") or "--")
                rows.append([
                    f"Q{int(item.get('question_number') or 0)}: {item.get('question_text') or '--'}",
                    answer,
                    item.get("verbatim") or "--",
                ])
            table = Table(rows, colWidths=[250, 100, 140])
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]))
            story.append(table)
            story.append(Spacer(1, 10))

    story.append(Paragraph("Visit Summary", styles["Heading2"]))
    visit_rows = [["Date", "Location", "Time", "Status", "Avg Score"]]
    for row in visit_details:
        visit_rows.append([
            row.get("visit_date") or "--",
            row.get("location_name") or "--",
            row.get("visit_time") or "--",
            row.get("status") or "--",
            fmt(row.get("avg_score")),
        ])
    visit_table = Table(visit_rows, colWidths=[80, 170, 70, 90, 70])
    visit_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(visit_table)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


MYSTERY_SHOPPER_QUESTIONS: list[dict[str, Any]] = [
    {
        "question_number": 1,
        "category": "External Environment & First Impression",
        "question_key": "ms_signage_visibility_cleanliness",
        "question_text": "How is Signage visibility & cleanliness",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 2,
        "category": "External Environment & First Impression",
        "question_key": "ms_store_entrance_cleanliness",
        "question_text": "How is Store entrance cleanliness",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 3,
        "category": "External Environment & First Impression",
        "question_key": "ms_promotional_material_display",
        "question_text": "Rate the display of Promotional materials",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 4,
        "category": "External Environment & First Impression",
        "question_key": "ms_greeted_within_30_seconds",
        "question_text": "Greeted within 30 seconds",
        "input_type": "yes_no",
        "score_min": None,
        "score_max": None,
        "is_mandatory": True,
        "is_nps": False,
        "choices": '["Yes","No"]',
    },
    {
        "question_number": 5,
        "category": "External Environment & First Impression",
        "question_key": "ms_greeting_polite_warm",
        "question_text": "Greeting polite & warm",
        "input_type": "yes_no",
        "score_min": None,
        "score_max": None,
        "is_mandatory": True,
        "is_nps": False,
        "choices": '["Yes","No"]',
    },
    {
        "question_number": 6,
        "category": "Staff Appearance & Professionalism",
        "question_key": "ms_uniform_neat_complete",
        "question_text": "Are staff Uniform neat and complete",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 7,
        "category": "Staff Appearance & Professionalism",
        "question_key": "ms_personal_grooming",
        "question_text": "How is the staff Personal grooming of",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 8,
        "category": "Staff Appearance & Professionalism",
        "question_key": "ms_name_badge_visibility",
        "question_text": "Rate the Name badge visibility",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 9,
        "category": "Staff Appearance & Professionalism",
        "question_key": "ms_professional_behaviour",
        "question_text": "Do staff act with Professional behaviour",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 10,
        "category": "Customer Service Interaction",
        "question_key": "ms_listened_actively",
        "question_text": "Did staff listen actively",
        "input_type": "yes_no",
        "score_min": None,
        "score_max": None,
        "is_mandatory": True,
        "is_nps": False,
        "choices": '["Yes","No"]',
    },
    {
        "question_number": 11,
        "category": "Customer Service Interaction",
        "question_key": "ms_asked_relevant_questions",
        "question_text": "Did staff Ask relevant questions",
        "input_type": "yes_no",
        "score_min": None,
        "score_max": None,
        "is_mandatory": True,
        "is_nps": False,
        "choices": '["Yes","No"]',
    },
    {
        "question_number": 12,
        "category": "Customer Service Interaction",
        "question_key": "ms_product_service_knowledge",
        "question_text": "Rate Staff Product/service knowledge",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 13,
        "category": "Customer Service Interaction",
        "question_key": "ms_information_accuracy",
        "question_text": "How was the Accuracy of information Provided",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 14,
        "category": "Customer Service Interaction",
        "question_key": "ms_handled_clarifying_questions",
        "question_text": "Handled clarifying questions",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 15,
        "category": "Customer Service Interaction",
        "question_key": "ms_solution_provided",
        "question_text": "Was a Solution provided",
        "input_type": "yes_no",
        "score_min": None,
        "score_max": None,
        "is_mandatory": True,
        "is_nps": False,
        "choices": '["Yes","No"]',
    },
    {
        "question_number": 16,
        "category": "Customer Service Interaction",
        "question_key": "ms_solution_helpful",
        "question_text": "Was the Solution helpful",
        "input_type": "yes_no",
        "score_min": None,
        "score_max": None,
        "is_mandatory": True,
        "is_nps": False,
        "choices": '["Yes","No"]',
    },
    {
        "question_number": 17,
        "category": "Store Environment & Comfort",
        "question_key": "ms_store_cleanliness",
        "question_text": "Cleanliness of store",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 18,
        "category": "Store Environment & Comfort",
        "question_key": "ms_queue_management",
        "question_text": "Queue management",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 19,
        "category": "Store Environment & Comfort",
        "question_key": "ms_display_organization_posters",
        "question_text": "Display organisation and posters",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 20,
        "category": "Store Environment & Comfort",
        "question_key": "ms_aircon_ventilation",
        "question_text": "Air conditioning / ventilation",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 21,
        "category": "Store Environment & Comfort",
        "question_key": "ms_space_comfort",
        "question_text": "Space & comfort",
        "input_type": "score",
        "score_min": 1,
        "score_max": 5,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 22,
        "category": "Time & Efficiency",
        "question_key": "ms_waiting_time",
        "question_text": "Waiting time",
        "input_type": "text",
        "score_min": None,
        "score_max": None,
        "is_mandatory": True,
        "is_nps": False,
        "choices": '["Under 3 minutes","3-7 minutes","7-15 minutes","15+ minutes"]',
    },
    {
        "question_number": 23,
        "category": "Time & Efficiency",
        "question_key": "ms_service_completion_time",
        "question_text": "Service completion (handling time)",
        "input_type": "text",
        "score_min": None,
        "score_max": None,
        "is_mandatory": True,
        "is_nps": False,
        "choices": '["Quick","Acceptable","Slow"]',
    },
    {
        "question_number": 24,
        "category": "Overall Experience (CSAT & NPS)",
        "question_key": "ms_staff_interaction_satisfaction",
        "question_text": "Staff interaction satisfaction",
        "input_type": "score",
        "score_min": 0,
        "score_max": 10,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 25,
        "category": "Overall Experience (CSAT & NPS)",
        "question_key": "ms_store_environment_satisfaction",
        "question_text": "Store environment satisfaction",
        "input_type": "score",
        "score_min": 0,
        "score_max": 10,
        "is_mandatory": True,
        "is_nps": False,
        "choices": None,
    },
    {
        "question_number": 26,
        "category": "Overall Experience (CSAT & NPS)",
        "question_key": "ms_recommend_outlet_nps",
        "question_text": "NPS - Recommend this outlet",
        "input_type": "score",
        "score_min": 0,
        "score_max": 10,
        "is_mandatory": True,
        "is_nps": True,
        "choices": None,
    },
    {
        "question_number": 27,
        "category": "Overall Experience (CSAT & NPS)",
        "question_key": "ms_final_comments",
        "question_text": "Final comments / recommendations",
        "input_type": "text",
        "score_min": None,
        "score_max": None,
        "is_mandatory": False,
        "is_nps": False,
        "choices": None,
    },
]

DEFAULT_PURPOSE_OPTIONS = [
    "General Enquiry",
    "Billing",
    "Device",
    "Broadband",
    "Complaint",
    "Other",
]


def _utc_plus_4_today() -> str:
    now_utc = datetime.utcnow()
    return (now_utc + timedelta(hours=4)).date().isoformat()


def _has_column(db: Session, table_name: str, column_name: str) -> bool:
    return db.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = :table_name AND column_name = :column_name
            LIMIT 1
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    ).scalar() is not None


def _seed_locations_from_existing_mystery_visits(db: Session) -> int:
    inserted_rows = db.execute(
        text(
            """
            WITH mystery_businesses AS (
                SELECT DISTINCT v.business_id
                FROM visits v
                JOIN survey_types st ON st.id = v.survey_type_id
                WHERE LOWER(st.name) = LOWER('Mystery Shopper')
                  AND v.business_id IS NOT NULL
            ),
            candidate_locations AS (
                SELECT
                    mb.business_id,
                    TRIM(COALESCE(b.location, b.name)) AS location_name,
                    COALESCE(b.active, TRUE) AS is_active
                FROM mystery_businesses mb
                JOIN businesses b ON b.id = mb.business_id
                WHERE COALESCE(TRIM(COALESCE(b.location, b.name)), '') <> ''
            )
            INSERT INTO mystery_shopper_locations (name, business_id, active)
            SELECT cl.location_name, cl.business_id, cl.is_active
            FROM candidate_locations cl
            WHERE NOT EXISTS (
                SELECT 1
                FROM mystery_shopper_locations l
                WHERE l.business_id = cl.business_id
                   OR LOWER(l.name) = LOWER(cl.location_name)
            )
            RETURNING id
            """
        )
    ).fetchall()
    return len(inserted_rows)


def _seed_purpose_options_from_historical_assessments(db: Session) -> int:
    inserted_rows = db.execute(
        text(
            """
            WITH historical_purposes AS (
                SELECT
                    LOWER(TRIM(msa.purpose_of_visit)) AS normalized_name,
                    MIN(TRIM(msa.purpose_of_visit)) AS canonical_name
                FROM mystery_shopper_assessments msa
                WHERE COALESCE(TRIM(msa.purpose_of_visit), '') <> ''
                GROUP BY LOWER(TRIM(msa.purpose_of_visit))
            ),
            missing_purposes AS (
                SELECT hp.canonical_name
                FROM historical_purposes hp
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM mystery_shopper_purpose_options po
                    WHERE LOWER(po.name) = hp.normalized_name
                )
            ),
            ordered_purposes AS (
                SELECT
                    mp.canonical_name AS name,
                    COALESCE((SELECT MAX(sort_order) FROM mystery_shopper_purpose_options), 0)
                    + ROW_NUMBER() OVER (ORDER BY mp.canonical_name) AS sort_order
                FROM missing_purposes mp
            )
            INSERT INTO mystery_shopper_purpose_options (name, active, sort_order)
            SELECT op.name, TRUE, op.sort_order
            FROM ordered_purposes op
            RETURNING id
            """
        )
    ).fetchall()
    return len(inserted_rows)


def _ensure_mystery_shopper_schema(db: Session) -> int:
    db.execute(text(
        """
        CREATE TABLE IF NOT EXISTS mystery_shopper_locations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            business_id INTEGER,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    ))

    db.execute(text(
        """
        CREATE TABLE IF NOT EXISTS mystery_shopper_assessments (
            id SERIAL PRIMARY KEY,
            visit_id UUID NOT NULL UNIQUE,
            location_id INTEGER NOT NULL REFERENCES mystery_shopper_locations(id),
            visit_time VARCHAR(20) NOT NULL,
            purpose_of_visit VARCHAR(120) NOT NULL,
            staff_on_duty VARCHAR(255) NOT NULL,
            shopper_name VARCHAR(255) NOT NULL,
            report_completed_date DATE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    ))

    db.execute(text(
        """
        CREATE TABLE IF NOT EXISTS mystery_shopper_purpose_options (
            id SERIAL PRIMARY KEY,
            name VARCHAR(120) NOT NULL UNIQUE,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    ))

    db.execute(text("ALTER TABLE mystery_shopper_locations ADD COLUMN IF NOT EXISTS business_id INTEGER"))
    db.execute(text("ALTER TABLE mystery_shopper_locations ALTER COLUMN business_id DROP NOT NULL"))
    db.execute(text("ALTER TABLE mystery_shopper_locations DROP CONSTRAINT IF EXISTS mystery_shopper_locations_business_id_fkey"))
    db.execute(text("ALTER TABLE mystery_shopper_assessments DROP CONSTRAINT IF EXISTS mystery_shopper_assessments_visit_id_fkey"))
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS mystery_shopper_answers (
                id BIGSERIAL PRIMARY KEY,
                visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
                question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
                score INTEGER,
                answer_text TEXT,
                verbatim TEXT,
                actions JSONB NOT NULL DEFAULT '[]'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_mystery_shopper_answers_visit_question UNIQUE (visit_id, question_id)
            )
            """
        )
    )
    db.execute(text("ALTER TABLE visits ALTER COLUMN business_id DROP NOT NULL"))

    db.execute(text(
        """
        INSERT INTO survey_types (name, description)
        VALUES ('Mystery Shopper', 'Customer service centre mystery shopper assessment')
        ON CONFLICT (name) DO NOTHING
        """
    ))

    # Compatibility guards for older schemas.
    db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS survey_type_id INTEGER"))
    db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_number INTEGER"))
    db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS input_type VARCHAR(80)"))
    db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS score_min INTEGER"))
    db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS score_max INTEGER"))
    db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS choices TEXT"))
    db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_key VARCHAR(128)"))
    db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS helper_text TEXT"))
    db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS requires_issue BOOLEAN NOT NULL DEFAULT FALSE"))
    db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS requires_escalation BOOLEAN NOT NULL DEFAULT FALSE"))

    for index, purpose_name in enumerate(DEFAULT_PURPOSE_OPTIONS, start=1):
        db.execute(
            text(
                """
                INSERT INTO mystery_shopper_purpose_options (name, active, sort_order)
                VALUES (:name, TRUE, :sort_order)
                ON CONFLICT (name) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order
                """
            ),
            {"name": purpose_name, "sort_order": index},
        )

    survey_type_id = db.execute(
        text("SELECT id FROM survey_types WHERE name = 'Mystery Shopper'")
    ).scalar()

    if not survey_type_id:
        raise HTTPException(status_code=500, detail="Failed to initialize Mystery Shopper survey type")

    db.execute(
        text(
            """
            UPDATE visits v
            SET business_id = NULL
            WHERE v.survey_type_id = :survey_type_id
              AND v.business_id IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM mystery_shopper_assessments msa
                  WHERE msa.visit_id = v.id
              )
            """
        ),
        {"survey_type_id": survey_type_id},
    )

    has_order_index = _has_column(db, "questions", "order_index")

    question_number_expr = ":question_number"
    # Some environments kept global uniqueness on question_number from older schemas.
    # Use an offset to avoid conflicts with B2B and other survey types.
    question_number_offset = 2000

    for question in MYSTERY_SHOPPER_QUESTIONS:
        payload = {
            "survey_type_id": survey_type_id,
            **question,
            "question_number": question_number_offset + int(question["question_number"]),
            "order_index": int(question["question_number"]),
        }

        order_index_column = "order_index," if has_order_index else ""
        order_index_value = ":order_index," if has_order_index else ""
        order_index_update = "order_index = EXCLUDED.order_index," if has_order_index else ""

        existing_id = db.execute(
            text("SELECT id FROM questions WHERE question_key = :question_key LIMIT 1"),
            {"question_key": payload["question_key"]},
        ).scalar()

        if existing_id:
            db.execute(
                text(
                    """
                    UPDATE questions
                    SET
                        survey_type_id = :survey_type_id,
                        question_number = :question_number,
                        {order_index_update}
                        question_text = :question_text,
                        category = :category,
                        is_mandatory = :is_mandatory,
                        is_nps = :is_nps,
                        input_type = :input_type,
                        score_min = :score_min,
                        score_max = :score_max,
                        choices = :choices
                    WHERE id = :existing_id
                    """.format(order_index_update=order_index_update)
                ),
                {**payload, "existing_id": existing_id},
            )
        else:
            db.execute(
                text(
                    """
                    INSERT INTO questions (
                        survey_type_id,
                        question_number,
                        {order_index_column}
                        question_text,
                        category,
                        is_mandatory,
                        is_nps,
                        input_type,
                        score_min,
                        score_max,
                        choices,
                        helper_text,
                        requires_issue,
                        requires_escalation,
                        question_key
                    )
                    VALUES (
                        :survey_type_id,
                        :question_number,
                        {order_index_value}
                        :question_text,
                        :category,
                        :is_mandatory,
                        :is_nps,
                        :input_type,
                        :score_min,
                        :score_max,
                        :choices,
                        NULL,
                        FALSE,
                        FALSE,
                        :question_key
                    )
                    """.format(
                        order_index_column=order_index_column,
                        order_index_value=order_index_value,
                    )
                ),
                payload,
            )

    return int(survey_type_id)


@router.post("/bootstrap")
async def bootstrap_mystery_shopper(db: Session = Depends(get_db)):
    survey_type_id = _ensure_mystery_shopper_schema(db)
    seeded_location_count = _seed_locations_from_existing_mystery_visits(db)
    seeded_purpose_count = _seed_purpose_options_from_historical_assessments(db)
    db.commit()
    return {
        "message": "Mystery Shopper schema and questions are ready",
        "survey_type_id": survey_type_id,
        "question_count": len(MYSTERY_SHOPPER_QUESTIONS),
        "seeded_location_count": seeded_location_count,
        "seeded_purpose_count": seeded_purpose_count,
    }


@router.post("/seed-legacy")
async def seed_legacy_mystery_data(db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    seeded_location_count = _seed_locations_from_existing_mystery_visits(db)
    seeded_purpose_count = _seed_purpose_options_from_historical_assessments(db)
    db.commit()
    return {
        "message": "Legacy mystery shopper data seeding completed",
        "seeded_location_count": seeded_location_count,
        "seeded_purpose_count": seeded_purpose_count,
    }


@router.get("/locations")
async def list_locations(db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    rows = db.execute(
        text(
            """
            SELECT id, name, business_id, active
            FROM mystery_shopper_locations
            ORDER BY active DESC, name ASC
            """
        )
    ).all()
    db.commit()
    return [
        {
            "id": row[0],
            "name": row[1],
            "business_id": row[2],
            "active": bool(row[3]),
        }
        for row in rows
    ]


@router.post("/locations")
async def create_location(payload: LocationCreate, db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Location name is required")

    existing = db.execute(
        text("SELECT id FROM mystery_shopper_locations WHERE LOWER(name) = LOWER(:name)"),
        {"name": name},
    ).scalar()
    if existing:
        raise HTTPException(status_code=400, detail="Location already exists")

    location_id = db.execute(
        text(
            """
            INSERT INTO mystery_shopper_locations (name, business_id, active)
            VALUES (:name, NULL, TRUE)
            RETURNING id
            """
        ),
        {"name": name},
    ).scalar()

    db.commit()
    return {"id": location_id, "name": name, "business_id": None, "active": True}


@router.put("/locations/{location_id}")
async def update_location(location_id: int, payload: LocationUpdate, db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    row = db.execute(
        text("SELECT id, name, business_id, active FROM mystery_shopper_locations WHERE id = :id"),
        {"id": location_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Location not found")

    next_name = row[1]
    next_active = bool(row[3])

    if payload.name is not None:
        cleaned = payload.name.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="Location name cannot be empty")
        next_name = cleaned

    if payload.active is not None:
        next_active = payload.active

    db.execute(
        text(
            """
            UPDATE mystery_shopper_locations
            SET name = :name, active = :active, updated_at = NOW()
            WHERE id = :id
            """
        ),
        {"id": location_id, "name": next_name, "active": next_active},
    )

    db.commit()
    return {"id": location_id, "name": next_name, "business_id": row[2], "active": next_active}


@router.delete("/locations/{location_id}")
async def deactivate_location(location_id: int, db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    return await update_location(location_id, LocationUpdate(active=False), db)


@router.delete("/locations/{location_id}/purge")
async def purge_location(location_id: int, db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)

    row = db.execute(
        text("SELECT id, name, business_id FROM mystery_shopper_locations WHERE id = :id"),
        {"id": location_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Location not found")

    assessment_count = db.execute(
        text("SELECT COUNT(*) FROM mystery_shopper_assessments WHERE location_id = :location_id"),
        {"location_id": location_id},
    ).scalar()
    if assessment_count and int(assessment_count) > 0:
        raise HTTPException(
            status_code=409,
            detail="Location has related assessments. Deactivate instead of deleting.",
        )

    db.execute(
        text("DELETE FROM mystery_shopper_locations WHERE id = :id"),
        {"id": location_id},
    )

    db.commit()
    return {
        "id": location_id,
        "name": row[1],
        "purged": True,
    }


@router.get("/purposes")
async def list_purpose_options(db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    rows = db.execute(
        text(
            """
            SELECT id, name, active, sort_order
            FROM mystery_shopper_purpose_options
            ORDER BY active DESC, sort_order ASC, name ASC
            """
        )
    ).all()
    db.commit()
    return [
        {
            "id": row[0],
            "name": row[1],
            "active": bool(row[2]),
            "sort_order": int(row[3] or 0),
        }
        for row in rows
    ]


@router.post("/purposes")
async def create_purpose_option(payload: PurposeCreate, db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Purpose name is required")

    existing = db.execute(
        text("SELECT id FROM mystery_shopper_purpose_options WHERE LOWER(name) = LOWER(:name) LIMIT 1"),
        {"name": name},
    ).scalar()
    if existing:
        raise HTTPException(status_code=400, detail="Purpose already exists")

    next_sort = db.execute(
        text("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM mystery_shopper_purpose_options")
    ).scalar()

    purpose_id = db.execute(
        text(
            """
            INSERT INTO mystery_shopper_purpose_options (name, active, sort_order)
            VALUES (:name, TRUE, :sort_order)
            RETURNING id
            """
        ),
        {"name": name, "sort_order": int(next_sort or 1)},
    ).scalar()

    db.commit()
    return {
        "id": purpose_id,
        "name": name,
        "active": True,
        "sort_order": int(next_sort or 1),
    }


@router.put("/purposes/{purpose_id}")
async def update_purpose_option(purpose_id: int, payload: PurposeUpdate, db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    row = db.execute(
        text("SELECT id, name, active, sort_order FROM mystery_shopper_purpose_options WHERE id = :id"),
        {"id": purpose_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Purpose not found")

    next_name = row[1]
    next_active = bool(row[2])

    if payload.name is not None:
        cleaned = payload.name.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail="Purpose name cannot be empty")
        conflict = db.execute(
            text(
                """
                SELECT id
                FROM mystery_shopper_purpose_options
                WHERE LOWER(name) = LOWER(:name) AND id <> :id
                LIMIT 1
                """
            ),
            {"name": cleaned, "id": purpose_id},
        ).scalar()
        if conflict:
            raise HTTPException(status_code=400, detail="Purpose already exists")
        next_name = cleaned

    if payload.active is not None:
        next_active = payload.active

    db.execute(
        text(
            """
            UPDATE mystery_shopper_purpose_options
            SET name = :name,
                active = :active,
                updated_at = NOW()
            WHERE id = :id
            """
        ),
        {"id": purpose_id, "name": next_name, "active": next_active},
    )

    db.commit()
    return {
        "id": purpose_id,
        "name": next_name,
        "active": next_active,
        "sort_order": int(row[3] or 0),
    }


@router.delete("/purposes/{purpose_id}")
async def deactivate_purpose_option(purpose_id: int, db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    return await update_purpose_option(purpose_id, PurposeUpdate(active=False), db)


@router.delete("/purposes/{purpose_id}/purge")
async def purge_purpose_option(purpose_id: int, db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)

    row = db.execute(
        text("SELECT id, name FROM mystery_shopper_purpose_options WHERE id = :id"),
        {"id": purpose_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Purpose not found")

    usage_count = db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM mystery_shopper_assessments
            WHERE LOWER(TRIM(purpose_of_visit)) = LOWER(TRIM(:name))
            """
        ),
        {"name": row[1]},
    ).scalar()
    if usage_count and int(usage_count) > 0:
        raise HTTPException(
            status_code=409,
            detail="Purpose has historical assessments. Deactivate instead of deleting.",
        )

    db.execute(
        text("DELETE FROM mystery_shopper_purpose_options WHERE id = :id"),
        {"id": purpose_id},
    )
    db.commit()

    return {
        "id": purpose_id,
        "name": row[1],
        "purged": True,
    }


@router.post("/visits")
async def create_mystery_visit(
    payload: MysteryVisitCreate,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    survey_type_id = _ensure_mystery_shopper_schema(db)
    valid_purpose = db.execute(
        text(
            """
            SELECT id
            FROM mystery_shopper_purpose_options
            WHERE LOWER(name) = LOWER(:name) AND active = TRUE
            LIMIT 1
            """
        ),
        {"name": payload.purpose_of_visit.strip()},
    ).scalar()
    if not valid_purpose:
        raise HTTPException(status_code=400, detail="Purpose of visit is not an active configured option")

    location_row = db.execute(
        text("SELECT id, active FROM mystery_shopper_locations WHERE id = :id"),
        {"id": payload.location_id},
    ).fetchone()
    if not location_row:
        raise HTTPException(status_code=404, detail="Location not found")
    if not location_row[1]:
        raise HTTPException(status_code=400, detail="Selected location is inactive")

    existing_visit = db.execute(
        text(
            """
            SELECT v.id
            FROM visits v
            JOIN mystery_shopper_assessments msa ON msa.visit_id = v.id
            WHERE msa.location_id = :location_id
              AND v.visit_date = :visit_date
              AND v.survey_type_id = :survey_type_id
              AND v.status = 'Draft'
            LIMIT 1
            """
        ),
        {
            "location_id": payload.location_id,
            "visit_date": payload.visit_date,
            "survey_type_id": survey_type_id,
        },
    ).scalar()

    if existing_visit:
        raise HTTPException(status_code=400, detail="A draft already exists for this location and date")

    visit_id = db.execute(
        text(
            """
            INSERT INTO visits (
                id, business_id, representative_id, created_by,
                visit_date, visit_type, status, survey_type_id
            )
            VALUES (
                gen_random_uuid(), NULL, :representative_id, :created_by,
                :visit_date, :visit_type, 'Draft', :survey_type_id
            )
            RETURNING id
            """
        ),
        {
            "representative_id": payload.representative_id or current_user.id,
            "created_by": current_user.id,
            "visit_date": payload.visit_date,
            "visit_type": payload.visit_type,
            "survey_type_id": survey_type_id,
        },
    ).scalar()

    db.execute(
        text(
            """
            INSERT INTO mystery_shopper_assessments (
                visit_id, location_id, visit_time, purpose_of_visit, staff_on_duty, shopper_name
            )
            VALUES (
                :visit_id, :location_id, :visit_time, :purpose_of_visit, :staff_on_duty, :shopper_name
            )
            """
        ),
        {
            "visit_id": visit_id,
            "location_id": payload.location_id,
            "visit_time": payload.visit_time,
            "purpose_of_visit": payload.purpose_of_visit,
            "staff_on_duty": payload.staff_on_duty,
            "shopper_name": payload.shopper_name,
        },
    )

    db.commit()
    return {
        "visit_id": str(visit_id),
        "status": "Draft",
        "created_by": {
            "user_id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
        },
    }


@router.put("/visits/{visit_id}/header")
async def update_mystery_header(visit_id: str, payload: MysteryHeaderUpdate, db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    valid_purpose = db.execute(
        text(
            """
            SELECT id
            FROM mystery_shopper_purpose_options
            WHERE LOWER(name) = LOWER(:name) AND active = TRUE
            LIMIT 1
            """
        ),
        {"name": payload.purpose_of_visit.strip()},
    ).scalar()
    if not valid_purpose:
        raise HTTPException(status_code=400, detail="Purpose of visit is not an active configured option")

    location_row = db.execute(
        text("SELECT id, active FROM mystery_shopper_locations WHERE id = :id"),
        {"id": payload.location_id},
    ).fetchone()
    if not location_row:
        raise HTTPException(status_code=404, detail="Location not found")
    if not location_row[1]:
        raise HTTPException(status_code=400, detail="Selected location is inactive")

    db.execute(
        text(
            """
            INSERT INTO mystery_shopper_assessments (
                visit_id, location_id, visit_time, purpose_of_visit, staff_on_duty, shopper_name
            )
            VALUES (:visit_id, :location_id, :visit_time, :purpose_of_visit, :staff_on_duty, :shopper_name)
            ON CONFLICT (visit_id) DO UPDATE SET
                location_id = EXCLUDED.location_id,
                visit_time = EXCLUDED.visit_time,
                purpose_of_visit = EXCLUDED.purpose_of_visit,
                staff_on_duty = EXCLUDED.staff_on_duty,
                shopper_name = EXCLUDED.shopper_name,
                updated_at = NOW()
            """
        ),
        {
            "visit_id": visit_id,
            "location_id": payload.location_id,
            "visit_time": payload.visit_time,
            "purpose_of_visit": payload.purpose_of_visit,
            "staff_on_duty": payload.staff_on_duty,
            "shopper_name": payload.shopper_name,
        },
    )

    db.commit()
    return {"visit_id": visit_id, "message": "Header updated"}


@router.get("/visits/drafts")
async def list_mystery_drafts(
    representative_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    survey_type_id = _ensure_mystery_shopper_schema(db)
    effective_representative_id = current_user.id
    if representative_id is not None:
        try:
            effective_representative_id = int(representative_id)
        except Exception:
            effective_representative_id = current_user.id
    where_rep = ""
    params: dict[str, Any] = {"survey_type_id": survey_type_id}
    if effective_representative_id is not None:
        where_rep = " AND v.representative_id = :representative_id"
        params["representative_id"] = effective_representative_id

    rows = db.execute(
        text(
            f"""
            SELECT
                v.id,
                v.representative_id,
                v.visit_date,
                v.visit_type,
                v.status,
                m.location_id,
                l.name AS location_name,
                m.visit_time,
                m.purpose_of_visit,
                m.staff_on_duty,
                m.shopper_name,
                COUNT(r.id) as response_count,
                COUNT(CASE WHEN q.is_mandatory = true AND r.id IS NOT NULL THEN 1 END) as mandatory_answered_count,
                (SELECT COUNT(*) FROM questions q2 WHERE q2.is_mandatory = true AND q2.survey_type_id = :survey_type_id) as mandatory_total_count
            FROM visits v
            JOIN mystery_shopper_assessments m ON m.visit_id = v.id
            JOIN mystery_shopper_locations l ON l.id = m.location_id
            LEFT JOIN b2b_visit_responses r ON r.visit_id = v.id
            LEFT JOIN questions q ON q.id = r.question_id
            WHERE v.status = 'Draft' AND v.survey_type_id = :survey_type_id {where_rep}
            GROUP BY v.id, m.location_id, l.name, m.visit_time, m.purpose_of_visit, m.staff_on_duty, m.shopper_name
            ORDER BY v.visit_date ASC, m.visit_time ASC
            """
        ),
        params,
    ).all()

    db.commit()
    return [
        {
            "id": row[0],
            "visit_id": row[0],
            "representative_id": row[1],
            "visit_date": row[2].isoformat() if row[2] else None,
            "visit_type": row[3],
            "status": row[4],
            "location_id": row[5],
            "location_name": row[6],
            "visit_time": row[7],
            "purpose_of_visit": row[8],
            "staff_on_duty": row[9],
            "shopper_name": row[10],
            "response_count": row[11],
            "mandatory_answered_count": row[12],
            "mandatory_total_count": row[13],
            "is_started": row[11] > 0,
            "is_completed": row[13] > 0 and row[12] >= row[13],
        }
        for row in rows
    ]


@router.get("/admin/visits")
async def list_mystery_admin_visits(
    status: str | None = None,
    business_name: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    survey_type_id = _ensure_mystery_shopper_schema(db)
    response_table = get_response_table(db)
    if not response_table:
        raise HTTPException(status_code=500, detail="No response table found")

    where_clauses = ["v.survey_type_id = :survey_type_id"]
    params: dict[str, Any] = {"survey_type_id": survey_type_id}

    if status:
        where_clauses.append("v.status = :status")
        params["status"] = status
    if business_name:
        where_clauses.append("LOWER(l.name) LIKE LOWER(:business_name)")
        params["business_name"] = f"%{business_name}%"
    if date_from:
        where_clauses.append("v.visit_date >= :date_from")
        params["date_from"] = date_from
    if date_to:
        where_clauses.append("v.visit_date <= :date_to")
        params["date_to"] = date_to

    rows = db.execute(
        text(
            f"""
            SELECT
                v.id,
                NULL::INTEGER as business_id,
                l.name as business_name,
                v.representative_id,
                u.name as representative_name,
                v.visit_date,
                v.visit_type,
                v.status,
                NULL::VARCHAR as business_priority,
                NULL::VARCHAR as account_executive_name,
                v.submitted_by_name,
                v.submitted_by_email,
                v.submitted_at,
                COUNT(r.id) as response_count,
                COUNT(CASE WHEN q.is_mandatory = true AND r.id IS NOT NULL THEN 1 END) as mandatory_answered_count,
                (SELECT COUNT(*) FROM questions q2 WHERE q2.is_mandatory = true AND q2.survey_type_id = :survey_type_id) as mandatory_total_count,
                m.location_id,
                l.name as location_name,
                m.visit_time,
                m.purpose_of_visit,
                m.staff_on_duty,
                m.shopper_name,
                m.report_completed_date
            FROM visits v
            JOIN mystery_shopper_assessments m ON m.visit_id = v.id
            JOIN mystery_shopper_locations l ON l.id = m.location_id
            LEFT JOIN users u ON v.representative_id = u.id
            LEFT JOIN {response_table} r ON r.visit_id = v.id
            LEFT JOIN questions q ON q.id = r.question_id
            WHERE {' AND '.join(where_clauses)}
            GROUP BY
                v.id,
                l.name,
                v.representative_id,
                u.name,
                v.visit_date,
                v.visit_type,
                v.status,
                v.submitted_by_name,
                v.submitted_by_email,
                v.submitted_at,
                m.location_id,
                m.visit_time,
                m.purpose_of_visit,
                m.staff_on_duty,
                m.shopper_name,
                m.report_completed_date
            ORDER BY v.visit_date DESC, m.visit_time DESC NULLS LAST, v.id DESC
            """
        ),
        params,
    ).mappings().all()

    return [
        {
            "id": row["id"],
            "visit_id": row["id"],
            "business_id": row["business_id"],
            "business_name": row["business_name"],
            "location_id": row["location_id"],
            "location_name": row["location_name"],
            "representative_id": row["representative_id"],
            "representative_name": row["representative_name"],
            "visit_date": row["visit_date"].isoformat() if row["visit_date"] else None,
            "visit_type": row["visit_type"],
            "status": row["status"],
            "business_priority": row["business_priority"],
            "account_executive_name": row["account_executive_name"],
            "team_member_names": [],
            "submitted_by_name": row["submitted_by_name"],
            "submitted_by_email": row["submitted_by_email"],
            "submitted_at": row["submitted_at"].isoformat() if row["submitted_at"] else None,
            "response_count": int(row["response_count"] or 0),
            "mandatory_answered_count": int(row["mandatory_answered_count"] or 0),
            "mandatory_total_count": int(row["mandatory_total_count"] or 0),
            "is_started": int(row["response_count"] or 0) > 0,
            "is_completed": int(row["mandatory_total_count"] or 0) > 0 and int(row["mandatory_answered_count"] or 0) >= int(row["mandatory_total_count"] or 0),
            "visit_time": row["visit_time"],
            "purpose_of_visit": row["purpose_of_visit"],
            "staff_on_duty": row["staff_on_duty"],
            "shopper_name": row["shopper_name"],
            "report_completed_date": row["report_completed_date"].isoformat() if row["report_completed_date"] else None,
        }
        for row in rows
    ]


@router.get("/visits/{visit_id}")
async def get_mystery_visit_detail(visit_id: str, db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    response_table = get_response_table(db)
    if not response_table:
        raise HTTPException(status_code=500, detail="No response table found")

    question_order_col = "q.question_number" if has_column(db, "questions", "question_number") else "q.id"

    visit_row = db.execute(
        text(
            """
            SELECT
                v.id,
                v.representative_id,
                v.visit_date,
                v.visit_type,
                v.status,
                m.location_id,
                l.name AS location_name,
                m.visit_time,
                m.purpose_of_visit,
                m.staff_on_duty,
                m.shopper_name,
                m.report_completed_date
            FROM visits v
            JOIN mystery_shopper_assessments m ON m.visit_id = v.id
            JOIN mystery_shopper_locations l ON l.id = m.location_id
            WHERE v.id = :visit_id
            """
        ),
        {"visit_id": visit_id},
    ).mappings().first()

    if not visit_row:
        raise HTTPException(status_code=404, detail="Visit not found")

    response_rows = db.execute(
        text(
            f"""
            SELECT
                r.id,
                r.question_id,
                r.score,
                r.answer_text,
                r.verbatim,
                {"r.actions" if response_table == "b2b_visit_responses" else "NULL"} as actions,
                {"r.created_at" if response_table == "b2b_visit_responses" else "NULL"} as created_at,
                {"r.updated_at" if response_table == "b2b_visit_responses" else "NULL"} as updated_at,
                {question_order_col} as question_number,
                q.question_text,
                q.input_type,
                q.category
            FROM {response_table} r
            LEFT JOIN questions q ON q.id = r.question_id
            WHERE r.visit_id = :visit_id
            ORDER BY {question_order_col}
            """
        ),
        {"visit_id": visit_id},
    ).mappings().all()

    responses = [
        {
            "response_id": str(row["id"]),
            "question_id": row["question_id"],
            "question_number": row["question_number"] if row["question_number"] else row["question_id"],
            "question_text": row["question_text"],
            "question_type": row["input_type"],
            "category": row["category"] or "Uncategorized",
            "score": row["score"],
            "answer_text": row["answer_text"],
            "verbatim": row["verbatim"],
            "actions": normalize_actions_value(row["actions"]),
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        }
        for row in response_rows
    ]

    mandatory_counts_row = db.execute(
        text(
            f"""
            SELECT
                COALESCE(SUM(CASE WHEN q.is_mandatory = true AND r.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS mandatory_answered_count,
                COALESCE(SUM(CASE WHEN q.is_mandatory = true THEN 1 ELSE 0 END), 0) AS mandatory_total_count
            FROM questions q
            JOIN visits v ON v.survey_type_id = q.survey_type_id
            LEFT JOIN {response_table} r
                ON r.visit_id = v.id
                AND r.question_id = q.id
            WHERE v.id = :visit_id
            """
        ),
        {"visit_id": visit_id},
    ).fetchone()

    mandatory_answered_count = int(mandatory_counts_row[0] or 0) if mandatory_counts_row else 0
    mandatory_total_count = int(mandatory_counts_row[1] or 0) if mandatory_counts_row else 0

    return {
        "id": visit_row["id"],
        "business_id": None,
        "business_name": visit_row["location_name"],
        "representative_id": visit_row["representative_id"],
        "representative_name": None,
        "visit_date": visit_row["visit_date"].isoformat() if visit_row["visit_date"] else None,
        "visit_type": visit_row["visit_type"],
        "status": visit_row["status"],
        "location_id": visit_row["location_id"],
        "location_name": visit_row["location_name"],
        "business_priority": None,
        "account_executive_name": None,
        "team_member_names": [],
        "submitted_by_name": None,
        "submitted_by_email": None,
        "submitted_at": None,
        "visit_time": visit_row["visit_time"],
        "purpose_of_visit": visit_row["purpose_of_visit"],
        "staff_on_duty": visit_row["staff_on_duty"],
        "shopper_name": visit_row["shopper_name"],
        "report_completed_date": visit_row["report_completed_date"].isoformat() if visit_row["report_completed_date"] else None,
        "mandatory_answered_count": mandatory_answered_count,
        "mandatory_total_count": mandatory_total_count,
        "is_started": len(responses) > 0,
        "is_completed": mandatory_total_count > 0 and mandatory_answered_count >= mandatory_total_count,
        "responses": responses,
    }


@router.post("/visits/{visit_id}/responses")
async def create_mystery_response(visit_id: str, payload: MysteryResponsePayload, db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    response_table = get_response_table(db)
    if not response_table:
        raise HTTPException(status_code=500, detail="No response table found")

    question_row = db.execute(
        text(
            """
            SELECT id, question_text, input_type, score_min, score_max, is_mandatory
            FROM questions
            WHERE id = :question_id
            """
        ),
        {"question_id": payload.question_id},
    ).mappings().first()
    if not question_row:
        raise HTTPException(status_code=404, detail="Question not found")

    validate_mystery_response(question_row, payload)

    visit_exists = db.execute(text("SELECT 1 FROM visits WHERE id = :visit_id"), {"visit_id": visit_id}).scalar()
    if not visit_exists:
        raise HTTPException(status_code=404, detail="Visit not found")

    if response_table == "b2b_visit_responses":
        row = db.execute(
            text(
                """
                INSERT INTO b2b_visit_responses (visit_id, question_id, score, answer_text, verbatim, actions)
                VALUES (:visit_id, :question_id, :score, :answer_text, :verbatim, :actions)
                RETURNING id, question_id, score, answer_text, verbatim, actions, created_at
                """
            ),
            {
                "visit_id": visit_id,
                "question_id": payload.question_id,
                "score": payload.score,
                "answer_text": payload.answer_text,
                "verbatim": payload.verbatim,
                "actions": json.dumps(payload.actions or []),
            },
        ).fetchone()
    else:
        row = db.execute(
            text(
                """
                INSERT INTO responses (visit_id, question_id, score, answer_text, verbatim, action_required, action_owner, action_timeframe, action_support_needed)
                VALUES (:visit_id, :question_id, :score, :answer_text, :verbatim, NULL, NULL, NULL, NULL)
                RETURNING id, question_id, score, answer_text, verbatim
                """
            ),
            {
                "visit_id": visit_id,
                "question_id": payload.question_id,
                "score": payload.score,
                "answer_text": payload.answer_text,
                "verbatim": payload.verbatim,
            },
        ).fetchone()

    upsert_mystery_answer(db, visit_id, payload.question_id, payload.score, payload.answer_text, payload.verbatim, payload.actions)
    db.commit()

    response_payload = {
        "response_id": str(row[0]),
        "question_id": row[1],
        "visit_id": visit_id,
        "score": row[2],
        "answer_text": row[3],
        "verbatim": row[4],
        "actions": normalize_actions_value(row[5]) if response_table == "b2b_visit_responses" else (payload.actions or []),
    }
    return response_payload


@router.put("/visits/{visit_id}/responses/{response_id}")
async def update_mystery_response(visit_id: str, response_id: str, payload: MysteryResponsePayload, db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    response_table = get_response_table(db)
    if not response_table:
        raise HTTPException(status_code=500, detail="No response table found")

    question_row = db.execute(
        text(
            """
            SELECT id, question_text, input_type, score_min, score_max, is_mandatory
            FROM questions
            WHERE id = :question_id
            """
        ),
        {"question_id": payload.question_id},
    ).mappings().first()
    if not question_row:
        raise HTTPException(status_code=404, detail="Question not found")

    validate_mystery_response(question_row, payload)

    if response_table == "b2b_visit_responses":
        row = db.execute(
            text(
                """
                UPDATE b2b_visit_responses
                SET question_id = :question_id,
                    score = :score,
                    answer_text = :answer_text,
                    verbatim = :verbatim,
                    actions = :actions,
                    updated_at = NOW()
                WHERE id = :response_id AND visit_id = :visit_id
                RETURNING id, question_id, score, answer_text, verbatim, actions, updated_at
                """
            ),
            {
                "response_id": response_id,
                "visit_id": visit_id,
                "question_id": payload.question_id,
                "score": payload.score,
                "answer_text": payload.answer_text,
                "verbatim": payload.verbatim,
                "actions": json.dumps(payload.actions or []),
            },
        ).fetchone()
    else:
        row = db.execute(
            text(
                """
                UPDATE responses
                SET question_id = :question_id,
                    score = :score,
                    answer_text = :answer_text,
                    verbatim = :verbatim
                WHERE id = :response_id AND visit_id = :visit_id
                RETURNING id, question_id, score, answer_text, verbatim
                """
            ),
            {
                "response_id": response_id,
                "visit_id": visit_id,
                "question_id": payload.question_id,
                "score": payload.score,
                "answer_text": payload.answer_text,
                "verbatim": payload.verbatim,
            },
        ).fetchone()

    if not row:
        db.rollback()
        raise HTTPException(status_code=404, detail="Response not found")

    upsert_mystery_answer(db, visit_id, payload.question_id, payload.score, payload.answer_text, payload.verbatim, payload.actions)
    db.commit()

    response_payload = {
        "response_id": str(row[0]),
        "question_id": row[1],
        "visit_id": visit_id,
        "score": row[2],
        "answer_text": row[3],
        "verbatim": row[4],
        "actions": normalize_actions_value(row[5]) if response_table == "b2b_visit_responses" else (payload.actions or []),
    }
    return response_payload


@router.put("/visits/{visit_id}/approve")
async def approve_mystery_visit(visit_id: str, payload: dict[str, Any], db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    visit_exists = db.execute(text("SELECT 1 FROM visits WHERE id = :visit_id"), {"visit_id": visit_id}).scalar()
    if not visit_exists:
        raise HTTPException(status_code=404, detail="Visit not found")

    approval_notes = (payload.get("approval_notes") if isinstance(payload, dict) else None) or None
    db.execute(
        text(
            """
            UPDATE visits
            SET status = 'Approved',
                approval_timestamp = NOW(),
                approval_notes = :approval_notes
            WHERE id = :visit_id
            """
        ),
        {"visit_id": visit_id, "approval_notes": approval_notes},
    )
    db.commit()
    return {"visit_id": visit_id, "status": "Approved", "message": "Visit approved successfully"}


@router.put("/visits/{visit_id}/reject")
async def reject_mystery_visit(visit_id: str, payload: dict[str, Any], db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    visit_exists = db.execute(text("SELECT 1 FROM visits WHERE id = :visit_id"), {"visit_id": visit_id}).scalar()
    if not visit_exists:
        raise HTTPException(status_code=404, detail="Visit not found")

    rejection_notes = (payload.get("rejection_notes") if isinstance(payload, dict) else None) or None
    db.execute(
        text(
            """
            UPDATE visits
            SET status = 'Rejected',
                rejection_timestamp = NOW(),
                rejection_notes = :rejection_notes
            WHERE id = :visit_id
            """
        ),
        {"visit_id": visit_id, "rejection_notes": rejection_notes},
    )
    db.commit()
    return {"visit_id": visit_id, "status": "Rejected", "message": "Visit rejected successfully"}


@router.put("/visits/{visit_id}/needs-changes")
async def request_mystery_changes(visit_id: str, payload: dict[str, Any], db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    visit_exists = db.execute(text("SELECT 1 FROM visits WHERE id = :visit_id"), {"visit_id": visit_id}).scalar()
    if not visit_exists:
        raise HTTPException(status_code=404, detail="Visit not found")

    change_notes = (payload.get("change_notes") if isinstance(payload, dict) else None) or None
    db.execute(
        text(
            """
            UPDATE visits
            SET status = 'Draft',
                change_notes = :change_notes
            WHERE id = :visit_id
            """
        ),
        {"visit_id": visit_id, "change_notes": change_notes},
    )
    db.commit()
    return {"visit_id": visit_id, "status": "Draft", "message": "Changes requested successfully"}


@router.get("/reports/surveys")
async def list_mystery_report_surveys(location_id: int, db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    rows = db.execute(
        text(
            """
            SELECT
                v.id,
                v.visit_date,
                v.status,
                l.name AS business_name,
                l.id AS location_id
            FROM visits v
            JOIN mystery_shopper_assessments m ON m.visit_id = v.id
            JOIN mystery_shopper_locations l ON l.id = m.location_id
            WHERE m.location_id = :location_id
            ORDER BY v.visit_date DESC, v.id DESC
            """
        ),
        {"location_id": location_id},
    ).mappings().all()
    eligible_statuses = {"Approved", "Completed"}
    eligible = []
    ineligible = []
    for row in rows:
        item = {
            "visit_id": str(row["id"]),
            "visit_date": row["visit_date"].isoformat() if row["visit_date"] else None,
            "status": row["status"] or "Draft",
            "business_name": row["business_name"],
            "location_id": row["location_id"],
        }
        if item["status"] in eligible_statuses:
            eligible.append(item)
        else:
            item["reason"] = "Survey is not completed/approved yet"
            ineligible.append(item)
    return {"location_id": location_id, "eligible": eligible, "ineligible": ineligible}


@router.get("/reports/export")
async def export_mystery_report(
    report_type: str | None = "lifetime",
    location_id: int | None = None,
    visit_id: str | None = None,
    report_date: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    download: bool = False,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    payload = build_mystery_report_payload(db, report_type, location_id, visit_id, report_date, date_from, date_to)
    report_html = render_mystery_report_html(payload, getattr(current_user, "name", "Unknown User"))
    filename = "cwscx-mystery-shopper-report.html"
    if download:
        return HTMLResponse(content=report_html, headers={"Content-Disposition": f'attachment; filename="{filename}"'})
    return {"filename": filename, "report_html": report_html, "report": payload}


@router.get("/reports/pdf")
async def export_mystery_report_pdf(
    report_type: str | None = "lifetime",
    location_id: int | None = None,
    visit_id: str | None = None,
    report_date: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    payload = build_mystery_report_payload(db, report_type, location_id, visit_id, report_date, date_from, date_to)
    pdf_bytes = render_mystery_report_pdf(payload, getattr(current_user, "name", "Unknown User"))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="cwscx-mystery-shopper-report.pdf"'},
    )


@router.post("/reports/email")
async def email_mystery_report(
    request: MysteryReportEmailRequest,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USERNAME", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_from = (
        os.getenv("SMTP_FROM", "").strip()
        or os.getenv("SMTP_EMAIL", "").strip()
        or os.getenv("STMP_EMAIL", "").strip()
        or smtp_user
    )
    smtp_use_tls_raw = os.getenv("SMTP_USE_TLS", "").strip().lower()
    smtp_use_ssl_raw = os.getenv("SMTP_USE_SSL", "").strip().lower()
    smtp_use_tls = (smtp_port == 587) if smtp_use_tls_raw == "" else smtp_use_tls_raw in {"1", "true", "yes"}
    smtp_use_ssl = (smtp_port == 465) if smtp_use_ssl_raw == "" else smtp_use_ssl_raw in {"1", "true", "yes"}

    if not smtp_host or not smtp_from:
        raise HTTPException(status_code=400, detail="SMTP is not configured. Set SMTP_HOST and SMTP_FROM (or SMTP_EMAIL/STMP_EMAIL).")

    payload = build_mystery_report_payload(db, request.report_type, request.location_id, request.visit_id, request.report_date, request.date_from, request.date_to)
    report_html = render_mystery_report_html(payload, getattr(current_user, "name", "Unknown User"))

    subject = request.subject or "CWSCX Mystery Shopper Report"
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = smtp_from
    message["To"] = ", ".join(request.to)

    intro_text = request.message or "Please find the latest Mystery Shopper report below."
    message.attach(MIMEText(f"{intro_text}\n\nThis email contains an HTML report.", "plain"))
    message.attach(MIMEText(f"<p>{intro_text}</p>{report_html}", "html"))

    try:
        smtp_client_cls = smtplib.SMTP_SSL if smtp_use_ssl else smtplib.SMTP
        with smtp_client_cls(smtp_host, smtp_port, timeout=20) as server:
            if not smtp_use_ssl:
                try:
                    server.ehlo()
                except Exception:
                    pass
                if smtp_use_tls:
                    if getattr(server, "has_extn", lambda *_args: False)("starttls"):
                        server.starttls()
                        try:
                            server.ehlo()
                        except Exception:
                            pass
                    else:
                        raise HTTPException(status_code=500, detail="SMTP server does not support STARTTLS.")
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, list(request.to), message.as_string())
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to send report email: {exc}")

    return {"status": "sent", "recipients": request.to, "subject": subject, "summary": payload.get("summary", {})}


@router.put("/visits/{visit_id}/submit")
async def submit_mystery_visit(visit_id: str, db: Session = Depends(get_db)):
    _ensure_mystery_shopper_schema(db)
    report_date = _utc_plus_4_today()

    db.execute(
        text("UPDATE visits SET status = 'Pending' WHERE id = :visit_id"),
        {"visit_id": visit_id},
    )
    db.execute(
        text(
            """
            UPDATE mystery_shopper_assessments
            SET report_completed_date = :report_completed_date,
                updated_at = NOW()
            WHERE visit_id = :visit_id
            """
        ),
        {"visit_id": visit_id, "report_completed_date": report_date},
    )
    db.commit()

    return {
        "visit_id": visit_id,
        "status": "Pending",
        "report_completed_date": report_date,
        "message": "Mystery Shopper visit submitted for review",
    }
