# Hermes Pending Updates

## Analytics release closeout — 16 October 2026

Latest canonical release/evidence: `docs/deployment/ANALYTICS_RELEASE_20261016.md` and `docs/handoffs/HERMES_UPDATE_PACK_ANALYTICS_DEPLOYMENT_20261016.md`. Earlier 15 October pack is historical, not current deployment state. No vault-ingestion claim.

Analytics changes are merged and deployed to staging tst01 and internal production app01 at application source1631859f71d8fe56befb7a6b400ea0a212e32285. Production promoted the exact validated staging ZIP (SHA25646772435bba264fd344072a79a04a2412baba9cdb30ff313eaa4b78e41f77b89), not a rebuild. Staging Actions38814568581 and production38816056628 succeeded; final independent source/service/migration/TLS/frontend/auth checks38816281548 and38816276935 passed. DB head remains20260714_000032; no segregation/new migration introduced.

Explicitly approved staging self-signed certificate correction succeeded, protected rollback copies host-local; public certificate exported and fingerprint read back. App01's incorrect staging-named site was corrected; its existing certificate is unchanged. Web01/Mystery APN host, certificate, signers/credentials and deployment were not touched; PR26/27 remain open at prior heads. Application assurance318 (includes analytics237), Node5/build and separate operation/artifact suite26 passed locally/hosted.

Remaining non-deployment items: distribute new PUBLIC staging certificate to clients that trusted the old leaf; authenticated business acceptance/live historical metric reconciliation; derived Quality4/3 threshold business confirmation remains in original assurance risks. Database architecture hardening/backfill/mirror retirement explicitly deferred for future planning only. First certificate attempt rolled back safely; bounded strict reload-convergence fix is documented and regression-tested. Never reinterpret older uncommitted/undeployed statements as current.
