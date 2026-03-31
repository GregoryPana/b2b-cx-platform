from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DATABASE_URL = "postgresql://b2b:b2b@localhost:55432/b2b"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_questions():
    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                """
                SELECT
                    question_number,
                    COALESCE(question_key, CONCAT('install_q', question_number::text)) AS question_key,
                    COALESCE(category, 'General') AS category,
                    question_text,
                    COALESCE(score_min, 1) AS score_min,
                    COALESCE(score_max, 5) AS score_max,
                    COALESCE(input_type, 'score') AS input_type,
                    COALESCE(is_mandatory, true) AS is_mandatory
                FROM questions
                WHERE survey_type_id = 3
                ORDER BY question_number
                """
            )
        ).mappings().all()
        print([dict(row) for row in rows])
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_questions()
