"""
Analytics API - Comprehensive metrics for B2B platform
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Any
from ..core.database import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


def resolve_survey_type_id(db: Session, survey_type: str | None) -> int | None:
    if not survey_type or survey_type.lower() == "all":
        return None

    return db.execute(
        text("SELECT id FROM survey_types WHERE name = :survey_type"),
        {"survey_type": survey_type},
    ).scalar()


@router.get("")
@router.get("/")
async def get_comprehensive_analytics(
    survey_type: str | None = None,
    business_ids: str | None = None,
    db: Session = Depends(get_db),
):
    """Get comprehensive analytics for dashboard."""
    try:
        print("Starting analytics query...")

        survey_type_id = resolve_survey_type_id(db, survey_type)
        where_extra = ""
        where_visits_extra = ""
        params: dict[str, Any] = {}
        if survey_type_id is not None:
            where_extra = " AND v.survey_type_id = :survey_type_id"
            where_visits_extra = " AND survey_type_id = :survey_type_id"
            params["survey_type_id"] = survey_type_id

        business_id_values: list[int] = []
        if business_ids:
            for raw in business_ids.split(","):
                token = raw.strip()
                if token.isdigit():
                    business_id_values.append(int(token))

        if business_id_values:
            placeholders = []
            for idx, value in enumerate(business_id_values):
                key = f"business_id_{idx}"
                placeholders.append(f":{key}")
                params[key] = value
            business_clause = ",".join(placeholders)
            where_extra += f" AND v.business_id IN ({business_clause})"
            where_visits_extra += f" AND business_id IN ({business_clause})"

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

        if has_question_key:
            q12_filter = "q.question_key = 'q12_overall_satisfaction'"
            q16_filter = "q.question_key = 'q16_other_provider_products'"
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
            relationship_filter = "q.order_index BETWEEN 1 AND 6"
        elif has_question_number:
            q12_filter = "q.question_number = 12"
            q16_filter = "q.question_number = 16"
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
            FROM b2b_visit_responses
            JOIN visits v ON b2b_visit_responses.visit_id = v.id
            WHERE 1=1
            {where_extra}
        """), params).fetchone()
        
        # Overall Relationship Score
        relationship_stats = db.execute(text(f"""
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
            FROM b2b_visit_responses r
            JOIN questions q ON r.question_id = q.id
            JOIN visits v ON r.visit_id = v.id
            WHERE v.status = 'Approved'
            AND q.input_type = 'score'
            AND {relationship_filter}
            AND r.score IS NOT NULL
            {where_extra}
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
            FROM b2b_visit_responses r
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
            FROM b2b_visit_responses r
            JOIN questions q ON r.question_id = q.id
            JOIN visits v ON r.visit_id = v.id
            WHERE v.status = 'Approved'
            AND {q12_filter}
            AND r.score IS NOT NULL
            {where_extra}
        """), params).fetchone()

        competitive_stats = db.execute(text(f"""
            SELECT
                COUNT(DISTINCT v.business_id) AS total_accounts,
                COUNT(DISTINCT CASE
                    WHEN {q16_filter}
                     AND (UPPER(COALESCE(r.answer_text, '')) = 'Y' OR LOWER(COALESCE(r.answer_text, '')) = 'yes')
                    THEN v.business_id
                END) AS accounts_using_competitors
            FROM visits v
            LEFT JOIN b2b_visit_responses r ON r.visit_id = v.id
            LEFT JOIN questions q ON q.id = r.question_id
            WHERE v.status = 'Approved'
            {where_extra}
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
                "formula": "(Sum of Relationship Question Scores) ÷ (Sum of Max Scores for Answered Relationship Questions) * 100",
                "scale": "0-100"
            },
            "competitive_exposure": {
                "exposure_rate": competitive_exposure_rate,
                "total_accounts": total_accounts,
                "accounts_using_competitors": accounts_using_competitors,
                "formula": "Accounts Using Competitor Services ÷ Total Accounts Surveyed",
                "scale": "Percentage"
            }
        }
    except Exception as e:
        print(f"Error getting analytics: {e}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to load analytics: {e}")
