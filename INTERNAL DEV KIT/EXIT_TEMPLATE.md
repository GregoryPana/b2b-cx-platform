# EXIT.md Template

Copy this file into the root of each bespoke application repository as `EXIT.md`.

This file should be completed before production handover is considered complete.

---

## 1. Application Overview

- Application name:
- One-line description:
- Business purpose:
- Primary users:
- Production URL:
- Current status:

## 2. Environment Model

- Pre-production VM:
- Production VM:
- Internal DNS names:
- TLS certificate approach:

## 3. Architecture Summary

- Backend:
- Frontend(s):
- Reverse proxy:
- Database:
- Authentication:
- Monitoring:

## 4. Repository And Deployment

- Repository URL:
- Default branch:
- Current CI/CD platform:
- Staging deploy workflow/job:
- Production deploy workflow/job:
- Self-hosted runner names/labels:

## 5. Runtime Paths

- App root on VM:
- Backend service name:
- Compose file path:
- Frontend build paths:
- NGINX site path:
- Backup path:

## 6. Health And Verification

- Health endpoint:
- Readiness endpoint:
- Standard verification commands:

## 7. Backup And Restore

- Backup method:
- Schedule:
- Retention:
- Last successful backup test date:
- Last restore-readiness test date:
- Known backup risks:

## 8. Entra Registration Record

- App registration name:
- Enterprise application name:
- Tenant ID:
- Client ID:
- Application ID URI:
- API scope(s):
- Redirect URLs:
- Post-logout URLs:
- App roles:
- Assigned groups:
- Request/approval reference:
- Support owner:

## 9. Environment Variables

- Production env file path:
- Key required variables documented:
- Secret ownership / update process:

## 10. Operational Checks

- How to check backend status:
- How to restart backend:
- How to test NGINX config:
- How to restart NGINX:
- How to inspect Compose services:

## 11. Observability

- Uptime Kuma monitor names:
- Status page URL:
- pgAdmin connection name:
- Alert channel(s):

## 12. Known Risks And Exceptions

- Approved deviations from the standard:
- Open risks:
- Deferred improvements:

## 13. Ownership And Support

- Application owner:
- Technical owner:
- Infrastructure owner:
- Entra admin contact/team:
- Escalation path:

## 14. Handover Sign-off

- Technical review completed by:
- Operations review completed by:
- Handover date:
- Notes:
