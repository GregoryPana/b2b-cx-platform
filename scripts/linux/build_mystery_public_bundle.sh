#!/usr/bin/env bash
set -euo pipefail

OUTPUT_ZIP="${1:-/tmp/cwscx-mystery-public-release.zip}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGE_ROOT="$(mktemp -d /tmp/cwscx-mystery-public-stage.XXXXXX)"
RELEASE_ROOT="${STAGE_ROOT}/release"
PYTHON_BIN="${PYTHON_BIN:-python3}"
FRONTEND_AUTH_MODE="mystery_public"

cleanup() { rm -rf "${STAGE_ROOT}"; }
trap cleanup EXIT

command -v git >/dev/null
command -v npm >/dev/null
"${PYTHON_BIN}" -m pip --version >/dev/null
"${PYTHON_BIN}" -c 'import sys; sys.exit(0 if sys.version_info[:2] == (3, 12) else "Mystery public offline wheelhouse must target VM Python 3.12")'

GIT_SHA="$(git -C "${REPO_ROOT}" rev-parse HEAD)"
[[ "${GIT_SHA}" =~ ^[0-9a-f]{40}$ ]] || { echo "Unable to determine full Git SHA" >&2; exit 1; }
BUILD_TIMESTAMP_UTC="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
DEFAULT_RELEASE_ID="mystery-public-${GIT_SHA}"
RELEASE_ID="${RELEASE_ID:-${DEFAULT_RELEASE_ID}}"
[[ "${RELEASE_ID}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$ ]] || { echo "Invalid RELEASE_ID" >&2; exit 1; }

TREE_STATE="clean"
if ! git -C "${REPO_ROOT}" diff --quiet || ! git -C "${REPO_ROOT}" diff --cached --quiet; then
  TREE_STATE="dirty"
fi
if [[ "${REQUIRE_CLEAN_TREE:-0}" == "1" && "${TREE_STATE}" != "clean" ]]; then
  echo "Refusing release build from a dirty tracked worktree" >&2
  exit 1
fi

mapfile -t EXPECTED_HEADS < <("${PYTHON_BIN}" - "${REPO_ROOT}/backend/alembic/versions" <<'PY'
import ast
import pathlib
import sys

revisions = set()
parents = set()
for path in pathlib.Path(sys.argv[1]).glob("*.py"):
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    values = {}
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in {"revision", "down_revision"}:
                    values[target.id] = ast.literal_eval(node.value)
    revision = values.get("revision")
    if revision:
        revisions.add(str(revision))
    down = values.get("down_revision")
    if isinstance(down, (tuple, list)):
        parents.update(str(v) for v in down if v)
    elif down:
        parents.add(str(down))
for head in sorted(revisions - parents):
    print(head)
PY
)
(( ${#EXPECTED_HEADS[@]} > 0 )) || { echo "No Alembic heads discovered" >&2; exit 1; }

pushd "${REPO_ROOT}/frontend/mystery-shopper" >/dev/null
npm ci --no-audit --no-fund
VITE_API_URL="/api" \
VITE_BASE_PATH="/" \
VITE_AUTH_MODE="${FRONTEND_AUTH_MODE}" \
VITE_APP_VERSION="${GIT_SHA}" \
npm run build
[[ -f dist/index.html ]] || { echo "Missing mystery shopper build output" >&2; exit 1; }
popd >/dev/null

mkdir -p \
  "${RELEASE_ROOT}/backend" \
  "${RELEASE_ROOT}/frontends/public/mystery-shopper" \
  "${RELEASE_ROOT}/scripts/linux" \
  "${RELEASE_ROOT}/wheelhouse"
cp -a "${REPO_ROOT}/frontend/mystery-shopper/dist" "${RELEASE_ROOT}/frontends/public/mystery-shopper/dist"
cp -a "${REPO_ROOT}/backend/app" "${RELEASE_ROOT}/backend/app"
cp -a "${REPO_ROOT}/backend/alembic" "${RELEASE_ROOT}/backend/alembic"
cp -a "${REPO_ROOT}/backend/scripts" "${RELEASE_ROOT}/backend/scripts"
cp "${REPO_ROOT}/backend/requirements.txt" "${RELEASE_ROOT}/backend/requirements.txt"
cp "${REPO_ROOT}/backend/alembic.ini" "${RELEASE_ROOT}/backend/alembic.ini"
cp "${REPO_ROOT}/.env.example" "${RELEASE_ROOT}/.env.example"
cp "${REPO_ROOT}/scripts/linux/install_mystery_public_bundle.sh" "${RELEASE_ROOT}/scripts/linux/"
cp "${REPO_ROOT}/scripts/linux/deploy_mystery_public_backend.sh" "${RELEASE_ROOT}/scripts/linux/"
cp "${REPO_ROOT}/scripts/linux/deploy_mystery_public_nginx.sh" "${RELEASE_ROOT}/scripts/linux/"
cp "${REPO_ROOT}/scripts/linux/verify_mystery_public.sh" "${RELEASE_ROOT}/scripts/linux/"
cp "${REPO_ROOT}/scripts/linux/audit_mystery_public_vm.sh" "${RELEASE_ROOT}/scripts/linux/"
chmod +x "${RELEASE_ROOT}/scripts/linux/"*.sh
find "${RELEASE_ROOT}" -type d -name __pycache__ -prune -exec rm -rf {} +
find "${RELEASE_ROOT}" -type f \( -name '*.pyc' -o -name '*.pyo' \) -delete

# Resolve and download every Python dependency while the build runner has network.
# The target installer uses this wheelhouse with --no-index.
"${PYTHON_BIN}" -m pip download \
  --disable-pip-version-check \
  --only-binary=:all: \
  --dest "${RELEASE_ROOT}/wheelhouse" \
  -r "${REPO_ROOT}/backend/requirements.txt"

# Catch missing/incompatible wheels on the build runner, before any VM
# transfer or activation. The smoke venv is outside release/ and never bundled.
"${PYTHON_BIN}" -m venv "${STAGE_ROOT}/wheelhouse-smoke"
"${STAGE_ROOT}/wheelhouse-smoke/bin/python" -m pip install \
  --disable-pip-version-check --no-index \
  --find-links "${RELEASE_ROOT}/wheelhouse" \
  -r "${RELEASE_ROOT}/backend/requirements.txt"
"${STAGE_ROOT}/wheelhouse-smoke/bin/python" -m pip check
"${STAGE_ROOT}/wheelhouse-smoke/bin/python" -c 'import fastapi, uvicorn, sqlalchemy, alembic, psycopg, psycopg2'

HEADS_JSON="$(printf '%s\n' "${EXPECTED_HEADS[@]}" | "${PYTHON_BIN}" -c 'import json,sys; print(json.dumps([line.strip() for line in sys.stdin if line.strip()]))')"
export RELEASE_ID GIT_SHA BUILD_TIMESTAMP_UTC FRONTEND_AUTH_MODE TREE_STATE HEADS_JSON
"${PYTHON_BIN}" - "${RELEASE_ROOT}/release-manifest.json" <<'PY'
import json
import os
import pathlib
import sys
manifest = {
    "schema_version": 1,
    "release_id": os.environ["RELEASE_ID"],
    "git_sha": os.environ["GIT_SHA"],
    "build_timestamp_utc": os.environ["BUILD_TIMESTAMP_UTC"],
    "frontend_auth_mode": os.environ["FRONTEND_AUTH_MODE"],
    "source_tree_state": os.environ["TREE_STATE"],
    "expected_migration_heads": json.loads(os.environ["HEADS_JSON"]),
    "python_wheelhouse": True,
}
path = pathlib.Path(sys.argv[1])
path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY

"${PYTHON_BIN}" - "${RELEASE_ROOT}" <<'PY'
import hashlib
import pathlib
import sys
root = pathlib.Path(sys.argv[1])
lines = []
for path in sorted(p for p in root.rglob("*") if p.is_file() and p.name != "SHA256SUMS"):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    lines.append(f"{digest}  {path.relative_to(root).as_posix()}")
(root / "SHA256SUMS").write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

mkdir -p "$(dirname "${OUTPUT_ZIP}")"
rm -f "${OUTPUT_ZIP}"
"${PYTHON_BIN}" - "${STAGE_ROOT}" "${OUTPUT_ZIP}" <<'PY'
import pathlib
import sys
import zipfile
stage = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2])
with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted((stage / "release").rglob("*")):
        if path.is_file():
            archive.write(path, path.relative_to(stage).as_posix())
PY
BUNDLE_SHA256="$(sha256sum "${OUTPUT_ZIP}" | cut -d' ' -f1)"
echo "Release bundle: ${OUTPUT_ZIP}"
echo "Release ID: ${RELEASE_ID}"
echo "Git SHA: ${GIT_SHA}"
echo "Bundle SHA256: ${BUNDLE_SHA256}"
