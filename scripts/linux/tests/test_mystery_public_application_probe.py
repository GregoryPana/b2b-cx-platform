#!/usr/bin/env python3
"""Disposable Unix-socket application-probe and serving-identity regressions."""
from __future__ import annotations

import importlib.util
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

SCRIPTS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("release_guard", SCRIPTS / "mystery_public_release_guard.py")
assert spec and spec.loader
release_guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_guard)

SHA = "a" * 40
MANIFEST = {
    "schema_version": 1,
    "release_id": "candidate-release",
    "git_sha": SHA,
    "build_timestamp_utc": "2026-10-13T00:00:00Z",
    "frontend_auth_mode": "mystery_public",
    "expected_migration_heads": ["20260714_000032"],
    "python_wheelhouse": True,
}
SERVER = r'''#!/usr/bin/env python3
import json, os, signal, socket, sys, time
mode = os.environ.get("PROBE_TEST_MODE", "valid")
if mode == "startup_failure": raise SystemExit(12)
if mode == "timeout": time.sleep(30); raise SystemExit(0)
path = sys.argv[sys.argv.index("--uds") + 1]
server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
server.bind(path); server.listen(5)
while True:
    connection, _ = server.accept()
    request = connection.recv(4096).split(b" ", 2)[1]
    if request == b"/health/ready":
        payload = {"status": "ready", "version": os.environ["APP_VERSION"], "checks": {"database": "ok"}}
        if mode == "wrong_version": payload["version"] = "b" * 40
        if mode == "not_ready": payload["status"] = "not_ready"
        if os.environ.get("LD_PRELOAD"): payload["status"] = "loader_environment_leaked"
        status = 200
    else:
        payload = {"detail": "anonymous"}; status = 200 if mode == "auth200" else 401
    body = json.dumps(payload).encode()
    connection.sendall((f"HTTP/1.1 {status} X\r\nContent-Length: {len(body)}\r\nConnection: close\r\n\r\n").encode() + body)
    connection.close()
'''


class CandidateApplicationProbeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.release = self.root / "candidate-release"
        self.backend = self.release / "backend"
        self.bin = self.backend / "venv/bin"
        self.bin.mkdir(parents=True)
        subprocess.run([sys.executable, "-I", "-m", "venv", "--copies", str(self.backend / "venv")], check=True)
        uvicorn = self.bin / "uvicorn"
        uvicorn.write_text(SERVER, encoding="utf-8")
        uvicorn.chmod(0o755)
        (self.release / "release-manifest.json").write_text(json.dumps(MANIFEST), encoding="utf-8")
        self.shared = self.root / "shared"
        self.shared.mkdir(mode=0o770)
        self.env = self.root / ".env"
        self.env.write_text(
            "ENVIRONMENT=production\nAUTH_MODE=mystery_public\n"
            "DATABASE_URL=postgresql+psycopg://fixture.invalid/db?sslmode=require\n"
            "CORS_ALLOW_ORIGINS=https://fixture.invalid\nMYSTERY_AUTH_SECRET_KEY=fixture-not-production\n"
            "PROBE_TEST_MODE=valid\nLD_PRELOAD=/must/not/reach/root-or-candidate-runtime.so\n",
            encoding="utf-8",
        )
        self.current = self.root / "current"
        self.current.symlink_to("unchanged-live-release")

    def run_probe(self, mode: str = "valid", timeout: float = 1.5):
        text = self.env.read_text(encoding="utf-8").replace("PROBE_TEST_MODE=valid", f"PROBE_TEST_MODE={mode}")
        self.env.write_text(text, encoding="utf-8")
        try:
            return release_guard.check_candidate_application(
                self.release,
                self.env,
                self.shared,
                required_uid=os.getuid(),
                service_uid=os.getuid(),
                service_gid=os.getgid(),
                command_prefix=(),
                startup_timeout=timeout,
                request_timeout=0.25,
            )
        finally:
            self.assertEqual(os.readlink(self.current), "unchanged-live-release")
            self.assertEqual(list(self.shared.iterdir()), [], "probe child/socket/liveness state was not removed")

    def test_actual_disposable_unix_socket_probe_passes(self) -> None:
        result = self.run_probe()
        self.assertEqual((result["git_sha"], result["ready_status"], result["database"],
                          result["anonymous_session_status"]), (SHA, "ready", "ok", 401))
        self.assertGreater(result["completed_monotonic_ns"], 0)

    def test_startup_failure_is_rejected_and_cleaned(self) -> None:
        with self.assertRaisesRegex(release_guard.GuardError, "exited before readiness"):
            self.run_probe("startup_failure")

    def test_wrong_version_is_rejected_and_cleaned(self) -> None:
        with self.assertRaisesRegex(release_guard.GuardError, "identity/status/database"):
            self.run_probe("wrong_version")

    def test_not_ready_is_rejected_and_cleaned(self) -> None:
        with self.assertRaisesRegex(release_guard.GuardError, "identity/status/database"):
            self.run_probe("not_ready")

    def test_anonymous_session_must_be_401(self) -> None:
        with self.assertRaisesRegex(release_guard.GuardError, "anonymous session"):
            self.run_probe("auth200")

    def test_timeout_reaps_probe_and_removes_private_directory(self) -> None:
        with self.assertRaisesRegex(release_guard.GuardError, "timed out"):
            self.run_probe("timeout", timeout=0.35)

    def test_hanging_command_prefix_before_marker_reaps_child_and_descendant(self) -> None:
        pid_file = self.root / "premarker-pids.json"
        prefix = self.root / "hanging-prefix.py"
        prefix.write_text(
            """#!/usr/bin/env python3
import json, os, subprocess, sys, time
child = subprocess.Popen(['/bin/sleep', '30'])
with open(sys.argv[1], 'w', encoding='ascii') as handle:
    json.dump({'prefix': os.getpid(), 'descendant': child.pid}, handle)
    handle.flush(); os.fsync(handle.fileno())
time.sleep(30)
""",
            encoding="utf-8",
        )
        prefix.chmod(0o755)
        with self.assertRaisesRegex(release_guard.GuardError, "timed out"):
            release_guard.check_candidate_application(
                self.release,
                self.env,
                self.shared,
                required_uid=os.getuid(),
                service_uid=os.getuid(),
                service_gid=os.getgid(),
                command_prefix=(str(prefix), str(pid_file)),
                startup_timeout=0.5,
                request_timeout=0.1,
            )
        self.assertTrue(pid_file.is_file(), "prefix did not reach its pre-marker hang")
        identities = json.loads(pid_file.read_text(encoding="ascii"))
        deadline = time.monotonic() + 3
        while any(Path(f"/proc/{pid}").exists() for pid in identities.values()) and time.monotonic() < deadline:
            time.sleep(0.05)
        self.assertFalse(Path(f"/proc/{identities['prefix']}").exists())
        self.assertFalse(Path(f"/proc/{identities['descendant']}").exists())
        self.assertEqual(list(self.shared.iterdir()), [])

    def test_liveness_marker_path_race_fails_closed_and_cleans_process(self) -> None:
        prefix = self.root / "marker-race.py"
        prefix.write_text(
            """#!/usr/bin/env python3
import os, sys
# argv: prefix, candidate-python, -I, -c, launcher, marker, uvicorn, ...
os.symlink('/dev/null', sys.argv[5])
os.execv(sys.argv[1], sys.argv[1:])
""",
            encoding="utf-8",
        )
        prefix.chmod(0o755)
        with self.assertRaisesRegex(release_guard.GuardError, "exited before readiness"):
            release_guard.check_candidate_application(
                self.release,
                self.env,
                self.shared,
                required_uid=os.getuid(),
                service_uid=os.getuid(),
                service_gid=os.getgid(),
                command_prefix=(str(prefix),),
                startup_timeout=1,
                request_timeout=0.1,
            )
        self.assertEqual(list(self.shared.iterdir()), [])

    def test_sigkill_of_guard_cannot_leave_marked_candidate_process_alive(self) -> None:
        self.env.write_text(
            self.env.read_text(encoding="utf-8").replace("PROBE_TEST_MODE=valid", "PROBE_TEST_MODE=timeout"),
            encoding="utf-8",
        )
        helper = r'''import importlib.util, os, pathlib, sys
spec=importlib.util.spec_from_file_location("guard", sys.argv[1]); guard=importlib.util.module_from_spec(spec); spec.loader.exec_module(guard)
guard.check_candidate_application(pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]), pathlib.Path(sys.argv[4]),
    required_uid=os.getuid(), service_uid=os.getuid(), service_gid=os.getgid(), command_prefix=(), startup_timeout=30)
'''
        parent = subprocess.Popen(
            [sys.executable, "-I", "-c", helper, str(SCRIPTS / "mystery_public_release_guard.py"),
             str(self.release), str(self.env), str(self.shared)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        deadline = time.monotonic() + 10
        marker = None
        while time.monotonic() < deadline and parent.poll() is None:
            markers = list(self.shared.glob(".preactivation-app-*/liveness.json"))
            if markers:
                marker = markers[0]
                break
            time.sleep(0.05)
        self.assertIsNotNone(marker, "probe never published its operation liveness marker")
        assert marker is not None
        identity = json.loads(marker.read_text(encoding="ascii"))
        os.kill(parent.pid, signal.SIGKILL)
        parent.wait(timeout=5)
        child = Path(f"/proc/{identity['pid']}")
        deadline = time.monotonic() + 5
        while child.exists() and time.monotonic() < deadline:
            time.sleep(0.05)
        self.assertFalse(child.exists(), "parent-death chain left candidate application code alive")
        for path in self.shared.iterdir():
            shutil.rmtree(path)

    def test_non_tls_or_non_postgresql_database_fails_closed_before_start(self) -> None:
        for url in (
            "postgresql://fixture.invalid/db",
            "sqlite:///fixture.db",
            "postgresql://fixture.invalid/db?sslmode=require&options=-c%20default_transaction_read_only=off",
        ):
            with self.subTest(url=url):
                text = self.env.read_text(encoding="utf-8")
                text = text.replace("postgresql+psycopg://fixture.invalid/db?sslmode=require", url)
                self.env.write_text(text, encoding="utf-8")
                with self.assertRaises(release_guard.GuardError):
                    self.run_probe()
                self.env.write_text(text.replace(url, "postgresql+psycopg://fixture.invalid/db?sslmode=require"), encoding="utf-8")

    def test_restricted_environment_grammar_matches_live_preflight(self) -> None:
        base = (
            "ENVIRONMENT=production\nAUTH_MODE=mystery_public\n"
            "DATABASE_URL=postgresql://fixture.invalid/db?sslmode=require\n"
            "CORS_ALLOW_ORIGINS=https://fixture.invalid\nMYSTERY_AUTH_SECRET_KEY=not-a-real-secret\n"
            "LOCAL_DEVELOPMENT_AUTO_DDL=false\n"
        )
        accepted = {
            "unquoted punctuation": ("TEST_VALUE=alpha-${NAME}:_./+@#%\n", "alpha-${NAME}:_./+@#%"),
            "single quoted spaces": ("TEST_VALUE='alpha beta'\n", "alpha beta"),
            "double quoted spaces": ('TEST_VALUE="alpha beta"\n', "alpha beta"),
            "empty quoted": ("TEST_VALUE=''\n", ""),
        }
        for label, (line, expected) in accepted.items():
            with self.subTest(label=label):
                self.env.write_text(base + line, encoding="utf-8")
                self.assertEqual(release_guard._read_runtime_environment(self.env)["TEST_VALUE"], expected)
                result = subprocess.run(
                    [sys.executable, "-I", str(SCRIPTS / "mystery_public_release_guard.py"),
                     "check-production-environment", str(self.env)],
                    text=True, capture_output=True, check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
        rejected = {
            "unquoted whitespace": "TEST_VALUE=alpha beta\n",
            "escape": "TEST_VALUE=alpha\\ beta\n",
            "continuation": "TEST_VALUE=alpha\\\nbeta\n",
            "unclosed quote": "TEST_VALUE='alpha\n",
            "mixed quote": "TEST_VALUE=alpha'beta'\n",
            "duplicate": "TEST_VALUE=alpha\nTEST_VALUE=beta\n",
        }
        for label, line in rejected.items():
            with self.subTest(label=label):
                self.env.write_text(base + line, encoding="utf-8")
                with self.assertRaises(release_guard.GuardError):
                    release_guard._read_runtime_environment(self.env)
                result = subprocess.run(
                    [sys.executable, "-I", str(SCRIPTS / "mystery_public_release_guard.py"),
                     "check-production-environment", str(self.env)],
                    text=True, capture_output=True, check=False,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("not-a-real-secret", result.stdout + result.stderr)

    def test_production_environment_rejects_auto_ddl_opt_in(self) -> None:
        self.env.write_text(self.env.read_text(encoding="utf-8") + "LOCAL_DEVELOPMENT_AUTO_DDL=true\n", encoding="utf-8")
        with self.assertRaisesRegex(release_guard.GuardError, "must disable"):
            self.run_probe()


class ServingIdentityFixtureTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.release = self.root / "candidate-release"
        backend = self.release / "backend"
        bin_dir = backend / "venv/bin"
        bin_dir.mkdir(parents=True)
        (self.release / "release-manifest.json").write_text(json.dumps(MANIFEST), encoding="utf-8")
        self.real_python = self.root / "root-python"
        shutil.copyfile(sys.executable, self.real_python)
        self.real_python.chmod(0o755)
        (bin_dir / "python").symlink_to(self.real_python)
        self.uvicorn = bin_dir / "uvicorn"
        self.uvicorn.write_text("#!/bin/true\n", encoding="utf-8")
        self.uvicorn.chmod(0o755)
        self.proc = self.root / "proc"
        self.pid = 4321
        process = self.proc / str(self.pid)
        process.mkdir(parents=True)
        (process / "cwd").symlink_to(backend)
        (process / "exe").symlink_to(self.real_python)
        (process / "cmdline").write_bytes(os.fsencode(str(self.real_python)) + b"\0" + os.fsencode(str(self.uvicorn)) + b"\0")
        fields = ["0"] * 22
        fields[0] = str(self.pid); fields[1] = "(python)"; fields[2] = "S"; fields[21] = "999"
        (process / "stat").write_text(" ".join(fields), encoding="ascii")
        self.properties = {"MainPID": str(self.pid), "ExecMainStartTimestampMonotonic": "2000"}

    def verify(self, properties=None):
        return release_guard.verify_serving_identity(
            self.release, SHA, 1000, properties or self.properties,
            proc_root=self.proc, required_service_uid=os.getuid(), required_release_uid=os.getuid(),
        )

    def test_valid_root_controlled_venv_python_symlink_passes(self) -> None:
        result = self.verify()
        self.assertEqual((result["main_pid"], result["git_sha"]), (self.pid, SHA))

    def test_wrong_main_pid_is_rejected(self) -> None:
        with self.assertRaisesRegex(release_guard.GuardError, "not live"):
            self.verify({**self.properties, "MainPID": "9876"})

    def test_wrong_cwd_is_rejected(self) -> None:
        cwd = self.proc / str(self.pid) / "cwd"
        cwd.unlink(); cwd.symlink_to(self.root)
        with self.assertRaisesRegex(release_guard.GuardError, "cwd"):
            self.verify()

    def test_stale_restart_timestamp_is_rejected(self) -> None:
        with self.assertRaisesRegex(release_guard.GuardError, "freshly started"):
            self.verify({**self.properties, "ExecMainStartTimestampMonotonic": "1000"})

    def test_pid_incarnation_change_during_proc_inspection_is_rejected(self) -> None:
        stat_path = self.proc / str(self.pid) / "stat"
        original = release_guard._proc_start_ticks
        samples = 0

        def mutate_after_first(proc_root: Path, pid: int) -> str:
            nonlocal samples
            value = original(proc_root, pid)
            samples += 1
            if samples == 1:
                fields = stat_path.read_text(encoding="ascii").split()
                fields[21] = "1000"
                stat_path.write_text(" ".join(fields), encoding="ascii")
            return value

        with mock.patch.object(release_guard, "_proc_start_ticks", side_effect=mutate_after_first):
            with self.assertRaisesRegex(release_guard.GuardError, "incarnation changed"):
                self.verify()

    def test_dying_pid_is_rejected(self) -> None:
        stat_path = self.proc / str(self.pid) / "stat"
        fields = stat_path.read_text(encoding="ascii").split()
        fields[2] = "Z"
        stat_path.write_text(" ".join(fields), encoding="ascii")
        with self.assertRaisesRegex(release_guard.GuardError, "exiting or defunct"):
            self.verify()

    def test_systemd_pid_metadata_change_after_inspection_is_rejected(self) -> None:
        before = "MainPID=4321\nExecMainStartTimestampMonotonic=2000\nUser=cxadmin\nGroup=www-data\n"
        after = "MainPID=4322\nExecMainStartTimestampMonotonic=2001\nUser=cxadmin\nGroup=www-data\n"
        with mock.patch.object(
            release_guard.subprocess,
            "run",
            side_effect=[SimpleNamespace(returncode=0, stdout=before), SimpleNamespace(returncode=0, stdout=after)],
        ):
            with self.assertRaisesRegex(release_guard.GuardError, "metadata changed"):
                release_guard.check_serving_identity(
                    self.release, SHA, 1000, "fixture.service", proc_root=self.proc,
                    required_service_uid=os.getuid(), required_release_uid=os.getuid(),
                )

    def test_systemd_stable_metadata_and_proc_identity_pass(self) -> None:
        output = "MainPID=4321\nExecMainStartTimestampMonotonic=2000\nUser=cxadmin\nGroup=www-data\n"
        with mock.patch.object(
            release_guard.subprocess,
            "run",
            side_effect=[SimpleNamespace(returncode=0, stdout=output), SimpleNamespace(returncode=0, stdout=output)],
        ):
            result = release_guard.check_serving_identity(
                self.release, SHA, 1000, "fixture.service", proc_root=self.proc,
                required_service_uid=os.getuid(), required_release_uid=os.getuid(),
            )
        self.assertEqual(result["main_pid"], self.pid)


if __name__ == "__main__":
    unittest.main(verbosity=2)
