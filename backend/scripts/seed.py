import sys

from app.core.db import get_session_local
from app.models import AccountExecutive, Business, Question, User


def seed_data() -> None:
    session = get_session_local()()
    try:
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
            session.add(
                AccountExecutive(name="Alex Executive", email="alex.executive@local")
            )

        session.flush()

        if session.query(Business).count() == 0:
            executive = session.query(AccountExecutive).first()
            session.add_all(
                [
                    Business(
                        name="Northwind Logistics",
                        location="London",
                        account_executive_id=executive.id if executive else None,
                        priority_flag=True,
                        active=True,
                    ),
                    Business(
                        name="Contoso Labs",
                        location="Manchester",
                        account_executive_id=executive.id if executive else None,
                        priority_flag=False,
                        active=True,
                    ),
                ]
            )

        if session.query(Question).count() == 0:
            session.add_all(
                [
                    Question(
                        category="Classic NPS",
                        question_text="How likely is your organisation to recommend CWS?",
                        is_nps=True,
                        is_mandatory=True,
                        order_index=1,
                    ),
                    Question(
                        category="Relationship Management",
                        question_text="Rate relationship management.",
                        is_nps=False,
                        is_mandatory=True,
                        order_index=2,
                    ),
                    Question(
                        category="Service Performance",
                        question_text="Rate service performance.",
                        is_nps=False,
                        is_mandatory=True,
                        order_index=3,
                    ),
                ]
            )

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
