# CI/CD Flow

## CI (Path-Based)
- backend/** -> backend-ci.yml
- frontend/survey/** -> frontend-survey-ci.yml
- frontend/dashboard/** -> frontend-dashboard-ci.yml

## CI Stages
- Lint
- Unit tests
- Build artifacts

## CD
- develop -> staging deployment
- main -> production deployment (manual approval required)

## Deployment Steps
- SSH to VM
- Docker container restart
- Run migrations
- Smoke tests
- Emit deployment metadata
