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
| G1 | High | Form controls have no accessible names. `DashboardPage.jsx` has 15 `<label>` elements and **0** `htmlFor`, so clicking a label does nothing and screen readers read "edit text". 21 inputs rely on `placeholder` alone (planned-visit form, contractor form, report email/date fields, actions filters, the five review action-point fields, the analytics searches, Installation `type="month"`). `components/shared/Field.jsx` already solves this (auto id + label) but is not used here. | Wrap each control in `Field`, or add `aria-label` where a visible label would be noise (search boxes, per-row action fields). Mark required fields. | A | todo |
| G2 | High | `SidePanel` and `ActionDialog` are `aria-modal="true"` but do not trap Tab: `SidePanel` handles Escape and focus restore only, `ActionDialog` handles Escape and first focus only. Tab walks out into the page behind the overlay. | One small shared focus-trap helper used by both (the shopper `ConfirmDialog` has the pattern). Keep the existing rule that Escape belongs to the top-most modal. | A | todo |
| G3 | Med | Review detail has two copies of the same editor. The B2B panel is ~100 inline lines in `DashboardPage.jsx` with five nested containers (Card > category box > response box > action box > action row), against §4.2. The Mystery card (`MysteryVisitDetailCard.jsx`) repeats the answer / verbatim / action-point fields. | Flatten to one level (category heading + response rows, no boxes in boxes) and share one action-point editor between both. | B | todo |
| G4 | Med | Review edits are saved one response at a time with "Save Response Edit". Nothing shows a response has unsaved edits, and it is not yet checked what happens to unsaved edits when the panel is closed. | Check `closeSurveyDetails` first. If edits are silently dropped, add a per-response "Unsaved changes" mark and ask before closing. Needs a read of the handler. | B | todo (verify first) |
| G5 | Med | Same field, two names: the shopper app now calls it "Comment" (#66), the dashboard calls it "Verbatim" / "Verbatim notes" (placeholder "Optional verbatim notes..."), and the Mystery survey report has a "Verbatim" column. A reviewer cannot tell they are the same thing. | Dashboard labels on the Mystery side become "Comment" (shopper's words). **Owner decision:** whether the report column and PDF heading change too (backend template, so a functional change). | C | deferred (decision) |
| G6 | Med | Charts: 17 hard-coded hex colours in `DashboardPage.jsx`, 14 in `MysteryAnalyticsSummarySection.jsx`, 11 in the Installation views, instead of semantic tokens (§3.4, §6.2). No axis titles or units on most charts. The CSAT donut has no empty state (the NPS one does) so an empty dataset draws a blank circle. The Question Trend `Select` has no label. Active filter scope is not stated near chart titles. | Colours to a shared token map, scope line under each chart title, axis units, CSAT empty state, label on the question select. | D | todo |
| G7 | Med | **BEHAVIOUR/DATA.** Analytics and Trends have no date filter on any platform, while §5.2 requires one (single day and range) with visible active-filter chips. Only the report builder has dates. | Needs a decision: do the analytics endpoints accept a date range (not checked), and which dates define "in range". Do not start until answered. | E | deferred (decision) |
| G8 | Low | Copy hard-codes question numbers: "Questions 4, 6, 9, and 16" (Yes/No card) and "Questions 4 and 6" (Account Executive chart). If the questionnaire changes this goes wrong silently. | Build the sentence from the data the card already holds. | D | todo |
| G9 | Low | The Question Trend chart exists twice (Analytics, 360 px; Trends, 420 px) with its own select, loading and error states copied. | **Owner decision:** keep on Trends only, or keep both. Either way share one component. | D | deferred (decision) |
| G10 | Low | The business/location filter lists use raw `<input type="checkbox">` with 16 px hit areas inside a hover row; hard to tap on a tablet. | Use the existing checkbox style with a full-row label and `min-h` 40 px. | A | todo |

## Round 2 (not yet read, so no claims)

Planned Visits form and executives, Surveys list and report builder, Actions board, Contractors, Installation analytics/trends/explorer, Mystery Users / Locations / Purposes, User Guide page, the app shell (sidebar and header at small widths), sign-in and "signed out" screens. Counts above suggest G1 and G6 recur there; that is a hypothesis until read.

## Proposed PRs (one at a time, each after the previous merges)

| PR | Items | Notes |
| -- | ----- | ----- |
| A | G1, G2, G10 | Accessibility only. No data or handler changes. |
| B | G3, G4 | Review detail panels. G4 may touch review-save handlers, so check the protected list first. |
| C | G5 | Copy; only after the owner decides on the report. |
| D | G6, G8, G9 | Charts and copy. G9 waits for a decision. |
| E | G7 | Only if the owner wants dates; needs backend check. |

## Owner decisions needed

1. **G5:** rename "Verbatim" to "Comment" on the Mystery dashboard only, or also in the report column and PDF?
2. **G9:** keep the Question Trend chart on both pages, or Trends only?
3. **G7:** do you want a date filter on Analytics and Trends? (I will check the API before estimating.)
4. Whether Round 2 should be read before PR A starts, or after PR A and B.

## Verification plan

Same technique as the shopper audit: a throwaway mounted harness with a mocked API, desktop width, DOM checks for names, focus order and Tab trapping, then the dashboard test suite and build. Phone width is skipped for now at the owner's request. Items that need a real backend are listed as not verified in each PR.

## Progress log

| Date | Entry |
| ---- | ----- |
| 2026-11-19 | Plan written (read-only). 10 findings, 3 need owner decisions, Round 2 pages not yet read. |
