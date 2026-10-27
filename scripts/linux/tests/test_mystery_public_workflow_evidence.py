#!/usr/bin/env python3
"""Behavioral tests for the deploy workflow evidence gates (fail-closed, python -O safe)."""
from __future__ import annotations

import copy
import datetime
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HELPER = ROOT / "scripts" / "linux" / "mystery_public_workflow_evidence.py"
WORKFLOW = ROOT / ".github" / "workflows" / "deploy-mystery-public.yml"
SUITE = "suite-v1"
NOW = datetime.datetime(2026, 10, 13, 12, 0, 0, tzinfo=datetime.timezone.utc)
ORIGIN, FAILED = "release-origin", "mystery-public-1-1-abc"


def status(release_id=ORIGIN, signed=True, baseline=True, **extra):
    state = {"release_id": release_id, "git_sha": "abc", "privileged_suite_version": SUITE,
             "signed_archive_verified": signed, "baseline_established": baseline,
             "baseline_release_id": release_id if baseline else None,
             "recovery_required": False, "pending_operation": None, "requested_release": None}
    state.update(extra)
    return state


# Names recorded by verify_mystery_public.sh on a complete run.
VERIFIER_CHECKS = ("tls_mode", "base_url", "current_release", "release_identity",
                   "environment_metadata", "database_ssl", "migration_heads",
                   "loopback_listener", "service_active", "restart_metadata",
                   "serving_release_identity", "fresh_restart", "local_ready", "local_session",
                   "public_ready", "public_session",
                   "public_frontend", "nginx_config")


def with_checks(payload, checks):
    """Replace checks and recompute an honest summary, so only the check set is under test."""
    passed = sum(c["status"] == "pass" for c in checks)
    return {**payload, "checks": checks,
            "summary": {"total": len(checks), "passed": passed, "failed": len(checks) - passed}}


def verification(release_id=ORIGIN, when=None, failed=0):
    """Fresh (now) verifier evidence by default; `failed` flips the last checks to fail."""
    when = when or datetime.datetime.now(datetime.timezone.utc)
    checks = [{"status": "pass", "name": name, "detail": ""} for name in VERIFIER_CHECKS]
    checks[VERIFIER_CHECKS.index("release_identity")]["detail"] = f"release_id={release_id}; git_sha=abc"
    for check in checks[len(checks) - failed:]:
        check["status"] = "fail"
    return with_checks({"schema_version": 1, "generated_at_utc": when.isoformat().replace("+00:00", "Z")}, checks)


def snapshot_restore(failed=FAILED, restored=ORIGIN):
    return {"failed_release_id": failed, "restored_release_id": restored,
            "recovery": "fixed_config_snapshot", "approved_fallback": False}


AUTHORIZATION = "e" * 64


def preactivation_cleanup(when=None, failed=FAILED, origin=ORIGIN, digest=AUTHORIZATION, **overrides):
    """Record written by the entrypoint after an interrupted install with an unauthenticated origin."""
    when = when or datetime.datetime.now(datetime.timezone.utc)
    record = {"schema_version": 1, "recovery": "preactivation_cleanup_unauthenticated_origin",
              "preactivation_operation": "establish_baseline", "failed_release_id": failed,
              "origin_release_id": origin, "authorization_sha256": digest, "candidate_disposition": "removed",
              "switch_occurred": False, "config_restored": False, "origin_authenticated": False,
              "approved_fallback": False, "origin_ready": True,
              "origin_health_probe": "systemd_active_and_loopback_ready",
              "generated_at_utc": when.strftime("%Y-%m-%dT%H:%M:%SZ")}
    record.update(overrides)
    return record


def run_helper(*args, optimize=False):
    cmd = [sys.executable] + (["-O"] if optimize else []) + [str(HELPER), *map(str, args)]
    return subprocess.run(cmd, capture_output=True, text=True, env={"PYTHONOPTIMIZE": "1"} if optimize else {})


class GateTests(unittest.TestCase):
    """Run each gate through the CLI, both normally and under python -O."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)

    def write(self, name, data):
        path = self.dir / name
        path.write_text(data if isinstance(data, str) else json.dumps(data), encoding="utf-8")
        return path

    def both_modes(self, *args):
        return [run_helper(*args, optimize=o) for o in (False, True)]

    def assert_rejected(self, *args):
        for result in self.both_modes(*args):
            self.assertNotEqual(result.returncode, 0, result.stdout)

    def unique(self, stem):
        """Per-call fixture name so cases built eagerly into a dict never overwrite each other."""
        self._serial = getattr(self, "_serial", 0) + 1
        return f"{stem}-{self._serial}.json"

    def verify_args(self, verif, state, kind="deploy", release_id="new", sha="abc"):
        return ("verify-success", kind, self.write(self.unique("v"), verif), self.write(self.unique("s"), state), release_id, sha, SUITE)

    def test_workflow_has_no_assert_gates(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        self.assertIsNone(re.search(r"^\s*assert\b", text, re.M))

    def test_valid_deploy_evidence_accepted(self):
        good = self.verify_args(verification("new"), status("new"))
        for result in self.both_modes(*good):
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_invalid_success_evidence_rejected_even_when_optimized(self):
        cases = {
            "failed check": (verification("new", failed=1), status("new")),
            "empty checks": ({**verification("new"), "checks": [], "summary": {"total": 0, "passed": 0, "failed": 0}}, status("new")),
            "summary mismatch": ({**verification("new"), "summary": {"total": 5, "passed": 2, "failed": 0}}, status("new")),
            "wrong release": (verification("new"), status("other")),
            "unsigned": (verification("new"), status("new", signed=False)),
            "wrong sha": (verification("new"), status("new", git_sha="zzz")),
            "wrong suite": (verification("new"), status("new", privileged_suite_version="old")),
            "pending journal": (verification("new"), status("new", recovery_required=True, pending_operation={"mode": "signed"})),
            "non-boolean": (verification("new"), status("new", signed_archive_verified="yes")),
        }
        for name, (verif, state) in cases.items():
            with self.subTest(name):
                self.assert_rejected(*self.verify_args(verif, state))

    def test_missing_and_malformed_success_evidence_rejected(self):
        state = self.write("s.json", status("new"))
        for name, content in (("malformed", "{not json"), ("empty object", "{}"), ("list", "[]")):
            with self.subTest(name):
                self.assert_rejected("verify-success", "deploy", self.write("v.json", content), state, "new", "abc", SUITE)
        self.assert_rejected("verify-success", "deploy", self.dir / "absent.json", state, "new", "abc", SUITE)

    def test_baseline_success_requires_baseline_for_target(self):
        good = self.verify_args(verification("new"), status("new"), kind="baseline")
        for result in self.both_modes(*good):
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_rejected(*self.verify_args(verification("new"), status("new", baseline=False), kind="baseline"))
        self.assert_rejected(*self.verify_args(verification("new"), status("new", baseline_release_id="x"), kind="baseline"))

    def test_rollback_success_does_not_need_git_sha(self):
        args = self.verify_args(verification("tgt"), status("tgt"), kind="rollback", release_id="tgt", sha="")
        for result in self.both_modes(*args):
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_final_recover_gate(self):
        ok_files = (self.write("a.json", status(ORIGIN)), ORIGIN, self.write("r.json", verification(ORIGIN, datetime.datetime.now(datetime.timezone.utc))), SUITE, FAILED, ORIGIN)
        for result in self.both_modes("final-recover", *ok_files):
            self.assertEqual(result.returncode, 0, result.stderr)
        # Empty/truthy-but-meaningless evidence used to satisfy `assert evidence`.
        self.assert_rejected("final-recover", self.write("a.json", status(ORIGIN)), ORIGIN, self.write("r.json", {"x": 1}), SUITE, FAILED, ORIGIN)
        self.assert_rejected("final-recover", self.write("a.json", status(ORIGIN, recovery_required=True)), ORIGIN, self.write("r.json", snapshot_restore()), SUITE, FAILED, ORIGIN)
        self.assert_rejected("final-recover", self.write("a.json", status("elsewhere")), ORIGIN, self.write("r.json", snapshot_restore()), SUITE, FAILED, ORIGIN)

    def final_args(self, state, evidence, expected=ORIGIN):
        return ("final-recover", self.write(self.unique("a"), state), expected, self.write(self.unique("r"), evidence), SUITE, FAILED, ORIGIN)

    def test_final_recover_baseline_modes_accept_only_their_end_state(self):
        unsigned = status(signed=False, baseline=False)
        committed = status(FAILED, baseline=True, baseline_release_id=FAILED)
        for name, args in {
            "uncommitted baseline-origin restore": self.final_args(unsigned, snapshot_restore()),
            "committed baseline recovery": self.final_args(committed, verification(FAILED), expected=FAILED),
            "signed recovery": self.final_args(status(), verification(ORIGIN)),
        }.items():
            with self.subTest(name):
                for result in self.both_modes(*args):
                    self.assertEqual(result.returncode, 0, result.stderr)

    def test_final_recover_rejects_inconsistent_baseline_and_signed_modes(self):
        unsigned = status(signed=False, baseline=False)
        cases = {
            "wrong expected origin": self.final_args(unsigned, snapshot_restore(), expected="other"),
            "expected is failed release for snapshot": self.final_args(status(FAILED, signed=False, baseline=False), snapshot_restore(), expected=FAILED),
            "unsigned state with signed recovery evidence": self.final_args(unsigned, verification(ORIGIN)),
            "signed state with snapshot evidence": self.final_args(status(), snapshot_restore()),
            "snapshot with baseline established": self.final_args(status(signed=False, baseline=True), snapshot_restore()),
            "snapshot with baseline release recorded": self.final_args(status(signed=False, baseline=False, baseline_release_id=ORIGIN), snapshot_restore()),
            "failed release without baseline marker": self.final_args(status(FAILED, baseline=False), verification(FAILED), expected=FAILED),
            "failed release baseline marker elsewhere": self.final_args(status(FAILED, baseline=True, baseline_release_id=ORIGIN), verification(FAILED), expected=FAILED),
            "signed health bound to other release": self.final_args(status(), verification(FAILED)),
            "stale signed health": self.final_args(status(), verification(ORIGIN, datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=5))),
            "absent pending_operation": self.final_args({k: v for k, v in status().items() if k != "pending_operation"}, verification(ORIGIN)),
        }
        for name, args in cases.items():
            with self.subTest(name):
                self.assert_rejected(*args)

    def cleanup_args(self, state, evidence, mode="preactivation", digest=AUTHORIZATION, expected=ORIGIN):
        args = ["final-recover", self.write(self.unique("a"), state), expected, self.write(self.unique("r"), evidence),
                SUITE, FAILED, ORIGIN]
        return (*args, mode, digest) if mode is not None else tuple(args)

    def test_final_recover_accepts_preactivation_cleanup_only_for_its_mode(self):
        unsigned = status(signed=False, baseline=False)
        for result in self.both_modes(*self.cleanup_args(unsigned, preactivation_cleanup())):
            self.assertEqual(result.returncode, 0, result.stderr)
        for disposition in ("removed", "preserved_complete", "absent"):
            for operation in ("deploy", "establish_baseline", "rollback"):
                with self.subTest(disposition + "/" + operation):
                    record = preactivation_cleanup(candidate_disposition=disposition, preactivation_operation=operation)
                    self.assertEqual(run_helper(*self.cleanup_args(unsigned, record)).returncode, 0)

    def test_final_recover_rejects_bad_preactivation_cleanup_evidence(self):
        unsigned = status(signed=False, baseline=False)
        now = datetime.datetime.now(datetime.timezone.utc)
        good = preactivation_cleanup()
        without = lambda key: {k: v for k, v in good.items() if k != key}
        cases = {
            "stale": self.cleanup_args(unsigned, preactivation_cleanup(now - datetime.timedelta(hours=5))),
            "future": self.cleanup_args(unsigned, preactivation_cleanup(now + datetime.timedelta(hours=1))),
            "unparseable timestamp": self.cleanup_args(unsigned, preactivation_cleanup(generated_at_utc="yesterday")),
            "missing timestamp": self.cleanup_args(unsigned, without("generated_at_utc")),
            "missing field": self.cleanup_args(unsigned, without("origin_ready")),
            "extra field": self.cleanup_args(unsigned, {**good, "recovery_note": "x"}),
            "wrong failed release": self.cleanup_args(unsigned, preactivation_cleanup(failed="other")),
            "wrong origin release": self.cleanup_args(unsigned, preactivation_cleanup(origin="other")),
            "wrong authorization": self.cleanup_args(unsigned, preactivation_cleanup(digest="f" * 64)),
            "malformed authorization": self.cleanup_args(unsigned, preactivation_cleanup(digest="XYZ"), digest="XYZ"),
            "authorization not passed": self.cleanup_args(unsigned, good, digest=""),
            "claims config restore": self.cleanup_args(unsigned, preactivation_cleanup(config_restored=True)),
            "claims switch": self.cleanup_args(unsigned, preactivation_cleanup(switch_occurred=True)),
            "claims authenticated origin": self.cleanup_args(unsigned, preactivation_cleanup(origin_authenticated=True)),
            "claims approved fallback": self.cleanup_args(unsigned, preactivation_cleanup(approved_fallback=True)),
            "origin not ready": self.cleanup_args(unsigned, preactivation_cleanup(origin_ready=False)),
            "truthy non-boolean": self.cleanup_args(unsigned, preactivation_cleanup(config_restored=0)),
            "unknown probe": self.cleanup_args(unsigned, preactivation_cleanup(origin_health_probe="trust-me")),
            "unknown disposition": self.cleanup_args(unsigned, preactivation_cleanup(candidate_disposition="deleted-everything")),
            "unknown operation": self.cleanup_args(unsigned, preactivation_cleanup(preactivation_operation="rm-rf")),
            "wrong schema": self.cleanup_args(unsigned, preactivation_cleanup(schema_version=2)),
            "wrong recovery kind": self.cleanup_args(unsigned, preactivation_cleanup(recovery="fixed_config_snapshot")),
            "mode omitted": self.cleanup_args(unsigned, good, mode=None),
            "other mode": self.cleanup_args(unsigned, good, mode="baseline-origin"),
            "signed mode": self.cleanup_args(unsigned, good, mode="signed"),
            "unknown mode": self.cleanup_args(unsigned, good, mode="anything"),
            "signed state": self.cleanup_args(status(), good),
            "baseline recorded": self.cleanup_args(status(signed=False, baseline=True), good),
            "pending journal": self.cleanup_args(status(signed=False, baseline=False, recovery_required=True,
                                                        pending_operation={"mode": "preactivation"}), good),
            "landed on failed release": self.cleanup_args(status(FAILED, signed=False, baseline=False), good, expected=FAILED),
            "snapshot record in preactivation mode": self.cleanup_args(unsigned, snapshot_restore()),
        }
        for name, args in cases.items():
            with self.subTest(name):
                self.assert_rejected(*args)

    def test_cleanup_record_cannot_pass_as_config_restore_or_signed_health(self):
        unsigned = status(signed=False, baseline=False)
        # Legacy six-argument form: only the fixed-config snapshot record shape is acceptable.
        self.assert_rejected(*self.cleanup_args(unsigned, preactivation_cleanup(), mode=None))
        for result in self.both_modes(*self.final_args(unsigned, snapshot_restore())):
            self.assertEqual(result.returncode, 0, result.stderr)
        # The extra mode/checksum arguments do not weaken signed or committed-baseline recovery.
        signed = ("final-recover", self.write(self.unique("a"), status()), ORIGIN,
                  self.write(self.unique("r"), verification(ORIGIN)), SUITE, FAILED, ORIGIN)
        for mode in ("signed", "signed-new", "preactivation"):
            with self.subTest(mode):
                for result in self.both_modes(*signed, mode, AUTHORIZATION):
                    self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_rejected(*signed, "preactivation")  # mode without its checksum is malformed

    def test_verification_must_contain_every_unique_verifier_check(self):
        def broken_checks(release_id):
            base = verification(release_id)
            by_name = {c["name"]: c for c in base["checks"]}

            def without(name):
                return with_checks(base, [c for c in base["checks"] if c["name"] != name])

            return {
                "missing health check, all-pass summary": without("local_ready"),
                "missing identity check": without("release_identity"),
                "only identity check": with_checks(base, [by_name["release_identity"]]),
                "duplicate health check": with_checks(base, base["checks"] + [by_name["public_ready"]]),
                "duplicate identity check": with_checks(base, base["checks"] + [by_name["release_identity"]]),
                "unnamed check": with_checks(base, base["checks"][:-1] + [{"status": "pass", "detail": ""}]),
                "stale evidence": verification(release_id, datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=5)),
                "other release identity": verification("other"),
            }

        for name, verif in broken_checks("new").items():
            with self.subTest("success " + name):
                self.assert_rejected(*self.verify_args(verif, status("new")))
        # Authenticated recovery evidence gets the identical treatment.
        for name, verif in broken_checks(ORIGIN).items():
            with self.subTest("recovery " + name):
                self.assert_rejected(*self.final_args(status(), verif))

    def test_success_requires_explicit_pending_operation_field(self):
        state = {k: v for k, v in status("new").items() if k != "pending_operation"}
        self.assert_rejected(*self.verify_args(verification("new"), state))
        self.assert_rejected(*self.verify_args(verification("new"), status("new", pending_operation={"mode": "signed"}, recovery_required=False)))

    def test_success_binds_git_sha_in_verifier_identity(self):
        self.assert_rejected(*self.verify_args(verification("new"), status("new", git_sha="other"), sha="other"))


class RecoveryClassificationTests(unittest.TestCase):
    def classify(self, before, after, recovery, origin=ORIGIN):
        import importlib.util
        spec = importlib.util.spec_from_file_location("wf_evidence", HELPER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.module = module
        return module.classify_recovery(before, after, recovery, origin, FAILED, SUITE, now=NOW)

    def label_of_failure(self, *args, **kwargs):
        try:
            self.classify(*args, **kwargs)
        except Exception as exc:
            return getattr(exc, "label", "raw:" + type(exc).__name__)
        return None

    def test_signed_origin_with_fresh_health_is_authenticated_recovery(self):
        self.assertEqual(self.classify(status(), status(), verification(ORIGIN, NOW)), "recovered_authenticated")

    def test_baseline_origin_is_operationally_restored_never_authenticated(self):
        before = status(signed=False, baseline=False)
        after = status(signed=False, baseline=False)
        self.assertEqual(self.classify(before, after, snapshot_restore()), "operationally_restored_unauthenticated")

    def test_baseline_origin_cannot_use_signed_health_claim_or_report_signed(self):
        before = status(signed=False, baseline=False)
        # post-operation state claiming authentication for an unauthenticated origin is unsafe
        self.assertEqual(self.label_of_failure(before, status(signed=True, baseline=False), snapshot_restore()), "unsafe")
        self.assertEqual(self.label_of_failure(before, status(signed=False, baseline=True), snapshot_restore()), "unsafe")

    def test_snapshot_record_cannot_satisfy_signed_origin(self):
        # fixed-config record has no per-check health; must not substitute for fresh verifier evidence
        self.assertEqual(self.label_of_failure(status(), status(), snapshot_restore()), "incomplete")

    def test_incomplete_and_fail_closed_cases(self):
        good = verification(ORIGIN, NOW)
        cases = {
            "missing before": (None, status(), good),
            "missing after": (status(), None, good),
            "missing recovery": (status(), status(), None),
            "pending journal": (status(), status(recovery_required=True, pending_operation={"mode": "signed"}), good),
            "journal without flag": (status(), status(pending_operation={"mode": "signed"}), good),
            "wrong live release": (status(), status("other"), good),
            "origin not live origin": (status("other"), status("other"), good),
            "origin archive lost": (status(), status(signed=False), good),
            "stale health": (status(), status(), verification(ORIGIN, NOW - datetime.timedelta(hours=5))),
            "future health": (status(), status(), verification(ORIGIN, NOW + datetime.timedelta(hours=1))),
            "health for other release": (status(), status(), verification("other", NOW)),
            "failed health checks": (status(), status(), verification(ORIGIN, NOW, failed=1)),
            "unparseable timestamp": (status(), status(), {**good, "generated_at_utc": "yesterday"}),
            "wrong suite": (status(), status(privileged_suite_version="old"), good),
            "snapshot wrong pair": (status(signed=False, baseline=False), status(signed=False, baseline=False), snapshot_restore(restored="x")),
            "snapshot claims fallback": (status(signed=False, baseline=False), status(signed=False, baseline=False), {**snapshot_restore(), "approved_fallback": True}),
        }
        for name, (before, after, recovery) in cases.items():
            with self.subTest(name):
                self.assertEqual(self.label_of_failure(copy.deepcopy(before), copy.deepcopy(after), copy.deepcopy(recovery)), "incomplete")

    def test_cli_classification_output_and_exit_codes(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            def put(name, data):
                (tmp / name).write_text(json.dumps(data), encoding="utf-8")
                return tmp / name
            before, after = put("b.json", status(signed=False, baseline=False)), put("a.json", status(signed=False, baseline=False))
            restore = put("r.json", snapshot_restore())
            for optimize in (False, True):
                ok = run_helper("classify-recovery", before, after, restore, ORIGIN, FAILED, SUITE, optimize=optimize)
                self.assertEqual(ok.returncode, 0, ok.stderr)
                self.assertIn("RECOVERY_CLASSIFICATION=operationally_restored_unauthenticated", ok.stdout)
                self.assertIn("NOT an authenticated rollback", ok.stdout)
                self.assertNotIn("recovered_authenticated", ok.stdout)
                missing = run_helper("classify-recovery", before, tmp / "nope.json", restore, ORIGIN, FAILED, SUITE, optimize=optimize)
                self.assertNotEqual(missing.returncode, 0)
                self.assertIn("RECOVERY_CLASSIFICATION=incomplete", missing.stderr)


class WorkflowWiringTests(unittest.TestCase):
    def test_failed_operations_classify_then_preserve_original_exit(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        blocks = re.findall(r"if \(\( STATUS != 0 \)\); then\n(.*?)\n\s+fi\n", text, re.S)
        self.assertEqual(len(blocks), 3, "baseline, deploy and rollback must each classify failures")
        for block in blocks:
            self.assertIn("classify-recovery", block)
            self.assertTrue(block.rstrip().endswith('exit "${STATUS}"'))
            self.assertLess(block.index("classify-recovery"), block.index('exit "${STATUS}"'))
        self.assertNotIn("(( STATUS == 0 )) || exit", text)
        for kind in ("baseline", "deploy", "rollback"):
            self.assertIn(f"verify-success {kind} ", text)
        self.assertIn("final-recover", text)


if __name__ == "__main__":
    unittest.main()
