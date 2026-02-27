# B2B Customer Experience Governance Platform

## Purpose

The B2B Customer Experience Governance Platform is an internal enterprise system designed to:

- Capture structured B2B visit assessments
- Standardize scoring using 0–10 scale
- Calculate Net Promoter Score (NPS)
- Track annual business coverage
- Log action items per question
- Route submissions through approval workflow (Needs Changes, Approved, Rejected)
- Provide role-based dashboards and analytics
- Support planned visit drafts assigned to representatives
- Support segmented production deployment (DMZ + Internal LAN)

This system is web-based, API-driven, and production-ready by design.

---

## High-Level Architecture

Production (On-Prem with DMZ):

Internet  
→ Firewall (NAT 443)  
→ Reverse Proxy (DMZ)  
→ Survey Frontend (DMZ VM)  
→ Internal API (Internal VM)  
→ PostgreSQL (Internal DB VM)  
↑  
Internal Dashboard (Internal LAN Only)

---

## Tech Stack

- Frontend: React (Survey + Dashboard)
- Backend: Python FastAPI
- Database: PostgreSQL
- Auth: Microsoft Entra ID (SSO)
- Repo Strategy: Monorepo
- CI/CD: GitHub Actions
- Deployment: Local VMs (Staging + Production)
