# CWSCX Mystery Shopper APN-only release gate

## Current engineering state — 13 October 2026

This is an evidence checklist, not an acceptance record. Engineering completion is independent of APN configuration and tablet availability. The application VM remains internal; eventual approved APN clients reach HTTPS 443 only. No public route, signed workflow dispatch, database migration or credential rotation is authorized by this document.

Authoritative continuation worktree: `/home/gpanagary/cwscx-mystery-release-audit-20261013`, branch `fix/mystery-release-audit-20261013`, based on PR #26 head `29078cb2e675aab3b10b88a965dfdef634e87200`. Earlier dirty checkouts remain preserved. This audit branch includes the earlier PR #26 implementation and additional engineering fixes; do not independently merge competing revisions without reconciliation. Historical pending entries describe intermediate drafts, not current state.

### Implemented and locally exercised

- Release-contract CI triggers on every push/PR, including bundled backend and Mystery frontend changes.
- Runner evidence gates use explicit failures, not optimization-disableable assertions. Require complete unique verifier checks, fresh release identity, explicit journal state and truthful signed/unsigned recovery classification.
- Durable preactivation marker tracks interrupted installation and signed recovery. Retained root-controlled signed artifacts support completed-but-unarchived candidate verification. Legacy preactivation cleanup evidence explicitly states no switch/config restoration/authenticated fallback.
- Privileged Python uses isolated mode and trusted working directories; pip uses isolated configuration. Candidate deletion refuses failed current-release lookup.
- After installed source ownership and signed bundle/archive authentication, one reusable runtime gate now validates the locally built virtualenv as `cxadmin:www-data`: every direct requirement (including selected extras) must be installed at a compatible version, `uvicorn`, `fastapi`, `alembic`, and `sqlalchemy` must import, the Uvicorn launcher must be executable, and isolated `pip check` must pass. Normal deploy fallback, new candidate, rollback target/current, completed-candidate re-proof, committed-baseline recovery and signed fallback recovery all fail closed before their next switch when this gate fails.
- Real SIGKILL installer tests plus mocked entrypoint/service/guard control-flow regressions; valid NGINX links, tampering and preservation exercised.
- Latest local verification: 38 guard tests, 22 evidence tests (also with `PYTHONOPTIMIZE=1`), 14 interruption/control-flow tests, 13 isolation/deletion tests, four disposable real-venv runtime tests, sudo fixtures and shell contracts passed. Four migration graph/DB compatibility tests passed under Python 3.12. Pinned actionlint 1.7.12, shell syntax and whitespace checks passed. These are NOT actual VM deployment or business acceptance proofs.

### Engineering gates still open

1. Preserved complete unarchived candidate can occupy an immutable release ID; finish safe signed reuse or recoverable preservation/quarantine with explicit evidence. Never silently delete a completed/current/unmarked release.
2. Candidate application startup and readiness must be exercised before the live switch, using an approved isolated execution boundary, without public exposure or shared DB mutation. Dependency import/metadata validation is not an application-startup probe.
3. Serving process identity and fresh restart must be bound to the signed release, not just on-disk identity and HTTP status.
4. Bootstrap must validate proposed suite, signer trust, retained archives and sudoers before cutover, with failure-safe restoration and suite identity published last.
5. Bound stale incoming/marker temporary-file recovery; do not sweep live operation artifacts.
6. Review final exact-head CI/build and real representative systemd/NGINX/PostgreSQL activation, failed-release and interruption recovery rehearsal. Current tests mock critical runtime paths.
7. Provision approved branch/environment protection, distinct signer and VM suite. Last read-only GitHub check: `main` unprotected; `mystery-public` has no protection rules, admin bypass enabled and dedicated `MYSTERY_PUBLIC_RELEASE_SIGNING_KEY` absent. No settings were changed.
8. Complete approved credential-rotation/revocation/rollback controls. Preserve old signer trust while archives depend on it. Application encryption-key rotation requires compatible re-encryption/key-version support or explicitly approved re-enrollment; do not simply replace `MYSTERY_AUTH_SECRET_KEY`.
9. Separately approve first signed baseline and demonstrate subsequent deployment plus authenticated rollback. Approval to commit/push source is not approval to dispatch deployment.

## Evidence and independent dependencies

| Lane / owner | Required evidence | Current state |
| --- | --- | --- |
| Development and CI/CD / project | Reviewed final SHA and exact-head checks/build; installed suite identity; protected signing/approval; representative runtime success/failure/interruption proof | Local tests above pass; remaining defects and provisioning/rehearsal gates listed above. PR #26 remains open at its earlier head; do not infer new branch hosted CI or deployment from that result. |
| Shared database / internal release owner | Exact installed source graph, signed manifest and read-only live DB heads; backup/restore readiness | VM-admin helper now reports manifest and live DB `20260714_000032`, `exact_match=true`. Installed-source graph output remains outstanding. No migration indicated by this comparison; Mystery application VM never migrates. |
| Existing VM / admin | Fresh health and runtime identity; reviewed root-owned guard/trust/suite/archive namespace | Operator supplied five loopback HTTP 200s after earlier 503, ready/DB-ok payload, effective client-cert setting and DB TCP reachability. Earlier 503 cause unexplained. Guard, signer trust and archive namespace were absent in supplied inventory; no bootstrap performed. |
| APN/network / network team | Device-origin DNS/routing/TLS; HTTPS 443 success; negative backend 8011/DB/SSH access; no Internet ingress | External live-use dependency, NOT a blocker to finishing engineering and internal runtime rehearsal. |
| Devices / security team | Secured representative tablet/browser/authenticator/APN profile, TLS trust and loss/recovery support | External live-use dependency, NOT a CI/CD or development blocker. |
| Business and operations | Enrollment/password/TOTP, draft/resume/submission, exact visit in internal review, logout/lockout/suspension/recovery; UAT decision; monitoring/support handover | Not accepted. Service health alone is not shopper-flow or business proof. |

**Release sequence:** close engineering defects, review/merge approved source and pass final CI; approved VM bootstrap and representative isolated runtime rehearsal; verify shared DB head/backup ownership without migration; separately authorize protected first signed baseline; prove normal subsequent deployment and authenticated fallback/recovery. Capture before/after status, artifact hash/full SHA, suite identity, fresh verification/recovery JSON, process identity/restart and source/manifest/database heads.

**APN/device acceptance record:** approved device class/source scope, TLS trust observation, test shopper ID (no credentials), release ID/full SHA, internal review visit ID, positive and negative results, incident/503 reference, business decision and support handover. Keep secrets, recovery codes and personal data out of this record.
