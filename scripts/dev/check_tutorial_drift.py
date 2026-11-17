#!/usr/bin/env python3
"""Tutorial-video drift guard.

Tutorial videos are recordings of real screens. When a screen, shared style or
email template that a video depends on changes, the video silently becomes
wrong. This script compares the watched files against the hashes stored in
docs/tutorials/<set>/video-manifest.json and says LOUDLY which video steps may
now be out of date.

It never edits app code. It warns; it does not decide. Clearing a warning is an
explicit act:

  acknowledge   "I looked, the video is still right" (reason is mandatory, logged)
  rebaseline    "I re-recorded the video against the new screens" (logged)

Usage (from the repo root):

  python scripts/dev/check_tutorial_drift.py check
  python scripts/dev/check_tutorial_drift.py check --changed-since origin/main --format markdown --output drift.md
  python scripts/dev/check_tutorial_drift.py acknowledge --screen enroll-page --reason "CSS-only, no visual change"
  python scripts/dev/check_tutorial_drift.py rebaseline --screen all --video-version v04 --reason "re-recorded after redesign"

Exit codes for `check`: 0 = no drift (or drift that existed before this change),
1 = this change introduces drift (with --changed-since) / any drift (with --strict).
Failing is a warning signal, not a merge block: do not mark the CI job required
unless you want it to block.
"""
from __future__ import annotations

import argparse
import ast
import datetime as dt
import fnmatch
import hashlib
import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = REPO / "docs" / "tutorials" / "enrollment" / "video-manifest.json"
MARKER = "<!-- tutorial-drift-guard -->"
BINARY_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".mp4"}


# --------------------------------------------------------------------------- hashing

def _norm(data: bytes, suffix: str) -> bytes:
    if suffix.lower() in BINARY_EXT:
        return data
    try:
        return data.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")
    except UnicodeDecodeError:
        return data


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _hash_file(path: Path) -> str:
    return _sha(_norm(path.read_bytes(), path.suffix))


def _hash_py_function(path: Path, name: str) -> str | None:
    src = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    tree = ast.parse(src)
    lines = src.split("\n")
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            start = min([node.lineno] + [d.lineno for d in node.decorator_list])
            return _sha("\n".join(lines[start - 1 : node.end_lineno]).encode("utf-8"))
    return None


def expand(entry: str) -> dict[str, str]:
    """Return {key: hash} for one watch entry. Keys that cannot be resolved map to 'MISSING'."""
    if "::" in entry:
        rel, func = entry.split("::", 1)
        p = REPO / rel
        if not p.is_file():
            return {entry: "MISSING"}
        return {entry: _hash_py_function(p, func) or "MISSING"}
    if any(ch in entry for ch in "*?["):
        out: dict[str, str] = {}
        for p in sorted(REPO.glob(entry)):
            if p.is_file():
                out[p.relative_to(REPO).as_posix()] = _hash_file(p)
        return out or {entry: "MISSING"}
    p = REPO / entry
    return {entry: _hash_file(p) if p.is_file() else "MISSING"}


def snapshot(screen: dict) -> dict[str, str]:
    snap: dict[str, str] = {}
    for entry in screen["watch"]:
        snap.update(expand(entry))
    return snap


# --------------------------------------------------------------------------- manifest

def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def git_changed(ref: str) -> set[str] | None:
    try:
        out = subprocess.run(
            ["git", "diff", "--name-only", f"{ref}...HEAD"], cwd=REPO, capture_output=True, text=True, check=True
        ).stdout
    except Exception:
        return None
    return {ln.strip() for ln in out.splitlines() if ln.strip()}


def git_head() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return "unknown"


# --------------------------------------------------------------------------- compare

def compare(manifest: dict, changed: set[str] | None) -> list[dict]:
    results = []
    for screen in manifest["screens"]:
        base = screen.get("baseline", {})
        now = snapshot(screen)
        items = []
        for key in sorted(set(base) | set(now)):
            b, n = base.get(key), now.get(key)
            if b == n:
                continue
            if b is None:
                kind = "added"
            elif n is None or n == "MISSING":
                kind = "removed"
            else:
                kind = "modified"
            path = key.split("::", 1)[0]
            items.append({"key": key, "kind": kind, "in_this_change": (changed is None) or (path in changed)})
        if items:
            results.append({"screen": screen, "items": items})
    return results


def render_text(results: list[dict], manifest: dict, changed_known: bool) -> str:
    if not results:
        return f"[tutorial-drift-guard] OK: videos '{manifest['video_set']}' ({manifest['video_version']}) match the watched screens."
    bar = "!" * 78
    out = [bar, "!!  TUTORIAL VIDEOS MAY NOW BE WRONG  " + "!" * 40, bar]
    out.append(f"Video set: {manifest['video_set']}  version recorded: {manifest['video_version']}")
    for r in results:
        s = r["screen"]
        out.append("")
        out.append(f"* Screen '{s['id']}' ({s['title']})")
        out.append(f"    video steps affected: {', '.join(s['beats'])}")
        out.append(f"    videos: {', '.join(s['videos'])}")
        for it in r["items"]:
            tag = " [changed in this change]" if changed_known and it["in_this_change"] else ""
            out.append(f"    - {it['kind']:9s} {it['key']}{tag}")
    out += [
        "",
        "What to do (this is a warning, it does not block merging):",
        "  - Video must change -> re-record, then: check_tutorial_drift.py rebaseline --screen <id> --video-version vNN --reason \"...\"",
        "  - Video is still right -> check_tutorial_drift.py acknowledge --screen <id> --reason \"...\"",
        "Then commit the updated manifest.",
        bar,
    ]
    return "\n".join(out)


def render_markdown(results: list[dict], manifest: dict, changed_known: bool) -> str:
    if not results:
        return f"{MARKER}\n### ✅ Tutorial videos match the watched screens\nVideo set `{manifest['video_set']}` ({manifest['video_version']})."
    out = [MARKER, "## ⚠️ TUTORIAL VIDEOS MAY NOW BE WRONG",
           f"Video set **{manifest['video_set']}**, recorded version **{manifest['video_version']}**. "
           "This change touches files the video was recorded against. This is a warning, not a merge block.", ""]
    for r in results:
        s = r["screen"]
        out.append(f"### Screen `{s['id']}` — {s['title']}")
        out.append(f"- **Video steps affected:** {', '.join(s['beats'])}")
        out.append(f"- **Videos:** {', '.join(s['videos'])}")
        for it in r["items"]:
            tag = " ← **changed in this PR**" if changed_known and it["in_this_change"] else ""
            out.append(f"- `{it['kind']}` `{it['key']}`{tag}")
        out.append("")
    out += ["**To resolve** (commit the updated `video-manifest.json`):",
            "- The video must change → re-record, then `python scripts/dev/check_tutorial_drift.py rebaseline --screen <id> --video-version vNN --reason \"...\"`",
            "- The video is still correct → `python scripts/dev/check_tutorial_drift.py acknowledge --screen <id> --reason \"...\"`"]
    return "\n".join(out)


# --------------------------------------------------------------------------- commands

def cmd_check(a) -> int:
    manifest = load(a.manifest)
    changed = git_changed(a.changed_since) if a.changed_since else None
    results = compare(manifest, changed)
    text = (render_markdown if a.format == "markdown" else render_text)(results, manifest, changed is not None)
    print(text)
    if a.output:
        Path(a.output).write_text(text + "\n", encoding="utf-8")
    if a.format == "github" and results:
        for r in results:
            for it in r["items"]:
                print(f"::warning title=Tutorial video may be out of date::{it['kind']} {it['key']} (screen {r['screen']['id']}; steps {', '.join(r['screen']['beats'])})")
    if not results:
        return 0
    if changed is not None:
        return 1 if any(it["in_this_change"] for r in results for it in r["items"]) else 0
    return 1 if a.strict else 0


def _select(manifest: dict, wanted: list[str]) -> list[dict]:
    if "all" in wanted:
        return manifest["screens"]
    ids = {s["id"] for s in manifest["screens"]}
    unknown = [w for w in wanted if w not in ids]
    if unknown:
        raise SystemExit(f"unknown screen(s): {unknown}; known: {sorted(ids)} or 'all'")
    return [s for s in manifest["screens"] if s["id"] in wanted]


def _update(a, kind: str) -> int:
    if not a.reason or len(a.reason.strip()) < 8:
        raise SystemExit("--reason is required (at least a short sentence): it is written to the manifest history.")
    manifest = load(a.manifest)
    screens = _select(manifest, a.screen)
    touched = []
    for s in screens:
        before, now = s.get("baseline", {}), snapshot(s)
        touched += [f"{s['id']}: {k}" for k in sorted(set(before) | set(now)) if before.get(k) != now.get(k)]
        s["baseline"] = now
    if kind == "rerecorded":
        manifest["video_version"] = a.video_version or manifest["video_version"]
        manifest["recorded_at"] = dt.date.today().isoformat()
        manifest["recorded_against_commit"] = git_head()
    manifest.setdefault("history", []).append({
        "date": dt.date.today().isoformat(),
        "kind": kind,
        "screens": [s["id"] for s in screens],
        "reason": a.reason.strip(),
        "by": a.by,
        "commit": git_head(),
        "video_version": manifest["video_version"],
        "changes_covered": touched,
    })
    save(a.manifest, manifest)
    print(f"[{kind}] {len(touched)} change(s) recorded for screens {[s['id'] for s in screens]}. Commit {a.manifest.relative_to(REPO)}.")
    return 0


def cmd_list(a) -> int:
    m = load(a.manifest)
    for s in m["screens"]:
        print(f"{s['id']}: {s['title']}  steps={s['beats']}")
        for k in sorted(s.get("baseline", {})):
            print(f"    {k}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check")
    c.add_argument("--changed-since", metavar="REF")
    c.add_argument("--format", choices=["text", "markdown", "github"], default="text")
    c.add_argument("--output")
    c.add_argument("--strict", action="store_true")
    c.set_defaults(fn=cmd_check)
    for name, kind in (("acknowledge", "acknowledged-no-visible-change"), ("rebaseline", "rerecorded")):
        p = sub.add_parser(name)
        p.add_argument("--screen", nargs="+", required=True)
        p.add_argument("--reason", required=True)
        p.add_argument("--by", default="owner")
        if name == "rebaseline":
            p.add_argument("--video-version")
        p.set_defaults(fn=lambda a, k=kind: _update(a, k))
    sub.add_parser("list").set_defaults(fn=cmd_list)
    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
