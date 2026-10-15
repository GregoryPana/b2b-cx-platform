# Analytics release coordination — 16 October 2026

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

## Verified publication and activation hold

- PR28 merged application commit `23efe9e1e0450e1b9f4ec433ecc6b272267704bb` into main at `335b411deeb26ebcd0763c00e38584bfb9400044`. Push and PR head were read back; analytics/backend/dashboard hosted checks passed before merge. Main analytics check `38804720574` also passed.
- Basic read-only target checks passed: staging `38804745772`, internal production `38804885111`. Both had an active service, healthy database and reviewed DB head `20260714_000032`; deployed source still differed from the candidate, as expected before activation.
- Additional read-only authentication/frontend verification was prepared separately from application source. Anonymous internal visit-list access was correctly rejected on staging. No test bypass or certificate-verification disabling was introduced.
- **Staging activation is held:** run `38806291286` verifies the installed certificate as its explicit trust anchor but fails hostname verification for `cwscx-tst01.cwsey.com`. Error: `SSLCertVerificationError: certificate verify failed: Hostname mismatch`. This is not an application test failure and was not worked around with insecure TLS.
- Staging certificate lives under a protected directory. Its public certificate was read using an already available internal deployment root wrapper; no private key was read, no permission/sudoers/trust configuration changed. Earlier diagnostic attempts failed safely before any deployment.
- The extended production probe `38806436555` stopped because the expected `/etc/nginx/sites-enabled/cwscx-production` file was absent. This is an inventory assumption to reconcile, not proof production TLS is invalid. Its earlier basic runtime/database gate passed. No production activation was attempted.
- **No staging, production or separate Mystery Shopper deployment workflow has been dispatched by this release lane.** Read-only inspection workflows are not deployments; service timestamps remained at the existing baseline during staging checks.
- Next: inspect/approve the staging certificate SAN/hostname alignment and map the actual internal-production NGINX site; rerun strict preflights. Only then dispatch approved staging deployment, verify installed source/restart/DB/frontend, and promote to internal production. Separate Mystery/APN activation stays with its own workstream. PR26/27 remain unmerged and unchanged.

