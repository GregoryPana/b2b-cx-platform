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
                # Migration regressions reset public schema, so give them their own
                # empty database rather than the application fixture database.
                migration_db = "migration_fixture_" + secrets.token_hex(12)
                admin_engine = sqlalchemy.create_engine(url, isolation_level="AUTOCOMMIT")
                try:
                    with admin_engine.connect() as conn:
                        conn.execute(sqlalchemy.text(f'CREATE DATABASE "{migration_db}"'))
                    migration_url = sqlalchemy.engine.make_url(url).set(database=migration_db)
                    env["MIGRATION_TEST_DATABASE_URL"] = migration_url.render_as_string(hide_password=False)
                    results["full backend suite (pytest tests)"] = run_pytest("tests", env, args.extra)
                finally:
                    with admin_engine.connect() as conn:
                        conn.execute(sqlalchemy.text(f'DROP DATABASE IF EXISTS "{migration_db}" WITH (FORCE)'))
                    admin_engine.dispose()
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
