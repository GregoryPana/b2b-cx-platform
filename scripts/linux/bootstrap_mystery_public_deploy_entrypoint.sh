#!/usr/bin/env bash
# One-time VM-admin bootstrap for the Mystery Public deploy entrypoint.
#
# NOT callable by the deploy workflow and not part of any automated
# pipeline. A VM administrator runs this once (and again only when the
# entrypoint/installer source in this repository changes) from a
# root-owned checkout on cwscx-web01 to install the fixed, root-owned
# deploy entrypoint and installer, and to grant cxadmin the single,
# narrow sudoers rule required to invoke it.
#
# Administrator procedure (required before running this script):
#   The entrypoint and installer source files must already be owned by
#   root before bootstrap runs — being owned by the interactive sudo user
#   (SUDO_USER) is not sufficient, because that account could be
#   compromised or its files replaced between review and install. Obtain
#   a root-owned checkout first, e.g.:
#
#     sudo git clone --branch <reviewed-ref> <repo-url> /root/cwscx-mystery-public-src
#     cd /root/cwscx-mystery-public-src
#     sudo git log -1 --format='%H'   # record and compare against the reviewed commit
#
#   or, for an existing non-root checkout that has already been reviewed
#   and is not concurrently writable by any other account:
#
#     sudo chown -R root:root /path/to/checkout
#     sudo chmod -R go-w /path/to/checkout
#
#   Then run this script from that root-owned checkout:
#     sudo bash /root/cwscx-mystery-public-src/scripts/linux/bootstrap_mystery_public_deploy_entrypoint.sh
#
# Place the reviewed release-signing public key at the fixed root-owned path
# /root/cwscx-mystery-public-release-signing-key.pub before running. This key
# must be distinct from the SSH transport key. The workflow uses its matching
# GitHub Environment secret to sign release bundles and short-lived operation
# documents; the root entrypoint refuses unsigned or replayed operations.
#
# Usage: sudo bash scripts/linux/bootstrap_mystery_public_deploy_entrypoint.sh
set -euo pipefail
umask 0022

die() { echo "bootstrap: $*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || die "must run as root"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENTRYPOINT_SRC="${REPO_ROOT}/linux/cwscx_mystery_public_deploy_entrypoint.sh"
INSTALLER_SRC="${REPO_ROOT}/linux/install_mystery_public_bundle.sh"
RELEASE_GUARD_SRC="${REPO_ROOT}/linux/mystery_public_release_guard.py"

readonly ENTRYPOINT_DST="/usr/local/sbin/cwscx-mystery-public-deploy"
readonly INSTALLER_DIR="/usr/local/libexec/cwscx-mystery-public"
readonly INSTALLER_DST="${INSTALLER_DIR}/install_mystery_public_bundle.sh"
readonly RELEASE_GUARD_DST="${INSTALLER_DIR}/mystery_public_release_guard.py"
readonly PRIVILEGED_SUITE_VERSION_DST="${INSTALLER_DIR}/privileged-suite-version"
readonly SUDOERS_FILE="/etc/sudoers.d/cwscx-mystery-public"
readonly DEPLOY_USER="cxadmin"
readonly SERVICE_GROUP="www-data"
readonly TARGET_ROOT="/opt/cwscx-mystery-public"
readonly ENV_FILE="${TARGET_ROOT}/.env"
readonly RELEASES_ROOT="${TARGET_ROOT}/releases"
readonly SHARED_ROOT="${TARGET_ROOT}/shared"
readonly EVIDENCE_ROOT="/var/lib/cwscx-mystery-public/deploy-evidence"
readonly INCOMING_ROOT="/var/lib/cwscx-mystery-public/incoming"
readonly ARCHIVE_ROOT="/var/lib/cwscx-mystery-public/application-archives"
readonly NONCE_ROOT="/var/lib/cwscx-mystery-public/operation-nonces"
readonly SIGNING_PUBLIC_KEY_SRC="/root/cwscx-mystery-public-release-signing-key.pub"
# Optional, explicitly staged former signer during a reviewed key overlap.
readonly PREVIOUS_SIGNING_PUBLIC_KEY_SRC="/root/cwscx-mystery-public-previous-release-signing-key.pub"
readonly SIGNER_DIR="/etc/cwscx-mystery-public"
readonly ALLOWED_SIGNERS="${SIGNER_DIR}/release-allowed-signers"

check_root_owned_file() {
  # Require root ownership only. A SUDO_USER-owned source (even the
  # administrator's own account) is not accepted: that account could have
  # been compromised, or its files swapped, between when it was reviewed
  # and when this script reads it. See the administrator procedure above
  # for how to obtain a root-owned checkout first.
  local path="$1" label="$2"
  [[ -e "${path}" ]] || die "${label} source not found at ${path}"
  [[ -L "${path}" ]] && die "${label} source must not be a symlink"
  [[ -f "${path}" ]] || die "${label} source is not a regular file"
  local owner mode
  owner="$(stat -c '%U' "${path}")"
  [[ "${owner}" == "root" ]] \
    || die "${label} source must be owned by root (found: ${owner}); see the administrator procedure at the top of this script"
  mode="$(stat -c '%a' "${path}")"
  (( 8#${mode} & 8#022 )) && die "${label} source must not be group- or world-writable"
  # The safe case makes the arithmetic test above false. Return success
  # explicitly so `set -e` callers do not treat a secure file as failure.
  return 0
}

check_source() {
  local path="$1" label="$2"
  check_root_owned_file "${path}" "${label}"
  bash -n "${path}" || die "${label} source fails bash -n syntax check"
}

# Validate every source ancestor before opening the suite, then copy all three
# files into one root-only snapshot. Syntax checks, identity calculation and
# installation use only that snapshot, preventing mixed-version or stale-path
# replacement between per-file checks and installs.
SUITE_SNAPSHOT="$(mktemp -d /root/cwscx-mystery-public-suite.XXXXXX)"
cleanup() { rm -rf "${SUITE_SNAPSHOT:-}"; rm -f "${TMP_SUDOERS:-}" "${ALLOWED_SIGNERS_TMP:-}"; }
trap cleanup EXIT
PRIVILEGED_SUITE_VERSION="$(python3 - "${SUITE_SNAPSHOT}" "${ENTRYPOINT_SRC}" "${INSTALLER_SRC}" "${RELEASE_GUARD_SRC}" <<'PY'
import hashlib, os, pathlib, stat, sys

destination = pathlib.Path(sys.argv[1])
sources = [pathlib.Path(value).absolute() for value in sys.argv[2:]]
digest = hashlib.sha256()
for source in sources:
    if pathlib.Path(os.path.realpath(source)) != source:
        raise SystemExit(f"bootstrap: source path is indirect: {source}")
    ancestor = source.parent
    while True:
        info = ancestor.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise SystemExit(f"bootstrap: source ancestor is not root-controlled: {ancestor}")
        if ancestor == ancestor.parent:
            break
        ancestor = ancestor.parent
    descriptor = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise SystemExit(f"bootstrap: source is not a root-controlled regular file: {source}")
        with os.fdopen(descriptor, "rb", closefd=False) as handle:
            data = handle.read()
    finally:
        os.close(descriptor)
    name = source.name.encode("utf-8")
    digest.update(name + b"\0" + len(data).to_bytes(8, "big") + data)
    target = destination / source.name
    target.write_bytes(data)
    target.chmod(0o600)
print(digest.hexdigest())
PY
)" || die "could not create a root-controlled privileged-suite snapshot"
[[ "${PRIVILEGED_SUITE_VERSION}" =~ ^[0-9a-f]{64}$ ]] || die "privileged suite identity is invalid"
ENTRYPOINT_SNAPSHOT="${SUITE_SNAPSHOT}/$(basename "${ENTRYPOINT_SRC}")"
INSTALLER_SNAPSHOT="${SUITE_SNAPSHOT}/$(basename "${INSTALLER_SRC}")"
RELEASE_GUARD_SNAPSHOT="${SUITE_SNAPSHOT}/$(basename "${RELEASE_GUARD_SRC}")"
check_source "${ENTRYPOINT_SNAPSHOT}" "entrypoint snapshot"
check_source "${INSTALLER_SNAPSHOT}" "installer snapshot"
check_root_owned_file "${RELEASE_GUARD_SNAPSHOT}" "release guard snapshot"
python3 -m py_compile "${RELEASE_GUARD_SNAPSHOT}" || die "release guard source fails Python syntax check"
check_root_owned_file "${SIGNING_PUBLIC_KEY_SRC}" "deployment signing public key"
ssh-keygen -l -f "${SIGNING_PUBLIC_KEY_SRC}" >/dev/null 2>&1 || die "deployment signing public key is not a valid SSH public key"
if [[ -e "${PREVIOUS_SIGNING_PUBLIC_KEY_SRC}" || -L "${PREVIOUS_SIGNING_PUBLIC_KEY_SRC}" ]]; then
  check_root_owned_file "${PREVIOUS_SIGNING_PUBLIC_KEY_SRC}" "previous deployment signing public key"
  ssh-keygen -l -f "${PREVIOUS_SIGNING_PUBLIC_KEY_SRC}" >/dev/null 2>&1 || die "previous signing public key is invalid"
  [[ -f "${ALLOWED_SIGNERS}" && ! -L "${ALLOWED_SIGNERS}" ]] || die "key overlap requires an existing allowed-signers file"
  check_root_owned_file "${ALLOWED_SIGNERS}" "existing allowed signers"
  grep -Fxq "github-actions $(cat "${PREVIOUS_SIGNING_PUBLIC_KEY_SRC}")" "${ALLOWED_SIGNERS}" \
    || die "previous signing key is not currently trusted; refusing unapproved overlap"
  ! cmp -s "${SIGNING_PUBLIC_KEY_SRC}" "${PREVIOUS_SIGNING_PUBLIC_KEY_SRC}" \
    || die "new and previous signing keys must differ"
fi

id -u "${DEPLOY_USER}" >/dev/null 2>&1 || die "deploy user ${DEPLOY_USER} does not exist on this VM"
getent group "${SERVICE_GROUP}" >/dev/null 2>&1 || die "service group ${SERVICE_GROUP} does not exist on this VM"

# Transition the legacy mutable layout to a root-controlled release boundary.
# The running legacy process may continue reading its existing files while the
# parent is hardened; the next signed deployment moves systemd to the new
# root-owned immutable `current` release.
[[ -d "${TARGET_ROOT}" && ! -L "${TARGET_ROOT}" ]] || die "target root must be an existing real directory: ${TARGET_ROOT}"
[[ -f "${ENV_FILE}" && ! -L "${ENV_FILE}" ]] || die "environment file must be an existing regular file: ${ENV_FILE}"
chown root:root "${TARGET_ROOT}"
chmod 0755 "${TARGET_ROOT}"
chown root:root "${ENV_FILE}"
chmod 0600 "${ENV_FILE}"
install -d -o root -g root -m 0755 "${RELEASES_ROOT}"
install -d -o "${DEPLOY_USER}" -g "${SERVICE_GROUP}" -m 0770 "${SHARED_ROOT}"

install -d -o root -g root -m 0755 "$(dirname "${ENTRYPOINT_DST}")"
install -o root -g root -m 0700 "${ENTRYPOINT_SNAPSHOT}" "${ENTRYPOINT_DST}"

install -d -o root -g root -m 0755 "${INSTALLER_DIR}"
install -o root -g root -m 0700 "${INSTALLER_SNAPSHOT}" "${INSTALLER_DST}"
install -o root -g root -m 0700 "${RELEASE_GUARD_SNAPSHOT}" "${RELEASE_GUARD_DST}"
printf '%s\n' "${PRIVILEGED_SUITE_VERSION}" | install -o root -g root -m 0600 /dev/stdin "${PRIVILEGED_SUITE_VERSION_DST}"

# Fixed, root-owned evidence directory. 0755 so cxadmin can read (via SCP)
# the world-readable evidence files the entrypoint writes inside it, while
# only root can create or replace entries — this is what removes the
# check-then-use race a shared /tmp would otherwise have.
install -d -o root -g root -m 0755 "${EVIDENCE_ROOT}"
install -d -o root -g root -m 0700 "${INCOMING_ROOT}"
install -d -o root -g root -m 0700 "${ARCHIVE_ROOT}"
install -d -o root -g root -m 0700 "${NONCE_ROOT}"
install -d -o root -g root -m 0755 "${SIGNER_DIR}"
[[ ! -e "${ALLOWED_SIGNERS}" || ( -f "${ALLOWED_SIGNERS}" && ! -L "${ALLOWED_SIGNERS}" ) ]] \
  || die "existing allowed-signers path is unsafe"
ALLOWED_SIGNERS_TMP="$(mktemp "${SIGNER_DIR}/.release-allowed-signers.XXXXXX")"
printf 'github-actions %s\n' "$(cat "${SIGNING_PUBLIC_KEY_SRC}")" >"${ALLOWED_SIGNERS_TMP}"
if [[ -f "${PREVIOUS_SIGNING_PUBLIC_KEY_SRC}" ]]; then
  printf 'github-actions %s\n' "$(cat "${PREVIOUS_SIGNING_PUBLIC_KEY_SRC}")" >>"${ALLOWED_SIGNERS_TMP}"
fi
chmod 0644 "${ALLOWED_SIGNERS_TMP}"
# Before publishing new trust, every retained verified archive must remain
# authentic under the proposed signer set. Removing an old signer with a live
# rollback dependency therefore fails closed rather than silently stranding it.
for archive in "${ARCHIVE_ROOT}"/*; do
  [[ -e "${archive}" ]] || continue
  [[ -d "${archive}" && ! -L "${archive}" ]] || continue
  release_id="$(basename "${archive}")"
  [[ "${release_id}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$ ]] || die "unexpected archive directory requires VM-admin review"
  python3 "${RELEASE_GUARD_SNAPSHOT}" verify-archive "${ARCHIVE_ROOT}" "${release_id}" "${ALLOWED_SIGNERS_TMP}" >/dev/null \
    || die "proposed signer set would invalidate an archived release: ${release_id}"
done
mv -Tf "${ALLOWED_SIGNERS_TMP}" "${ALLOWED_SIGNERS}"
ALLOWED_SIGNERS_TMP=""
python3 - "${SIGNER_DIR}" <<'PY'
import os, sys
fd=os.open(sys.argv[1], os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
try: os.fsync(fd)
finally: os.close(fd)
PY

# The sudoers rule names only the fixed entrypoint's absolute path — never
# bash, sh, or any other interpreter — so cxadmin can run exactly this one
# root-owned, non-writable program as root and nothing else.
TMP_SUDOERS="$(mktemp /tmp/cwscx-mystery-public-sudoers.XXXXXX)"
cat >"${TMP_SUDOERS}" <<EOF
Defaults!${ENTRYPOINT_DST} env_reset
${DEPLOY_USER} ALL=(root) NOPASSWD: ${ENTRYPOINT_DST}
EOF
chmod 0440 "${TMP_SUDOERS}"

visudo -cf "${TMP_SUDOERS}" || die "generated sudoers fragment failed visudo -cf; refusing to activate"

install -o root -g root -m 0440 "${TMP_SUDOERS}" "${SUDOERS_FILE}"
if ! visudo -cf "${SUDOERS_FILE}"; then
  rm -f "${SUDOERS_FILE}"
  die "installed sudoers file failed visudo -cf after activation; removed ${SUDOERS_FILE}"
fi

echo "Installed root-owned entrypoint: ${ENTRYPOINT_DST}"
echo "Installed root-owned installer:  ${INSTALLER_DST}"
echo "Installed privileged suite ID:    ${PRIVILEGED_SUITE_VERSION}"
echo "Installed sudoers fragment:      ${SUDOERS_FILE}"
echo "Installed evidence directory:    ${EVIDENCE_ROOT}"
echo "Installed incoming directory:    ${INCOMING_ROOT}"
echo "Installed signed app archives:   ${ARCHIVE_ROOT}"
echo "Installed release allowed signers: ${ALLOWED_SIGNERS}"
echo "Installed operation nonce state:   ${NONCE_ROOT}"
echo "Hardened target root:             ${TARGET_ROOT} (root:root 0755)"
echo "Hardened environment file:        ${ENV_FILE} (root:root 0600)"
echo "Prepared immutable releases:      ${RELEASES_ROOT} (root:root 0755)"
echo "Prepared writable shared data:    ${SHARED_ROOT} (${DEPLOY_USER}:${SERVICE_GROUP} 0770)"
echo "Verify with: sudo -l -U ${DEPLOY_USER}"
