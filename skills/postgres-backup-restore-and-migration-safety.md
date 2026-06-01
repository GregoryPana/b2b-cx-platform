# PostgreSQL Backup Restore And Migration Safety Skill

## Purpose

Use this skill to standardize safe database operations: backup, restore, migration, and data sanitization.

## Use When

- setting up DB backups
- validating restore readiness
- moving data between environments
- planning a migration or schema reorder
- cleaning production data for first use

## Rules

- backup is not real until restore readiness is tested
- production deploys must be upgrade-only
- do not trust fresh-bootstrap migration chains without testing them separately
- take a backup before destructive or cleanup operations

## Process

1. confirm current DB runtime and host/port
2. take a backup
3. validate backup readability
4. test restore if needed
5. apply migrations carefully
6. verify row counts and operational endpoints after change

## References

- `docs/deployment/postgres_migration.md`
- `docs/operations/HANDOVER_GUIDE.md`
- `WORKSTREAM_TRACKER.md`
- `EXIT.md`
