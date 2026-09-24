#!/usr/bin/env python3
"""Fail closed unless cxadmin has exactly one passwordless sudo command."""

import re
import sys

EXPECTED = "/usr/local/sbin/cwscx-mystery-public-deploy"


def check_listing(text: str) -> None:
    # sudo -l groups command specifications under a run-as prefix. A broad
    # NOPASSWD command may wrap to a following line; forbid any continuation.
    rules = re.findall(r"(?m)^\s*\([^\n)]*\)\s+NOPASSWD:\s*([^\n]+)", text)
    if len(rules) != 1 or rules[0].strip() != EXPECTED:
        raise ValueError("expected only the fixed passwordless deploy entrypoint")
    if text.count("NOPASSWD:") != 1:
        raise ValueError("additional passwordless sudo grant present")
    if not re.search(r"(?m)^\s*User\s+cxadmin\s+may run the following commands", text):
        raise ValueError("sudo listing did not identify cxadmin")


if __name__ == "__main__":
    try:
        check_listing(sys.stdin.read())
    except ValueError as exc:
        sys.exit(f"VM sudo preflight failed: {exc}; no release transferred")
    print("VM sudo preflight passed: only fixed passwordless deploy entrypoint")