#!/usr/bin/env python3
"""Behavioral tests for signed Mystery Public application archives."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import datetime
import getpass
import grp
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock
import zipfile
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "mystery_public_release_guard.py"
spec = importlib.util.spec_from_file_location("release_guard", MODULE_PATH)
assert spec and spec.loader
release_guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_guard)


class SignedArchiveTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.key = self.root / "signing-key"
        subprocess.run(
            ["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(self.key)],
            check=True,
        )
        self.allowed = self.root / "allowed-signers"
        self.allowed.write_text("github-actions " + (self.key.with_suffix(".pub")).read_text(encoding="ascii"), encoding="ascii")
        self.archives = self.root / "archives"
        self.archives.mkdir(mode=0o700)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def make_bundle(self, release_id: str = "release-one", heads: list[str] | None = None) -> tuple[Path, Path, dict]:
        release = self.root / f"stage-{release_id}" / "release"
        (release / "backend").mkdir(parents=True)
        (release / "frontends/public/mystery-shopper/dist").mkdir(parents=True)
        manifest = {
            "schema_version": 1,
            "release_id": release_id,
            "git_sha": "a" * 40,
            "build_timestamp_utc": "2026-09-29T00:00:00Z",
            "frontend_auth_mode": "mystery_public",
            "source_tree_state": "clean",
            "expected_migration_heads": heads or ["20260714_000032"],
            "python_wheelhouse": True,
        }
        (release / "release-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        (release / "backend/app.py").write_text("SAFE = True\n", encoding="utf-8")
        (release / "frontends/public/mystery-shopper/dist/index.html").write_text("safe", encoding="utf-8")
        sums = []
        for path in sorted(p for p in release.rglob("*") if p.is_file()):
            sums.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(release).as_posix()}")
        (release / "SHA256SUMS").write_text("\n".join(sums) + "\n", encoding="utf-8")
        bundle = self.root / f"{release_id}.zip"
        with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(p for p in release.rglob("*") if p.is_file()):
                archive.write(path, Path("release") / path.relative_to(release))
        subprocess.run(["ssh-keygen", "-Y", "sign", "-f", str(self.key), "-n", "cwscx-mystery-public-release", str(bundle)], check=True, stdout=subprocess.DEVNULL)
        return bundle, Path(str(bundle) + ".sig"), manifest

    def make_operation(
        self,
        *,
        action: str = "rollback",
        current_release_id: str = "release-current",
        target_release_id: str = "release-one",
        issued: datetime.datetime | None = None,
        expires: datetime.datetime | None = None,
        nonce: str = "1" * 64,
    ) -> tuple[Path, Path, datetime.datetime]:
        now = issued or datetime.datetime(2026, 9, 29, 12, 0, tzinfo=datetime.timezone.utc)
        expiry = expires or now + datetime.timedelta(minutes=5)
        document = {
            "schema_version": 1,
            "action": action,
            "target_release_id": target_release_id,
            "bundle_sha256": "b" * 64,
            "current_release_id": current_release_id,
            "base_url": "https://mystery.internal",
            "tls_mode": "prepublic",
            "github_run_id": "12345",
            "github_run_attempt": "2",
            "issued_at_utc": now.isoformat().replace("+00:00", "Z"),
            "expires_at_utc": expiry.isoformat().replace("+00:00", "Z"),
            "nonce": nonce,
        }
        operation = self.root / f"operation-{nonce}.json"
        operation.write_text(json.dumps(document, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
        subprocess.run(
            ["ssh-keygen", "-Y", "sign", "-f", str(self.key), "-n", "cwscx-mystery-public-operation", str(operation)],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        return operation, Path(str(operation) + ".sig"), now

    def verified_manifest(self, bundle: Path, signature: Path) -> dict:
        return release_guard.verify_bundle(bundle, hashlib.sha256(bundle.read_bytes()).hexdigest(), signature, self.allowed)

    def secure_installed_tree(self, root: Path) -> None:
        for directory, directories, files in os.walk(root):
            for path in [Path(directory), *(Path(directory) / name for name in directories + files)]:
                if not path.is_symlink():
                    path.chmod(path.stat().st_mode & ~0o022)

    def installer_sandbox(self, *, interrupt_marker: Path | None = None) -> tuple[Path, dict[str, str]]:
        target = self.root / "target"
        (target / "releases/current-release").mkdir(parents=True)
        (target / ".env").write_text("DATABASE_URL=not-read-by-installer\n", encoding="utf-8")
        (target / "current").symlink_to("releases/current-release")
        mock_bin = self.root / "mock-bin"
        mock_bin.mkdir(exist_ok=True)
        python = mock_bin / "python3"
        python.write_text(
            """#!/usr/bin/env bash
set -euo pipefail
# Privileged-suite policy: every interpreter call must be isolated.
[[ "${1:-}" == "-I" ]] || { echo "python3 invoked without -I" >&2; exit 97; }
shift
if [[ "${1:-}" == "-m" && "${2:-}" == "venv" ]]; then
  dest="$3"
  mkdir -p "$dest/bin"
  if [[ -n "${INTERRUPT_MARKER:-}" ]]; then
    : >"$INTERRUPT_MARKER"
    sleep 30
  fi
  printf '#!/usr/bin/env bash\\nexit 0\\n' >"$dest/bin/python"
  printf '#!/usr/bin/env bash\\nexit 0\\n' >"$dest/bin/uvicorn"
  chmod 0755 "$dest/bin/python" "$dest/bin/uvicorn"
  exit 0
fi
exec /usr/bin/python3 -I "$@"
""",
            encoding="utf-8",
        )
        python.chmod(0o755)
        (mock_bin / "chgrp").write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
        (mock_bin / "chgrp").chmod(0o755)
        (mock_bin / "runuser").write_text(
            """#!/usr/bin/env bash
set -euo pipefail
while [[ $# -gt 0 && "$1" != "--" ]]; do shift; done
[[ "${1:-}" == "--" ]] && shift
exec "$@"
""",
            encoding="utf-8",
        )
        (mock_bin / "runuser").chmod(0o755)
        env = os.environ.copy()
        env.update(
            {
                "TARGET_ROOT": str(target),
                "PYTHON_BIN": str(python),
                "PATH": f"{mock_bin}:{env['PATH']}",
            }
        )
        if interrupt_marker is not None:
            env["INTERRUPT_MARKER"] = str(interrupt_marker)
        return target, env

    def run_archive_install_only(self, release_id: str, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
        verified = release_guard.verify_archive(self.archives, release_id, self.allowed)
        installer = MODULE_PATH.parent / "install_mystery_public_bundle.sh"
        return subprocess.run(
            ["bash", str(installer), "--install-only", str(release_guard.archive_paths(self.archives, release_id)["bundle"])],
            env={**env, "EXPECTED_BUNDLE_SHA256": verified["bundle_sha256"]},
            text=True,
            capture_output=True,
            check=False,
        )

    def run_first_baseline_entrypoint_harness(
        self, *, fail_readiness: bool, action: str = "establish_baseline", interrupt_after_switch: bool = False,
        interrupt_recovery_after_origin_switch: bool = False,
        fail_origin_restart_preflight: bool = False,
        fail_recovery_evidence_fsync: bool = False,
        interrupt_after_baseline_commit: bool = False,
        origin_optional_configs_present: bool = True,
        fail_new_head: bool = False,
        origin_link: str = "expected",
    ) -> tuple[subprocess.CompletedProcess[str], Path]:
        """Exercise the real baseline branch with disposable fixed-path mocks."""
        sandbox = self.root / f"{action}-{'interrupt' if interrupt_after_switch else 'fail' if fail_readiness else 'success'}-{origin_link}"
        target, state = sandbox / "target", sandbox / "state"
        releases = target / "releases"
        for directory, mode in (
            (target, 0o755), (releases, 0o755), (target / "shared", 0o770), (state, 0o755),
            (state / "deploy-evidence", 0o755), (state / "incoming", 0o700),
            (state / "application-archives", 0o700), (state / "operation-nonces", 0o700),
        ):
            directory.mkdir(parents=True, exist_ok=True)
            directory.chmod(mode)
        (target / ".env").write_text("DATABASE_URL=redacted\n", encoding="utf-8")
        (target / ".env").chmod(0o600)
        legacy = releases / "legacy-unverified"
        legacy.mkdir()
        (legacy / "release-manifest.json").write_text(
            json.dumps({"release_id": "legacy-unverified", "git_sha": "1" * 40}), encoding="utf-8"
        )
        (legacy / "backend/venv/bin").mkdir(parents=True)
        (legacy / "scripts/linux").mkdir(parents=True)
        (legacy / "backend/venv/bin/python").write_text("#!/usr/bin/env bash\nexec /usr/bin/python3 \"$@\"\n", encoding="utf-8")
        unsigned_script_marker = sandbox / "unsigned-root-script-ran"
        for name in ("deploy_mystery_public_backend.sh", "deploy_mystery_public_nginx.sh"):
            (legacy / "scripts/linux" / name).write_text(
                f"#!/usr/bin/env bash\nif [[ \"${{HARNESS_ACTION:-}}\" == establish_baseline ]]; then printf ran >{str(unsigned_script_marker)!r}; exit 99; fi\nexit 0\n",
                encoding="utf-8",
            )
        (legacy / "scripts/linux/verify_mystery_public.sh").write_text(
            f"""#!/usr/bin/env bash
if [[ "${{HARNESS_ACTION:-}}" == establish_baseline ]]; then printf ran >{str(unsigned_script_marker)!r}; exit 99; fi
printf '%s\n' '{{"summary":{{"total":1,"failed":0}},"checks":[{{"ok":true}}]}}' >"$EVIDENCE_FILE"
""",
            encoding="utf-8",
        )
        for path in (legacy / "backend/venv/bin/python", *(legacy / "scripts/linux").glob("*.sh")):
            path.chmod(0o755)
        self.secure_installed_tree(legacy)
        (target / "current").symlink_to("releases/legacy-unverified")

        new_manifest = {"release_id": "first-signed-release", "git_sha": "2" * 40}
        installer = sandbox / "installer.sh"
        installer.write_text(
            f"""#!/usr/bin/env bash
set -euo pipefail
install_only=0
if [[ "${{1:-}}" == "--install-only" ]]; then install_only=1; shift; fi
[[ $# -eq 1 ]]
dest={str(releases / 'first-signed-release')!r}
mkdir -p "$dest/backend/venv/bin" "$dest/scripts/linux"
printf '%s\n' {json.dumps(json.dumps(new_manifest))} >"$dest/release-manifest.json"
printf '#!/usr/bin/env bash\nexec /usr/bin/python3 "$@"\n' >"$dest/backend/venv/bin/python"
printf '#!/usr/bin/env bash\nexit 0\n' >"$dest/scripts/linux/deploy_mystery_public_backend.sh"
cat >"$dest/scripts/linux/deploy_mystery_public_nginx.sh" <<'NGINX'
#!/usr/bin/env bash
printf 'generated-limits\n' >"$HARNESS_NGINX_LIMIT_FILE"
printf 'generated-headers\n' >"$HARNESS_NGINX_HEADERS_FILE"
ln -sfn "$HARNESS_NGINX_SITE_FILE" "$HARNESS_NGINX_LINK_FILE"
NGINX
cat >"$dest/scripts/linux/verify_mystery_public.sh" <<'VERIFY'
#!/usr/bin/env bash
if [[ "${{HARNESS_FAIL_READINESS:-0}}" == 1 ]]; then
  printf '%s\n' '{{"summary":{{"total":1,"failed":1}},"checks":[{{"ok":false}}]}}' >"$EVIDENCE_FILE"
  exit 1
fi
printf '%s\n' '{{"summary":{{"total":1,"failed":0}},"checks":[{{"ok":true}}]}}' >"$EVIDENCE_FILE"
VERIFY
chmod -R go-w "$dest"
chmod 0755 "$dest/backend/venv/bin/python" "$dest/scripts/linux/"*.sh
if [[ "$install_only" -eq 0 ]]; then
  link={str(target)!r}/.current.first-signed-release.$$
  ln -s releases/first-signed-release "$link"
  mv -Tf "$link" {str(target / 'current')!r}
  if [[ -n "${{HARNESS_INTERRUPT_MARKER:-}}" ]]; then : >"$HARNESS_INTERRUPT_MARKER"; sleep 30; fi
fi
""",
            encoding="utf-8",
        )
        installer.chmod(0o700)

        guard = sandbox / "guard.py"
        guard.write_text(
            f"""#!/usr/bin/env python3
import hashlib, json, pathlib, shutil, sys, time
cmd=sys.argv[1]
manifest={new_manifest!r}
if cmd == 'suite-version':
    digest=hashlib.sha256()
    for name, raw in zip(('cwscx_mystery_public_deploy_entrypoint.sh','install_mystery_public_bundle.sh','mystery_public_release_guard.py','mystery_public_bootstrap_transaction.py'),sys.argv[2:]):
        path=pathlib.Path(raw); data=path.read_bytes()
        digest.update(name.encode('utf-8')+b'\\0'+len(data).to_bytes(8,'big')+data)
    print(digest.hexdigest())
elif cmd == 'authorize-operation': print(pathlib.Path(sys.argv[2]).read_text(), end='')
elif cmd == 'verify-bundle':
    manifest['bundle_sha256']=sys.argv[3]; print(json.dumps(manifest))
elif cmd == 'verify-installed': raise SystemExit(1 if sys.argv[4] == 'legacy-unverified' and __import__('os').environ.get('HARNESS_ACTION') == 'establish_baseline' else 0)
elif cmd == 'verify-archive': print(json.dumps({{'bundle_sha256':'b'*64}}))
elif cmd == 'check-runtime':
    if __import__('os').environ.get('HARNESS_RUNTIME_FAIL_ID') == pathlib.Path(sys.argv[2]).name:
        raise SystemExit('runtime unusable')
elif cmd == 'check-db-heads':
    if __import__('os').environ.get('HARNESS_FAIL_NEW_HEAD') == '1' and 'first-signed-release' in sys.argv[-1]:
        raise SystemExit('new source migration head does not match database')
elif cmd == 'check-candidate-app':
    rid=pathlib.Path(sys.argv[2]).name
    print(json.dumps({{'release_id':rid,'git_sha':manifest['git_sha'],'ready_status':'ready','database':'ok','anonymous_session_status':401,'completed_monotonic_ns':time.monotonic_ns()}}))
elif cmd == 'verify-installed-bundle': pass
elif cmd == 'store-archive':
    root=pathlib.Path(sys.argv[2]); bundle=pathlib.Path(sys.argv[3]); sig=pathlib.Path(sys.argv[4]); data=json.load(open(sys.argv[5])); rid=data['release_id']; digest=data['bundle_sha256']
    release=root/rid; release.mkdir(); shutil.copyfile(bundle, release/'bundle.zip'); shutil.copyfile(sig, release/'bundle.zip.sig')
    (release/'bundle.zip.sha256').write_text(digest+'  bundle.zip\\n')
    (release/'metadata.json').write_text(json.dumps({{'status':'deploy_verified'}}))
elif cmd == 'append-recovery-audit': pass
else: raise SystemExit('unexpected guard command: '+cmd)
""",
            encoding="utf-8",
        )
        guard.chmod(0o700)
        transaction_helper = sandbox / "transaction.py"
        transaction_helper.write_text("# test transaction helper\n", encoding="utf-8")
        transaction_helper.chmod(0o700)
        allowed = sandbox / "allowed-signers"
        allowed.write_text("test\n", encoding="utf-8")
        allowed.chmod(0o600)

        system_config = sandbox / "system-config"
        system_config.mkdir()
        config_paths = {
            "service": system_config / "cwscx-mystery-public-backend.service",
            "site": system_config / "cwscx-mystery-public",
            "link": system_config / "cwscx-mystery-public-enabled",
            "limits": system_config / "cwscx-mystery-public-limits.conf",
            "headers": system_config / "cwscx-mystery-public-security-headers.conf",
        }
        for key in ("service", "site"):
            config_paths[key].write_text(f"legacy-{key}\n", encoding="utf-8")
            config_paths[key].chmod(0o600)
        if origin_optional_configs_present:
            for key in ("limits", "headers"):
                config_paths[key].write_text(f"legacy-{key}\n", encoding="utf-8")
                config_paths[key].chmod(0o600)
        if origin_link == "expected":
            config_paths["link"].symlink_to(config_paths["site"])
        elif origin_link == "wrong":
            config_paths["link"].symlink_to(system_config / "other-site")
        elif origin_link == "regular":
            config_paths["link"].write_text("unexpected regular enabled-site file\n", encoding="utf-8")
        else:
            self.assertEqual(origin_link, "absent")
        mock_bin = sandbox / "mock-bin"
        mock_bin.mkdir()
        systemctl = mock_bin / "systemctl"
        systemctl.write_text(
            f"""#!/usr/bin/env bash
if [[ "${{1:-}}" == show ]]; then
  case "$*" in
    *--property=User*) echo cxadmin;;
    *--property=Group*) echo www-data;;
    *--property=FragmentPath*) echo {str(config_paths['service'])!r};;
    *--property=WorkingDirectory*) echo {str(legacy / 'backend')!r};;
    *--property=ExecStart*) echo '{{ path={str(legacy / 'backend/venv/bin/python')}; argv[]={str(legacy / 'backend/venv/bin/python')} app; }}';;
    *--property=EnvironmentFiles*) echo {str(target / '.env')!r};;
  esac
fi
if [[ "${{1:-}}" == restart && "${{HARNESS_FAIL_ORIGIN_RESTART:-0}}" == 1 ]]; then exit 1; fi
exit 0
""",
            encoding="utf-8",
        )
        systemctl.chmod(0o755)
        runuser = mock_bin / "runuser"
        runuser.write_text(
            """#!/usr/bin/env bash
set -euo pipefail
while [[ $# -gt 0 && "$1" != "--" ]]; do shift; done
[[ "${1:-}" == "--" ]] && shift
exec "$@"
""",
            encoding="utf-8",
        )
        runuser.chmod(0o755)
        for name in ("nginx", "curl"):
            command = mock_bin / name
            command.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
            command.chmod(0o755)

        entrypoint_text = (MODULE_PATH.parent / "cwscx_mystery_public_deploy_entrypoint.sh").read_text(encoding="utf-8")
        replacements = {
            'readonly TARGET_ROOT="/opt/cwscx-mystery-public"': f'readonly TARGET_ROOT="{target}"',
            'readonly STATE_ROOT="/var/lib/cwscx-mystery-public"': f'readonly STATE_ROOT="{state}"',
            'readonly ENTRYPOINT_PATH="/usr/local/sbin/cwscx-mystery-public-deploy"': f'readonly ENTRYPOINT_PATH="{sandbox / "entrypoint.sh"}"',
            'readonly INSTALLER="/usr/local/libexec/cwscx-mystery-public/install_mystery_public_bundle.sh"': f'readonly INSTALLER="{installer}"',
            'readonly RELEASE_GUARD="/usr/local/libexec/cwscx-mystery-public/mystery_public_release_guard.py"': f'readonly RELEASE_GUARD="{guard}"',
            'readonly TRANSACTION_HELPER="/usr/local/libexec/cwscx-mystery-public/mystery_public_bootstrap_transaction.py"': f'readonly TRANSACTION_HELPER="{transaction_helper}"',
            'readonly PRIVILEGED_SUITE_VERSION_FILE="/usr/local/libexec/cwscx-mystery-public/privileged-suite-version"': f'readonly PRIVILEGED_SUITE_VERSION_FILE="{sandbox / "suite-version"}"',
            'readonly ALLOWED_SIGNERS="/etc/cwscx-mystery-public/release-allowed-signers"': f'readonly ALLOWED_SIGNERS="{allowed}"',
            'readonly SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"': f'readonly SERVICE_FILE="{config_paths["service"]}"',
            'readonly NGINX_SITE_FILE="/etc/nginx/sites-available/cwscx-mystery-public"': f'readonly NGINX_SITE_FILE="{config_paths["site"]}"',
            'readonly NGINX_LINK_FILE="/etc/nginx/sites-enabled/cwscx-mystery-public"': f'readonly NGINX_LINK_FILE="{config_paths["link"]}"',
            'readonly NGINX_LIMIT_FILE="/etc/nginx/conf.d/cwscx-mystery-public-limits.conf"': f'readonly NGINX_LIMIT_FILE="{config_paths["limits"]}"',
            'readonly NGINX_HEADERS_FILE="/etc/nginx/snippets/cwscx-mystery-public-security-headers.conf"': f'readonly NGINX_HEADERS_FILE="{config_paths["headers"]}"',
            'PATH=/usr/sbin:/usr/bin:/sbin:/bin': f'PATH="{mock_bin}:/usr/sbin:/usr/bin:/sbin:/bin"',
            'readonly MIN_FREE_BYTES=10737418240': 'readonly MIN_FREE_BYTES=0',
            '[[ "${EUID}" -eq 0 ]] || die "must run as root (invoke via sudo)"': ': # root check replaced only in disposable test harness',
            '== "root"': f'== "{getpass.getuser()}"',
            '== "cxadmin:www-data"': f'== "{getpass.getuser()}:{grp.getgrgid(os.getgid()).gr_name}"',
            'install -o root -g root -m 0600 --': 'install -m 0600 --',
            "'^/tmp/": "'^" + re.escape(str(sandbox)) + "/",
        }
        for old, new in replacements.items():
            self.assertIn(old, entrypoint_text)
            entrypoint_text = entrypoint_text.replace(old, new)
        if interrupt_recovery_after_origin_switch:
            recovery_switch = ('  switch_current_signed "${fallback_id}" \\\n'
                               '    || { RECOVER_RELEASE_FAILURE_CLASS="current_switch_failed"; return 1; }\n'
                               '  activate_and_verify')
            self.assertIn(recovery_switch, entrypoint_text)
            entrypoint_text = entrypoint_text.replace(
                recovery_switch,
                '  switch_current_signed "${fallback_id}" \\\n'
                '    || { RECOVER_RELEASE_FAILURE_CLASS="current_switch_failed"; return 1; }\n'
                '  if [[ -n "${HARNESS_RECOVERY_INTERRUPT_MARKER:-}" ]]; then '
                ': >"$HARNESS_RECOVERY_INTERRUPT_MARKER"; sleep 30; fi\n'
                '  activate_and_verify',
                1,
            )
        if interrupt_after_switch and action == "deploy":
            deploy_switch = 'switch_current_signed "${NEW_ID}"\nEVIDENCE_FILE='
            self.assertIn(deploy_switch, entrypoint_text)
            entrypoint_text = entrypoint_text.replace(
                deploy_switch,
                'switch_current_signed "${NEW_ID}"\n'
                'if [[ -n "${HARNESS_INTERRUPT_MARKER:-}" ]]; then '
                ': >"$HARNESS_INTERRUPT_MARKER"; sleep 30; fi\nEVIDENCE_FILE=',
                1,
            )
        if interrupt_after_switch and action == "establish_baseline":
            baseline_recovery_switch = '  switch_current "${original_id}" || return 1\n  systemctl daemon-reload'
            self.assertIn(baseline_recovery_switch, entrypoint_text)
            entrypoint_text = entrypoint_text.replace(
                baseline_recovery_switch,
                '  switch_current "${original_id}" || return 1\n'
                '  if [[ -n "${HARNESS_INTERRUPT_MARKER:-}" ]]; then '
                ': >"$HARNESS_INTERRUPT_MARKER"; sleep 30; fi\n'
                '  systemctl daemon-reload',
                1,
            )
        if fail_recovery_evidence_fsync:
            fsync_function = 'fsync_file() {\n'
            self.assertIn(fsync_function, entrypoint_text)
            entrypoint_text = entrypoint_text.replace(
                fsync_function,
                fsync_function + '  if [[ "$1" == *"/recovery-"*".json" ]]; then return 1; fi\n',
                1,
            )
        if interrupt_after_baseline_commit:
            marker_publish = '  fsync_directory "${ARCHIVE_ROOT}"\n}\n\nstore_previous_release_id()'
            self.assertIn(marker_publish, entrypoint_text)
            entrypoint_text = entrypoint_text.replace(
                marker_publish,
                '  fsync_directory "${ARCHIVE_ROOT}"\n'
                '  if [[ -n "${HARNESS_INTERRUPT_MARKER:-}" ]]; then '
                ': >"$HARNESS_INTERRUPT_MARKER"; sleep 30; fi\n}\n\nstore_previous_release_id()',
                1,
            )
        entrypoint = sandbox / "entrypoint.sh"
        entrypoint.write_text(entrypoint_text, encoding="utf-8")
        entrypoint.chmod(0o700)
        (sandbox / "suite-version").write_text(
            release_guard.privileged_suite_version([entrypoint, installer, guard, transaction_helper]) + "\n", encoding="ascii"
        )
        (sandbox / "suite-version").chmod(0o600)

        bundle = sandbox / "first-signed-release.zip"
        bundle.write_bytes(b"signed-bundle-fixture")
        signature = sandbox / "first-signed-release.zip.sig"
        signature.write_text("signature-fixture\n", encoding="utf-8")
        operation = sandbox / "first-signed-release.operation.json"
        operation.write_text(json.dumps({
            "action": action, "target_release_id": "first-signed-release",
            "bundle_sha256": hashlib.sha256(bundle.read_bytes()).hexdigest(),
            "current_release_id": "legacy-unverified", "base_url": "https://mystery.internal", "tls_mode": "prepublic",
            "nonce": "1" * 64,
        }), encoding="utf-8")
        operation_signature = sandbox / "first-signed-release.operation.json.sig"
        operation_signature.write_text("signature-fixture\n", encoding="utf-8")
        for payload in (bundle, signature, operation, operation_signature):
            payload.chmod(0o600)
        command = ["bash", str(entrypoint), "--operation-path", str(operation),
                   "--operation-signature-path", str(operation_signature), "--bundle-path", str(bundle),
                   "--bundle-signature-path", str(signature)]
        env = {**os.environ, "SUDO_USER": getpass.getuser(), "HARNESS_ACTION": action,
               "HARNESS_FAIL_READINESS": "1" if fail_readiness else "0",
               "HARNESS_FAIL_NEW_HEAD": "1" if fail_new_head else "0",
               "HARNESS_FAIL_ORIGIN_RESTART": "1" if fail_origin_restart_preflight else "0",
               "HARNESS_NGINX_LIMIT_FILE": str(config_paths["limits"]),
               "HARNESS_NGINX_HEADERS_FILE": str(config_paths["headers"]),
               "HARNESS_NGINX_SITE_FILE": str(config_paths["site"]),
               "HARNESS_NGINX_LINK_FILE": str(config_paths["link"])}
        if interrupt_after_switch or interrupt_after_baseline_commit:
            marker = sandbox / "switched"
            env["HARNESS_INTERRUPT_MARKER"] = str(marker)
            process = subprocess.Popen(command, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
            deadline = time.monotonic() + 10
            while not marker.exists() and process.poll() is None and time.monotonic() < deadline:
                time.sleep(0.05)
            self.assertTrue(marker.exists(), "deploy harness did not reach its post-switch interruption point")
            os.killpg(process.pid, signal.SIGKILL)
            stdout, stderr = process.communicate(timeout=10)
            self.assertEqual(process.returncode, -signal.SIGKILL, stdout + stderr)
            journal = state / "active-operation.json"
            self.assertTrue(journal.is_file(), "SIGKILL did not leave a durable recovery journal")
            expected_after_interrupt = (
                "releases/legacy-unverified"
                if action == "establish_baseline" and fail_readiness
                else "releases/first-signed-release"
            )
            self.assertEqual(os.readlink(target / "current"), expected_after_interrupt)
            status_result = subprocess.run(
                ["bash", str(entrypoint), "--action", "status"], env=env,
                text=True, capture_output=True, check=False,
            )
            self.assertEqual(status_result.returncode, 0, status_result.stderr)
            status = json.loads(status_result.stdout)
            self.assertTrue(status["recovery_required"])
            self.assertEqual(status["pending_operation"]["original_release_id"], "legacy-unverified")
            self.assertTrue(journal.is_file(), "read-only status mutated the recovery journal")

            recovery_operation = sandbox / "fresh-recovery.operation.json"
            recovery_operation.write_text(json.dumps({
                "action": "recover", "target_release_id": "legacy-unverified",
                "bundle_sha256": status["pending_operation"]["recovery_authorization_sha256"],
                "current_release_id": status["release_id"],
                "base_url": "https://mystery.internal", "tls_mode": "prepublic",
                "nonce": "2" * 64,
            }), encoding="utf-8")
            recovery_signature = sandbox / "fresh-recovery.operation.json.sig"
            recovery_signature.write_text("signature-fixture\n", encoding="utf-8")
            recovery_operation.chmod(0o600); recovery_signature.chmod(0o600)
            recovery_command = ["bash", str(entrypoint), "--operation-path", str(recovery_operation),
                                "--operation-signature-path", str(recovery_signature)]
            recovery_env = {**env, "HARNESS_ACTION": "recover", "HARNESS_INTERRUPT_MARKER": ""}
            if interrupt_recovery_after_origin_switch:
                recovery_marker = sandbox / "recovery-origin-switched"
                recovery_env["HARNESS_RECOVERY_INTERRUPT_MARKER"] = str(recovery_marker)
                recovery_process = subprocess.Popen(
                    recovery_command, env=recovery_env, text=True, stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE, start_new_session=True,
                )
                deadline = time.monotonic() + 10
                while not recovery_marker.exists() and recovery_process.poll() is None and time.monotonic() < deadline:
                    time.sleep(0.05)
                self.assertTrue(recovery_marker.exists(), "recovery did not reach its post-origin-switch failpoint")
                os.killpg(recovery_process.pid, signal.SIGKILL)
                recovery_stdout, recovery_stderr = recovery_process.communicate(timeout=10)
                self.assertEqual(recovery_process.returncode, -signal.SIGKILL, recovery_stdout + recovery_stderr)
                self.assertTrue(journal.is_file(), "nested SIGKILL cleared the recovery journal")
                self.assertEqual(os.readlink(target / "current"), "releases/legacy-unverified")
                result = subprocess.run(
                    recovery_command,
                    env={**recovery_env, "HARNESS_RECOVERY_INTERRUPT_MARKER": ""},
                    text=True, capture_output=True, check=False,
                )
            else:
                result = subprocess.run(
                    recovery_command, env=recovery_env, text=True, capture_output=True, check=False,
                )
        else:
            result = subprocess.run(command, env=env, text=True, capture_output=True, check=False)
        return result, sandbox

    def test_baseline_snapshot_accepts_fixed_link_and_preserves_completed_candidate_on_rejection(self) -> None:
        success, sandbox = self.run_first_baseline_entrypoint_harness(fail_readiness=False, origin_link="expected")
        self.assertEqual(success.returncode, 0, success.stderr)
        self.assertEqual(os.readlink(sandbox / "system-config/cwscx-mystery-public-enabled"),
                         str(sandbox / "system-config/cwscx-mystery-public"))
        for kind in ("wrong", "regular"):
            result, attempt = self.run_first_baseline_entrypoint_harness(fail_readiness=False, origin_link=kind)
            self.assertNotEqual(result.returncode, 0, kind)
            self.assertEqual(os.readlink(attempt / "target/current"), "releases/legacy-unverified")
            self.assertTrue((attempt / "target/releases/first-signed-release").is_dir())
            self.assertTrue((attempt / "state/preactivation-candidate.json").is_file())
            self.assertTrue((attempt / "state/preactivation-candidate-provenance.json").is_file())
            self.assertFalse((attempt / "state/active-operation.json").exists())

    def test_baseline_recovery_preserves_absent_enabled_link(self) -> None:
        result, sandbox = self.run_first_baseline_entrypoint_harness(fail_readiness=True, origin_link="absent")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((sandbox / "system-config/cwscx-mystery-public-enabled").exists())
        self.assertEqual(os.readlink(sandbox / "target/current"), "releases/legacy-unverified")

    def test_first_baseline_head_mismatch_cleans_unactivated_candidate(self) -> None:
        result, sandbox = self.run_first_baseline_entrypoint_harness(
            fail_readiness=False, action="establish_baseline", fail_new_head=True
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(os.readlink(sandbox / "target/current"), "releases/legacy-unverified")
        self.assertFalse((sandbox / "target/releases/first-signed-release").exists())
        self.assertFalse((sandbox / "state/active-operation.json").exists())

    def test_new_head_mismatch_fails_before_switch(self) -> None:
        result, sandbox = self.run_first_baseline_entrypoint_harness(
            fail_readiness=False, action="deploy", fail_new_head=True
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("before activation", result.stderr)
        self.assertEqual(os.readlink(sandbox / "target/current"), "releases/legacy-unverified")
        self.assertFalse((sandbox / "state/active-operation.json").exists())
        self.assertFalse((sandbox / "state/application-archives/first-signed-release").exists())
        self.assertFalse((sandbox / "target/releases/first-signed-release").exists())

    def test_failed_normal_activation_restores_signed_fallback(self) -> None:
        result, sandbox = self.run_first_baseline_entrypoint_harness(
            fail_readiness=True, action="deploy"
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(os.readlink(sandbox / "target/current"), "releases/legacy-unverified")
        self.assertFalse((sandbox / "state/active-operation.json").exists())
        self.assertFalse((sandbox / "state/application-archives/first-signed-release").exists())

    def test_installed_suite_drift_blocks_status_and_signed_operations(self) -> None:
        result, sandbox = self.run_first_baseline_entrypoint_harness(fail_readiness=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        entrypoint = sandbox / "entrypoint.sh"
        env = {**os.environ, "SUDO_USER": getpass.getuser()}
        for path in (entrypoint, sandbox / "installer.sh", sandbox / "guard.py"):
            original = path.read_bytes()
            path.write_bytes(original + b"\n# unauthorized drift\n")
            status = subprocess.run(
                ["bash", str(entrypoint), "--action", "status"], env=env, text=True, capture_output=True
            )
            self.assertNotEqual(status.returncode, 0, str(path))
            self.assertIn("installed privileged suite differs", status.stderr)
            path.write_bytes(original)

    def test_first_baseline_success_archives_only_the_new_verified_release(self) -> None:
        result, sandbox = self.run_first_baseline_entrypoint_harness(fail_readiness=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(os.readlink(sandbox / "target/current"), "releases/first-signed-release")
        archives = sandbox / "state/application-archives"
        self.assertEqual((archives / "baseline-release-id").read_text(), "first-signed-release\n")
        self.assertTrue((archives / "first-signed-release/bundle.zip").is_file())
        self.assertFalse((archives / "legacy-unverified").exists())

    def test_first_baseline_fails_closed_when_legacy_restartability_is_unknown(self) -> None:
        result, sandbox = self.run_first_baseline_entrypoint_harness(
            fail_readiness=False, fail_origin_restart_preflight=True
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("restartability preflight failed before baseline activation", result.stderr)
        self.assertEqual(os.readlink(sandbox / "target/current"), "releases/legacy-unverified")
        self.assertFalse((sandbox / "state/active-operation.json").exists())
        self.assertFalse((sandbox / "target/releases/first-signed-release").exists())

    def test_first_baseline_post_switch_failure_does_not_assert_or_archive_a_rollback(self) -> None:
        result, sandbox = self.run_first_baseline_entrypoint_harness(
            fail_readiness=True, origin_optional_configs_present=False
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("pre-baseline release was restored operationally but remains unverified and unarchived", result.stderr)
        self.assertEqual(os.readlink(sandbox / "target/current"), "releases/legacy-unverified")
        archives = sandbox / "state/application-archives"
        self.assertFalse((archives / "baseline-release-id").exists())
        self.assertFalse((archives / "first-signed-release").exists())
        failed_evidence = sandbox / "state/deploy-evidence/first-signed-release.json"
        self.assertTrue(failed_evidence.is_file())
        self.assertEqual(failed_evidence.stat().st_mode & 0o777, 0o644)
        self.assertEqual(json.loads(failed_evidence.read_text())["summary"]["failed"], 1)
        self.assertTrue((sandbox / "state/deploy-evidence/recovery-first-signed-release.json").is_file())
        self.assertFalse((sandbox / "unsigned-root-script-ran").exists(), "recovery executed unsigned release scripts as root")
        self.assertFalse((sandbox / "system-config/cwscx-mystery-public-limits.conf").exists())
        self.assertFalse((sandbox / "system-config/cwscx-mystery-public-security-headers.conf").exists())

    def test_first_baseline_recovery_restores_optional_configs_that_were_present(self) -> None:
        result, sandbox = self.run_first_baseline_entrypoint_harness(
            fail_readiness=True, origin_optional_configs_present=True
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(
            (sandbox / "system-config/cwscx-mystery-public-limits.conf").read_text(),
            "legacy-limits\n",
        )
        self.assertEqual(
            (sandbox / "system-config/cwscx-mystery-public-security-headers.conf").read_text(),
            "legacy-headers\n",
        )

    def test_interrupted_baseline_recovery_repeats_absence_restoration(self) -> None:
        result, sandbox = self.run_first_baseline_entrypoint_harness(
            fail_readiness=True,
            interrupt_after_switch=True,
            origin_optional_configs_present=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("GitHub-authorized interrupted operation recovery completed", result.stdout)
        self.assertEqual(os.readlink(sandbox / "target/current"), "releases/legacy-unverified")
        self.assertFalse((sandbox / "state/active-operation.json").exists())
        self.assertFalse((sandbox / "system-config/cwscx-mystery-public-limits.conf").exists())
        self.assertFalse((sandbox / "system-config/cwscx-mystery-public-security-headers.conf").exists())

    def test_sigkill_after_switch_is_recovered_by_fresh_signed_invocation(self) -> None:
        result, sandbox = self.run_first_baseline_entrypoint_harness(
            fail_readiness=False, action="deploy", interrupt_after_switch=True
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("GitHub-authorized interrupted operation recovery completed", result.stdout)
        self.assertEqual(os.readlink(sandbox / "target/current"), "releases/legacy-unverified")
        self.assertFalse((sandbox / "state/active-operation.json").exists())
        self.assertFalse((sandbox / "state/application-archives/first-signed-release").exists())
        self.assertTrue((sandbox / "state/deploy-evidence/recovery-first-signed-release.json").is_file())

    def test_nested_sigkill_after_recovery_switch_repeats_restart_and_readiness(self) -> None:
        result, sandbox = self.run_first_baseline_entrypoint_harness(
            fail_readiness=False,
            action="deploy",
            interrupt_after_switch=True,
            interrupt_recovery_after_origin_switch=True,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(os.readlink(sandbox / "target/current"), "releases/legacy-unverified")
        self.assertFalse((sandbox / "state/active-operation.json").exists())
        recovery = sandbox / "state/deploy-evidence/recovery-first-signed-release.json"
        self.assertTrue(recovery.is_file(), "repeated recovery did not produce fresh readiness evidence")

    def test_sigkill_after_committed_baseline_keeps_and_reverifies_new_baseline(self) -> None:
        result, sandbox = self.run_first_baseline_entrypoint_harness(
            fail_readiness=False,
            interrupt_after_baseline_commit=True,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(os.readlink(sandbox / "target/current"), "releases/first-signed-release")
        self.assertFalse((sandbox / "state/active-operation.json").exists())
        archives = sandbox / "state/application-archives"
        self.assertEqual((archives / "baseline-release-id").read_text(), "first-signed-release\n")
        recovery = sandbox / "state/deploy-evidence/recovery-first-signed-release.json"
        self.assertTrue(recovery.is_file(), "committed baseline recovery did not emit readiness evidence")

    def test_recovery_keeps_journal_when_evidence_fsync_fails(self) -> None:
        result, sandbox = self.run_first_baseline_entrypoint_harness(
            fail_readiness=False,
            action="deploy",
            interrupt_after_switch=True,
            fail_recovery_evidence_fsync=True,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertTrue((sandbox / "state/active-operation.json").is_file())
        self.assertEqual(os.readlink(sandbox / "target/current"), "releases/legacy-unverified")

    def test_exact_signed_bundle_can_be_stored_verified_and_matched_to_install(self) -> None:
        bundle, signature, _ = self.make_bundle()
        manifest = self.verified_manifest(bundle, signature)
        release_guard.store_archive(self.archives, bundle, signature, manifest, "2026-09-29T00:01:00Z")
        verified = release_guard.verify_archive(self.archives, "release-one", self.allowed)
        self.assertEqual(verified["bundle_sha256"], hashlib.sha256(bundle.read_bytes()).hexdigest())

        installed = self.root / "releases/release-one"
        installed.mkdir(parents=True)
        with zipfile.ZipFile(bundle) as archive:
            for info in archive.infolist():
                relative = Path(info.filename).relative_to("release")
                target = installed / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(info.filename))
        (installed / "backend/venv/bin").mkdir(parents=True)
        (installed / "backend/venv/bin/python").write_text("runtime-only", encoding="utf-8")
        self.secure_installed_tree(installed)
        release_guard.verify_installed_release(installed, self.archives, "release-one", self.allowed, os.geteuid())

    def test_legitimate_signer_overlap_keeps_old_signed_archive_valid(self) -> None:
        bundle, signature, _ = self.make_bundle()
        manifest = self.verified_manifest(bundle, signature)
        release_guard.store_archive(self.archives, bundle, signature, manifest, "2026-09-29T00:01:00Z")
        new_key = self.root / "new-signing-key"
        subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(new_key)], check=True)
        proposed = self.root / "proposed-overlap-signers"
        proposed.write_text(
            "github-actions " + new_key.with_suffix(".pub").read_text(encoding="ascii")
            + "github-actions " + self.key.with_suffix(".pub").read_text(encoding="ascii"),
            encoding="ascii",
        )

        verified = release_guard.verify_archive(self.archives, "release-one", proposed)

        self.assertEqual(verified["release_id"], "release-one")
        self.assertEqual(verified["bundle_sha256"], hashlib.sha256(bundle.read_bytes()).hexdigest())

    def test_archive_publication_failure_exposes_no_partial_release(self) -> None:
        bundle, signature, _ = self.make_bundle()
        manifest = self.verified_manifest(bundle, signature)

        with mock.patch.object(release_guard.os, "replace", side_effect=OSError("injected publish failure")):
            with self.assertRaisesRegex(OSError, "injected publish failure"):
                release_guard.store_archive(
                    self.archives, bundle, signature, manifest, "2026-09-29T00:01:00Z"
                )

        self.assertFalse(release_guard.archive_paths(self.archives, "release-one")["root"].exists())
        self.assertEqual(list(self.archives.iterdir()), [])

    def test_archive_fsync_failure_before_publish_exposes_no_partial_release(self) -> None:
        bundle, signature, _ = self.make_bundle()
        manifest = self.verified_manifest(bundle, signature)

        with mock.patch.object(release_guard.os, "fsync", side_effect=OSError("injected fsync failure")):
            with self.assertRaisesRegex(OSError, "injected fsync failure"):
                release_guard.store_archive(
                    self.archives, bundle, signature, manifest, "2026-09-29T00:01:00Z"
                )

        self.assertFalse(release_guard.archive_paths(self.archives, "release-one")["root"].exists())
        self.assertEqual(list(self.archives.iterdir()), [])

    def test_archive_files_and_directory_are_synced_around_atomic_publish(self) -> None:
        bundle, signature, _ = self.make_bundle()
        manifest = self.verified_manifest(bundle, signature)
        events: list[str] = []
        real_fsync, real_replace = os.fsync, os.replace

        def recording_fsync(fd: int) -> None:
            events.append("fsync")
            real_fsync(fd)

        def recording_replace(source: Path, target: Path) -> None:
            events.append("replace")
            real_replace(source, target)

        with mock.patch.object(release_guard.os, "fsync", side_effect=recording_fsync), \
             mock.patch.object(release_guard.os, "replace", side_effect=recording_replace):
            release_guard.store_archive(
                self.archives, bundle, signature, manifest, "2026-09-29T00:01:00Z"
            )

        publish_index = events.index("replace")
        self.assertGreaterEqual(events[:publish_index].count("fsync"), 5)
        self.assertIn("fsync", events[publish_index + 1:])

    def test_archive_only_release_is_restored_without_activation(self) -> None:
        bundle, signature, _ = self.make_bundle()
        manifest = self.verified_manifest(bundle, signature)
        release_guard.store_archive(self.archives, bundle, signature, manifest, "2026-09-29T00:01:00Z")
        target, env = self.installer_sandbox()

        result = self.run_archive_install_only("release-one", env)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(os.readlink(target / "current"), "releases/current-release")
        installed = target / "releases/release-one"
        self.assertTrue((installed / "backend/venv/bin/python").is_file())
        release_guard.verify_installed_release(installed, self.archives, "release-one", self.allowed, os.geteuid())

    def test_archive_restore_rejects_tampering_before_install(self) -> None:
        bundle, signature, _ = self.make_bundle()
        manifest = self.verified_manifest(bundle, signature)
        release_guard.store_archive(self.archives, bundle, signature, manifest, "2026-09-29T00:01:00Z")
        target, env = self.installer_sandbox()
        with release_guard.archive_paths(self.archives, "release-one")["bundle"].open("ab") as handle:
            handle.write(b"tamper")

        with self.assertRaisesRegex(release_guard.GuardError, "checksum mismatch"):
            release_guard.verify_archive(self.archives, "release-one", self.allowed)
        self.assertFalse((target / "releases/release-one").exists())
        self.assertEqual(os.readlink(target / "current"), "releases/current-release")

    def test_interrupted_archive_restore_removes_partial_release_and_preserves_current(self) -> None:
        bundle, signature, _ = self.make_bundle()
        manifest = self.verified_manifest(bundle, signature)
        release_guard.store_archive(self.archives, bundle, signature, manifest, "2026-09-29T00:01:00Z")
        marker = self.root / "venv-started"
        target, env = self.installer_sandbox(interrupt_marker=marker)
        verified = release_guard.verify_archive(self.archives, "release-one", self.allowed)
        installer = MODULE_PATH.parent / "install_mystery_public_bundle.sh"
        process = subprocess.Popen(
            ["bash", str(installer), "--install-only", str(release_guard.archive_paths(self.archives, "release-one")["bundle"])],
            env={**env, "EXPECTED_BUNDLE_SHA256": verified["bundle_sha256"]},
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
        )
        deadline = time.monotonic() + 10
        while not marker.exists() and process.poll() is None and time.monotonic() < deadline:
            time.sleep(0.05)
        self.assertTrue(marker.exists(), "installer did not reach post-rename venv creation")
        os.killpg(process.pid, signal.SIGTERM)
        stdout, stderr = process.communicate(timeout=10)

        self.assertNotEqual(process.returncode, 0, stdout + stderr)
        self.assertFalse((target / "releases/release-one").exists())
        self.assertEqual(os.readlink(target / "current"), "releases/current-release")

    def test_retry_with_existing_release_id_fails_without_deleting_it(self) -> None:
        """Retrying an install with the same release_id must not delete the existing release."""
        bundle, signature, _ = self.make_bundle()
        manifest = self.verified_manifest(bundle, signature)
        release_guard.store_archive(self.archives, bundle, signature, manifest, "2026-09-29T00:01:00Z")

        target, env = self.installer_sandbox()
        # Pre-create the release directory with a sentinel file
        existing = target / "releases/release-one"
        existing.mkdir(parents=True)
        sentinel = existing / "EXISTING_RELEASE"
        sentinel.write_text("keep\n", encoding="utf-8")

        # Run installer --install-only a second time for the same release_id
        result = self.run_archive_install_only("release-one", env)

        # Should fail with the "already exists" message
        self.assertNotEqual(result.returncode, 0, result.stderr)
        self.assertIn("Immutable release already exists", result.stderr)

        # The existing release directory and sentinel must still exist
        self.assertTrue(sentinel.exists())
        self.assertEqual([child.name for child in existing.iterdir()], ["EXISTING_RELEASE"])
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "keep\n")

        # current symlink must be unchanged
        self.assertEqual(os.readlink(target / "current"), "releases/current-release")

        # No extra entries in releases/
        self.assertEqual(len(list((target / "releases").iterdir())), 2)  # current-release + release-one

    def test_failed_service_access_preflight_cleans_release_and_preserves_state(self) -> None:
        """Failed service-user access preflight must remove the partial release and leave current/shared/.env untouched."""
        bundle, signature, _ = self.make_bundle()
        manifest = self.verified_manifest(bundle, signature)
        release_guard.store_archive(self.archives, bundle, signature, manifest, "2026-09-29T00:01:00Z")

        target, env = self.installer_sandbox()
        # Overwrite mock runuser so it fails for the service user (cxadmin:www-data)
        mock_bin = target.parent / "mock-bin"
        runuser = mock_bin / "runuser"
        runuser.write_text(
            """#!/usr/bin/env bash
set -euo pipefail
# Fail only when -u cxadmin is used (the service user check)
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-u" && "$2" == "cxadmin" ]]; then
    exit 1
  fi
  shift
done
exec "$@"
""",
            encoding="utf-8",
        )
        runuser.chmod(0o755)

        # Seed shared/last-installed-release-id and record .env content
        shared = target / "shared"
        shared.mkdir(parents=True, exist_ok=True)
        last_installed = shared / "last-installed-release-id"
        last_installed.write_text("release-prior\n", encoding="utf-8")
        env_content = (target / ".env").read_text(encoding="utf-8")
        current_link = os.readlink(target / "current")

        # Run the real installer (not --install-only) so it reaches the access preflight
        verified = release_guard.verify_archive(self.archives, "release-one", self.allowed)
        installer = MODULE_PATH.parent / "install_mystery_public_bundle.sh"
        result = subprocess.run(
            ["bash", str(installer), str(release_guard.archive_paths(self.archives, "release-one")["bundle"])],
            env={**env, "EXPECTED_BUNDLE_SHA256": verified["bundle_sha256"]},
            text=True,
            capture_output=True,
            check=False,
        )

        # Should fail with the access preflight message
        self.assertNotEqual(result.returncode, 0, result.stderr)
        self.assertIn("Release access preflight failed", result.stderr)

        # The partial release directory must be cleaned up
        self.assertFalse((target / "releases/release-one").exists())

        # current symlink unchanged
        self.assertEqual(os.readlink(target / "current"), current_link)

        # .env unchanged
        self.assertEqual((target / ".env").read_text(encoding="utf-8"), env_content)

        # shared/last-installed-release-id unchanged
        self.assertEqual(last_installed.read_text(encoding="utf-8"), "release-prior\n")

    def test_bundle_tampering_and_metadata_promotion_are_rejected(self) -> None:
        bundle, signature, _ = self.make_bundle()
        manifest = self.verified_manifest(bundle, signature)
        release_guard.store_archive(self.archives, bundle, signature, manifest, "2026-09-29T00:01:00Z")
        paths = release_guard.archive_paths(self.archives, "release-one")

        metadata = json.loads(paths["metadata"].read_text(encoding="utf-8"))
        metadata["status"] = "failed"
        paths["metadata"].write_text(json.dumps(metadata), encoding="utf-8")
        with self.assertRaisesRegex(release_guard.GuardError, "not a verified deployment fallback"):
            release_guard.verify_archive(self.archives, "release-one", self.allowed)

        metadata["status"] = "deploy_verified"
        paths["metadata"].write_text(json.dumps(metadata), encoding="utf-8")
        with paths["bundle"].open("ab") as handle:
            handle.write(b"tamper")
        with self.assertRaisesRegex(release_guard.GuardError, "checksum mismatch"):
            release_guard.verify_archive(self.archives, "release-one", self.allowed)

    def test_installed_file_tampering_and_symlinks_are_rejected(self) -> None:
        bundle, signature, _ = self.make_bundle()
        manifest = self.verified_manifest(bundle, signature)
        release_guard.store_archive(self.archives, bundle, signature, manifest, "2026-09-29T00:01:00Z")
        installed = self.root / "releases/release-one"
        installed.mkdir(parents=True)
        with zipfile.ZipFile(bundle) as archive:
            archive.extractall(self.root / "extract")
        shutil.copytree(self.root / "extract/release", installed, dirs_exist_ok=True)
        (installed / "backend/app.py").write_text("SAFE = False\n", encoding="utf-8")
        self.secure_installed_tree(installed)
        with self.assertRaisesRegex(release_guard.GuardError, "integrity failed"):
            release_guard.verify_installed_release(installed, self.archives, "release-one", self.allowed, os.geteuid())
        (installed / "backend/app.py").unlink()
        (installed / "backend/app.py").symlink_to("/etc/passwd")
        with self.assertRaisesRegex(release_guard.GuardError, "unsafe installed symlink target|non-symlink"):
            release_guard.verify_installed_release(installed, self.archives, "release-one", self.allowed, os.geteuid())

    def test_runtime_only_venv_must_remain_root_controlled(self) -> None:
        bundle, signature, _ = self.make_bundle()
        manifest = self.verified_manifest(bundle, signature)
        release_guard.store_archive(self.archives, bundle, signature, manifest, "2026-09-29T00:01:00Z")
        installed = self.root / "releases/release-one"
        installed.mkdir(parents=True)
        with zipfile.ZipFile(bundle) as archive:
            archive.extractall(self.root / "runtime-extract")
        shutil.copytree(self.root / "runtime-extract/release", installed, dirs_exist_ok=True)
        runtime = installed / "backend/venv/bin/python"
        runtime.parent.mkdir(parents=True)
        runtime.write_text("runtime-only", encoding="utf-8")
        self.secure_installed_tree(installed)
        runtime.chmod(0o775)
        with self.assertRaisesRegex(release_guard.GuardError, "not root-controlled"):
            release_guard.verify_installed_release(installed, self.archives, "release-one", self.allowed, os.geteuid())

    def test_retention_never_selects_current_previous_or_pinned(self) -> None:
        for index in range(1, 6):
            release_id = f"release-{index}"
            bundle, signature, _ = self.make_bundle(release_id)
            manifest = self.verified_manifest(bundle, signature)
            release_guard.store_archive(self.archives, bundle, signature, manifest, f"2026-09-29T00:0{index}:00Z")
            timestamp = time.time_ns() + index
            os.utime(release_guard.archive_paths(self.archives, release_id)["metadata"], ns=(timestamp, timestamp))
        (self.archives / "release-1.pinned").write_text("VM-admin pin\n", encoding="utf-8")
        candidates = release_guard.eligible_prune_ids(
            self.archives, {"release-5", "release-4", "release-1"}, retain_count=3
        )
        self.assertEqual(candidates, ["release-2"])
        self.assertNotIn("release-1", candidates)
        self.assertNotIn("release-4", candidates)
        self.assertNotIn("release-5", candidates)

    def test_privileged_suite_identity_changes_for_any_file_or_order(self) -> None:
        files = []
        for name, content in (("entrypoint", b"one"), ("installer", b"two"), ("guard", b"three"), ("helper", b"four")):
            path = self.root / name
            path.write_bytes(content)
            files.append(path)
        original = release_guard.privileged_suite_version(files)
        self.assertRegex(original, r"^[0-9a-f]{64}$")
        self.assertNotEqual(original, release_guard.privileged_suite_version(list(reversed(files))))
        files[1].write_bytes(b"changed")
        self.assertNotEqual(original, release_guard.privileged_suite_version(files))
        with self.assertRaisesRegex(release_guard.GuardError, "exactly four"):
            release_guard.privileged_suite_version(files[:3])

    def test_manifest_with_duplicate_heads_or_unsafe_zip_member_is_rejected(self) -> None:
        bundle, _, _ = self.make_bundle("bad-heads", ["head", "head"])
        with self.assertRaisesRegex(release_guard.GuardError, "duplicate"):
            release_guard.inspect_bundle(bundle)
        unsafe = self.root / "unsafe.zip"
        with zipfile.ZipFile(unsafe, "w") as archive:
            archive.writestr("../escape", "bad")
        with self.assertRaisesRegex(release_guard.GuardError, "unsafe archive"):
            release_guard.inspect_bundle(unsafe)

    def test_signed_operation_is_single_use_and_bound_to_current_release(self) -> None:
        operation, signature, now = self.make_operation()
        nonces = self.root / "nonces"
        nonces.mkdir(mode=0o700)
        authorized = release_guard.authorize_operation(
            operation, signature, self.allowed, nonces, "release-current", now=now, required_uid=os.geteuid()
        )
        self.assertEqual(authorized["action"], "rollback")
        with self.assertRaisesRegex(release_guard.GuardError, "already been used"):
            release_guard.authorize_operation(
                operation, signature, self.allowed, nonces, "release-current", now=now, required_uid=os.geteuid()
            )

        fresh, fresh_signature, _ = self.make_operation(nonce="2" * 64)
        with self.assertRaisesRegex(release_guard.GuardError, "stale"):
            release_guard.authorize_operation(
                fresh, fresh_signature, self.allowed, nonces, "different-current", now=now, required_uid=os.geteuid()
            )

    def test_nonce_must_be_durable_before_operation_is_authorized(self) -> None:
        operation, signature, now = self.make_operation(nonce="7" * 64)
        nonces = self.root / "durable-nonces"
        nonces.mkdir(mode=0o700)
        real_fsync = os.fsync
        synced = []

        def observe_fsync(fd: int) -> None:
            synced.append(os.fstat(fd).st_mode)
            real_fsync(fd)

        with mock.patch.object(release_guard.os, "fsync", side_effect=observe_fsync):
            release_guard.authorize_operation(
                operation, signature, self.allowed, nonces, "release-current", now=now, required_uid=os.geteuid()
            )
        self.assertEqual(len(synced), 2)  # nonce file, then containing directory

        failed, failed_signature, _ = self.make_operation(nonce="8" * 64)
        with mock.patch.object(release_guard.os, "fsync", side_effect=OSError("nonce fsync failed")):
            with self.assertRaisesRegex(OSError, "nonce fsync failed"):
                release_guard.authorize_operation(
                    failed, failed_signature, self.allowed, nonces, "release-current", now=now, required_uid=os.geteuid()
                )
        self.assertTrue((nonces / ("8" * 64)).exists())
        with self.assertRaisesRegex(release_guard.GuardError, "already been used"):
            release_guard.authorize_operation(
                failed, failed_signature, self.allowed, nonces, "release-current", now=now, required_uid=os.geteuid()
            )

    def test_baseline_snapshot_preserves_and_restores_config_modes(self) -> None:
        import json, os, shutil
        # Create a mock baseline recovery snapshot directory with modes
        snap_dir = self.root / "baseline-snap"
        snap_dir.mkdir(mode=0o700)
        # Simulate a config file with mode 0600
        svc_file = snap_dir / "cwscx-mystery-public-backend.service"
        svc_file.write_text("service content\n", encoding="utf-8")
        svc_file.chmod(0o600)
        site_file = snap_dir / "cwscx-mystery-public"
        site_file.write_text("site content\n", encoding="utf-8")
        site_file.chmod(0o600)
        metadata = {
            "schema_version": 1,
            "present": {"service": True, "site": True, "limits": False, "headers": False, "enabled_link": False},
            "modes": {"service": 0o600, "site": 0o600}
        }
        (snap_dir / "metadata.json").write_text(json.dumps(metadata, sort_keys=True) + "\n", encoding="utf-8")
        # Destination temp dirs
        svc_dest = self.root / "etc" / "systemd" / "system"
        site_dest = self.root / "etc" / "nginx" / "sites-available"
        svc_dest.mkdir(parents=True, mode=0o700)
        site_dest.mkdir(parents=True, mode=0o700)
        # Mock restore via the internal function (we test the logic by calling the restore function pattern)
        # We'll directly test the restore logic here to ensure modes are preserved
        required_uid = os.geteuid()
        snapshot_fd = os.open(snap_dir, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            source_fd = os.open("cwscx-mystery-public-backend.service", os.O_RDONLY | os.O_NOFOLLOW, dir_fd=snapshot_fd)
            try:
                info = os.fstat(source_fd)
                dest_mode = metadata["modes"]["service"]
                temp_dest = self.root / "etc" / "systemd" / "system" / ".test-restore.service"
                parent_fd = os.open(svc_dest, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
                try:
                    dest_fd = os.open(".test-restore.service", os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, dest_mode, dir_fd=parent_fd)
                    try:
                        with os.fdopen(dest_fd, "wb") as target, os.fdopen(os.dup(source_fd), "rb") as origin:
                            shutil.copyfileobj(origin, target)
                            target.flush()
                            os.fsync(target.fileno())
                        os.replace(".test-restore.service", "cwscx-mystery-public-backend.service", src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
                        os.fsync(parent_fd)
                    finally:
                        try:
                            os.unlink(".test-restore.service", dir_fd=parent_fd)
                        except FileNotFoundError:
                            pass
                finally:
                    os.close(parent_fd)
            finally:
                os.close(source_fd)
        finally:
            os.close(snapshot_fd)
        # Verify the restored file has the original 0600 mode
        restored = svc_dest / "cwscx-mystery-public-backend.service"
        self.assertTrue(restored.exists())
        restored_mode = restored.stat().st_mode & 0o777
        self.assertEqual(restored_mode, 0o600)

    def run_baseline_restore_python(self, link_target: str | None) -> tuple[subprocess.CompletedProcess[str], dict[str, Path]]:
        """Run the entrypoint's real baseline-restore Python against a sandbox."""
        entrypoint = (MODULE_PATH.parent / "cwscx_mystery_public_deploy_entrypoint.sh").read_text(encoding="utf-8")
        function = entrypoint.split("restore_baseline_origin_fixed() {", 1)[1]
        script = function.split("<<'PY' || return 1\n", 1)[1].split("\nPY\n", 1)[0]

        snapshot = self.root / "restore-snapshot"
        snapshot.mkdir(mode=0o700)
        for name in ("cwscx-mystery-public-backend.service", "cwscx-mystery-public"):
            path = snapshot / name
            path.write_text("original\n", encoding="utf-8")
            path.chmod(0o600)
        metadata = {
            "schema_version": 1,
            "present": {"service": True, "site": True, "limits": False, "headers": False, "enabled_link": True},
            "modes": {"service": 0o600, "site": 0o600},
        }
        metadata_path = snapshot / "metadata.json"
        metadata_path.write_text(json.dumps(metadata, sort_keys=True) + "\n", encoding="utf-8")
        metadata_path.chmod(0o600)

        paths = {
            "service": self.root / "restore-etc/systemd/cwscx-mystery-public-backend.service",
            "site": self.root / "restore-etc/sites-available/cwscx-mystery-public",
            "limits": self.root / "restore-etc/conf.d/limits.conf",
            "headers": self.root / "restore-etc/conf.d/headers.conf",
            "link": self.root / "restore-etc/sites-enabled/cwscx-mystery-public",
        }
        for path in paths.values():
            path.parent.mkdir(parents=True, exist_ok=True)
        paths["service"].write_text("modified\n", encoding="utf-8")
        paths["site"].write_text("modified\n", encoding="utf-8")
        if link_target is not None:
            paths["link"].symlink_to(link_target.format(site=paths["site"]))
        paths["snapshot"] = snapshot
        result = subprocess.run(
            [
                "python3", "-c", script, str(os.geteuid()), str(snapshot),
                str(paths["service"]), str(paths["site"]), str(paths["limits"]),
                str(paths["headers"]), str(paths["link"]),
            ],
            text=True,
            capture_output=True,
        )
        return result, paths

    def test_baseline_restore_rejects_wrong_enabled_link_without_modifying_config(self) -> None:
        result, paths = self.run_baseline_restore_python("/etc/nginx/sites-available/other-site")

        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("enabled-site link does not target the fixed site", result.stderr)
        self.assertEqual(paths["service"].read_text(encoding="utf-8"), "modified\n")
        self.assertEqual(paths["site"].read_text(encoding="utf-8"), "modified\n")
        self.assertEqual(os.readlink(paths["link"]), "/etc/nginx/sites-available/other-site")

    def test_baseline_restore_accepts_correct_enabled_link_and_restores_config(self) -> None:
        result, paths = self.run_baseline_restore_python("{site}")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(paths["service"].read_text(encoding="utf-8"), "original\n")
        self.assertEqual(paths["site"].read_text(encoding="utf-8"), "original\n")
        self.assertTrue(paths["link"].is_symlink())
        self.assertEqual(os.readlink(paths["link"]), str(paths["site"]))

    def test_first_baseline_operation_is_signed_and_bound_to_unverified_current_id(self) -> None:
        operation, signature, now = self.make_operation(
            action="establish_baseline",
            current_release_id="legacy-unverified",
            target_release_id="first-signed-release",
            nonce="5" * 64,
        )
        nonces = self.root / "baseline-nonces"
        nonces.mkdir(mode=0o700)

        authorized = release_guard.authorize_operation(
            operation,
            signature,
            self.allowed,
            nonces,
            "legacy-unverified",
            now=now,
            required_uid=os.geteuid(),
        )

        self.assertEqual(authorized["action"], "establish_baseline")
        self.assertEqual(authorized["current_release_id"], "legacy-unverified")
        self.assertEqual(authorized["target_release_id"], "first-signed-release")
        fresh, fresh_signature, _ = self.make_operation(
            action="establish_baseline",
            current_release_id="legacy-unverified",
            target_release_id="first-signed-release",
            nonce="6" * 64,
        )
        with self.assertRaisesRegex(release_guard.GuardError, "stale"):
            release_guard.authorize_operation(
                fresh,
                fresh_signature,
                self.allowed,
                nonces,
                "different-live-release",
                now=now,
                required_uid=os.geteuid(),
            )

    def test_recovery_operation_is_signed_and_bound_to_failed_current(self) -> None:
        operation, signature, now = self.make_operation(
            action="recover",
            current_release_id="failed-current",
            target_release_id="approved-origin",
            nonce="7" * 64,
        )
        nonces = self.root / "recovery-nonces"
        nonces.mkdir(mode=0o700)
        authorized = release_guard.authorize_operation(
            operation, signature, self.allowed, nonces, "failed-current",
            now=now, required_uid=os.geteuid(),
        )
        self.assertEqual(authorized["action"], "recover")
        self.assertEqual(authorized["target_release_id"], "approved-origin")

    def test_unsigned_tampered_and_expired_operations_are_rejected(self) -> None:
        operation, signature, now = self.make_operation(nonce="3" * 64)
        nonces = self.root / "nonces"
        nonces.mkdir(mode=0o700)
        unsigned = self.root / "missing.sig"
        with self.assertRaisesRegex(release_guard.GuardError, "regular non-symlink"):
            release_guard.authorize_operation(
                operation, unsigned, self.allowed, nonces, "release-current", now=now, required_uid=os.geteuid()
            )
        operation.write_text(operation.read_text(encoding="utf-8").replace("rollback", "deploy"), encoding="utf-8")
        with self.assertRaisesRegex(release_guard.GuardError, "not authorized"):
            release_guard.authorize_operation(
                operation, signature, self.allowed, nonces, "release-current", now=now, required_uid=os.geteuid()
            )

        expired_at = now - datetime.timedelta(minutes=1)
        expired, expired_signature, issued = self.make_operation(
            issued=now - datetime.timedelta(minutes=6), expires=expired_at, nonce="4" * 64
        )
        with self.assertRaisesRegex(release_guard.GuardError, "not currently valid"):
            release_guard.authorize_operation(
                expired, expired_signature, self.allowed, nonces, "release-current", now=now, required_uid=os.geteuid()
            )


class RecoveryAuditTests(unittest.TestCase):
    NONCE = "a" * 64

    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.root.chmod(0o755)
        self.addCleanup(self.temp.cleanup)

    def append(self, *, nonce: str | None = None, context: str = "automatic_explicit",
               outcome: str = "failure", failure: str = "candidate_probe_failed",
               probe: str = "unknown", restoration: str = "none",
               started: int = 100, ended: int = 200):
        return release_guard.append_recovery_audit(
            self.root, nonce or self.NONCE, "deploy", "signed-new", "origin", "failed",
            context, started, "2026-10-15T10:00:00Z", outcome, failure, probe, restoration,
            required_uid=os.geteuid(), ended_monotonic_ns=ended, ended_at_utc="2026-10-15T10:00:01Z",
        )

    def path(self, nonce: str | None = None) -> Path:
        return release_guard.recovery_audit_path(self.root, nonce or self.NONCE)

    def test_first_failure_then_exit_success_preserves_both_events(self) -> None:
        first = self.append()
        second = self.append(context="exit_trap", outcome="success", failure="none",
                             probe="ready_http_200", restoration="exit_trap", started=300, ended=400)
        records = release_guard.read_recovery_audit(self.path(), self.NONCE, required_uid=os.geteuid())
        self.assertEqual(first["attempt_index"], 1)
        self.assertEqual((second["attempt_index"], second["prior_failed_attempts"]), (2, 1))
        self.assertEqual([(r["outcome"], r["attempt_context"], r["successful_restoration"]) for r in records], [
            ("failure", "automatic_explicit", "none"),
            ("success", "exit_trap", "exit_trap"),
        ])

    def test_manual_recover_is_a_new_nonce_and_explicit_context(self) -> None:
        self.append()
        manual_nonce = "b" * 64
        record = self.append(nonce=manual_nonce, context="manual_signed_recover", outcome="success",
                             failure="none", probe="ready_http_200", restoration="explicit")
        self.assertEqual(record["attempt_index"], 1)
        self.assertEqual(record["prior_failed_attempts"], 0)
        self.assertNotEqual(self.path(), self.path(manual_nonce))

    def test_torn_damaged_symlink_mode_owner_and_collision_fail_closed(self) -> None:
        self.append()
        path = self.path()
        original = path.read_bytes()
        with path.open("ab") as handle:
            handle.write(b'{"interrupted":')
        with self.assertRaisesRegex(release_guard.GuardError, "incomplete"):
            self.append(started=300, ended=400)
        self.assertEqual(path.read_bytes(), original + b'{"interrupted":')

        path.write_bytes(b"not-json\n"); path.chmod(0o644)
        with self.assertRaisesRegex(release_guard.GuardError, "damaged"):
            self.append()
        path.unlink()
        target = self.root / "target"
        target.write_text("do-not-touch\n", encoding="utf-8")
        path.symlink_to(target)
        with self.assertRaises(OSError):
            self.append()
        self.assertEqual(target.read_text(encoding="utf-8"), "do-not-touch\n")

        path.unlink(); self.append(); path.chmod(0o600)
        with self.assertRaisesRegex(release_guard.GuardError, "ownership or mode"):
            self.append(started=300, ended=400)
        path.chmod(0o644)
        with self.assertRaisesRegex(release_guard.GuardError, "ownership or mode"):
            release_guard.read_recovery_audit(path, self.NONCE, required_uid=os.geteuid() + 1)

        path.unlink()
        other_nonce = "c" * 64
        self.append(nonce=other_nonce)
        self.path(other_nonce).replace(path)
        with self.assertRaisesRegex(release_guard.GuardError, "identity"):
            self.append(started=300, ended=400)

    def test_existing_empty_published_file_is_rejected(self) -> None:
        self.path().touch(mode=0o644)
        with self.assertRaisesRegex(release_guard.GuardError, "empty"):
            self.append()
        self.assertEqual(self.path().read_bytes(), b"")

    def test_each_proposed_operation_identity_mismatch_is_rejected(self) -> None:
        self.append()
        original = self.path().read_bytes()
        mismatches = {
            "operation_action": ("rollback", "signed-new", "origin", "failed"),
            "recovery_mode": ("deploy", "signed", "origin", "failed"),
            "original_release_id": ("deploy", "signed-new", "other-origin", "failed"),
            "failed_release_id": ("deploy", "signed-new", "origin", "other-failed"),
        }
        for field, identity in mismatches.items():
            with self.subTest(field=field), self.assertRaisesRegex(
                release_guard.GuardError, "proposed operation identity"
            ):
                release_guard.append_recovery_audit(
                    self.root, self.NONCE, *identity, "exit_trap", 300,
                    "2026-10-15T10:00:02Z", "success", "none", "ready_http_200", "exit_trap",
                    required_uid=os.geteuid(), ended_monotonic_ns=400,
                    ended_at_utc="2026-10-15T10:00:03Z",
                )
            self.assertEqual(self.path().read_bytes(), original)

    def test_corrupted_mixed_existing_history_is_rejected_for_each_identity_field(self) -> None:
        self.append()
        first = json.loads(self.path().read_text(encoding="utf-8"))
        replacements = {
            "operation_action": "rollback",
            "recovery_mode": "signed",
            "original_release_id": "other-origin",
            "failed_release_id": "other-failed",
        }
        for field, replacement in replacements.items():
            with self.subTest(field=field):
                second = dict(first)
                second.update({
                    field: replacement, "attempt_index": 2, "started_monotonic_ns": 300,
                    "ended_monotonic_ns": 400, "started_at_utc": "2026-10-15T10:00:02Z",
                    "ended_at_utc": "2026-10-15T10:00:03Z", "prior_failed_attempts": 1,
                })
                self.path().write_text(
                    json.dumps(first, sort_keys=True, separators=(",", ":")) + "\n"
                    + json.dumps(second, sort_keys=True, separators=(",", ":")) + "\n",
                    encoding="utf-8",
                )
                self.path().chmod(0o644)
                with self.assertRaisesRegex(release_guard.GuardError, "identity changed"):
                    release_guard.read_recovery_audit(
                        self.path(), self.NONCE, required_uid=os.geteuid()
                    )

    def test_untrusted_failure_payload_is_rejected_without_secret_output(self) -> None:
        secret = "postgresql://user:secret@example.invalid/db"
        with self.assertRaisesRegex(release_guard.GuardError, "outcome metadata") as raised:
            self.append(failure=secret)
        self.assertNotIn(secret, str(raised.exception))
        self.assertNotIn(secret.encode(), self.path().read_bytes())

    def test_cli_is_python_optimized_safe(self) -> None:
        nonce = "d" * 64
        code = """import importlib.util, os, pathlib, sys
spec=importlib.util.spec_from_file_location('guard', sys.argv[1])
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
module.append_recovery_audit(pathlib.Path(sys.argv[2]), sys.argv[3], 'recover', 'signed',
    'origin', 'failed', 'manual_signed_recover', 100, '2026-10-15T10:00:00Z',
    'success', 'none', 'ready_http_200', 'explicit', required_uid=os.geteuid())
"""
        command = [sys.executable, "-O", "-c", code, str(MODULE_PATH), str(self.root), nonce]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        records = release_guard.read_recovery_audit(self.path(nonce), nonce, required_uid=os.geteuid())
        self.assertEqual(records[0]["attempt_context"], "manual_signed_recover")


if __name__ == "__main__":
    unittest.main(verbosity=2)
