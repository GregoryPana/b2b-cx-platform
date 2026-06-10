"""Create a fresh invited mystery-shopper user + enrollment token for local testing.

Run from backend/ with DATABASE_URL set. Writes the enroll URL to
/tmp/opencode/mystery_public_live_test.txt and prints it.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from tests.test_mystery_public_auth_lifecycle import (
    _bootstrap_mystery_shopper,
    _create_mystery_tables,
    create_invited_user_via_db,
)

URL = "postgresql://b2b:b2b@localhost:5432/b2b"

engine = create_engine(URL)
Base.metadata.create_all(bind=engine)
_create_mystery_tables(engine)
_bootstrap_mystery_shopper(engine)

SessionLocal = sessionmaker(bind=engine)
session = SessionLocal()
try:
    session.execute(
        text(
            "INSERT INTO mystery_shopper_locations (name, business_id, active) "
            "VALUES ('Local Test Location', NULL, 1) ON CONFLICT (name) DO NOTHING"
        )
    )
    session.commit()
    user = create_invited_user_via_db(session)
    # Give the tester a comfortable window instead of the default 30 minutes.
    session.execute(
        text(
            "UPDATE mystery_enrollment_tokens "
            "SET expires_at = NOW() + interval '8 hours' WHERE user_id = :uid"
        ),
        {"uid": user["user_id"]},
    )
    session.commit()
finally:
    session.close()

enroll_url = f"http://localhost:5177/?enroll={user['enrollment_token']}"
with open("/tmp/opencode/mystery_public_live_test.txt", "w", encoding="utf-8") as f:
    f.write("frontend_url=http://localhost:5177\n")
    f.write(f"enroll_url={enroll_url}\n")
    f.write(f"email={user['email']}\n")
    f.write("location=Local Test Location\n")

print("EMAIL:", user["email"])
print("ENROLL_URL:", enroll_url)
