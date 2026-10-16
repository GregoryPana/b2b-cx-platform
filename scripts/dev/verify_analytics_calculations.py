#!/usr/bin/env python3
"""Repeatable local verification of CWSCX analytics/metric calculations.

Provisions a disposable PostgreSQL server with `pgserver` (Unix socket only, `listen_addresses` empty,
throw-away data directory stamped with a random nonce that the test fixtures re-verify before any DDL),
then runs the selected steps. Nothing connects to a real or shared database.

Usage (from the repository root):

    python scripts/dev/verify_analytics_calculations.py [--scope SCOPE] [--scratch DIR]
           [--build-outdir DIR] [-- <extra pytest args>]

Scopes (default: focused):
  focused   analytics assurance suite (pytest, tests/analytics) + dashboard Node metric tests
  analytics analytics assurance suite only
  frontend  dashboard Node metric tests only
  full      the ENTIRE backend suite (`pytest tests`) on the disposable cluster
  build     dashboard production build written to --build-outdir (must be outside the repository)
  all       analytics + full backend suite + Node tests + dashboard build (every step above)

`full` prepares a PostgreSQL-native fixture schema on the attested disposable cluster before running
legacy integration modules. Every selected step must pass for exit zero. `focused` reports only the
analytics/Node gate, not the full suite or build. Set PLAYWRIGHT_BROWSERS_PATH to matching Chromium
for PDF tests. CI calls these gates from analytics-calculation-assurance.yml.
No linter step exists in this repository and none is invented here.
"""

from __future__ import annotations

import argparse
import os
import secrets
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND = REPO_ROOT / "backend"
DASHBOARD = REPO_ROOT / "frontend" / "dashboard-blueprint"
sys.path.insert(0, str(BACKEND / "tests" / "analytics"))

SCOPE_STEPS = {
    "focused": ["analytics", "frontend"],
    "analytics": ["analytics"],
    "frontend": ["frontend"],
    "full": ["full"],
    "build": ["build"],
    "all": ["analytics", "full", "frontend", "build"],
}


def backend_env(pg_url: str, pgdata: str, nonce: str) -> dict:
    env = dict(os.environ)
    # Never let a caller-provided startup proof URL escape into a runner child.
    # Full scope installs its own URL only after creating an empty database on
    # the attested disposable cluster.
    env.pop("STARTUP_NO_DDL_POSTGRES_URL", None)
    env.update(
        {
            "TESTING": "true",
            "ENVIRONMENT": "dev",
            "CWSCX_ANALYTICS_PG_URL": pg_url,
            "CWSCX_ANALYTICS_PG_DATA": pgdata,
            "CWSCX_ANALYTICS_PG_NONCE": nonce,
            # Any test that touches the app engine must hit the disposable cluster, never a default.
            "DATABASE_URL": pg_url,
            "PYTHONDONTWRITEBYTECODE": "1",
        }
    )
    return env


def _fixture_database_url(sqlalchemy, base_url: str, database: str, *, plain_postgresql: bool = False) -> str:
    url = sqlalchemy.engine.make_url(base_url).set(database=database)
    if plain_postgresql:
        # test_startup_no_ddl_postgresql.py connects with psycopg directly, so
        # do not leak a SQLAlchemy-specific driver suffix into its child.
        url = url.set(drivername="postgresql")
    return url.render_as_string(hide_password=False)


def _database_ddl(sqlalchemy, base_url: str, pgdata: str, nonce: str, statement: str) -> None:
    """Execute fixture-database DDL only after a fresh cluster attestation."""
    from fixture_guard import attest_disposable_cluster

    attest_disposable_cluster(base_url, pgdata, nonce)
    admin_engine = sqlalchemy.create_engine(base_url, isolation_level="AUTOCOMMIT")
    try:
        with admin_engine.connect() as conn:
            conn.execute(sqlalchemy.text(statement))
    finally:
        admin_engine.dispose()


def _drop_fixture_databases(
    sqlalchemy, base_url: str, pgdata: str, nonce: str, databases: list[str]
) -> None:
    """Attempt every fixture cleanup, even if an earlier DROP fails."""
    first_error: BaseException | None = None
    for database in reversed(databases):
        try:
            _database_ddl(
                sqlalchemy,
                base_url,
                pgdata,
                nonce,
                f'DROP DATABASE IF EXISTS "{database}" WITH (FORCE)',
            )
        except BaseException as exc:  # cleanup must continue for the remaining database
            if first_error is None:
                first_error = exc
    if first_error is not None:
        raise first_error


def _provision_full_suite_databases(sqlalchemy, base_url: str, pgdata: str, nonce: str):
    """Create separate migration and empty startup-no-DDL fixture databases."""
    migration_db = "migration_fixture_" + secrets.token_hex(12)
    startup_db = "startup_noddl_fixture_" + secrets.token_hex(12)
    if migration_db == startup_db:  # defensive even if prefixes are later changed
        raise RuntimeError("fixture database identities must be distinct")

    created: list[str] = []
    try:
        for database in (migration_db, startup_db):
            _database_ddl(sqlalchemy, base_url, pgdata, nonce, f'CREATE DATABASE "{database}"')
            created.append(database)
    except BaseException:
        _drop_fixture_databases(sqlalchemy, base_url, pgdata, nonce, created)
        raise

    migration_url = _fixture_database_url(sqlalchemy, base_url, migration_db)
    startup_url = _fixture_database_url(sqlalchemy, base_url, startup_db, plain_postgresql=True)
    return migration_url, startup_url, created


def run_pytest(target: str, env: dict, extra: list[str]) -> int:
    cmd = [sys.executable, "-m", "pytest", target, "-q", "-p", "no:cacheprovider", *extra]
    print("+", " ".join(cmd), flush=True)
    return subprocess.call(cmd, cwd=BACKEND, env=env)


def run_frontend() -> int:
    node = shutil.which("node")
    if not node:
        print("node not found; cannot run dashboard metric tests", file=sys.stderr)
        return 127
    tests = sorted(str(p) for p in (DASHBOARD / "src" / "lib").glob("*.test.mjs"))
    if not tests:
        print("no dashboard metric tests found", file=sys.stderr)
        return 1
    cmd = [node, "--test", *tests]
    print("+", " ".join(cmd), flush=True)
    return subprocess.call(cmd, cwd=DASHBOARD)


def run_build(outdir: str | None) -> int:
    if not outdir:
        print("--build-outdir is required for the build step", file=sys.stderr)
        return 2
    out = Path(outdir).resolve()
    if REPO_ROOT == out or REPO_ROOT in out.parents:
        print("refusing to build inside the repository; choose --build-outdir outside it", file=sys.stderr)
        return 2
    vite = DASHBOARD / "node_modules" / "vite" / "bin" / "vite.js"
    if not vite.is_file():
        print("dashboard node_modules/vite not found; install dependencies first", file=sys.stderr)
        return 127
    cmd = ["node", str(vite), "build", "--outDir", str(out), "--emptyOutDir"]
    print("+", " ".join(cmd), flush=True)
    return subprocess.call(cmd, cwd=DASHBOARD)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--scope", choices=sorted(SCOPE_STEPS), default="focused")
    parser.add_argument("--scratch", default=os.environ.get("CWSCX_PG_SCRATCH_DIR"),
                        help="parent directory for the throw-away data directory")
    parser.add_argument("--build-outdir", default=None, help="output directory for the build step (outside the repo)")
    parser.add_argument("extra", nargs="*", help="extra pytest arguments (after --)")
    args = parser.parse_args()
    steps = SCOPE_STEPS[args.scope]
    results: dict[str, int] = {}

    if "analytics" in steps or "full" in steps:
        try:
            import pgserver
            import sqlalchemy
        except ImportError as exc:  # pragma: no cover
            print(f"missing dependency: {exc}. Install pgserver into this interpreter.", file=sys.stderr)
            return 2
        from fixture_guard import write_marker

        if args.scratch:
            Path(args.scratch).mkdir(parents=True, exist_ok=True)
        pgdata = Path(tempfile.mkdtemp(prefix="cwscx-analytics-pg-", dir=args.scratch)).resolve()
        server = pgserver.get_server(pgdata, cleanup_mode="delete")
        try:
            nonce = secrets.token_hex(32)
            write_marker(pgdata, nonce)
            url = server.get_uri()
            engine = sqlalchemy.create_engine(url)
            with engine.connect() as conn:
                listen = conn.execute(sqlalchemy.text("SHOW listen_addresses")).scalar()
                version = conn.execute(sqlalchemy.text("SHOW server_version")).scalar()
                reported = conn.execute(sqlalchemy.text("SHOW data_directory")).scalar()
            engine.dispose()
            if listen != "" or os.path.realpath(reported) != str(pgdata):
                print(f"refusing to run: listen_addresses={listen!r} data_directory={reported!r}", file=sys.stderr)
                return 3
            print(f"disposable PostgreSQL {version}: unix socket only, listen_addresses='' (isolated, attested)")
            env = backend_env(url, str(pgdata), nonce)
            if "analytics" in steps:
                results["analytics (pytest tests/analytics)"] = run_pytest("tests/analytics", env, args.extra)
            if "full" in steps:
                # Prepare the application's shared test engine before legacy test modules
                # can install their SQLite-shaped fallback tables into PostgreSQL.
                # This is fixture DDL on the attested disposable cluster, not migrations.
                from sqlalchemy.orm import Session
                from fixture_guard import attest_disposable_cluster
                from pg_schema import create_schema

                attest_disposable_cluster(url, str(pgdata), nonce)
                sys.path.insert(0, str(BACKEND))
                os.environ.update(env)  # app imports must see only the disposable URL
                fixture_engine = sqlalchemy.create_engine(url)
                try:
                    with Session(fixture_engine) as fixture_session:
                        create_schema(fixture_session)
                        fixture_session.commit()
                finally:
                    fixture_engine.dispose()
                # Migration regressions reset public schema, while startup-no-DDL
                # must begin empty. Give each a distinct database, separate from
                # the application fixture schema, on this same attested cluster.
                created_databases: list[str] = []
                try:
                    migration_url, startup_url, created_databases = _provision_full_suite_databases(
                        sqlalchemy, url, str(pgdata), nonce
                    )
                    env["MIGRATION_TEST_DATABASE_URL"] = migration_url
                    env["STARTUP_NO_DDL_POSTGRES_URL"] = startup_url
                    results["full backend suite (pytest tests)"] = run_pytest("tests", env, args.extra)
                finally:
                    _drop_fixture_databases(sqlalchemy, url, str(pgdata), nonce, created_databases)
                    if created_databases:
                        print(f"cleaned {len(created_databases)} disposable full-suite fixture databases")
        finally:
            server.cleanup()
            shutil.rmtree(pgdata, ignore_errors=True)
    if "frontend" in steps:
        results["dashboard Node metric tests"] = run_frontend()
    if "build" in steps:
        results["dashboard production build"] = run_build(args.build_outdir)

    print("\n== verify_analytics_calculations summary (scope: %s) ==" % args.scope)
    for name, code in results.items():
        print(f"  {'PASS' if code == 0 else 'FAIL'}  {name} (exit {code})")
    if args.scope == "focused":
        print("  NOTE: 'focused' is the analytics gate only; it is NOT a full-suite or build result.")
    return 0 if all(code == 0 for code in results.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
