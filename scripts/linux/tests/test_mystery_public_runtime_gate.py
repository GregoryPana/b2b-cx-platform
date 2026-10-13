#!/usr/bin/env python3
"""Disposable real-venv regressions for the preactivation runtime gate."""

from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("release_guard", SCRIPTS / "mystery_public_release_guard.py")
assert spec and spec.loader
release_guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_guard)


class DisposableRuntimeGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.release = Path(self.temp.name) / "release"
        self.backend = self.release / "backend"
        self.backend.mkdir(parents=True)
        self.venv = self.backend / "venv"
        # Hosted setup-python toolcache can be owned by a different runner
        # identity. Copy the interpreter into this owner-controlled fixture;
        # production ownership checks must remain unchanged.
        subprocess.run([sys.executable, "-I", "-m", "venv", "--copies", str(self.venv)], check=True)
        version = subprocess.run(
            [str(self.venv / "bin/python"), "-I", "-c", "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        self.site = self.venv / "lib" / f"python{version}" / "site-packages"
        self.requirements = {
            "uvicorn": "0.30.1",
            "fastapi": "0.111.0",
            "alembic": "1.13.2",
            "SQLAlchemy": "2.0.30",
            "runtime-dependency": "1.0",
        }
        (self.backend / "requirements.txt").write_text(
            "\n".join(f"{name}=={version}" for name, version in self.requirements.items()) + "\n",
            encoding="utf-8",
        )
        for distribution, package_version in self.requirements.items():
            module = distribution.lower().replace("-", "_")
            package = self.site / module
            package.mkdir()
            (package / "__init__.py").write_text(f"__version__ = {package_version!r}\n", encoding="utf-8")
            dist_info = self.site / f"{distribution.replace('-', '_')}-{package_version}.dist-info"
            dist_info.mkdir()
            (dist_info / "METADATA").write_text(
                f"Metadata-Version: 2.1\nName: {distribution}\nVersion: {package_version}\n",
                encoding="utf-8",
            )
        launcher = self.venv / "bin/uvicorn"
        launcher.write_text(f"#!{self.venv / 'bin/python'}\nimport uvicorn\n", encoding="utf-8")
        launcher.chmod(0o755)

    def check(self) -> None:
        release_guard.check_runtime_usability(
            self.release,
            required_uid=os.getuid(),
            command_prefix=(),
        )

    def test_complete_disposable_virtualenv_passes(self) -> None:
        self.check()

    def test_missing_uvicorn_launcher_is_rejected(self) -> None:
        (self.venv / "bin/uvicorn").unlink()
        with self.assertRaisesRegex(release_guard.GuardError, "Uvicorn launcher"):
            self.check()

    def test_truncated_uvicorn_module_is_rejected_even_when_pip_check_passes(self) -> None:
        (self.site / "uvicorn/__init__.py").write_text("def truncated(:\n", encoding="utf-8")
        pip_check = subprocess.run(
            [str(self.venv / "bin/python"), "-I", "-m", "pip", "--isolated", "check"],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(pip_check.returncode, 0, pip_check.stderr)
        with self.assertRaisesRegex(release_guard.GuardError, "incomplete or inconsistent"):
            self.check()

    def test_absent_direct_requirement_is_rejected_even_when_pip_check_passes(self) -> None:
        for path in (self.site / "runtime_dependency", self.site / "runtime_dependency-1.0.dist-info"):
            if path.is_dir():
                import shutil
                shutil.rmtree(path)
        pip_check = subprocess.run(
            [str(self.venv / "bin/python"), "-I", "-m", "pip", "--isolated", "check"],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(pip_check.returncode, 0, pip_check.stderr)
        with self.assertRaisesRegex(release_guard.GuardError, "incomplete or inconsistent"):
            self.check()


if __name__ == "__main__":
    unittest.main(verbosity=2)
