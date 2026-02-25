# CI/CD Strategy

## CI

Trigger by path:

backend/** → backend-ci.yml  
frontend/survey/** → survey-ci.yml  
frontend/dashboard/** → dashboard-ci.yml  

---

## CD

develop branch → Staging deployment  
main branch → Production deployment (manual approval required)

Deployments via:
- SSH to VM
- Docker container restart
- Migration execution
