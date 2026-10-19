#!/usr/bin/env python3
"""Module-boundary frontend gates; install each app's locked dependencies with npm ci first.

Tests discover *.test.mjs recursively under each src (never node_modules); Mystery's
Vitest *.test.js suite runs once, separately. Tests refuse zero/skip/todo results.
Builds pin production auth, cover both Mystery release variants, and write outside
source. Browser QA is an unauthenticated component fixture, not an end-to-end survey.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
APPS = ("dashboard-blueprint", "dashboard", "survey", "installation-survey", "mystery-shopper")
BUILDS = (
    ("dashboard-blueprint", "/dashboard/", "entra"),
    ("dashboard", "/dashboard/", "entra"),
    ("survey", "/surveys/b2b/", "entra"),
    ("installation-survey", "/surveys/installation/", "entra"),
    ("mystery-shopper", "/surveys/mystery-shopper/", "entra"),
    ("mystery-shopper", "/", "mystery_public"),
)


def run(command, app, **kwargs):
    print(f"+ [{app}] {' '.join(map(str, command))}", flush=True)
    return subprocess.run(command, cwd=ROOT / "frontend" / app, check=True, **kwargs)


def tests():
    for app in APPS:
        paths = sorted((ROOT / "frontend" / app / "src").rglob("*.test.mjs"))
        if app != "mystery-shopper" and not paths:
            raise RuntimeError(f"no Node tests discovered for {app}")
        if not paths:
            continue
        result = run(["node", "--test", "--test-reporter=tap", *map(str, paths)], app,
                     stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        print(result.stdout, end="", flush=True)
        counts = {key: int(value) for key, value in re.findall(
            r"^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$", result.stdout, re.MULTILINE)}
        if (set(counts) != {"tests", "pass", "fail", "cancelled", "skipped", "todo"}
                or counts["tests"] == 0 or counts["tests"] != counts["pass"]
                or any(counts[key] for key in ("fail", "cancelled", "skipped", "todo"))):
            raise RuntimeError(f"invalid/incomplete Node test gate for {app}: {counts}")
        print(f"{app}: {len(paths)} files; {json.dumps(counts, sort_keys=True)}", flush=True)
    with tempfile.TemporaryDirectory(prefix="cwscx-vitest-") as scratch:
        report = Path(scratch) / "vitest.json"
        # Limit Vitest to its native suites: Node suites are already exercised above.
        native = sorted((ROOT / "frontend/mystery-shopper/src").rglob("*.test.js"))
        if not native:
            raise RuntimeError("no Mystery Vitest tests discovered")
        run(["npm", "test", "--", *map(str, native), "--reporter=json",
             f"--outputFile={report}"], "mystery-shopper")
        data = json.loads(report.read_text())
        total = data["numTotalTests"]
        suites = data["testResults"]
        assertions = [item for suite in suites for item in suite["assertionResults"]]
        # Vitest 1.x can count skipped assertions as passed in summary counters.
        # Inspect every assertion rather than trusting those aggregate fields.
        if (not data["success"] or total == 0 or len(assertions) != total
                or len(suites) != len(native) or any(not s["assertionResults"] for s in suites)
                or any(item["status"] != "passed" for item in assertions)):
            raise RuntimeError(f"incomplete Mystery Vitest gate: {data}")
        print(f"mystery-shopper Vitest: {total} passed; zero pending/todo", flush=True)


def builds(outdir):
    if not outdir:
        raise RuntimeError("builds require --build-outdir outside the repository")
    out = Path(outdir).resolve()
    if out == ROOT or ROOT in out.parents:
        raise RuntimeError("refusing build output inside the repository")
    for app, base, auth in BUILDS:
        target = out / f"{app}-{auth}"
        env = dict(os.environ, VITE_API_URL="/api", VITE_BASE_PATH=base,
                   VITE_AUTH_MODE=auth, VITE_DEV_AUTH_BYPASS="false", VITE_DEV_HTTPS="false")
        run(["npm", "run", "build", "--", "--outDir", str(target), "--emptyOutDir"], app, env=env)
        if not (target / "index.html").is_file():
            raise RuntimeError(f"missing build output: {target}/index.html")


def browser(outdir):
    if not outdir:
        raise RuntimeError('browser requires --build-outdir containing pinned frontend builds')
    assets = Path(outdir).resolve() / 'dashboard-blueprint-entra/assets'
    if not list(assets.glob('*.css')):
        raise RuntimeError('build dashboard-blueprint first; no CSS assets found')
    # Bind an ephemeral loopback port through Vite itself and obtain its URL from
    # a ready file. No reserved application ports, credentials or auth bypass.
    app = "dashboard-blueprint"
    with tempfile.TemporaryDirectory(prefix="cwscx-browser-") as scratch:
        ready = Path(scratch) / "ready"
        script = """import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
const server = await createServer({server:{host:'127.0.0.1',port:0,strictPort:false,https:false},base:'/'});
await server.listen();
writeFileSync(process.argv[1], `http://127.0.0.1:${server.httpServer.address().port}`);
"""
        env = dict(os.environ, VITE_DEV_AUTH_BYPASS="false", VITE_BASE_PATH="/", VITE_DEV_HTTPS="false")
        with (Path(scratch) / "vite.log").open("w+") as log:
            process = subprocess.Popen(["node", "--input-type=module", "-e", script, str(ready)],
                                       cwd=ROOT / "frontend" / app, env=env, stdout=log, stderr=log)
            try:
                for _ in range(300):
                    if process.poll() is not None:
                        raise RuntimeError("fixture Vite server exited before ready")
                    if ready.exists():
                        break
                    time.sleep(0.1)
                else:
                    raise RuntimeError("fixture Vite server did not become ready")
                base = ready.read_text()
                with urllib.request.urlopen(base + "/src/components/installation/installationQa.fixture.html", timeout=10) as response:
                    if response.status != 200:
                        raise RuntimeError("fixture is not reachable")
                env.update(INSTALLATION_QA_BASE_URL=base, INSTALLATION_QA_OUTPUT=scratch)
                run([sys.executable, "src/components/installation/installationPresentation.browser.py"], app, env=env)
                run([sys.executable, "src/features/mystery-shopper/blueprintQuality.browser.py",
                     "--output", str(Path(scratch) / "mystery"), "--css-dir", str(assets)], app, env=env)
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                log.seek(0)
                print(log.read(), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", choices=("tests", "builds", "browser"), default="tests")
    parser.add_argument("--build-outdir")
    args = parser.parse_args()
    try:
        if args.scope == "tests":
            tests()
        elif args.scope == "builds":
            builds(args.build_outdir)
        else:
            browser(args.build_outdir)
    except subprocess.CalledProcessError as exc:
        if exc.stdout:
            print(exc.stdout, flush=True)
        return exc.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
