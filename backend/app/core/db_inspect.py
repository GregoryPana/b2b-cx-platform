"""Cached schema introspection helpers.

Five API modules used to ship their own near-identical ``has_table`` /
``has_column`` helpers that round-tripped to ``information_schema`` on every
call. The schema doesn't change inside a running process, so we cache the
result for the process lifetime; restarts pick up new columns.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session


def _query_table(db: Session, table_name: str) -> bool:
    return bool(
        db.execute(
            text(
                """
                SELECT 1
                FROM information_schema.tables
                WHERE table_name = :table_name
                LIMIT 1
                """
            ),
            {"table_name": table_name},
        ).scalar()
    )


def _query_column(db: Session, table_name: str, column_name: str) -> bool:
    return bool(
        db.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = :table_name AND column_name = :column_name
                LIMIT 1
                """
            ),
            {"table_name": table_name, "column_name": column_name},
        ).scalar()
    )


_table_cache: dict[tuple[int, str], bool] = {}
_column_cache: dict[tuple[int, str, str], bool] = {}


def _bind_key(db: Session) -> int:
    bind = db.get_bind()
    return id(bind)


def has_table(db: Session, table_name: str) -> bool:
    key = (_bind_key(db), table_name)
    cached = _table_cache.get(key)
    if cached is not None:
        return cached
    value = _query_table(db, table_name)
    _table_cache[key] = value
    return value


def has_column(db: Session, table_name: str, column_name: str) -> bool:
    key = (_bind_key(db), table_name, column_name)
    cached = _column_cache.get(key)
    if cached is not None:
        return cached
    value = _query_column(db, table_name, column_name)
    _column_cache[key] = value
    return value


def reset_cache() -> None:
    """Clear the schema cache. Useful in tests after running migrations."""
    _table_cache.clear()
    _column_cache.clear()
