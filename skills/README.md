# Agent-Agnostic Skills Pack

This folder contains reusable markdown skills that can be used with different coding agents, including GPT-based agents, Claude-based agents, and local models.

The goal is to reduce repetition and make future bespoke application work more deterministic.

## What this pack covers

- architecture and platform decisions
- repository structure and standards
- NGINX reverse proxy setup
- self-hosted runner and CI/CD setup
- FastAPI, SQLAlchemy, Alembic backend patterns
- React, Vite, Tailwind frontend patterns
- Entra authentication and session handling
- PostgreSQL, backup, restore, and migration safety
- deployment, verification, and rollback
- DMZ/public deployment pattern for Mystery Shopper-like applications
- troubleshooting patterns and handover standards

## Start here

1. Read `SKILL_OVERVIEW.md`
2. Read `INSTALL_AND_USE.md`
3. Copy or import the individual skill files you want into your agent system

## Design principle

These skills are based on:
- the real implementation and fixes in this repository
- the `INTERNAL DEV KIT` standards pack
- repeated deployment, auth, frontend, and database issues encountered during CWSCX delivery

## Structure

- `SKILL_OVERVIEW.md`
- `INSTALL_AND_USE.md`
- `support/`
- individual `*.md` skills
