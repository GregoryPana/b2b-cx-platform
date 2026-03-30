import sys
import uuid
import json
from datetime import date, datetime, timedelta

from sqlalchemy import text

from app.core.db import get_session_local

try:
    from scripts.seed import seed_data as seed_reference_data
except Exception:
    from seed import seed_data as seed_reference_data


def has_table(session, table_name: str) -> bool:
    return bool(session.execute(text(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = :table_name
        LIMIT 1
        """
    ), {"table_name": table_name}).scalar())


def has_column(session, table_name: str, column_name: str) -> bool:
    return bool(session.execute(text(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = :table_name AND column_name = :column_name
        LIMIT 1
        """
    ), {"table_name": table_name, "column_name": column_name}).scalar())


def ensure_survey_types(session) -> int | None:
    if not has_table(session, "survey_types"):
        return None

    has_code = has_column(session, "survey_types", "code")
    if has_code:
        session.execute(text(
            """
            INSERT INTO survey_types (code, name, description)
            VALUES
              ('B2B', 'B2B', 'Business-to-Business survey'),
              ('INSTALLATION', 'Installation Assessment', 'Installation assessment survey'),
              ('MYSTERY_SHOPPER', 'Mystery Shopper', 'Mystery shopper survey')
            ON CONFLICT (name) DO UPDATE
              SET code = EXCLUDED.code,
                  description = EXCLUDED.description
            """
        ))
    else:
        session.execute(text(
            """
            INSERT INTO survey_types (name, description)
            VALUES
              ('B2B', 'Business-to-Business survey'),
              ('Installation Assessment', 'Installation assessment survey'),
              ('Mystery Shopper', 'Mystery shopper survey')
            ON CONFLICT (name) DO NOTHING
            """
        ))

    return session.execute(text("SELECT id FROM survey_types WHERE name = 'B2B' LIMIT 1")).scalar()


def pick_response_table(session) -> str | None:
    if has_table(session, "b2b_visit_responses"):
        return "b2b_visit_responses"
    if has_table(session, "responses"):
        return "responses"
    return None


def yes_no_for_business(name: str) -> str:
    return "Y" if name in {"Air Seychelles", "Four Seasons", "State House"} else "N"


def score_for_business(name: str, question_key: str, status: str) -> int:
    base = {
        "Air Seychelles": 9,
        "Four Seasons": 8,
        "State House": 8,
        "Hilton": 6,
    }.get(name, 7)

    if question_key == "q23_nps":
        return max(6, min(10, base))
    if status == "Rejected":
        return max(3, base - 2)
    if status == "Draft":
        return max(4, base - 1)
    return max(4, min(10, base))


def text_answer(question_key: str, business_name: str) -> str:
    templates = {
        "q07_top_3_satisfied_services": f"Reliable data links, account manager support, and enterprise mobile services for {business_name}.",
        "q08_top_3_unsatisfied_instances": "Two delayed fault closures last quarter and one billing correction delay.",
        "q10_call_frequency": "Rarely",
        "q11_recent_unresolved_issue": "Intermittent branch connectivity during peak hours; under monitoring.",
        "q13_top_3_important_factors": "Service reliability, response time, and transparent billing.",
        "q15_current_products_services": "Dedicated internet, SIP trunks, and managed LAN.",
        "q17_competitor_products_services": "Backup mobile data from another provider at one site.",
        "q18_product_review_needed": "Review managed SD-WAN package for branch resilience.",
        "q19_new_requirements": "Need cloud voice integration and improved branch Wi-Fi analytics.",
        "q20_expansion_services_required": "Additional fiber ports and secure remote access for new offices.",
        "q21_expansion_types": "Opening one satellite office and upgrading two existing locations.",
        "q22_more_from_us": "Proactive service reviews and quarterly optimization recommendations.",
        "q24_comments": "Overall relationship is positive; keep response times consistent.",
    }
    return templates.get(question_key, f"Feedback captured for {business_name}.")


def build_answer(question: dict, business_name: str, visit_status: str) -> tuple[int | None, str | None, str | None, list[dict]]:
    input_type = question.get("input_type") or "text"
    question_key = question.get("question_key") or ""
    score = None
    answer_text = None
    verbatim = None
    actions: list[dict] = []

    if input_type == "score":
        score = score_for_business(business_name, question_key, visit_status)
        verbatim = f"Scored {score} based on recent service interactions."
        if score <= 6:
            actions = [
                {
                    "action_required": "Follow up with customer on service concerns",
                    "action_owner": "Account Executive",
                    "action_timeframe": "2 weeks",
                    "action_support_needed": "Technical lead for issue review",
                }
            ]
    elif input_type == "yes_no":
        answer_text = yes_no_for_business(business_name)
        verbatim = "Answer captured during on-site discussion."
    elif input_type == "always_sometimes_never":
        answer_text = "Sometimes"
        verbatim = "Frequency based on operations pattern."
    else:
        answer_text = text_answer(question_key, business_name)
        verbatim = "Detailed business feedback recorded."

    return score, answer_text, verbatim, actions


def upsert_visit(session, business_id: int, representative_id: int, visit_date: date, visit_type: str, status: str, survey_type_id: int | None):
    existing = session.execute(text(
        """
        SELECT id
        FROM visits
        WHERE business_id = :business_id AND visit_date = :visit_date
        LIMIT 1
        """
    ), {"business_id": business_id, "visit_date": visit_date}).scalar()

    has_visit_survey_type = has_column(session, "visits", "survey_type_id")

    if existing:
        updates = ["representative_id = :representative_id", "visit_type = :visit_type", "status = :status"]
        params = {
            "visit_id": existing,
            "representative_id": representative_id,
            "visit_type": visit_type,
            "status": status,
        }
        if has_visit_survey_type and survey_type_id is not None:
            updates.append("survey_type_id = :survey_type_id")
            params["survey_type_id"] = survey_type_id
        session.execute(text(f"UPDATE visits SET {', '.join(updates)} WHERE id = :visit_id"), params)
        return existing

    visit_id = str(uuid.uuid4())
    if has_visit_survey_type and survey_type_id is not None:
        session.execute(text(
            """
            INSERT INTO visits (id, business_id, representative_id, created_by, visit_date, visit_type, status, survey_type_id)
            VALUES (:id, :business_id, :representative_id, :created_by, :visit_date, :visit_type, :status, :survey_type_id)
            """
        ), {
            "id": visit_id,
            "business_id": business_id,
            "representative_id": representative_id,
            "created_by": representative_id,
            "visit_date": visit_date,
            "visit_type": visit_type,
            "status": status,
            "survey_type_id": survey_type_id,
        })
    else:
        session.execute(text(
            """
            INSERT INTO visits (id, business_id, representative_id, created_by, visit_date, visit_type, status)
            VALUES (:id, :business_id, :representative_id, :created_by, :visit_date, :visit_type, :status)
            """
        ), {
            "id": visit_id,
            "business_id": business_id,
            "representative_id": representative_id,
            "created_by": representative_id,
            "visit_date": visit_date,
            "visit_type": visit_type,
            "status": status,
        })
    return visit_id


def seed_process_data() -> None:
    session = get_session_local()()
    try:
        seed_reference_data()
        survey_type_id = ensure_survey_types(session)

        response_table = pick_response_table(session)
        if not response_table:
            raise RuntimeError("No response table found (expected b2b_visit_responses or responses).")

        questions = session.execute(text(
            """
            SELECT id, question_key, input_type, COALESCE(is_mandatory, true) as is_mandatory
            FROM questions
            ORDER BY COALESCE(question_number, order_index, id), id
            """
        )).mappings().all()

        if not questions:
            raise RuntimeError("No questions found. Run baseline seed first.")

        representative_id = session.execute(text(
            "SELECT id FROM users WHERE role = 'Representative' ORDER BY id LIMIT 1"
        )).scalar()
        if representative_id is None:
            representative_id = session.execute(text("SELECT id FROM users ORDER BY id LIMIT 1")).scalar()
        if representative_id is None:
            raise RuntimeError("No users found for representative assignment.")

        businesses = session.execute(text(
            "SELECT id, name FROM businesses WHERE active = true ORDER BY id LIMIT 4"
        )).mappings().all()
        if not businesses:
            raise RuntimeError("No active businesses found.")

        today = date.today()
        visit_plan = [
            {"offset": -14, "status": "Approved", "visit_type": "Planned"},
            {"offset": -7, "status": "Pending", "visit_type": "Planned"},
            {"offset": -2, "status": "Draft", "visit_type": "Unplanned"},
            {"offset": -1, "status": "Rejected", "visit_type": "Planned"},
        ]

        for idx, business in enumerate(businesses):
            plan = visit_plan[idx % len(visit_plan)]
            v_date = today + timedelta(days=plan["offset"])
            status = plan["status"]
            visit_id = upsert_visit(
                session,
                business_id=business["id"],
                representative_id=representative_id,
                visit_date=v_date,
                visit_type=plan["visit_type"],
                status=status,
                survey_type_id=survey_type_id,
            )

            session.execute(text(f"DELETE FROM {response_table} WHERE visit_id = :visit_id"), {"visit_id": visit_id})

            for question in questions:
                if status == "Draft" and question["is_mandatory"] and (question["question_key"] or "") in {
                    "q19_new_requirements", "q20_expansion_services_required", "q21_expansion_types", "q22_more_from_us", "q23_nps", "q24_comments"
                }:
                    continue

                score, answer_text, verbatim, actions = build_answer(question, business["name"], status)

                if response_table == "b2b_visit_responses":
                    session.execute(text(
                        """
                        INSERT INTO b2b_visit_responses (visit_id, question_id, score, answer_text, verbatim, actions)
                        VALUES (:visit_id, :question_id, :score, :answer_text, :verbatim, :actions)
                        """
                    ), {
                        "visit_id": visit_id,
                        "question_id": question["id"],
                        "score": score,
                        "answer_text": answer_text,
                        "verbatim": verbatim,
                        "actions": json.dumps(actions),
                    })
                else:
                    primary_action = actions[0] if actions else {}
                    session.execute(text(
                        """
                        INSERT INTO responses (visit_id, question_id, score, answer_text, verbatim, action_required, action_owner, action_timeframe, action_support_needed)
                        VALUES (:visit_id, :question_id, :score, :answer_text, :verbatim, :action_required, :action_owner, :action_timeframe, :action_support_needed)
                        """
                    ), {
                        "visit_id": visit_id,
                        "question_id": question["id"],
                        "score": score,
                        "answer_text": answer_text,
                        "verbatim": verbatim,
                        "action_required": primary_action.get("action_required"),
                        "action_owner": primary_action.get("action_owner"),
                        "action_timeframe": primary_action.get("action_timeframe"),
                        "action_support_needed": primary_action.get("action_support_needed"),
                    })

            if status in {"Pending", "Approved", "Rejected"}:
                set_parts = ["status = :status"]
                params = {
                    "status": status if status == "Pending" else "Pending",
                    "visit_id": visit_id,
                }
                if has_column(session, "visits", "submitted_at"):
                    set_parts.append("submitted_at = :submitted_at")
                    params["submitted_at"] = datetime.utcnow() - timedelta(days=1)
                if has_column(session, "visits", "submitted_by_name"):
                    set_parts.append("submitted_by_name = :submitted_by_name")
                    params["submitted_by_name"] = "Representative"
                if has_column(session, "visits", "submitted_by_email"):
                    set_parts.append("submitted_by_email = :submitted_by_email")
                    params["submitted_by_email"] = "rep@local"

                session.execute(text(
                    f"UPDATE visits SET {', '.join(set_parts)} WHERE id = :visit_id"
                ), params)

            if status == "Approved":
                session.execute(text(
                    """
                    UPDATE visits
                    SET status = 'Approved',
                        approval_timestamp = :approval_timestamp,
                        approval_notes = :approval_notes
                    WHERE id = :visit_id
                    """
                ), {
                    "approval_timestamp": datetime.utcnow() - timedelta(hours=6),
                    "approval_notes": "Reviewed and approved after verifying mandatory responses.",
                    "visit_id": visit_id,
                })

            if status == "Rejected":
                session.execute(text(
                    """
                    UPDATE visits
                    SET status = 'Rejected',
                        rejection_notes = :rejection_notes
                    WHERE id = :visit_id
                    """
                ), {
                    "rejection_notes": "Insufficient clarity in operational issue details; resubmit with evidence.",
                    "visit_id": visit_id,
                })

        session.commit()
        print("Realistic survey-process data seeded successfully.")
    finally:
        session.close()


if __name__ == "__main__":
    try:
        seed_process_data()
    except Exception as exc:
        print(f"Realistic seed failed: {exc}")
        sys.exit(1)
