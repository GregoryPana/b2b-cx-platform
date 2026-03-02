# Deployment Topology

## Internal Network Only

Internal LAN
-> Survey Frontend (Internal Server)
-> Dashboard Frontend (Internal Server)
-> FastAPI Backend (Internal Server)
-> PostgreSQL (Internal Database Server)
-> Microsoft Entra ID SSO (Cloud Auth)

All components accessible only within the internal network environment.

## Network Access
- No internet-facing components
- Internal DNS resolution only
- Internal load balancing (if needed)
- Health checks enabled
- TLS certificates for internal services
