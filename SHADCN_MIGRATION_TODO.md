# Shadcn Migration Todo

## Objective
Migrate dashboard and survey frontends to a clean, consistent shadcn-based component system with responsive UX patterns.

## Phase 1 - Foundation
- [x] Create migration plan and checklist
- [x] Add shared shadcn-style primitives for dashboard (`button`, `input`, `select`, `card`, `badge`, `table`, `separator`)
- [x] Add shared shadcn-style primitives for survey (`button`, `input`, `select`)
- [x] Add remaining optional primitives (`tabs`, `radio-group`, `checkbox`, `textarea`) where they improve UX without over-engineering

## Phase 2 - Dashboard Refactor
- [x] Replace platform selector controls with shadcn primitives
- [x] Replace analytics controls with shadcn primitives
- [x] Replace businesses + survey results tables with shadcn table primitives
- [x] Replace top nav tabs with shadcn tabs pattern
- [x] Add sonner toast feedback for user actions

## Phase 3 - Survey Refactor
- [x] Replace identity + top-level controls with shadcn form controls
- [x] Replace visit creation forms with shadcn form controls
- [x] Replace category jump nav controls with shadcn buttons/scroll area patterns
- [x] Replace question cards, yes/no, ASN, and score inputs with shadcn primitives
- [x] Replace action-card controls with shadcn inputs/select/button groups

## Phase 4 - UX Polish + Consistency
- [x] Normalize spacing/radius/typography tokens across both frontends
- [x] Ensure no clipping/overlap on desktop/tablet/mobile
- [x] Ensure semantic color mapping is consistent for status and threshold states
- [x] Validate interaction affordances (hover, focus, selected, disabled)

## Phase 5 - Verification
- [x] Build dashboard frontend
- [x] Build survey frontend
- [x] Spot-check analytics workflows, businesses workflows, and survey flow end-to-end

## Progress Notes
- Iteration 1 focus: introduce UI primitives and migrate high-impact surfaces first.
- Iteration 2 focus: complete form/control migration to shadcn primitives across dashboard and survey.
- Iteration 3 focus: finalize responsive spacing/alignment polish, semantic status colors, and sonner feedback.
- Verification checks: dashboard build, survey build, raw-control scan (`button/input/select/textarea`), and end-to-end flow spot-check across analytics/business/survey views.
