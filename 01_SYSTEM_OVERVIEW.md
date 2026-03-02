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
- Support internal network deployment only

This system is web-based, API-driven, and production-ready by design.

---

## High-Level Architecture

Internal Network Only:

Internal LAN  
→ Survey Frontend (Internal Server)  
→ Dashboard Frontend (Internal Server)  
→ FastAPI Backend (Internal Server)  
→ PostgreSQL (Internal Database Server)  
→ Microsoft Entra ID SSO (Cloud Auth)

All components accessible only within the internal network environment.

---

## Tech Stack

- Frontend: React (Survey + Dashboard)
- Backend: Python FastAPI
- Database: PostgreSQL
- Auth: Microsoft Entra ID (SSO)
- Repo Strategy: Monorepo
- CI/CD: GitHub Actions
- Deployment: Internal VMs (Staging + Production)
