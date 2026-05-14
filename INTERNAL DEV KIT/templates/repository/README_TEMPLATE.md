# <Application Name>

Short description of what this application does.

## Entry Points

- `/app/` -> main application
- `/dashboard/` -> admin dashboard if used
- `/api/` -> backend API

## Tech Stack

- Backend: Python, FastAPI, SQLAlchemy, Alembic
- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Auth: Microsoft Entra ID
- Database: PostgreSQL
- Proxy: NGINX

## Repository Structure

- `backend/` -> backend application code
- `frontend/` -> frontend applications
- `scripts/linux/` -> deployment scripts
- `docs/` -> active documentation

## Local Setup

1. Create `.env` from `.env.example`
2. Install backend dependencies
3. Install frontend dependencies
4. Start the local database if needed
5. Run migrations
6. Start backend and frontend dev servers

## Deployment Summary

- staging deploy: manual
- production deploy: manual
- deploy jobs run on self-hosted runners in the internal network

## Documentation

- `docs/INDEX.md`
