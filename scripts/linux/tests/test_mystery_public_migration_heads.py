"""Read-only, exact source/manifest/database migration-head gates."""
import importlib.util
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "mystery_public_release_guard.py"
spec = importlib.util.spec_from_file_location("mystery_guard", MODULE)
assert spec and spec.loader
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class MigrationHeadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.backend = self.root / "backend"
        (self.backend / "alembic" / "versions").mkdir(parents=True)
        self.ini = self.backend / "alembic.ini"
        self.ini.write_text("[alembic]\nscript_location = alembic\n", encoding="utf-8")
        self.revision("r1", None)
        self.manifest = self.root / "release-manifest.json"
        self.manifest.write_text(json.dumps({
            "schema_version": 1, "release_id": "test", "git_sha": "a" * 40,
            "build_timestamp_utc": "2026-01-01T00:00:00Z",
            "frontend_auth_mode": "mystery_public", "expected_migration_heads": ["r1"],
            "python_wheelhouse": True,
        }), encoding="utf-8")
        self.db = self.root / "test.sqlite"
        with closing(sqlite3.connect(self.db)) as conn:
            with conn:
                conn.execute("CREATE TABLE alembic_version (version_num VARCHAR(32) PRIMARY KEY)")
                conn.execute("INSERT INTO alembic_version VALUES ('r1')")
        self.env = self.root / ".env"
        self.env.write_text(f"DATABASE_URL=sqlite:///{self.db}\n", encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def revision(self, revision, parent):
        (self.backend / "alembic" / "versions" / f"{revision}.py").write_text(
            f"revision = {revision!r}\ndown_revision = {parent!r}\n", encoding="utf-8"
        )

    def test_exact_graph_and_db_pass_without_mutation(self):
        guard.check_db_heads(self.env, self.manifest, self.ini)
        with closing(sqlite3.connect(self.db)) as conn:
            self.assertEqual(conn.execute("SELECT version_num FROM alembic_version").fetchall(), [("r1",)])

    def test_db_drift_rejected(self):
        with closing(sqlite3.connect(self.db)) as conn:
            with conn:
                conn.execute("UPDATE alembic_version SET version_num = 'r0'")
        with self.assertRaisesRegex(guard.GuardError, "incompatible"):
            guard.check_db_heads(self.env, self.manifest, self.ini)

    def test_manifest_does_not_override_actual_source(self):
        self.revision("r2", "r1")
        with self.assertRaisesRegex(guard.GuardError, "differ from installed source"):
            guard.check_db_heads(self.env, self.manifest, self.ini)

    def test_fork_and_missing_ancestor_fail(self):
        self.revision("r2", "r1")
        self.revision("r3", "r1")
        with self.assertRaisesRegex(guard.GuardError, "one source migration head"):
            guard.source_migration_heads(self.ini)
        (self.backend / "alembic" / "versions" / "r2.py").unlink()
        (self.backend / "alembic" / "versions" / "r3.py").unlink()
        (self.backend / "alembic" / "versions" / "r1.py").unlink()
        self.revision("r2", "missing")
        with self.assertRaises(Exception):
            guard.source_migration_heads(self.ini)


if __name__ == "__main__":
    unittest.main()
