# Operations And Handover Checklists

This document provides reusable checklists for future bespoke applications.

## 1. Architecture readiness checklist

- [ ] app follows INTERNAL DEV KIT platform standard
- [ ] production VM identified
- [ ] shared pre-production VM path identified
- [ ] route map documented
- [ ] health and readiness endpoints implemented
- [ ] Entra role model documented

## 2. Repository readiness checklist

- [ ] `README.md` present
- [ ] `.gitignore` present
- [ ] `.env.example` present
- [ ] backend and frontend folders follow standard layout
- [ ] deployment scripts are in source control
- [ ] docs folder exists

## 3. VM readiness checklist

- [ ] Linux VM provisioned
- [ ] internal DNS record created
- [ ] TLS files placed
- [ ] NGINX installed
- [ ] Python installed
- [ ] Node installed if builds run on VM runner
- [ ] Docker and Compose installed
- [ ] `/opt/<app-name>` structure created
- [ ] `/opt/backups/<app-name>` structure created

## 4. CI/CD readiness checklist

- [ ] private repo created
- [ ] branch protections configured
- [ ] environments configured
- [ ] self-hosted staging runner online
- [ ] self-hosted production runner online
- [ ] staging deploy workflow/manual job ready
- [ ] production deploy workflow/manual job ready

## 5. Backup readiness checklist

- [ ] backup script created
- [ ] schedule created
- [ ] first manual backup completed
- [ ] backup files appear in correct retention folder
- [ ] restore-readiness test completed
- [ ] backup risk documented if stored on same VM

## 6. Monitoring readiness checklist

- [ ] Uptime Kuma monitor for health endpoint created
- [ ] Uptime Kuma monitor for readiness endpoint created
- [ ] route monitors created for frontend paths
- [ ] DB TCP monitor created if appropriate
- [ ] alert notification tested
- [ ] user-facing status page created if appropriate

## 7. Entra readiness checklist

- [ ] app registration created
- [ ] redirect URLs configured
- [ ] logout URLs configured
- [ ] app roles configured
- [ ] API scope configured
- [ ] users/groups assigned
- [ ] frontend env values set
- [ ] backend env values set

## 8. Pre-go-live checklist

- [ ] staging deployment completed successfully
- [ ] smoke tests passed
- [ ] production backup configured
- [ ] production env file created
- [ ] monitoring live
- [ ] rollback path documented
- [ ] user communication draft prepared

## 9. Post-go-live checklist

- [ ] health endpoint remains healthy
- [ ] readiness endpoint remains healthy
- [ ] first scheduled backup succeeded
- [ ] first 24-hour monitor review completed
- [ ] no unexpected auth issues in logs
- [ ] no unexpected migration issues in logs
- [ ] operators know how to restart backend and NGINX

## 10. Common lessons from CWSCX that must not be forgotten

- do not assume internal DNS can resolve every target without checking
- do not assume a blank optional auth setting is harmless
- do not assume a migration path is safe just because an upgraded database works
- do not assume stale frontend bundles are impossible
- do not assume backup works until restore is tested
- do not assume deploy should be automatic

## 11. Handover checklist

- [ ] `EXIT_TEMPLATE.md` copied to the application repository root as `EXIT.md`
- [ ] `EXIT.md` completed and reviewed
- [ ] operations contact recorded
- [ ] support contact recorded
- [ ] deployment guide complete
- [ ] restart commands documented
- [ ] backup location documented
- [ ] monitoring URLs documented
- [ ] Entra app details documented

## 12. Support contacts template

This is a living section.
Update it as the team grows and ownership changes.

- Application owner: `<name>`
- Technical owner: Gregory Panagary
- Technical contact email: `gregory.panagary@cwseychelles.com`
- Infrastructure contact: `<team or person>`
- Entra admin contact: `<team or person>`

## 13. Emergency quick commands template

Backend status:

```bash
sudo systemctl status <app-name>-backend
```

Restart backend:

```bash
sudo systemctl restart <app-name>-backend
```

Test NGINX config:

```bash
sudo nginx -t
```

Restart NGINX:

```bash
sudo systemctl restart nginx
```

Check Compose services:

```bash
docker compose -f /opt/<app-name>/docker-compose.yml ps
```

Health endpoint:

```bash
curl -kfsS https://<app-host>/api/health
```
