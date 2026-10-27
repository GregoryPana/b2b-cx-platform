# Hermes Update Pack — CWSCX analytics deployment, 16 October 2026

## Project and source
- Repository: GregoryPana/b2b-cx-platform.
- Release worktree: `/home/gpanagary/cwscx-analytics-release-20261016`.
- Installed application source on tst01 and app01: `1631859f71d8fe56befb7a6b400ea0a212e32285`.
- Production workflow/controller revision: `1fea7a74325311e176a32a69037b09311df186e3`. This is not the installed application revision: production deliberately promoted the exact staging-tested archive.
- PR28 analytics, PR29 bounded host repair, PR30 strict reload-readiness, PR31 immutable promotion merged. Original dirty checkouts preserved. Current knowledge graph/vault ingestion is not claimed.

## Completed changes
Count/denominator corrections, module/question/selected-visit report boundaries, authoritative Mystery answers for analytics, scale-aware presentation, executable PostgreSQL regression coverage and no-skips CI. No database architecture redesign. Then explicit user-approved correction of tst01's wrong-host self-signed certificate, protected rollback, strict HTTPS validation, corrected app01 NGINX identity using unchanged app01 certificate, and GitHub Actions deployment.

## Verified release chain
- Staging deploy38814568581: success, source1631859. Final independent verification38816281548: success; source files match, restart02:07:11+04/PID2993939, DB head20260714_000032, healthy backend/database, strict hostname/TLS, served dashboard asset and anonymous401.
- Validated staging export38815948582: success; compares111 backend/migration Python files and60 frontend files against installed staging. Exact ZIP SHA256 `46772435bba264fd344072a79a04a2412baba9cdb30ff313eaa4b78e41f77b89`; independently downloaded artifact hash matches receipt.
- Production deploy38816056628: success, no rebuild; mandatory successful staging/exporter provenance and digest/source checks; exact selected ZIP installed, not latest-by-mtime. Final verification38816276935: success; matching source, restart02:18:11+04/PID2063460, unchanged DB head, healthy database, strict HTTPS, matching served dashboard asset, anonymous401.
- Latest exact-head application assurance38815709526 passed: backend318 including analytics237, Node5/build. Separate root-isolated operation/artifact suite26 passed locally and hosted38815709964.

## TLS and host impact
- tst01 correct new self-signed certificate: DNS SAN cwscx-tst01.cwsey.com, DNS cwscx-tst01, IP172.17.1.213. Public leaf DER SHA256 `BE:B1:DD:46:7E:9F:0B:40:29:3A:9C:AF:6E:53:30:7E:F9:86:B4:D1:35:EA:3E:3B:AB:C6:C7:55:F5:74:C7:1C`.
- Approved repair38814353069 passed. Private key remains root:root0600 on host; rollback backup under `/etc/ssl/cwscx/analytics-repair-38814353069-1`. No key exported.
- First attempt38813637561 failed immediate TLS proof and restored old state, independently confirmed38813814593. NGINX asynchronous worker retirement is handled by bounded STRICT readiness; successful retry used2 attempts. No verification disabled.
- App01 mapping repair38815127402 passed; site now cwscx-production/server_name cwscx-app01.cwsey.com. Its existing self-signed certificate fingerprint46:4B:06:A5:8B:2D:A0:51:82:E6:85:ED:6D:A5:7F:77:53:33:6F:1B:2F:92:29:10:15:1C:10:6B:04:B2:92:E3 unchanged.
- Exclusive root-controlled repair lock and shared deployment Actions concurrency; failed proofs restore original files/site link. Normal-failure rollback tested; no arbitrary power-loss/SIGKILL safety claim.

## Separate workstream and data boundaries
Web01/Mystery APN deployment was not dispatched or altered. PR26 remains open at29078cb; draftPR27 remains at2ffa8d9. Their source/recovery/signing/credential/APN/device/business gates are independent. Common analytics source can be incorporated when that lane is reconciled; do not merge or activate it as an incidental analytics action.

No new migration, table segregation, data backfill, mirror retirement or historical production-data repair. Database head remains20260714_000032. Gregory expressly deferred database restructuring and requested a future plan/risk note only.

## Remaining acceptance and handover
- Distribute/trust the new PUBLIC tst01 certificate on approved staging clients as needed. Existing app01/web01 certificate trust is unchanged.
- Authenticated business acceptance and reconciliation of historical live NPS/CSAT values were not performed; deployment/smoke checks are not substitutes. Original derived Quality4/3 threshold business confirmation and retained legacy population definitions remain documented.
- Curated sanitized/public evidence: `/home/gpanagary/cwscx-analytics-release-evidence/2026-10-16/`. Public certificate, repair proof, artifact receipt and both final host verification JSONs; no private keys/runtime.env/personal records.
- Canonical detailed audit: docs/deployment/ANALYTICS_RELEASE_20261016.md. Earlier preintegration assurance/15Oct handoff are historical and superseded on publication/deployment status.

> Update the project knowledge graph from these verified release states; retain separate runtime-source, workflow-source, business-acceptance and Mystery deployment states.
