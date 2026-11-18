# Shopper app in-survey audit (November 2026)

Scope: the screens a mystery shopper uses after signing in: **Draft Visits**, **Survey** (visit details, questions, submit), the scoring key and the **User Guide**. Sign-in and enrollment were redone in #56 and are out of scope.

Code: `frontend/mystery-shopper/src/SurveyWorkspace.jsx` (all in-survey screens), `SurveyGuide.jsx` (scoring key + guide), `App.jsx` (auth shell only).
Rules applied: `docs/design/DESIGN_SYSTEM.md` (§4.2 no nested cards, §4.11 Disclosure, §5.3 sticky, §5.4 one-section flow, §7.2 result banners) and the lessons in Appendix A.3.

Status key: `todo` · `doing` · `done` · `deferred` (needs a decision or is deliberately left) · `verified` = checked in a real browser.

## Protected code (do not edit without owner approval)

`saveContract.test.js` slices these out of `SurveyWorkspace.jsx` by text and runs them: `hasMeaningfulAnswer`, `loadVisitDetail`, `selectDraftVisit`, `readSaved`, `persistAnswer`, `saveQuestion`, `submitVisitFn` (and the `set*` calls inside them). All work below is presentation, state-derived rendering and copy. After each PR the contract test and the diff of those handlers must show no change.

## Findings

| ID | Sev | Finding (evidence) | Planned fix | PR | Status |
| -- | --- | ------------------ | ----------- | -- | ------ |
| F1 | High | Every result message (saved, errors, "Required unanswered: Q3, Q7…") clears after 3.2 s and renders at the top of `<main>`, while Save/Submit are at the bottom. On a phone the shopper never sees it, and long error lists cannot be read in time. Colours are hard-coded amber/emerald. | Errors persist until dismissed or the next action; success clears after a longer delay. `role="alert"`/`status`, scroll into view, semantic tokens, dismiss button (§7.2). | A | done, verified (desktop) |
| F2 | High | After Submit the status becomes Pending but the questions stay editable with live Save buttons, and nothing tells the shopper it is done once the 3.2 s message clears. The guide says the visit is "locked for your edits". | Persistent "Submitted for review" result (report date, what happens next, buttons to Draft Visits / start another). Questions read-only when status is not Draft. | A | done, verified (desktop) |
| F3 | High | Draft Visits shows only `visit_date === today` and `> today`; drafts dated earlier are in neither list, so an overdue draft cannot be resumed. "Today" is computed from `toISOString()` (UTC), which is yesterday for the first 4 hours of the day in Seychelles (UTC+4). | Add an Overdue group; compute the date in local time. | A | done, verified (desktop) |
| F4 | High | Answer buttons use `option-grid`, `option-pill`, `score-pill`, which are defined nowhere in the app's CSS. Score 0-10 buttons have no gap or grid. Yes/No and choices use `role="radiogroup"` on plain buttons without `role="radio"` or `aria-pressed`, so screen readers get a broken control. | Real layout classes (wrapping flex/grid with gap, 44 px touch targets on phones), `aria-pressed` on every option, `role="group"`. | A | done, verified (desktop) |
| F5 | Med | The scoring key card (about 250 px) is always open above the questions in the Survey tab, and is shown in full again on the start screen and in the guide. | One Disclosure: open before a visit exists, closed once questions are showing, count/state in `meta`. | B | done, verified (desktop) |
| F6 | Med | Visit-details labels are not tied to their inputs (no `htmlFor`/`id`), required fields are not marked, the free-text answer box has no accessible name. | Associate labels, mark required, `aria-label` on answers. | B | done, verified (desktop) |
| F7 | Med | Start screen: info banner "Fill out the visit header…" duplicates what is already visible; start/resume tiles are `rounded-xl` with hover translate; empty lists are bare text. | Drop the banner, tiles at `rounded-lg`, bordered empty states, Today open / Upcoming and Overdue per §4.11. | B | done, verified (desktop) |
| F8 | Med | If questions, locations or purposes fail to load, the only signal is the 3.2 s message; the Survey tab then reads "Create the visit above" with an empty location list. | Persistent inline load-failure state with a Try again button. | B | done, verified (desktop) |
| F9 | Low | No `h1` on any tab; the drawer "Jump to section" list duplicates the phone section chips; user name appears in both header and drawer. | One `h1` per tab at the standard size; remove the duplicate drawer list. | B | done, verified (desktop) |
| F10 | Low | Guide copy has drifted: says "Create / Load Visit" (button is "Create visit and start") and tells shoppers to "use the comment/verbatim boxes", which the UI does not render. | Fix button name; verbatim wording needs a decision (D2). Guide sections as Disclosures while keeping anchor links working. | C | todo |

## Deferred / needs a decision

| ID | Item | Why it is not in the plan above |
| -- | ---- | -------------------------------- |
| D1 | `window.confirm` in `saveQuestion` (overwrite) and `submitVisitFn` (overwrite, optional unanswered) | **Approved 2026-11-18**: owner agreed the contract tests may be rewritten. Its own PR (D) after B, because it changes the protected handlers and `saveContract.test.js`. |
| D2 | Verbatim / comment box | **Resolved 2026-11-18**: the verbatim box is a reviewer field in the dashboard review screens (`MysteryVisitDetailCard.jsx`, `DashboardPage.jsx`); the shopper app saves any existing verbatim through unchanged. Nothing to build. The guide wrongly tells shoppers to use it, so the wording is fixed in PR C (F10). |
| D3 | Autosave | Rejected earlier (conflicts with the overwrite-confirm and readback design). Not revisited. |
| D4 | Phone-width verification | Owner said not needed for now. Everything shipped here is therefore **not** checked at phone width. |

## PRs

| PR | Contents | Branch | Status |
| -- | -------- | ------ | ------ |
| A | F1, F2, F3, F4 (outcome, locked state, overdue drafts, answer controls) + this plan | `feature/shopper-in-survey-audit` | merged (#64) |
| B | F5-F9 (layout, labels, load failure, titles) | `feature/shopper-in-survey-layout` | PR open, awaiting merge |
| C | F10 (guide copy and Disclosures) | tbd | todo (guide `h1` already done in B) |
| D | D1: save/submit confirmations move from `window.confirm` to dialogs; rewrite `saveContract.test.js` | tbd | approved, todo |

## Progress log

| Date | What happened |
| ---- | ------------- |
| 2026-11-18 | Read `SurveyWorkspace.jsx`, `SurveyGuide.jsx`, `App.jsx`, `index.css`, `saveContract.test.js`. Findings F1-F10 recorded; D1-D4 deferred. Cleaned out June PDF experiments (scratch files, unused reportlab script) and 6 merged local branches. |
| 2026-11-18 | PR A built. Browser-verified at desktop width with a throwaway mocked-API harness (removed before commit): overdue/today/upcoming grouping; score/yes-no/choice buttons wrap with gaps and toggle `aria-pressed`; save verifies; submit scrolls from the page bottom to a persistent "Submitted for review" card, disables every answer and removes Submit; "Start another survey" resets to a blank header; errors persist past 7 s, scroll into view and dismiss; a rejected save shows the server message. No console errors. Found and fixed during testing: the submitted card was off-screen after Submit, so it now scrolls into view. Contract test (32 cases) and shopper build pass; protected handler bodies untouched (only the `disabled` flag and a prop at call sites changed). Not checked: phone width (D4), real backend, the Pending-then-returned-as-Draft round trip. |
| 2026-11-18 | #64 merged. PR B built (F5-F9) on top of it. Browser-verified at desktop width with the throwaway harness (removed): start screen is one h1 + two tiles with a closed scoring key and no duplicate draft list; Draft visits shows Overdue and Today cards plus a collapsed "Upcoming (n visits)"; the new-visit form has every label linked to its control (clicking a label focuses it), required markers, and "All fields are required"; the scoring key is open before a visit and a closed one-line row inside it; questionnaire-load failure and "no active locations" show a persistent callout with Try again, Create is disabled until the questions load, and a successful retry clears the stale error; guide has one h1. Drawer "Jump to section" list and the duplicate header name were removed. 42/42 tests, build passes, protected handlers untouched. Found during testing: a successful retry left the old load error banner up, so retry now clears it. Not checked: phone width (D4), real backend. |
| 2026-11-18 | Owner decisions: D1 approved (tests may be rewritten); D2 resolved (verbatim is reviewer-only). |
