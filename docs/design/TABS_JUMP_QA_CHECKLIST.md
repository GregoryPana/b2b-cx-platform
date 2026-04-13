# Tabs + Jump Nav QA Checklist

Use this checklist to validate visual and interaction parity for:
- Survey frontend (`5176`)
- Mystery Shopper frontend (`5177`)

## Common Pass Criteria
- Tabs use the same shape/radius, spacing, active highlight, hover behavior, and focus ring.
- Tab labels remain readable and do not clip at any tested viewport.
- Jump/category list uses dynamic responsive columns and does not overlap core content.
- Mobile jump navigation opens as bottom sheet and closes cleanly.
- Active jump item uses clear highlighted state.
- Buttons meet touch target minimum (>= 44px area where applicable).

## Viewport Matrix

### 375 x 812 (Mobile)
- Tabs render in 2-column equal-width layout.
- Jump/category panel opens from bottom and overlays with backdrop.
- Jump/category buttons stack to single column when space is tight.
- No horizontal overflow from tab/jump controls.
- Main content remains scrollable and visible after opening/closing jump nav.

### 768 x 1024 (Tablet)
- Tabs remain equal-width and readable.
- Jump/category nav appears as slide-in side panel (not covering critical content permanently).
- Opening jump nav shifts content correctly only where expected.
- Closing jump nav restores normal content layout.

### 1024 x 768 (Small Desktop)
- Tabs have consistent spacing and visual hierarchy across both apps.
- Jump/category nav is visible and does not overlap section bodies.
- Active section remains clearly highlighted while scrolling.

### 1440 x 900 (Desktop)
- Tabs and page selectors are consistent across 5176 and 5177.
- Jump/category nav has consistent position, card treatment, and spacing.
- Content area alignment and margins are stable (no unintended left overlap).

## Interaction Checks

### Tabs
- Default state: muted text on dark glass background.
- Hover: subtle elevation/color shift.
- Active: blue gradient highlight with high contrast text.
- Keyboard: visible focus ring and tab navigation works.

### Jump/Category Items
- Default: secondary text on raised glass tile.
- Hover: slight contrast bump.
- Active: highlighted state with strong contrast.
- Click scroll: section aligns correctly with header offset and does not hide title.

## Regression Checks
- No white/light legacy tab backgrounds appear.
- No overlap between jump nav and forms/cards.
- No clipping/cutoff in bottom safe area on mobile.
- Animation remains subtle and respects reduced-motion settings.

## Build Verification Commands
- `cd frontend/survey && npm run build`
- `cd frontend/mystery-shopper && npm run build`
- `cd frontend/dashboard && npm run build`

## Current Implementation References
- Shared interactions: `frontend/shared-ui.css`
- Shared theme/colors: `frontend/glass-theme.css`
- Survey jump nav layout: `frontend/survey/src/index.css`
- Mystery shopper jump nav layout: `frontend/mystery-shopper/src/index.css`
- Shared tabs primitive:
  - `frontend/survey/src/components/ui/tabs.jsx`
  - `frontend/mystery-shopper/src/components/ui/tabs.jsx`
  - `frontend/dashboard/src/components/ui/tabs.jsx`
