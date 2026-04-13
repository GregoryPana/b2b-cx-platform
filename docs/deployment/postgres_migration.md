# PostgreSQL Migration & Seeding Guide (Docker → Docker)

## Overview

This guide explains how to restore a PostgreSQL database dump (`dump.backup`) into a Docker-based PostgreSQL instance, including schema creation and data seeding.

---

## Prerequisites

- Docker installed
- PostgreSQL container running
- `dump.backup` file available locally
- Database credentials (user, password)

---

## Step 1 — Copy Dump into Container

```bash
docker cp dump.backup <postgres_container>:/dump.backup
```

---

## Step 2 — Verify Container

```bash
docker ps
```

Identify your PostgreSQL container name.

---

## Step 3 — (Optional) Create Database

If the database does not exist:

```bash
docker exec -it <postgres_container> psql -U <user> -c "CREATE DATABASE <database>;"
```

---

## Step 4 — Restore Database

### Recommended (Clean Restore)

```bash
docker exec -it <postgres_container> \
  pg_restore --clean --if-exists --no-owner \
  -U <user> -d <database> /dump.backup
```

---

## Step 5 — Verify Data

```bash
docker exec -it <postgres_container> psql -U <user> -d <database>
```

Then run:

```sql
\dt;
SELECT COUNT(*) FROM <some_table>;
```

---

## Optional: Split Schema & Seed Strategy

### Schema Only

```bash
pg_restore -s -U <user> -d <database> /dump.backup
```

### Data Only

```bash
pg_restore -a -U <user> -d <database> /dump.backup
```

---

## Optional: Auto-Seeding via Docker Init

Place SQL files into `/docker-entrypoint-initdb.d/`. Docker will automatically execute them on first startup.

---

## Common Issues

### Role does not exist

Use:

```bash
--no-owner
```

### Database already exists

Use:

```bash
--clean --if-exists
```

### Permission issues

Run as postgres user:

```bash
docker exec -u postgres ...
```

---

## Final Notes

- Use `pg_dump -F c` for portability
- Prefer clean restore for consistent environments
- Consider migration tools like Alembic for long-term projects

---

## Quick Command Summary

```bash
docker cp dump.backup <container>:/dump.backup

docker exec -it <container> pg_restore \
  --clean --if-exists --no-owner \
  -U <user> -d <database> /dump.backup
```
