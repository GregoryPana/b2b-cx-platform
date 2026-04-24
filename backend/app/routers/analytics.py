"""
Analytics API - Comprehensive metrics for B2B platform
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Any
from ..core.database import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


def has_table(db: Session, table_name: str) -> bool:
    return bool(db.execute(text(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = :table_name
        LIMIT 1
        """
    ), {"table_name": table_name}).scalar())


def has_column(db: Session, table_name: str, column_name: str) -> bool:
    return bool(db.execute(text(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = :table_name AND column_name = :column_name
        LIMIT 1
        """
    ), {"table_name": table_name, "column_name": column_name}).scalar())


def resolve_survey_type_id(db: Session, survey_type: str | None) -> int | None:
    if not survey_type or survey_type.lower() == "all":
        return None

    if not has_table(db, "survey_types"):
        return None

    has_code = has_column(db, "survey_types", "code")
    if has_code:
        return db.execute(
            text(
                """
                SELECT id
                FROM survey_types
                WHERE
                    lower(name) = lower(:survey_type)
                    OR lower(code) = lower(:survey_type)
                    OR replace(lower(name), ' ', '') = replace(lower(:survey_type), ' ', '')
                LIMIT 1
                """
            ),
            {"survey_type": survey_type},
        ).scalar()

    return db.execute(
        text("SELECT id FROM survey_types WHERE lower(name) = lower(:survey_type) LIMIT 1"),
        {"survey_type": survey_type},
    ).scalar()


def parse_business_ids(business_ids: str | None) -> list[int]:
    values: list[int] = []
    if not business_ids:
        return values
    for raw in business_ids.split(","):
        token = raw.strip()
        if token.isdigit():
            values.append(int(token))
    return values


def parse_location_ids(location_ids: str | None) -> list[int]:
    values: list[int] = []
    if not location_ids:
        return values
    for raw in location_ids.split(","):
        token = raw.strip()
        if token.isdigit():
            values.append(int(token))
    return values


def detect_question_columns(db: Session) -> tuple[bool, bool, bool]:
    has_question_key = db.execute(text("""
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'questions' AND column_name = 'question_key'
        LIMIT 1
    """)).scalar() is not None
    has_order_index = db.execute(text("""
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'questions' AND column_name = 'order_index'
        LIMIT 1
    """)).scalar() is not None
    has_question_number = db.execute(text("""
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'questions' AND column_name = 'question_number'
        LIMIT 1
    """)).scalar() is not None
    return has_question_key, has_order_index, has_question_number


def detect_mystery_tables(db: Session) -> tuple[bool, bool]:
    has_assessments = db.execute(text("""
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'mystery_shopper_assessments'
        LIMIT 1
    """)).scalar() is not None
    has_locations = db.execute(text("""
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'mystery_shopper_locations'
        LIMIT 1
    """)).scalar() is not None
    return has_assessments, has_locations


def get_response_table(db: Session, is_mystery_survey: bool = False) -> str | None:
    if has_table(db, "b2b_visit_responses"):
        return "b2b_visit_responses"
    if has_table(db, "responses"):
        return "responses"
    return None


@router.get("")
@router.get("/")
def get_comprehensive_analytics(
    survey_type: str | None = None,
    business_ids: str | None = None,
    mystery_location_ids: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    """Get comprehensive analytics for dashboard."""
    try:
        print("Starting analytics query...")

        survey_type_id = resolve_survey_type_id(db, survey_type)
        normalized_survey_type = (survey_type or "").strip().lower()
        is_mystery_survey = normalized_survey_type in {"mystery shopper", "mystery_shopper", "mystery", "mysteryshopper"}
        response_table = get_response_table(db, is_mystery_survey=is_mystery_survey)
        if not response_table:
            raise Exception("No response table found")
        has_visit_survey_type = has_column(db, "visits", "survey_type_id")
        where_extra = ""
        where_visits_extra = ""
        params: dict[str, Any] = {}
        if survey_type_id is not None and has_visit_survey_type:
            where_extra = " AND v.survey_type_id = :survey_type_id"
            where_visits_extra = " AND survey_type_id = :survey_type_id"
            params["survey_type_id"] = survey_type_id

        business_id_values = parse_business_ids(business_ids)
        location_id_values = parse_location_ids(mystery_location_ids)

        if business_id_values:
            placeholders = []
            for idx, value in enumerate(business_id_values):
                key = f"business_id_{idx}"
                placeholders.append(f":{key}")
                params[key] = value
            business_clause = ",".join(placeholders)
            where_extra += f" AND v.business_id IN ({business_clause})"
            where_visits_extra += f" AND business_id IN ({business_clause})"

        if is_mystery_survey and location_id_values:
            location_placeholders = []
            for idx, value in enumerate(location_id_values):
                key = f"mystery_location_id_{idx}"
                location_placeholders.append(f":{key}")
                params[key] = value
            location_clause = ",".join(location_placeholders)
            where_extra += (
                " AND EXISTS ("
                "SELECT 1 FROM mystery_shopper_assessments msa_filter "
                "WHERE msa_filter.visit_id = v.id "
                f"AND msa_filter.location_id IN ({location_clause})"
                ")"
            )
            where_visits_extra += (
                " AND EXISTS ("
                "SELECT 1 FROM mystery_shopper_assessments msa_filter "
                "WHERE msa_filter.visit_id = visits.id "
                f"AND msa_filter.location_id IN ({location_clause})"
                ")"
            )

        if date_from:
            where_extra += " AND v.visit_date >= :date_from"
            where_visits_extra += " AND visit_date >= :date_from"
            params["date_from"] = date_from
        if date_to:
            where_extra += " AND v.visit_date <= :date_to"
            where_visits_extra += " AND visit_date <= :date_to"
            params["date_to"] = date_to

        has_question_key, has_order_index, has_question_number = detect_question_columns(db)

        if has_question_key:
            q12_filter = "q.question_key = 'q12_overall_satisfaction'"
            q16_filter = "q.question_key = 'q16_other_provider_products'"
            ms_csat_filter = "q.question_key IN ('ms_staff_interaction_satisfaction','ms_store_environment_satisfaction')"
            ms_waiting_time_filter = "q.question_key = 'ms_waiting_time'"
            ms_service_completion_filter = "q.question_key = 'ms_service_completion_time'"
            relationship_filter = (
                "q.question_key IN ("
                "'q01_relationship_strength',"
                "'q02_ae_information_updates',"
                "'q03_ae_professionalism',"
                "'q04_ae_business_understanding',"
                "'q05_contacts_visit_satisfaction',"
                "'q06_regular_updates'"
                ")"
            )
        elif has_order_index:
            q12_filter = "q.order_index = 12"
            q16_filter = "q.order_index = 16"
            ms_csat_filter = "q.order_index IN (24,25)"
            ms_waiting_time_filter = "q.order_index = 22"
            ms_service_completion_filter = "q.order_index = 23"
            relationship_filter = "q.order_index BETWEEN 1 AND 6"
        elif has_question_number:
            q12_filter = "q.question_number = 12"
            q16_filter = "q.question_number = 16"
            ms_csat_filter = "q.question_number IN (24,25)"
            ms_waiting_time_filter = "q.question_number = 22"
            ms_service_completion_filter = "q.question_number = 23"
            relationship_filter = "q.question_number BETWEEN 1 AND 6"
        else:
            raise Exception("questions table missing question_key/order_index/question_number columns")
        
        # Get visit statistics
        visit_stats = db.execute(text(f"""
            SELECT 
                COUNT(*) as total_visits,
                SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draft_visits,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_visits,
                SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved_visits,
                SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected_visits
            FROM visits
            WHERE 1=1
            {where_visits_extra}
        """), params).fetchone()
        
        # Get response statistics (only for meaningful metrics)
        response_stats = db.execute(text(f"""
            SELECT 
                COUNT(CASE WHEN answer_text IS NOT NULL AND answer_text != '' THEN 1 ELSE 0 END) as text_responses
            FROM {response_table}
            JOIN visits v ON {response_table}.visit_id = v.id
            WHERE 1=1
            {where_extra}
        """), params).fetchone()
        
        # Overall Relationship Score
        relationship_stats = db.execute(text(f"""
            WITH latest_business_visits AS (
                SELECT ranked.id, ranked.business_id
                FROM (
                    SELECT
                        v.id,
                        v.business_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY v.business_id
                            ORDER BY v.visit_date DESC, v.id DESC
                        ) AS rn
                    FROM visits v
                    WHERE v.status = 'Approved'
                    {where_extra}
                ) ranked
                WHERE ranked.rn = 1
            )
            SELECT
                AVG(r.score) as avg_relationship_score,
                COUNT(r.score) as relationship_questions_answered,
                SUM(r.score) as total_relationship_score,
                SUM(
                    CASE
                        WHEN q.score_max IS NOT NULL AND q.score_max > 0 THEN q.score_max
                        ELSE 10
                    END
                ) as relationship_possible_score
            FROM latest_business_visits lbv
            JOIN {response_table} r ON r.visit_id = lbv.id
            JOIN questions q ON r.question_id = q.id
            WHERE q.input_type = 'score'
            AND {relationship_filter}
            AND r.score IS NOT NULL
        """), params).fetchone()

        relationship_avg = float(relationship_stats.avg_relationship_score) if relationship_stats.avg_relationship_score else 0.0
        relationship_total = float(relationship_stats.total_relationship_score) if relationship_stats.total_relationship_score else 0.0
        relationship_possible = (
            float(relationship_stats.relationship_possible_score)
            if relationship_stats.relationship_possible_score
            else 0.0
        )
        relationship_score = round((relationship_total / relationship_possible) * 100, 2) if relationship_possible else 0.0
        relationship_score = max(0.0, min(100.0, relationship_score))
        
        # Get NPS statistics
        nps_stats = db.execute(text(f"""
            SELECT 
                SUM(CASE WHEN r.score >= 9 THEN 1 ELSE 0 END) as promoters,
                SUM(CASE WHEN r.score <= 6 THEN 1 ELSE 0 END) as detractors,
                SUM(CASE WHEN r.score >= 7 AND r.score <= 8 THEN 1 ELSE 0 END) as passives,
                COUNT(r.score) as total_responses
            FROM {response_table} r
            JOIN questions q ON r.question_id = q.id
            JOIN visits v ON r.visit_id = v.id
            WHERE q.is_nps = true 
            AND v.status = 'Approved'
            AND r.score IS NOT NULL
            {where_extra}
        """), params).fetchone()
        
        # Calculate NPS
        nps = None
        promoters_pct = 0
        detractors_pct = 0
        passive_pct = 0
        
        if nps_stats.total_responses:
            promoters_pct = (nps_stats.promoters / nps_stats.total_responses) * 100
            detractors_pct = (nps_stats.detractors / nps_stats.total_responses) * 100
            passive_pct = (nps_stats.passives / nps_stats.total_responses) * 100
            nps = round(promoters_pct - detractors_pct, 2)
        
        # Get customer satisfaction from question 12 (10-point scale)
        # Thresholds:
        # 9-10 Very Satisfied, 7-8 Satisfied, 5-6 Neutral, 3-4 Dissatisfied, 0-2 Very Dissatisfied
        satisfaction_stats = db.execute(text(f"""
            SELECT 
                AVG(CASE WHEN {q12_filter} AND r.score IS NOT NULL THEN r.score ELSE NULL END) as avg_satisfaction,
                COUNT(CASE WHEN {q12_filter} AND r.score IS NOT NULL THEN 1 ELSE 0 END) as satisfaction_responses,
                SUM(CASE WHEN {q12_filter} AND r.score BETWEEN 0 AND 2 THEN 1 ELSE 0 END) as very_dissatisfied,
                SUM(CASE WHEN {q12_filter} AND r.score BETWEEN 3 AND 4 THEN 1 ELSE 0 END) as dissatisfied,
                SUM(CASE WHEN {q12_filter} AND r.score BETWEEN 5 AND 6 THEN 1 ELSE 0 END) as neutral,
                SUM(CASE WHEN {q12_filter} AND r.score BETWEEN 7 AND 8 THEN 1 ELSE 0 END) as satisfied,
                SUM(CASE WHEN {q12_filter} AND r.score BETWEEN 9 AND 10 THEN 1 ELSE 0 END) as very_satisfied
            FROM {response_table} r
            JOIN questions q ON r.question_id = q.id
            JOIN visits v ON r.visit_id = v.id
            WHERE v.status = 'Approved'
            AND {q12_filter}
            AND r.score IS NOT NULL
            {where_extra}
        """), params).fetchone()

        competitive_stats = db.execute(text(f"""
            WITH latest_business_visits AS (
                SELECT ranked.id, ranked.business_id
                FROM (
                    SELECT
                        v.id,
                        v.business_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY v.business_id
                            ORDER BY v.visit_date DESC, v.id DESC
                        ) AS rn
                    FROM visits v
                    WHERE v.status = 'Approved'
                    {where_extra}
                ) ranked
                WHERE ranked.rn = 1
            ), business_competitor_usage AS (
                SELECT
                    lbv.business_id,
                    MAX(
                        CASE
                            WHEN {q16_filter}
                             AND (UPPER(COALESCE(r.answer_text, '')) = 'Y' OR LOWER(COALESCE(r.answer_text, '')) = 'yes')
                            THEN 1
                            ELSE 0
                        END
                    ) AS uses_competitor
                FROM latest_business_visits lbv
                LEFT JOIN {response_table} r ON r.visit_id = lbv.id
                LEFT JOIN questions q ON q.id = r.question_id
                GROUP BY lbv.business_id
            )
            SELECT
                COUNT(*) AS total_accounts,
                SUM(uses_competitor) AS accounts_using_competitors
            FROM business_competitor_usage
        """), params).fetchone()

        total_accounts = int(competitive_stats.total_accounts or 0)
        accounts_using_competitors = int(competitive_stats.accounts_using_competitors or 0)
        competitive_exposure_rate = round((accounts_using_competitors / total_accounts) * 100, 2) if total_accounts else 0.0

        satisfaction_response_count = int(satisfaction_stats.satisfaction_responses or 0)
        very_dissatisfied_count = int(satisfaction_stats.very_dissatisfied or 0)
        dissatisfied_count = int(satisfaction_stats.dissatisfied or 0)
        neutral_count = int(satisfaction_stats.neutral or 0)
        satisfied_count = int(satisfaction_stats.satisfied or 0)
        very_satisfied_count = int(satisfaction_stats.very_satisfied or 0)

        csat_score = 0.0
        if satisfaction_response_count:
            csat_score = round(
                ((satisfied_count + very_satisfied_count) / satisfaction_response_count) * 100,
                2,
            )

        if is_mystery_survey:
            mystery_csat_stats = db.execute(text(f"""
                SELECT
                    AVG(CASE WHEN {ms_csat_filter} AND r.score IS NOT NULL THEN r.score ELSE NULL END) as avg_score,
                    COUNT(CASE WHEN {ms_csat_filter} AND r.score IS NOT NULL THEN 1 ELSE 0 END) as response_count
                FROM {response_table} r
                JOIN questions q ON r.question_id = q.id
                JOIN visits v ON r.visit_id = v.id
                WHERE v.status = 'Approved'
                {where_extra}
            """), params).fetchone()

            mystery_waiting_rows = db.execute(text(f"""
                SELECT COALESCE(r.answer_text, 'Unknown') as label, COUNT(*) as count
                FROM {response_table} r
                JOIN questions q ON r.question_id = q.id
                JOIN visits v ON r.visit_id = v.id
                WHERE v.status = 'Approved'
                  AND {ms_waiting_time_filter}
                  AND COALESCE(r.answer_text, '') <> ''
                  {where_extra}
                GROUP BY COALESCE(r.answer_text, 'Unknown')
                ORDER BY count DESC
            """), params).all()

            mystery_service_rows = db.execute(text(f"""
                SELECT COALESCE(r.answer_text, 'Unknown') as label, COUNT(*) as count
                FROM {response_table} r
                JOIN questions q ON r.question_id = q.id
                JOIN visits v ON r.visit_id = v.id
                WHERE v.status = 'Approved'
                  AND {ms_service_completion_filter}
                  AND COALESCE(r.answer_text, '') <> ''
                  {where_extra}
                GROUP BY COALESCE(r.answer_text, 'Unknown')
                ORDER BY count DESC
            """), params).all()

            has_mystery_assessments, has_mystery_locations = detect_mystery_tables(db)

            if has_mystery_assessments and has_mystery_locations:
                mystery_location_rows = db.execute(text(f"""
                    SELECT
                        COALESCE(l.name, b.name, 'Unknown Location') as location_name,
                        COUNT(DISTINCT v.id) as visits,
                        AVG(CASE WHEN {ms_csat_filter} THEN r.score END)::float as csat_average
                    FROM visits v
                    LEFT JOIN mystery_shopper_assessments msa ON msa.visit_id = v.id
                    LEFT JOIN mystery_shopper_locations l ON l.id = msa.location_id
                    LEFT JOIN businesses b ON b.id = v.business_id
                    LEFT JOIN {response_table} r ON r.visit_id = v.id
                    LEFT JOIN questions q ON q.id = r.question_id
                    WHERE v.status = 'Approved'
                    {where_extra}
                    GROUP BY COALESCE(l.name, b.name, 'Unknown Location')
                    ORDER BY visits DESC, location_name ASC
                    LIMIT 12
                """), params).all()
            else:
                mystery_location_rows = db.execute(text(f"""
                    SELECT
                        COALESCE(b.name, 'Unknown Location') as location_name,
                        COUNT(DISTINCT v.id) as visits,
                        AVG(CASE WHEN {ms_csat_filter} THEN r.score END)::float as csat_average
                    FROM visits v
                    LEFT JOIN businesses b ON b.id = v.business_id
                    LEFT JOIN {response_table} r ON r.visit_id = v.id
                    LEFT JOIN questions q ON q.id = r.question_id
                    WHERE v.status = 'Approved'
                    {where_extra}
                    GROUP BY COALESCE(b.name, 'Unknown Location')
                    ORDER BY visits DESC, location_name ASC
                    LIMIT 12
                """), params).all()

            mystery_visit_trend_rows = db.execute(text(f"""
                SELECT
                    v.visit_date,
                    COUNT(*) as visit_count
                FROM visits v
                WHERE v.status = 'Approved'
                {where_visits_extra}
                GROUP BY v.visit_date
                ORDER BY v.visit_date DESC
                LIMIT 14
            """), params).all()

            mystery_shopper = {
                "csat_average": round(float(mystery_csat_stats.avg_score), 2) if mystery_csat_stats.avg_score is not None else None,
                "csat_response_count": int(mystery_csat_stats.response_count or 0),
                "waiting_time_distribution": [
                    {"label": row.label, "count": int(row.count or 0)} for row in mystery_waiting_rows
                ],
                "service_completion_distribution": [
                    {"label": row.label, "count": int(row.count or 0)} for row in mystery_service_rows
                ],
                "location_breakdown": [
                    {
                        "location_name": row.location_name,
                        "visits": int(row.visits or 0),
                        "csat_average": round(float(row.csat_average), 2) if row.csat_average is not None else None,
                    }
                    for row in mystery_location_rows
                ],
                "visit_trend": [
                    {
                        "visit_date": row.visit_date.isoformat() if row.visit_date else None,
                        "visit_count": int(row.visit_count or 0),
                    }
                    for row in reversed(mystery_visit_trend_rows)
                ],
            }
        else:
            mystery_shopper = {
                "csat_average": None,
                "csat_response_count": 0,
                "waiting_time_distribution": [],
                "service_completion_distribution": [],
                "location_breakdown": [],
                "visit_trend": [],
            }
        
        return {
            "visits": {
                "total": int(visit_stats.total_visits or 0),
                "draft": int(visit_stats.draft_visits or 0),
                "pending": int(visit_stats.pending_visits or 0),
                "completed": int(visit_stats.approved_visits or 0),
                "approved": int(visit_stats.approved_visits or 0),
                "rejected": int(visit_stats.rejected_visits or 0)
            },
            "responses": {
                "text_responses": int(response_stats.text_responses or 0)
            },
            "nps": {
                "nps": nps,
                "promoters": int(nps_stats.promoters or 0),
                "detractors": int(nps_stats.detractors or 0),
                "passives": int(nps_stats.passives or 0),
                "total_responses": int(nps_stats.total_responses or 0),
                "promoter_percentage": round(promoters_pct, 1),
                "detractor_percentage": round(detractors_pct, 1),
                "passive_percentage": round(passive_pct, 1)
            },
            "customer_satisfaction": {
                "avg_score": float(satisfaction_stats.avg_satisfaction) if satisfaction_stats.avg_satisfaction else 0,
                "response_count": satisfaction_response_count,
                "csat_score": csat_score,
                "csat_formula": "(Satisfied [7-8] + Very Satisfied [9-10]) / Total responses * 100",
                "question_text": "Rate your overall C&W Satisfaction (from question 12)",
                "score_distribution": {
                    "very_dissatisfied": very_dissatisfied_count,
                    "dissatisfied": dissatisfied_count,
                    "neutral": neutral_count,
                    "satisfied": satisfied_count,
                    "very_satisfied": very_satisfied_count,
                }
            },
            "relationship_score": {
                "score": relationship_score,
                "avg_score": relationship_avg,
                "total_score": relationship_total,
                "possible_score": relationship_possible,
                "questions_answered": int(relationship_stats.relationship_questions_answered or 0),
                "formula": "(Sum of Relationship Question Scores) / (Sum of Max Scores for Answered Relationship Questions) * 100",
                "scale": "0-100"
            },
            "competitive_exposure": {
                "exposure_rate": competitive_exposure_rate,
                "total_accounts": total_accounts,
                "accounts_using_competitors": accounts_using_competitors,
                "formula": "Accounts Using Competitor Services / Total Accounts Surveyed",
                "scale": "Percentage"
            },
            "mystery_shopper": mystery_shopper,
        }
    except Exception as e:
        print(f"Error getting analytics: {e}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to load analytics: {e}")


@router.get("/questions")
def get_question_averages(
    survey_type: str | None = None,
    business_ids: str | None = None,
    mystery_location_ids: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    """Get per-question averages for drill-down analytics."""
    try:
        survey_type_id = resolve_survey_type_id(db, survey_type)
        normalized_survey_type = (survey_type or "").strip().lower()
        is_mystery_survey = normalized_survey_type in {"mystery shopper", "mystery_shopper", "mystery", "mysteryshopper"}
        response_table = get_response_table(db, is_mystery_survey=is_mystery_survey)
        if not response_table or not has_table(db, response_table):
            return {"items": []}
        has_visit_survey_type = has_column(db, "visits", "survey_type_id")
        where_extra = ""
        params: dict[str, Any] = {}

        if survey_type_id is not None and has_visit_survey_type:
            where_extra += " AND v.survey_type_id = :survey_type_id"
            params["survey_type_id"] = survey_type_id

        business_id_values = parse_business_ids(business_ids)
        location_id_values = parse_location_ids(mystery_location_ids)
        if business_id_values:
            placeholders = []
            for idx, value in enumerate(business_id_values):
                key = f"business_id_{idx}"
                placeholders.append(f":{key}")
                params[key] = value
            where_extra += f" AND v.business_id IN ({','.join(placeholders)})"

        if is_mystery_survey and location_id_values:
            placeholders = []
            for idx, value in enumerate(location_id_values):
                key = f"mystery_location_id_{idx}"
                placeholders.append(f":{key}")
                params[key] = value
            where_extra += (
                " AND EXISTS ("
                "SELECT 1 FROM mystery_shopper_assessments msa_filter "
                "WHERE msa_filter.visit_id = v.id "
                f"AND msa_filter.location_id IN ({','.join(placeholders)})"
                ")"
            )

        if date_from:
            where_extra += " AND v.visit_date >= :date_from"
            params["date_from"] = date_from
        if date_to:
            where_extra += " AND v.visit_date <= :date_to"
            params["date_to"] = date_to

        has_question_key, has_order_index, has_question_number = detect_question_columns(db)
        if has_order_index:
            order_expr = "q.order_index"
            number_select = "q.order_index AS question_number"
        elif has_question_number:
            order_expr = "q.question_number"
            number_select = "q.question_number AS question_number"
        else:
            order_expr = "q.id"
            number_select = "q.id AS question_number"

        key_select = "q.question_key AS question_key" if has_question_key else "NULL AS question_key"

        rows = db.execute(text(f"""
            SELECT
                q.id AS question_id,
                {number_select},
                {key_select},
                q.category,
                q.question_text,
                q.score_min,
                q.score_max,
                AVG(r.score)::float AS average_score,
                COUNT(r.score) AS response_count,
                MIN(r.score) AS min_score,
                MAX(r.score) AS max_score
            FROM {response_table} r
            JOIN questions q ON r.question_id = q.id
            JOIN visits v ON r.visit_id = v.id
            WHERE v.status = 'Approved'
              AND q.input_type = 'score'
              AND r.score IS NOT NULL
              {where_extra}
            GROUP BY q.id, q.category, q.question_text, {order_expr}{', q.question_key' if has_question_key else ''}
            ORDER BY {order_expr}, q.id
        """), params).fetchall()

        return {
            "items": [
                {
                    "question_id": int(row.question_id),
                    "question_number": int(row.question_number) if row.question_number is not None else int(row.question_id),
                    "question_key": row.question_key,
                    "category": row.category,
                    "question_text": row.question_text,
                    "score_min": row.score_min,
                    "score_max": row.score_max,
                    "average_score": float(row.average_score) if row.average_score is not None else None,
                    "response_count": int(row.response_count),
                    "min_score": float(row.min_score) if row.min_score is not None else None,
                    "max_score": float(row.max_score) if row.max_score is not None else None,
                }
                for row in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load question averages: {e}")


@router.get("/questions/yes-no")
def get_yes_no_question_analytics(
    survey_type: str | None = None,
    business_ids: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    """Get per-question yes/no distribution for approved visits."""
    try:
        survey_type_id = resolve_survey_type_id(db, survey_type)
        normalized_survey_type = (survey_type or "").strip().lower()
        is_mystery_survey = normalized_survey_type in {"mystery shopper", "mystery_shopper", "mystery", "mysteryshopper"}
        response_table = get_response_table(db, is_mystery_survey=is_mystery_survey)
        if not response_table or not has_table(db, response_table):
            return {"items": []}

        has_visit_survey_type = has_column(db, "visits", "survey_type_id")
        where_extra = ""
        params: dict[str, Any] = {}

        if survey_type_id is not None and has_visit_survey_type:
            where_extra += " AND v.survey_type_id = :survey_type_id"
            params["survey_type_id"] = survey_type_id

        business_id_values = parse_business_ids(business_ids)
        if business_id_values:
            placeholders = []
            for idx, value in enumerate(business_id_values):
                key = f"business_id_{idx}"
                placeholders.append(f":{key}")
                params[key] = value
            where_extra += f" AND v.business_id IN ({','.join(placeholders)})"

        if date_from:
            where_extra += " AND v.visit_date >= :date_from"
            params["date_from"] = date_from
        if date_to:
            where_extra += " AND v.visit_date <= :date_to"
            params["date_to"] = date_to

        has_question_key, has_order_index, has_question_number = detect_question_columns(db)
        if has_order_index:
            order_expr = "q.order_index"
            number_select = "q.order_index AS question_number"
        elif has_question_number:
            order_expr = "q.question_number"
            number_select = "q.question_number AS question_number"
        else:
            order_expr = "q.id"
            number_select = "q.id AS question_number"

        key_select = "q.question_key AS question_key" if has_question_key else "NULL AS question_key"

        rows = db.execute(text(f"""
            SELECT
                q.id AS question_id,
                {number_select},
                {key_select},
                q.category,
                q.question_text,
                SUM(CASE WHEN upper(trim(COALESCE(r.answer_text, ''))) IN ('Y', 'YES') THEN 1 ELSE 0 END) AS yes_count,
                SUM(CASE WHEN upper(trim(COALESCE(r.answer_text, ''))) IN ('N', 'NO') THEN 1 ELSE 0 END) AS no_count,
                COUNT(CASE WHEN trim(COALESCE(r.answer_text, '')) <> '' THEN 1 END) AS total_count
            FROM {response_table} r
            JOIN questions q ON r.question_id = q.id
            JOIN visits v ON r.visit_id = v.id
            WHERE v.status = 'Approved'
              AND q.input_type = 'yes_no'
              {where_extra}
            GROUP BY q.id, q.category, q.question_text, {order_expr}{', q.question_key' if has_question_key else ''}
            ORDER BY {order_expr}, q.id
        """), params).fetchall()

        items = []
        for row in rows:
            yes_count = int(row.yes_count or 0)
            no_count = int(row.no_count or 0)
            total_count = int(row.total_count or 0)
            yes_percent = round((yes_count / total_count) * 100, 2) if total_count else 0.0
            no_percent = round((no_count / total_count) * 100, 2) if total_count else 0.0
            items.append(
                {
                    "question_id": int(row.question_id),
                    "question_number": int(row.question_number) if row.question_number is not None else int(row.question_id),
                    "question_key": row.question_key,
                    "category": row.category,
                    "question_text": row.question_text,
                    "yes_count": yes_count,
                    "no_count": no_count,
                    "total_count": total_count,
                    "yes_percent": yes_percent,
                    "no_percent": no_percent,
                }
            )

        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load yes/no analytics: {e}")


@router.get("/account-executives/yes-no-trends")
def get_account_executive_yes_no_trends(
    survey_type: str | None = None,
    business_ids: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    """Get Q4/Q6 yes rates grouped by captured account executive name."""
    try:
        survey_type_id = resolve_survey_type_id(db, survey_type)
        response_table = "b2b_visit_responses" if has_table(db, "b2b_visit_responses") else "responses"
        if not response_table or not has_table(db, response_table) or not has_column(db, "visits", "account_executive_name"):
            return {"items": []}

        has_question_number, has_order_index, has_question_key = detect_question_columns(db)
        if has_question_number:
            number_select = "q.question_number AS question_number"
            order_expr = "q.question_number"
        elif has_order_index:
            number_select = "q.order_index AS question_number"
            order_expr = "q.order_index"
        else:
            number_select = "q.id AS question_number"
            order_expr = "q.id"

        where_extra = " AND COALESCE(v.account_executive_name, '') <> ''"
        params: dict[str, Any] = {}
        has_visit_survey_type = has_column(db, "visits", "survey_type_id")

        if survey_type_id is not None and has_visit_survey_type:
            where_extra += " AND v.survey_type_id = :survey_type_id"
            params["survey_type_id"] = survey_type_id

        business_id_values = parse_business_ids(business_ids)
        if business_id_values:
            placeholders = []
            for idx, value in enumerate(business_id_values):
                key = f"business_id_{idx}"
                placeholders.append(f":{key}")
                params[key] = value
            where_extra += f" AND v.business_id IN ({','.join(placeholders)})"

        if date_from:
            where_extra += " AND v.visit_date >= :date_from"
            params["date_from"] = date_from
        if date_to:
            where_extra += " AND v.visit_date <= :date_to"
            params["date_to"] = date_to

        rows = db.execute(text(f"""
            SELECT
                v.account_executive_name,
                {number_select},
                q.question_text,
                COUNT(*) AS total_count,
                COUNT(CASE WHEN lower(COALESCE(r.answer_text, '')) IN ('y', 'yes') THEN 1 END) AS yes_count
            FROM {response_table} r
            JOIN visits v ON r.visit_id = v.id
            JOIN questions q ON r.question_id = q.id
            WHERE v.status = 'Approved'
              AND q.input_type = 'yes_no'
              AND ({order_expr} = 4 OR {order_expr} = 6)
              {where_extra}
            GROUP BY v.account_executive_name, q.question_text, {order_expr}
            ORDER BY lower(v.account_executive_name), {order_expr}
        """), params).fetchall()

        items = []
        for row in rows:
            total_count = int(row.total_count or 0)
            yes_count = int(row.yes_count or 0)
            items.append({
                "account_executive_name": row.account_executive_name,
                "question_number": int(row.question_number) if row.question_number is not None else None,
                "question_text": row.question_text,
                "yes_count": yes_count,
                "total_count": total_count,
                "yes_percent": round((yes_count / total_count) * 100, 2) if total_count else 0.0,
            })

        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load account executive yes/no trends: {e}")


@router.get("/questions/{question_id}/trend")
def get_question_trend(
    question_id: int,
    survey_type: str | None = None,
    business_ids: str | None = None,
    mystery_location_ids: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    interval: str = "week",
    db: Session = Depends(get_db),
):
    """Get trend points over time for one score-based question."""
    try:
        interval_value = interval.lower().strip()
        if interval_value not in {"day", "week", "month"}:
            interval_value = "week"

        survey_type_id = resolve_survey_type_id(db, survey_type)
        normalized_survey_type = (survey_type or "").strip().lower()
        is_mystery_survey = normalized_survey_type in {"mystery shopper", "mystery_shopper", "mystery", "mysteryshopper"}
        response_table = get_response_table(db, is_mystery_survey=is_mystery_survey)
        if not response_table or not has_table(db, response_table):
            return {
                "question": {"id": question_id, "question_text": "", "category": ""},
                "interval": interval_value,
                "points": [],
            }
        has_visit_survey_type = has_column(db, "visits", "survey_type_id")
        where_extra = " AND q.id = :question_id"
        params: dict[str, Any] = {"question_id": question_id}

        if survey_type_id is not None and has_visit_survey_type:
            where_extra += " AND v.survey_type_id = :survey_type_id"
            params["survey_type_id"] = survey_type_id

        business_id_values = parse_business_ids(business_ids)
        location_id_values = parse_location_ids(mystery_location_ids)
        if business_id_values:
            placeholders = []
            for idx, value in enumerate(business_id_values):
                key = f"business_id_{idx}"
                placeholders.append(f":{key}")
                params[key] = value
            where_extra += f" AND v.business_id IN ({','.join(placeholders)})"

        if is_mystery_survey and location_id_values:
            placeholders = []
            for idx, value in enumerate(location_id_values):
                key = f"mystery_location_id_{idx}"
                placeholders.append(f":{key}")
                params[key] = value
            where_extra += (
                " AND EXISTS ("
                "SELECT 1 FROM mystery_shopper_assessments msa_filter "
                "WHERE msa_filter.visit_id = v.id "
                f"AND msa_filter.location_id IN ({','.join(placeholders)})"
                ")"
            )

        if date_from:
            where_extra += " AND v.visit_date >= :date_from"
            params["date_from"] = date_from
        if date_to:
            where_extra += " AND v.visit_date <= :date_to"
            params["date_to"] = date_to

        question_row = db.execute(
            text("SELECT id, question_text, category FROM questions WHERE id = :question_id"),
            {"question_id": question_id},
        ).fetchone()
        if not question_row:
            raise HTTPException(status_code=404, detail="Question not found")

        rows = db.execute(text(f"""
            SELECT
                date_trunc('{interval_value}', v.visit_date)::date AS period,
                AVG(r.score)::float AS average_score,
                COUNT(r.score) AS response_count
            FROM {response_table} r
            JOIN visits v ON r.visit_id = v.id
            JOIN questions q ON r.question_id = q.id
            WHERE v.status = 'Approved'
              AND q.input_type = 'score'
              AND r.score IS NOT NULL
              {where_extra}
            GROUP BY date_trunc('{interval_value}', v.visit_date)
            ORDER BY period
        """), params).fetchall()

        return {
            "question": {
                "id": int(question_row.id),
                "question_text": question_row.question_text,
                "category": question_row.category,
            },
            "interval": interval_value,
            "points": [
                {
                    "period": row.period.isoformat() if row.period else None,
                    "average_score": round(float(row.average_score), 2) if row.average_score is not None else 0.0,
                    "response_count": int(row.response_count or 0),
                }
                for row in rows
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load question trend: {e}")
