# Installation, legacy dashboard and survey frontend verification

Local worktree: `/home/gpanagary/cwscx-module-boundaries-20261016`.
This is scenario coverage, not a statement/branch coverage percentage or production sign-off.

## Changes reviewed and completed

- All five Installation dashboard components: contextual task titles, assessment-versus-answer counts, explicit `/5` units, separate loading/empty/zero states, labelled filters and no false grade for a missing score.
- Installation analytics help: named buttons with keyboard focus, hover and touch support, Escape dismissal and screen-reader tooltip association. Browser testing found a 375px popover overflow; the final popover stays inside the viewport.
- Legacy dashboard: Mystery score means are distinct from B2B satisfied-answer percentages. Quality grouping requires configured 1-to-5 metadata, not a low observed average; null answers are excluded and incompatible scales are not averaged. Empty B2B satisfaction denominators show “No answers”.
- Legacy queue/list/detail/review calls now use dedicated Mystery routes in Mystery context and B2B routes in B2B context. Module switches clear selected/results state; old asynchronous responses cannot repopulate the new module's views.
- Installation survey: the save readback checks assessment identity, unique question numbers and exact scores, not merely response count. An accepted but unverified submission has a warning instead of the verified-success panel and never advises blind resubmission. The guide no longer claims a draft-saving feature exists.
- B2B and Mystery survey-taking pages: question-range help, pressed state for score buttons, contextual questionnaire-empty states, and a readable saved score including a valid zero. Question text and question semantics were not changed.

## Automated checks executed

| Working directory under `frontend/` | Command | Result |
| --- | --- | --- |
| `dashboard-blueprint` | `node --test src/components/installation/installationPresentation.test.mjs` | 9 passed, 0 failed/skipped |
| `dashboard` | `node --test src/utils/mysterySummary.test.mjs` | 24 passed, 0 failed/skipped |
| `installation-survey` | `node --test src/features/installation/saveVerification.test.mjs` | 6 passed, 0 failed/skipped |
| `mystery-shopper` | `npm test` | Existing questionDisplay suite: 10 passed |

49 unit/SSR tests passed in these commands. The Installation SSR tests exercise all five components. Legacy tests execute the actual async function bodies from App.jsx in a sandbox with delayed fetches and verify both module directions, plus aggregation edge cases. Save-verification tests cover wrong assessment, different answers, missing/duplicate question IDs, null-versus-zero and the guarded confirmation copy. They do not perform real server writes.

## Browser fixture checks

Start `dashboard-blueprint` with `npm run dev -- --host 127.0.0.1 --port 5194 --strictPort`, then run:

```sh
python src/components/installation/installationPresentation.browser.py
```

Requires Python Playwright and installed Chromium. Optional variables: `INSTALLATION_QA_BASE_URL`, `INSTALLATION_QA_OUTPUT` (defaults to TMPDIR).

The fixture mounts the real InstallationAnalyticsView with an explicitly empty result set; it does not bypass authentication or mock an authenticated business workflow. Chromium checks passed at 375, 768 and 1440px: focus opens help, Escape dismisses, hover opens, touch opens, tooltip bounds stay within the viewport, no page horizontal overflow, and no page JavaScript errors. Screenshot evidence: `/home/gpanagary/.hermes/cache/scratch/installation-qa-{375,768,1440}.png`. The mobile screenshot was visually inspected. The HTML/JSX fixture files are test-only entries, not imported by the shipped app entry.

## Builds executed

`VITE_AUTH_MODE=entra npm run build` passed in each of `dashboard-blueprint`, `dashboard`, `installation-survey`, `mystery-shopper` and `survey`. `VITE_AUTH_MODE=mystery_public npm run build` also passed for `mystery-shopper`.

Warnings: stale Browserslist data and chunks larger than 500kB; the B2B survey build also reports the dependency `lottie-web` eval warning. No package upgrades were made. `git diff --check` passed for the owned frontend paths.

## Gaps and boundaries

- No authenticated live-server/customer-data walkthrough, actual survey submission/review action, email/PDF export or database/report segregation test was performed in this subtask. Backend and blueprint B2B/Mystery/report work belong to the parent/other workers.
- No React-mounted legacy App interaction test: the legacy async functions were executed in isolation, not through the authentication shell. Same-module request-order races are outside the module-switch regression.
- No exhaustive responsive visual review of every table, populated chart or survey form; browser coverage is the empty Installation analytics/help fixture. The B2B/Mystery survey-page changes are build-checked but do not have new full-page interaction tests.
- No dedicated TypeScript/lint commands exist in the inspected package scripts. Vite builds transpile TSX; they are not a full TypeScript typecheck.
- Existing fonts/icons/design conventions were retained. This is a bounded correctness/accessibility patch, not a full frontend design-system conformance pass.
- No backend/auth/schema/secrets/deployment edits, commits or deployments were made by this worker. Other workers' dirty files were preserved. Parent should incorporate this report into the consolidated plan and pending-update log.
