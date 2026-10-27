import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Database configuration - Use PostgreSQL in production, SQLite in tests
is_testing = os.getenv("TESTING") == "true"
if is_testing:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ci.db")
else:
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cwscx:change-me@localhost:5432/cwscx")

# Configure engine appropriately for the DB type
if DATABASE_URL.startswith("sqlite:"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize a disposable local-development database.

    Production schema changes are migration-owner work. ``create_app`` calls
    this helper only behind the explicit local-development-only opt-in, and a
    failed local bootstrap must remain visible rather than being suppressed.
    """
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE visits ADD COLUMN IF NOT EXISTS submitted_by_name VARCHAR(255)"))
        connection.execute(text("ALTER TABLE visits ADD COLUMN IF NOT EXISTS submitted_by_email VARCHAR(255)"))
        connection.execute(text("ALTER TABLE visits ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP"))
    print("Local development database initialized successfully")
