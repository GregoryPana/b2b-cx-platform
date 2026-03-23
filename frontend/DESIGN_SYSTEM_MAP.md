# Design System Map

This document maps `claude design.md` sections to implemented files/classes in this repo.

## Quick Start

### 1) Change Theme Colors (Single Source)
- Edit `frontend/glass-theme.css`.
- Update token values in `:root` (text, surfaces, accent, semantic colors).
- Avoid hard-coded colors in app files; prefer token-based overrides.

### 2) Add/Style Shared UI Behavior
- Edit `frontend/shared-ui.css`.
- Use this file for spacing scale, typography utilities, focus states, loading states, transitions, and responsive helpers.

### 3) Build a New Card/Panel Consistently
- Use existing card surface classes in app markup (`panel`, `card`, `hero`, `planned-card`, etc.).
- Card look is controlled centrally by `frontend/glass-theme.css`.
- Keep cards borderless, raised, and lighter than page background.

### 4) Keep Contrast Compliant
- Text roles:
  - Primary text: `--text-primary`
  - Secondary text: `--text-secondary`
  - Meta/muted text: `--text-tertiary`
- If any component looks low-contrast, fix in `frontend/glass-theme.css` selector groups instead of one-off inline classes.

### 5) Add Interaction States Correctly
- Ensure default/hover/active/focus/disabled exist for interactive controls.
- Focus ring comes from shared system in `frontend/shared-ui.css` (`*:focus-visible`).
- Add `aria-label` to icon-only controls.

### 6) Add Motion/Micro-Interactions
- Use Framer Motion for mount/unmount UI feedback.
- Use GSAP for staggered section entrances.
- Keep motion subtle and respect reduced-motion behavior already defined in shared CSS.

### 7) Verify Before Merge
- Run:
  - `npm run build` in `frontend/dashboard`
  - `npm run build` in `frontend/survey`
  - `npm run build` in `frontend/mystery-shopper`
- If styles drift between apps, adjust shared files first (`frontend/shared-ui.css`, `frontend/glass-theme.css`).

## 1) Color System Analysis & Refined Palette
- **Implemented in:** `frontend/glass-theme.css`
- **Key tokens:** `--text-primary`, `--text-secondary`, `--text-tertiary`, `--accent`, `--accent-strong`, `--panel`, `--panel-strong`, `--panel-raised`, `--border-subtle`, semantic tokens (`--success-*`, `--warning-*`, `--danger-*`)
- **Notes:** Dark blue glass palette applied globally to all active frontends.

## 2) Layout System & Grid Architecture
- **Implemented in:** existing app-specific layouts + shared surface consistency
- **Related selectors:** `.page`, `.app-shell`, `.app-topbar`, `.top-nav`, `.analytics-top-grid`, `.analytics-main-grid`
- **Notes:** Kept current IA/layouts, standardized spacing/visual language rather than hard replacing all structures.

## 3) Spacing System (8px base)
- **Implemented in:** `frontend/shared-ui.css`
- **Tokens:** `--space-1 ... --space-24`, `--card-padding`, `--card-gap`, `--section-gap`, `--page-padding`

## 4) Typography System
- **Implemented in:** `frontend/shared-ui.css` + `frontend/glass-theme.css`
- **Tokens/classes:** `--font-primary`, `--font-mono`, `.text-xs ... .text-3xl`, `.heading-page`, `.heading-section`, `.heading-card`, `.label`, `.caption`, `.code`
- **Contrast hierarchy:** enforced in `frontend/glass-theme.css` for headings/body/meta.

## 5) Component Library

### 5.1 Glass Cards
- **Implemented in:** `frontend/glass-theme.css`
- **Selectors:** `.panel`, `.card`, `.hero`, `.planned-card`, `.question-card`, `.question-group`, `.overview-stat-card`, `.targeted-controls`, `.question-trend-panel`
- **Behavior:** raised, lighter-than-bg, borderless, subtle shadow, reduced blur.

### 5.2 Buttons
- **Implemented in:** app button components + shared interaction rules in `frontend/shared-ui.css` and theme variants in `frontend/glass-theme.css`
- **Selectors:** `.actions button`, `.table-actions button`, `.ghost`, `.filter-chip-clear`, `.table-action-btn`, active/hover states for tabs/nav/category buttons

### 5.3 Inputs
- **Implemented in:** `frontend/glass-theme.css` (visual) + `frontend/shared-ui.css` (interaction)
- **Selectors:** `input`, `select`, `textarea`, `::placeholder`, `:disabled`, `:focus-visible`

### 5.4 Form Groups
- **Implemented in:** existing form markup with normalized label/caption style via shared typography and contrast rules.

## 6) Navigation Components
- **Implemented in:** existing app nav structures with unified styling
- **Selectors:** `.nav-tabs button`, `.tabs button`, `.jump-nav-item`, `.nav-button`, `.top-nav`, `.app-topbar`, `.workspace-card`, `.desktop-jump-nav`, `nav.fixed`

## 7) Data Display Components

### 7.1 Table
- **Implemented in:** `frontend/glass-theme.css` + app table components
- **Selectors:** `.data-table thead th`, `.data-table tbody td`, `.question-drilldown-table`, hover rows and text contrast

### 7.2 KPI / Stat Cards
- **Implemented in:** `frontend/glass-theme.css`
- **Selectors:** `.overview-stat-card`, state variants (`.total`, `.completed`, `.pending`, `.draft`)

### 7.3 Chart Container
- **Implemented in:** analytics/chart wrappers in theme selectors
- **Selectors:** `.analytics-view .panel`, `.analytics-main-grid article`, `.trend-line-wrap`, `.question-trend-panel`

## 8) Modal & Overlay Components
- **Current status:** partially covered by token/interaction system; project uses existing UI primitives. No global modal refactor applied yet.

## 9) Animation & Micro-interactions
- **Implemented in code:**
  - `frontend/dashboard/src/App.jsx`
  - `frontend/survey/src/App.jsx`
  - `frontend/mystery-shopper/src/App.jsx`
- **Libraries:** `framer-motion`, `gsap`
- **Use:** page/surface entrance transitions, animated notices/toasts/messages, subtle motion feedback.

## 10) Responsive Design Guidelines
- **Implemented in:** existing app media queries + shared utility hooks
- **Shared utilities:** `.hide-mobile`, `.show-mobile` in `frontend/shared-ui.css`
- **Notes:** existing frontends already had extensive responsive logic; shared system aligns styles.

## 11) Accessibility Requirements
- **Implemented in:** `frontend/shared-ui.css` + component updates
- **Delivered:** focus-visible system, reduced-motion support, keyboard helper selector, improved text contrast mapping, explicit labels for icon-like controls updated in app code.

## 12) Icon System
- **Implemented in:** existing Lucide usage + shared icon utility classes
- **Selectors:** `.icon`, `.icon--sm`, `.icon--lg`, `.icon--xl`

## 13) Analytics Dashboard Specific Components
- **Implemented in:** `frontend/dashboard/src/index.css` + `frontend/glass-theme.css`
- **Areas covered:** analytics cards, filter/selection surfaces, drilldown table wrappers, trend panels, KPI cards.

## 14) Performance Optimization
- **Implemented in:** `frontend/shared-ui.css`
- **Items:** `contain` on card/surface classes, reduced-motion mode, transition scoping.

## 15) Implementation Checklist (Guide Phase Mapping)
- **Foundation:** complete (tokens, typography, spacing, breakpoints/utilities)
- **Core components:** complete for active frontends
- **Data components:** complete for current analytics/table/card patterns
- **Polish:** complete (animations, interactions, accessibility baseline)

## 16) Complete Dashboard Example
- **Adapted to stack:** React components + existing app structure (not literal HTML copy).

## 17) Final Design Principles Summary
- **Applied:** token-first, consistency, glass hierarchy, spacing rhythm, state coverage, accessibility baseline.

## 18) Handoff Workflow (Audit → Replace → Enhance → Validate → Document)
- **Completed process:**
  - Audit: performed across all active frontends
  - Replace: centralized shared tokens/styles
  - Enhance: animations + micro-interactions
  - Validate: production builds run on active frontends
  - Document: this mapping file

---

## Verification Status
- `frontend/dashboard`: build passes
- `frontend/survey`: build passes
- `frontend/mystery-shopper`: build passes
- `frontend-unified`: build currently blocked by local `esbuild` platform mismatch in existing environment
