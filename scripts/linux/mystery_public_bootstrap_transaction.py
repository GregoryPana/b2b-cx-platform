#!/usr/bin/env python3
"""Fail-closed transaction helper for the privileged Mystery bootstrap.

This helper is executed only from a root-only bootstrap snapshot and is installed
as the fourth canonical privileged-suite file. It snapshots exact pre-cutover
file state, atomically publishes prevalidated staged files, and restores an
interrupted uncommitted cutover before another bootstrap can start. It
deliberately knows nothing about application secrets.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import pathlib
import re
import shutil
import stat
import tempfile
from typing import Any, NoReturn

SCHEMA_VERSION = 1
MAX_JOURNAL_BYTES = 65536
MAX_ID = (1 << 32) - 2
MAX_TIMESTAMP_NS = (1 << 63) - 1


class TransactionError(RuntimeError):
    pass


def _die(message: str) -> NoReturn:
    raise TransactionError(message)


def _fsync_dir(path: pathlib.Path) -> None:
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _read_regular(path: pathlib.Path, *, required_uid: int, max_bytes: int | None = None) -> tuple[bytes, os.stat_result]:
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != required_uid or info.st_mode & 0o022:
            _die(f"unsafe root-controlled file: {path}")
        if max_bytes is not None and info.st_size > max_bytes:
            _die(f"file is too large: {path}")
        data = b""
        while True:
            block = os.read(fd, 1024 * 1024)
            if not block:
                break
            data += block
        return data, info
    finally:
        os.close(fd)


def _xattrs(path: pathlib.Path) -> dict[str, str]:
    result: dict[str, str] = {}
    try:
        names = os.listxattr(path, follow_symlinks=False)
    except OSError as exc:
        _die(f"cannot read extended attributes for {path}: {exc}")
    for name in names:
        try:
            result[name] = base64.b64encode(os.getxattr(path, name, follow_symlinks=False)).decode("ascii")
        except OSError as exc:
            _die(f"cannot read extended attribute {name} for {path}: {exc}")
    return result


def _valid_xattr_name(name: Any) -> bool:
    if not isinstance(name, str) or re.fullmatch(r"(?:user|trusted|security|system)\.[^\x00/]+", name) is None:
        return False
    try:
        encoded = name.encode("utf-8")
    except UnicodeEncodeError:
        return False
    return len(encoded) <= 255 and all(ord(character) >= 0x20 for character in name)


def _parse_items(raw: str) -> list[dict[str, Any]]:
    try:
        items = json.loads(raw)
    except json.JSONDecodeError as exc:
        _die(f"invalid item description: {exc}")
    if not isinstance(items, list) or not items:
        _die("item description must be a non-empty list")
    allowed = {"label", "destination", "staged", "mode", "identity"}
    destinations: set[str] = set()
    identity_count = 0
    for item in items:
        if not isinstance(item, dict) or set(item) != allowed:
            _die("invalid item description schema")
        if not all(isinstance(item[key], str) and item[key] for key in ("label", "destination", "staged")):
            _die("invalid item path or label")
        destination = pathlib.Path(item["destination"])
        staged = pathlib.Path(item["staged"])
        if not destination.is_absolute() or not staged.is_absolute() or ".." in destination.parts or ".." in staged.parts:
            _die("transaction paths must be absolute and normalized")
        if item["destination"] in destinations:
            _die("duplicate transaction destination")
        destinations.add(item["destination"])
        if not isinstance(item["mode"], int) or item["mode"] < 0 or item["mode"] > 0o7777:
            _die("invalid destination mode")
        if type(item["identity"]) is not bool:
            _die("identity flag must be boolean")
        identity_count += int(item["identity"])
    if identity_count != 1 or not items[-1]["identity"]:
        _die("suite identity must be the single final publish item")
    return items


def _atomic_json(path: pathlib.Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if path.parent.is_symlink():
        _die("journal parent must not be a symlink")
    temporary_fd, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = pathlib.Path(temporary_name)
    try:
        os.fchmod(temporary_fd, 0o600)
        with os.fdopen(temporary_fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, sort_keys=True, separators=(",", ":"))
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        _fsync_dir(path.parent)
    finally:
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass


def _load_journal(path: pathlib.Path, items: list[dict[str, Any]]) -> dict[str, Any]:
    data, info = _read_regular(path, required_uid=os.geteuid(), max_bytes=MAX_JOURNAL_BYTES)
    if stat.S_IMODE(info.st_mode) != 0o600:
        _die("bootstrap journal must be mode 0600")
    try:
        journal = json.loads(data)
    except json.JSONDecodeError as exc:
        _die(f"invalid bootstrap journal JSON: {exc}")
    required = {"schema_version", "phase", "proposed_suite_version", "snapshot_root", "items"}
    if not isinstance(journal, dict) or set(journal) != required or journal["schema_version"] != SCHEMA_VERSION:
        _die("invalid bootstrap journal schema")
    if journal["phase"] not in {"prepared", "cutover", "restored", "committed"}:
        _die("invalid bootstrap journal phase")
    if not isinstance(journal["proposed_suite_version"], str) or not re.fullmatch(r"[0-9a-f]{64}", journal["proposed_suite_version"]):
        _die("invalid proposed suite version in journal")
    expected_destinations = [item["destination"] for item in items]
    records = journal["items"]
    if not isinstance(records, list) or [record.get("destination") for record in records if isinstance(record, dict)] != expected_destinations:
        _die("bootstrap journal destinations do not match the fixed transaction set")
    return journal


def snapshot(journal_path: pathlib.Path, snapshot_root: pathlib.Path, items: list[dict[str, Any]], proposed: str) -> None:
    if journal_path.exists() or journal_path.is_symlink() or snapshot_root.exists() or snapshot_root.is_symlink():
        _die("bootstrap recovery state already exists")
    snapshot_root.mkdir(mode=0o700, parents=False)
    records: list[dict[str, Any]] = []
    try:
        for index, item in enumerate(items):
            destination = pathlib.Path(item["destination"])
            record: dict[str, Any] = {"destination": str(destination), "present": False}
            try:
                info = destination.lstat()
            except FileNotFoundError:
                records.append(record)
                continue
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o022:
                _die(f"existing transaction destination is unsafe: {destination}")
            data, stable = _read_regular(destination, required_uid=os.geteuid())
            name = f"{index:02d}.snapshot"
            stored = snapshot_root / name
            fd = os.open(stored, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            record.update({
                "present": True,
                "snapshot": name,
                "sha256": _sha256(data),
                "uid": stable.st_uid,
                "gid": stable.st_gid,
                "mode": stat.S_IMODE(stable.st_mode),
                "atime_ns": stable.st_atime_ns,
                "mtime_ns": stable.st_mtime_ns,
                "xattrs": _xattrs(destination),
            })
            records.append(record)
        _fsync_dir(snapshot_root)
        _atomic_json(journal_path, {
            "schema_version": SCHEMA_VERSION,
            "phase": "prepared",
            "proposed_suite_version": proposed,
            "snapshot_root": str(snapshot_root),
            "items": records,
        })
    except Exception:
        if not journal_path.exists():
            shutil.rmtree(snapshot_root, ignore_errors=True)
        raise


def _atomic_copy(source: pathlib.Path, destination: pathlib.Path, mode: int, uid: int, gid: int, *, atime_ns: int | None = None, mtime_ns: int | None = None, xattrs: dict[str, str] | None = None) -> None:
    data, _ = _read_regular(source, required_uid=uid)
    destination.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
    parent_fd = os.open(destination.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    temporary_fd, temporary_name = tempfile.mkstemp(prefix=f".{destination.name}.", dir=destination.parent)
    temporary = pathlib.Path(temporary_name)
    try:
        os.fchown(temporary_fd, uid, gid)
        os.fchmod(temporary_fd, mode)
        with os.fdopen(temporary_fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        if xattrs is not None:
            for name in os.listxattr(temporary, follow_symlinks=False):
                os.removexattr(temporary, name, follow_symlinks=False)
            for name, encoded in xattrs.items():
                os.setxattr(temporary, name, base64.b64decode(encoded), follow_symlinks=False)
        os.chmod(temporary, mode, follow_symlinks=False)
        if mtime_ns is not None:
            os.utime(temporary, ns=(atime_ns if atime_ns is not None else mtime_ns, mtime_ns), follow_symlinks=False)
        os.replace(temporary, destination)
        os.fsync(parent_fd)
    finally:
        os.close(parent_fd)
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass


def publish(journal_path: pathlib.Path, items: list[dict[str, Any]], proposed: str) -> None:
    journal = _load_journal(journal_path, items)
    if journal["phase"] != "prepared" or journal["proposed_suite_version"] != proposed:
        _die("bootstrap journal does not authorize this proposed suite")
    for item in items:
        _read_regular(pathlib.Path(item["staged"]), required_uid=os.geteuid())
    journal["phase"] = "cutover"
    _atomic_json(journal_path, journal)
    for item in items:
        _atomic_copy(
            pathlib.Path(item["staged"]), pathlib.Path(item["destination"]), item["mode"], os.geteuid(), os.getegid()
        )


def _finalize_cleanup(journal_path: pathlib.Path, snapshot_root: pathlib.Path) -> None:
    """Finish cleanup while a durable terminal journal still proves intent."""
    try:
        info = snapshot_root.lstat()
    except FileNotFoundError:
        pass
    else:
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o700:
            _die("unsafe bootstrap snapshot directory")
        shutil.rmtree(snapshot_root)
    _fsync_dir(snapshot_root.parent)
    journal_path.unlink()
    _fsync_dir(journal_path.parent)


def recover(journal_path: pathlib.Path, items: list[dict[str, Any]], expected_snapshot_root: pathlib.Path | None = None) -> None:
    journal = _load_journal(journal_path, items)
    snapshot_root = pathlib.Path(journal["snapshot_root"])
    if expected_snapshot_root is not None and snapshot_root != expected_snapshot_root:
        _die("bootstrap journal snapshot path does not match the fixed recovery directory")
    if journal["phase"] in {"restored", "committed"}:
        _finalize_cleanup(journal_path, snapshot_root)
        return
    info = snapshot_root.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o700:
        _die("unsafe bootstrap snapshot directory")
    for index, record in enumerate(journal["items"]):
        destination = pathlib.Path(record["destination"])
        allowed_absent = {"destination", "present"}
        allowed_present = allowed_absent | {"snapshot", "sha256", "uid", "gid", "mode", "atime_ns", "mtime_ns", "xattrs"}
        if type(record.get("present")) is not bool or set(record) != (allowed_present if record.get("present") else allowed_absent):
            _die("invalid bootstrap snapshot record")
        if str(destination) != items[index]["destination"]:
            _die("bootstrap snapshot destination does not match the fixed transaction set")
        if record["present"]:
            if record["snapshot"] != f"{index:02d}.snapshot":
                _die("bootstrap snapshot name is not canonical")
            if not isinstance(record["sha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", record["sha256"]):
                _die("invalid bootstrap snapshot digest")
            for field in ("uid", "gid"):
                if type(record[field]) is not int or not 0 <= record[field] <= MAX_ID:
                    _die(f"invalid bootstrap snapshot {field}")
            if record["uid"] != os.geteuid():
                _die("bootstrap snapshot owner does not match the privileged transaction identity")
            if type(record["mode"]) is not int or not 0 <= record["mode"] <= 0o7777 or record["mode"] & 0o022:
                _die("invalid or writable bootstrap snapshot mode")
            for field in ("atime_ns", "mtime_ns"):
                if type(record[field]) is not int or not 0 <= record[field] <= MAX_TIMESTAMP_NS:
                    _die(f"invalid bootstrap snapshot {field}")
            if not isinstance(record["xattrs"], dict):
                _die("invalid bootstrap snapshot extended attributes")
            for name, encoded in record["xattrs"].items():
                if not _valid_xattr_name(name) or not isinstance(encoded, str):
                    _die("invalid bootstrap snapshot extended attributes")
                try:
                    decoded = base64.b64decode(encoded, validate=True)
                except (ValueError, UnicodeEncodeError):
                    _die("invalid bootstrap snapshot extended attributes")
                if len(decoded) > 65536:
                    _die("invalid bootstrap snapshot extended attributes")
            snapshot_file = snapshot_root / record["snapshot"]
            if snapshot_file.parent != snapshot_root:
                _die("snapshot path escapes recovery directory")
            data, _ = _read_regular(snapshot_file, required_uid=os.geteuid())
            if _sha256(data) != record["sha256"]:
                _die("bootstrap snapshot digest mismatch")
        else:
            if destination.exists() or destination.is_symlink():
                info = destination.lstat()
                if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid():
                    _die(f"refusing to remove unsafe interrupted destination: {destination}")
    # Validation of every record and snapshot completes before restoration starts.
    for record in journal["items"]:
        destination = pathlib.Path(record["destination"])
        if record["present"]:
            _atomic_copy(
                snapshot_root / record["snapshot"], destination, record["mode"], record["uid"], record["gid"],
                atime_ns=record["atime_ns"], mtime_ns=record["mtime_ns"], xattrs=record["xattrs"],
            )
        else:
            try:
                destination.unlink()
                _fsync_dir(destination.parent)
            except FileNotFoundError:
                pass
    # Publish a terminal restoration phase before deleting recovery material.
    # A crash before this point repeats the idempotent restoration; a crash
    # after it only finalizes tree-first cleanup and never rolls back again.
    journal["phase"] = "restored"
    _atomic_json(journal_path, journal)
    _finalize_cleanup(journal_path, snapshot_root)


def complete(journal_path: pathlib.Path, items: list[dict[str, Any]], proposed: str) -> None:
    journal = _load_journal(journal_path, items)
    if journal["phase"] != "cutover" or journal["proposed_suite_version"] != proposed:
        _die("bootstrap transaction is not ready to complete")
    for item in items:
        staged, _ = _read_regular(pathlib.Path(item["staged"]), required_uid=os.geteuid())
        live, info = _read_regular(pathlib.Path(item["destination"]), required_uid=os.geteuid())
        if staged != live or stat.S_IMODE(info.st_mode) != item["mode"]:
            _die(f"published bootstrap file differs from staged proposal: {item['label']}")
    snapshot_root = pathlib.Path(journal["snapshot_root"])
    journal["phase"] = "committed"
    _atomic_json(journal_path, journal)
    _finalize_cleanup(journal_path, snapshot_root)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("snapshot", "publish", "recover", "complete"))
    parser.add_argument("journal")
    parser.add_argument("items_json")
    parser.add_argument("proposed_suite_version", nargs="?", default="")
    parser.add_argument("snapshot_root", nargs="?", default="")
    args = parser.parse_args()
    items = _parse_items(args.items_json)
    journal = pathlib.Path(args.journal)
    if args.command == "snapshot":
        if not args.snapshot_root or len(args.proposed_suite_version) != 64:
            _die("snapshot requires proposed suite version and snapshot root")
        snapshot(journal, pathlib.Path(args.snapshot_root), items, args.proposed_suite_version)
    elif args.command == "publish":
        publish(journal, items, args.proposed_suite_version)
    elif args.command == "recover":
        recover(journal, items, pathlib.Path(args.proposed_suite_version) if args.proposed_suite_version else None)
    else:
        complete(journal, items, args.proposed_suite_version)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except TransactionError as exc:
        raise SystemExit(f"bootstrap transaction: {exc}")
