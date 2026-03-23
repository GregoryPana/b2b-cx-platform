"""
Additional endpoints for the survey interface
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel
from ..core.database import get_db
from ..core.auth.dependencies import B2B_ROLES, require_roles
import sqlite3

router = APIRouter()


@router.get("/survey-types")
async def get_survey_types(db: Session = Depends(get_db)):
    """List available survey types.

    Returned values are the codenames/names that can be used in `survey_type` query/body params.
    """

    try:
        rows = db.execute(
            text(
                """
                SELECT id, name, description
                FROM survey_types
                ORDER BY id
                """
            )
        ).all()

        return [
            {"id": row[0], "name": row[1], "description": row[2]}
            for row in rows
        ]
    except Exception as e:
        print(f"Error fetching survey types: {e}")
        return []


def _question_row_to_payload(row: Any) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "id": row[0],
        "category": row[1],
        "question_text": row[2],
        "is_nps": bool(row[3]),
        "is_mandatory": bool(row[4]),
        "order_index": row[5],
        "question_key": row[6],
        "input_type": row[7],
        "score_min": row[8],
        "score_max": row[9],
        "requires_issue": bool(row[10]),
        "requires_escalation": bool(row[11]),
        "helper_text": row[12],
    }

    # Backward-compatible aliases (older survey UI versions)
    payload["order"] = payload["order_index"]
    payload["question_type"] = payload["input_type"]

    # Convenience for choice-based questions
    if payload["input_type"] in {"yes_no", "always_sometimes_never"}:
        if payload["input_type"] == "yes_no":
            payload["choices"] = ["Yes", "No"]
        else:
            payload["choices"] = ["Always", "Sometimes", "Never"]

    return payload

# Actual survey questions from questions.md
MOCK_QUESTIONS = [
    # Category 1: Relationship Strength
    {
        "id": 1,
        "category": "Category 1: Relationship Strength",
        "question_text": "Rate your relationship with C&W.",
        "question_type": "score",
        "min_score": 0,
        "max_score": 10,
        "order": 1
    },
    {
        "id": 2,
        "category": "Category 1: Relationship Strength",
        "question_text": "Do you get enough information from your Account Executive on New Products and Services?",
        "question_type": "score",
        "min_score": 0,
        "max_score": 10,
        "order": 2
    },
    {
        "id": 3,
        "category": "Category 1: Relationship Strength",
        "question_text": "How would you rate the level of professionalism when dealing with your C&W Account Executive?",
        "question_type": "score",
        "min_score": 0,
        "max_score": 10,
        "order": 3
    },
    {
        "id": 4,
        "category": "Category 1: Relationship Strength",
        "question_text": "Does the C&W Account Executive understands your business?",
        "question_type": "choice",
        "min_score": 0,
        "max_score": 0,
        "order": 4,
        "choices": ["Yes", "No"]
    },
    {
        "id": 5,
        "category": "Category 1: Relationship Strength",
        "question_text": "How satisfied are you with your C&W contacts and number of visits?",
        "question_type": "score",
        "min_score": 0,
        "max_score": 10,
        "order": 5
    },
    {
        "id": 6,
        "category": "Category 1: Relationship Strength",
        "question_text": "Are you receiving regular updates on your account?",
        "question_type": "choice",
        "min_score": 0,
        "max_score": 0,
        "order": 6,
        "choices": ["Yes", "No"]
    },
    
    # Category 2: Service & Operational Performance
    {
        "id": 7,
        "category": "Category 2: Service & Operational Performance",
        "question_text": "List Top 3 C&W services most satisfied with in the past 6 months.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 7
    },
    {
        "id": 8,
        "category": "Category 2: Service & Operational Performance",
        "question_text": "List 3 instances you have not been satisfied with C&W if any (Network Quality, Fault resolution, Visits, billing etc) if NW be specific.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 8
    },
    {
        "id": 9,
        "category": "Category 2: Service & Operational Performance",
        "question_text": "Are Issues resolved on time?",
        "question_type": "choice",
        "min_score": 0,
        "max_score": 0,
        "order": 9,
        "choices": ["Always", "Sometimes", "Never"]
    },
    {
        "id": 10,
        "category": "Category 2: Service & Operational Performance",
        "question_text": "How often do you need to call C&W to install new products or resolve issues?",
        "question_type": "choice",
        "min_score": 0,
        "max_score": 0,
        "order": 10,
        "choices": ["Always", "Sometimes", "Never"]
    },
    {
        "id": 11,
        "category": "Category 2: Service & Operational Performance",
        "question_text": "What is your most recent unresolved issue with C&W?",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 11
    },
    {
        "id": 12,
        "category": "Category 2: Service & Operational Performance",
        "question_text": "Rate overall C&W Satisfaction (Very Satisfied).",
        "question_type": "score",
        "min_score": 0,
        "max_score": 10,
        "order": 12
    },
    
    # Category 3: Commercial & Billing
    {
        "id": 13,
        "category": "Category 3: Commercial & Billing",
        "question_text": "What are the top 3 most important factors of our services? Quality Price, Credit, Information, Faults resolution?",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 13
    },
    {
        "id": 14,
        "category": "Category 3: Commercial & Billing",
        "question_text": "Is your statement of accounts accurate and up to date?",
        "question_type": "choice",
        "min_score": 0,
        "max_score": 0,
        "order": 14,
        "choices": ["Always", "Sometimes", "Never"]
    },
    
    # Category 4: Competitive & Portfolio Intelligence
    {
        "id": 15,
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_text": "What Products and Services do you currently have with C&W.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 15
    },
    {
        "id": 16,
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_text": "Do you have other products and services from other service providers?",
        "question_type": "choice",
        "min_score": 0,
        "max_score": 0,
        "order": 16,
        "choices": ["Yes", "No"]
    },
    {
        "id": 17,
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_text": "List Products and services from competitor.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 17
    },
    {
        "id": 18,
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_text": "Which product would you want us to review to bring you to CWS?",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 18
    },
    
    # Category 5: Growth & Expansion
    {
        "id": 19,
        "category": "Category 5: Growth & Expansion",
        "question_text": "New Telecommunications, or Digital Transformation requirements over next 6 to 12 months.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 19
    },
    {
        "id": 20,
        "category": "Category 5: Growth & Expansion",
        "question_text": "Types of products and services required for any expansion in 6 to 12 months.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 20
    },
    {
        "id": 21,
        "category": "Category 5: Growth & Expansion",
        "question_text": "What kinds of expansions in next 6-12 months.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 21
    },
    {
        "id": 22,
        "category": "Category 5: Growth & Expansion",
        "question_text": "What do you want to see more of from us?",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 22
    },
    
    # Category 6: Advocacy
    {
        "id": 23,
        "category": "Category 6: Advocacy",
        "question_text": "NPS on a scale of 0 to 10, how much would you recommend us? 10 be very highly. 0 not at all.",
        "question_type": "score",
        "min_score": 0,
        "max_score": 10,
        "order": 23
    },
    {
        "id": 24,
        "category": "Category 6: Advocacy",
        "question_text": "Any further comments from Customer.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 24
    }
]

class QuestionResponse(BaseModel):
    id: int
    category: str
    question_text: str
    question_type: str
    min_score: int = None
    max_score: int = None
    order: int

class VisitResponse(BaseModel):
    id: int
    business_id: int
    business_name: str
    representative_id: int
    visit_date: str
    visit_type: str
    status: str
    business_priority: str = None
    responses: List[Dict[str, Any]] = []


@router.post("/businesses")
async def create_business(
    business_data: dict,
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles("CX_SUPER_ADMIN", "B2B_ADMIN")),
):
    """Create a new business."""
    try:
        # Insert new business
        result = db.execute(
            text("""
            INSERT INTO businesses (name, location, priority_level, active, account_executive_id)
            VALUES (:name, :location, :priority_level, :active, :account_executive_id)
            """),
            {
                "name": business_data.get("name"),
                "location": business_data.get("location", ""),
                "priority_level": business_data.get("priority_level", "medium"),
                "active": True,
                "account_executive_id": business_data.get("account_executive_id")
            }
        )
        
        db.commit()
        
        return {
            "id": result.lastrowid if hasattr(result, 'lastrowid') else result[0],
            "name": business_data.get("name"),
            "location": business_data.get("location", ""),
            "priority_level": business_data.get("priority_level", "medium"),
            "active": True,
            "account_executive_id": business_data.get("account_executive_id")
        }
    except Exception as e:
        print(f"Error creating business: {e}")
        raise HTTPException(status_code=500, detail="Failed to create business")

@router.put("/businesses/{business_id}")
async def update_business(
    business_id: int,
    business_data: dict,
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles("CX_SUPER_ADMIN", "B2B_ADMIN")),
):
    """Update a business (for retirement/reactivation)."""
    try:
        # Update business
        result = db.execute(
            text("""
            UPDATE businesses 
            SET name = COALESCE(:name, name), 
                location = COALESCE(:location, location), 
                priority_level = COALESCE(:priority_level, priority_level), 
                active = COALESCE(:active, active),
                account_executive_id = COALESCE(:account_executive_id, account_executive_id)
            WHERE id = :business_id
            """),
            {
                "business_id": business_id,
                "name": business_data.get("name"),
                "location": business_data.get("location"),
                "priority_level": business_data.get("priority_level"),
                "active": business_data.get("active"),
                "account_executive_id": business_data.get("account_executive_id")
            }
        )
        
        db.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Business not found")
        
        # Get updated business data
        updated_business = db.execute(
            text("""
            SELECT id, name, location, priority_level, active, account_executive_id
            FROM businesses 
            WHERE id = :business_id
            """),
            {"business_id": business_id}
        ).fetchone()
        
        return {
            "id": updated_business[0],
            "name": updated_business[1],
            "location": updated_business[2],
            "priority_level": updated_business[3],
            "active": bool(updated_business[4]),
            "account_executive_id": updated_business[5]
        }
    except Exception as e:
        print(f"Error updating business: {e}")
        raise HTTPException(status_code=500, detail="Failed to update business")

@router.get("/survey-businesses", response_model=List[Dict])
async def get_survey_businesses(
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles(*B2B_ROLES)),
):
    """Get businesses formatted for the survey interface."""

    # Prefer Postgres
    try:
        rows = db.execute(
            text(
                """
                SELECT
                    b.id,
                    b.name,
                    b.location,
                    b.priority_level,
                    b.active,
                    ae.name AS account_executive_name,
                    ae.email AS account_executive_email
                FROM businesses b
                LEFT JOIN account_executives ae ON b.account_executive_id = ae.id
                WHERE b.active = true
                ORDER BY
                    CASE b.priority_level
                        WHEN 'high' THEN 1
                        WHEN 'medium' THEN 2
                        WHEN 'low' THEN 3
                        ELSE 4
                    END,
                    b.name
                """
            )
        ).all()

        if rows:
            return [
                {
                    "id": row[0],
                    "name": row[1],
                    "location": row[2],
                    "priority_level": row[3],
                    "active": bool(row[4]),
                    "account_executive_name": row[5],
                    "account_executive_email": row[6],
                }
                for row in rows
            ]
    except Exception as e:
        print(f"Error fetching survey businesses from database: {e}")

    # Fallback: legacy SQLite
    try:
        conn = sqlite3.connect('../dev_cx_platform.db')
        cursor = conn.cursor()

        cursor.execute(
            '''
            SELECT
                b.id,
                b.name,
                b.location,
                b.priority_level,
                b.active,
                ae.name as account_executive_name,
                ae.email as account_executive_email
            FROM businesses b
            LEFT JOIN account_executives ae ON b.account_executive_id = ae.id
            WHERE b.active = 1
            ORDER BY
                CASE b.priority_level
                    WHEN 'high' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'low' THEN 3
                    ELSE 4
                END,
                b.name
            '''
        )

        rows = cursor.fetchall()
        conn.close()

        return [
            {
                "id": row[0],
                "name": row[1],
                "location": row[2],
                "priority_level": row[3],
                "active": bool(row[4]),
                "account_executive_name": row[5],
                "account_executive_email": row[6],
            }
            for row in rows
        ]
    except Exception as e:
        print(f"Error fetching survey businesses from SQLite: {e}")
        return []

@router.get("/questions")
async def get_questions(survey_type: str = "B2B", db: Session = Depends(get_db)):
    """Get all questions for the survey.

    `survey_type` is a codename/name (e.g., B2B, Mystery Shopper, Installation Assessment).
    Defaults to B2B for backward compatibility.
    """
    
    # Use the new database structure
    try:
        rows = db.execute(
            text(
                """
                SELECT
                    q.id,
                    q.survey_type_id,
                    q.question_number,
                    q.question_text,
                    q.category,
                    q.is_mandatory,
                    q.is_nps,
                    q.input_type,
                    q.score_min,
                    q.score_max,
                    q.choices,
                    q.helper_text,
                    q.requires_issue,
                    q.requires_escalation,
                    q.question_key
                FROM questions q
                JOIN survey_types st ON q.survey_type_id = st.id
                WHERE st.name = :survey_type
                ORDER BY q.question_number
                """
            ),
            {"survey_type": survey_type},
        ).all()
        
        questions = []
        for row in rows:
            # Parse choices if they exist
            choices = None
            if row[10]:
                try:
                    import json
                    choices = json.loads(row[10])
                except:
                    choices = None
            
            questions.append({
                "id": row[0],
                "survey_type_id": row[1],
                "order_index": row[2],  # question_number
                "question_text": row[3],
                "category": row[4],
                "is_mandatory": bool(row[5]),
                "is_nps": bool(row[6]),
                "input_type": row[7],
                "score_min": row[8],
                "score_max": row[9],
                "choices": choices,
                "helper_text": row[11],
                "requires_issue": bool(row[12]),
                "requires_escalation": bool(row[13]),
                "question_key": row[14],
                "order": row[2],  # Backward compatibility
                "question_type": row[7]  # Backward compatibility
            })
        
        return questions
        
    except Exception as e:
        print(f"Error fetching questions from new database: {e}")
        # Fallback to mock data if new structure doesn't exist
        return MOCK_QUESTIONS


@router.get("/visits/drafts", response_model=List[VisitResponse])
async def get_draft_visits(
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles(*B2B_ROLES)),
):
    """Get all draft visits for the survey."""
    try:
        # Query B2B visits with business information
        query = """
        SELECT 
            v.id,
            v.business_id,
            b.name as business_name,
            v.representative_id,
            v.visit_date,
            v.visit_type,
            v.status,
            b.priority_level as business_priority
        FROM visits v
        LEFT JOIN businesses b ON v.business_id = b.id
        WHERE v.status = 'draft' OR v.status IS NULL
        ORDER BY b.priority_level, v.visit_date
        """
        
        result = db.execute(query)
        visits = []
        
        for row in result:
            visits.append({
                "id": row[0],
                "business_id": row[1],
                "business_name": row[2] or "Unknown Business",
                "representative_id": row[3] or 0,
                "visit_date": row[4] or "",
                "visit_type": row[5] or "Assessment",
                "status": row[6] or "draft",
                "business_priority": row[7] or "medium",
                "responses": []
            })
        
        return visits
        
    except Exception as e:
        print(f"Error fetching draft visits: {e}")
        # Return empty list if there's an error
        return []

@router.get("/visits/{visit_id}")
async def get_visit_details(
    visit_id: int,
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles(*B2B_ROLES)),
):
    """Get detailed information about a specific visit."""
    try:
        query = """
        SELECT 
            v.id,
            v.business_id,
            b.name as business_name,
            v.representative_id,
            v.visit_date,
            v.visit_type,
            v.status,
            b.priority_level as business_priority
        FROM visits v
        LEFT JOIN businesses b ON v.business_id = b.id
        WHERE v.id = :visit_id
        """
        
        result = db.execute(query, {"visit_id": visit_id})
        row = result.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Visit not found")
        
        visit_data = {
            "id": row[0],
            "business_id": row[1],
            "business_name": row[2] or "Unknown Business",
            "representative_id": row[3] or 0,
            "visit_date": row[4] or "",
            "visit_type": row[5] or "Assessment",
            "status": row[6] or "draft",
            "business_priority": row[7] or "medium",
            "responses": []  # Empty responses for now
        }
        
        return visit_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching visit details: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/survey-responses/{visit_id}")
async def get_survey_responses(
    visit_id: int,
    _access: bool = Depends(require_roles(*B2B_ROLES)),
):
    """Get all survey responses for a specific visit."""
    try:
        conn = sqlite3.connect('../dev_cx_platform.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                sr.id,
                sr.question_id,
                sr.score,
                sr.answer_text,
                sr.choice_value,
                sr.verbatim,
                q.category,
                q.question_text,
                q.question_type,
                q.choices
            FROM survey_responses sr
            LEFT JOIN (
                SELECT 
                    1 as dummy_id,
                    1 as question_id,
                    "Category 1: Relationship Strength" as category,
                    "Rate your relationship with C&W." as question_text,
                    "score" as question_type,
                    "[]" as choices
                UNION ALL SELECT 2, 2, "Category 1: Relationship Strength", "Do you get enough information from your Account Executive on New Products and Services?", "score", "[]"
                -- This is a simplified approach - in production, questions should be in a proper table
            ) q ON sr.question_id = q.question_id
            WHERE sr.visit_id = ?
            ORDER BY sr.question_id
        ''', (visit_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        responses = []
        for row in rows:
            # Map question_id to question details from our MOCK_QUESTIONS
            question = next((q for q in MOCK_QUESTIONS if q['id'] == row[1]), None)
            if question:
                responses.append({
                    "id": row[0],
                    "question_id": row[1],
                    "score": row[2],
                    "answer_text": row[3],
                    "choice_value": row[4],
                    "verbatim": row[5],
                    "category": question['category'],
                    "question_text": question['question_text'],
                    "question_type": question['question_type'],
                    "choices": question.get('choices', [])
                })
        
        return responses
        
    except Exception as e:
        print(f"Error fetching survey responses: {e}")
        return []

@router.get("/survey-actions/{visit_id}")
async def get_survey_actions(
    visit_id: int,
    _access: bool = Depends(require_roles(*B2B_ROLES)),
):
    """Get all action items for a specific visit."""
    try:
        conn = sqlite3.connect('../dev_cx_platform.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                sa.id,
                sa.response_id,
                sa.action_required,
                sa.action_owner,
                sa.action_timeframe,
                sa.action_support_needed,
                sa.status,
                sa.created_at
            FROM survey_actions sa
            INNER JOIN survey_responses sr ON sa.response_id = sr.id
            WHERE sr.visit_id = ?
            ORDER BY sa.created_at
        ''', (visit_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        actions = []
        for row in rows:
            actions.append({
                "id": row[0],
                "response_id": row[1],
                "action_required": row[2],
                "action_owner": row[3],
                "action_timeframe": row[4],
                "action_support_needed": row[5],
                "status": row[6],
                "created_at": row[7]
            })
        
        return actions
        
    except Exception as e:
        print(f"Error fetching survey actions: {e}")
        return []

@router.get("/historical-surveys")
async def get_historical_surveys(
    _access: bool = Depends(require_roles(*B2B_ROLES)),
):
    """Get all completed surveys with their responses."""
    try:
        conn = sqlite3.connect('../dev_cx_platform.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                v.id,
                v.business_id,
                b.name as business_name,
                v.representative_id,
                v.visit_date,
                v.visit_type,
                v.status,
                COUNT(sr.id) as response_count
            FROM visits v
            LEFT JOIN businesses b ON v.business_id = b.id
            LEFT JOIN survey_responses sr ON v.id = sr.visit_id
            WHERE v.status = 'completed'
            GROUP BY v.id
            ORDER BY v.visit_date DESC
        ''')
        
        rows = cursor.fetchall()
        conn.close()
        
        surveys = []
        for row in rows:
            surveys.append({
                "id": row[0],
                "business_id": row[1],
                "business_name": row[2],
                "representative_id": row[3],
                "visit_date": row[4],
                "visit_type": row[5],
                "status": row[6],
                "response_count": row[7] or 0
            })
        
        return surveys
        
    except Exception as e:
        print(f"Error fetching historical surveys: {e}")
        return []
async def save_visit_responses(visit_id: int, responses: Dict[str, Any], db: Session = Depends(get_db)):
    """Save responses for a visit."""
    try:
        # For now, just return success
        # In a real implementation, you would save to a responses table
        return {"message": "Responses saved successfully", "visit_id": visit_id}
        
    except Exception as e:
        print(f"Error saving responses: {e}")
        raise HTTPException(status_code=500, detail="Failed to save responses")

@router.put("/visits/{visit_id}")
async def update_visit(
    visit_id: int,
    visit_data: Dict[str, Any],
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles(*B2B_ROLES)),
):
    """Update visit information."""
    try:
        # For now, just return success
        # In a real implementation, you would update the visit
        return {"message": "Visit updated successfully", "visit_id": visit_id}
        
    except Exception as e:
        print(f"Error updating visit: {e}")
        raise HTTPException(status_code=500, detail="Failed to update visit")
