#!/usr/bin/env python3
"""Dependency-free checks for the deploy sudo preflight parser."""

import importlib.util
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "check_mystery_deploy_sudo.py"
spec = importlib.util.spec_from_file_location("sudo_preflight", path)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

prefix = "Matching Defaults entries for cxadmin on cwscx-web01:\n    env_reset\n\nUser cxadmin may run the following commands on cwscx-web01:\n"
fixed = "    (root) NOPASSWD: /usr/local/sbin/cwscx-mystery-public-deploy\n"
module.check_listing(prefix + "    (ALL : ALL) ALL\n" + fixed)
for bad in (
    prefix + fixed + "    (root) NOPASSWD: /usr/bin/bash\n",
    prefix + "    (root) NOPASSWD: /usr/bin/bash, /usr/local/sbin/cwscx-mystery-public-deploy\n",
    prefix + "    (root) NOPASSWD: /usr/local/sbin/cwscx-mystery-public-deploy, /usr/bin/systemctl\n",
    prefix + "    (root) NOPASSWD: ALL\n",
    fixed,
    prefix + "    (root) /usr/local/sbin/cwscx-mystery-public-deploy\n",
):
    try:
        module.check_listing(bad)
    except ValueError:
        continue
    raise AssertionError("unsafe sudo listing accepted")
print("Mystery deployment sudo preflight fixtures passed")