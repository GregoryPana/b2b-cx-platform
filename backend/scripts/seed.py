import sys

from sqlalchemy import text

from app.core.db import get_session_local
from app.models import AccountExecutive, Business, Question, Response, User


SURVEY_TYPE_BLUEPRINT = [
    ("B2B", "B2B", "Business-to-Business survey"),
    ("INSTALLATION", "Installation Assessment", "Installation assessment survey"),
    ("MYSTERY_SHOPPER", "Mystery Shopper", "Mystery shopper survey"),
]


QUESTION_BLUEPRINT = [
    {
        "question_key": "q01_relationship_strength",
        "category": "Category 1: Relationship Strength",
        "question_text": "Rate your relationship with C&W.",
        "input_type": "score",
        "score_min": 0,
        "score_max": 10,
        "is_mandatory": True,
        "order_index": 1,
    },
    {
        "question_key": "q02_ae_information_updates",
        "category": "Category 1: Relationship Strength",
        "question_text": "Do you get enough information from your Account Executive on New Products and Services?.",
        "input_type": "score",
        "score_min": 0,
        "score_max": 10,
        "is_mandatory": True,
        "order_index": 2,
    },
    {
        "question_key": "q03_ae_professionalism",
        "category": "Category 1: Relationship Strength",
        "question_text": "How would you rate the level of professionalism when dealing with your C&W Account Executive?.",
        "input_type": "score",
        "score_min": 0,
        "score_max": 10,
        "is_mandatory": True,
        "order_index": 3,
    },
    {
        "question_key": "q04_ae_business_understanding",
        "category": "Category 1: Relationship Strength",
        "question_text": "Does the C&W Account Executive understand your business?.",
        "input_type": "yes_no",
        "choices": ["Y", "N"],
        "helper_text": "Select Y or N",
        "is_mandatory": True,
        "order_index": 4,
    },
    {
        "question_key": "q05_contacts_visit_satisfaction",
        "category": "Category 1: Relationship Strength",
        "question_text": "How satisfied are you with your C&W contacts and number of visits?.",
        "input_type": "score",
        "score_min": 0,
        "score_max": 10,
        "is_mandatory": True,
        "order_index": 5,
    },
    {
        "question_key": "q06_regular_updates",
        "category": "Category 1: Relationship Strength",
        "question_text": "Are you receiving regular updates on your account? (Y or N).",
        "input_type": "yes_no",
        "choices": ["Y", "N"],
        "helper_text": "Select Y or N",
        "is_mandatory": True,
        "order_index": 6,
    },
    {
        "question_key": "q07_top_3_satisfied_services",
        "category": "Category 2: Service & Operational Performance",
        "question_text": "List your top 3 C&W services most satisfied with in the past 6 months.",
        "input_type": "text",
        "is_mandatory": True,
        "order_index": 7,
    },
    {
        "question_key": "q08_top_3_unsatisfied_instances",
        "category": "Category 2: Service & Operational Performance",
        "question_text": "List 3 instances you have not been satisfied with C&W if any (Network Quality, Fault resolution, Visits, billing etc) if any be specific..",
        "input_type": "text",
        "is_mandatory": False,
        "order_index": 8,
    },
    {
        "question_key": "q09_issues_resolved_on_time",
        "category": "Category 2: Service & Operational Performance",
        "question_text": "Are Issues resolved on time?",
        "input_type": "yes_no",
        "choices": ["Y", "N"],
        "helper_text": "Select Y or N",
        "is_mandatory": True,
        "order_index": 9,
    },
    {
        "question_key": "q10_call_frequency",
        "question_text": "How often do you call CWS to fix issues?",
        "input_type": "text",
        "choices": ["3 months", "6 months", "9 months", "Rarely"],
        "helper_text": "Select one option",
        "category": "Category 2: Service & Operational Performance",
        "is_mandatory": True,
        "order_index": 10,
    },
    {
        "question_key": "q11_recent_unresolved_issue",
        "category": "Category 2: Service & Operational Performance",
        "question_text": "What is your most recent unresolved issue with C&W?.",
        "input_type": "text",
        "is_mandatory": False,
        "order_index": 11,
    },
    {
        "question_key": "q12_overall_satisfaction",
        "category": "Category 2: Service & Operational Performance",
        "question_text": "Rate your overall C&W Satisfaction. (Very Satisfied).",
        "input_type": "score",
        "score_min": 0,
        "score_max": 10,
        "is_mandatory": True,
        "order_index": 12,
    },
    {
        "question_key": "q13_top_3_important_factors",
        "category": "Category 3: Commercial & Billing",
        "question_text": "What are the top 3 most important factors of our services? (e.g.Quality Price, Credit, Information, Faults resolution?)",
        "input_type": "text",
        "is_mandatory": True,
        "order_index": 13,
    },
    {
        "question_key": "q14_statement_accuracy",
        "category": "Category 3: Commercial & Billing",
        "question_text": "Is your statement of accounts accurate and up to date?.",
        "input_type": "always_sometimes_never",
        "helper_text": "Choose: Always, Sometimes, or Never",
        "is_mandatory": True,
        "order_index": 14,
    },
    {
        "question_key": "q15_current_products_services",
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_text": "What Products and Services do you currently have with C&W.",
        "input_type": "text",
        "is_mandatory": True,
        "order_index": 15,
    },
    {
        "question_key": "q16_other_provider_products",
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_text": "Do you have other products and services from other service providers? (Yes or No)",
        "input_type": "yes_no",
        "choices": ["Y", "N"],
        "helper_text": "Select Y or N",
        "is_mandatory": True,
        "order_index": 16,
    },
    {
        "question_key": "q17_competitor_products_services",
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_text": "If so, list Products and services from competitor. (Conditional on previous)",
        "input_type": "text",
        "is_mandatory": True,
        "order_index": 17,
    },
    {
        "question_key": "q18_competitor_service_with_cws",
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_text": "Would you consider taking this service with CWS?",
        "input_type": "yes_no",
        "choices": ["Y", "N"],
        "helper_text": "Select Y or N",
        "is_mandatory": True,
        "order_index": 18,
    },
    {
        "question_key": "q18_product_review_needed",
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_text": "Which product would you want us to review to bring you to CWS?.",
        "input_type": "text",
        "is_mandatory": True,
        "order_index": 19,
    },
    {
        "question_key": "q19_new_requirements",
        "category": "Category 5: Growth & Expansion",
        "question_text": "Do you have any new Telecommunications, or Digital Transformation requirements over next 6 to 12 months.",
        "input_type": "text",
        "is_mandatory": True,
        "order_index": 20,
    },
    {
        "question_key": "q20_expansion_services_required",
        "category": "Category 5: Growth & Expansion",
        "question_text": "Types of products and services are required for any expansion in 6 to 12 months.",
        "input_type": "text",
        "is_mandatory": True,
        "order_index": 22,
    },
    {
        "question_key": "q21_expansion_types",
        "category": "Category 5: Growth & Expansion",
        "question_text": "What kinds of expansions are you plannning for in the next 6-12 months.",
        "input_type": "text",
        "is_mandatory": True,
        "order_index": 21,
    },
    {
        "question_key": "q22_more_from_us",
        "category": "Category 5: Growth & Expansion",
        "question_text": "What do you want to see more of from us?.",
        "input_type": "text",
        "is_mandatory": True,
        "order_index": 23,
    },
    {
        "question_key": "q23_nps",
        "category": "Category 6: Advocacy",
        "question_text": "NPS on a scale of 0 to 10, how much would you recommend us? 10 be very highly. 0 not at all.",
        "input_type": "score",
        "score_min": 0,
        "score_max": 10,
        "is_nps": True,
        "is_mandatory": True,
        "order_index": 24,
    },
    {
        "question_key": "q24_comments",
        "category": "Category 6: Advocacy",
        "question_text": "Any further comments from Customer.",
        "input_type": "text",
        "is_mandatory": False,
        "order_index": 25,
    },
]


def seed_data() -> None:
    session = get_session_local()()
    try:
        question_fields = set(Question.__table__.columns.keys())
        survey_type_map: dict[str, int] = {}

        has_survey_type_table = bool(session.execute(text(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = 'survey_types'
            LIMIT 1
            """
        )).scalar())

        if has_survey_type_table:
            for code, name, description in SURVEY_TYPE_BLUEPRINT:
                session.execute(
                    text(
                        """
                        INSERT INTO survey_types (code, name, description)
                        VALUES (:code, :name, :description)
                        ON CONFLICT (name) DO UPDATE
                        SET code = EXCLUDED.code,
                            description = EXCLUDED.description
                        """
                    ),
                    {"code": code, "name": name, "description": description},
                )

            rows = session.execute(text("SELECT id, code FROM survey_types")).all()
            survey_type_map = {str(row[1]): int(row[0]) for row in rows if row[1]}

        if session.query(User).count() == 0:
            session.add_all(
                [
                    User(name="Admin", email="admin@local", role="Admin", active=True),
                    User(name="Reviewer", email="reviewer@local", role="Reviewer", active=True),
                    User(name="Manager", email="manager@local", role="Manager", active=True),
                    User(name="Representative", email="rep@local", role="Representative", active=True),
                ]
            )

        if session.query(AccountExecutive).count() == 0:
            session.add(AccountExecutive(name="Alex Executive", email="alex.executive@local"))

        session.flush()

        if session.query(Business).count() == 0:
            executive = session.query(AccountExecutive).first()
            session.add_all(
                [
                    Business(
                        name="Air Seychelles",
                        location="Mahe",
                        account_executive_id=executive.id if executive else None,
                        priority_level="high",
                        active=True,
                    ),
                    Business(
                        name="Four Seasons",
                        location="Mahe",
                        account_executive_id=executive.id if executive else None,
                        priority_level="high",
                        active=True,
                    ),
                    Business(
                        name="State House",
                        location="Victoria",
                        account_executive_id=executive.id if executive else None,
                        priority_level="medium",
                        active=True,
                    ),
                    Business(
                        name="Hilton",
                        location="Mahe",
                        account_executive_id=executive.id if executive else None,
                        priority_level="low",
                        active=True,
                    ),
                ]
            )

        desired_keys = {config["question_key"] for config in QUESTION_BLUEPRINT}

        existing_questions = session.query(Question).all()
        for question in existing_questions:
            if question.question_key.startswith("q_legacy_") or question.question_key not in desired_keys:
                session.query(Response).filter(Response.question_id == question.id).delete(
                    synchronize_session=False
                )
                session.delete(question)

        session.flush()

        existing_by_key = {
            question.question_key: question for question in session.query(Question).all()
        }

        for config in QUESTION_BLUEPRINT:
            question = existing_by_key.get(config["question_key"])
            model_config = {field: value for field, value in config.items() if field in question_fields}

            if "question_number" in question_fields and "order_index" in config:
                model_config["question_number"] = config["order_index"]

            if "survey_type_id" in question_fields:
                model_config["survey_type_id"] = survey_type_map.get("B2B")

            if question is None:
                question = Question(**model_config)
                if question.input_type == "score":
                    question.score_min = 0
                    question.score_max = 10
                session.add(question)
                continue

            for field, value in model_config.items():
                setattr(question, field, value)

            if question.input_type == "score":
                question.score_min = 0
                question.score_max = 10
            else:
                question.score_min = None
                question.score_max = None

        session.commit()
        print("Seed complete")
    finally:
        session.close()


if __name__ == "__main__":
    try:
        seed_data()
    except Exception as exc:
        print(f"Seed failed: {exc}")
        sys.exit(1)
