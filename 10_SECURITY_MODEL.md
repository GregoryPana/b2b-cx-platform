# Security Model

## Internal Network Deployment

Internal LAN
→ Survey Frontend (Internal Server)
→ Dashboard Frontend (Internal Server)
→ FastAPI Backend (Internal Server)
→ PostgreSQL (Internal Database Server)
→ Microsoft Entra ID SSO (Cloud Auth)

All components accessible only within the internal network environment.

---

## Security Controls

- HTTPS only
- Entra JWT validation
- Role-based authorization at backend
- No direct DB access from frontend
- Internal network segmentation
- Audit logging enabled
