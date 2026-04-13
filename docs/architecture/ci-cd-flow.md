# CI/CD Flow

## CI (Path-Based)
- `backend/**` -> Backend CI
- `frontend/survey/**` -> B2B Survey CI
- `frontend/installation-survey/**` -> Installation Survey CI
- `frontend/dashboard-blueprint/**` -> CX Governance Dashboard CI
- `frontend/mystery-shopper/**` -> Mystery Shopper CI

## CI Stages
- install dependencies
- run backend tests
- build frontend artifacts
- validate release bundle structure

## CD
- `main` -> staging deployment through self-hosted runner
- production deployment -> manual workflow dispatch and approval

## Deployment Model
- the exact commit is checked out on the runner
- a release zip is built locally from the monorepo
- the zip is archived in `/opt/cwscx/releases`
- the newest release zip is explicitly inspected and installed
- backend, frontends, and nginx are deployed from that bundle

## Deployed Frontend Outputs
- `/dashboard/` -> CX Governance Dashboard SPA
- `/surveys/b2b/` -> B2B Survey SPA
- `/surveys/installation/` -> Installation Assessment SPA
- `/mystery-shopper/` -> Mystery Shopper SPA

## Verification
- backend health check
- nginx config test
- route verification for all four SPAs
- post-install asset verification for dashboard, B2B survey, and installation survey
