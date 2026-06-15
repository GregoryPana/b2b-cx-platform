# Hermes Update Pack — Report Format Upgrade & Analytics Enhancements

**Date**: 2026-06-15 | **Branch**: `main` | **Base commit**: `3133dd2` | **Status**: Complete, uncommitted (working tree changes)

---

## 1. Project

- **Project name**: CX B2B Platform (Gemini Antigravity Scratch)
- **Local path**: `c:\Users\gpanagary\.gemini\antigravity\scratch\cx-b2b-platform`
- **Repo**: `git@github.com:GregoryPana/b2b-cx-platform.git`
- **Branch**: `main`
- **Working tree status**: Changes made but not yet committed — see Section 3 for full file list

---

## 2. Task Summary

**Requested**: Apply professional report formatting (colour-coded scores, dark header, scoring guide, plain-English language) to all three platform report types (Mystery Shopper, B2B, Installation). Fix Q2017/Q2018 display bug in analytics. Add staff-on-duty KPI breakdown chart to mystery shopper analytics. Standardise visit detail card colour display across platforms.

**Completed**: ✅ All tasks complete. Reports across all three platforms now share a unified professional format. Analytics fixes applied. No breaking changes to existing features.

**Not completed**: None

---

## 3. Files Changed

### `backend/app/api/mystery_shopper.py`

**Change**: Complete rewrite of `render_mystery_report_html()`. Replaced a single giant f-string with a structured build pattern using inner helper functions. `render_mystery_report_pdf()` simplified to a one-liner delegating to `html_to_pdf()`.

**Before**: Plain HTML table with no styling, scores shown as raw numbers, no scoring guide, no visual hierarchy.

**After**:
- Dark navy header (`#0b1f3a`) with report type, scope, generated-by
- "About This Report" 3-item scoring guide (green ≥8, amber 6–7, red ≤5 on 0–10 scale)
- 6 KPI cards with colour backgrounds and plain-English explanations for each metric
- Survey detail block with category descriptions, coloured score badges, Q-number fix
- Visit summary table with coloured average scores and status badges
- CSS as a separate string (not f-string) to avoid brace escaping issues
- Footer with generation timestamp

**Helper functions added** (all inside `render_mystery_report_html`):
- `_score_level(score)` — low/mid/high tier for 0–10 scale
- `_COLORS` dict — canonical hex values per tier
- `_badge(text, color, bg)` — generic styled inline badge
- `_score_badge(score, max_score)` — coloured score/max display
- `_answer_badge(value, answer_text)` — handles Yes/No and numeric answers
- `_status_badge(status)` — Approved/Pending/Rejected colour badges
- `_nps_level`, `_csat_level`, `_avg_score_level` — domain-specific tier helpers
- `_fmt(v)` — safe number formatting
- `_disp_q_num(n)` — strips 2000-prefix from mystery shopper question numbers
- `_kpi_card(title, value, sub, level)` — full coloured KPI card HTML

**PDF**: `render_mystery_report_pdf()` is now:
```python
def render_mystery_report_pdf(payload, generated_by):
    from .pdf_reporter import html_to_pdf
    return html_to_pdf(render_mystery_report_html(payload, generated_by))
```

**Risk**: Low. HTML output only, no data logic changed.

---

### `backend/app/api/visits_dashboard.py`

**Change**: Added `_score_badge()` helper inside `render_report_html()`. Updated category detail blocks and survey detail rows to use it. Added scoring guide legend to HTML template. Improved comparison table row language.

**Helper added**:
```python
def _score_badge(score, score_max, answer_text=None):
    # Returns coloured HTML badge for numeric scores, or green/red Yes/No badges
```

**Colour thresholds (B2B, 0–10 scale)**:
- ≥9 → green (`#22c55e` / `#d1fae5`)
- 7–9 → lime (`#84cc16` / `#ecfccb`)
- 5–7 → amber (`#f59e0b` / `#fef3c7`)
- <5 → red (`#ef4444` / `#fee2e2`)

**Scoring guide added** to HTML template: 4-item grid (Excellent/Good/Needs Attention/Poor) with colour swatch and plain-English description.

**Comparison table** NPS, CSAT, Relationship Score, Competitor Exposure rows now include plain-English sub-descriptions for non-technical readers.

**Risk**: Low. Read-only rendering path, no data logic changed.

---

### `backend/app/api/installation_surveys.py`

**Change**: Added `_install_score_badge()` helper inside `render_installation_report_html()`. Updated all question rows, category rows to use it. Added dark header and 3-item scoring guide. Replaced entire `render_installation_report_pdf()` (ReportLab, ~175 lines) with a Playwright one-liner.

**Helper added**:
```python
def _install_score_badge(score, score_max=5):
    # Uses get_installation_metric_grade() for colours; returns styled HTML badge
```

**Colour thresholds (Installation, 1–5 scale)**:
- 4–5 → green (Excellent)
- 3 → amber (Satisfactory)
- 1–2 → red (Poor / Needs immediate attention)

**Scoring guide added**: 3-box legend (Excellent 4–5, Satisfactory 3, Poor 1–2) with colour borders and plain-English labels.

**Dark header**: `#0b1f3a` navy header matching mystery shopper report style.

**Question rows**: Redesigned to show Q-number in small grey label + question text on separate line + badge in Score column + scoring range in Range column.

**Category rows**: Now use `_install_score_badge()` instead of plain coloured text.

**PDF replacement**:
```python
def render_installation_report_pdf(payload, generated_by):
    from .pdf_reporter import html_to_pdf
    return html_to_pdf(render_installation_report_html(payload, generated_by))
```

**Why replace ReportLab**: The ReportLab PDF had no colour coding, no dark header, and no scoring guide — completely inconsistent with the HTML preview. The Playwright path renders the exact same HTML so the PDF is pixel-faithful to the preview.

**Risk**: Low-medium. ReportLab is fully removed; if `pdf_reporter.html_to_pdf` (Playwright) is unavailable the endpoint will error. Playwright is already a confirmed dependency (used by mystery shopper and B2B PDF endpoints).

---

### `backend/app/routers/analytics.py`

**Change**: Added `mystery_staff_rows` query to the analytics aggregate endpoint. Returns per-staff-member visit count and CSAT average. Added `staff_breakdown` key to the `mystery_shopper` dict in the response.

**New query** (runs only when `has_mystery_assessments` is True):
```sql
SELECT
    COALESCE(msa.staff_on_duty, 'Unknown') AS staff_name,
    COUNT(DISTINCT v.id) AS visits,
    AVG(CASE WHEN {ms_csat_filter} THEN r.score END)::float AS csat_average
FROM visits v
LEFT JOIN mystery_shopper_assessments msa ON msa.visit_id = v.id
LEFT JOIN {response_table} r ON r.visit_id = v.id
LEFT JOIN questions q ON q.id = r.question_id
WHERE v.status = 'Approved'
{where_extra}
GROUP BY COALESCE(msa.staff_on_duty, 'Unknown')
ORDER BY csat_average DESC NULLS LAST, visits DESC
LIMIT 15
```

**Risk**: Low. Read-only query. Falls back to `[]` if mystery assessments table is absent.

---

### `frontend/dashboard-blueprint/src/pages/DashboardPage.jsx`

**Changes** (multiple, non-breaking):

1. **Q-number fix**: `categoryQuestions` useMemo now computes `display_number`:
   ```javascript
   display_number: rawNum > 1000 ? rawNum - 2000 : rawNum
   ```
   Accordion renders `Q{question.display_number}` — mystery shopper Q2017 now displays as Q17.

2. **Score badge components** added at module level (after `normalizeTeamMembers()`):
   - `surveyScoreColor(score, max)` — returns `"red"/"amber"/"green"` based on scale
   - `SurveyScoreBadge({ score, max })` — renders coloured score/max badge
   - `SurveyYesNoBadge({ value })` — green Yes / red No
   - `SurveyResponseDisplay({ response })` — dispatcher: picks badge type from response data

3. **B2B review section** (~line 3166): answer display replaced from rose text to `<SurveyResponseDisplay response={response} />`.

4. **Survey detail section** (~line 4051): question/answer row redesigned — question text + display_number on left, `SurveyResponseDisplay` on right.

5. **Mystery report metric card titles** updated to plain English:
   - "NPS — Would Recommend?"
   - "CSAT — Satisfaction (0–10)"
   - "Overall Experience Score"
   - "Service Quality Score"

6. **Report type option labels** updated to plain English: "Single Visit Detail", "Lifetime Overview", "Date Range" with non-technical descriptions.

**Risk**: Low. All changes are rendering-only. No data fetching or state logic changed.

---

### `frontend/dashboard-blueprint/src/features/mystery-shopper/components/MysteryAnalyticsSummarySection.jsx`

**Change**: Added "Staff on Duty — KPI" horizontal bar chart section (Row 6, before the per-question chart Row 7).

**New data source**: `ms.staff_breakdown || []` from the analytics API response.

**New component**: `StaffTooltip` — shows staff name, CSAT value, visit count on hover.

**Chart behaviour**:
- Horizontal bar chart (Recharts `BarChart` with `layout="vertical"`)
- Bar fill: green if CSAT ≥7, amber if ≥5, red if <5
- Right-side labels showing CSAT value
- Falls back gracefully if `staff_breakdown` is empty (renders nothing)

**Risk**: Low. Additive UI only. Existing charts and data unaffected.

---

### `frontend/dashboard-blueprint/src/features/mystery-shopper/components/MysteryReportsSection.jsx`

**Change**: UI copy improvements throughout. All labels, descriptions, and subtext rewritten for non-technical users.

**Specific changes**:
- Card title: "Survey Reports" → "Mystery Shopper Reports"
- Card description: clearer explanation of the three actions (preview/download/email)
- Step 1 subtext: plain description of what each report type shows
- Step 2 subtext: different text per report type (lifetime/survey/date range)
- Lifetime info box: reworded for management audience
- Date range explainer: "Single day" vs "Date range" explained in plain terms
- Ineligible surveys block: "Some visits cannot be included in a report yet" with explanation of why
- Preview footnote: explains what the colours mean

**Risk**: None. Text-only changes.

---

## 4. Colour Coding Reference (Consistent Across All Platforms)

| Platform | Scale | Green (Good) | Amber (Watch) | Red (Poor) |
|---|---|---|---|---|
| B2B | 0–10 | ≥9 (Excellent), ≥7 (Good) | 5–7 | <5 |
| Mystery Shopper | 0–10 | ≥8 | 6–7 | ≤5 |
| Mystery Shopper | 0–5 | ≥4 | 3 | ≤2 |
| Installation | 1–5 | 4–5 | 3 | 1–2 |

NPS and CSAT use their own thresholds inside `getTrafficLightMetric()` on the frontend.

---

## 5. Tests / Verification

- **Tests run**: None added this session (rendering functions only; existing test suite unchanged)
- **Manual checks**:
  - Mystery shopper category breakdown confirmed Q17 (not Q2017) after Vite restart
  - Staff chart visible in analytics summary with correct CSAT colour coding
  - B2B visit detail card shows colour badges instead of plain text
  - Mystery shopper report HTML preview renders dark header, scoring guide, KPI cards with colour
  - Installation report HTML preview renders dark header, scoring guide, colour badges on question rows
- **Known gaps**: No automated snapshot or regression tests for HTML report output. Playwright PDF not end-to-end tested in this session (tested in earlier PDF handoff session).

---

## 6. Deployment Impact

- **Deployment performed**: No (local dev only)
- **Deployment needed**: Yes — changes are uncommitted; must be committed and deployed to staging/production
- **Staging impact**: Purely visual/UX improvements; no schema or API signature changes
- **Production impact**: Same — backward compatible
- **CI/CD impact**: None
- **Rollback**: Safe to revert individual files; all changes are in rendering functions only

---

## 7. Auth / Security / Data Impact

- **Auth impact**: None
- **Database/schema impact**: None (analytics query is read-only)
- **Migration**: None required
- **Secrets/env**: None new

---

## 8. Decisions Made

**2026-06-15** | Replace Installation PDF (ReportLab) with Playwright `html_to_pdf()` | ReportLab PDF had no colour coding or dark header — completely inconsistent with the HTML preview. Playwright renders the exact HTML faithfully. ReportLab was already inconsistent with the mystery shopper and B2B PDF paths which both use Playwright. | Continue ReportLab with manual colour-code reconstruction | Gregory Panagary

**2026-06-15** | Use `_disp_q_num()` helper to strip 2000-prefix from mystery shopper question numbers in reports | Question IDs in DB are 2001–2027 for mystery shopper; report was showing "Q2017" instead of "Q17". Fix applied in both frontend (display_number computed field) and backend report renderer. | Change raw question_id values in DB | Gregory Panagary

**2026-06-15** | Build score badge components at module level in DashboardPage.jsx rather than inline | Multiple sections (B2B review, survey detail, mystery shopper detail) all need the same badge logic; centralising avoids duplication | Inline per section | Gregory Panagary

---

## 9. What's Still Pending

### From This Workstream
- **Commit all changes to main** — working tree is dirty; changes are tested but not committed
- **Staging deploy** — to propagate report improvements to staging for stakeholder review

### From Prior Workstream (Mystery Shopper 2FA)
See `HERMES_UPDATE_PACK.md` and `docs/operations/HERMES_MYSTERY_SHOPPER_2FA_PHASE2.md` for full detail.

- **Phase 3a**: Anchor-based guide navigation (SurveyGuide.jsx + SurveyWorkspace.jsx) — 2–3 hours, low-medium effort
- **Phase 3b**: Production deployment verification (DevOps) — must complete before DMZ goes live
- **Merge `feature/mystery-public-2fa-lifecycle` → main** — ready after Phase 3a

---

## 10. Suggested Hermes Knowledge Graph Updates

- **Report generation**: All three platform HTML/PDF reports now share a consistent professional format. Mystery shopper and B2B PDFs use `html_to_pdf()` (Playwright). Installation PDF now also uses Playwright — ReportLab is no longer used anywhere.
- **Score colour logic**: Colour thresholds differ slightly per platform (see Section 4). Backend uses `get_b2b_metric_grade()` / `get_installation_metric_grade()` / inline thresholds for mystery shopper. Frontend uses `getTrafficLightMetric()` from `lib/utils`.
- **Q-number offset**: Mystery shopper question numbers in the DB are `2001–2027`. When displaying to users, subtract 2000 (or use `rawNum > 1000 ? rawNum - 2000 : rawNum`). This is applied in DashboardPage.jsx and in `_disp_q_num()` inside `mystery_shopper.py`.
- **Staff breakdown analytics**: Analytics endpoint now returns `mystery_shopper.staff_breakdown` (staff name, visit count, CSAT average). Populated from `mystery_shopper_assessments.staff_on_duty` column.
