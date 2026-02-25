import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def get_database_url() -> str:
    return os.getenv("DATABASE_URL", "")


_engine = None


def get_engine():
    global _engine
    if _engine is None:
        database_url = get_database_url()
        if not database_url:
            raise RuntimeError("DATABASE_URL is not configured")
        _engine = create_engine(database_url, pool_pre_ping=True)
    return _engine


def get_session_local() -> sessionmaker:
    return sessionmaker(bind=get_engine(), class_=Session, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = get_session_local()()
    try:
        yield db
    finally:
        db.close()
