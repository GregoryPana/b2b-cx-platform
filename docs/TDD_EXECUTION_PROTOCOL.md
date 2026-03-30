# TDD Execution Protocol (Local + Staging-Like)

This protocol is mandatory for every code change.

## 1) Pre-Change

1. Update `TODO.md` with planned work items.
2. Update `TRACKLIST.md` with a new session block and goals.
3. Identify impacted layers:
   - Database
   - Backend API
   - Frontend(s)
   - Auth/roles

## 2) Controlled Runtime Reset

1. Stop listeners on known ports: `8001`, `5185`, `5176`, `5177`.
2. Ensure DB container is running (`docker-compose.dev.yml`).
3. Start backend with migrations.
4. Start active frontend(s) for test scope.

## 3) Verification Matrix (Must Run)

### Database
- Connectivity succeeds for target DB URL.
- Row counts present for core tables:
  - `users`
  - `businesses`
  - `questions`
  - `visits`
  - `responses` and/or `b2b_visit_responses`

### Backend
- `GET /health` returns HTTP 200.
- Impacted endpoints return HTTP 200 (or expected 401/403 in auth checks).

### Frontend
- Dashboard app loads.
- Impacted views render data without console runtime errors.
- Network calls for impacted features return expected payloads.

## 4) Output Logging Rules

For each run:

1. Save verbatim command outputs where possible.
2. If output is too long, summarize key lines and mark as summarized.
3. Update `TRACKLIST.md` with:
   - Commands run
   - Results
   - Pass/fail per check
4. Update `TODO.md` statuses (`pending`, `in_progress`, `completed`, `blocked`).

## 5) Required Manual Checks (UI)

1. Login flow succeeds (staging auth or approved bypass mode).
2. Analytics cards show data.
3. Review queue actions work (approve/reject where applicable).
4. Charts render with no container size warnings.

## 6) Definition of Done

A change is done only when:

1. Code changes complete.
2. Verification matrix passes.
3. `TODO.md` and `TRACKLIST.md` are updated.
4. Known issues (if any) are explicitly listed with mitigation.
