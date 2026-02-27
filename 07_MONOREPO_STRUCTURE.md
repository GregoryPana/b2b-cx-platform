# Monorepo Structure

cx-b2b-platform/

frontend/
  survey/
  dashboard/

backend/
  app/
    routers/
    services/
    models/
    core/
    main.py

infrastructure/
  staging/
  production/

.github/workflows/
  backend-ci.yml
  frontend-survey-ci.yml
  frontend-dashboard-ci.yml
  deploy-staging.yml
  deploy-production.yml
