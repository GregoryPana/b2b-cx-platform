# Dashboard audit (November 2026)

Scope: `frontend/dashboard-blueprint`, the internal staff dashboard, for all three platforms (B2B, Mystery Shopper, Installation). This audit covers the **Analytics**, **Trends** and **Review** pages and the **visit detail panels** first, plus the shared pieces they use (`SidePanel`, `ActionDialog`, `Field`). Pages not yet read are listed under "Round 2".

Already done by earlier streams and not repeated here: data tables (#44-#48 chain), planned-visit/action-point disclosures, side panels, report builder type picker, `window.confirm` deletes (#62), legacy dashboard retired (#59).

Rules applied: `docs/design/DESIGN_SYSTEM.md` (§4.2 no nested cards, §4.7 tables, §4.8 dialogs, §5.2 page anatomy, §6.2 charts, §7 feedback) and the lessons in its Appendix A.

Status key: `todo` · `doing` · `done` · `deferred` (needs a decision) · `verified` = checked in a real browser.

> **Not everything in this audit is UI/UX.** Items marked **BEHAVIOUR/DATA** change what the dashboard sends, saves or shows as a number (not just how it looks), or need an owner decision first. They are reviewed as functional changes.

## How this was done

Read-only so far. Read in full: `DashboardPage.jsx` Analytics, Trends, Review and the B2B visit-detail block (lines ~2950-3675), `MysteryVisitDetailCard.jsx` (structure), `SidePanel.jsx`, `ActionDialog.jsx` (structure), `Field.jsx`. Counted by search across all of `DashboardPage.jsx`, `features/mystery-shopper/components/*` and `components/installation/*`: labels, placeholders, hard-coded colours, cards. **Nothing was run in a browser and no code was changed.**

## Protected code (do not edit without owner approval)

Tests read `DashboardPage.jsx` as text: `pages/dashboardRequests.test.mjs` slices handlers by `const <name> =` (the load, download, preview and email handlers and the effects that call them), `mysteryPresentation.test.mjs` checks the B2B-only CSAT guard, and `InfoHint.test.mjs` checks `InfoHint` is used. Presentation edits must not rename or move those handlers. Run the dashboard test suite (`node --test`) in WSL or CI, not on the Windows CRLF checkout, where 4-6 tests fail for line-ending reasons.

## Findings

| ID | Sev | Finding (evidence) | Planned fix | PR | Status |
| -- | --- | ------------------ | ----------- | -- | ------ |
| G1 | High | Form controls have no accessible names. `DashboardPage.jsx` has 15 `<label>` elements and **0** `htmlFor`, so clicking a label does nothing and screen readers read "edit text". Many inputs relied on `placeholder` alone (analytics searches, contractor form, team-member rows, the review action-point fields, report date fields, Installation trends filters, several selects). **Correction after reading further:** the planned-visit form, actions filters, Installation explorer and Installation tables already had names, so the first count overstated the scope. `components/shared/Field.jsx` already solves this (auto id + label) but is not used here. | Wrap each control in `Field`, or add `aria-label` where a visible label would be noise (search boxes, per-row action fields). Mark required fields. | A | done, verified (desktop, harness) |
| G2 | High | `SidePanel` and `ActionDialog` are `aria-modal="true"` but do not trap Tab: `SidePanel` handles Escape and focus restore only, `ActionDialog` handles Escape and first focus only. Tab walks out into the page behind the overlay. | One small shared focus-trap helper used by both (the shopper `ConfirmDialog` has the pattern). Keep the existing rule that Escape belongs to the top-most modal. | A | done, verified (desktop, harness) |
| G3 | Med | Review detail has two copies of the same editor. The B2B panel is ~100 inline lines in `DashboardPage.jsx` with five nested containers (Card > category box > response box > action box > action row), against §4.2. The Mystery card (`MysteryVisitDetailCard.jsx`) repeats the answer / verbatim / action-point fields. | Flatten to one level (category heading + response rows, no boxes in boxes) and share one action-point editor between both. | B | todo |
| G4 | Med | Review edits are saved one response at a time with "Save Response Edit". Nothing shows a response has unsaved edits, and it is not yet checked what happens to unsaved edits when the panel is closed. | Check `closeSurveyDetails` first. If edits are silently dropped, add a per-response "Unsaved changes" mark and ask before closing. Needs a read of the handler. | B | todo (verify first) |
| G5 | Med | Same field, two names: the shopper app now calls it "Comment" (#66), the dashboard calls it "Verbatim" / "Verbatim notes" (placeholder "Optional verbatim notes..."), and the Mystery survey report has a "Verbatim" column. A reviewer cannot tell they are the same thing. | Dashboard labels on the Mystery side become "Comment" (shopper's words). **Owner decision:** whether the report column and PDF heading change too (backend template, so a functional change). | C | deferred (decision) |
| G6 | Med | Charts: 17 hard-coded hex colours in `DashboardPage.jsx`, 14 in `MysteryAnalyticsSummarySection.jsx`, 11 in the Installation views, instead of semantic tokens (§3.4, §6.2). No axis titles or units on most charts. The CSAT donut has no empty state (the NPS one does) so an empty dataset draws a blank circle. The Question Trend `Select` has no label. Active filter scope is not stated near chart titles. | Colours to a shared token map, scope line under each chart title, axis units, CSAT empty state, label on the question select. | D | todo |
| G7 | Med | **BEHAVIOUR/DATA.** Analytics and Trends have no date filter on any platform, while §5.2 requires one (single day and range) with visible active-filter chips. Only the report builder has dates. | **Owner approved 2026-11-19 if the API supports it. Checked: it does.** `/analytics`, `/analytics/questions`, `/questions/yes-no`, `/account-executives/yes-no-trends` and `/questions/{id}/trend` all take `date_from` / `date_to` and filter on `v.visit_date` (inclusive). Front end only; no backend change. | C | done, verified (desktop, mocked API) |
| G8 | Low | Copy hard-codes question numbers: "Questions 4, 6, 9, and 16" (Yes/No card) and "Questions 4 and 6" (Account Executive chart). If the questionnaire changes this goes wrong silently. | Build the sentence from the data the card already holds. | D | todo |
| G9 | Low | The Question Trend chart exists twice (Analytics, 360 px; Trends, 420 px) with its own select, loading and error states copied. | **Owner decided 2026-11-19: keep it on Trends only.** Remove it from Analytics. | B | done, verified (desktop) |
| G10 | Low | The business/location filter lists use raw `<input type="checkbox">` with 16 px hit areas inside a hover row; hard to tap on a tablet. | Use the existing checkbox style with a full-row label and `min-h` 40 px. | A | done, verified (desktop, harness) |
| G11 | High | **Bug (BEHAVIOUR/DATA).** B2B Trends "Account Executive Yes/No Performance" can show "No account executive yes/no data available" even when data exists. The chart is drawn on `/trends`, but the effect that loads it (`yes-no-trends`, `DashboardPage.jsx` ~1048) returns early unless the path is `/`. Because `App.jsx` mounts a separate keyed `DashboardPage` per route, state does not carry over from Analytics either, so on Trends the request is never made and the chart is **always** empty. (My first note said it depended on visiting Analytics first; that was wrong.) A failed request is also swallowed silently. Found by reading the code on 2026-11-19; **Reproduced 2026-11-19** in a mounted page with a mocked API returning data: zero requests to `yes-no-trends`, chart says no data. The endpoint itself has its own passing backend test; not run against a real database. The endpoint itself is fine (B2B only, approved visits, Q4 and Q6, grouped by the account executive name on each visit). | Load it on `/trends`, and show an error state instead of silently empty. Also state when no approved visit has an account executive name captured. | B | done, verified (desktop, mocked API) |

## Round 2 (not yet read, so no claims)

Planned Visits form and executives, Surveys list and report builder, Actions board, Contractors, Installation analytics/trends/explorer, Mystery Users / Locations / Purposes, User Guide page, the app shell (sidebar and header at small widths), sign-in and "signed out" screens. Counts above suggest G1 and G6 recur there; that is a hypothesis until read.

## Proposed PRs (one at a time, each after the previous merges)

| PR | Items | Notes |
| -- | ----- | ----- |
| A | G1, G2, G10 | Accessibility only. No data or handler changes. Open (this PR). |
| B | G11, G9 | Trends fixes: load the AE chart on Trends (bug), remove the duplicate Question Trend from Analytics. Behaviour change. Open. |
| B2 | G3, G4 | Review detail panels. G4 may touch review-save handlers, so check the protected list first. |
| C | G7 | Date filter on Analytics and Trends (API already supports it). Open, stacked on B. |
| C2 | G5 | Copy; see the G5 note below, waiting on the owner. |
| D | G6, G8 | Charts and copy. |

## Owner decisions

- **G9:** decided, Trends only.
- **G7:** approved, API supports it.
- **G5:** decided 2026-11-19: the label is **"Verbatim / Comments"** on every platform (shopper app, B2B survey, dashboard review screens, report column and PDF heading).
- Round 2 pages are read after PRs A and B, unless the owner asks sooner.

## Verification plan

Same technique as the shopper audit: a throwaway mounted harness with a mocked API, desktop width, DOM checks for names, focus order and Tab trapping, then the dashboard test suite and build. Phone width is skipped for now at the owner's request. Items that need a real backend are listed as not verified in each PR.

## Progress log

| Date | Entry |
| ---- | ----- |
| 2026-11-19 | Plan written (read-only). 10 findings, 3 need owner decisions, Round 2 pages not yet read. |
| 2026-11-19 | Owner decisions: G9 keep Question Trend on Trends only; G7 date filter approved if the API supports it (it does). Asked to check the empty B2B Trends account-executive chart: found G11. PR A built (G1, G2, G10): labels/names on controls in DashboardPage and the Mystery components, shared `useFocusTrap` for `SidePanel` and `ActionDialog` (also labels linked in `ActionDialog`), 40 px checkbox rows. Browser-checked in a mounted harness: Tab/Shift+Tab wrap in the panel and in a dialog opened over it, only the top dialog traps, Escape closes only the dialog. Dashboard frontend test run: no new failures against main (the same 6 fail on this Windows checkout before and after). Build ok. Not checked: the real pages with a backend, screen-reader output, phone width. |
| 2026-11-19 | #70 and #71 merged. PR B built (G11, G9). G11 reproduced then fixed: the account executive chart now loads on Trends, shows loading, an error state and a clearer empty message. G9: Question Trend removed from Analytics; Category Breakdown now full width. Verified in a mounted page: before the fix 0 requests and "No account executive yes/no data available"; after, both executives drawn; a 500 shows "Account executive results unavailable"; Analytics has no Question Trend. Dashboard tests: same 6 failures as main. Owner decision G5: label standardised as "Verbatim / Comments" on every platform (PR C2). G7 approved, PR C. |
| 2026-11-19 | PR C built (G7, **BEHAVIOUR/DATA**): "Filter by date" on Analytics and Trends for B2B and Mystery Shopper (Installation keeps its own month/date filters, its endpoints take none). From/To inclusive on visit date, same day = one day, reversed range is not sent and warns, kept for the browser session and shared by both pages. `date_from`/`date_to` added to the five analytics requests (core metrics, yes/no, questions, trend, account executive yes/no). Dashboard test harness gets two default names and one new test asserts the params are sent and omitted when empty. Verified in a mounted page: all five requests carry the range, none without, invalid range sends no dates, persisted range applies on Trends. Not verified: against a real backend (numbers actually narrowing), the report builder date fields (unchanged). |
