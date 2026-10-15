# CWSCX Mystery Shopper APN-only release gate

## Current engineering state — 15 October 2026

This is a qualified engineering evidence record, not a production deployment or business-acceptance record. The application design remains internal/APN-only: approved APN clients are intended to reach HTTPS 443, with no public route.

**Exact tested source:** `d3ea9422c473881384edf4c1434aff66611d725f` (`d3ea942`). It is the runtime-tested source checkpoint on draft PR #27's branch `fix/mystery-release-audit-20261013`; later documentation or observability changes must retain their own exact-head CI and test evidence. Cumulative PR #26 remains unmerged. The evidence below does **not** establish that `d3ea942` is merged, deployed to production, or exercised on the actual intranet target. No workflow dispatch, production/intranet access, migration, credential rotation, VM bootstrap, GitHub settings change, commit, or push was performed while consolidating this record.

## Gate summary

**Actual local VM release test gate: QUALIFIED PASS — not an all-green matrix.** In disposable no-network Ubuntu 24.04 QEMU guests, the real privileged release path at `d3ea942` established a signed baseline, completed a normal signed deployment and explicit signed rollback, preserved the authenticated baseline through a complete preactivation candidate failure, recovered automatically from a postactivation NGINX `exit 42`, and reconciled one actual preactivation SIGKILL. Each successful deployment/recovery verification cited below reported 18/18 checks passing. Several enclosing harnesses nevertheless failed on fixture-only expectations or result markers, and the first automatic fallback probe in the postactivation run timed out at 30 seconds before the EXIT-trap recovery attempt succeeded. Engineering is therefore not unconditionally finished.

The rehearsals used synthetic local signing/authorization and a synthetic PostgreSQL fixture at head `20260714_000032`. They did not use production credentials, the real shared database, GitHub Environment approval, or the actual application VM.

## Evidence matrix

| Gate | Result | What was actually established | Qualification |
| --- | --- | --- | --- |
| First signed baseline | **PASS; enclosing harness FAIL** | Real baseline operation completed at full `d3ea942`; signed archive and provenance were present; status reported baseline established, no pending operation/recovery, and 18/18 verification checks passed. | Harness stopped on an obsolete flat archive-path postcheck after the operation; later baseline archive/signature/provenance and strict-workflow checks passed in the normal-deploy run. |
| Normal signed deployment | **PASS; enclosing harness FAIL** | Fresh signed `rehearsal-normal-d3ea942` installed, probed, activated, restarted, archived, and passed 18/18 verification plus the unchanged strict workflow validator. Baseline archive reverified; unrelated NGINX fixture on 8012 remained unchanged. | Final listener assertion omitted the known loopback-only systemd-resolved port 53, so the optional aggregate PASS marker was not written. |
| Explicit signed rollback | **PASS** | Fresh signed rollback returned to `rehearsal-baseline-d3ea942`; PID changed, runtime bound to the baseline, direct/TLS readiness was 200, anonymous session was 401, archive authentication and DB-head checks passed, and strict `verify-success rollback` passed. | Local isolated guest with synthetic signer; not a production rollback. |
| Complete preactivation bad-candidate failure | **PASS** | Signed deploy failed at the bounded private candidate probe with the sanitized category `candidate application exited before readiness`; current baseline, PID/incarnation, signed archive, and DB head stayed unchanged; complete postfailure direct/TLS/frontend/anonymous/status/listener checks passed. | A separate attempted postactivation fixture later timed out during its candidate probe and never reached activation; that attempt is not evidence of postactivation fallback. |
| Postactivation NGINX failure and automatic fallback | **QUALIFIED PASS; harness marker FAIL** | The original signed candidate probe passed, candidate activated as PID 4943, and its signed NGINX script emitted the fixture marker and exited 42. The unchanged entrypoint restored the authenticated baseline; final PID 6587, no pending/recovery state, 18/18 recovery checks, and strict classification `recovered_authenticated` passed. | The first automatic fallback private probe timed out at 30 seconds and logged that activation and recovery failed. The unchanged EXIT trap made a second recovery attempt, which succeeded. The harness expected a one-attempt message and omitted its per-leg marker; host wrapper returned 98. Intermittent probe latency under software TCG remains unresolved. |
| Actual preactivation SIGKILL | **QUALIFIED PASS; final harness gate FAIL** | A transient systemd service had an exact, protected-process-disjoint cgroup with six recorded process incarnations. It was frozen, reverified, SIGKILLed, all six incarnations died, the cgroup emptied, and `deploy.lock` became independently acquirable. Baseline health remained available. Fresh signed recovery removed the named incomplete candidate and marker, restored the authenticated baseline, passed 18/18 checks, and classified `recovered_authenticated`. | One preactivation boundary only; no arbitrary power-loss or all-interruption-boundaries claim. Final exact release-set assertion found a retained `.extract.cyDAN6` temporary. |
| Retained extraction temporary policy | **QUALIFIED / no source fix justified** | `.extract.cyDAN6` was absent before and present after, in the exact installer namespace, as a root-owned real directory with mode `0700`. Recovery correctly bypasses general orphan cleanup. Four targeted orphan-policy unit tests passed. | Exact `mtime` was not captured, so freshness is inferred, not directly attested. Implemented cleanup is opportunistic after 24 hours on the next successfully authorized **deploy or rollback**, under lock and with no blocking durable state; it is not timer-driven and does not run on signed recovery or read-only status. No actual aged-guest cleanup lifecycle was demonstrated. |

Across the successful operation/recovery evidence, checks included exact release/SHA identity, source/manifest/live database-head equality, loopback listener and service state, fresh restart and serving-process identity, readiness with database `ok`, anonymous 401, TLS proxy/frontend behavior, NGINX syntax, and signed archive status. Port 53 observations were confined to loopback systemd-resolved endpoints; no unknown extra listener was found.

## Test environment and evidence limits

- Actual guest: Ubuntu 24.04.5, systemd 255, NGINX 1.24, PostgreSQL 16.15, Python 3.12.3; backend ran as `cxadmin:www-data` on loopback 8011 and TLS frontend checks used 443.
- Isolation: ordinary Docker process with 2 CPU, 2 GiB memory and 512 PID limit; QEMU software TCG with 2 vCPU/1,024 MiB guest RAM, `cache=none`, no NIC, host ports, device passthrough, KVM or privileged mode; all capabilities dropped and `no-new-privileges` enabled.
- Storage/capacity and backing-image integrity checks passed; prepared-base SHA-256 remained `05220b3bf7f20b3618e7646366f75b7b38e90a73b81b0987604a6e04d2f44f69` and capacity-backing SHA-256 remained `a504c26b94d56ac690a72ef947a89a08d4275dcebd76ad1573b36e869959d815`.
- Database evidence used a synthetic fixture migrated to `20260714_000032`; it is not proof against the actual shared database. No migration or DDL ran in these release legs.
- Synthetic signer and operation metadata were explicitly local/non-GitHub. No production signing key, SSH key, environment value, credential, recovery code, private proof, or raw secret-bearing evidence is copied into this repository.
- These runs do not establish arbitrary power-loss safety, every interruption boundary, deterministic 30-second probe timing, or a single fully clean aggregate harness run.
- No frontend-device/APN shopper flow, device TLS trust, APN routing/negative reachability, monitoring/support handover, or business acceptance was exercised.
- No actual production credential rotation/revocation, first bootstrap, environment protection, repository protection, or GitHub settings change was performed.

## Remaining engineering and release controls

Engineering remains open despite the qualified local-VM gate:

1. Investigate or bound the intermittent private-candidate probe latency under software TCG and obtain a complete clean harness run whose aggregate marker and assertions match policy. Do not reinterpret the successful EXIT-trap recovery as proof that the first fallback probe is reliable.
2. Review and reconcile competing unmerged PRs #26 and #27; merge only the approved exact source after required review and CI. `d3ea942` is evidence-bearing source, not a production release declaration.
3. Provision and independently verify required repository/environment protections, approval rules, distinct signer trust, narrow VM privileged suite, and credential lifecycle controls. Historical read-only observations are not proof of the latest settings and this document authorizes no settings or credential change.
4. Execute the approved workflow on the actual target later: verify the target `.env` grammar without exposing values, root-owned bootstrap/source provenance, exact database heads and backup/restore ownership, first signed baseline where applicable, normal deployment, rollback/failure recovery, and retained evidence.
5. Exercise additional interruption boundaries separately before any all-boundaries or power-loss claim. For future SIGKILL fixtures, capture residual-temporary `lstat` metadata including `mtime`, blocker state, and a policy-correct aged-maintenance lifecycle.

No application/source change is justified by the retained fresh extraction evidence. The specific postactivation timeout is an unresolved observation, not an established application-source defect.

## Off-intranet engineering closeout versus intranet acceptance

### Eligible for off-intranet closeout after the open engineering items above

- Exact-source review/CI and reconciliation of PR #26/#27.
- Deterministic, policy-correct local harness evidence and additional bounded interruption tests.
- Documentation, evidence-schema review, provisioning plans, signer/approval design, and operator checklists that do not require production secrets or target access.
- Read-only GitHub protection/approval and signer-secret-presence checks over the Internet; separately approved GitHub-only protection changes do not require intranet access.

### Requires later authorized intranet/owner execution

- Actual target VM inventory/bootstrap/status and exact runtime execution.
- Actual shared-database head/backup ownership validation without migration by the Mystery VM workflow.
- Production signer trust/bootstrap and approved credential rotation/revocation; GitHub-only controls can be handled separately off-intranet as above.
- APN DNS/routing/TLS and negative reachability checks from approved client scope.
- Representative tablet/browser/authenticator flow and business acceptance: enrollment, password/TOTP, draft/resume/submission, internal review visibility, logout/lockout/suspension/recovery, monitoring and support handover.

APN/device availability is not a blocker to off-intranet engineering work, but engineering evidence is not a substitute for those intranet and business gates.

## Non-portable local provenance

The following sanitized parent reports are local scratch evidence, not repository artifacts. Paths may not exist on another machine; hashes allow an authorized reviewer with the local evidence set to confirm the exact reports without copying raw/private proofs into git.

| Evidence | Local path | Report SHA-256 |
| --- | --- | --- |
| First signed baseline | `/home/gpanagary/.hermes/cache/scratch/cwscx-baseline-only-d3ea942-20261015-v2/ACTUAL-LAUNCH-REPORT.md` | `44049483c97653ded15de65bf499551222cf8f05bbb47da5fa0ba7f2c1e63129` |
| Normal signed deployment | `/home/gpanagary/.hermes/cache/scratch/cwscx-signed-normal-d3ea942-20261015/REPORT.md` | `5d3beb8510c632cbdea558622c7dd7e2ad1a1398284e76f291f479055fabb755` |
| Explicit rollback and initial failure run | `/home/gpanagary/.hermes/cache/scratch/cwscx-signed-recovery-d3ea942-20261015/REPORT.md` | `8032ed6dc79c8c0812444ea96de208405d44e89f9d50c0a759b61bd247e34f9d` |
| Complete preactivation failure / blocked postactivation attempt | `/home/gpanagary/.hermes/cache/scratch/cwscx-two-failure-recovery-d3ea942-20261015-v2/REPORT.md` | `44c9b21caf00a8d4a81457e5ee33fc66a2adff04a51b961024c18148ed85e24d` |
| Postactivation NGINX 42 / automatic fallback | `/home/gpanagary/.hermes/cache/scratch/cwscx-postactivation-only-d3ea942-20261015-v1/REPORT.md` | `9bcf7471457e32c3e6da64cf6f936cd96a367af1fd4ff0ca27ed468f7b982bc7` |
| Preactivation SIGKILL | `/home/gpanagary/.hermes/cache/scratch/cwscx-sigkill-preactivation-d3ea942-20261015-v2/REPORT.md` | `da2a155783438e35cbeff3f8edaa7467f425d85465d8f8bf64ac09a48cfa42cc` |
| Retained-extract policy review | `/home/gpanagary/.hermes/cache/scratch/cwscx-sigkill-preactivation-d3ea942-20261015-v2/POLICY-REVIEW.md` | `6357c915a13fb6bec4aafe460ee0ea155087cd9e7f912cd587728989a533246d` |

## Historical progression

Earlier gate and pending-log entries record intermediate `5054e95` rehearsal findings, the canonical baseline-path correction, packaging fixes, bootstrap/orphan hardening, and unit/contract suites. Those statements remain historical evidence of how `d3ea942` was reached, but their claims that corrected baseline/deploy/rollback/failure VM legs were wholly unrun are superseded by the matrix above. Historical local and hosted test counts remain evidence for their exact revisions; they are not promoted here into a claim that the current release matrix is all green.

## Actual-target evidence to retain

When separately authorized, retain before/after status, exact release ID/full SHA, bundle/report hashes, privileged-suite identity, signed operation and archive verification status, fresh deployment/recovery JSON, systemd process identity/restart metadata, source/manifest/live database heads, listener classification, and approval record. Keep secret values, private keys, raw environment contents, recovery codes, personal data, and private raw proofs out of repository documentation.
