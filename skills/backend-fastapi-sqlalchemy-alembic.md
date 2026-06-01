# Backend FastAPI SQLAlchemy Alembic Skill

## Purpose

Use this skill to build or change backend APIs safely with migration discipline and operational awareness.

## Use When

- adding or changing API endpoints
- updating models or persistence logic
- adding migrations
- fixing backend bugs tied to schema or SQL queries

## Rules

- never mutate schema in request paths
- every schema change needs a migration
- prefer guarded handling for optional/legacy columns in live environments
- backend authorization is authoritative
- keep deploy path migration-upgrade-only

## Process

1. inspect existing API, model, and query path
2. identify whether the change is code-only or schema-affecting
3. if schema-affecting, add Alembic migration
4. keep query behavior compatible with live schema variations where needed
5. add or update tests where practical
6. verify health and affected endpoints

## Common Failure Patterns

- multiple Alembic heads
- fresh-install migration divergence
- optional column assumed to exist everywhere
- runtime schema mutation in active request paths

## References

- `backend/app/api/`
- `backend/app/models/`
- `backend/alembic/versions/`
- `EXIT.md`
- `docs/architecture/`
