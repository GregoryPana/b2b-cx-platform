# Docker Compose Standard

This guide defines the standard Docker Compose approach for future bespoke internal applications.

## 1. Plain-language summary

Docker Compose lets us define services in one file.

For our standard internal application pattern, Docker Compose is used mainly for:
- PostgreSQL
- optional utility services

The main Python backend is still normally run by `systemd`, not by Compose.

This matches the CWSCX operating model that proved practical for support and debugging.

## 2. Standard rule

Default on the app VM:
- backend: `systemd`
- frontend: static files served by NGINX
- database: Docker Compose

Do not move everything into containers unless there is a reviewed reason.

## 3. Standard file location

Recommended path:

```text
/opt/<app-name>/docker-compose.yml
```

## 4. What should be in the Compose file

Usually:
- one `postgres` service
- one named volume for database data
- one network if needed

Sometimes:
- utility services such as admin tools in non-production environments

For future apps that need additional runtime services such as Redis, a message queue, or another utility container:
- treat that as an architecture review point, not something to add casually
- approved additional services must be documented with purpose, port usage, data persistence expectations, and backup implications
- one acceptable example is `redis` for short-lived cache usage when the application genuinely needs it

## 5. Beginner explanation of key Compose concepts

- service
  - one running container definition
- image
  - the software package Docker runs
- volume
  - persistent storage so data survives container restarts
- port mapping
  - exposes a container port onto the VM
- environment variables
  - settings passed into the container
- health check
  - a command Docker runs to confirm the service is healthy

## 6. Standard PostgreSQL pattern

Recommended baseline:
- image: `postgres:16`
- host port: `5433`
- container port: `5432`
- named volume for data
- health check using `pg_isready`

Why `5433` on host:
- avoids clashing with a local package install of PostgreSQL on `5432`
- matched the proven CWSCX pattern

Upgrade policy note:
- PostgreSQL major version upgrades require a reviewed migration plan and are not applied automatically

## 7. Environment variable injection

There are two separate concerns:

### A. Compose runtime variables

These are used by Docker Compose itself.

Examples:
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

### B. Application backend variables

These live in `/opt/<app-name>/.env` and are used by the Python backend.

Do not confuse them.

## 8. Standard health checks

Database service should include a health check.

Example check:
- `pg_isready -U <user> -d <database>`

Why:
- easier troubleshooting
- clearer startup verification
- better signal during maintenance

## 9. Beginner step-by-step: create the Compose file

### Step 1: create the app folder

```bash
sudo mkdir -p /opt/<app-name>
```

### Step 2: copy the template

Use:
- `templates/docker/docker-compose.app-vm.yml`

Copy it to:

```bash
sudo cp "templates/docker/docker-compose.app-vm.yml" "/opt/<app-name>/docker-compose.yml"
```

### Step 3: edit the placeholders

Replace:
- `__APP_NAME__`
- `__POSTGRES_DB__`
- `__POSTGRES_USER__`
- `__POSTGRES_PASSWORD__`

### Step 4: check the Compose file

```bash
docker compose -f /opt/<app-name>/docker-compose.yml config
```

### Step 5: start the database

```bash
docker compose -f /opt/<app-name>/docker-compose.yml up -d
```

### Step 6: check the service

```bash
docker compose -f /opt/<app-name>/docker-compose.yml ps
```

## 10. Standard networking approach

For the default app VM model:
- database is local to the VM
- backend connects using `localhost:5433`
- remote DB exposure should be intentional, not accidental

If remote admin access is required:
- restrict by firewall
- document who needs access
- monitor the exposed port

## 11. Standard backend database URL

Recommended backend `.env` example:

```text
DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:5433/<database>
```

## 12. Storage and persistence

Use named volumes for database data.

Do not rely on container-local ephemeral storage.

## 13. Backup expectations

Docker Compose starting the database is not enough.

You still need:
- backup script
- retention folders
- cron or timer schedule
- restore validation

## 14. Common mistakes

### Mistake 1: forgetting a volume

Result:
- data disappears when container is recreated

### Mistake 2: mapping the wrong host port

Result:
- backend cannot connect
- pgAdmin or monitoring cannot connect

### Mistake 3: using environment files inconsistently

Result:
- Compose and backend point at different usernames, passwords, or DB names

### Mistake 4: no health check

Result:
- less clear startup troubleshooting

## 15. Troubleshooting for beginners

### Check 1: validate YAML

```bash
docker compose -f /opt/<app-name>/docker-compose.yml config
```

### Check 2: show running services

```bash
docker compose -f /opt/<app-name>/docker-compose.yml ps
```

### Check 3: view logs

```bash
docker compose -f /opt/<app-name>/docker-compose.yml logs --tail=100
```

### Check 4: confirm port is listening

```bash
ss -ltnp | grep 5433
```

### Check 5: test DB reachability locally

```bash
nc -vz 127.0.0.1 5433
```

## 16. When to allow exceptions

An exception to the standard may be approved if:
- the app has higher resilience requirements
- a managed PostgreSQL platform is available and preferred
- security policy requires DB isolation on a separate VM

If so, document the exception clearly.

## 17. Template

Use:
- `templates/docker/docker-compose.app-vm.yml`
