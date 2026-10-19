#!/usr/bin/env bash
# Runner-only helper, sourced after SSH_OPTS and EVIDENCE_DIR are initialized.
# Root validates/sanitizes before stdout; never publish a partial SSH response.
fetch_mystery_evidence() {
  local kind="$1" selector="$2" destination="$3" temporary remote
  local -a command=(sudo -n /usr/local/sbin/cwscx-mystery-public-deploy --action evidence --kind "${kind}")
  if [[ "${kind}" == "audit" ]]; then command+=(--nonce "${selector}"); else command+=(--release-id "${selector}"); fi
  printf -v remote '%q ' "${command[@]}"
  temporary="$(mktemp "${destination}.incoming.XXXXXX")" || return 1
  if ssh "${SSH_OPTS[@]}" "${DMZ_USER}@${DMZ_HOST}" "${remote}" >"${temporary}" \
    && python3 -I - "${temporary}" "${kind}" <<'PY'
import json, pathlib, sys
raw = pathlib.Path(sys.argv[1]).read_bytes()
if not 0 < len(raw) <= 131072:
    raise SystemExit("evidence transport returned empty or oversized output")
text = raw.decode("utf-8")
rows = text.splitlines() if sys.argv[2] == "audit" else [text]
if not rows or any(not isinstance(json.loads(row), dict) for row in rows):
    raise SystemExit("evidence transport returned malformed output")
PY
  then
    mv -f -- "${temporary}" "${destination}"
  else
    rm -f -- "${temporary}" "${destination}"
    echo "evidence_export_unavailable: ${kind}; operation outcome is unchanged" >&2
    return 1
  fi
}
