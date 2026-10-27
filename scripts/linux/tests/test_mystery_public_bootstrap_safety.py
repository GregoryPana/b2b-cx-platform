#!/usr/bin/env python3
"""Failure-injection tests for bootstrap cutover and orphan maintenance.

The transaction tests execute real atomic file replacement/fsync behavior in a
sandbox. Script-order tests are explicitly structural: retained archive
signature verification, visudo, and lock/journal guards depend on host tools and
root namespaces and are separately rehearsed in a disposable root container.
"""
from __future__ import annotations

import importlib.util
import json
import os
import pathlib
import stat
import subprocess
import tempfile
import time
import unittest
from unittest import mock

TESTS = pathlib.Path(__file__).resolve().parent
SCRIPTS = TESTS.parent
HELPER_PATH = SCRIPTS / "mystery_public_bootstrap_transaction.py"
BOOTSTRAP = SCRIPTS / "bootstrap_mystery_public_deploy_entrypoint.sh"
ENTRYPOINT = SCRIPTS / "cwscx_mystery_public_deploy_entrypoint.sh"
spec = importlib.util.spec_from_file_location("bootstrap_transaction", HELPER_PATH)
assert spec and spec.loader
transaction = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transaction)


class BootstrapTransactionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.live = self.root / "live"
        self.stage = self.root / "stage"
        self.live.mkdir(mode=0o700)
        self.stage.mkdir(mode=0o700)
        self.journal = self.root / "bootstrap-journal.json"
        self.snapshot_root = self.root / "bootstrap-recovery"
        self.proposed = "a" * 64
        self.items: list[dict] = []
        for index, name in enumerate(("entrypoint", "installer", "guard", "trust", "sudoers", "version")):
            destination = self.live / name
            staged = self.stage / name
            staged.write_bytes(f"new-{name}\n".encode())
            staged.chmod(0o600)
            self.items.append({
                "label": name,
                "destination": str(destination),
                "staged": str(staged),
                "mode": 0o600,
                "identity": index == 5,
            })
        self.raw = json.dumps(self.items, separators=(",", ":"))

    def tearDown(self) -> None:
        self.temp.cleanup()

    def seed_old(self, *, absent: set[str] | None = None) -> dict[str, tuple[bytes, int, int]]:
        expected = {}
        absent = absent or set()
        for item in self.items:
            path = pathlib.Path(item["destination"])
            if item["label"] in absent:
                continue
            path.write_bytes(f"old-{item['label']}\n".encode())
            mode = 0o640 if item["label"] == "trust" else 0o600
            path.chmod(mode)
            old_mtime = time.time_ns() - 10_000_000_000
            os.utime(path, ns=(old_mtime, old_mtime))
            expected[item["label"]] = (path.read_bytes(), mode, path.stat().st_mtime_ns)
        return expected

    def assert_old(self, expected: dict[str, tuple[bytes, int, int]], absent: set[str]) -> None:
        for item in self.items:
            path = pathlib.Path(item["destination"])
            if item["label"] in absent:
                self.assertFalse(path.exists(), item["label"])
            else:
                data, mode, mtime = expected[item["label"]]
                self.assertEqual(path.read_bytes(), data)
                self.assertEqual(stat.S_IMODE(path.stat().st_mode), mode)
                self.assertEqual(path.stat().st_mtime_ns, mtime)

    def test_failed_partial_publish_restores_present_and_absent_exact_state(self) -> None:
        absent = {"guard", "trust", "sudoers", "version"}
        expected = self.seed_old(absent=absent)
        transaction.snapshot(self.journal, self.snapshot_root, self.items, self.proposed)
        original = transaction._atomic_copy
        calls = 0

        def fail_after_two(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 3:
                raise OSError("injected copy failure")
            return original(*args, **kwargs)

        with mock.patch.object(transaction, "_atomic_copy", side_effect=fail_after_two):
            with self.assertRaisesRegex(OSError, "injected copy failure"):
                transaction.publish(self.journal, self.items, self.proposed)
        self.assertTrue(self.journal.exists())
        transaction.recover(self.journal, self.items)
        self.assert_old(expected, absent)
        self.assertFalse(self.journal.exists())

    def test_sigterm_equivalent_recovery_after_full_publish_restores_prior_suite(self) -> None:
        expected = self.seed_old()
        transaction.snapshot(self.journal, self.snapshot_root, self.items, self.proposed)
        transaction.publish(self.journal, self.items, self.proposed)
        self.assertEqual((self.live / "version").read_text(), "new-version\n")
        transaction.recover(self.journal, self.items)
        self.assert_old(expected, set())

    def test_restored_phase_finalizes_tree_before_journal_without_rewriting_live_files(self) -> None:
        expected = self.seed_old()
        transaction.snapshot(self.journal, self.snapshot_root, self.items, self.proposed)
        transaction.publish(self.journal, self.items, self.proposed)
        with mock.patch.object(transaction, "_finalize_cleanup", side_effect=RuntimeError("crash before cleanup")):
            with self.assertRaisesRegex(RuntimeError, "crash before cleanup"):
                transaction.recover(self.journal, self.items)
        self.assert_old(expected, set())
        self.assertEqual(json.loads(self.journal.read_text())["phase"], "restored")
        self.assertTrue(self.snapshot_root.exists())
        with mock.patch.object(transaction, "_atomic_copy", side_effect=AssertionError("must not restore twice")):
            transaction.recover(self.journal, self.items)
        self.assertFalse(self.snapshot_root.exists())
        self.assertFalse(self.journal.exists())

    def test_wrong_version_refuses_before_publish(self) -> None:
        expected = self.seed_old()
        transaction.snapshot(self.journal, self.snapshot_root, self.items, self.proposed)
        with self.assertRaisesRegex(transaction.TransactionError, "does not authorize"):
            transaction.publish(self.journal, self.items, "b" * 64)
        self.assert_old(expected, set())

    def test_journal_or_snapshot_tamper_fails_closed_without_restoration(self) -> None:
        self.seed_old()
        transaction.snapshot(self.journal, self.snapshot_root, self.items, self.proposed)
        transaction.publish(self.journal, self.items, self.proposed)
        journal = json.loads(self.journal.read_text())
        snapshot = self.snapshot_root / journal["items"][0]["snapshot"]
        snapshot.write_text("tampered\n")
        with self.assertRaisesRegex(transaction.TransactionError, "digest mismatch"):
            transaction.recover(self.journal, self.items)
        self.assertTrue(self.journal.exists())
        self.assertEqual((self.live / "entrypoint").read_text(), "new-entrypoint\n")

    def test_identity_is_published_last_and_complete_rechecks_every_file(self) -> None:
        self.seed_old()
        transaction.snapshot(self.journal, self.snapshot_root, self.items, self.proposed)
        order: list[str] = []
        original = transaction._atomic_copy

        def record(source, destination, *args, **kwargs):
            order.append(pathlib.Path(destination).name)
            return original(source, destination, *args, **kwargs)

        with mock.patch.object(transaction, "_atomic_copy", side_effect=record):
            transaction.publish(self.journal, self.items, self.proposed)
        self.assertEqual(order[-1], "version")
        (self.live / "installer").write_text("mixed\n")
        with self.assertRaisesRegex(transaction.TransactionError, "differs from staged"):
            transaction.complete(self.journal, self.items, self.proposed)
        self.assertTrue(self.journal.exists())

    def test_every_malformed_second_record_preserves_all_live_destinations(self) -> None:
        mutations = {
            "destination": lambda r: r.__setitem__("destination", str(self.live / "wrong")),
            "snapshot": lambda r: r.__setitem__("snapshot", "00.snapshot"),
            "digest": lambda r: r.__setitem__("sha256", "not-a-digest"),
            "uid bool": lambda r: r.__setitem__("uid", True),
            "uid negative": lambda r: r.__setitem__("uid", -1),
            "uid other valid identity": lambda r: r.__setitem__("uid", os.geteuid() + 1),
            "mode writable": lambda r: r.__setitem__("mode", 0o666),
            "gid too large": lambda r: r.__setitem__("gid", 1 << 40),
            "mode string": lambda r: r.__setitem__("mode", "384"),
            "mode bool": lambda r: r.__setitem__("mode", True),
            "atime negative": lambda r: r.__setitem__("atime_ns", -1),
            "mtime too large": lambda r: r.__setitem__("mtime_ns", 1 << 70),
            "xattrs type": lambda r: r.__setitem__("xattrs", []),
            "xattr blank name": lambda r: r.__setitem__("xattrs", {"": ""}),
            "xattr bad base64": lambda r: r.__setitem__("xattrs", {"user.test": "%%%"}),
        }
        for label, mutate in mutations.items():
            with self.subTest(label=label):
                self.seed_old()
                transaction.snapshot(self.journal, self.snapshot_root, self.items, self.proposed)
                transaction.publish(self.journal, self.items, self.proposed)
                def fingerprint(item):
                    path = pathlib.Path(item["destination"])
                    info = path.stat()
                    return (path.read_bytes(), info.st_uid, info.st_gid, stat.S_IMODE(info.st_mode),
                            info.st_mtime_ns)
                live_before = {item["label"]: fingerprint(item) for item in self.items}
                journal = json.loads(self.journal.read_text())
                mutate(journal["items"][1])
                self.journal.write_text(json.dumps(journal, sort_keys=True, separators=(",", ":")) + "\n")
                self.journal.chmod(0o600)
                with self.assertRaises(transaction.TransactionError):
                    transaction.recover(self.journal, self.items)
                for item in self.items:
                    self.assertEqual(fingerprint(item), live_before[item["label"]])
                self.journal.unlink()
                import shutil
                shutil.rmtree(self.snapshot_root)

    def test_committed_recovery_finalizes_cleanup_without_restoring_old_suite(self) -> None:
        for state in ("complete-tree", "partial-tree", "missing-tree"):
            with self.subTest(state=state):
                self.seed_old()
                transaction.snapshot(self.journal, self.snapshot_root, self.items, self.proposed)
                transaction.publish(self.journal, self.items, self.proposed)
                journal = json.loads(self.journal.read_text())
                journal["phase"] = "committed"
                self.journal.write_text(json.dumps(journal, sort_keys=True, separators=(",", ":")) + "\n")
                self.journal.chmod(0o600)
                if state == "partial-tree":
                    (self.snapshot_root / journal["items"][0]["snapshot"]).unlink()
                elif state == "missing-tree":
                    import shutil
                    shutil.rmtree(self.snapshot_root)
                transaction.recover(self.journal, self.items, self.snapshot_root)
                self.assertFalse(self.journal.exists())
                self.assertFalse(self.snapshot_root.exists())
                for item in self.items:
                    self.assertEqual(pathlib.Path(item["destination"]).read_text(), f"new-{item['label']}\n")


class BootstrapAndOrphanContractTests(unittest.TestCase):
    def test_preflight_precedes_transaction_and_identity_is_last(self) -> None:
        text = BOOTSTRAP.read_text(encoding="utf-8")
        snapshot = text.index('"${TRANSACTION_HELPER_EXEC}" snapshot')
        self.assertLess(text.index('verify-archive "${ARCHIVE_ROOT}"'), snapshot)
        self.assertLess(text.index('visudo -cf "${PROPOSED_SUDOERS}"'), snapshot)
        self.assertIn('"identity":i==6', text)
        self.assertIn('TRANSACTION_HELPER_SNAPSHOT', text)
        self.assertNotIn('python3 -I "${TRANSACTION_HELPER_SRC}"', text)
        self.assertIn('PREVIOUS_SIGNING_PUBLIC_KEY_SRC=', text)
        self.assertIn('proposed signer set would invalidate an archived release', text)

    def test_bootstrap_and_entrypoint_share_lock_and_mixed_suite_is_blocked(self) -> None:
        bootstrap = BOOTSTRAP.read_text(encoding="utf-8")
        entrypoint = ENTRYPOINT.read_text(encoding="utf-8")
        self.assertIn('readonly DEPLOY_LOCK="${STATE_ROOT}/deploy.lock"', bootstrap)
        self.assertIn('exec 9>"${DEPLOY_LOCK}"\nflock -x 9', bootstrap)
        lock = entrypoint.index('flock -n -x 9')
        journal = entrypoint.index('interrupted privileged-suite bootstrap')
        suite_check = entrypoint.index('installed privileged suite differs from bootstrap identity')
        self.assertLess(lock, journal)
        self.assertLess(journal, suite_check)

    def test_orphan_cleanup_is_allowlisted_aged_and_suppressed_by_live_state(self) -> None:
        text = ENTRYPOINT.read_text(encoding="utf-8")
        function = text.split("cleanup_orphan_artifacts() {", 1)[1].split("\n}\n\nensure_archive_capacity", 1)[0]
        self.assertIn('time.time()-86400', function)
        self.assertIn('bundle\\.[A-Za-z0-9]+\\.zip', function)
        self.assertIn('preactivation-candidate-provenance', function)
        self.assertIn('BASELINE_RECOVERY_ROOT', function)
        self.assertIn('Signed archives, release directories,', function)
        self.assertNotIn('application-archives/*', function)
        authorization = text.index('authorize-operation "${ROOT_OPERATION}"')
        conflicts = text.index('[[ "${ACTION}" != "recover" ]] || die')
        call = text.index('cleanup_orphan_artifacts || die')
        self.assertLess(authorization, conflicts)
        self.assertLess(conflicts, call)

    def test_installer_uses_unique_root_controlled_release_temps(self) -> None:
        installer = (SCRIPTS / "install_mystery_public_bundle.sh").read_text(encoding="utf-8")
        self.assertIn('mktemp -d "${RELEASES_DIR}/.extract.XXXXXX"', installer)
        self.assertNotIn('/tmp/cwscx-mystery-public-extract.', installer)
        self.assertIn('mktemp -d "${RELEASES_DIR}/.${RELEASE_ID}.incoming.XXXXXX"', installer)

    def test_aged_allowlisted_orphans_are_removed_but_live_artifacts_are_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = pathlib.Path(raw)
            # Create roots before invoking the extracted cleaner.
            for name in ("state", "incoming", "releases", "target", "archives"):
                (root / name).mkdir(mode=0o700)
            aged_files = (
                root / "incoming/bundle.AbC123.zip",
                root / "incoming/bundle.AbC123.zip.sig",
                root / "incoming/operation.AbC123.json",
                root / "state/.preactivation-candidate.AbC123",
                root / "archives/.previous-release-id.AbC123",
            )
            aged_dirs = (root / "releases/.extract.AbC123", root / "releases/.release-1.incoming.AbC123")
            for path in aged_files:
                path.write_text("temporary\n")
            for path in aged_dirs:
                path.mkdir()
            protected = (
                root / "target/.env", root / "target/current", root / "target/shared-data",
                root / "archives/release-1", root / "releases/release-1",
            )
            for path in protected[:3]:
                path.write_text("keep\n")
            for path in protected[3:]:
                path.mkdir()
            old = time.time() - 90000
            for path in (*aged_files, *aged_dirs):
                os.utime(path, (old, old), follow_symlinks=False)
            text = ENTRYPOINT.read_text(encoding="utf-8")
            function = text.split("cleanup_orphan_artifacts() {", 1)[1].split("\n}\n\nensure_archive_capacity", 1)[0]
            script = function.split("<<'PY'\n", 1)[1].rsplit("\nPY", 1)[0]
            paths = [root / name for name in ("state", "incoming", "releases", "target", "archives")]
            result = subprocess.run(["python3", "-I", "-c", script, str(os.geteuid()), *(str(p) for p in paths)],
                                    text=True, capture_output=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertFalse(any(path.exists() for path in (*aged_files, *aged_dirs)))
            self.assertTrue(all(path.exists() for path in protected))

    def test_tampered_matching_orphan_is_preserved_and_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = pathlib.Path(raw)
            for name in ("state", "incoming", "releases", "target", "archives"):
                (root / name).mkdir(mode=0o700)
            tampered = root / "incoming/bundle.AbC123.zip"
            tampered.symlink_to(root / "outside")
            safe = root / "incoming/operation.Safe123.json"
            safe.write_text("preserve when any matching state is unsafe\n")
            old = time.time() - 90000
            os.utime(tampered, (old, old), follow_symlinks=False)
            os.utime(safe, (old, old), follow_symlinks=False)
            text = ENTRYPOINT.read_text(encoding="utf-8")
            function = text.split("cleanup_orphan_artifacts() {", 1)[1].split("\n}\n\nensure_archive_capacity", 1)[0]
            script = function.split("<<'PY'\n", 1)[1].rsplit("\nPY", 1)[0]
            paths = [root / name for name in ("state", "incoming", "releases", "target", "archives")]
            result = subprocess.run(["python3", "-I", "-c", script, str(os.geteuid()), *(str(p) for p in paths)],
                                    text=True, capture_output=True, check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("unsafe matching orphan artifact preserved", result.stderr)
            self.assertTrue(tampered.is_symlink())
            self.assertTrue(safe.is_file())


if __name__ == "__main__":
    unittest.main(verbosity=2)
