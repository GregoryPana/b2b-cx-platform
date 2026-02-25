# Deployment Topology

## Segmented Production
Internet
-> Firewall
-> Reverse Proxy (DMZ)
-> Survey Frontend (DMZ VM)
-> Internal API (Internal VM)
-> PostgreSQL (Internal DB VM)

Dashboard is accessible only from internal LAN.

## Reverse Proxy
- TLS termination
- Survey domain exposed
- Dashboard blocked externally
- API not directly internet-exposed
- Health checks enabled
