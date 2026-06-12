# Claude Code & OpenCode Instructions

## Repository Context

**Project**: CX B2B Platform (Gemini Antigravity Scratch)  
**Tech Stack**: React (Vite), FastAPI, PostgreSQL, Docker  
**Branch Convention**: `feature/*` for feature work, `main` as base  
**Architecture**: Dual-mode authentication (Entra + mystery_public 2FA), dual-deployment in production (internal + DMZ)

---

## Code Navigation & Understanding

### Primary Method: Use CodeGraph First

Both Claude Code and OpenCode should **use the CodeGraph tool as the primary method** for scanning, understanding, and navigating the codebase.

**When to use CodeGraph**:
- Finding files by function/class/symbol name
- Understanding dependencies and imports
- Locating where a specific feature is implemented
- Tracing data flows across components
- Identifying references and call sites
- Getting an overview of module structure

**How to use CodeGraph**:
```
codegraph --search <symbol|pattern>    # Find definitions and references
codegraph --analyze <file|directory>   # Analyze structure and dependencies
codegraph --graph <file>               # Visualize dependency graph
codegraph init                         # Initialize analysis for repo (one-time)
```

### Fallback Method: Read & Grep

Use `Read` tool for files and `Grep` tool for patterns **only when**:
- CodeGraph search returns unclear results
- You need to verify exact code content after CodeGraph narrows it down
- Building confidence before making changes
- Understanding multi-line code blocks or complex logic flows

**Never use Grep as primary discovery** — it's slower and misses context. CodeGraph is smarter.

---

## OpenCode Instructions (WSL-based)

Your OpenCode is accessed through WSL in this repo. When you operate:

1. **Initialize CodeGraph once per session** (if not already done):
   ```bash
   codegraph init
   ```

2. **Always search CodeGraph first**:
   ```bash
   codegraph --search "FunctionName"
   codegraph --search "ComponentName"
   codegraph --analyze backend/app/api/
   ```

3. **Only fall back to conventional methods** if CodeGraph results are ambiguous or you need to verify content

4. **When sharing code findings**, reference CodeGraph results first, then use Read/Grep for confirmation if needed

5. **For performance**: CodeGraph is much faster than grepping large codebases — use it even for quick lookups

---

## Git & Branching

- **Primary branch**: `main`
- **Feature branches**: Always use `feature/*` prefix
- **Commits**: Prefer new commits over amends unless explicitly asked
- **Destructive ops**: Never `git reset --hard`, `git push --force`, or `--no-verify` without explicit user approval
- **Current branch**: Check git status before assuming state

---

## Key Architecture Notes

### Dual Authentication Modes
- **Entra**: Organization sign-in (admin/staff)
- **mystery_public**: Password + TOTP authenticator (external shoppers)

Both modes are compiled into separate build bundles. **Critical**: Build scripts explicitly pin `VITE_AUTH_MODE` to prevent silent mode switches.

### Production Deployment (Two Instances)
- **Internal**: Backend + Dashboard + all surveys (Entra auth)
- **DMZ**: Separate backend + mystery-shopper survey (password+TOTP)
- **Database**: Shared PostgreSQL (or perfectly synced replica) — critical assumption, must be verified in Phase 3b

### Build Output
- `build_release_bundle.sh`: Internal bundle (pins `VITE_AUTH_MODE=entra`)
- `build_mystery_public_bundle.sh`: DMZ bundle (pins `VITE_AUTH_MODE=mystery_public`)

---

## Development Stack (Local)

**Ports**:
- 8011: Backend API
- 8000: Alternate backend
- 5177: Mystery shopper Vite dev server
- 5173: Survey Vite dev server

**Database**: PostgreSQL in Docker (see memory at `local-dev-stack.md` for DATABASE_URL import gotcha)

**Important**: When building frontends, environment variables are read at build-time by Vite. Changes to `.env.local` require a rebuild.

---

## Current Work Status

**Branch**: `feature/mystery-public-2fa-lifecycle` (4 commits, ready to merge)

**Completed**:
- Autofilled shopper name field
- Admin enrollment email endpoint + dashboard UI
- Scoring key + comprehensive user guides
- Build script hardening (VITE_AUTH_MODE pinning)

**Pending** (Phase 3):
- Phase 3a: Anchor-based guide navigation (internal links with returnTo)
- Phase 3b: Production deployment sync verification (DevOps-critical)

See `docs/operations/HERMES_MYSTERY_SHOPPER_2FA_PHASE2.md` for full context and `HERMES_UPDATE_PACK.md` for quick reference.

---

## Testing Checklist

Before merging any changes:
- [ ] Tests pass locally (if applicable)
- [ ] Manual testing on dev server (both auth modes if touching auth)
- [ ] No breaking changes to existing features
- [ ] SMTP-dependent features graceful on local dev (no SMTP_* env vars)
- [ ] Build scripts still work (test internal + DMZ bundles)

---

## Common Gotchas

1. **Vite reads `.env.local` at build time** — changes require rebuild
2. **PostgreSQL returns naive datetimes** — use `as_aware_utc()` helper for comparisons
3. **Shopper name field is intentionally disabled** — do not add edit buttons
4. **Enrollment emails commit only if send succeeds** — SMTP failure = no token saved
5. **Database sync is critical assumption** — not yet verified for production DMZ

---

## When to Reference Memory

Before starting work, check:
- `memory/MEMORY.md` — Index of persistent context
- `memory/local-dev-stack.md` — Dev environment details
- `memory/mystery-shopper-2fa-phase2.md` — Current feature status

---

## Questions?

If you're unsure about architecture, deployment, or why something works this way, check the memory files or full HERMES documentation. If answers aren't there, that's a question for the next handoff phase.
