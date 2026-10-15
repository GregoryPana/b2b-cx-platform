#!/usr/bin/env python3
"""Fail-closed validation and local archive helpers for Mystery Public releases.

This file is installed root-owned beside the privileged deploy entrypoint.  The
entrypoint supplies only fixed roots and strictly validated release IDs.  No
command in this module changes the database or reads application secret values
into output.
"""

from __future__ import annotations

import argparse
import datetime
import grp
import hashlib
import http.client
import json
import os
import pwd
import re
import shutil
import signal
import socket
import stat
import subprocess
import sys
import tempfile
import time
import urllib.parse
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

RELEASE_ID_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,159}")
SHA256_RE = re.compile(r"[0-9a-f]{64}")
GIT_SHA_RE = re.compile(r"[0-9a-f]{40}")
NONCE_RE = re.compile(r"[0-9a-f]{64}")
HTTPS_ORIGIN_RE = re.compile(r"https://[A-Za-z0-9.-]+")
RECOVERY_AUDIT_MAX_BYTES = 128 * 1024
RECOVERY_AUDIT_MAX_EVENTS = 64
RECOVERY_AUDIT_CONTEXTS = {"automatic_explicit", "exit_trap", "manual_signed_recover"}
RECOVERY_AUDIT_OUTCOMES = {"success", "failure"}
RECOVERY_AUDIT_FAILURE_CLASSES = {
    "none", "baseline_commit_state_invalid", "failed_archive_cleanup",
    "fallback_archive_authentication_failed", "fallback_runtime_failed",
    "database_compatibility_failed", "candidate_probe_failed",
    "current_switch_failed", "activation_verification_failed", "fixed_config_restore_failed",
    "journal_clear_failed", "unknown_recovery_failure",
}
RECOVERY_AUDIT_PROBE_STATUSES = {"ready_http_200", "unknown"}
RECOVERY_AUDIT_RESTORATIONS = {"explicit", "exit_trap", "none"}
RECOVERY_AUDIT_FIELDS = {
    "schema_version", "operation_nonce", "operation_action", "recovery_mode",
    "original_release_id", "failed_release_id", "attempt_index", "phase",
    "attempt_context", "started_monotonic_ns", "ended_monotonic_ns",
    "started_at_utc", "ended_at_utc", "outcome", "failure_class",
    "probe_status", "successful_restoration", "prior_failed_attempts",
}
RECOVERY_AUDIT_IDENTITY_FIELDS = (
    "operation_action", "recovery_mode", "original_release_id", "failed_release_id",
)
OPERATION_FIELDS = {
    "schema_version",
    "action",
    "target_release_id",
    "bundle_sha256",
    "current_release_id",
    "base_url",
    "tls_mode",
    "github_run_id",
    "github_run_attempt",
    "issued_at_utc",
    "expires_at_utc",
    "nonce",
}
MAX_OPERATION_LIFETIME = datetime.timedelta(minutes=10)
REQUIRED_MANIFEST_FIELDS = {
    "schema_version",
    "release_id",
    "git_sha",
    "build_timestamp_utc",
    "frontend_auth_mode",
    "expected_migration_heads",
    "python_wheelhouse",
}


class GuardError(ValueError):
    pass


def _regular_file(path: Path, label: str) -> None:
    if path.is_symlink() or not path.is_file():
        raise GuardError(f"{label} must be a regular non-symlink file")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def privileged_suite_version(paths: list[Path]) -> str:
    """Identify installed bytes using the canonical source names and order."""
    names = (
        "cwscx_mystery_public_deploy_entrypoint.sh",
        "install_mystery_public_bundle.sh",
        "mystery_public_release_guard.py",
        "mystery_public_bootstrap_transaction.py",
    )
    if len(paths) != len(names):
        raise GuardError("privileged suite must contain exactly four files")
    digest = hashlib.sha256()
    for name, path in zip(names, paths):
        _regular_file(path, "privileged suite source")
        data = path.read_bytes()
        digest.update(name.encode("utf-8") + b"\0" + len(data).to_bytes(8, "big") + data)
    return digest.hexdigest()


def validate_release_id(value: str) -> str:
    if not RELEASE_ID_RE.fullmatch(value):
        raise GuardError("invalid release ID")
    return value


def validate_manifest(manifest: Any) -> dict[str, Any]:
    if not isinstance(manifest, dict):
        raise GuardError("manifest must be an object")
    missing = sorted(REQUIRED_MANIFEST_FIELDS - set(manifest))
    if missing:
        raise GuardError("manifest missing fields: " + ", ".join(missing))
    release_id = validate_release_id(str(manifest["release_id"]))
    if manifest["schema_version"] != 1:
        raise GuardError("unsupported manifest schema")
    if not GIT_SHA_RE.fullmatch(str(manifest["git_sha"])):
        raise GuardError("invalid manifest git SHA")
    if manifest["frontend_auth_mode"] != "mystery_public":
        raise GuardError("wrong frontend authentication mode")
    heads = manifest["expected_migration_heads"]
    if not isinstance(heads, list) or not heads or any(not isinstance(v, str) or not v for v in heads):
        raise GuardError("invalid expected migration heads")
    if len(set(heads)) != len(heads):
        raise GuardError("duplicate expected migration heads")
    if manifest["python_wheelhouse"] is not True:
        raise GuardError("bundle does not declare an offline wheelhouse")
    manifest = dict(manifest)
    manifest["release_id"] = release_id
    manifest["expected_migration_heads"] = sorted(heads)
    return manifest


def _safe_zip_name(name: str) -> PurePosixPath:
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or not path.parts or path.parts[0] != "release":
        raise GuardError(f"unsafe archive member: {name!r}")
    if "\\" in name or name.endswith("/"):
        raise GuardError(f"unsupported archive member: {name!r}")
    return path


def inspect_bundle(bundle: Path) -> tuple[dict[str, Any], dict[str, str]]:
    _regular_file(bundle, "bundle")
    try:
        with zipfile.ZipFile(bundle) as archive:
            infos = archive.infolist()
            names: set[str] = set()
            for info in infos:
                name = _safe_zip_name(info.filename).as_posix()
                if name in names:
                    raise GuardError(f"duplicate archive member: {name}")
                names.add(name)
                # Reject Unix symlink/device entries. Regular files may have 0
                # when the producer did not preserve Unix mode metadata.
                mode_type = (info.external_attr >> 16) & 0o170000
                if mode_type not in (0, 0o100000):
                    raise GuardError(f"non-regular archive member: {name}")
            required = {"release/release-manifest.json", "release/SHA256SUMS"}
            if not required.issubset(names):
                raise GuardError("bundle metadata is missing")
            manifest = validate_manifest(json.loads(archive.read("release/release-manifest.json")))
            sums_text = archive.read("release/SHA256SUMS").decode("utf-8")
            expected: dict[str, str] = {}
            for line in sums_text.splitlines():
                match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
                if not match:
                    raise GuardError("invalid SHA256SUMS line")
                digest, relative = match.groups()
                member = _safe_zip_name("release/" + relative).as_posix()
                if member == "release/SHA256SUMS" or member in expected:
                    raise GuardError("invalid or duplicate SHA256SUMS member")
                expected[member] = digest
            actual_members = names - {"release/SHA256SUMS"}
            if set(expected) != actual_members:
                raise GuardError("SHA256SUMS does not cover the exact bundle file set")
            for member, digest in expected.items():
                if hashlib.sha256(archive.read(member)).hexdigest() != digest:
                    raise GuardError(f"bundle member checksum failed: {member}")
    except (zipfile.BadZipFile, UnicodeDecodeError, json.JSONDecodeError, KeyError) as exc:
        raise GuardError(f"invalid release bundle: {exc}") from exc
    return manifest, expected


def verify_signature(payload_path: Path, signature: Path, allowed_signers: Path, namespace: str) -> None:
    _regular_file(payload_path, "signed payload")
    _regular_file(signature, "signature")
    _regular_file(allowed_signers, "allowed signers")
    with payload_path.open("rb") as payload:
        result = subprocess.run(
            [
                "/usr/bin/ssh-keygen",
                "-Y",
                "verify",
                "-f",
                str(allowed_signers),
                "-I",
                "github-actions",
                "-n",
                namespace,
                "-s",
                str(signature),
            ],
            stdin=payload,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    if result.returncode:
        raise GuardError("signature is not authorized")


def verify_bundle(bundle: Path, claimed_sha256: str, signature: Path, allowed_signers: Path) -> dict[str, Any]:
    if not SHA256_RE.fullmatch(claimed_sha256):
        raise GuardError("invalid bundle checksum")
    actual = _sha256(bundle)
    if actual != claimed_sha256:
        raise GuardError("bundle checksum mismatch")
    verify_signature(bundle, signature, allowed_signers, "cwscx-mystery-public-release")
    manifest, _ = inspect_bundle(bundle)
    manifest["bundle_sha256"] = actual
    return manifest


def _utc_timestamp(value: Any, label: str) -> datetime.datetime:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise GuardError(f"{label} must be a UTC timestamp")
    try:
        parsed = datetime.datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as exc:
        raise GuardError(f"{label} must be a UTC timestamp") from exc
    if parsed.tzinfo != datetime.timezone.utc or parsed.microsecond:
        raise GuardError(f"{label} must use whole UTC seconds")
    return parsed


def recovery_audit_path(evidence_root: Path, operation_nonce: str) -> Path:
    """Derive the only audit path from a signed, validated operation nonce."""
    if not NONCE_RE.fullmatch(operation_nonce):
        raise GuardError("recovery audit operation nonce is invalid")
    return evidence_root / f"recovery-attempts-{operation_nonce}.jsonl"


def _validate_recovery_audit_record(record: Any, operation_nonce: str, expected_index: int) -> dict[str, Any]:
    if not isinstance(record, dict) or set(record) != RECOVERY_AUDIT_FIELDS:
        raise GuardError("recovery audit record fields are not exact")
    if record["schema_version"] != 1 or record["operation_nonce"] != operation_nonce:
        raise GuardError("recovery audit record identity is invalid")
    if record["operation_action"] not in {"deploy", "establish_baseline", "rollback", "recover"}:
        raise GuardError("recovery audit operation action is invalid")
    if record["recovery_mode"] not in {"signed", "signed-new", "baseline-origin"}:
        raise GuardError("recovery audit mode is invalid")
    validate_release_id(record["original_release_id"])
    validate_release_id(record["failed_release_id"])
    if type(record["attempt_index"]) is not int or record["attempt_index"] != expected_index:
        raise GuardError("recovery audit attempt sequence is invalid")
    if record["phase"] != "recovery" or record["attempt_context"] not in RECOVERY_AUDIT_CONTEXTS:
        raise GuardError("recovery audit context is invalid")
    for field in ("started_monotonic_ns", "ended_monotonic_ns"):
        if type(record[field]) is not int or record[field] <= 0:
            raise GuardError("recovery audit monotonic timestamp is invalid")
    if record["ended_monotonic_ns"] < record["started_monotonic_ns"]:
        raise GuardError("recovery audit monotonic interval is invalid")
    started = _utc_timestamp(record["started_at_utc"], "recovery audit started_at_utc")
    ended = _utc_timestamp(record["ended_at_utc"], "recovery audit ended_at_utc")
    if ended < started:
        raise GuardError("recovery audit wall-clock interval is invalid")
    if record["outcome"] not in RECOVERY_AUDIT_OUTCOMES \
            or record["failure_class"] not in RECOVERY_AUDIT_FAILURE_CLASSES \
            or record["probe_status"] not in RECOVERY_AUDIT_PROBE_STATUSES \
            or record["successful_restoration"] not in RECOVERY_AUDIT_RESTORATIONS:
        raise GuardError("recovery audit outcome metadata is invalid")
    if type(record["prior_failed_attempts"]) is not int or not 0 <= record["prior_failed_attempts"] < expected_index:
        raise GuardError("recovery audit prior-failure count is invalid")
    if record["outcome"] == "success":
        if record["failure_class"] != "none" or record["successful_restoration"] == "none":
            raise GuardError("successful recovery audit outcome is inconsistent")
        expected_restoration = "exit_trap" if record["attempt_context"] == "exit_trap" else "explicit"
        if record["successful_restoration"] != expected_restoration:
            raise GuardError("successful recovery audit restoration context is inconsistent")
    elif record["failure_class"] == "none" or record["successful_restoration"] != "none":
        raise GuardError("failed recovery audit outcome is inconsistent")
    return record


def _read_recovery_audit_descriptor(
    descriptor: int, operation_nonce: str, *, required_uid: int, max_bytes: int = RECOVERY_AUDIT_MAX_BYTES
) -> list[dict[str, Any]]:
    info = os.fstat(descriptor)
    if not stat.S_ISREG(info.st_mode) or info.st_uid != required_uid or stat.S_IMODE(info.st_mode) != 0o644:
        raise GuardError("recovery audit file ownership or mode is unsafe")
    if info.st_size == 0:
        raise GuardError("existing recovery audit file is empty")
    if info.st_size > max_bytes:
        raise GuardError("recovery audit file exceeds its bounded size")
    os.lseek(descriptor, 0, os.SEEK_SET)
    raw = b""
    while len(raw) <= max_bytes:
        block = os.read(descriptor, min(65536, max_bytes + 1 - len(raw)))
        if not block:
            break
        raw += block
    if len(raw) > max_bytes or (raw and not raw.endswith(b"\n")):
        raise GuardError("recovery audit file is incomplete or oversized")
    records: list[dict[str, Any]] = []
    prior_failed = 0
    operation_identity: tuple[Any, ...] | None = None
    for index, line in enumerate(raw.splitlines(), 1):
        if len(line) > 4096:
            raise GuardError("recovery audit record exceeds its bounded size")
        try:
            record = json.loads(line)
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise GuardError("recovery audit file contains a damaged record") from None
        record = _validate_recovery_audit_record(record, operation_nonce, index)
        record_identity = tuple(record[field] for field in RECOVERY_AUDIT_IDENTITY_FIELDS)
        if operation_identity is None:
            operation_identity = record_identity
        elif record_identity != operation_identity:
            raise GuardError("recovery audit operation identity changed within history")
        if record["prior_failed_attempts"] != prior_failed:
            raise GuardError("recovery audit prior-failure sequence is invalid")
        records.append(record)
        prior_failed += record["outcome"] == "failure"
        if len(records) > RECOVERY_AUDIT_MAX_EVENTS:
            raise GuardError("recovery audit file contains too many records")
    return records


def read_recovery_audit(path: Path, operation_nonce: str, *, required_uid: int = 0) -> list[dict[str, Any]]:
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        return _read_recovery_audit_descriptor(descriptor, operation_nonce, required_uid=required_uid)
    finally:
        os.close(descriptor)


def append_recovery_audit(
    evidence_root: Path,
    operation_nonce: str,
    operation_action: str,
    recovery_mode: str,
    original_release_id: str,
    failed_release_id: str,
    attempt_context: str,
    started_monotonic_ns: int,
    started_at_utc: str,
    outcome: str,
    failure_class: str,
    probe_status: str,
    successful_restoration: str,
    *,
    required_uid: int = 0,
    ended_monotonic_ns: int | None = None,
    ended_at_utc: str | None = None,
) -> dict[str, Any]:
    """Append one sanitized, fsynced event without repairing or replacing history."""
    path = recovery_audit_path(evidence_root, operation_nonce)
    root_descriptor = os.open(evidence_root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    descriptor: int | None = None
    created = False
    try:
        root_info = os.fstat(root_descriptor)
        if root_info.st_uid != required_uid or root_info.st_mode & 0o022:
            raise GuardError("recovery audit root ownership or mode is unsafe")
        name = path.name
        flags = os.O_RDWR | os.O_APPEND | os.O_NOFOLLOW
        try:
            descriptor = os.open(name, flags, dir_fd=root_descriptor)
        except FileNotFoundError:
            try:
                descriptor = os.open(name, flags | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=root_descriptor)
            except FileExistsError:
                descriptor = os.open(name, flags, dir_fd=root_descriptor)
            else:
                created = True
        # Keep a newly created file root-only until its first complete record is
        # durable. A crash before publication therefore leaves mode 0600, which
        # later readers reject rather than accepting an empty lost attempt.
        records = [] if created else _read_recovery_audit_descriptor(
            descriptor, operation_nonce, required_uid=required_uid
        )
        if len(records) >= RECOVERY_AUDIT_MAX_EVENTS:
            raise GuardError("recovery audit event limit reached")
        proposed_identity = (operation_action, recovery_mode, original_release_id, failed_release_id)
        if records and proposed_identity != tuple(
            records[0][field] for field in RECOVERY_AUDIT_IDENTITY_FIELDS
        ):
            raise GuardError("recovery audit proposed operation identity differs from history")
        prior_failed = sum(record["outcome"] == "failure" for record in records)
        end_ns = time.monotonic_ns() if ended_monotonic_ns is None else ended_monotonic_ns
        end_wall = (
            datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
            if ended_at_utc is None else ended_at_utc
        )
        record = {
            "schema_version": 1, "operation_nonce": operation_nonce,
            "operation_action": operation_action, "recovery_mode": recovery_mode,
            "original_release_id": original_release_id, "failed_release_id": failed_release_id,
            "attempt_index": len(records) + 1, "phase": "recovery",
            "attempt_context": attempt_context, "started_monotonic_ns": started_monotonic_ns,
            "ended_monotonic_ns": end_ns, "started_at_utc": started_at_utc,
            "ended_at_utc": end_wall, "outcome": outcome, "failure_class": failure_class,
            "probe_status": probe_status, "successful_restoration": successful_restoration,
            "prior_failed_attempts": prior_failed,
        }
        _validate_recovery_audit_record(record, operation_nonce, len(records) + 1)
        encoded = (json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
        if os.fstat(descriptor).st_size + len(encoded) > RECOVERY_AUDIT_MAX_BYTES:
            raise GuardError("recovery audit append would exceed its bounded size")
        written = 0
        while written < len(encoded):
            count = os.write(descriptor, encoded[written:])
            if count <= 0:
                raise GuardError("recovery audit append was interrupted")
            written += count
        os.fsync(descriptor)
        if created:
            os.fchmod(descriptor, 0o644)
            os.fsync(descriptor)
            os.fsync(root_descriptor)
        return record
    finally:
        if descriptor is not None:
            os.close(descriptor)
        os.close(root_descriptor)


def validate_operation_document(document: Any, current_release_id: str, now: datetime.datetime) -> dict[str, Any]:
    if not isinstance(document, dict) or set(document) != OPERATION_FIELDS:
        raise GuardError("operation document fields are not exact")
    if document["schema_version"] != 1:
        raise GuardError("unsupported operation schema")
    if document["action"] not in {"deploy", "establish_baseline", "rollback", "recover"}:
        raise GuardError("operation action is not allowed")
    for field in ("target_release_id", "current_release_id"):
        document[field] = validate_release_id(str(document[field]))
    if document["current_release_id"] != current_release_id:
        raise GuardError("operation current release is stale")
    if not SHA256_RE.fullmatch(str(document["bundle_sha256"])):
        raise GuardError("operation bundle checksum is invalid")
    if not HTTPS_ORIGIN_RE.fullmatch(str(document["base_url"])):
        raise GuardError("operation base URL is invalid")
    if document["tls_mode"] not in {"prepublic", "trusted"}:
        raise GuardError("operation TLS mode is invalid")
    for field in ("github_run_id", "github_run_attempt"):
        if not isinstance(document[field], str) or not re.fullmatch(r"[1-9][0-9]*", document[field]):
            raise GuardError(f"operation {field} is invalid")
    if not isinstance(document["nonce"], str) or not NONCE_RE.fullmatch(document["nonce"]):
        raise GuardError("operation nonce is invalid")
    issued = _utc_timestamp(document["issued_at_utc"], "issued_at_utc")
    expires = _utc_timestamp(document["expires_at_utc"], "expires_at_utc")
    if expires <= issued or expires - issued > MAX_OPERATION_LIFETIME:
        raise GuardError("operation validity window is invalid")
    if now.tzinfo != datetime.timezone.utc:
        raise GuardError("authorization clock must be UTC")
    if now < issued - datetime.timedelta(seconds=30) or now >= expires:
        raise GuardError("operation is not currently valid")
    return document


def authorize_operation(
    operation_path: Path,
    signature_path: Path,
    allowed_signers: Path,
    nonce_root: Path,
    current_release_id: str,
    *,
    now: datetime.datetime | None = None,
    required_uid: int = 0,
) -> dict[str, Any]:
    _regular_file(operation_path, "operation document")
    verify_signature(operation_path, signature_path, allowed_signers, "cwscx-mystery-public-operation")
    try:
        raw = operation_path.read_bytes()
        document = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GuardError("operation document is not valid JSON") from exc
    canonical = (json.dumps(document, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
    if raw != canonical:
        raise GuardError("operation document is not canonical JSON")
    validated = validate_operation_document(
        document,
        current_release_id,
        now or datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0),
    )
    if nonce_root.is_symlink() or not nonce_root.is_dir():
        raise GuardError("operation nonce root is unsafe")
    nonce_info = nonce_root.stat()
    if nonce_info.st_uid != required_uid or nonce_info.st_mode & 0o077:
        raise GuardError("operation nonce root is not root-only")
    nonce_path = nonce_root / validated["nonce"]
    try:
        descriptor = os.open(nonce_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    except FileExistsError as exc:
        raise GuardError("operation nonce has already been used") from exc
    # Authorization is not granted until the single-use marker survives a
    # crash. Leave the nonce consumed if persistence fails: a retry needs a
    # fresh approved operation, never an uncertain replay of this document.
    with os.fdopen(descriptor, "w", encoding="ascii") as handle:
        handle.write(f"{validated['github_run_id']}:{validated['github_run_attempt']}\n")
        handle.flush()
        os.fsync(handle.fileno())
    directory_fd = os.open(nonce_root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)
    return validated


def archive_paths(archive_root: Path, release_id: str) -> dict[str, Path]:
    release_id = validate_release_id(release_id)
    release_root = archive_root / release_id
    return {
        "root": release_root,
        "bundle": release_root / "bundle.zip",
        "signature": release_root / "bundle.zip.sig",
        "checksum": release_root / "bundle.zip.sha256",
        "metadata": release_root / "metadata.json",
        "pin": archive_root / f"{release_id}.pinned",
    }


def verify_archive(archive_root: Path, release_id: str, allowed_signers: Path) -> dict[str, Any]:
    paths = archive_paths(archive_root, release_id)
    if paths["root"].is_symlink() or not paths["root"].is_dir():
        raise GuardError("archive release must be an atomically published directory")
    for key in ("bundle", "signature", "checksum", "metadata"):
        _regular_file(paths[key], f"archive {key}")
    checksum_text = paths["checksum"].read_text(encoding="ascii")
    expected_line = re.fullmatch(r"([0-9a-f]{64})  bundle\.zip\n", checksum_text)
    if not expected_line:
        raise GuardError("archive checksum file is not canonical")
    manifest = verify_bundle(paths["bundle"], expected_line.group(1), paths["signature"], allowed_signers)
    if manifest["release_id"] != release_id:
        raise GuardError("archive release ID does not match its signed manifest")
    try:
        metadata = json.loads(paths["metadata"].read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise GuardError("invalid archive metadata") from exc
    required = {"schema_version", "release_id", "bundle_sha256", "status", "verified_at_utc"}
    if not isinstance(metadata, dict) or set(metadata) != required:
        raise GuardError("archive metadata fields are not exact")
    if (
        metadata["schema_version"] != 1
        or metadata["release_id"] != release_id
        or metadata["bundle_sha256"] != manifest["bundle_sha256"]
        or metadata["status"] != "deploy_verified"
    ):
        raise GuardError("archive is not a verified deployment fallback")
    _utc_timestamp(metadata["verified_at_utc"], "archive verified_at_utc")
    manifest["archive_status"] = metadata["status"]
    manifest["archive_verified_at_utc"] = metadata["verified_at_utc"]
    return manifest


def verify_installed_files(release_dir: Path, bundle: Path, release_id: str, required_uid: int = 0) -> dict[str, Any]:
    if release_dir.is_symlink() or not release_dir.is_dir() or release_dir.name != release_id:
        raise GuardError("installed release directory is unsafe")
    # The virtualenv is generated locally and is therefore not in SHA256SUMS.
    # Require the entire installed tree (including venv extras) to remain
    # root-controlled and non-writable by group/world. Symlinks are allowed
    # only when they resolve to a root-controlled regular file/directory.
    for root, directories, files in os.walk(release_dir, followlinks=False):
        for name in [".", *directories, *files]:
            path = Path(root) if name == "." else Path(root) / name
            info = path.lstat()
            if path.is_symlink():
                if info.st_uid != required_uid:
                    raise GuardError(f"installed symlink is not root-controlled: {path.relative_to(release_dir)}")
                try:
                    target = path.resolve(strict=True)
                    target_info = target.stat()
                except OSError as exc:
                    raise GuardError(f"unsafe installed symlink: {path.relative_to(release_dir)}") from exc
                if target_info.st_uid != required_uid or target_info.st_mode & 0o022 or not (target.is_file() or target.is_dir()):
                    raise GuardError(f"unsafe installed symlink target: {path.relative_to(release_dir)}")
            elif info.st_uid != required_uid or info.st_mode & 0o022:
                raise GuardError(f"installed release is not root-controlled: {path.relative_to(release_dir)}")
    manifest, expected = inspect_bundle(bundle)
    if manifest["release_id"] != release_id:
        raise GuardError("installed release ID differs from signed bundle")
    for member, digest in expected.items():
        relative = PurePosixPath(member).relative_to("release")
        target = release_dir.joinpath(*relative.parts)
        _regular_file(target, f"installed release member {relative}")
        if _sha256(target) != digest:
            raise GuardError(f"installed release integrity failed: {relative}")
    installed_manifest = validate_manifest(json.loads((release_dir / "release-manifest.json").read_text(encoding="utf-8")))
    if installed_manifest != manifest:
        raise GuardError("installed manifest differs from signed archive")
    return manifest


def verify_installed_release(
    release_dir: Path,
    archive_root: Path,
    release_id: str,
    allowed_signers: Path,
    required_uid: int = 0,
) -> dict[str, Any]:
    bundle = archive_paths(archive_root, release_id)["bundle"]
    verify_archive(archive_root, release_id, allowed_signers)
    return verify_installed_files(release_dir, bundle, release_id, required_uid)


RUNTIME_PROBE = r"""
import importlib
import importlib.metadata
import pathlib
import sys

from pip._vendor.packaging.requirements import Requirement

requirements = pathlib.Path(sys.argv[1])

def installed_distribution(requirement):
    try:
        installed = importlib.metadata.distribution(requirement.name)
    except importlib.metadata.PackageNotFoundError:
        raise SystemExit(f"required distribution is absent: {requirement.name}") from None
    if requirement.specifier and installed.version not in requirement.specifier:
        raise SystemExit(f"required distribution version is incompatible: {requirement.name}")
    return installed

for number, raw in enumerate(requirements.read_text(encoding="utf-8").splitlines(), 1):
    line = raw.strip()
    if not line or line.startswith("#"):
        continue
    if line.startswith(("-", "--")):
        raise SystemExit(f"unsupported requirements directive on line {number}")
    requirement = Requirement(line)
    if requirement.marker is not None and not requirement.marker.evaluate():
        continue
    installed = installed_distribution(requirement)
    for extra in requirement.extras:
        environment = {"extra": extra}
        for raw_dependency in installed.requires or ():
            dependency = Requirement(raw_dependency)
            if dependency.marker is None or dependency.marker.evaluate(environment):
                installed_distribution(dependency)

for module in ("uvicorn", "fastapi", "alembic", "sqlalchemy"):
    importlib.import_module(module)
"""


def check_runtime_usability(
    release_dir: Path,
    *,
    required_uid: int = 0,
    command_prefix: tuple[str, ...] = ("/usr/sbin/runuser", "-u", "cxadmin", "-g", "www-data", "--"),
) -> None:
    """Prove an authenticated release's locally built runtime before activation.

    The caller must first authenticate the installed tree against its signed
    bundle/archive. This second gate covers the deliberately excluded venv. It
    executes dependency code only after dropping to the service identity, never
    as root, and does not read the application environment file.
    """
    requirements = release_dir / "backend/requirements.txt"
    venv = release_dir / "backend/venv"
    python = venv / "bin/python"
    uvicorn = venv / "bin/uvicorn"
    for path, label, kind in (
        (release_dir, "release directory", "dir"),
        (requirements, "requirements file", "file"),
        (venv, "virtualenv", "dir"),
        (python, "virtualenv Python", "file"),
        (uvicorn, "Uvicorn launcher", "file"),
    ):
        if path.is_symlink():
            link_info = path.lstat()
            if link_info.st_uid != required_uid:
                raise GuardError(f"{label} symlink is not root-controlled")
            try:
                target = path.resolve(strict=True)
                target_info = target.stat()
            except OSError as exc:
                raise GuardError(f"{label} is an unsafe symlink") from exc
            if target_info.st_uid not in {0, required_uid} or target_info.st_mode & 0o022:
                raise GuardError(f"{label} symlink target is not root-controlled")
        elif (kind == "dir" and not path.is_dir()) or (kind == "file" and not path.is_file()):
            raise GuardError(f"{label} is missing or has the wrong type")
        else:
            info = path.lstat()
            if info.st_uid != required_uid or info.st_mode & 0o022:
                raise GuardError(f"{label} is not root-controlled")
    if not os.access(python, os.X_OK) or not os.access(uvicorn, os.X_OK):
        raise GuardError("virtualenv launchers are not executable")

    clean = ("/usr/bin/env", "-i", "HOME=/nonexistent", "PATH=/usr/bin:/bin")
    commands = (
        (*command_prefix, *clean, str(python), "-I", "-c", RUNTIME_PROBE, str(requirements)),
        (*command_prefix, *clean, str(python), "-I", "-m", "pip", "--isolated", "check"),
    )
    for command in commands:
        result = subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL, check=False, cwd="/")
        if result.returncode:
            raise GuardError("installed virtualenv is incomplete or inconsistent")


ROOT_PROBE_LAUNCHER = r"""
import ctypes
import os
import sys

parent = os.getppid()
if ctypes.CDLL(None, use_errno=True).prctl(1, 9, 0, 0, 0) != 0:
    raise SystemExit(90)
if parent == 1 or os.getppid() != parent:
    os.kill(os.getpid(), 9)
os.execv(sys.argv[1], sys.argv[1:])
"""


PROBE_LAUNCHER = r"""
import ctypes
import json
import os
import sys

PR_SET_PDEATHSIG = 1
parent = os.getppid()
if ctypes.CDLL(None, use_errno=True).prctl(PR_SET_PDEATHSIG, 9, 0, 0, 0) != 0:
    raise SystemExit(90)
if parent == 1 or os.getppid() != parent:
    os.kill(os.getpid(), 9)
start_ticks = open(f"/proc/{os.getpid()}/stat", encoding="ascii").read().split()[21]
marker = sys.argv[1]
fd = os.open(marker, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
with os.fdopen(fd, "w", encoding="ascii") as handle:
    handle.write(json.dumps({"pid": os.getpid(), "pgid": os.getpgrp(), "start_ticks": start_ticks},
                            sort_keys=True, separators=(",", ":")) + "\n")
    handle.flush()
    os.fsync(handle.fileno())
os.execv(sys.argv[2], sys.argv[2:])
"""


class _UnixHTTPConnection(http.client.HTTPConnection):
    def __init__(self, socket_path: Path, timeout: float):
        super().__init__("localhost", timeout=timeout)
        self.socket_path = socket_path

    def connect(self) -> None:
        connection = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        connection.settimeout(self.timeout)
        connection.connect(str(self.socket_path))
        self.sock = connection


def _read_runtime_environment(env_file: Path) -> dict[str, str]:
    """Parse the supported, systemd-compatible EnvironmentFile subset.

    Values may be unquoted without whitespace, or single/double quoted on one
    line. Escapes, continuations, mixed quoting and inline quote removal are
    deliberately rejected so candidate and live preflights cannot interpret a
    secret differently. Values are returned exactly, without expansion.
    """
    _regular_file(env_file, "environment file")
    if env_file.stat().st_size > 1024 * 1024:
        raise GuardError("environment file is unexpectedly large")
    values: dict[str, str] = {}
    for number, raw in enumerate(env_file.read_text(encoding="utf-8-sig").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise GuardError(f"environment file has an invalid line {number}")
        key, encoded = line.split("=", 1)
        key, encoded = key.strip(), encoded.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key) or key in values:
            raise GuardError(f"environment file has an invalid or duplicate key on line {number}")
        if "\x00" in encoded:
            raise GuardError("environment file contains a NUL byte")
        if "\\" in encoded:
            raise GuardError(f"environment file uses an unsupported escape or continuation on line {number}")
        if encoded[:1] in {"'", '"'}:
            quote = encoded[0]
            if len(encoded) < 2 or encoded[-1] != quote or quote in encoded[1:-1]:
                raise GuardError(f"environment file has unsupported or unclosed quoting on line {number}")
            value = encoded[1:-1]
        else:
            if any(character.isspace() or character in "'\"" for character in encoded):
                raise GuardError(f"environment file value must be wholly quoted on line {number}")
            value = encoded
        values[key] = value
    return values


def _validate_production_environment(values: dict[str, str]) -> None:
    required = ("ENVIRONMENT", "AUTH_MODE", "DATABASE_URL", "CORS_ALLOW_ORIGINS", "MYSTERY_AUTH_SECRET_KEY")
    if any(not values.get(key) for key in required):
        raise GuardError("production environment metadata is incomplete")
    if values["ENVIRONMENT"] != "production" or values["AUTH_MODE"] != "mystery_public":
        raise GuardError("production environment must use production/mystery_public mode")
    auto_ddl = values.get("LOCAL_DEVELOPMENT_AUTO_DDL", "").lower()
    if auto_ddl not in {"", "0", "false", "no", "off"}:
        raise GuardError("production environment must disable LOCAL_DEVELOPMENT_AUTO_DDL")
    _validate_postgresql_probe_policy(values)


def _validate_postgresql_probe_policy(values: dict[str, str]) -> None:
    url = values.get("DATABASE_URL", "")
    try:
        parsed = urllib.parse.urlsplit(url.replace("postgresql+psycopg://", "postgresql://", 1))
    except ValueError:
        raise GuardError("candidate probe database configuration is invalid") from None
    if parsed.scheme not in {"postgresql", "postgres"}:
        raise GuardError("candidate probe requires PostgreSQL")
    query = urllib.parse.parse_qs(parsed.query)
    sslmode = query.get("sslmode", [""])[-1].lower()
    if sslmode not in {"require", "verify-ca", "verify-full"}:
        raise GuardError("candidate probe database configuration does not enforce TLS")
    if "options" in query:
        raise GuardError("candidate probe database URL must not override the enforced read-only options")


def _http_over_unix(socket_path: Path, target: str, timeout: float) -> tuple[int, bytes]:
    connection = _UnixHTTPConnection(socket_path, timeout)
    try:
        connection.request("GET", target, headers={"Host": "localhost", "Connection": "close"})
        response = connection.getresponse()
        body = response.read(65537)
        if len(body) > 65536:
            raise GuardError("candidate probe response is too large")
        return response.status, body
    finally:
        connection.close()


def _read_liveness_marker(marker: Path) -> dict[str, int]:
    try:
        raw = json.loads(marker.read_text(encoding="ascii"))
    except (OSError, ValueError):
        raise GuardError("candidate probe did not publish a valid liveness marker") from None
    if set(raw) != {"pid", "pgid", "start_ticks"} or any(type(raw[k]) is not int for k in ("pid", "pgid")) \
            or not isinstance(raw["start_ticks"], str) or not raw["start_ticks"].isdigit():
        raise GuardError("candidate probe liveness marker is invalid")
    return raw


def _marker_process_is_live(marker: Path, expected_pgid: int) -> bool:
    try:
        identity = _read_liveness_marker(marker)
        if identity["pgid"] != expected_pgid or os.getpgid(identity["pid"]) != expected_pgid:
            return False
        current_ticks = Path(f"/proc/{identity['pid']}/stat").read_text(encoding="ascii").split()[21]
        return current_ticks == identity["start_ticks"]
    except (GuardError, OSError, IndexError):
        return False


def _capture_probe_identity(process: subprocess.Popen[bytes]) -> dict[str, int | str]:
    """Capture the direct Popen child incarnation before it can publish state."""
    pid = process.pid
    try:
        pgid = os.getpgid(pid)
        start_ticks = Path(f"/proc/{pid}/stat").read_text(encoding="ascii").split()[21]
    except (OSError, IndexError):
        raise GuardError("candidate probe direct-child identity is unavailable") from None
    if pgid != pid or not start_ticks.isdigit():
        raise GuardError("candidate probe did not create its expected private process group")
    return {"pid": pid, "pgid": pgid, "start_ticks": start_ticks}


def _direct_probe_is_live(identity: dict[str, int | str]) -> bool:
    try:
        pid, pgid = int(identity["pid"]), int(identity["pgid"])
        if os.getpgid(pid) != pgid:
            return False
        ticks = Path(f"/proc/{pid}/stat").read_text(encoding="ascii").split()[21]
        return ticks == identity["start_ticks"]
    except (OSError, IndexError, KeyError, TypeError, ValueError):
        return False


def _capture_probe_group_members(pgid: int) -> list[dict[str, int | str]]:
    """Snapshot PID incarnations currently belonging to the private group."""
    members: list[dict[str, int | str]] = []
    for process in Path("/proc").iterdir():
        if not process.name.isdigit():
            continue
        try:
            fields = (process / "stat").read_text(encoding="ascii").split()
            if int(fields[4]) == pgid:
                members.append({"pid": int(process.name), "pgid": pgid, "start_ticks": fields[21]})
        except (OSError, IndexError, ValueError):
            continue
    return members


def _stop_probe(
    process: subprocess.Popen[bytes], direct_identity: dict[str, int | str], *, grace_seconds: float = 3.0
) -> None:
    """Stop the authenticated direct child and its private process group."""
    pgid = int(direct_identity["pgid"])
    members: list[dict[str, int | str]] = []
    if process.poll() is None:
        if not _direct_probe_is_live(direct_identity):
            raise GuardError("candidate probe direct-child identity changed before cleanup")
        members = _capture_probe_group_members(pgid)
        os.killpg(pgid, signal.SIGTERM)
    try:
        process.wait(timeout=grace_seconds)
    except subprocess.TimeoutExpired:
        if not _direct_probe_is_live(direct_identity):
            raise GuardError("candidate probe direct-child identity changed during cleanup") from None
        os.killpg(pgid, signal.SIGKILL)
        try:
            process.wait(timeout=grace_seconds)
        except subprocess.TimeoutExpired as exc:
            raise GuardError("candidate probe process could not be reaped") from exc
    # The group-wide TERM was issued only while its leader incarnation was
    # authenticated. If a captured descendant ignored it, authenticate that
    # exact PID incarnation and kill it individually; never signal a bare PGID
    # after the leader has exited and could no longer authenticate the group.
    for member in members:
        if int(member["pid"]) != process.pid and _direct_probe_is_live(member):
            os.kill(int(member["pid"]), signal.SIGKILL)
    deadline = time.monotonic() + grace_seconds
    while any(_direct_probe_is_live(member) for member in members) and time.monotonic() < deadline:
        time.sleep(0.02)
    if any(_direct_probe_is_live(member) for member in members):
        raise GuardError("candidate probe left an authenticated descendant alive")


def check_candidate_application(
    release_dir: Path,
    env_file: Path,
    shared_root: Path,
    *,
    required_uid: int = 0,
    service_uid: int | None = None,
    service_gid: int | None = None,
    command_prefix: tuple[str, ...] = ("/usr/sbin/runuser", "-u", "cxadmin", "-g", "www-data", "--"),
    startup_timeout: float = 30.0,
    request_timeout: float = 3.0,
) -> dict[str, Any]:
    """Start the authenticated candidate privately and prove its public contract.

    The caller authenticates installed files/runtime/source/database heads first.
    Candidate code runs only as the service identity. Application startup owns
    no schema changes; PostgreSQL still receives a session-level read-only
    default as defense in depth while readiness SELECTs remain available.
    """
    manifest_path = release_dir / "release-manifest.json"
    manifest = validate_manifest(json.loads(manifest_path.read_text(encoding="utf-8")))
    if release_dir.name != manifest["release_id"]:
        raise GuardError("candidate release identity differs from its directory")
    expected_sha = manifest["git_sha"]
    backend = release_dir / "backend"
    python = backend / "venv/bin/python"
    uvicorn = backend / "venv/bin/uvicorn"
    for path, label, kind in (
        (backend, "candidate backend", "dir"),
        (python, "candidate Python", "file"),
        (uvicorn, "candidate Uvicorn", "file"),
    ):
        if (kind == "dir" and not path.is_dir()) or (kind == "file" and not path.is_file()):
            raise GuardError(f"{label} is missing")
    if not os.access(python, os.X_OK) or not os.access(uvicorn, os.X_OK):
        raise GuardError("candidate launchers are not executable")
    if shared_root.is_symlink() or not shared_root.is_dir():
        raise GuardError("shared probe root is unsafe")
    shared_info = shared_root.stat()
    if shared_info.st_mode & 0o007:
        raise GuardError("shared probe root is accessible to other users")

    values = _read_runtime_environment(env_file)
    _validate_production_environment(values)
    values.update({
        "APP_VERSION": expected_sha,
        "HOME": "/nonexistent",
        "PATH": "/usr/bin:/bin",
        "PGOPTIONS": "-c default_transaction_read_only=on",
        "PGSSLCERTMODE": "disable",
        "PYTHONDONTWRITEBYTECODE": "1",
    })
    for key in tuple(values):
        if (key.startswith(("PYTHON", "PIP_", "LD_")) and key != "PYTHONDONTWRITEBYTECODE"):
            del values[key]

    service_uid = pwd.getpwnam("cxadmin").pw_uid if service_uid is None else service_uid
    service_gid = grp.getgrnam("www-data").gr_gid if service_gid is None else service_gid
    probe_dir = Path(tempfile.mkdtemp(prefix=".preactivation-app-", dir=shared_root))
    socket_path = probe_dir / "app.sock"
    marker = probe_dir / "liveness.json"
    process: subprocess.Popen[bytes] | None = None
    direct_identity: dict[str, int | str] | None = None
    completed_ns = 0
    try:
        os.chown(probe_dir, service_uid, service_gid)
        os.chmod(probe_dir, 0o700)
        service_command = (
            *command_prefix,
            str(python), "-I", "-c", PROBE_LAUNCHER, str(marker), str(uvicorn),
            "app.main:app", "--uds", str(socket_path), "--no-access-log", "--log-level", "warning",
        )
        command = (sys.executable, "-I", "-c", ROOT_PROBE_LAUNCHER, *service_command)
        process = subprocess.Popen(
            command,
            cwd=backend,
            env=values,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        try:
            direct_identity = _capture_probe_identity(process)
        except Exception:
            if process.poll() is None:
                process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)
            raise
        deadline = time.monotonic() + startup_timeout
        last_status: int | None = None
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise GuardError("candidate application exited before readiness")
            if marker.exists() and socket_path.exists():
                if not _marker_process_is_live(marker, process.pid):
                    raise GuardError("candidate application liveness identity changed")
                try:
                    status_code, body = _http_over_unix(socket_path, "/health/ready", request_timeout)
                    last_status = status_code
                    if status_code == 200:
                        try:
                            payload = json.loads(body)
                        except (UnicodeDecodeError, json.JSONDecodeError):
                            raise GuardError("candidate readiness is not valid JSON") from None
                        if not isinstance(payload, dict) or payload.get("status") != "ready" \
                                or payload.get("version") != expected_sha \
                                or not isinstance(payload.get("checks"), dict) \
                                or payload["checks"].get("database") != "ok":
                            raise GuardError("candidate readiness identity/status/database contract failed")
                        auth_status, _ = _http_over_unix(socket_path, "/auth/session", request_timeout)
                        if auth_status != 401:
                            raise GuardError("candidate anonymous session contract failed")
                        completed_ns = time.monotonic_ns()
                        return {
                            "release_id": manifest["release_id"],
                            "git_sha": expected_sha,
                            "ready_status": "ready",
                            "database": "ok",
                            "anonymous_session_status": 401,
                            "completed_monotonic_ns": completed_ns,
                        }
                except (ConnectionError, OSError, http.client.HTTPException, socket.timeout):
                    pass
            time.sleep(0.1)
        detail = f" (last HTTP status {last_status})" if last_status is not None else ""
        raise GuardError("candidate application readiness timed out" + detail)
    finally:
        cleanup_error: Exception | None = None
        if process is not None and direct_identity is not None:
            try:
                _stop_probe(process, direct_identity)
            except Exception as exc:  # preserve primary failure while still refusing success below
                cleanup_error = exc
        shutil.rmtree(probe_dir, ignore_errors=True)
        if cleanup_error is not None and sys.exc_info()[0] is None:
            raise cleanup_error


def _proc_start_ticks(proc_root: Path, pid: int) -> str:
    try:
        fields = (proc_root / str(pid) / "stat").read_text(encoding="ascii").split()
        if fields[2] in {"Z", "X", "x"}:
            raise GuardError("serving process is exiting or defunct")
        return fields[21]
    except (OSError, IndexError):
        raise GuardError("serving process start identity is unavailable") from None


def verify_serving_identity(
    release_dir: Path,
    expected_sha: str,
    operation_started_monotonic_us: int,
    properties: dict[str, str],
    *,
    proc_root: Path = Path("/proc"),
    required_service_uid: int | None = None,
    required_release_uid: int = 0,
) -> dict[str, Any]:
    """Bind systemd's actual MainPID and fresh start to the signed current tree."""
    if not GIT_SHA_RE.fullmatch(expected_sha):
        raise GuardError("serving identity expected SHA is invalid")
    manifest = validate_manifest(json.loads((release_dir / "release-manifest.json").read_text(encoding="utf-8")))
    if manifest["git_sha"] != expected_sha or release_dir.name != manifest["release_id"]:
        raise GuardError("serving release differs from signed current")
    try:
        pid = int(properties["MainPID"])
        started = int(properties["ExecMainStartTimestampMonotonic"])
    except (KeyError, ValueError):
        raise GuardError("serving process metadata is invalid") from None
    if pid <= 0 or started <= operation_started_monotonic_us:
        raise GuardError("serving process was not freshly started by this operation")
    process = proc_root / str(pid)
    if not process.is_dir():
        raise GuardError("systemd MainPID is not live")
    start_ticks_before = _proc_start_ticks(proc_root, pid)
    expected_cwd = (release_dir / "backend").resolve(strict=True)
    try:
        actual_cwd = (process / "cwd").resolve(strict=True)
        actual_exe = (process / "exe").resolve(strict=True)
        cmdline = (process / "cmdline").read_bytes().split(b"\0")
    except OSError:
        raise GuardError("serving process identity cannot be inspected") from None
    if actual_cwd != expected_cwd:
        raise GuardError("serving process cwd is not the signed current backend")
    python = release_dir / "backend/venv/bin/python"
    uvicorn = release_dir / "backend/venv/bin/uvicorn"
    try:
        python_info = python.lstat()
        resolved_python = python.resolve(strict=True)
        resolved_info = resolved_python.stat()
        resolved_uvicorn = uvicorn.resolve(strict=True)
    except OSError:
        raise GuardError("serving virtualenv launch identity is invalid") from None
    if not (stat.S_ISREG(resolved_info.st_mode) and os.access(resolved_python, os.X_OK)) \
            or resolved_info.st_mode & 0o022 or resolved_info.st_uid != required_release_uid:
        raise GuardError("serving virtualenv Python target is unsafe")
    if python.is_symlink() and python_info.st_uid != required_release_uid:
        raise GuardError("serving virtualenv Python symlink is not root-controlled")
    if actual_exe != resolved_python:
        raise GuardError("systemd MainPID executable is not the signed release Python")
    launch_paths: list[Path] = []
    for raw in cmdline[:3]:
        if not raw or not raw.startswith(b"/"):
            continue
        try:
            launch_paths.append(Path(os.fsdecode(raw)).resolve(strict=True))
        except OSError:
            continue
    if resolved_uvicorn not in launch_paths:
        raise GuardError("systemd MainPID command line is not the signed release Uvicorn launcher")
    if required_service_uid is not None and process.stat().st_uid != required_service_uid:
        raise GuardError("systemd MainPID does not run as the service user")
    start_ticks_after = _proc_start_ticks(proc_root, pid)
    if start_ticks_after != start_ticks_before:
        raise GuardError("systemd MainPID incarnation changed during inspection")
    return {"main_pid": pid, "started_monotonic_us": started, "release_id": manifest["release_id"],
            "git_sha": expected_sha}


def check_serving_identity(
    release_dir: Path,
    expected_sha: str,
    operation_started_monotonic_us: int,
    service_name: str,
    *,
    proc_root: Path = Path("/proc"),
    required_service_uid: int | None = None,
    required_release_uid: int = 0,
) -> dict[str, Any]:
    keys = ("MainPID", "ExecMainStartTimestampMonotonic", "User", "Group")
    command = ["/usr/bin/systemctl", "show", service_name, *[f"--property={key}" for key in keys]]

    def read_properties() -> dict[str, str]:
        result = subprocess.run(
            command, stdin=subprocess.DEVNULL, capture_output=True, text=True, check=False, cwd="/",
        )
        if result.returncode:
            raise GuardError("systemd serving identity metadata is unavailable")
        return dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)

    properties = read_properties()
    if properties.get("User") != "cxadmin" or properties.get("Group") != "www-data":
        raise GuardError("systemd service identity is not cxadmin:www-data")
    identity = verify_serving_identity(
        release_dir,
        expected_sha,
        operation_started_monotonic_us,
        properties,
        proc_root=proc_root,
        required_service_uid=(pwd.getpwnam("cxadmin").pw_uid if required_service_uid is None else required_service_uid),
        required_release_uid=required_release_uid,
    )
    after = read_properties()
    for key in ("MainPID", "ExecMainStartTimestampMonotonic"):
        if after.get(key) != properties.get(key):
            raise GuardError("systemd serving process metadata changed during inspection")
    return identity


def store_archive(
    archive_root: Path,
    bundle: Path,
    signature: Path,
    manifest: dict[str, Any],
    verified_at_utc: str,
) -> None:
    release_id = manifest["release_id"]
    paths = archive_paths(archive_root, release_id)
    archive_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if archive_root.is_symlink():
        raise GuardError("archive root must not be a symlink")
    if paths["root"].exists():
        raise GuardError("archive already exists for release")
    temp_dir = Path(tempfile.mkdtemp(prefix=f".{release_id}.", dir=archive_root))
    try:
        temp_bundle = temp_dir / "bundle.zip"
        temp_signature = temp_dir / "bundle.zip.sig"
        shutil.copyfile(bundle, temp_bundle)
        shutil.copyfile(signature, temp_signature)
        os.chmod(temp_bundle, 0o600)
        os.chmod(temp_signature, 0o600)
        checksum = manifest["bundle_sha256"]
        (temp_dir / "bundle.zip.sha256").write_text(f"{checksum}  bundle.zip\n", encoding="ascii")
        metadata = {
            "schema_version": 1,
            "release_id": release_id,
            "bundle_sha256": checksum,
            "status": "deploy_verified",
            "verified_at_utc": verified_at_utc,
        }
        (temp_dir / "metadata.json").write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        for name in ("bundle.zip.sha256", "metadata.json"):
            os.chmod(temp_dir / name, 0o600)
        # Durably prepare the complete set, then publish it with one rename.
        # Readers therefore observe either no release archive or all four files.
        for child in temp_dir.iterdir():
            with child.open("rb") as handle:
                os.fsync(handle.fileno())
        directory_fd = os.open(temp_dir, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
        os.replace(temp_dir, paths["root"])
        root_fd = os.open(archive_root, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(root_fd)
        finally:
            os.close(root_fd)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def migration_heads_from_manifest(path: Path) -> list[str]:
    _regular_file(path, "manifest")
    return validate_manifest(json.loads(path.read_text(encoding="utf-8")))["expected_migration_heads"]


def source_migration_heads(alembic_ini: Path) -> list[str]:
    """Resolve the actual Alembic graph; fail on a fork or missing revision."""
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    _regular_file(alembic_ini, "Alembic configuration")
    config = Config(str(alembic_ini))
    config.set_main_option("script_location", str(alembic_ini.parent / "alembic"))
    scripts = ScriptDirectory.from_config(config)
    list(scripts.walk_revisions())  # force graph validation, including missing ancestors
    heads = sorted(scripts.get_heads())
    if len(heads) != 1:
        raise GuardError(f"expected one source migration head, found {len(heads)}")
    return heads


def check_db_heads(env_file: Path, manifest: Path, alembic_ini: Path) -> None:
    """Read source and database heads and compare exactly; never mutate the DB."""
    from alembic.runtime.migration import MigrationContext
    from sqlalchemy import create_engine
    from sqlalchemy.pool import NullPool

    values: dict[str, str] = {}
    for raw in env_file.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key.strip()] = value
    url = values.get("DATABASE_URL", "")
    if not url:
        raise GuardError("DATABASE_URL is missing")
    expected = migration_heads_from_manifest(manifest)
    try:
        source = source_migration_heads(alembic_ini)
    except Exception:
        raise GuardError("installed Alembic source graph is invalid") from None
    if source != expected:
        raise GuardError("signed manifest migration heads differ from installed source graph")
    try:
        engine_kwargs: dict[str, Any] = {"poolclass": NullPool, "pool_pre_ping": True}
        if url.startswith(("postgresql:", "postgresql+")):
            engine_kwargs["connect_args"] = {"options": "-c default_transaction_read_only=on"}
        engine = create_engine(url, **engine_kwargs)
        try:
            with engine.connect() as connection:
                current = sorted(MigrationContext.configure(connection).get_current_heads())
        finally:
            engine.dispose()
    except Exception as exc:
        # SQLAlchemy/driver exception strings can contain connection details.
        # Do not let a traceback or URL enter a deployment log.
        raise GuardError("database revision check failed; inspect DB connectivity through approved diagnostics") from None
    if current != expected:
        raise GuardError(f"migration heads are incompatible (expected {len(expected)}, current {len(current)})")


def eligible_prune_ids(archive_root: Path, protected: set[str], retain_count: int) -> list[str]:
    records: list[tuple[int, str]] = []
    for release_root in archive_root.iterdir():
        if release_root.is_symlink() or not release_root.is_dir():
            continue
        release_id = release_root.name
        if not RELEASE_ID_RE.fullmatch(release_id):
            continue
        paths = archive_paths(archive_root, release_id)
        if not all(paths[key].is_file() and not paths[key].is_symlink() for key in ("bundle", "signature", "checksum", "metadata")):
            continue
        records.append((paths["metadata"].stat().st_mtime_ns, release_id))
    records.sort(reverse=True)
    keep = {release_id for _, release_id in records[:retain_count]} | protected
    return [release_id for _, release_id in reversed(records) if release_id not in keep]


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    bundle = sub.add_parser("verify-bundle")
    bundle.add_argument("bundle", type=Path)
    bundle.add_argument("sha256")
    bundle.add_argument("signature", type=Path)
    bundle.add_argument("allowed_signers", type=Path)
    archive = sub.add_parser("verify-archive")
    archive.add_argument("archive_root", type=Path)
    archive.add_argument("release_id")
    archive.add_argument("allowed_signers", type=Path)
    installed = sub.add_parser("verify-installed")
    installed.add_argument("release_dir", type=Path)
    installed.add_argument("archive_root", type=Path)
    installed.add_argument("release_id")
    installed.add_argument("allowed_signers", type=Path)
    installed_bundle = sub.add_parser("verify-installed-bundle")
    installed_bundle.add_argument("release_dir", type=Path)
    installed_bundle.add_argument("bundle", type=Path)
    installed_bundle.add_argument("release_id")
    runtime = sub.add_parser("check-runtime")
    runtime.add_argument("release_dir", type=Path)
    candidate = sub.add_parser("check-candidate-app")
    candidate.add_argument("release_dir", type=Path)
    candidate.add_argument("env_file", type=Path)
    candidate.add_argument("shared_root", type=Path)
    environment = sub.add_parser("check-production-environment")
    environment.add_argument("env_file", type=Path)
    serving = sub.add_parser("check-serving-identity")
    serving.add_argument("release_dir", type=Path)
    serving.add_argument("expected_sha")
    serving.add_argument("operation_started_monotonic_us", type=int)
    serving.add_argument("service_name")
    store = sub.add_parser("store-archive")
    store.add_argument("archive_root", type=Path)
    store.add_argument("bundle", type=Path)
    store.add_argument("signature", type=Path)
    store.add_argument("manifest_json", type=Path)
    store.add_argument("verified_at_utc")
    db = sub.add_parser("check-db-heads")
    db.add_argument("env_file", type=Path)
    db.add_argument("manifest", type=Path)
    db.add_argument("alembic_ini", type=Path)
    source = sub.add_parser("source-heads")
    source.add_argument("alembic_ini", type=Path)
    operation = sub.add_parser("authorize-operation")
    operation.add_argument("operation", type=Path)
    operation.add_argument("signature", type=Path)
    operation.add_argument("allowed_signers", type=Path)
    operation.add_argument("nonce_root", type=Path)
    operation.add_argument("current_release_id")
    recovery_audit = sub.add_parser("append-recovery-audit")
    recovery_audit.add_argument("evidence_root", type=Path)
    recovery_audit.add_argument("operation_nonce")
    recovery_audit.add_argument("operation_action")
    recovery_audit.add_argument("recovery_mode")
    recovery_audit.add_argument("original_release_id")
    recovery_audit.add_argument("failed_release_id")
    recovery_audit.add_argument("attempt_context")
    recovery_audit.add_argument("started_monotonic_ns", type=int)
    recovery_audit.add_argument("started_at_utc")
    recovery_audit.add_argument("outcome")
    recovery_audit.add_argument("failure_class")
    recovery_audit.add_argument("probe_status")
    recovery_audit.add_argument("successful_restoration")
    suite = sub.add_parser("suite-version")
    suite.add_argument("paths", type=Path, nargs="+")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "verify-bundle":
            result = verify_bundle(args.bundle, args.sha256, args.signature, args.allowed_signers)
            print(json.dumps(result, sort_keys=True))
        elif args.command == "verify-archive":
            print(json.dumps(verify_archive(args.archive_root, args.release_id, args.allowed_signers), sort_keys=True))
        elif args.command == "verify-installed":
            print(json.dumps(verify_installed_release(args.release_dir, args.archive_root, args.release_id, args.allowed_signers), sort_keys=True))
        elif args.command == "verify-installed-bundle":
            print(json.dumps(verify_installed_files(args.release_dir, args.bundle, args.release_id), sort_keys=True))
        elif args.command == "check-runtime":
            check_runtime_usability(args.release_dir)
            print("installed virtualenv is usable and requirements-complete")
        elif args.command == "check-candidate-app":
            print(json.dumps(check_candidate_application(args.release_dir, args.env_file, args.shared_root), sort_keys=True))
        elif args.command == "check-production-environment":
            _validate_production_environment(_read_runtime_environment(args.env_file))
            print("environment metadata and restricted EnvironmentFile grammar validated")
        elif args.command == "check-serving-identity":
            print(json.dumps(check_serving_identity(
                args.release_dir,
                args.expected_sha,
                args.operation_started_monotonic_us,
                args.service_name,
            ), sort_keys=True))
        elif args.command == "store-archive":
            manifest = json.loads(args.manifest_json.read_text(encoding="utf-8"))
            store_archive(args.archive_root, args.bundle, args.signature, manifest, args.verified_at_utc)
        elif args.command == "check-db-heads":
            check_db_heads(args.env_file, args.manifest, args.alembic_ini)
            print("migration heads match signed release manifest and installed source")
        elif args.command == "source-heads":
            print(json.dumps(source_migration_heads(args.alembic_ini)))
        elif args.command == "authorize-operation":
            print(
                json.dumps(
                    authorize_operation(
                        args.operation,
                        args.signature,
                        args.allowed_signers,
                        args.nonce_root,
                        args.current_release_id,
                    ),
                    sort_keys=True,
                )
            )
        elif args.command == "append-recovery-audit":
            print(json.dumps(append_recovery_audit(
                args.evidence_root,
                args.operation_nonce,
                args.operation_action,
                args.recovery_mode,
                args.original_release_id,
                args.failed_release_id,
                args.attempt_context,
                args.started_monotonic_ns,
                args.started_at_utc,
                args.outcome,
                args.failure_class,
                args.probe_status,
                args.successful_restoration,
            ), sort_keys=True))
        elif args.command == "suite-version":
            print(privileged_suite_version(args.paths))
        else:
            raise AssertionError(args.command)
    except (GuardError, OSError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
        print(f"release guard: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
