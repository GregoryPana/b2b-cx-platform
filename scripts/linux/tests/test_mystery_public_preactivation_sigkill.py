#!/usr/bin/env python3
"""Real SIGKILL regressions for the Mystery Public preactivation marker.

SIGKILL (and power loss) skips every EXIT trap. These tests kill the real
installer and the real entrypoint+installer pair at virtualenv creation, then
prove the durable root-only preactivation marker lets a signed `recover` remove
exactly the marked candidate - and nothing else - so the fixed rollback ID can
be installed again. The release guard, systemctl, nginx and the venv builder
are mocked; the entrypoint (path-substituted) and installer are the real files.
"""

from __future__ import annotations

import getpass
import hashlib
import importlib.util
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import unittest
import zipfile
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
HELPER = SCRIPTS / "mystery_public_workflow_evidence.py"
ENTRYPOINT_SOURCE = SCRIPTS / "cwscx_mystery_public_deploy_entrypoint.sh"
INSTALLER_SOURCE = SCRIPTS / "install_mystery_public_bundle.sh"
spec = importlib.util.spec_from_file_location("release_guard", SCRIPTS / "mystery_public_release_guard.py")
assert spec and spec.loader
release_guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_guard)

ORIGIN = "origin-release"
MOCK_PYTHON = """#!/usr/bin/env bash
set -euo pipefail
# Privileged-suite policy: every interpreter call must be isolated.
[[ "${1:-}" == "-I" ]] || { echo "python3 invoked without -I" >&2; exit 97; }
shift
if [[ "${1:-}" == "-m" && "${2:-}" == "venv" ]]; then
  dest="$3"
  mkdir -p "$dest/bin"
  if [[ -n "${INTERRUPT_MARKER:-}" ]]; then : >"$INTERRUPT_MARKER"; sleep 30; fi
  printf '#!/usr/bin/env bash\\nexit 0\\n' >"$dest/bin/python"
  printf '#!/usr/bin/env bash\\nexit 0\\n' >"$dest/bin/uvicorn"
  chmod 0755 "$dest/bin/python" "$dest/bin/uvicorn"
  exit 0
fi
exec /usr/bin/python3 -I "$@"
"""
MOCK_GUARD = """#!/usr/bin/env python3
import hashlib, json, os, pathlib, shutil, sys, zipfile
cmd = sys.argv[1]
if os.environ.get('GUARD_PROBE_LOG'):
    with open(os.environ['GUARD_PROBE_LOG'], 'a') as probe:
        probe.write(json.dumps([cmd, os.getcwd(), sys.flags.isolated, 'PYTHONPATH' in os.environ]) + '\\n')
if cmd == 'suite-version':
    digest = hashlib.sha256()
    for name, raw in zip(('cwscx_mystery_public_deploy_entrypoint.sh', 'install_mystery_public_bundle.sh', 'mystery_public_release_guard.py'), sys.argv[2:]):
        data = pathlib.Path(raw).read_bytes()
        digest.update(name.encode('utf-8') + b'\\0' + len(data).to_bytes(8, 'big') + data)
    print(digest.hexdigest())
elif cmd == 'authorize-operation':
    print(pathlib.Path(sys.argv[2]).read_text(), end='')
elif cmd == 'verify-bundle':
    # Faithful to the real guard: checksum, signature presence, manifest read from the bundle itself.
    bundle, digest, signature = pathlib.Path(sys.argv[2]), sys.argv[3], pathlib.Path(sys.argv[4])
    if hashlib.sha256(bundle.read_bytes()).hexdigest() != digest or not signature.is_file():
        raise SystemExit(1)
    manifest = json.loads(zipfile.ZipFile(bundle).read('release/release-manifest.json'))
    manifest['bundle_sha256'] = digest
    print(json.dumps(manifest))
elif cmd == 'verify-installed':
    installed, root, rid = sys.argv[2:5]
    ok = (pathlib.Path(root) / rid / 'metadata.json').is_file() and (pathlib.Path(installed) / 'backend/venv/bin/uvicorn').exists()
    raise SystemExit(0 if ok else 1)
elif cmd == 'verify-archive':
    path = pathlib.Path(sys.argv[2]) / sys.argv[3] / 'bundle.zip.sha256'
    if not path.is_file(): raise SystemExit(1)
    print(json.dumps({'bundle_sha256': path.read_text().split()[0]}))
elif cmd == 'verify-installed-bundle':
    # Like the real guard this inspects installed files against the bundle; it can still be
    # satisfied by a tree whose venv build was interrupted, which is why completion is flagged.
    installed, bundle, rid = sys.argv[2:5]
    ok = pathlib.Path(installed).name == rid and pathlib.Path(bundle).is_file() \\
        and (pathlib.Path(installed) / 'backend/venv/bin/uvicorn').exists()
    raise SystemExit(0 if ok else 1)
elif cmd == 'check-db-heads':
    pass
elif cmd == 'store-archive':
    root = pathlib.Path(sys.argv[2]); data = json.load(open(sys.argv[5])); rid = data['release_id']
    release = root / rid; release.mkdir()
    shutil.copyfile(sys.argv[3], release / 'bundle.zip'); shutil.copyfile(sys.argv[4], release / 'bundle.zip.sig')
    (release / 'bundle.zip.sha256').write_text(data['bundle_sha256'] + '  bundle.zip\\n')
    (release / 'metadata.json').write_text(json.dumps({'status': 'deploy_verified'}))
else:
    raise SystemExit('unexpected guard command: ' + cmd)
"""
RELEASE_SCRIPTS = {
    "deploy_mystery_public_backend.sh": "#!/usr/bin/env bash\nexit 0\n",
    "deploy_mystery_public_nginx.sh": "#!/usr/bin/env bash\nexit 0\n",
    "verify_mystery_public.sh": "#!/usr/bin/env bash\n"
    "printf '%s\\n' '{\"summary\":{\"total\":1,\"failed\":0}}' >\"$EVIDENCE_FILE\"\n",
}


class EntrypointHarness(unittest.TestCase):
    """Disposable entrypoint/installer sandbox shared by several suites; defines no tests itself."""

    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.sb = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        self.target = self.sb / "target"
        self.releases = self.target / "releases"
        self.state = self.sb / "state"
        self.archives = self.state / "application-archives"
        self.counter = 0
        for directory, mode in ((self.target, 0o755), (self.releases, 0o755), (self.state, 0o755),
                                (self.state / "deploy-evidence", 0o755), (self.state / "incoming", 0o700),
                                (self.archives, 0o700), (self.state / "operation-nonces", 0o700)):
            directory.mkdir(parents=True, exist_ok=True)
            directory.chmod(mode)
        (self.target / ".env").write_text("DATABASE_URL=redacted\n", encoding="utf-8")
        (self.target / ".env").chmod(0o600)
        self.make_installed_release(ORIGIN)
        self.archive(ORIGIN, "b" * 64)
        (self.target / "current").symlink_to(f"releases/{ORIGIN}")

        mock_bin = self.sb / "mock-bin"
        mock_bin.mkdir()
        (mock_bin / "python3").write_text(MOCK_PYTHON, encoding="utf-8")
        (mock_bin / "runuser").write_text(
            '#!/usr/bin/env bash\nwhile [[ $# -gt 0 && "$1" != "--" ]]; do shift; done\nshift\nexec "$@"\n', encoding="utf-8")
        for name in ("chgrp", "nginx"):
            (mock_bin / name).write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
        # Readiness probe: set MOCK_CURL_FAIL to make the loopback health check fail.
        (mock_bin / "curl").write_text('#!/usr/bin/env bash\n[[ -z "${MOCK_CURL_FAIL:-}" ]]\n', encoding="utf-8")
        # `systemctl show` answers describe the legacy origin unit that baseline preflights.
        origin_release = self.releases / ORIGIN
        (mock_bin / "systemctl").write_text(
            "#!/usr/bin/env bash\n"
            'if [[ "$1" == show ]]; then\n'
            '  case "$3" in\n'
            "    --property=User) echo cxadmin ;;\n"
            "    --property=Group) echo www-data ;;\n"
            f"    --property=WorkingDirectory) echo '{origin_release / 'backend'}' ;;\n"
            f"    --property=ExecStart) echo '{{ path={origin_release / 'backend/venv/bin/uvicorn'} ; argv[]=uvicorn ; }}' ;;\n"
            f"    --property=EnvironmentFiles) echo '{self.target / '.env'} (ignore_errors=no)' ;;\n"
            "  esac\n"
            "fi\n"
            "exit 0\n", encoding="utf-8")
        for path in mock_bin.iterdir():
            path.chmod(0o755)
        self.mock_bin = mock_bin

        config = self.sb / "system-config"
        config.mkdir()
        paths = {key: config / key for key in ("service", "site", "link", "limits", "headers")}
        for path in paths.values():
            path.write_text("config\n", encoding="utf-8")
            path.chmod(0o600)

        guard = self.sb / "guard.py"
        guard.write_text(MOCK_GUARD, encoding="utf-8")
        guard.chmod(0o700)
        allowed = self.sb / "allowed-signers"
        allowed.write_text("test\n", encoding="utf-8")
        allowed.chmod(0o600)

        text = ENTRYPOINT_SOURCE.read_text(encoding="utf-8")
        replacements = {
            'readonly TARGET_ROOT="/opt/cwscx-mystery-public"': f'readonly TARGET_ROOT="{self.target}"',
            'readonly STATE_ROOT="/var/lib/cwscx-mystery-public"': f'readonly STATE_ROOT="{self.state}"',
            'readonly ENTRYPOINT_PATH="/usr/local/sbin/cwscx-mystery-public-deploy"': f'readonly ENTRYPOINT_PATH="{self.sb / "entrypoint.sh"}"',
            'readonly INSTALLER="/usr/local/libexec/cwscx-mystery-public/install_mystery_public_bundle.sh"': f'readonly INSTALLER="{INSTALLER_SOURCE}"',
            'readonly RELEASE_GUARD="/usr/local/libexec/cwscx-mystery-public/mystery_public_release_guard.py"': f'readonly RELEASE_GUARD="{guard}"',
            'readonly PRIVILEGED_SUITE_VERSION_FILE="/usr/local/libexec/cwscx-mystery-public/privileged-suite-version"': f'readonly PRIVILEGED_SUITE_VERSION_FILE="{self.sb / "suite-version"}"',
            'readonly ALLOWED_SIGNERS="/etc/cwscx-mystery-public/release-allowed-signers"': f'readonly ALLOWED_SIGNERS="{allowed}"',
            'readonly SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"': f'readonly SERVICE_FILE="{paths["service"]}"',
            'readonly NGINX_SITE_FILE="/etc/nginx/sites-available/cwscx-mystery-public"': f'readonly NGINX_SITE_FILE="{paths["site"]}"',
            'readonly NGINX_LINK_FILE="/etc/nginx/sites-enabled/cwscx-mystery-public"': f'readonly NGINX_LINK_FILE="{paths["link"]}"',
            'readonly NGINX_LIMIT_FILE="/etc/nginx/conf.d/cwscx-mystery-public-limits.conf"': f'readonly NGINX_LIMIT_FILE="{paths["limits"]}"',
            'readonly NGINX_HEADERS_FILE="/etc/nginx/snippets/cwscx-mystery-public-security-headers.conf"': f'readonly NGINX_HEADERS_FILE="{paths["headers"]}"',
            'PATH=/usr/sbin:/usr/bin:/sbin:/bin': f'PATH="{mock_bin}:/usr/sbin:/usr/bin:/sbin:/bin"',
            'readonly MIN_FREE_BYTES=10737418240': 'readonly MIN_FREE_BYTES=0',
            'readonly HEALTH_PROBE_ATTEMPTS=30': 'readonly HEALTH_PROBE_ATTEMPTS=1',
            '[[ "${EUID}" -eq 0 ]] || die "must run as root (invoke via sudo)"': ': # root check replaced only in disposable test harness',
            '== "root"': f'== "{getpass.getuser()}"',
            'install -o root -g root -m 0600 --': 'install -m 0600 --',
            "'^/tmp/": "'^" + re.escape(str(self.sb)) + "/",
        }
        for old, new in replacements.items():
            self.assertIn(old, text)
            text = text.replace(old, new)
        self.entrypoint = self.sb / "entrypoint.sh"
        self.entrypoint.write_text(text, encoding="utf-8")
        self.entrypoint.chmod(0o700)
        (self.sb / "suite-version").write_text(
            release_guard.privileged_suite_version([self.entrypoint, INSTALLER_SOURCE, guard]) + "\n", encoding="ascii")
        (self.sb / "suite-version").chmod(0o600)
        self.marker = self.state / "preactivation-candidate.json"

    # -- fixtures ---------------------------------------------------------
    def make_installed_release(self, release_id: str) -> Path:
        release = self.releases / release_id
        (release / "backend/venv/bin").mkdir(parents=True)
        (release / "scripts/linux").mkdir(parents=True)
        # Same fields `status` reads from the live release manifest.
        (release / "release-manifest.json").write_text(
            json.dumps({"release_id": release_id, "git_sha": "1" * 40}), encoding="utf-8")
        for name in ("python", "uvicorn"):
            (release / "backend/venv/bin" / name).write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
            (release / "backend/venv/bin" / name).chmod(0o755)
        for name, body in RELEASE_SCRIPTS.items():
            (release / "scripts/linux" / name).write_text(body, encoding="utf-8")
        return release

    def archive(self, release_id: str, digest: str, bundle: Path | None = None) -> None:
        directory = self.archives / release_id
        directory.mkdir()
        (directory / "metadata.json").write_text(json.dumps({"status": "deploy_verified"}), encoding="utf-8")
        (directory / "bundle.zip.sha256").write_text(f"{digest}  bundle.zip\n", encoding="utf-8")
        if bundle is not None:
            shutil.copyfile(bundle, directory / "bundle.zip")

    def make_bundle(self, release_id: str) -> Path:
        files = {
            "release-manifest.json": json.dumps({
                "schema_version": 1, "release_id": release_id, "git_sha": "2" * 40,
                "build_timestamp_utc": "2026-10-13T00:00:00Z", "frontend_auth_mode": "mystery_public",
                "expected_migration_heads": ["20260714_000032"], "python_wheelhouse": True}),
            "backend/requirements.txt": "",
            "backend/app.py": "SAFE = True\n",
            "wheelhouse/placeholder.txt": "wheel\n",
            "frontends/public/mystery-shopper/dist/index.html": "ok",
            **{f"scripts/linux/{name}": body for name, body in RELEASE_SCRIPTS.items()},
        }
        sums = "".join(f"{hashlib.sha256(body.encode()).hexdigest()}  {name}\n" for name, body in sorted(files.items()))
        bundle = self.sb / f"master-{release_id}.zip"
        with zipfile.ZipFile(bundle, "w") as archive:
            for name, body in {**files, "SHA256SUMS": sums}.items():
                archive.writestr(f"release/{name}", body)
        return bundle

    def sha(self, path: Path) -> str:
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def write_marker(self, release_id: str, *, origin: str = ORIGIN, operation: str = "deploy",
                     digest: str = "a" * 64, mode: int = 0o600, extra: dict | None = None) -> None:
        data = {"schema_version": 1, "operation": operation, "release_id": release_id,
                "bundle_sha256": digest, "origin_release_id": origin, **(extra or {})}
        self.marker.write_text(json.dumps(data, sort_keys=True) + "\n", encoding="utf-8")
        self.marker.chmod(mode)

    def environment(self, **extra: str) -> dict[str, str]:
        return {**os.environ, "SUDO_USER": getpass.getuser(), "INTERRUPT_MARKER": "", **extra}

    def signed_args(self, action: str, target: str, digest: str, *, bundle: Path | None = None) -> list[str]:
        self.counter += 1
        operation = self.sb / f"op{self.counter}.json"
        operation.write_text(json.dumps({
            "action": action, "target_release_id": target, "bundle_sha256": digest,
            "current_release_id": ORIGIN, "base_url": "https://mystery.internal", "tls_mode": "prepublic"}), encoding="utf-8")
        signature = self.sb / f"op{self.counter}.json.sig"
        signature.write_text("sig\n", encoding="utf-8")
        args = ["--operation-path", str(operation), "--operation-signature-path", str(signature)]
        for path in (operation, signature):
            path.chmod(0o600)
        if bundle is not None:
            copy = self.sb / f"bundle{self.counter}.zip"
            shutil.copyfile(bundle, copy)
            (self.sb / f"bundle{self.counter}.zip.sig").write_text("sig\n", encoding="utf-8")
            for path in (copy, self.sb / f"bundle{self.counter}.zip.sig"):
                path.chmod(0o600)
            args += ["--bundle-path", str(copy), "--bundle-signature-path", f"{copy}.sig"]
        return args

    def run_entrypoint(self, args: list[str], **extra: str) -> subprocess.CompletedProcess:
        return subprocess.run(["bash", str(self.entrypoint), *args], env=self.environment(**extra),
                              text=True, capture_output=True, check=False)

    def run_and_sigkill(self, command: list[str], env: dict[str, str]) -> None:
        reached = self.sb / f"reached-venv-{self.counter}"
        env = {**env, "INTERRUPT_MARKER": str(reached)}
        process = subprocess.Popen(command, env=env, text=True, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, start_new_session=True)
        deadline = time.monotonic() + 15
        while not reached.exists() and process.poll() is None and time.monotonic() < deadline:
            time.sleep(0.05)
        self.assertTrue(reached.exists(), "process never reached virtualenv creation")
        os.killpg(process.pid, signal.SIGKILL)
        stdout, stderr = process.communicate(timeout=10)
        self.assertEqual(process.returncode, -signal.SIGKILL, stdout + stderr)

    def kill_entrypoint(self, args: list[str]) -> None:
        self.run_and_sigkill(["bash", str(self.entrypoint), *args], self.environment())

    def recover(self, digest: str, target: str = ORIGIN) -> subprocess.CompletedProcess:
        return self.run_entrypoint(self.signed_args("recover", target, digest))

    def status(self) -> dict:
        result = self.run_entrypoint(["--action", "status"])
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def assert_current_origin_intact(self) -> None:
        self.assertEqual(os.readlink(self.target / "current"), f"releases/{ORIGIN}")
        self.assertTrue((self.releases / ORIGIN / "backend/venv/bin/uvicorn").exists())



class PreactivationSigkillTests(EntrypointHarness):
    # -- tests ------------------------------------------------------------
    def test_installer_sigkill_skips_exit_trap_and_leaves_final_candidate(self) -> None:
        bundle = self.make_bundle("new-release")
        env = {**self.environment(), "TARGET_ROOT": str(self.target), "PATH": f"{self.mock_bin}:{os.environ['PATH']}",
               "EXPECTED_BUNDLE_SHA256": self.sha(bundle)}
        self.run_and_sigkill(["bash", str(INSTALLER_SOURCE), "--install-only", str(bundle)], env)
        candidate = self.releases / "new-release"
        # The exact interruption defect: published final immutable path, no torn-venv cleanup.
        self.assertTrue(candidate.is_dir())
        self.assertFalse((candidate / "backend/venv/bin/uvicorn").exists())
        self.assert_current_origin_intact()

    def test_deploy_sigkill_marker_enables_signed_recover_and_preserves_everything_else(self) -> None:
        bundle = self.make_bundle("new-release")
        digest = self.sha(bundle)
        unmarked = self.make_installed_release("unmarked-release")
        self.kill_entrypoint(self.signed_args("deploy", "new-release", digest, bundle=bundle))
        self.assertTrue((self.releases / "new-release").is_dir())
        self.assertFalse((self.state / "active-operation.json").exists())
        self.assertEqual(self.marker.stat().st_mode & 0o777, 0o600)
        before = (self.marker.read_bytes(), sorted(p.name for p in self.releases.iterdir()))

        pending = self.status()["pending_operation"]
        self.assertTrue(self.status()["recovery_required"])
        self.assertEqual((pending["mode"], pending["failed_release_id"], pending["original_release_id"],
                          pending["recovery_authorization_sha256"]), ("preactivation", "new-release", ORIGIN, digest))
        self.assertEqual(before, (self.marker.read_bytes(), sorted(p.name for p in self.releases.iterdir())),
                         "read-only status mutated preactivation state")

        # Mutating operations are refused until an explicit signed recover.
        refused = self.run_entrypoint(self.signed_args("deploy", "new-release", digest, bundle=bundle))
        self.assertNotEqual(refused.returncode, 0)
        self.assertIn("requires an explicit signed recover", refused.stderr)
        wrong_digest = self.recover("c" * 64)
        self.assertNotEqual(wrong_digest.returncode, 0)
        self.assertTrue((self.releases / "new-release").is_dir())

        result = self.recover(digest)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.releases / "new-release").exists())
        self.assertFalse(self.marker.exists())
        self.assert_current_origin_intact()
        self.assertTrue(unmarked.is_dir())
        self.assertTrue((self.state / "deploy-evidence/recovery-new-release.json").is_file())
        repeat = self.recover(digest)
        self.assertNotEqual(repeat.returncode, 0)
        self.assertIn("no interrupted operation requires recovery", repeat.stderr)
        self.assert_current_origin_intact()

    def test_rollback_restore_sigkill_recovers_then_fixed_archive_id_reinstalls(self) -> None:
        bundle = self.make_bundle("target-release")
        digest = self.sha(bundle)
        self.archive("target-release", digest, bundle)
        self.kill_entrypoint(self.signed_args("rollback", "target-release", digest))
        candidate = self.releases / "target-release"
        self.assertTrue(candidate.is_dir(), "SIGKILL should leave the torn restored candidate")
        self.assertTrue(self.marker.is_file())
        self.assert_current_origin_intact()

        refused = self.run_entrypoint(self.signed_args("rollback", "target-release", digest))
        self.assertNotEqual(refused.returncode, 0)
        self.assertTrue(candidate.is_dir())

        saved = self.marker.read_bytes()
        self.marker.chmod(0o644)  # tampered permissions are rejected, nothing is deleted
        tampered = self.recover(digest)
        self.assertNotEqual(tampered.returncode, 0)
        self.assertIn("preactivation marker is invalid", tampered.stderr)
        self.assertTrue(candidate.is_dir())
        self.marker.chmod(0o600)
        self.assertEqual(saved, self.marker.read_bytes())

        self.assertEqual(self.recover(digest).returncode, 0)
        self.assertFalse(candidate.exists())
        self.assertFalse(self.marker.exists())
        self.assert_current_origin_intact()
        self.assertTrue((self.archives / "target-release/bundle.zip").is_file())

        retry = self.run_entrypoint(self.signed_args("rollback", "target-release", digest))
        self.assertEqual(retry.returncode, 0, retry.stderr)
        self.assertEqual(os.readlink(self.target / "current"), "releases/target-release")
        self.assertFalse(self.marker.exists())

    def test_tampered_markers_are_rejected_without_deleting_anything(self) -> None:
        candidate = self.make_installed_release("marked-release")
        (candidate / "backend/venv/bin/uvicorn").unlink()  # would be deletable if the marker were trusted
        cases = {
            "group-readable mode": dict(mode=0o640),
            "extra key": dict(extra={"path": "/etc"}),
            "path traversal id": dict(release_id="../origin"),
            "bad digest": dict(digest="XYZ"),
            "unknown operation": dict(operation="rm-rf"),
            "bundle path without signature path": dict(extra={"bundle_path": "/var/x/bundle.AbC123.zip"}),
            "bundle path traversal": dict(extra={"bundle_path": "/var/../etc/bundle.zip", "signature_path": "/var/x/bundle.zip.sig"}),
            "relative bundle path": dict(extra={"bundle_path": "bundle.zip", "signature_path": "bundle.zip.sig"}),
            "false completion claim": dict(extra={"install_verified": False}),
            "string completion claim": dict(extra={"install_verified": "true"}),
        }
        for label, options in cases.items():
            with self.subTest(label):
                self.write_marker(options.pop("release_id", "marked-release"), **options)
                result = self.recover("a" * 64)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("preactivation marker is invalid", result.stderr)
                self.assertTrue(candidate.is_dir())
                self.assertTrue(self.marker.exists())
                self.assert_current_origin_intact()
        with self.subTest("symlink marker"):
            self.marker.unlink()
            real = self.sb / "real-marker.json"
            real.write_text("{}", encoding="utf-8")
            self.marker.symlink_to(real)
            result = self.recover("a" * 64)
            self.assertNotEqual(result.returncode, 0)
            self.assertTrue(candidate.is_dir())

    def test_recover_never_deletes_current_completed_unmarked_or_mismatched_releases(self) -> None:
        with self.subTest("current release"):
            self.write_marker(ORIGIN)
            self.assertEqual(self.recover("a" * 64).returncode, 0)
            self.assertFalse(self.marker.exists())
            self.assert_current_origin_intact()

        with self.subTest("completed signed-archived candidate"):
            completed = self.make_installed_release("completed-release")
            self.archive("completed-release", "d" * 64)
            self.write_marker("completed-release")
            self.assertEqual(self.recover("a" * 64).returncode, 0)
            self.assertTrue(completed.is_dir())
            self.assertFalse(self.marker.exists())

        with self.subTest("marker names absent release; unmarked sibling untouched, own leftovers removed"):
            unmarked = self.make_installed_release("unmarked-release")
            leftover = self.releases / ".ghost-release.incoming.abc123"
            other_leftover = self.releases / ".other-release.incoming.abc123"
            leftover.mkdir(); other_leftover.mkdir()
            self.write_marker("ghost-release")
            self.assertEqual(self.recover("a" * 64).returncode, 0)
            self.assertTrue(unmarked.is_dir())
            self.assertFalse(leftover.exists())
            self.assertTrue(other_leftover.is_dir())

        with self.subTest("directory whose manifest names another release"):
            mismatched = self.make_installed_release("mismatch-release")
            (mismatched / "release-manifest.json").write_text(json.dumps({"release_id": "someone-else"}), encoding="utf-8")
            (mismatched / "backend/venv/bin/uvicorn").unlink()
            self.write_marker("mismatch-release")
            result = self.recover("a" * 64)
            self.assertNotEqual(result.returncode, 0)
            self.assertTrue(mismatched.is_dir())
            self.assertTrue(self.marker.exists())

        with self.subTest("marker origin that is not live current"):
            stray = self.make_installed_release("stray-release")
            (stray / "backend/venv/bin/uvicorn").unlink()
            self.write_marker("stray-release", origin="some-other-origin")
            result = self.recover("a" * 64, target="some-other-origin")
            self.assertNotEqual(result.returncode, 0)
            self.assertTrue(stray.is_dir())
        self.assert_current_origin_intact()

    # -- completed-but-unarchived candidates ------------------------------
    def stage_completed_candidate(self, release_id: str = "done-release") -> tuple[Path, str, dict]:
        """A fully installed signed NEW candidate that was never archived, with its retained artifacts."""
        bundle = self.make_bundle(release_id)
        incoming = self.state / "incoming"
        staged, signature = incoming / "bundle.AbC123.zip", incoming / "bundle.AbC123.zip.sig"
        shutil.copyfile(bundle, staged)
        signature.write_text("sig\n", encoding="utf-8")
        for path in (staged, signature):
            path.chmod(0o600)
        candidate = self.make_installed_release(release_id)
        self.assertFalse((self.archives / release_id).exists(), "fixture must not be archived")
        claim = {"bundle_path": str(staged), "signature_path": str(signature), "install_verified": True}
        return candidate, self.sha(bundle), claim

    def test_completed_unarchived_candidate_is_preserved_after_kill(self) -> None:
        candidate, digest, claim = self.stage_completed_candidate()
        self.write_marker("done-release", digest=digest, extra=claim)
        self.assertEqual(self.status()["pending_operation"]["failed_release_id"], "done-release")
        result = self.recover(digest)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((candidate / "backend/venv/bin/uvicorn").is_file(), "complete candidate must survive")
        self.assertFalse(self.marker.exists())
        self.assertFalse(Path(claim["bundle_path"]).exists(), "retained artifacts are dropped with the marker")
        self.assertFalse(Path(claim["signature_path"]).exists())
        self.assertTrue((self.state / "deploy-evidence/recovery-done-release.json").is_file())
        self.assert_current_origin_intact()

    def test_claimed_complete_candidate_that_cannot_be_reproven_fails_closed(self) -> None:
        candidate, digest, claim = self.stage_completed_candidate()
        other_bundle = self.make_bundle("someone-else")
        outside = self.sb / "bundle.AbC123.zip"
        shutil.copyfile(self.sb / "master-done-release.zip", outside)
        link = self.state / "incoming/bundle.LnK123.zip"
        link.symlink_to(claim["bundle_path"])
        (self.state / "incoming/bundle.LnK123.zip.sig").write_text("sig\n", encoding="utf-8")
        (self.state / "incoming/bundle.LnK123.zip.sig").chmod(0o600)
        cases = {
            "retained bundle removed": lambda: Path(claim["bundle_path"]).unlink(),
            "retained signature removed": lambda: Path(claim["signature_path"]).unlink(),
            "bundle bytes changed": lambda: shutil.copyfile(other_bundle, claim["bundle_path"]),
            "bundle names another release": None,
            "artifact outside incoming": None,
            "artifact is a symlink": None,
            "installed tree incomplete": lambda: (candidate / "backend/venv/bin/uvicorn").unlink(),
            "venv python missing": lambda: (candidate / "backend/venv/bin/python").unlink(),
        }
        pristine = Path(claim["bundle_path"]).read_bytes()
        for label, damage in cases.items():
            with self.subTest(label):
                self.restore_completed_candidate(candidate, claim, pristine)
                options = dict(claim)
                marker_digest = digest
                if label == "bundle names another release":
                    # Checksum and signature are consistent with the marker, but the signed identity differs.
                    marker_digest = self.sha(other_bundle)
                    shutil.copyfile(other_bundle, claim["bundle_path"])
                    self.write_marker("done-release", digest=marker_digest, extra=options)
                else:
                    if label == "artifact outside incoming":
                        options["bundle_path"] = str(outside)
                        options["signature_path"] = f"{outside}.sig"
                        Path(options["signature_path"]).write_text("sig\n", encoding="utf-8")
                        Path(options["signature_path"]).chmod(0o600)
                    elif label == "artifact is a symlink":
                        options["bundle_path"] = str(link)
                        options["signature_path"] = f"{link}.sig"
                    elif damage is not None:
                        damage()
                    self.write_marker("done-release", digest=digest, extra=options)
                result = self.recover(marker_digest)
                self.assertNotEqual(result.returncode, 0, result.stdout)
                self.assertIn("cannot be re-proven", result.stderr)
                self.assertTrue(candidate.is_dir(), "ambiguous state must never be deleted")
                self.assertTrue(self.marker.exists())
                self.assert_current_origin_intact()

    def restore_completed_candidate(self, candidate: Path, claim: dict, bundle_bytes: bytes) -> None:
        """Restore the pristine complete candidate and retained artifacts between sub-cases."""
        Path(claim["bundle_path"]).write_bytes(bundle_bytes)
        Path(claim["signature_path"]).write_text("sig\n", encoding="utf-8")
        for path in (Path(claim["bundle_path"]), Path(claim["signature_path"])):
            path.chmod(0o600)
        for name in ("python", "uvicorn"):
            target = candidate / "backend/venv/bin" / name
            target.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
            target.chmod(0o755)

    def test_unflagged_rollback_candidate_is_replaced_even_if_archive_verifies(self) -> None:
        # File verification cannot prove a locally built venv, and the signed archive can recreate it.
        candidate = self.make_installed_release("target-release")
        self.archive("target-release", "d" * 64)
        self.write_marker("target-release", operation="rollback")
        result = self.recover("a" * 64)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(candidate.exists())
        self.assertTrue((self.archives / "target-release/metadata.json").is_file())

    def test_journal_and_marker_coexisting_keep_journal_semantics(self) -> None:
        candidate, digest, claim = self.stage_completed_candidate()
        self.write_marker("done-release", digest=digest, extra=claim)
        journal = self.state / "active-operation.json"
        journal.write_text(json.dumps({
            "schema_version": 1, "mode": "signed-new", "original_release_id": ORIGIN,
            "failed_release_id": "done-release", "recovery_authorization_sha256": "b" * 64}, sort_keys=True) + "\n",
            encoding="utf-8")
        journal.chmod(0o600)
        # The journal's own authorization (the origin archive) governs recovery, not the marker's bundle.
        wrong = self.recover(digest)
        self.assertNotEqual(wrong.returncode, 0)
        self.assertTrue(journal.exists() and self.marker.exists() and candidate.is_dir())
        result = self.recover("b" * 64)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(journal.exists())
        self.assertFalse(self.marker.exists())
        self.assertTrue(candidate.is_dir(), "journal recovery never removed the failed release; neither may the marker")
        self.assertTrue((self.state / "deploy-evidence/recovery-done-release.json").is_file())
        self.assert_current_origin_intact()

    # -- unauthenticated (pre-baseline) origin ---------------------------
    def make_origin_unauthenticated(self) -> None:
        shutil.rmtree(self.archives / ORIGIN)

    def final_recover(self, after: dict, evidence: Path, *, failed: str, origin: str = ORIGIN, mode: str | None = "preactivation",
                      digest: str | None = None, expected: str = ORIGIN) -> subprocess.CompletedProcess:
        state = self.sb / "after.json"
        state.write_text(json.dumps(after), encoding="utf-8")
        command = [sys.executable, "-I", str(HELPER), "final-recover", str(state), expected, str(evidence),
                   after["privileged_suite_version"], failed, origin]
        if mode is not None:
            command += [mode, digest or ""]
        return subprocess.run(command, capture_output=True, text=True, check=False)

    def test_baseline_sigkill_recovers_with_truthful_unauthenticated_evidence(self) -> None:
        self.make_origin_unauthenticated()
        bundle = self.make_bundle("new-release")
        digest = self.sha(bundle)
        self.kill_entrypoint(self.signed_args("establish_baseline", "new-release", digest, bundle=bundle))
        candidate = self.releases / "new-release"
        self.assertTrue(candidate.is_dir())
        marker = json.loads(self.marker.read_text(encoding="utf-8"))
        self.assertEqual(marker["operation"], "establish_baseline")
        self.assertTrue(Path(marker["bundle_path"]).is_file(), "SIGKILL leaves the staged signed bundle for re-proof")
        self.assertNotIn("install_verified", marker, "killed mid-venv: completion was never claimed")
        before = self.status()
        self.assertFalse(before["signed_archive_verified"])
        self.assertEqual(before["pending_operation"]["mode"], "preactivation")

        # A failing readiness probe keeps the marker so recover can be repeated; nothing is invented.
        evidence = self.state / "deploy-evidence/recovery-new-release.json"
        probe_failed = self.run_entrypoint(self.signed_args("recover", ORIGIN, digest), MOCK_CURL_FAIL="1")
        self.assertNotEqual(probe_failed.returncode, 0)
        self.assertTrue(self.marker.exists())
        self.assertFalse(evidence.exists())
        self.assert_current_origin_intact()

        result = self.recover(digest)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(candidate.exists())
        self.assertFalse(self.marker.exists())
        self.assert_current_origin_intact()
        record = json.loads(evidence.read_text(encoding="utf-8"))
        self.assertEqual(record["recovery"], "preactivation_cleanup_unauthenticated_origin")
        self.assertEqual((record["failed_release_id"], record["origin_release_id"], record["authorization_sha256"]),
                         ("new-release", ORIGIN, digest))
        self.assertEqual(record["candidate_disposition"], "absent")  # removed by the earlier, probe-failed attempt
        for claim in ("switch_occurred", "config_restored", "origin_authenticated", "approved_fallback"):
            self.assertIs(record[claim], False, claim)
        self.assertNotIn("fixed_config_snapshot", json.dumps(record))

        after = self.status()
        self.assertFalse(after["recovery_required"])
        self.assertFalse(after["signed_archive_verified"])
        self.assertFalse(after["baseline_established"])
        accepted = self.final_recover(after, evidence, failed="new-release", digest=digest)
        self.assertEqual(accepted.returncode, 0, accepted.stderr)

        # Malformed, stale, wrong-identity and wrong-mode evidence is refused by the runner gate.
        stale = {**record, "generated_at_utc": "2026-01-01T00:00:00Z"}
        cases = {
            "stale": (stale, dict(failed="new-release", digest=digest)),
            "claims config restore": ({**record, "config_restored": True}, dict(failed="new-release", digest=digest)),
            "extra field": ({**record, "approved_fallback_note": "x"}, dict(failed="new-release", digest=digest)),
            "wrong failed release": (record, dict(failed="other-release", digest=digest)),
            "wrong origin": (record, dict(failed="new-release", origin="other-origin", expected="other-origin")),
            "wrong checksum": (record, dict(failed="new-release", digest="c" * 64)),
            "mode omitted": (record, dict(failed="new-release", mode=None)),
            "other mode": (record, dict(failed="new-release", mode="baseline-origin", digest=digest)),
        }
        for label, (data, options) in cases.items():
            with self.subTest(label):
                forged = self.sb / "forged.json"
                forged.write_text(json.dumps(data), encoding="utf-8")
                refused = self.final_recover(after, forged, **options)
                self.assertNotEqual(refused.returncode, 0, refused.stdout)

    def test_baseline_candidate_preserved_when_install_completed_before_kill(self) -> None:
        self.make_origin_unauthenticated()
        candidate, digest, claim = self.stage_completed_candidate()
        self.write_marker("done-release", operation="establish_baseline", digest=digest, extra=claim)
        result = self.recover(digest)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(candidate.is_dir())
        record = json.loads((self.state / "deploy-evidence/recovery-done-release.json").read_text(encoding="utf-8"))
        self.assertEqual(record["candidate_disposition"], "preserved_complete")
        self.assertIs(record["switch_occurred"], False)
        accepted = self.final_recover(self.status(), self.state / "deploy-evidence/recovery-done-release.json",
                                      failed="done-release", digest=digest)
        self.assertEqual(accepted.returncode, 0, accepted.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
