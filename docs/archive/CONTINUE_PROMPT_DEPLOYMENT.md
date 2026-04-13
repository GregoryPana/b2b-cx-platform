<!-- ARCHIVED: Historical/superseded document. See docs/ for current documentation. -->

# Prompt To Continue Deployment Work

Use this prompt with me in the next step:

```text
Continue from the current CX B2B platform repo state and execute the deployment runbook in ENTERPRISE_DEPLOYMENT_RUNBOOK.md for server cwscx-tst01.cwsey.com.

Context:
- Single Ubuntu server PoC.
- Backend: FastAPI on port 8000.
- Nginx routes:
  - / -> mystery shopper
  - /dashboard -> dashboard app
  - /surveys/b2b and /surveys/installation -> internal survey builds
  - /api/* -> backend

What I need now:
1) Verify the deployment readiness of the current repo (backend + all three frontends).
2) Generate exact server-side commands for my environment (assume repo root is /opt/cwscx).
3) Produce final Nginx config and final systemd unit files, ready to paste.
4) Provide Entra redirect URI checklist specific to these paths.
5) Provide an execution checklist with validation commands and expected outputs.
6) Highlight any remaining blockers before go-live on staging.

Rules:
- Minimal changes only.
- No Docker.
- Keep architecture as-is.
- Use /api relative calls only.
- If anything is ambiguous, choose safe defaults and clearly state assumptions.
```
