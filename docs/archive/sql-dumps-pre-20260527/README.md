# Archived SQL Dumps (pre-20260527)

These files are **archived snapshots** of older schemas and seed data. They
were moved out of the repo root on 2026-05-27 because:

- They predate Alembic migration `20260527_000020` (the B2B Q15 -> Q7 move).
- Some predate `20260415_000016` (`q18_competitor_service_with_cws`).
- Running them against a fresh database reintroduces the pre-reorder layout
  and forces Alembic to fight its way back to a known state.

## Do not use these to bootstrap a new database

Use the Alembic + seed flow instead:

```
cd backend
alembic upgrade head
python -m scripts.seed
```

Keep these files only as historical reference for what the old schemas /
data looked like. If a fresh authoritative dump is needed, regenerate from
production after Alembic is at `head`.
