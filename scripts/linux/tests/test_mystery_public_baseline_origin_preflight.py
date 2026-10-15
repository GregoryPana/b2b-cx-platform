#!/usr/bin/env python3
"""Behavioral regressions for the real baseline-origin preflight function."""

from __future__ import annotations

import http.server
import os
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

ENTRYPOINT = Path(__file__).resolve().parents[1] / "cwscx_mystery_public_deploy_entrypoint.sh"
ORIGIN = "legacy-origin"


def extract_function(source: str, name: str, next_name: str) -> str:
    start = source.index(f"{name}() {{")
    end = source.index(f"\n{next_name}() {{", start)
    return source[start:end].rstrip() + "\n"


class _ReadyHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 - stdlib callback name
        if self.path == "/health/ready":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ready\n")
        else:
            self.send_error(404)

    def log_message(self, format: str, *args: object) -> None:
        del format, args


class _ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


class BaselineOriginPreflightTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # Never claim or collide with the application's fixed host port. Only
        # the extracted unit fixture's readiness URL is translated below.
        cls.server = _ReusableTCPServer(("127.0.0.1", 0), _ReadyHandler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.server_thread.join(timeout=5)

    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.target = self.root / "target"
        self.releases = self.target / "releases"
        self.release = self.releases / ORIGIN
        self.backend = self.release / "backend"
        self.launcher = self.backend / "venv/bin/uvicorn"
        self.launcher.parent.mkdir(parents=True)
        self.launcher.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
        self.launcher.chmod(0o755)
        self.current = self.target / "current"
        self.current.symlink_to(f"releases/{ORIGIN}")
        self.env_file = self.target / ".env"
        self.env_file.write_text("REDACTED=true\n", encoding="utf-8")
        self.action_log = self.root / "actions.log"
        self.mock_bin = self.root / "mock-bin"
        self.mock_bin.mkdir()
        self.optimized_python = self.mock_bin / "python-optimized"
        self._write_executable(
            self.optimized_python,
            f"#!/usr/bin/env bash\nexec {sys.executable!r} -O \"$@\"\n",
        )
        self._write_executable(
            self.mock_bin / "systemctl",
            """#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == show ]]; then
  case "$3" in
    --property=WorkingDirectory) printf '%s\n' "$MOCK_WORKING_DIRECTORY" ;;
    --property=ExecStart) printf '{ path=%s ; argv[]=%s ; }\n' "$MOCK_LAUNCHER" "$MOCK_LAUNCHER" ;;
    --property=EnvironmentFiles) printf '%s (ignore_errors=no)\n' "$MOCK_ENV_FILE" ;;
    *) exit 91 ;;
  esac
elif [[ "$1" == restart ]]; then
  printf 'systemctl restart\n' >>"$MOCK_ACTION_LOG"
elif [[ "$1" == is-active && "$2" == --quiet ]]; then
  exit 0
else
  exit 92
fi
""",
        )
        self._write_executable(
            self.mock_bin / "nginx",
            """#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == -t ]]
printf 'nginx -t\n' >>"$MOCK_ACTION_LOG"
""",
        )
        # The production account is intentionally absent on generic CI runners.
        # This adapter does not fake the checks: it executes their exact `test`
        # command under the current fixture identity after removing runuser args.
        self._write_executable(
            self.mock_bin / "runuser",
            """#!/usr/bin/env bash
set -euo pipefail
while [[ $# -gt 0 && "$1" != -- ]]; do shift; done
[[ "${1:-}" == -- ]] && shift
exec "$@"
""",
        )
        source = ENTRYPOINT.read_text(encoding="utf-8")
        functions = "\n".join(
            (
                extract_function(source, "require_root_dir", "require_root_file"),
                extract_function(source, "require_root_file", "current_release_id").split(
                    '\nrequire_root_dir "${TARGET_ROOT}"', 1
                )[0],
                extract_function(source, "preflight_baseline_origin", "remove_baseline_origin_snapshot"),
            )
        ).replace('== "root"', f'== "{self.release.owner()}"').replace(
            "http://127.0.0.1:8011/health/ready",
            f"http://127.0.0.1:{self.server.server_address[1]}/health/ready",
        )
        self.harness = self.root / "preflight-harness.sh"
        self.harness.write_text(
            "#!/usr/bin/env bash\nset -euo pipefail\n"
            "die() { echo \"cwscx-mystery-public-deploy: $*\" >&2; exit 1; }\n"
            "valid_release_id() { [[ \"$1\" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$ ]]; }\n"
            f'TARGET_ROOT={str(self.target)!r}\n'
            'RELEASES_ROOT="${TARGET_ROOT}/releases"\n'
            f'ENV_FILE={str(self.env_file)!r}\n'
            'SERVICE_NAME=cwscx-mystery-public-backend\n'
            f'PYTHON_BIN="${{HARNESS_PYTHON_BIN:-{sys.executable}}}"\n'
            + functions
            + f"preflight_baseline_origin {ORIGIN!r}\n",
            encoding="utf-8",
        )
        self.harness.chmod(0o700)

    @staticmethod
    def _write_executable(path: Path, body: str) -> None:
        path.write_text(body, encoding="utf-8")
        path.chmod(0o755)

    def run_preflight(self, working: Path, launcher: Path | str, *, optimize: bool = False) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env.update(
            {
                "PATH": f"{self.mock_bin}:/usr/sbin:/usr/bin:/sbin:/bin",
                "MOCK_WORKING_DIRECTORY": str(working),
                "MOCK_LAUNCHER": str(launcher),
                "MOCK_ENV_FILE": str(self.env_file),
                "MOCK_ACTION_LOG": str(self.action_log),
            }
        )
        if optimize:
            env["HARNESS_PYTHON_BIN"] = str(self.optimized_python)
        return subprocess.run(["bash", str(self.harness)], env=env, text=True, capture_output=True, check=False)

    def assert_no_stateful_commands(self) -> None:
        self.assertFalse(self.action_log.exists(), self.action_log.read_text() if self.action_log.exists() else "")

    def assert_preflight_passes(self, working: Path, launcher: Path, *, optimize: bool = False) -> None:
        result = self.run_preflight(working, launcher, optimize=optimize)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.action_log.read_text(encoding="utf-8").splitlines(), ["systemctl restart", "nginx -t"])

    def test_current_symlink_unit_paths_pass(self) -> None:
        self.assert_preflight_passes(self.current / "backend", self.current / "backend/venv/bin/uvicorn")

    def test_canonical_direct_unit_paths_pass_under_optimized_python_environment(self) -> None:
        self.assert_preflight_passes(self.backend, self.launcher, optimize=True)

    def test_outside_and_prefix_sibling_paths_fail_closed(self) -> None:
        for name in ("outside", f"{ORIGIN}-sibling"):
            with self.subTest(name=name):
                self.action_log.unlink(missing_ok=True)
                root = self.root / name if name == "outside" else self.releases / name
                launcher = root / "backend/venv/bin/uvicorn"
                launcher.parent.mkdir(parents=True)
                launcher.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
                launcher.chmod(0o755)
                result = self.run_preflight(root / "backend", launcher)
                self.assertNotEqual(result.returncode, 0)
                self.assert_no_stateful_commands()

    def test_dangling_path_fails_before_restart(self) -> None:
        result = self.run_preflight(self.current / "missing", self.current / "backend/venv/bin/uvicorn")
        self.assertNotEqual(result.returncode, 0)
        self.assert_no_stateful_commands()

    def test_symlink_escape_and_untrusted_intermediate_symlink_fail(self) -> None:
        outside = self.root / "outside-tree"
        (outside / "backend/venv/bin").mkdir(parents=True)
        escaped_launcher = outside / "backend/venv/bin/uvicorn"
        escaped_launcher.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
        escaped_launcher.chmod(0o755)
        (self.release / "redirect").symlink_to(outside)
        result = self.run_preflight(self.current / "redirect/backend", self.current / "redirect/backend/venv/bin/uvicorn")
        self.assertNotEqual(result.returncode, 0)
        self.assert_no_stateful_commands()

    def test_unsafe_intermediate_mode_fails_before_restart(self) -> None:
        self.launcher.parent.chmod(0o775)
        result = self.run_preflight(self.current / "backend", self.current / "backend/venv/bin/uvicorn")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unsafe pre-baseline traversal component", result.stderr)
        self.assert_no_stateful_commands()

    def test_current_link_substitution_fails_before_unit_metadata_is_used(self) -> None:
        self.current.unlink()
        self.current.symlink_to(str(self.release))
        result = self.run_preflight(self.backend, self.launcher)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("current link does not target the named release", result.stderr)
        self.assert_no_stateful_commands()

    def test_invalid_launcher_metadata_and_non_executable_launcher_fail(self) -> None:
        for launcher in ("not-an-absolute-launcher", self.launcher):
            with self.subTest(launcher=str(launcher)):
                self.action_log.unlink(missing_ok=True)
                if launcher == self.launcher:
                    self.launcher.chmod(0o644)
                result = self.run_preflight(self.backend, launcher)
                self.assertNotEqual(result.returncode, 0)
                self.assert_no_stateful_commands()
                self.launcher.chmod(0o755)


if __name__ == "__main__":
    unittest.main(verbosity=2)
