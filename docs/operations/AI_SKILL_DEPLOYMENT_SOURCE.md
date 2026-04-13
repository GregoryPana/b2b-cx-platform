# AI Skill Source: CWSCX Deployment Operations

This file is structured as source material for future AI agent skills.

## 1) Scope
Skill target:
- staging deployment operations for CWSCX
- verification and rollback guidance
- first-line incident triage

Out of scope:
- production force operations without explicit approval
- destructive database operations

## 2) System facts
```yaml
project_name: CWSCX Platform
staging_root: /opt/cwscx
workflow_file: .github/workflows/deploy-staging.yml
backend_service: cwscx-backend
api_health_url: /api/health
routes:
  root_redirect: /
  dashboard: /dashboard/
  survey_b2b: /surveys/b2b/
  survey_installation: /surveys/installation/
  mystery_shopper: /mystery-shopper/
frontend_paths:
  dashboard: /opt/cwscx/frontends-src/dashboard/dist
  b2b: /opt/cwscx/frontends-src/internal-surveys/b2b/dist
  installation: /opt/cwscx/frontends-src/internal-surveys/installation/dist
  mystery: /opt/cwscx/frontends-src/public/mystery-shopper/dist
```

## 3) Deployment commands
```yaml
build_bundle:
  command: bash scripts/linux/build_release_bundle.sh "${RUNNER_TEMP}/cwscx-release.zip"
install_bundle:
  command: sudo bash scripts/linux/install_release_bundle.sh "<bundle_path>"
deploy_backend:
  command: bash scripts/linux/deploy_backend.sh
deploy_frontends:
  command: bash scripts/linux/deploy_frontends.sh
deploy_nginx:
  command: sudo bash scripts/linux/deploy_nginx.sh
verify_staging:
  command: STAGING_BASE_URL="<url>" bash scripts/linux/verify_staging.sh
```

## 4) Hard safety rules
```yaml
safety_rules:
  - never run database reset/drop/truncate during normal deploy
  - never use destructive git reset/checkout operations on user data
  - deploy path is migration-upgrade-only
  - if deploy fails, prefer rollback using previous release zip
  - require explicit user confirmation for irreversible production actions
```
