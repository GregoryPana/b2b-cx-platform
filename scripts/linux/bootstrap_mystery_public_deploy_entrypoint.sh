#!/usr/bin/env bash
# VM-admin-only, failure-safe bootstrap for the Mystery Public privileged suite.
# Run only from the exact reviewed, root-owned checkout described below.
set -euo pipefail
umask 0022
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH

die() { echo "bootstrap: $*" >&2; exit 1; }
[[ "${EUID}" -eq 0 ]] || die "must run as root"

# The checkout and every ancestor must be root-owned and non-writable by group or
# world. A SUDO_USER-owned checkout is not trusted. Recommended procedure:
#   sudo git clone --branch <reviewed-ref> <repo-url> /root/cwscx-mystery-public-src
#   sudo git -C /root/cwscx-mystery-public-src log -1 --format='%H'
#   sudo bash /root/cwscx-mystery-public-src/scripts/linux/bootstrap_mystery_public_deploy_entrypoint.sh
unset CDPATH
BOOTSTRAP_SRC="$(realpath -e -- "${BASH_SOURCE[0]}")" || die "cannot resolve bootstrap source"
REPO_ROOT="$(cd "$(dirname "${BOOTSTRAP_SRC}")/.." && pwd)"
cd / || die "cannot enter the trusted working directory"
for _name in $(compgen -e); do
  case "${_name}" in PYTHON*|PIP_*) unset "${_name}" ;; esac
done
unset _name

ENTRYPOINT_SRC="${REPO_ROOT}/linux/cwscx_mystery_public_deploy_entrypoint.sh"
INSTALLER_SRC="${REPO_ROOT}/linux/install_mystery_public_bundle.sh"
RELEASE_GUARD_SRC="${REPO_ROOT}/linux/mystery_public_release_guard.py"
TRANSACTION_HELPER_SRC="${REPO_ROOT}/linux/mystery_public_bootstrap_transaction.py"
readonly ENTRYPOINT_DST="/usr/local/sbin/cwscx-mystery-public-deploy"
readonly INSTALLER_DIR="/usr/local/libexec/cwscx-mystery-public"
readonly INSTALLER_DST="${INSTALLER_DIR}/install_mystery_public_bundle.sh"
readonly RELEASE_GUARD_DST="${INSTALLER_DIR}/mystery_public_release_guard.py"
readonly TRANSACTION_HELPER_DST="${INSTALLER_DIR}/mystery_public_bootstrap_transaction.py"
readonly PRIVILEGED_SUITE_VERSION_DST="${INSTALLER_DIR}/privileged-suite-version"
readonly SUDOERS_FILE="/etc/sudoers.d/cwscx-mystery-public"
readonly DEPLOY_USER="cxadmin"
readonly SERVICE_GROUP="www-data"
readonly TARGET_ROOT="/opt/cwscx-mystery-public"
readonly ENV_FILE="${TARGET_ROOT}/.env"
readonly RELEASES_ROOT="${TARGET_ROOT}/releases"
readonly SHARED_ROOT="${TARGET_ROOT}/shared"
readonly STATE_ROOT="/var/lib/cwscx-mystery-public"
readonly EVIDENCE_ROOT="${STATE_ROOT}/deploy-evidence"
readonly INCOMING_ROOT="${STATE_ROOT}/incoming"
readonly ARCHIVE_ROOT="${STATE_ROOT}/application-archives"
readonly NONCE_ROOT="${STATE_ROOT}/operation-nonces"
readonly DEPLOY_LOCK="${STATE_ROOT}/deploy.lock"
readonly BOOTSTRAP_JOURNAL="${STATE_ROOT}/bootstrap-journal.json"
readonly BOOTSTRAP_RECOVERY_ROOT="${STATE_ROOT}/bootstrap-recovery"
readonly SIGNING_PUBLIC_KEY_SRC="/root/cwscx-mystery-public-release-signing-key.pub"
readonly PREVIOUS_SIGNING_PUBLIC_KEY_SRC="/root/cwscx-mystery-public-previous-release-signing-key.pub"
readonly SIGNER_DIR="/etc/cwscx-mystery-public"
readonly ALLOWED_SIGNERS="${SIGNER_DIR}/release-allowed-signers"

check_root_owned_file() {
  local path="$1" label="$2" owner mode
  [[ -e "${path}" ]] || die "${label} source not found at ${path}"
  [[ ! -L "${path}" && -f "${path}" ]] || die "${label} source must be a regular non-symlink file"
  owner="$(stat -c '%U' "${path}")"
  [[ "${owner}" == "root" ]] || die "${label} source must be owned by root (found: ${owner})"
  mode="$(stat -c '%a' "${path}")"
  (( 8#${mode} & 8#022 )) && die "${label} source must not be group- or world-writable"
  return 0
}

check_source_ancestors() {
  python3 -I - "$@" <<'PY'
import os, pathlib, stat, sys
for raw in sys.argv[1:]:
    path = pathlib.Path(raw).absolute()
    if pathlib.Path(os.path.realpath(path)) != path:
        raise SystemExit(f"bootstrap: source path is indirect: {path}")
    ancestor = path.parent
    while True:
        info = ancestor.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise SystemExit(f"bootstrap: source ancestor is not root-controlled: {ancestor}")
        if ancestor == ancestor.parent:
            break
        ancestor = ancestor.parent
PY
}

check_root_controlled_dir() {
  local path="$1" mode
  [[ -d "${path}" && ! -L "${path}" ]] || die "bootstrap destination directory is not real: ${path}"
  [[ "$(realpath -e -- "${path}")" == "${path}" ]] || die "bootstrap destination directory is indirect: ${path}"
  [[ "$(stat -c '%U' "${path}")" == root ]] || die "bootstrap destination directory is not root-owned: ${path}"
  mode="$(stat -c '%a' "${path}")"
  (( 8#${mode} & 8#022 )) && die "bootstrap destination directory is group/world writable: ${path}"
  return 0
}

for source in "${BOOTSTRAP_SRC}" "${ENTRYPOINT_SRC}" "${INSTALLER_SRC}" "${RELEASE_GUARD_SRC}" "${TRANSACTION_HELPER_SRC}"; do
  check_root_owned_file "${source}" "privileged source"
done
check_source_ancestors "${BOOTSTRAP_SRC}" "${ENTRYPOINT_SRC}" "${INSTALLER_SRC}" "${RELEASE_GUARD_SRC}" "${TRANSACTION_HELPER_SRC}"
bash -n "${ENTRYPOINT_SRC}" || die "entrypoint source fails bash -n"
bash -n "${INSTALLER_SRC}" || die "installer source fails bash -n"
python3 -I - "${RELEASE_GUARD_SRC}" "${TRANSACTION_HELPER_SRC}" <<'PY' \
  || die "privileged Python source fails syntax validation"
import pathlib, sys
for raw in sys.argv[1:]:
    source = pathlib.Path(raw)
    compile(source.read_bytes(), str(source), "exec")
PY

# The checkout is only proposed source. Copy the transaction helper through a
# no-follow descriptor into a root-only execution snapshot before it is ever
# run; all recovery/publication calls below use this snapshot, never checkout
# bytes that could be changed after validation.
HELPER_EXEC_ROOT="$(mktemp -d /root/cwscx-mystery-public-helper.XXXXXX)"
TRANSACTION_HELPER_EXEC="${HELPER_EXEC_ROOT}/mystery_public_bootstrap_transaction.py"
SUITE_SNAPSHOT=""
RECOVERY_ITEMS_JSON=""
TRANSACTION_ARMED=0
cleanup() {
  local status=$?
  set +e
  if [[ "${TRANSACTION_ARMED}" -eq 1 && ( -e "${BOOTSTRAP_JOURNAL}" || -L "${BOOTSTRAP_JOURNAL}" ) ]]; then
    if ! python3 -I "${TRANSACTION_HELPER_EXEC}" recover "${BOOTSTRAP_JOURNAL}" "${RECOVERY_ITEMS_JSON}" "${BOOTSTRAP_RECOVERY_ROOT}"; then
      echo "bootstrap: automatic restoration failed; deploy remains blocked by bootstrap journal" >&2
      status=1
    fi
  fi
  [[ -z "${SUITE_SNAPSHOT}" ]] || rm -rf -- "${SUITE_SNAPSHOT}"
  rm -rf -- "${HELPER_EXEC_ROOT}"
  exit "${status}"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
python3 -I - "${TRANSACTION_HELPER_SRC}" "${TRANSACTION_HELPER_EXEC}" <<'PY'
import os, stat, sys
source, target = sys.argv[1:]
fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
try:
    info = os.fstat(fd)
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
        raise SystemExit("bootstrap: transaction helper changed before snapshot")
    data = b""
    while True:
        block = os.read(fd, 1024 * 1024)
        if not block: break
        data += block
finally:
    os.close(fd)
out = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o700)
with os.fdopen(out, "wb") as handle:
    handle.write(data); handle.flush(); os.fsync(handle.fileno())
PY

# The state root and lock are the only prerequisites created before proposal
# validation. Bootstrap and deploy/rollback share this exact root-controlled lock.
install -d -o root -g root -m 0700 "${STATE_ROOT}"
[[ ! -L "${DEPLOY_LOCK}" ]] || die "deployment lock must not be a symlink"
exec 9>"${DEPLOY_LOCK}"
flock -x 9 || die "could not acquire the deployment lock"
[[ "$(stat -c '%U:%G %a' "${STATE_ROOT}")" == "root:root 700" ]] || die "state root must be root:root 0700"
[[ -f "${DEPLOY_LOCK}" && ! -L "${DEPLOY_LOCK}" && "$(stat -c '%U' "${DEPLOY_LOCK}")" == root ]] \
  || die "deployment lock is not root controlled"

# Fixed destination set used both for crash recovery and the new cutover. The
# staged values are ignored by recovery; destination order and identity-last are
# security invariants checked by the helper.
RECOVERY_ITEMS_JSON="$(python3 -I - \
  "${ENTRYPOINT_DST}" "${INSTALLER_DST}" "${RELEASE_GUARD_DST}" "${TRANSACTION_HELPER_DST}" \
  "${ALLOWED_SIGNERS}" "${SUDOERS_FILE}" "${PRIVILEGED_SUITE_VERSION_DST}" <<'PY'
import json, sys
labels=("entrypoint","installer","release guard","transaction helper","allowed signers","sudoers","suite identity")
modes=(0o700,0o700,0o700,0o700,0o644,0o440,0o600)
print(json.dumps([{"label":label,"destination":path,"staged":"/dev/null","mode":mode,"identity":i==6}
                  for i,(label,path,mode) in enumerate(zip(labels,sys.argv[1:],modes))], separators=(",",":")))
PY
)" || die "could not describe the fixed bootstrap transaction"

if [[ -e "${BOOTSTRAP_JOURNAL}" || -L "${BOOTSTRAP_JOURNAL}" ]]; then
  # Any malformed journal/snapshot fails closed without changing another byte.
  python3 -I "${TRANSACTION_HELPER_EXEC}" recover "${BOOTSTRAP_JOURNAL}" "${RECOVERY_ITEMS_JSON}" "${BOOTSTRAP_RECOVERY_ROOT}" \
    || die "interrupted bootstrap recovery failed; preserve state for VM-admin review"
  echo "Recovered an interrupted privileged-suite bootstrap before validating the new proposal" >&2
fi
[[ ! -e "${BOOTSTRAP_RECOVERY_ROOT}" && ! -L "${BOOTSTRAP_RECOVERY_ROOT}" ]] \
  || die "orphaned bootstrap recovery state requires VM-admin review"

# Snapshot all proposed code through O_NOFOLLOW into one root-only staging tree.
SUITE_SNAPSHOT="$(mktemp -d /root/cwscx-mystery-public-suite.XXXXXX)"

PRIVILEGED_SUITE_VERSION="$(python3 -I - "${SUITE_SNAPSHOT}" "${ENTRYPOINT_SRC}" "${INSTALLER_SRC}" "${RELEASE_GUARD_SRC}" "${TRANSACTION_HELPER_SRC}" <<'PY'
import hashlib, os, pathlib, stat, sys
destination=pathlib.Path(sys.argv[1]); digest=hashlib.sha256()
for raw in sys.argv[2:]:
    source=pathlib.Path(raw).absolute(); fd=os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info=os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise SystemExit(f"bootstrap: source is not a root-controlled regular file: {source}")
        data=b""
        while True:
            block=os.read(fd, 1024*1024)
            if not block: break
            data += block
    finally: os.close(fd)
    name=source.name.encode(); digest.update(name+b"\0"+len(data).to_bytes(8,"big")+data)
    target=destination/source.name
    out=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(out,"wb") as handle: handle.write(data); handle.flush(); os.fsync(handle.fileno())
print(digest.hexdigest())
PY
)" || die "could not create a root-controlled privileged-suite snapshot"
[[ "${PRIVILEGED_SUITE_VERSION}" =~ ^[0-9a-f]{64}$ ]] || die "privileged suite identity is invalid"
ENTRYPOINT_SNAPSHOT="${SUITE_SNAPSHOT}/$(basename "${ENTRYPOINT_SRC}")"
INSTALLER_SNAPSHOT="${SUITE_SNAPSHOT}/$(basename "${INSTALLER_SRC}")"
RELEASE_GUARD_SNAPSHOT="${SUITE_SNAPSHOT}/$(basename "${RELEASE_GUARD_SRC}")"
TRANSACTION_HELPER_SNAPSHOT="${SUITE_SNAPSHOT}/$(basename "${TRANSACTION_HELPER_SRC}")"
for source in "${ENTRYPOINT_SNAPSHOT}" "${INSTALLER_SNAPSHOT}" "${RELEASE_GUARD_SNAPSHOT}" "${TRANSACTION_HELPER_SNAPSHOT}"; do
  check_root_owned_file "${source}" "suite snapshot"
done
bash -n "${ENTRYPOINT_SNAPSHOT}"; bash -n "${INSTALLER_SNAPSHOT}"
python3 -I - "${RELEASE_GUARD_SNAPSHOT}" "${TRANSACTION_HELPER_SNAPSHOT}" <<'PY'
import pathlib, sys
for raw in sys.argv[1:]:
    source = pathlib.Path(raw)
    compile(source.read_bytes(), str(source), "exec")
PY

# Construct and validate proposed trust entirely in staging. Each source is one
# canonical OpenSSH public-key record: algorithm + blob + optional printable
# comment. Options, principals, blank/additional lines and embedded newlines are
# rejected before ssh-keygen performs its independent parser validation.
canonical_public_key_record() {
  local path="$1" label="$2"
  check_root_owned_file "${path}" "${label}"
  ssh-keygen -l -f "${path}" >/dev/null 2>&1 || die "${label} is invalid"
  python3 -I - "${path}" <<'PY'
import base64, pathlib, re, struct, sys
path = pathlib.Path(sys.argv[1])
try:
    text = path.read_bytes().decode("ascii")
except UnicodeDecodeError:
    raise SystemExit("bootstrap: signing public key must be ASCII") from None
if not text.endswith("\n") or text.count("\n") != 1 or "\r" in text:
    raise SystemExit("bootstrap: signing public key must contain exactly one canonical record")
line = text[:-1]
if not line or line != line.strip() or "\t" in line or "  " in line:
    raise SystemExit("bootstrap: signing public key spacing is not canonical")
parts = line.split(" ")
if len(parts) < 2 or not re.fullmatch(r"(?:ssh-(?:ed25519|rsa)|ecdsa-sha2-nistp(?:256|384|521)|sk-(?:ssh-ed25519|ecdsa-sha2-nistp256)@openssh\.com)", parts[0]):
    raise SystemExit("bootstrap: signing public key algorithm is not approved")
try:
    blob = base64.b64decode(parts[1], validate=True)
    size = struct.unpack(">I", blob[:4])[0]
    embedded = blob[4:4 + size].decode("ascii")
except (ValueError, UnicodeDecodeError, struct.error):
    raise SystemExit("bootstrap: signing public key blob is invalid") from None
if 4 + size > len(blob) or embedded != parts[0]:
    raise SystemExit("bootstrap: signing public key algorithm/blob mismatch")
comment = " ".join(parts[2:])
if comment and (comment != comment.strip() or any(ord(ch) < 0x20 or ord(ch) > 0x7e for ch in comment)):
    raise SystemExit("bootstrap: signing public key comment is unsafe")
print(line)
PY
}

CURRENT_SIGNING_KEY="$(canonical_public_key_record "${SIGNING_PUBLIC_KEY_SRC}" "deployment signing public key")" \
  || die "deployment signing public key must be one canonical record"
PROPOSED_SIGNERS="${SUITE_SNAPSHOT}/release-allowed-signers"
printf 'github-actions %s\n' "${CURRENT_SIGNING_KEY}" >"${PROPOSED_SIGNERS}"
if [[ -e "${PREVIOUS_SIGNING_PUBLIC_KEY_SRC}" || -L "${PREVIOUS_SIGNING_PUBLIC_KEY_SRC}" ]]; then
  PREVIOUS_SIGNING_KEY="$(canonical_public_key_record "${PREVIOUS_SIGNING_PUBLIC_KEY_SRC}" "previous deployment signing public key")" \
    || die "previous deployment signing public key must be one canonical record"
  [[ -f "${ALLOWED_SIGNERS}" && ! -L "${ALLOWED_SIGNERS}" ]] || die "key overlap requires an existing allowed-signers file"
  check_root_owned_file "${ALLOWED_SIGNERS}" "existing allowed signers"
  grep -Fxq "github-actions ${PREVIOUS_SIGNING_KEY}" "${ALLOWED_SIGNERS}" \
    || die "previous signing key is not currently trusted; refusing unapproved overlap"
  [[ "${CURRENT_SIGNING_KEY}" != "${PREVIOUS_SIGNING_KEY}" ]] \
    || die "new and previous signing keys must differ"
  printf 'github-actions %s\n' "${PREVIOUS_SIGNING_KEY}" >>"${PROPOSED_SIGNERS}"
fi
chmod 0644 "${PROPOSED_SIGNERS}"

# Generate and validate sudoers before any live suite/trust/version file changes.
PROPOSED_SUDOERS="${SUITE_SNAPSHOT}/sudoers"
cat >"${PROPOSED_SUDOERS}" <<EOF
Defaults!${ENTRYPOINT_DST} env_reset
${DEPLOY_USER} ALL=(root) NOPASSWD: ${ENTRYPOINT_DST}
EOF
chmod 0440 "${PROPOSED_SUDOERS}"
visudo -cf "${PROPOSED_SUDOERS}" || die "generated sudoers fragment failed visudo -cf; refusing to activate"
printf '%s\n' "${PRIVILEGED_SUITE_VERSION}" >"${SUITE_SNAPSHOT}/privileged-suite-version"
chmod 0600 "${SUITE_SNAPSHOT}/privileged-suite-version"

id -u "${DEPLOY_USER}" >/dev/null 2>&1 || die "deploy user ${DEPLOY_USER} does not exist"
getent group "${SERVICE_GROUP}" >/dev/null 2>&1 || die "service group ${SERVICE_GROUP} does not exist"
[[ -d "${TARGET_ROOT}" && ! -L "${TARGET_ROOT}" ]] || die "target root must be an existing real directory: ${TARGET_ROOT}"
[[ -f "${ENV_FILE}" && ! -L "${ENV_FILE}" ]] || die "environment file must be an existing regular file: ${ENV_FILE}"

# Validate every retained archive against the proposed guard and complete signer
# overlap. No old signer is retired while any retained rollback depends on it.
if [[ -e "${ARCHIVE_ROOT}" ]]; then
  [[ -d "${ARCHIVE_ROOT}" && ! -L "${ARCHIVE_ROOT}" && "$(stat -c '%U %a' "${ARCHIVE_ROOT}")" == "root 700" ]] \
    || die "existing application archive root is unsafe"
  for archive in "${ARCHIVE_ROOT}"/*; do
    [[ -e "${archive}" ]] || continue
    [[ -d "${archive}" && ! -L "${archive}" ]] || continue
    release_id="$(basename "${archive}")"
    [[ "${release_id}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$ ]] || die "unexpected archive directory requires VM-admin review"
    python3 -I "${RELEASE_GUARD_SNAPSHOT}" verify-archive "${ARCHIVE_ROOT}" "${release_id}" "${PROPOSED_SIGNERS}" >/dev/null \
      || die "proposed signer set would invalidate an archived release: ${release_id}"
  done
fi

# Create fixed parents only after the complete proposal has passed syntax, signer,
# retained-archive and sudoers validation. No executable proposal has been
# published yet.
install -d -o root -g root -m 0755 "$(dirname "${ENTRYPOINT_DST}")" "${INSTALLER_DIR}" "${SIGNER_DIR}"
install -d -o root -g root -m 0755 "$(dirname "${SUDOERS_FILE}")"
for directory in "$(dirname "${ENTRYPOINT_DST}")" "${INSTALLER_DIR}" "${SIGNER_DIR}" "$(dirname "${SUDOERS_FILE}")"; do
  check_root_controlled_dir "${directory}"
done
install -d -o root -g root -m 0755 "${EVIDENCE_ROOT}"
install -d -o root -g root -m 0700 "${INCOMING_ROOT}" "${ARCHIVE_ROOT}" "${NONCE_ROOT}"
chown root:root "${TARGET_ROOT}" "${ENV_FILE}"
chmod 0755 "${TARGET_ROOT}"
chmod 0600 "${ENV_FILE}"
install -d -o root -g root -m 0755 "${RELEASES_ROOT}"
install -d -o "${DEPLOY_USER}" -g "${SERVICE_GROUP}" -m 0770 "${SHARED_ROOT}"

CUTOVER_ITEMS_JSON="$(python3 -I - \
  "${ENTRYPOINT_DST}" "${ENTRYPOINT_SNAPSHOT}" \
  "${INSTALLER_DST}" "${INSTALLER_SNAPSHOT}" \
  "${RELEASE_GUARD_DST}" "${RELEASE_GUARD_SNAPSHOT}" \
  "${TRANSACTION_HELPER_DST}" "${TRANSACTION_HELPER_SNAPSHOT}" \
  "${ALLOWED_SIGNERS}" "${PROPOSED_SIGNERS}" \
  "${SUDOERS_FILE}" "${PROPOSED_SUDOERS}" \
  "${PRIVILEGED_SUITE_VERSION_DST}" "${SUITE_SNAPSHOT}/privileged-suite-version" <<'PY'
import json,sys
raw=sys.argv[1:]; labels=("entrypoint","installer","release guard","transaction helper","allowed signers","sudoers","suite identity"); modes=(0o700,0o700,0o700,0o700,0o644,0o440,0o600)
print(json.dumps([{"label":labels[i],"destination":raw[i*2],"staged":raw[i*2+1],"mode":modes[i],"identity":i==6} for i in range(7)],separators=(",",":")))
PY
)" || die "could not describe proposed bootstrap cutover"
RECOVERY_ITEMS_JSON="${CUTOVER_ITEMS_JSON}"
SNAPSHOT_ROOT="${BOOTSTRAP_RECOVERY_ROOT}"
python3 -I "${TRANSACTION_HELPER_EXEC}" snapshot "${BOOTSTRAP_JOURNAL}" "${CUTOVER_ITEMS_JSON}" \
  "${PRIVILEGED_SUITE_VERSION}" "${SNAPSHOT_ROOT}" || die "could not arm bootstrap recovery"
TRANSACTION_ARMED=1

# Every item is atomically published while deploy.lock is held. The helper marks
# the durable journal cutover before the first write and publishes suite identity
# last, so entrypoint can never accept a mixed suite as coherent.
python3 -I "${TRANSACTION_HELPER_EXEC}" publish "${BOOTSTRAP_JOURNAL}" "${CUTOVER_ITEMS_JSON}" \
  "${PRIVILEGED_SUITE_VERSION}" || die "privileged-suite publication failed"
visudo -cf "${SUDOERS_FILE}" || die "installed sudoers validation failed after publication"
python3 -I "${RELEASE_GUARD_DST}" suite-version "${ENTRYPOINT_DST}" "${INSTALLER_DST}" "${RELEASE_GUARD_DST}" "${TRANSACTION_HELPER_DST}" \
  | grep -Fxq "${PRIVILEGED_SUITE_VERSION}" || die "published privileged suite identity check failed"
python3 -I "${TRANSACTION_HELPER_EXEC}" complete "${BOOTSTRAP_JOURNAL}" "${CUTOVER_ITEMS_JSON}" \
  "${PRIVILEGED_SUITE_VERSION}" || die "could not finalize bootstrap transaction"
TRANSACTION_ARMED=0


echo "Installed root-owned entrypoint: ${ENTRYPOINT_DST}"
echo "Installed root-owned installer:  ${INSTALLER_DST}"
echo "Installed privileged suite ID:    ${PRIVILEGED_SUITE_VERSION}"
echo "Installed sudoers fragment:      ${SUDOERS_FILE}"
echo "Installed release allowed signers: ${ALLOWED_SIGNERS}"
echo "Prepared immutable releases:      ${RELEASES_ROOT} (root:root 0755)"
echo "Prepared writable shared data:    ${SHARED_ROOT} (${DEPLOY_USER}:${SERVICE_GROUP} 0770)"
echo "Verify with: sudo -l -U ${DEPLOY_USER}"
