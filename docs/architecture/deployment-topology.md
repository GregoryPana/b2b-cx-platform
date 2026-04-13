# Deployment Topology

## Current Runtime Topology

CWSCX uses a single-domain, path-based deployment model.

### Route Map
- `/` -> redirects to `/dashboard/`
- `/dashboard/` -> CX Governance Dashboard
- `/surveys/b2b/` -> B2B Survey SPA
- `/surveys/installation/` -> Installation Assessment Survey SPA
- `/mystery-shopper/` -> Mystery Shopper SPA
- `/api/*` -> FastAPI backend

### Hosting Model
- one server can host the dashboard, internal survey SPAs, backend, and Nginx
- Nginx performs path-based routing to frontend `dist` folders and backend API
- PostgreSQL runs separately or on the same host depending on environment

### Access Control
- access is enforced primarily through Azure Entra ID authentication and role claims
- authorization is program-scoped via Entra roles, not VPN-only restriction
- the dashboard and protected SPAs rely on bearer-token validation in the backend

### Staging Layout
- deployment root: `/opt/cwscx`
- dashboard dist: `/opt/cwscx/frontends-src/dashboard/dist`
- B2B survey dist: `/opt/cwscx/frontends-src/internal-surveys/b2b/dist`
- installation survey dist: `/opt/cwscx/frontends-src/internal-surveys/installation/dist`
- mystery shopper dist: `/opt/cwscx/frontends-src/public/mystery-shopper/dist`

### Design Implications
- single-domain path routing avoids cross-origin SPA complexity
- all four frontends share one reverse proxy
- CI/CD must build and publish four separate SPA outputs to four path-based routes
