# Enterprise Deployment Runbook

This is the current deployment runbook for CWSCX staging and production-style deployments.

## Plain-language summary
- a release bundle is built from the exact repository commit
- that bundle is copied into `/opt/cwscx/releases`
- the newest bundle is explicitly inspected and installed
- backend, frontends, and nginx are then deployed from that installed bundle
- post-install asset checks confirm the live frontend folders actually changed

## Current deployment model
- staging deploys from `.github/workflows/deploy-staging.yml`
- production deploys from `.github/workflows/deploy-production.yml`
- both flows use release bundles and path-based routing

## Expected internal frontend paths
- dashboard: `/opt/cwscx/frontends-src/dashboard/dist`
- B2B survey: `/opt/cwscx/frontends-src/internal-surveys/b2b/dist`
- installation survey: `/opt/cwscx/frontends-src/internal-surveys/installation/dist`
- mystery shopper: `/opt/cwscx/frontends-src/public/mystery-shopper/dist`

## Current staging database runtime
- live compose file: `/opt/cwscx/docker-compose.yml`
- compose project: `cwscx`
- postgres service: `postgres`
- postgres container: `cwscx-postgres`
- host port mapping: `5433:5432`
- named volume: `cwscx_data`

These database runtime details are for the current staging VM. Production may use a different compose file, host layout, port exposure policy, or managed PostgreSQL approach.

Useful verification commands:

```bash
docker inspect cwscx-postgres --format '{{json .Config.Labels}}'
docker compose -f /opt/cwscx/docker-compose.yml config
docker compose -f /opt/cwscx/docker-compose.yml ps
```

## Core deployment sequence
1. build release bundle
2. archive it in `/opt/cwscx/releases`
3. inspect latest zip contents
4. install latest zip with `install_release_bundle.sh`
5. deploy backend
6. deploy frontends
7. deploy nginx
8. verify health and routes
