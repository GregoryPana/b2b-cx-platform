# Frontend UI/UX Standards (Cross-Platform)

This document defines the shared design system for all current and future frontend platforms in this repository (B2B, Installation Assessment, B2C/Mystery Shopper, and any future program).

Use this as the source of truth when building new screens so the user experience remains consistent across products.

---

## 1) Design Intent

The frontend style should feel:

- **Professional and operational**, not decorative
- **Minimal and readable**, with clear information hierarchy
- **Consistent across all pages/apps**, even when features differ by platform
- **Data-first**, where visual choices support decision making

The interface should help users quickly answer:

1. What am I looking at?
2. What is good/bad/needs action?
3. What can I do next?

---

## 2) Shared Visual Language

## Typography

- Primary font: `IBM Plex Sans`
- Keep hierarchy simple:
  - Page title > section title > card title > body/caption
- Base text should remain comfortable for long reading:
  - body line-height around `1.6`
- Avoid overly compressed lines and avoid ornamental typography.

## Spacing and rhythm

- Use tokenized spacing scale consistently.
- Prefer stable vertical rhythm over ad-hoc spacing.
- Keep card/panel paddings consistent within each page.

## Shapes and borders

- Radius stays restrained (`8px` to `10px` typical).
- Borders are subtle and thin (generally `1px`).
- Avoid overly rounded pills for major layout blocks.

## Surfaces and depth

- Frosted/translucent panel system is allowed and preferred for this product theme.
- Use blur and transparency with restraint:
  - enough separation from background
  - never reduce text contrast
- Shadows should be light and functional, not dramatic.

---

## 3) Color Principles

Color is semantic first, aesthetic second.

## Core palette behavior

- Use calm slate-blue neutral surfaces/backgrounds for consistency.
- Keep text contrast strong (`--ink` and high-contrast values).
- Do not use large saturated color fields behind dense text.

## Semantic colors (must stay consistent)

- **Good/positive**: green range
- **Warning/needs attention**: amber range
- **Risk/negative**: red range
- **Neutral/info**: slate/gray-blue range

Apply semantic colors consistently in:

- KPI thresholds
- score bands
- status chips
- response distributions

Do not repurpose green/red meanings between pages.

---

## 4) Layout Standards

All platform frontends should follow these patterns:

1. **Header region**
   - clear page context
   - optional top-level actions

2. **Filter/control region**
   - date/platform/business filters near top
   - controls grouped logically

3. **Primary insight region**
   - key metrics and summaries first

4. **Detail region**
   - breakdowns, lists, drill-down tables

5. **Action region**
   - editing/review/submission controls separated from passive analytics

Responsive behavior:

- Desktop: multi-column where scanability improves
- Tablet: reduce columns, preserve grouping
- Mobile: single column, keep section order identical to desktop priority
- No clipping, overflow overlap, or hidden key actions

---

## 5) Analytics UX Standards

Analytics pages must remain understandable at a glance.

## Required behavior

- Date filtering supports:
  - single day (same from/to)
  - range
- Metrics recalculate from active filters.
- Segment/targeted analytics should clearly show the selected scope.

## Required visual conventions

- KPI values are prominent, labels are concise.
- Threshold-driven color is visible but not overpowering.
- Charts always include legends or direct labels.
- If two values are close, use secondary cues (tone, borders, labels) to reduce confusion.

## Recommended ordering

1. Filters
2. Response/volume overview
3. Core KPIs (NPS, CSAT, relationship, exposure)
4. Distribution/breakdown charts
5. Targeted or drill-down analytics

---

## 6) Component Behavior Standards

## Buttons

- Primary actions: solid accent button
- Secondary actions: ghost/outlined button
- Dangerous actions: red semantic styling
- Keep labels explicit (`Save`, `Submit for Review`, `Delete Business`)

## Forms

- Label above input
- Consistent input heights and padding
- Focus states visible and accessible
- Errors shown near source and in summary when needed

## Cards/Panels

- Use consistent internal spacing
- Keep titles short and informative
- Avoid decorative content that does not support decisions

## Navigation aids

- Show contextual jump/quick-nav controls only when useful (e.g., after scroll threshold)
- Avoid overlays that obscure core content

---

## 7) Accessibility and Readability Baseline

Minimum expectations for every new screen:

- Keyboard-navigable controls
- Visible focus states
- Sufficient text contrast
- Clear hover/active/disabled states
- No information conveyed by color alone (add labels/values)

---

## 8) Rules for Future Platforms

When implementing a new platform frontend (e.g., Installation):

1. Reuse existing global tokens (`:root` variables) and component conventions.
2. Follow the same analytics section order and filter behavior patterns.
3. Keep semantic score coloring consistent with current dashboards.
4. Do not introduce a separate visual language unless explicitly approved.
5. Add platform-specific fields/logic without changing shared visual identity.

---

## 9) Definition of Done (UI/UX)

A new frontend module is considered design-complete only if:

- It matches shared typography/spacing/surface tokens.
- It is responsive at desktop/tablet/mobile without overlap or clipping.
- It uses semantic colors consistently for thresholds and statuses.
- Analytics include clear labels/legends and filter scope.
- It preserves the same interaction patterns users already learned in B2B.

---

## 10) AI Agent Build Protocol (Required)

Use this section when an AI agent is writing frontend code.

## A) Mandatory workflow

1. **Read first**:
   - `FRONTEND_UI_UX_STANDARDS.md` (this file)
   - platform-specific planning docs (if present)
2. **Discover existing patterns** in current frontend before adding new styles/components.
3. **Reuse existing tokens/classes** first; only add new ones when clearly needed.
4. **Build mobile + desktop together**, not as separate redesign passes.
5. **Verify visually and functionally** before finishing.

## B) Design decision hierarchy (agent must follow in order)

When choosing UI styles, decide in this order:

1. Existing project tokens (`--ink`, `--muted`, `--panel`, `--border`, `--accent`, spacing/radius)
2. Existing component patterns in dashboard/survey CSS
3. New style only if neither 1 nor 2 can satisfy the requirement

If new style is introduced, it must:

- solve a real UX need,
- be reusable,
- not break cross-platform visual consistency.

## C) Hard constraints for generated code

- Do not introduce a second visual language per platform.
- Do not change semantic color meaning (green/warn/red).
- Do not add decorative-only sections or copy.
- Do not create overlapping/fixed elements that hide core content.
- Do not use unlabeled charts.
- Do not add one-off spacing values repeatedly; prefer tokens.

## D) Required acceptance checks (agent must self-verify)

Before finishing, the agent must verify:

1. **Responsive**: no clipping/overlap at desktop, tablet, mobile.
2. **Hierarchy**: key actions and KPIs are visible without confusion.
3. **Semantics**: thresholds/status colors are applied consistently.
4. **Analytics clarity**: filters affect metrics and charts have labels/legends.
5. **Consistency**: new screens look native to existing dashboard/survey UI.

---

## 11) Agent Prompt Add-on (Copy/Paste)

Use this snippet in AI coding prompts when implementing frontend UI:

```text
Follow FRONTEND_UI_UX_STANDARDS.md strictly.

Implementation rules:
1) Reuse existing frontend design tokens and patterns first.
2) Keep the same visual language as current dashboard/survey.
3) Apply semantic threshold colors consistently (good/warn/bad).
4) Ensure responsive behavior with no overlap/clipping.
5) For analytics, include clear labels/legends and filter-aware metrics.
6) Avoid decorative UI patterns that do not improve decisions.

Before finishing, confirm: desktop/tablet/mobile layout quality, semantic color consistency, and visual parity with existing pages.
```
