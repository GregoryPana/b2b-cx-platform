# CI/CD Strategy

## CI

Trigger by path:

backend/** → backend-ci.yml  
frontend/survey/** → survey-ci.yml  
frontend/dashboard/** → dashboard-ci.yml  

---

## CD

develop branch → Staging deployment (when VM is provisioned)  
main branch → Production deployment (manual approval required)

Current state: deployments are manual only and VMs are not provisioned yet.

Deployments via:
- SSH to VM
- Docker container restart
- Migration execution
