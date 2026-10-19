#!/usr/bin/env python3
"""Read-only deployed DB compatibility gate; never reads authentication rows.

Contract: 20260609_000024_add_mystery_public_auth_core.py DateTime(timezone=True).
The migration uses the default public namespace. Non-public/shadowed relations fail
closed rather than silently checking a different table. No repair is attempted.
"""
from __future__ import annotations

import json
import os
import re

from sqlalchemy import create_engine, text

EXPECTED_HEADS = ["20260714_000032"]
EXPECTED_COLUMNS = {
    "mystery_users": ("password_set_at", "totp_confirmed_at", "locked_until", "last_login_at", "created_at", "updated_at"),
    "mystery_sessions": ("created_at", "last_seen_at", "absolute_expires_at", "idle_expires_at", "revoked_at"),
    "mystery_recovery_codes": ("used_at", "created_at"),
    "mystery_enrollment_tokens": ("expires_at", "used_at", "created_at"),
    "mystery_mfa_challenges": ("created_at", "expires_at", "used_at"),
    "mystery_auth_audit": ("created_at",),
}
CATALOG_SQL = """
SELECT t.typname, tn.nspname AS type_schema, c.relkind,
       pg_catalog.pg_table_is_visible(c.oid) AS visible
FROM pg_catalog.pg_namespace n
JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid
JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
JOIN pg_catalog.pg_namespace tn ON tn.oid = t.typnamespace
WHERE n.nspname = :schema AND c.relname = :table
  AND a.attname = :column AND a.attnum > 0 AND NOT a.attisdropped
"""


def inspect_on_connection(connection):
    """Inspect an already read-only connection; only fixed SELECT/SHOW statements.

    Session TimeZone explains timestamp interpretation; it is not a type fix.
    Missing privileges/metadata/errors are handled by the CLI as incompatible.
    """
    if connection.execute(text("SHOW transaction_read_only")).scalar_one() != "on":
        raise RuntimeError("read-only transaction required")
    zone = connection.execute(text("SHOW TimeZone")).scalar_one()
    if not isinstance(zone, str) or not re.fullmatch(r"[A-Za-z0-9_+:/.-]{1,64}", zone):
        raise RuntimeError("unrecognized timezone metadata")
    heads = sorted(connection.execute(text("SELECT version_num FROM public.alembic_version")).scalars())
    # Only reviewed revision identifiers may be emitted, never arbitrary DB text.
    head_matches = heads == EXPECTED_HEADS
    records = []
    for table, columns in EXPECTED_COLUMNS.items():
        for column in columns:
            rows = connection.execute(text(CATALOG_SQL), {"schema": "public", "table": table, "column": column}).mappings().all()
            actual, status = "unknown", "incompatible"
            if not rows:
                actual, status = "missing", "missing"
            elif len(rows) == 1:
                row = rows[0]
                if row["type_schema"] == "pg_catalog":
                    actual = {"timestamptz": "timestamp with time zone", "timestamp": "timestamp without time zone"}.get(row["typname"], "unknown")
                if actual == "timestamp with time zone" and row["relkind"] in ("r", "p") and row["visible"]:
                    status = "compatible"
            records.append({"schema": "public", "table": table, "column": column,
                            "expected_type": "timestamp with time zone", "actual_type": actual, "status": status})
    return {"heads": EXPECTED_HEADS[:] if head_matches else [], "head_status": "compatible" if head_matches else "incompatible",
            "auth_timestamp_column_types": records, "session_timezone": zone,
            "compatible": head_matches and all(r["status"] == "compatible" for r in records)}


def runtime_report():
    """Fixed approved runtime config only; no command-line URL/config overrides."""
    engine = None
    try:
        from dotenv import load_dotenv

        load_dotenv("/opt/cwscx/.env", override=True)
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise RuntimeError("missing runtime config")
        engine = create_engine(url, connect_args={"connect_timeout": 5, "options": "-c default_transaction_read_only=on -c statement_timeout=5000"})
        with engine.connect() as connection:
            return inspect_on_connection(connection)
    except Exception:
        # Never stringify exceptions (SQLAlchemy/driver messages can contain DSNs,
        # SQL, tokens, server details). Fixed allowlisted error category only.
        return {"compatible": False, "error_class": "MetadataInspectionError"}
    finally:
        if engine is not None:
            try:
                engine.dispose()
            except Exception:
                pass


def main():
    report = runtime_report()
    print(json.dumps(report, sort_keys=True))
    return 0 if report.get("compatible") is True else 1


if __name__ == "__main__":
    raise SystemExit(main())
