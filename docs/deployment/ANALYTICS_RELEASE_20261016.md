# Analytics release coordination — 16 October 2026

## Current deployed state — supersedes the historical activation hold below

- Application release source: `1631859f71d8fe56befb7a6b400ea0a212e32285`. Staging deployment [38814568581](https://github.com/GregoryPana/b2b-cx-platform/actions/runs/38814568581) succeeded; independent post-deploy checks `38814964475` and final `38816281548` passed. Backend restart `2026-10-16 02:07:11 +04`, PID `2993939` at final readback.
- Internal-production deployment [38816056628](https://github.com/GregoryPana/b2b-cx-platform/actions/runs/38816056628) succeeded using the SAME staging ZIP, not a rebuild. Workflow/controller source was `1fea7a74325311e176a32a69037b09311df186e3`; installed application source remains the staging-tested `1631859...`. Final independent check `38816276935` passed. Backend restart `2026-10-16 02:18:11 +04`, PID `2063460` at readback.
- Validated staging exporter `38815948582` compared 111 installed/backend/migration Python files and 60 frontend files with the archive. Exported/independently downloaded bundle SHA256 `46772435bba264fd344072a79a04a2412baba9cdb30ff313eaa4b78e41f77b89` was explicitly verified by production before installation. Production no longer rebuilds or chooses newest ZIP by timestamp.
- Both final readbacks prove the six changed analytics source files match, database head stays `20260714_000032`, anonymous API returns401, HTTPS hostname/certificate checks pass and served dashboard JS matches installed assets. These are deployment/smoke proofs, not authenticated business acceptance or reconciliation of historical live NPS/CSAT values.
- Approved tst01 certificate rotation `38814353069` passed strict HTTPS. New self-signed public certificate has DNS SANs `cwscx-tst01.cwsey.com`, `cwscx-tst01` and IP `172.17.1.213`. DER SHA256 fingerprint `BE:B1:DD:46:7E:9F:0B:40:29:3A:9C:AF:6E:53:30:7E:F9:86:B4:D1:35:EA:3E:3B:AB:C6:C7:55:F5:74:C7:1C`. Private key stayed on host root:root0600; protected rollback copies are under `/etc/ssl/cwscx/analytics-repair-38814353069-1`. Staging clients trusting the previous leaf may need the new PUBLIC certificate distributed through the approved process.
- First rotation `38813637561` failed its immediate post-reload certificate check and restored the original state; independent rollback readback `38813814593` confirmed original fingerprint and healthy backend/database. PR30 added bounded STRICT TLS convergence after asynchronous reload (successful rotation required2 attempts), not an insecure bypass. Persistent invalid certificates still fail and restore.
- App01 site repair `38815127402` changed only the incorrect staging hostname/site mapping to `cwscx-production`/`cwscx-app01.cwsey.com`; existing app01 certificate fingerprint `46:4B:06:A5:8B:2D:A0:51:82:E6:85:ED:6D:A5:7F:77:53:33:6F:1B:2F:92:29:10:15:1C:10:6B:04:B2:92:E3` is unchanged. Default/other sites preserved; protected rollback backup is host-local.
- Exact-head hosted application assurance passed at `18bb7ca` (`38815709526`); full backend318 including analytics237, Node5/build. Separate operation/artifact suite26 passed locally and hosted (`38815709964`):18 repair/TLS/rollback/lock tests plus8 immutable-artifact tests. New workflow lint passed; existing production-label/ShellCheck baseline exceptions were identified, not presented as new clean lint.
- PR28 analytics, PR29 bounded repairs, PR30 readiness and PR31 immutable promotion are merged. Separate Mystery/APN PR26 and draft PR27 remain open at their original heads. **No web01 host, certificate, signing/credential, deployment or APN change was performed.** Its latest Actions deployment is still the prior failed September run, not a new activation.
- Database/table redesign, backfill and mirror retirement remain deferred by Gregory. No database segregation or new migration was introduced. User/client trust rollout and authenticated business acceptance remain separate from the completed application deployment.
- Curated public/sanitized evidence: `/home/gpanagary/cwscx-analytics-release-evidence/2026-10-16/` (new public certificate, repair JSON, staging ZIP receipt, both final post-deploy JSON reports). No private keys, runtime `.env` or personal survey records included.

## Historical planning and gate progression


## Approved scope
Gregory approved commit, push and deployment. This release contains only the scoped analytics/count/report fixes and their test/CI support, transferred to current `origin/main@c42bcc76bdaf7fc29227690c38a34e762652ab77`. The older analytics worktree and all other worktrees are preserved. Its predecessor's 301-test proof is historical; the rebased release source was reverified: analytics237, full backend318, Node5 and dashboard build passed, no skips. The newer main migration tests use their own empty disposable database; auth test clients explicitly select the internal route surface rather than inheriting the public-auth module's environment. No production auth change.

## Environment scope
1. Staging: `deploy-staging.yml`, `cwscx-tst01`, GitHub environment `staging`.
2. Internal production: `deploy-production.yml`, `cwscx-app01`, GitHub environment `production`, only after staging validation.
3. Separate production Mystery Shopper/APN instance: `deploy-mystery-public.yml`, `cwscx-web01`, GitHub environment `mystery-public`: **not activated by this analytics lane**. Coordinate with unmerged PR26/PR27; no deployment-control scripts, signing controls, VM configuration or their branches are changed here. Shared source fixes can be incorporated by that lane after its independent release gates.

All three deploy workflows are manual; a push/merge does not automatically deploy all environments. Internal deployment may rebuild its internal Mystery survey bundle but does not execute the separate APN-host workflow. Shared production data could still be affected by any migration; this release adds no migration and source head remains `20260714_000032`.

## Non-interference
Read-only comparison against PR27 finds only the pending handoff log and lifecycle-test file overlapping. PR27's lifecycle changes are explanatory comments; analytics changes are fixture initialization. No backend deployment controls overlap. Do not merge either deployment PR as part of this release. No active deploy was observed; staging and production runners were online/idle at discovery.

## Activation gate
Direct workstation intranet DNS and SSH are unavailable (DNS failure and registered-IP SSH timeouts). Do not infer host health from an online runner. The added `analytics-release-preflight.yml` runs read-only checks through the existing appropriate runner: registered hostname/service/root, health/database, disk, source hashes and read-only live Alembic head. It cannot deploy or write application data. Require that check before deployment and installed-source equality afterward. Database head must already match the reviewed target; unexpected drift stops activation.

Publication, hosted CI, merge and actual run/evidence identifiers must be recorded separately when verified. No successful deployment is declared by this planning record. Local tests are not a production data-reconciliation or APN device/business-acceptance proof.

## Database scope decision

Gregory has deferred database/table redesign and data-isolation migration. Retain the shared-boundary/dual-write issue as a future planning risk; no database hardening, table segregation, data backfill or mirror retirement is authorised by the current release. Focus remains the merged analytics corrections and coordination with the separate Mystery Shopper deployment workstream. A future assessment/plan must be separately scoped before implementation.

## Verified publication and activation hold

- PR28 merged application commit `23efe9e1e0450e1b9f4ec433ecc6b272267704bb` into main at `335b411deeb26ebcd0763c00e38584bfb9400044`. Push and PR head were read back; analytics/backend/dashboard hosted checks passed before merge. Main analytics check `38804720574` also passed.
- Basic read-only target checks passed: staging `38804745772`, internal production `38804885111`. Both had an active service, healthy database and reviewed DB head `20260714_000032`; deployed source still differed from the candidate, as expected before activation.
- Additional read-only authentication/frontend verification was prepared separately from application source. Anonymous internal visit-list access was correctly rejected on staging. No test bypass or certificate-verification disabling was introduced.
- **Staging activation is held:** run `38806291286` verifies the installed certificate as its explicit trust anchor but fails hostname verification for `cwscx-tst01.cwsey.com`. Error: `SSLCertVerificationError: certificate verify failed: Hostname mismatch`. This is not an application test failure and was not worked around with insecure TLS.
- Staging certificate lives under a protected directory. Its public certificate was read using an already available internal deployment root wrapper; no private key was read, no permission/sudoers/trust configuration changed. Earlier diagnostic attempts failed safely before any deployment.
- The extended production probe `38806436555` stopped because the expected `/etc/nginx/sites-enabled/cwscx-production` file was absent. This is an inventory assumption to reconcile, not proof production TLS is invalid. Its earlier basic runtime/database gate passed. No production activation was attempted.
- **No staging, production or separate Mystery Shopper deployment workflow has been dispatched by this release lane.** Read-only inspection workflows are not deployments; service timestamps remained at the existing baseline during staging checks.
- Next: inspect/approve the staging certificate SAN/hostname alignment and map the actual internal-production NGINX site; rerun strict preflights. Only then dispatch approved staging deployment, verify installed source/restart/DB/frontend, and promote to internal production. Separate Mystery/APN activation stays with its own workstream. PR26/27 remain unmerged and unchanged.

