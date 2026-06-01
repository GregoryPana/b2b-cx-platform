# NGINX Reverse Proxy Skill

## Purpose

Use this skill to configure or troubleshoot NGINX reverse proxy routing for backend APIs and static frontends.

## Use When

- adding a new frontend route
- exposing a backend under `/api/`
- configuring TLS termination
- preserving custom routes during deploy
- diagnosing 404, MIME, or wrong-path issues

## Rules

- test config with `nginx -t` before restart
- static frontend asset base path must match deployed route path
- do not let generated config overwrite unrelated routes without an include strategy
- keep no-cache headers for SPA shell HTML where stale bundles are a risk

## Process

1. confirm desired public route map
2. confirm frontend build base paths
3. create route blocks for assets and SPA root
4. proxy `/api/` to the backend
5. preserve external/custom routes via include file where needed
6. test and reload nginx

## Verification

- `nginx -t` passes
- route returns `200`
- JS assets do not return `text/html`
- API health route works through nginx

## Common Failure Patterns

- 404 on JS asset: wrong base path or wrong alias path
- MIME text/html: SPA shell served instead of asset
- old app after deploy: stale shell or wrong dist path

## References

- `INTERNAL DEV KIT/03_NGINX_REVERSE_PROXY_GUIDE.md`
- `scripts/linux/deploy_nginx.sh`
