#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/linux/install_release_bundle.sh /tmp/cwscx-release.zip"
  exit 1
fi

BUNDLE_PATH="$1"
TARGET_ROOT="/opt/cwscx"
TMP_DIR="$(mktemp -d /tmp/cwscx-release.XXXXXX)"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

if [[ ! -f "${BUNDLE_PATH}" ]]; then
  echo "Bundle not found: ${BUNDLE_PATH}"
  exit 1
fi

unzip -q "${BUNDLE_PATH}" -d "${TMP_DIR}"

if [[ -d "${TMP_DIR}/release" ]]; then
  BUNDLE_ROOT="${TMP_DIR}/release"
else
  BUNDLE_ROOT="${TMP_DIR}"
fi

if [[ ! -d "${BUNDLE_ROOT}/frontends" ]]; then
  echo "Invalid bundle layout. Expected frontends/ at bundle root."
  exit 1
fi

require_frontend_dist() {
  local src_dir="$1"
  local name="$2"
  if [[ ! -f "${src_dir}/index.html" ]]; then
    echo "Missing build artifact for ${name}: ${src_dir}/index.html"
    exit 1
  fi
}

optional_frontend_dist() {
  local src_dir="$1"
  local name="$2"
  if [[ ! -f "${src_dir}/index.html" ]]; then
    echo "Optional frontend dist not present (skipping): ${name} (${src_dir}/index.html)"
    return 1
  fi
  return 0
}

archive_legacy_path() {
  local path="$1"
  local archive_root="$2"
  local path_basename
  path_basename="$(basename "${path}")"
  local archive_target="${archive_root}/${path_basename}"

  if [[ ! -e "${path}" ]]; then
    return 0
  fi

  if [[ -e "${archive_target}" ]]; then
    archive_target="${archive_target}-$(date +%s)"
  fi

  echo "Archiving legacy frontend path: ${path} -> ${archive_target}"
  mv "${path}" "${archive_target}"
}

cleanup_legacy_frontends() {
  local frontends_root="$1"
  local archive_base="$2"
  local ts
  ts="$(date +%Y%m%d-%H%M%S)"
  local archive_root="${archive_base}/${ts}"
  local archived_any="false"

  if ! mkdir -p "${archive_root}" 2>/dev/null; then
    echo "Warning: cannot create legacy archive directory (${archive_root}); skipping legacy frontend cleanup."
    return 0
  fi

  for item in "${frontends_root}"/*; do
    [[ -e "${item}" ]] || continue
    case "$(basename "${item}")" in
      dashboard|internal-surveys|public)
        ;;
      *)
        archive_legacy_path "${item}" "${archive_root}"
        archived_any="true"
        ;;
    esac
  done

  if [[ -d "${frontends_root}/internal-surveys" ]]; then
    for item in "${frontends_root}/internal-surveys"/*; do
      [[ -e "${item}" ]] || continue
      case "$(basename "${item}")" in
        b2b|installation)
          ;;
        *)
          archive_legacy_path "${item}" "${archive_root}"
          archived_any="true"
          ;;
      esac
    done
  fi

  if [[ -d "${frontends_root}/public" ]]; then
    for item in "${frontends_root}/public"/*; do
      [[ -e "${item}" ]] || continue
      case "$(basename "${item}")" in
        mystery-shopper)
          ;;
        *)
          archive_legacy_path "${item}" "${archive_root}"
          archived_any="true"
          ;;
      esac
    done
  fi

  if [[ "${archived_any}" == "true" ]]; then
    echo "Legacy frontend paths archived under ${archive_root}"
  else
    rmdir "${archive_root}" 2>/dev/null || true
    echo "No legacy frontend paths detected."
  fi
}

mkdir -p "${TARGET_ROOT}/backend"
mkdir -p "${TARGET_ROOT}/frontends-src"
if ! mkdir -p "${TARGET_ROOT}/frontends-archive" 2>/dev/null; then
  echo "Warning: cannot create ${TARGET_ROOT}/frontends-archive; legacy frontend cleanup will be skipped."
fi
mkdir -p "${TARGET_ROOT}/frontends-src/public/mystery-shopper"
mkdir -p "${TARGET_ROOT}/frontends-src/dashboard"
mkdir -p "${TARGET_ROOT}/frontends-src/internal-surveys/b2b"
mkdir -p "${TARGET_ROOT}/frontends-src/internal-surveys/installation"
mkdir -p "${TARGET_ROOT}/shared"

if [[ -d "${TARGET_ROOT}/frontends-archive" ]]; then
  cleanup_legacy_frontends "${TARGET_ROOT}/frontends-src" "${TARGET_ROOT}/frontends-archive"
fi

if [[ ! -d "${BUNDLE_ROOT}/backend" ]]; then
  echo "Backend directory missing in bundle. This is required."
  exit 1
fi

if [[ ! -f "${BUNDLE_ROOT}/backend/requirements.txt" ]]; then
  echo "Backend requirements.txt missing in bundle. Cannot install dependencies."
  exit 1
fi

rsync -a \
  --exclude 'venv' \
  --exclude 'logs' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  "${BUNDLE_ROOT}/backend/" \
  "${TARGET_ROOT}/backend/"

# Clean up stale alembic migration files (deleted migrations must not linger)
if [[ -d "${BUNDLE_ROOT}/backend/alembic/versions" ]]; then
  rsync -a --delete "${BUNDLE_ROOT}/backend/alembic/versions/" "${TARGET_ROOT}/backend/alembic/versions/"
fi

if optional_frontend_dist "${BUNDLE_ROOT}/frontends/public/mystery-shopper/dist" "public/mystery-shopper"; then
  rsync -a --delete "${BUNDLE_ROOT}/frontends/public/mystery-shopper/dist/" "${TARGET_ROOT}/frontends-src/public/mystery-shopper/dist/"
fi

require_frontend_dist "${BUNDLE_ROOT}/frontends/dashboard/dist" "dashboard"
rm -rf "${TARGET_ROOT}/frontends-src/dashboard/dist"
rsync -a "${BUNDLE_ROOT}/frontends/dashboard/dist/" "${TARGET_ROOT}/frontends-src/dashboard/dist/"

require_frontend_dist "${BUNDLE_ROOT}/frontends/internal-surveys/b2b/dist" "internal-surveys/b2b"
rm -rf "${TARGET_ROOT}/frontends-src/internal-surveys/b2b/dist"
rsync -a "${BUNDLE_ROOT}/frontends/internal-surveys/b2b/dist/" "${TARGET_ROOT}/frontends-src/internal-surveys/b2b/dist/"

require_frontend_dist "${BUNDLE_ROOT}/frontends/internal-surveys/installation/dist" "internal-surveys/installation"
rm -rf "${TARGET_ROOT}/frontends-src/internal-surveys/installation/dist"
rsync -a "${BUNDLE_ROOT}/frontends/internal-surveys/installation/dist/" "${TARGET_ROOT}/frontends-src/internal-surveys/installation/dist/"

mkdir -p "${TARGET_ROOT}/scripts/linux"
rsync -a --delete "${BUNDLE_ROOT}/scripts/linux/" "${TARGET_ROOT}/scripts/linux/"
chmod +x "${TARGET_ROOT}/scripts/linux/"*.sh

if [[ ! -f "${TARGET_ROOT}/.env" && -f "${BUNDLE_ROOT}/.env.example" ]]; then
  cp "${BUNDLE_ROOT}/.env.example" "${TARGET_ROOT}/.env"
  echo "Created ${TARGET_ROOT}/.env from bundle .env.example. Update secrets before start."
fi

echo "Release bundle installed under ${TARGET_ROOT}."

echo "Installed components summary:"
echo " - backend: $([ -d "${TARGET_ROOT}/backend" ] && echo 'yes' || echo 'no')"
echo " - mystery-shopper: $([ -f "${TARGET_ROOT}/frontends-src/public/mystery-shopper/dist/index.html" ] && echo 'yes' || echo 'no')"
echo " - dashboard: $([ -f "${TARGET_ROOT}/frontends-src/dashboard/dist/index.html" ] && echo 'yes' || echo 'no')"
echo " - b2b survey: $([ -f "${TARGET_ROOT}/frontends-src/internal-surveys/b2b/dist/index.html" ] && echo 'yes' || echo 'no')"
echo " - installation survey: $([ -f "${TARGET_ROOT}/frontends-src/internal-surveys/installation/dist/index.html" ] && echo 'yes' || echo 'no')"
echo " - scripts/linux: $([ -f "${TARGET_ROOT}/scripts/linux/deploy_backend.sh" ] && echo 'yes' || echo 'no')"
