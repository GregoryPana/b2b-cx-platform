#!/usr/bin/env python3
"""Privileged-suite Python isolation and fail-closed candidate deletion regressions.

A planted ``json.py`` / ``pip`` package in the caller's directory, a hostile
``PYTHONPATH`` and a user-site ``usercustomize`` must never execute in any
root-run Python of the entrypoint, installer or release backend scripts. Each
hostile artifact is benign: it only writes a sentinel file. The entrypoint and
installer are the real files; the release guard, systemctl and nginx are mocked.
The venv builder makes a real (pip-less) virtualenv whose ``pip`` is a recording
stand-in, so ``-I`` / ``--isolated`` are exercised by a real interpreter.

The second group pins ``discard_pre_activation_candidate``: a failed or empty
current-release lookup must preserve the candidate (it previously failed open
because the lookup sat inside a ``!=`` command substitution).
"""

from __future__ import annotations

import importlib.util
import json
import os
import re
import shutil
import subprocess
import unittest
from pathlib import Path

TESTS = Path(__file__).resolve().parent
SCRIPTS = TESTS.parent
spec = importlib.util.spec_from_file_location("preactivation_harness", TESTS / "test_mystery_public_preactivation_sigkill.py")
assert spec and spec.loader
harness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness)
ORIGIN = harness.ORIGIN
SYSTEM_PYTHON = "/usr/bin/python3"

PRIVILEGED_SCRIPTS = (
    "cwscx_mystery_public_deploy_entrypoint.sh",
    "install_mystery_public_bundle.sh",
    "bootstrap_mystery_public_deploy_entrypoint.sh",
    "deploy_mystery_public_backend.sh",
    "verify_mystery_public.sh",
)
INTERPRETER = re.compile(
    r'"\$\{PYTHON_BIN\}"|\bpython3\b|"\$\{VENV_DIR\}/bin/python"|venv/bin/python"|"\$\{venv\}/python"'
)
FIRST_INTERPRETER = re.compile(r'"\$\{PYTHON_BIN\}" -I|\bpython3 -I|"\$\{VENV_DIR\}/bin/python" -I')


def interpreter_lines(text: str):
    for number, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("#") or "-x " in stripped or "PYTHON_BIN=" in stripped:
            continue
        for match in INTERPRETER.finditer(line):
            yield number, line, line[match.end():]


class PythonPolicyContractTests(unittest.TestCase):
    def test_every_root_python_invocation_is_isolated(self) -> None:
        for name in PRIVILEGED_SCRIPTS:
            text = (SCRIPTS / name).read_text(encoding="utf-8")
            found = False
            for number, line, rest in interpreter_lines(text):
                found = True
                self.assertRegex(rest, r"^\s+-I(\s|$)", f"{name}:{number} runs Python without -I: {line.strip()}")
            self.assertTrue(found or name == "deploy_mystery_public_nginx.sh", name)

    def test_trusted_cwd_precedes_the_first_interpreter(self) -> None:
        for name in PRIVILEGED_SCRIPTS[:3]:
            text = (SCRIPTS / name).read_text(encoding="utf-8")
            cd_at = text.find("cd / ||")
            first = FIRST_INTERPRETER.search(text)
            self.assertGreaterEqual(cd_at, 0, f"{name} never enters a trusted working directory")
            self.assertTrue(first, name)
            self.assertLess(cd_at, first.start(), f"{name} runs Python before its trusted cd")

    def test_installer_pip_ignores_environment_and_user_configuration(self) -> None:
        text = (SCRIPTS / "install_mystery_public_bundle.sh").read_text(encoding="utf-8")
        self.assertIn("-I -m pip --isolated install", text)
        self.assertIn("-I -m pip --isolated check", text)
        guard = (SCRIPTS / "mystery_public_release_guard.py").read_text(encoding="utf-8")
        self.assertIn('"pip", "--isolated", "check"', guard)
        self.assertIn('"-I", "-c", RUNTIME_PROBE', guard)


class IsolationHarness(harness.EntrypointHarness):
    """Adds hostile caller artifacts and a real-interpreter venv builder to the entrypoint sandbox."""

    def setUp(self) -> None:
        super().setUp()
        self.sentinels = self.sb / "sentinels"
        self.sentinels.mkdir()
        self.hostile = self.sb / "hostile"
        self.hostile.mkdir()
        self.pip_log = self.sb / "pip.log"
        self.probe_log = self.sb / "guard-probe.log"
        version = subprocess.run(
            [SYSTEM_PYTHON, "-I", "-c", "import sys; print('%d.%d' % sys.version_info[:2])"],
            capture_output=True, text=True, check=True, cwd=str(self.sb)).stdout.strip()
        self.home = self.sb / "home"
        user_site = self.home / ".local/lib" / f"python{version}" / "site-packages"
        user_site.mkdir(parents=True)
        self.plant(self.hostile / "json.py", "json")
        (self.hostile / "pip").mkdir()
        self.plant(self.hostile / "pip/__init__.py", "pip-package")
        self.plant(self.hostile / "pip/__main__.py", "pip-main")
        self.plant(user_site / "usercustomize.py", "usercustomize")
        self.install_venv_builder()

    def plant(self, path: Path, name: str) -> None:
        path.write_text(
            f"open({str(self.sentinels / name)!r}, 'w').write('executed')\n"
            "raise ImportError('planted module executed')\n", encoding="utf-8")

    def install_venv_builder(self) -> None:
        fake_pip = (
            "import os, sys\n"
            f"with open({str(self.pip_log)!r}, 'a') as log:\n"
            "    log.write(' '.join(sys.argv[1:3]) + '|' + os.getcwd() + '|' + str(sys.flags.isolated) + '\\n')\n")
        builder = self.sb / "venv_builder.py"
        builder.write_text(
            "import os, pathlib, sys\n"
            "dest = pathlib.Path(sys.argv[1])\n"
            "(dest / 'bin').mkdir(parents=True)\n"
            "pip = dest / 'lib' / ('python%d.%d' % sys.version_info[:2]) / 'site-packages' / 'pip'\n"
            "pip.mkdir(parents=True)\n"
            "(dest / 'pyvenv.cfg').write_text('home = /usr/bin\\ninclude-system-site-packages = false\\n"
            "version = ' + sys.version.split()[0] + '\\n')\n"
            f"os.symlink({SYSTEM_PYTHON!r}, dest / 'bin' / 'python')\n"
            "(pip / '__init__.py').write_text('')\n"
            f"(pip / '__main__.py').write_text({fake_pip!r})\n"
            "uvicorn = dest / 'bin' / 'uvicorn'\n"
            "uvicorn.write_text('#!/usr/bin/env bash\\nexit 0\\n')\n"
            "uvicorn.chmod(0o755)\n", encoding="utf-8")
        self.builder = builder
        python3 = self.mock_bin / "python3"
        python3.write_text(
            "#!/usr/bin/env bash\nset -euo pipefail\n"
            '[[ "${1:-}" == "-I" ]] || { echo "python3 invoked without -I" >&2; exit 97; }\n'
            "shift\n"
            'if [[ "${1:-}" == "-m" && "${2:-}" == "venv" ]]; then\n'
            f'  exec {SYSTEM_PYTHON} -I {builder} "$3"\n'
            "fi\n"
            f'exec {SYSTEM_PYTHON} -I "$@"\n', encoding="utf-8")
        python3.chmod(0o755)

    def stage_completed_candidate(self, release_id: str = "done-release") -> tuple[Path, str, dict]:
        """A fully installed signed candidate, never archived, with its retained incoming artifacts."""
        bundle = self.make_bundle(release_id)
        staged = self.state / "incoming/bundle.AbC123.zip"
        signature = self.state / "incoming/bundle.AbC123.zip.sig"
        shutil.copyfile(bundle, staged)
        signature.write_text("sig\n", encoding="utf-8")
        for path in (staged, signature):
            path.chmod(0o600)
        claim = {"bundle_path": str(staged), "signature_path": str(signature), "install_verified": True}
        return self.make_installed_release(release_id), self.sha(bundle), claim

    def hostile_environment(self, **extra: str) -> dict[str, str]:
        return {**self.environment(), "PYTHONPATH": str(self.hostile), "HOME": str(self.home),
                "PIP_INDEX_URL": "http://127.0.0.1:9/hostile", "GUARD_PROBE_LOG": str(self.probe_log), **extra}

    def run_hostile(self, command: list[str], *, cwd: Path | None = None, **extra: str) -> subprocess.CompletedProcess:
        return subprocess.run(command, cwd=str(cwd or self.hostile), env=self.hostile_environment(**extra),
                              text=True, capture_output=True, check=False)

    def run_entrypoint_hostile(self, args: list[str], **extra: str) -> subprocess.CompletedProcess:
        return self.run_hostile(["bash", str(self.entrypoint), *args], **extra)

    def assert_no_sentinels(self) -> None:
        self.assertEqual(sorted(p.name for p in self.sentinels.iterdir()), [], "planted code executed as privileged Python")

    def pip_calls(self) -> list[tuple[str, str, str]]:
        rows = [line.split("|") for line in self.pip_log.read_text(encoding="utf-8").splitlines()] if self.pip_log.exists() else []
        return [(r[0], r[1], r[2]) for r in rows]


class PythonIsolationBehaviorTests(IsolationHarness):
    def test_hostile_files_really_shadow_unisolated_python(self) -> None:
        """Control: the same hostile directory and environment do break a plain interpreter."""
        result = self.run_hostile([SYSTEM_PYTHON, "-c", "import json"])
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue((self.sentinels / "json").exists())
        for sentinel in self.sentinels.iterdir():
            sentinel.unlink()
        ok = self.run_hostile([SYSTEM_PYTHON, "-I", "-c", "import json; print(json.dumps(1))"])
        self.assertEqual((ok.returncode, ok.stdout.strip()), (0, "1"), ok.stderr)
        self.assert_no_sentinels()

    def test_status_ignores_caller_directory_pythonpath_and_user_site(self) -> None:
        result = self.run_entrypoint_hostile(["--action", "status"])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["release_id"], ORIGIN)
        self.assert_no_sentinels()
        probes = [json.loads(line) for line in self.probe_log.read_text(encoding="utf-8").splitlines()]
        self.assertTrue(probes)
        for command, cwd, isolated, inherited_pythonpath in probes:
            self.assertEqual((cwd, isolated, inherited_pythonpath), ("/", 1, False), command)

    def test_relative_invocation_still_discovers_the_installed_entrypoint(self) -> None:
        result = self.run_hostile(["bash", "../entrypoint.sh", "--action", "status"])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["release_id"], ORIGIN)
        self.assert_no_sentinels()

    def test_signed_rollback_install_runs_entrypoint_installer_and_pip_isolated(self) -> None:
        bundle = self.make_bundle("target-release")
        digest = self.sha(bundle)
        self.archive("target-release", digest, bundle)
        result = self.run_entrypoint_hostile(self.signed_args("rollback", "target-release", digest))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(os.readlink(self.target / "current"), "releases/target-release")
        self.assert_no_sentinels()
        calls = self.pip_calls()
        self.assertEqual([c[0] for c in calls], ["--isolated install", "--isolated check"], calls)
        for _, cwd, isolated in calls:
            self.assertEqual((cwd, isolated), ("/", "1"))

    def test_standalone_installer_has_its_own_trusted_boundary(self) -> None:
        bundle = self.make_bundle("standalone-release")
        result = self.run_hostile(
            ["bash", str(harness.INSTALLER_SOURCE), "--install-only", str(bundle)],
            TARGET_ROOT=str(self.target), PYTHON_BIN=str(self.mock_bin / "python3"),
            PATH=f"{self.mock_bin}:{os.environ['PATH']}", EXPECTED_BUNDLE_SHA256=self.sha(bundle))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.releases / "standalone-release/backend/venv/bin/uvicorn").exists())
        self.assert_no_sentinels()
        self.assertEqual([c[0] for c in self.pip_calls()], ["--isolated install", "--isolated check"])

    def test_installer_discards_inherited_python_and_pip_variables(self) -> None:
        # PYTHON_BIN is the one deliberate override; every other PYTHON*/PIP_* variable is dropped.
        bundle = self.make_bundle("env-release")
        probe = self.sb / "env-probe"
        wrapper = self.sb / "wrapper-python3"
        wrapper.write_text(
            "#!/usr/bin/env bash\n"
            f'env | grep -E "^(PYTHON|PIP_)" | grep -v "^PYTHON_BIN=" >>{probe} || true\n'
            f'exec {self.mock_bin / "python3"} "$@"\n', encoding="utf-8")
        wrapper.chmod(0o755)
        result = self.run_hostile(
            ["bash", str(harness.INSTALLER_SOURCE), "--install-only", str(bundle)],
            TARGET_ROOT=str(self.target), PYTHON_BIN=str(wrapper), PYTHONHOME="/nonexistent", PYTHONSTARTUP="/x",
            PATH=f"{self.mock_bin}:{os.environ['PATH']}", EXPECTED_BUNDLE_SHA256=self.sha(bundle))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(probe.exists() and probe.read_text(encoding="utf-8").strip(), probe.read_text() if probe.exists() else "")
        self.assert_no_sentinels()

    def test_recover_runtime_reproof_routes_through_isolated_guard(self) -> None:
        candidate, digest, claim = self.stage_completed_candidate()
        venv = candidate / "backend/venv"
        shutil.rmtree(venv)
        subprocess.run([SYSTEM_PYTHON, "-I", str(self.builder), str(venv)], check=True, cwd=str(self.sb))
        self.write_marker("done-release", digest=digest, extra=claim)
        result = self.run_hostile(["bash", str(self.entrypoint), *self.signed_args("recover", ORIGIN, digest)])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(candidate.is_dir(), "a re-proven complete candidate must be preserved")
        self.assert_no_sentinels()
        probes = [json.loads(line)[0] for line in self.probe_log.read_text(encoding="utf-8").splitlines()]
        self.assertIn("check-runtime", probes)
        self.assertEqual(self.pip_calls(), [], "runtime execution belongs to the root-controlled guard")


class DiscardCandidateGuardTests(IsolationHarness):
    """discard_pre_activation_candidate must prove the candidate is not current BEFORE removing it."""

    def use_stub_installer(self) -> None:
        stub = self.sb / "stub-installer.sh"
        stub.write_text(
            "#!/usr/bin/env bash\nset -euo pipefail\n"
            f'mkdir -p "{self.releases}/new-release/backend/venv/bin"\n'
            'case "${STUB_MODE}" in\n'
            f'  drop-current) rm -f -- "{self.target}/current" ;;\n'
            f'  live-current) printf \'{{"release_id": "new-release"}}\\n\' >"{self.releases}/new-release/release-manifest.json"\n'
            f'                ln -sfn releases/new-release "{self.target}/current" ;;\n'
            "  plain-failure) ;;\n"
            "esac\nexit 1\n", encoding="utf-8")
        stub.chmod(0o700)
        text = self.entrypoint.read_text(encoding="utf-8")
        old = f'readonly INSTALLER="{harness.INSTALLER_SOURCE}"'
        self.assertIn(old, text)
        self.entrypoint.write_text(text.replace(old, f'readonly INSTALLER="{stub}"'), encoding="utf-8")
        (self.sb / "suite-version").write_text(
            harness.release_guard.privileged_suite_version([self.entrypoint, stub, self.sb / "guard.py", self.sb / "transaction.py"]) + "\n",
            encoding="ascii")

    def failed_deploy(self, mode: str) -> tuple[subprocess.CompletedProcess, Path]:
        self.use_stub_installer()
        bundle = self.make_bundle("new-release")
        result = self.run_entrypoint(self.signed_args("deploy", "new-release", self.sha(bundle), bundle=bundle),
                                     STUB_MODE=mode)
        self.assertNotEqual(result.returncode, 0)
        return result, self.releases / "new-release"

    def test_failed_current_lookup_preserves_the_candidate(self) -> None:
        result, candidate = self.failed_deploy("drop-current")
        self.assertTrue(candidate.is_dir(), "an unprovable non-current state must never delete a release")
        self.assertIn("Unactivated candidate cleanup needs VM-administrator review", result.stderr)
        self.assertTrue(self.marker.is_file(), "the marker must survive so a signed recover can reconcile")

    def test_normal_non_current_candidate_is_cleaned(self) -> None:
        result, candidate = self.failed_deploy("plain-failure")
        self.assertFalse(candidate.exists(), result.stderr)
        self.assertFalse(self.marker.exists())
        self.assert_current_origin_intact()

    def test_live_current_candidate_is_preserved(self) -> None:
        result, candidate = self.failed_deploy("live-current")
        self.assertTrue(candidate.is_dir())
        self.assertEqual(os.readlink(self.target / "current"), "releases/new-release")
        self.assertIn("Unactivated candidate cleanup needs VM-administrator review", result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
