# AI Prompt: Installation Assessment Implementation

You are working in a fresh clone of this repository. You have no prior context outside the codebase itself.

Your mission is to implement the Installation Assessment platform end-to-end using the existing architecture and planning docs already present in the repo.

## Critical instruction: read these docs first (in this exact order)
1) `installation-planning/README.md`
2) `installation-planning/INSTALLATION_ASSESSMENT_PLAN.md`
3) `installation-planning/INSTALLATION_ANALYTICS_SPEC.md`
4) `questions install.md`

Treat these as the primary source of truth for:
- installation scope
- questionnaire/categories/scoring
- analytics definitions and formulas
- implementation intent

## Work protocol
1. Discovery first, then implementation.
2. Summarize architecture with exact file references before coding.
3. Produce a concrete implementation plan aligned to the above docs.
4. Implement in phases with verification after each phase.
5. Preserve existing B2B functionality (no regressions).
6. Reuse existing shared DB + unified dashboard patterns.
7. Keep local/LAN support intact (CORS, host binding, hostname-based API URL).

## Functional requirements
Build Installation Assessment so that:
- A dedicated installation survey frontend flow exists.
- Results are saved in shared DB with auditable historical records.
- Unified dashboard can view and filter installation assessments.
- Dashboard shows installation analytics per spec docs.

Per-assessment metadata required:
- customer_name
- customer_type (B2B/B2C)
- location (address)
- work_date
- execution_party (Field Team/Contractor)

Question/scoring:
- Use all 7 questions from `questions install.md`
- Input range 1-5
- Preserve category names from source
- overall_score = SUM(scores) / 7

Dashboard filters:
- location
- customer_name
- customer_type
- execution_party
- date/date range

Analytics (must implement):
- average overall score
- average by execution_party
- average by customer_type
- category averages
- threshold distribution:
  - 4-5 Pass - Excellent
  - 3-4 Pass - Needs Improvement
  - 2-3 Fail - Rework Required
  - 1-2 Critical Fail

Analytics explicitly NOT required:
- segmentation by location
- on-time review SLA

## Required phases
Phase A: Discovery report (architecture map + key files + active entrypoints)
Phase B: Schema/migrations/seed for installation survey type + questions
Phase C: Backend create/list/detail/filter + installation analytics endpoints
Phase D: Installation survey frontend flow
Phase E: Unified dashboard installation pages + analytics visuals
Phase F: Regression and LAN/local verification

## Output expectations
- Show discovery findings with file paths.
- Show implementation plan before coding.
- Then code and verify each phase.
- At the end provide:
  - changed files list
  - API endpoints added/updated
  - migration notes
  - test/verification commands + results
  - known limitations (if any)

Start now by reading the four required docs and producing the discovery summary + implementation plan.
