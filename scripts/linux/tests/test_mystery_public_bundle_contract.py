#!/usr/bin/env python3
"""Archive-level contracts for generated Mystery Public release bundles."""

from __future__ import annotations

import hashlib
import importlib.util
import os
import stat
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1]
VALIDATOR_PATH = SCRIPTS / "validate_mystery_public_bundle.py"
SPEC = importlib.util.spec_from_file_location("bundle_contract", VALIDATOR_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("unable to load the bundle contract validator")
bundle_contract = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bundle_contract)


class BundleContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.guard_bytes = (SCRIPTS / "mystery_public_release_guard.py").read_bytes()

    def tearDown(self) -> None:
        self.temp.cleanup()

    def base_files(self) -> dict[str, bytes]:
        files = {name: f"fixture:{name}\n".encode("utf-8") for name in bundle_contract.REQUIRED_RUNTIME_FILES}
        files["release/scripts/linux/mystery_public_release_guard.py"] = self.guard_bytes
        return files

    def write_bundle(
        self,
        files: dict[str, bytes] | None = None,
        *,
        omitted_hashes: set[str] | None = None,
        duplicate: str | None = None,
        unsafe: str | None = None,
        nonregular: str | None = None,
        hashes_from: dict[str, bytes] | None = None,
    ) -> Path:
        archive_files = self.base_files() if files is None else dict(files)
        hash_files = archive_files if hashes_from is None else hashes_from
        omitted = omitted_hashes or set()
        sums = []
        for name, payload in sorted(hash_files.items()):
            relative = name.removeprefix("release/")
            if relative not in omitted:
                sums.append(f"{hashlib.sha256(payload).hexdigest()}  {relative}")
        archive_files[bundle_contract.SUMS_MEMBER] = ("\n".join(sums) + "\n").encode("ascii")
        bundle = self.root / f"bundle-{len(list(self.root.glob('bundle-*.zip')))}.zip"
        with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as archive:
            for name, payload in sorted(archive_files.items()):
                if name == nonregular:
                    info = zipfile.ZipInfo(name)
                    info.create_system = 3
                    info.external_attr = (stat.S_IFLNK | 0o777) << 16
                    archive.writestr(info, b"target")
                else:
                    self.write_regular(archive, name, payload)
            if duplicate is not None:
                self.write_regular(archive, duplicate, archive_files[duplicate])
            if unsafe is not None:
                self.write_regular(archive, unsafe, b"unsafe\n")
        return bundle

    @staticmethod
    def write_regular(archive: zipfile.ZipFile, name: str, payload: bytes) -> None:
        info = zipfile.ZipInfo(name)
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        archive.writestr(info, payload)

    def test_valid_archive_contract(self) -> None:
        bundle_contract.validate_bundle(self.write_bundle())

    def test_missing_guard_is_rejected(self) -> None:
        files = self.base_files()
        del files["release/scripts/linux/mystery_public_release_guard.py"]
        with self.assertRaisesRegex(bundle_contract.BundleContractError, "mystery_public_release_guard.py"):
            bundle_contract.validate_bundle(self.write_bundle(files))

    def test_guard_missing_from_hash_manifest_is_rejected(self) -> None:
        with self.assertRaisesRegex(bundle_contract.BundleContractError, "members missing from SHA256SUMS"):
            bundle_contract.validate_bundle(
                self.write_bundle(omitted_hashes={"scripts/linux/mystery_public_release_guard.py"})
            )

    def test_tampered_guard_is_rejected(self) -> None:
        original = self.base_files()
        tampered = dict(original)
        tampered["release/scripts/linux/mystery_public_release_guard.py"] += b"\n# tampered\n"
        with self.assertRaisesRegex(bundle_contract.BundleContractError, "SHA256SUMS mismatch"):
            bundle_contract.validate_bundle(self.write_bundle(tampered, hashes_from=original))

    def test_duplicate_archive_member_is_rejected(self) -> None:
        duplicate = "release/scripts/linux/mystery_public_release_guard.py"
        with self.assertRaisesRegex(bundle_contract.BundleContractError, "duplicate archive member"):
            bundle_contract.validate_bundle(self.write_bundle(duplicate=duplicate))

    def test_unsafe_archive_member_is_rejected(self) -> None:
        with self.assertRaisesRegex(bundle_contract.BundleContractError, "unsafe archive member"):
            bundle_contract.validate_bundle(self.write_bundle(unsafe="release/../escape"))

    def test_nonregular_archive_member_is_rejected(self) -> None:
        guard = "release/scripts/linux/mystery_public_release_guard.py"
        with self.assertRaisesRegex(bundle_contract.BundleContractError, "not a regular file"):
            bundle_contract.validate_bundle(self.write_bundle(nonregular=guard))

    def test_bundled_guard_resolves_deployer_dependency_and_rejects_unsafe_environment(self) -> None:
        bundle = self.write_bundle()
        bundle_contract.validate_bundle(bundle)
        extracted_guard = self.root / "extracted" / "mystery_public_release_guard.py"
        extracted_guard.parent.mkdir()
        with zipfile.ZipFile(bundle) as archive:
            extracted_guard.write_bytes(
                archive.read("release/scripts/linux/mystery_public_release_guard.py")
            )

        safe_metadata = self.root / "synthetic-safe.env"
        safe_metadata.write_text(
            "ENVIRONMENT=production\n"
            "AUTH_MODE=mystery_public\n"
            "DATABASE_URL=postgresql://synthetic:synthetic@192.0.2.1/synthetic?sslmode=require\n"
            "CORS_ALLOW_ORIGINS=https://mystery.invalid\n"
            "MYSTERY_AUTH_SECRET_KEY=synthetic-test-only\n"
            "LOCAL_DEVELOPMENT_AUTO_DDL=0\n",
            encoding="utf-8",
        )
        safe = subprocess.run(
            [sys.executable, "-I", str(extracted_guard), "check-production-environment", str(safe_metadata)],
            text=True,
            capture_output=True,
            check=False,
            timeout=5,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
        )
        self.assertEqual(safe.returncode, 0, safe.stderr)
        self.assertIn("validated", safe.stdout)

        unsafe_metadata = self.root / "synthetic-unsafe.env"
        unsafe_metadata.write_text(
            safe_metadata.read_text(encoding="utf-8").replace(
                "LOCAL_DEVELOPMENT_AUTO_DDL=0", "LOCAL_DEVELOPMENT_AUTO_DDL=1"
            ),
            encoding="utf-8",
        )
        unsafe = subprocess.run(
            [sys.executable, "-I", str(extracted_guard), "check-production-environment", str(unsafe_metadata)],
            text=True,
            capture_output=True,
            check=False,
            timeout=5,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
        )
        self.assertNotEqual(unsafe.returncode, 0)
        self.assertIn("must disable LOCAL_DEVELOPMENT_AUTO_DDL", unsafe.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
