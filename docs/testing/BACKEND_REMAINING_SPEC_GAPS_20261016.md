# Backend remaining spec gaps — 16 October 2026

Local-only follow-up in `cwscx-module-boundaries-20261016`; preserves concurrent edits. No commit, deployment, schema/migration, authentication, signer, or production-data changes.

## Corrections
- Mystery report Service Quality pools only non-Overall Experience questions with declared bounds exactly 1–5. Overall Experience pools only its category's declared 0–10 ratings, including the recommendation rating, not the NPS index. Unknown/different bounds are excluded, never normalized implicitly.
- Report summary and per-visit 0–10 means require declared 0–10 bounds; per-visit means exclude invalid scores as the grouped summary already did. HTML explanations describe the scale exclusions and no longer claim behaviour questions use 0–5.
- B2B submission rejects an empty scoped questionnaire with 422 before changing visit status. Legacy NULL-owned questions remain valid B2B questions. Mystery already rejects absent module questions in `_ensure_mystery_shopper_schema` with 500 on the latest source; retain that existing initialization-failure contract rather than changing it to 422. Missing mandatory responses retain 422.
- B2B list/draft/detail mandatory totals and submission answered/missing checks now consistently include NULL-owned questions, matching scoped read/write policy. NULL visits remain excluded.

## Added regressions
`backend/tests/analytics/test_remaining_spec_gaps.py` adds seven cases: mixed 1–3, 0–5, unknown-minimum–5, 1–10 and 1–5 overall scales; no compatible scales displays absence; empty-module questionnaire rejection preserves Draft and Needs Changes for each module; and an unanswered mandatory legacy NULL question appears in list/draft/detail totals and missing-question output, then can be saved/read/submitted successfully.

Mixed-scale tests generate actual report HTML and Chromium PDF from the real PostgreSQL payload. HTML asserts label/value association (Quality 5.00, Overall Experience 8.00); PDF bytes are parsed with pypdf and assert the actual adjacent KPI block plus exclusion wording. Chromium's PDF extraction emits adjacent grid labels before the corresponding values; the test records that order. This is generated-content assurance, not a visual screenshot/layout or business acceptance claim.

## Exact verification
Interpreter: `/home/gpanagary/.hermes/cache/scratch/cx-analytics-venv/bin/python`, invoked with `env -u PYTHONPATH -u VIRTUAL_ENV`.

- `scripts/dev/verify_analytics_calculations.py --scope analytics -- --junitxml=/home/gpanagary/.hermes/cache/scratch/spec-gaps-analytics.xml`: **318 passed**, 27 deprecation warnings, 17.99s, exit 0.
- `scripts/dev/verify_analytics_calculations.py --scope full -- --junitxml=/home/gpanagary/.hermes/cache/scratch/spec-gaps-full.xml`: **399 passed**, 40 deprecation warnings, 38.99s, exit 0.
- Both runners used newly provisioned, nonce/data-directory attested PostgreSQL 16.2 with no TCP listener; no shared database was used. JUnit verifies no skips, failures or errors.
- Focused regression iteration initially exposed test assumptions (Mystery already returns 500 for initialization failure, UUID list identities, Chromium grid extraction order), corrected without weakening the existing status contract.
- Owned Python diff whitespace check passes. Whole-worktree `git diff --check` reports unrelated pre-existing/concurrent CRLF/trailing whitespace in `admin_dashboard.py` and a blank final pending-log line; these files were not reformatted.

## Files owned by this follow-up
- `backend/app/api/mystery_shopper.py` (scales, report wording, initialization contract comment).
- `backend/app/api/visits_dashboard.py` (empty-questionnaire guard and consistent mandatory NULL policy).
- `backend/tests/analytics/test_remaining_spec_gaps.py` (new).
- This evidence note and a compact appended pending-log entry.

No live authenticated browser/business reconciliation, deployment, or frontend build was performed by this follow-up; other workers own frontend verification.
