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
# Place the reviewed deployment SSH public key at the fixed root-owned path
# /root/cwscx-mystery-public-deploy-signing-key.pub before running. The
# workflow signs each bundle with the matching private key already held in
# the GitHub environment; the root entrypoint refuses unsigned/untrusted
# bundles, so a local cxadmin session cannot substitute arbitrary root code.
#
# Usage: sudo bash scripts/linux/bootstrap_mystery_public_deploy_entrypoint.sh
set -euo pipefail
umask 0022

die() { echo "bootstrap: $*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || die "must run as root"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENTRYPOINT_SRC="${REPO_ROOT}/linux/cwscx_mystery_public_deploy_entrypoint.sh"
INSTALLER_SRC="${REPO_ROOT}/linux/install_mystery_public_bundle.sh"

readonly ENTRYPOINT_DST="/usr/local/sbin/cwscx-mystery-public-deploy"
readonly INSTALLER_DIR="/usr/local/libexec/cwscx-mystery-public"
readonly INSTALLER_DST="${INSTALLER_DIR}/install_mystery_public_bundle.sh"
readonly SUDOERS_FILE="/etc/sudoers.d/cwscx-mystery-public"
readonly DEPLOY_USER="cxadmin"
readonly EVIDENCE_ROOT="/var/lib/cwscx-mystery-public/deploy-evidence"
readonly INCOMING_ROOT="/var/lib/cwscx-mystery-public/incoming"
readonly SIGNING_PUBLIC_KEY_SRC="/root/cwscx-mystery-public-deploy-signing-key.pub"
readonly SIGNER_DIR="/etc/cwscx-mystery-public"
readonly ALLOWED_SIGNERS="${SIGNER_DIR}/deploy-allowed-signers"

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
}

check_source() {
  local path="$1" label="$2"
  check_root_owned_file "${path}" "${label}"
  bash -n "${path}" || die "${label} source fails bash -n syntax check"
}

check_source "${ENTRYPOINT_SRC}" "entrypoint"
check_source "${INSTALLER_SRC}" "installer"
check_root_owned_file "${SIGNING_PUBLIC_KEY_SRC}" "deployment signing public key"
ssh-keygen -l -f "${SIGNING_PUBLIC_KEY_SRC}" >/dev/null 2>&1 || die "deployment signing public key is not a valid SSH public key"

id -u "${DEPLOY_USER}" >/dev/null 2>&1 || die "deploy user ${DEPLOY_USER} does not exist on this VM"

install -d -o root -g root -m 0755 "$(dirname "${ENTRYPOINT_DST}")"
install -o root -g root -m 0700 "${ENTRYPOINT_SRC}" "${ENTRYPOINT_DST}"

install -d -o root -g root -m 0755 "${INSTALLER_DIR}"
install -o root -g root -m 0700 "${INSTALLER_SRC}" "${INSTALLER_DST}"

# Fixed, root-owned evidence directory. 0755 so cxadmin can read (via SCP)
# the world-readable evidence files the entrypoint writes inside it, while
# only root can create or replace entries — this is what removes the
# check-then-use race a shared /tmp would otherwise have.
install -d -o root -g root -m 0755 "${EVIDENCE_ROOT}"
install -d -o root -g root -m 0700 "${INCOMING_ROOT}"
install -d -o root -g root -m 0755 "${SIGNER_DIR}"
ALLOWED_SIGNERS_TMP="$(mktemp /tmp/cwscx-mystery-public-signers.XXXXXX)"
trap 'rm -f "${TMP_SUDOERS:-}" "${ALLOWED_SIGNERS_TMP:-}"' EXIT
printf 'github-actions %s\n' "$(cat "${SIGNING_PUBLIC_KEY_SRC}")" >"${ALLOWED_SIGNERS_TMP}"
install -o root -g root -m 0644 "${ALLOWED_SIGNERS_TMP}" "${ALLOWED_SIGNERS}"

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
echo "Installed sudoers fragment:      ${SUDOERS_FILE}"
echo "Installed evidence directory:    ${EVIDENCE_ROOT}"
echo "Installed incoming directory:    ${INCOMING_ROOT}"
echo "Installed deploy allowed signers: ${ALLOWED_SIGNERS}"
echo "Verify with: sudo -l -U ${DEPLOY_USER}"
