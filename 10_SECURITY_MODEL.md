# Security Model

## Production Segmentation

Internet
→ Firewall
→ Reverse Proxy (DMZ)
→ Survey Frontend (DMZ)
→ Internal API
→ Database

Dashboard accessible only from internal LAN.

---

## Security Controls

- HTTPS only
- Entra JWT validation
- Role-based authorization at backend
- No direct DB access from frontend
- Strict firewall rules
- Audit logging enabled
