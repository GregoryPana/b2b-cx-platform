#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
failures=0

require() { grep -Fq -- "$2" "$1" && printf '[PASS] %s\n' "$3" || { printf '[FAIL] %s\n' "$3" >&2; failures=$((failures+1)); }; }
forbid() { ! grep -Fq -- "$2" "$1" && printf '[PASS] %s\n' "$3" || { printf '[FAIL] %s\n' "$3" >&2; failures=$((failures+1)); }; }

BUILD="$ROOT/scripts/linux/build_mystery_public_bundle.sh"
INSTALL="$ROOT/scripts/linux/install_mystery_public_bundle.sh"
BACKEND="$ROOT/scripts/linux/deploy_mystery_public_backend.sh"
NGINX="$ROOT/scripts/linux/deploy_mystery_public_nginx.sh"
VERIFY="$ROOT/scripts/linux/verify_mystery_public.sh"
WORKFLOW="$ROOT/.github/workflows/deploy-mystery-public.yml"

require "$BUILD" 'release-manifest.json' 'bundle includes release manifest'
require "$BUILD" 'expected_migration_heads' 'manifest records expected migration heads'
require "$BUILD" 'pip download' 'bundle builds offline wheelhouse'
require "$BUILD" 'SHA256SUMS' 'bundle records file hashes'
require "$INSTALL" 'releases/${RELEASE_ID}' 'installer uses immutable release directory'
require "$INSTALL" 'mv -Tf' 'installer switches current symlink atomically'
require "$INSTALL" '--no-index' 'installer installs Python dependencies offline'
require "$INSTALL" 'EXPECTED_BUNDLE_SHA256' 'installer verifies outer bundle checksum'
require "$BACKEND" '--host 127.0.0.1 --port 8011' 'DMZ backend binds loopback only'
forbid "$BACKEND" 'alembic" upgrade' 'DMZ backend never runs shared migrations'
require "$BACKEND" 'NoNewPrivileges=true' 'systemd prevents privilege escalation'
require "$BACKEND" 'ProtectSystem=strict' 'systemd protects filesystem'
require "$NGINX" 'limit_req_zone' 'NGINX defines request rate limits'
require "$NGINX" 'limit_conn_zone' 'NGINX defines connection limits'
require "$NGINX" 'Content-Security-Policy' 'NGINX sends CSP'
require "$NGINX" 'proxy_pass http://127.0.0.1:8011' 'NGINX proxies only to loopback backend'
require "$VERIFY" 'VERIFY_TLS_MODE' 'verifier distinguishes prepublic/trusted TLS'
require "$VERIFY" 'expected_migration_heads' 'verifier compares migration heads read-only'
require "$VERIFY" '127.0.0.1:8011' 'verifier checks loopback listener'
require "$VERIFY" 'EVIDENCE_FILE' 'verifier emits machine-readable evidence'
require "$WORKFLOW" "github.ref == 'refs/heads/main'" 'workflow is main-only'
require "$WORKFLOW" 'cancel-in-progress: false' 'workflow serializes production deploys'
require "$WORKFLOW" 'StrictHostKeyChecking=yes' 'workflow pins SSH host identity'
require "$WORKFLOW" 'actions/upload-artifact@v4' 'workflow uploads release/deploy evidence'
forbid "$WORKFLOW" 'apt-get install' 'workflow performs no per-deploy apt install'

for file in "$BUILD" "$INSTALL" "$BACKEND" "$NGINX" "$VERIFY"; do
  bash -n "$file" || { printf '[FAIL] shell syntax: %s\n' "$file" >&2; failures=$((failures+1)); }
done

# GitHub has already parsed this workflow before starting this job. Keep
# dependency-free assertions here so the deployment gate does not require PyYAML.
require "${WORKFLOW}" "permissions:" "workflow declares permissions"
require "${WORKFLOW}" "contents: read" "workflow limits repository contents to read"
require "${WORKFLOW}" "timeout-minutes: 30" "workflow bounds job runtime"

(( failures == 0 )) || { printf '%d contract checks failed\n' "$failures" >&2; exit 1; }
echo 'All Mystery public release script contracts passed.'
