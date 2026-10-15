#!/usr/bin/env python3
"""Validate the contents and integrity contract of a Mystery Public release ZIP."""

from __future__ import annotations

import hashlib
import re
import stat
import sys
import zipfile
from pathlib import Path, PurePosixPath


class BundleContractError(ValueError):
    """The archive does not satisfy the unsigned release bundle contract."""


REQUIRED_RUNTIME_FILES = frozenset(
    {
        "release/release-manifest.json",
        "release/backend/requirements.txt",
        "release/backend/alembic.ini",
        "release/frontends/public/mystery-shopper/dist/index.html",
        "release/scripts/linux/install_mystery_public_bundle.sh",
        "release/scripts/linux/deploy_mystery_public_backend.sh",
        "release/scripts/linux/deploy_mystery_public_nginx.sh",
        "release/scripts/linux/verify_mystery_public.sh",
        "release/scripts/linux/audit_mystery_public_vm.sh",
        "release/scripts/linux/mystery_public_release_guard.py",
    }
)
SUMS_MEMBER = "release/SHA256SUMS"
_HASH_LINE = re.compile(r"([0-9a-f]{64})  ([^\r\n]+)")


def _safe_member_name(name: str) -> None:
    if not name or "\x00" in name or "\\" in name or name.startswith("/"):
        raise BundleContractError(f"unsafe archive member name: {name!r}")
    path = PurePosixPath(name)
    if len(path.parts) < 2 or path.parts[0] != "release" \
            or any(part in {"", ".", ".."} for part in path.parts):
        raise BundleContractError(f"unsafe archive member name: {name!r}")
    if path.as_posix() != name:
        raise BundleContractError(f"non-canonical archive member name: {name!r}")


def _require_regular_member(info: zipfile.ZipInfo) -> None:
    mode = info.external_attr >> 16
    if info.is_dir() or stat.S_IFMT(mode) != stat.S_IFREG:
        raise BundleContractError(f"archive member is not a regular file: {info.filename}")
    if info.flag_bits & 0x1:
        raise BundleContractError(f"encrypted archive member is not allowed: {info.filename}")


def _parse_sums(raw: bytes) -> dict[str, str]:
    try:
        text = raw.decode("ascii")
    except UnicodeDecodeError as exc:
        raise BundleContractError("SHA256SUMS must be ASCII") from exc
    if not text or not text.endswith("\n"):
        raise BundleContractError("SHA256SUMS must be non-empty and newline terminated")

    recorded: dict[str, str] = {}
    for number, line in enumerate(text.splitlines(), 1):
        match = _HASH_LINE.fullmatch(line)
        if match is None:
            raise BundleContractError(f"invalid SHA256SUMS line {number}")
        digest, relative = match.groups()
        _safe_member_name(f"release/{relative}")
        if relative == "SHA256SUMS":
            raise BundleContractError("SHA256SUMS must not hash itself")
        if relative in recorded:
            raise BundleContractError(f"duplicate SHA256SUMS entry: {relative}")
        recorded[relative] = digest
    return recorded


def validate_bundle(bundle: Path) -> None:
    """Fail unless every safe, unique regular member is covered by SHA256SUMS."""
    try:
        with zipfile.ZipFile(bundle) as archive:
            members: dict[str, zipfile.ZipInfo] = {}
            for info in archive.infolist():
                _safe_member_name(info.filename)
                if info.filename in members:
                    raise BundleContractError(f"duplicate archive member: {info.filename}")
                _require_regular_member(info)
                members[info.filename] = info

            missing_runtime = sorted(REQUIRED_RUNTIME_FILES - members.keys())
            if missing_runtime:
                raise BundleContractError(
                    "missing runtime deployment dependencies: " + ", ".join(missing_runtime)
                )
            if SUMS_MEMBER not in members:
                raise BundleContractError("missing release/SHA256SUMS")

            recorded = _parse_sums(archive.read(members[SUMS_MEMBER]))
            actual_relatives = {
                name.removeprefix("release/") for name in members if name != SUMS_MEMBER
            }
            missing_hashes = sorted(actual_relatives - recorded.keys())
            extra_hashes = sorted(recorded.keys() - actual_relatives)
            if missing_hashes:
                raise BundleContractError(
                    "archive members missing from SHA256SUMS: " + ", ".join(missing_hashes)
                )
            if extra_hashes:
                raise BundleContractError(
                    "SHA256SUMS entries missing from archive: " + ", ".join(extra_hashes)
                )

            for relative in sorted(actual_relatives):
                member = members[f"release/{relative}"]
                digest = hashlib.sha256(archive.read(member)).hexdigest()
                if digest != recorded[relative]:
                    raise BundleContractError(f"SHA256SUMS mismatch: {relative}")
    except (OSError, zipfile.BadZipFile, zipfile.LargeZipFile) as exc:
        raise BundleContractError(f"unable to read release archive: {exc}") from exc


def main(argv: list[str] | None = None) -> int:
    arguments = sys.argv[1:] if argv is None else argv
    if len(arguments) != 1:
        print("Usage: validate_mystery_public_bundle.py BUNDLE.zip", file=sys.stderr)
        return 64
    try:
        validate_bundle(Path(arguments[0]))
    except BundleContractError as exc:
        print(f"Bundle contract rejected: {exc}", file=sys.stderr)
        return 1
    print("Mystery Public bundle dependency and SHA256SUMS contract validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
