# Environment Strategy

## Environments

DEV – Local  
STAGING – Test VM  
PRODUCTION – DMZ + Internal VMs

Each environment has:

- Separate .env
- Separate DB
- Separate Entra App Registration
- Separate secrets

---

## Deployment Split (Production)

Survey → DMZ VM  
Dashboard → Internal VM  
API → Internal VM  
Postgres → Internal DB VM
