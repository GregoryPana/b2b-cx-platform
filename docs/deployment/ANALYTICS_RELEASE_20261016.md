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
