#!/usr/bin/env python3
"""Fail-closed evidence gates for .github/workflows/deploy-mystery-public.yml.

Every gate raises EvidenceError explicitly (never ``assert``) so that running
under ``python -O`` / PYTHONOPTIMIZE cannot disable validation.

Workflow-only helper: it runs on the GitHub runner and is intentionally not part
of the privileged VM suite identity.
"""
from __future__ import annotations

import datetime
import json
import re
import sys
from pathlib import Path

RELEASE_ID_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,159}")
DEFAULT_MAX_EVIDENCE_AGE_SECONDS = 3600
CLOCK_SKEW_SECONDS = 120

# Every check verify_mystery_public.sh records on a complete run (names are its contract).
REQUIRED_VERIFICATION_CHECKS = (
    "tls_mode", "base_url", "current_release", "release_identity",
    "environment_metadata", "database_ssl", "migration_heads",
    "loopback_listener", "service_active", "restart_metadata",
    "local_ready", "local_session",
    "public_ready", "public_session", "public_frontend", "nginx_config",
)

RECOVERED_AUTHENTICATED = "recovered_authenticated"
RESTORED_UNAUTHENTICATED = "operationally_restored_unauthenticated"
INCOMPLETE = "incomplete"
UNSAFE = "unsafe"


class EvidenceError(Exception):
    """Evidence is missing, malformed or contradicts the expected state."""


class Classification(EvidenceError):
    def __init__(self, label: str, reason: str):
        super().__init__(reason)
        self.label = label


def require(condition: object, message: str) -> None:
    if not condition:
        raise EvidenceError(message)


def load_json_object(path: str | Path, label: str) -> dict:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise EvidenceError(f"{label} is missing or malformed: {exc}") from exc
    require(isinstance(data, dict) and data, f"{label} is not a non-empty JSON object")
    return data


def _release_id(value: object, label: str) -> str:
    require(isinstance(value, str) and RELEASE_ID_RE.fullmatch(value), f"{label} is not a valid release ID")
    return value


def check_verification(data: dict, label: str = "verification evidence") -> None:
    """Verifier payload: summary consistent with checks, at least one check, none failed."""
    summary, checks = data.get("summary"), data.get("checks")
    require(isinstance(summary, dict) and isinstance(checks, list), f"{label} lacks summary/checks")
    total, failed, passed = summary.get("total"), summary.get("failed"), summary.get("passed")
    require(all(type(v) is int for v in (total, failed, passed)), f"{label} summary counts are not integers")
    require(total > 0 and total == len(checks), f"{label} summary total does not match its checks")
    require(failed == 0, f"{label} reports failed checks")
    require(
        all(isinstance(c, dict) and c.get("status") in ("pass", "fail") for c in checks)
        and sum(c["status"] == "fail" for c in checks) == 0
        and sum(c["status"] == "pass" for c in checks) == passed == total,
        f"{label} individual checks disagree with its summary",
    )
    names = [c.get("name") for c in checks]
    require(all(isinstance(n, str) for n in names), f"{label} has an unnamed check")
    require(len(set(names)) == len(names), f"{label} has duplicate check names")
    missing = [n for n in REQUIRED_VERIFICATION_CHECKS if n not in names]
    require(not missing, f"{label} lacks required checks: {', '.join(missing)}")


def check_release_identity(data: dict, release_id: str, git_sha: str | None, label: str) -> None:
    """The single passing release_identity check must name the expected release (and commit)."""
    identity = [c for c in data["checks"] if c.get("name") == "release_identity"]
    expected = f"release_id={release_id}; git_sha={git_sha}" if git_sha else f"release_id={release_id};"
    require(len(identity) == 1 and identity[0].get("status") == "pass"
            and isinstance(identity[0].get("detail"), str) and identity[0]["detail"].startswith(expected),
            f"{label} not bound to the expected release")


def check_status(state: dict, suite_version: str, label: str = "status evidence") -> None:
    require(state.get("privileged_suite_version") == suite_version, f"{label}: privileged suite version differs")
    _release_id(state.get("release_id"), f"{label} release_id")
    for key in ("signed_archive_verified", "baseline_established", "recovery_required"):
        require(type(state.get(key)) is bool, f"{label}: {key} is not boolean")
    # Explicit field: a missing key must not read as "no operation pending".
    require("pending_operation" in state, f"{label}: pending_operation field is missing")
    require((state["pending_operation"] is not None) == state["recovery_required"],
            f"{label}: pending_operation disagrees with recovery_required")


def _parse_utc(value: object) -> datetime.datetime:
    require(isinstance(value, str) and value.endswith("Z"), "evidence timestamp is missing or not UTC")
    try:
        return datetime.datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as exc:
        raise EvidenceError("evidence timestamp is malformed") from exc


def check_fresh_health(evidence: dict, release_id: str, now: datetime.datetime, max_age: int,
                       git_sha: str | None = None, label: str = "recovery health evidence") -> None:
    """Verifier-format evidence: complete unique passing checks, bound to release_id, recently generated."""
    check_verification(evidence, label)
    generated = _parse_utc(evidence.get("generated_at_utc"))
    age = (now - generated).total_seconds()
    require(-CLOCK_SKEW_SECONDS <= age <= max_age, f"{label} is not fresh")
    check_release_identity(evidence, release_id, git_sha, label)


def verify_success(kind: str, verification: dict, state: dict, release_id: str,
                   git_sha: str | None, suite_version: str,
                   now: datetime.datetime | None = None,
                   max_age: int = DEFAULT_MAX_EVIDENCE_AGE_SECONDS) -> None:
    require(kind in ("baseline", "deploy", "rollback"), "unknown operation kind")
    now = now or datetime.datetime.now(datetime.timezone.utc)
    if kind != "rollback":
        require(git_sha and state.get("git_sha") == git_sha, "live git SHA differs from the workflow commit")
    check_fresh_health(verification, release_id, now, max_age,
                       git_sha=git_sha if kind != "rollback" else None, label="verification evidence")
    check_status(state, suite_version)
    require(state["release_id"] == release_id, "live release is not the operation target")
    require(state["signed_archive_verified"] is True, "live release is not an authenticated archive")
    require(state["recovery_required"] is False and state["pending_operation"] is None,
            "an operation journal is still pending")
    if kind == "baseline":
        require(state["baseline_established"] is True and state.get("baseline_release_id") == release_id,
                "baseline was not established for the target release")


def check_baseline_snapshot_restore(evidence: dict, failed_id: str, origin_id: str) -> None:
    """Fixed-config restore record written by the entrypoint only after readiness succeeded.

    It carries no timestamp and no per-check results; it proves only that the entrypoint's
    own readiness probe passed for this failed->origin pair. It never authenticates the origin.
    """
    require(set(evidence) == {"failed_release_id", "restored_release_id", "recovery", "approved_fallback"},
            "baseline restore record has unexpected fields")
    require(evidence["failed_release_id"] == failed_id and evidence["restored_release_id"] == origin_id,
            "baseline restore record names a different release pair")
    require(evidence["recovery"] == "fixed_config_snapshot", "baseline restore record is not a fixed-config restore")
    require(evidence["approved_fallback"] is False, "baseline restore record claims an approved fallback")


PREACTIVATION_CLEANUP = "preactivation_cleanup_unauthenticated_origin"
PREACTIVATION_CLEANUP_FIELDS = {
    "schema_version", "recovery", "preactivation_operation", "failed_release_id", "origin_release_id",
    "authorization_sha256", "candidate_disposition", "switch_occurred", "config_restored",
    "origin_authenticated", "approved_fallback", "origin_ready", "origin_health_probe", "generated_at_utc",
}
RECOVERY_MODES = ("signed", "signed-new", "baseline-origin", "preactivation")


def check_preactivation_cleanup(evidence: dict, failed_id: str, origin_id: str, authorization_sha256: str | None,
                                now: datetime.datetime, max_age: int) -> None:
    """Cleanup record for an interrupted install whose origin has no signed archive.

    It states that no release switch and no configuration restore happened, that the candidate
    was removed/preserved/absent, and that the unchanged origin was probed ready (read-only) just
    now. Like the snapshot record it never authenticates the origin and is not verifier health.
    """
    label = "preactivation cleanup record"
    require(set(evidence) == PREACTIVATION_CLEANUP_FIELDS, f"{label} has unexpected fields")
    require(type(evidence["schema_version"]) is int and evidence["schema_version"] == 1, f"{label} schema is unsupported")
    require(evidence["recovery"] == PREACTIVATION_CLEANUP, f"{label} is not a preactivation cleanup")
    require(evidence["failed_release_id"] == failed_id and evidence["origin_release_id"] == origin_id,
            f"{label} names a different release pair")
    require(isinstance(authorization_sha256, str) and re.fullmatch(r"[0-9a-f]{64}", authorization_sha256)
            and evidence["authorization_sha256"] == authorization_sha256,
            f"{label} is not bound to the recovery authorization checksum")
    require(evidence["preactivation_operation"] in ("deploy", "establish_baseline", "rollback"),
            f"{label} names an unknown operation")
    require(evidence["candidate_disposition"] in ("removed", "preserved_complete", "absent"),
            f"{label} has an unknown candidate disposition")
    for key in ("switch_occurred", "config_restored", "origin_authenticated", "approved_fallback"):
        require(evidence[key] is False, f"{label} must report {key} as false")
    require(evidence["origin_ready"] is True, f"{label} does not report a ready origin")
    require(evidence["origin_health_probe"] == "systemd_active_and_loopback_ready", f"{label} names an unknown probe")
    age = (now - _parse_utc(evidence["generated_at_utc"])).total_seconds()
    require(-CLOCK_SKEW_SECONDS <= age <= max_age, f"{label} is not fresh")


def classify_recovery(before: dict | None, after: dict | None, recovery: dict | None,
                      origin_id: str, failed_id: str, suite_version: str,
                      now: datetime.datetime | None = None,
                      max_age: int = DEFAULT_MAX_EVIDENCE_AGE_SECONDS) -> str:
    """Return a recovery classification label, or raise Classification for bad states."""
    now = now or datetime.datetime.now(datetime.timezone.utc)
    try:
        require(before is not None, "pre-operation status evidence is missing")
        require(after is not None, "post-operation status evidence is missing")
        check_status(before, suite_version, "pre-operation status")
        check_status(after, suite_version, "post-operation status")
    except EvidenceError as exc:
        raise Classification(INCOMPLETE, str(exc)) from exc
    # Origin kind comes from the pre-operation state, never from the post-operation claim.
    origin_signed = before["signed_archive_verified"]
    if before["release_id"] != origin_id:
        raise Classification(INCOMPLETE, "pre-operation release is not the declared origin")
    if after["recovery_required"] or after["pending_operation"] is not None:
        raise Classification(INCOMPLETE, "operation journal is still pending; VM administrator or signed recover required")
    if after["release_id"] != origin_id:
        raise Classification(INCOMPLETE, "live release is not the origin release")
    if origin_signed:
        if after["signed_archive_verified"] is not True:
            raise Classification(INCOMPLETE, "origin signed archive no longer verifies")
    elif after["signed_archive_verified"] is not False or after["baseline_established"] is not False \
            or after.get("baseline_release_id") is not None:
        raise Classification(UNSAFE, "baseline-origin restore reports authenticated/baseline state")
    if recovery is None:
        raise Classification(INCOMPLETE, "recovery evidence is missing")
    try:
        if origin_signed:
            check_fresh_health(recovery, origin_id, now, max_age)
        else:
            check_baseline_snapshot_restore(recovery, failed_id, origin_id)
    except EvidenceError as exc:
        raise Classification(INCOMPLETE, str(exc)) from exc
    return RECOVERED_AUTHENTICATED if origin_signed else RESTORED_UNAUTHENTICATED


def final_recover_gate(state: dict, expected_release_id: str, evidence: dict, suite_version: str,
                       failed_id: str, origin_id: str, now: datetime.datetime | None = None,
                       max_age: int = DEFAULT_MAX_EVIDENCE_AGE_SECONDS,
                       recovery_mode: str | None = None, authorization_sha256: str | None = None) -> None:
    """Gate for the explicit recover action; the end state is one of exactly four shapes.

    * signed recovery: expected is the origin, signed state, fresh verifier health for the origin.
    * committed baseline: baseline marker already names the failed release, so expected is the
      failed release, signed state with baseline recorded, fresh verifier health for it.
    * uncommitted baseline-origin: expected is the origin, unsigned/no-baseline state, and only the
      entrypoint's fixed-config restore record (explicitly unauthenticated; no health is invented).
    * preactivation cleanup of an unauthenticated origin: same state as above, but only for
      recovery_mode "preactivation", with the cleanup record (no switch, no config restore).
    """
    now = now or datetime.datetime.now(datetime.timezone.utc)
    require(recovery_mode is None or recovery_mode in RECOVERY_MODES, "unknown recovery mode")
    check_status(state, suite_version)
    _release_id(expected_release_id, "expected recovery release")
    require(expected_release_id in (origin_id, failed_id), "expected recovery release is neither origin nor failed release")
    require(state["release_id"] == expected_release_id, "live release is not the expected recovery release")
    require(state["recovery_required"] is False and state["pending_operation"] is None,
            "an operation journal is still pending")
    if "summary" in evidence:
        require(state["signed_archive_verified"] is True, "health evidence requires an authenticated live archive")
        if expected_release_id == failed_id and failed_id != origin_id:
            require(state["baseline_established"] is True and state.get("baseline_release_id") == failed_id,
                    "committed baseline recovery requires the baseline marker on the failed release")
        check_fresh_health(evidence, expected_release_id, now, max_age)
    else:
        require(expected_release_id == origin_id, "unauthenticated restore must land on the origin release")
        require(state["signed_archive_verified"] is False and state["baseline_established"] is False
                and state.get("baseline_release_id") is None,
                "unauthenticated restore must not report authenticated or baseline state")
        if recovery_mode == "preactivation":
            check_preactivation_cleanup(evidence, failed_id, origin_id, authorization_sha256, now, max_age)
        else:
            # Rejects the cleanup record: its field set differs, so it cannot pass as a config restore.
            check_baseline_snapshot_restore(evidence, failed_id, origin_id)


def _optional_json(path: str) -> dict | None:
    try:
        return load_json_object(path, path)
    except EvidenceError:
        return None


def main(argv: list[str]) -> int:
    try:
        cmd, args = argv[1], argv[2:]
        if cmd == "verify-success":
            kind, verification, status, release_id, git_sha, suite = args
            verify_success(kind, load_json_object(verification, "verification evidence"),
                           load_json_object(status, "status evidence"), release_id, git_sha or None, suite)
        elif cmd == "classify-recovery":
            before, after, recovery, origin_id, failed_id, suite = args
            label = classify_recovery(_optional_json(before), _optional_json(after), _optional_json(recovery),
                                      origin_id, failed_id, suite)
            print(f"RECOVERY_CLASSIFICATION={label}")
            if label == RESTORED_UNAUTHENTICATED:
                print("Operationally restored unauthenticated baseline-origin release; "
                      "this is NOT an authenticated rollback.")
        elif cmd == "final-recover":
            status, expected, recovery, suite, failed_id, origin_id, *extra = args
            require(len(extra) in (0, 2), "final-recover takes either no or both of recovery mode and checksum")
            mode, authorization = extra if extra else (None, None)
            final_recover_gate(load_json_object(status, "status evidence"), expected,
                               load_json_object(recovery, "recovery evidence"), suite, failed_id, origin_id,
                               recovery_mode=mode, authorization_sha256=authorization)
        else:
            raise EvidenceError(f"unknown command {cmd!r}")
    except Classification as exc:
        print(f"RECOVERY_CLASSIFICATION={exc.label}\n{exc}", file=sys.stderr)
        return 1
    except (EvidenceError, IndexError, ValueError) as exc:
        print(f"evidence gate failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
