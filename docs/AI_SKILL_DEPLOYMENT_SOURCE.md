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
  dashboard: /dashboard/
  survey_b2b: /surveys/b2b/
  survey_installation: /surveys/installation/
  mystery_public: /
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
  command: bash scripts/linux/install_release_bundle.sh "<bundle_path>"
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

## 5) Decision tree

```yaml
decision_tree:
  - condition: "CI checks fail (backend_ci/dashboard_ci/survey_ci)"
    action: "stop deploy, fix failing pipeline first"
  - condition: "deploy preflight fails (permissions/sudo/path)"
    action: "fix host prerequisites, rerun deploy"
  - condition: "bundle install fails"
    action: "validate bundle layout and required dist/index.html files"
  - condition: "backend migration fails"
    action: "inspect alembic output, resolve schema mismatch, rerun"
  - condition: "verification fails post-deploy"
    action: "attempt rollback to previous release zip and re-verify"
```

## 6) Verification checklist

```yaml
verification:
  backend:
    - "curl -fsS http://127.0.0.1:8000/health"
    - "systemctl status cwscx-backend --no-pager"
  nginx:
    - "sudo nginx -t"
    - "sudo systemctl status nginx --no-pager"
  routes:
    - "<base_url>/dashboard/"
    - "<base_url>/surveys/b2b/"
    - "<base_url>/surveys/installation/"
    - "<base_url>/api/health"
  artifacts:
    - "/opt/cwscx/frontends-src/dashboard/dist/index.html"
    - "/opt/cwscx/frontends-src/internal-surveys/b2b/dist/index.html"
    - "/opt/cwscx/frontends-src/internal-surveys/installation/dist/index.html"
```

## 7) Common incidents and responses

```yaml
incidents:
  - pattern: "Passwordless sudo is required"
    response: "configure NOPASSWD sudoers for runner user and rerun"
  - pattern: "Missing build artifact ... dist/index.html"
    response: "ensure frontend build step succeeded and bundle contains dist"
  - pattern: "relation \"programs\" already exists"
    response: "baseline migration mismatch; use existing script retry behavior"
  - pattern: "MIME type text/html for module"
    response: "assets path/routing mismatch; verify dist/assets and nginx mapping"
  - pattern: "runner queued and not picked"
    response: "validate runner online state and matching labels"
```

## 8) Required prerequisites for deploy skill

```yaml
prerequisites:
  - self-hosted runner online on staging network
  - /opt/cwscx writable by runner user
  - passwordless sudo for deploy-required commands
  - python and node available on runner host
  - valid /opt/cwscx/.env for backend runtime
  - staging_base_url secret configured in GitHub environment
```

## 9) Structured workflow phases for AI implementation

```yaml
phases:
  - name: preflight
    goals:
      - validate runner prerequisites
      - validate workspace source paths
  - name: build
    goals:
      - build frontend artifacts with correct base paths
      - package release zip
  - name: install
    goals:
      - install bundle into /opt/cwscx
      - sync scripts and artifacts
  - name: service_deploy
    goals:
      - run backend deploy
      - validate frontend artifacts
      - deploy nginx
  - name: verify
    goals:
      - execute health and route checks
  - name: rollback
    goals:
      - reinstall previous release zip if failure
      - rerun deploy + verify
```

## 10) Suggested AI response template for deployment updates

```text
Status: <in_progress|success|failed>
Release: <release_id>
Commit: <sha>
Current step: <phase/step>
Impact: <user-visible impact>
Next action: <what will be done next>
If failed: <exact blocking reason + concrete fix>
```
