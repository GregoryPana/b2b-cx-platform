import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Database configuration - Use PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cwscx:change-me@localhost:5432/cwscx")

# PostgreSQL configuration
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
    """Initialize database with tables."""
    try:
        Base.metadata.create_all(bind=engine)
        print("Database initialized successfully")
    except Exception as e:
        print(f"Database initialization failed: {e}")
        # Don't raise exception - continue with app startup
