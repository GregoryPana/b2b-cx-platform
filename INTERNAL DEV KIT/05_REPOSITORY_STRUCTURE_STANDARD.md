# Repository Structure Standard

This document defines how future DTO bespoke application repositories should be structured.

## 1. Plain-language summary

Every new app should look familiar.

That means a developer or operator should be able to open any DTO app repository and quickly find:
- the backend
- the frontend
- the docs
- the deployment scripts
- the environment examples
- the CI/CD files

## 2. Standard repository layout

```text
<repo-root>/
  backend/
    app/
    alembic/
    tests/
    requirements.txt
  frontend/
    app/
    dashboard/            # only if the app needs a separate admin SPA
  scripts/
    linux/
  docs/
  .github/               # current standard
  README.md
  EXIT.md
  .gitignore
  .env.example
```

Important:
- `EXIT.md` belongs at the repository root, not inside `docs/`
- this makes it one of the first files a handoff recipient sees

If GitLab CE is adopted later, add:
- `.gitlab-ci.yml`

## 3. Folder conventions

### `backend/`

Contains:
- FastAPI app
- models
- migrations
- tests

Recommended shape:

```text
backend/
  app/
    api/
    core/
    models/
    schemas/
    services/
    main.py
  alembic/
  tests/
  requirements.txt
```

### `frontend/`

Contains TypeScript frontend apps only.

Recommended:
- `frontend/app/` for the main user app
- `frontend/dashboard/` for admin/dashboard if needed

Each frontend app should contain:
- `src/`
- `public/` if needed
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `tailwind.config.ts`
- `components.json` if using shadcn/ui

### `scripts/linux/`

Contains deploy and operational scripts.

Examples:
- build release bundle
- install release bundle
- deploy backend
- deploy frontends
- deploy NGINX
- verify release

### `docs/`

Contains all active documentation.

Minimum docs recommended:
- architecture summary
- deployment guide
- onboarding guide
- operations guide

## 4. TypeScript-only frontend rule

For new apps:
- no `.js` or `.jsx` source files in frontend app code
- use `.ts` and `.tsx`
- TypeScript strict mode should be on

This is a deliberate improvement over the mixed frontend state seen in earlier projects.

## 5. Tailwind and shadcn/ui standard

For new frontends:
- Tailwind CSS is the default styling system
- shadcn/ui is the default component library baseline

Rules:
- do not add multiple competing component libraries without approval
- keep shared UI tokens and component patterns consistent

## 6. `.gitignore` standard

Every repo should ignore:
- Python cache and virtual environments
- Node modules
- build outputs
- local env files
- release bundles
- editor and OS clutter if needed

Use template:
- `templates/repository/.gitignore.template`

## 7. `.env.example` standard

Every repo must include a safe example env file.

Rules:
- include variable names only
- include example placeholders
- never include real passwords, tokens, or secrets
- add comments for each variable group

Use template:
- `templates/repository/.env.example.template`

## 8. `README.md` standard

Every repo must have a useful root `README.md`.

Minimum sections:
- application name
- purpose
- entry points
- stack
- structure
- local setup summary
- deployment summary
- documentation links

Use template:
- `templates/repository/README_TEMPLATE.md`

## 9. Beginner step-by-step: create a new repo from this standard

1. Create the private repository
2. Clone it locally
3. Create the standard folders
4. Copy the templates:
   - `templates/repository/.gitignore.template`
   - `templates/repository/.env.example.template`
   - `templates/repository/README_TEMPLATE.md`
   - `EXIT_TEMPLATE.md` copied to the repository root as `EXIT.md`
5. Rename placeholders
6. Add initial backend and frontend starter apps
7. Commit the baseline

## 10. Naming conventions

- repo names: lowercase kebab-case
- folder names: lowercase, descriptive, stable
- service names: `<app-name>-backend`
- frontend app folders: short and explicit

## 11. Recommended docs structure

```text
docs/
  INDEX.md
  architecture/
  deployment/
  operations/
  reference/
```

## 12. Common mistakes

### Mistake 1: putting deployment logic only in workflow YAML

Why bad:
- harder to debug
- harder to migrate to GitLab later

### Mistake 2: no `.env.example`

Why bad:
- onboarding is slower
- missing config causes silent setup mistakes

### Mistake 3: frontend app names that do not match routes

Why bad:
- easier to confuse NGINX mappings and base paths

### Mistake 4: too many root-level files

Why bad:
- repo becomes hard to navigate

## 13. Suggested starter checklist

- `README.md` created
- `.gitignore` created
- `.env.example` created
- `backend/` created
- `frontend/` created
- `scripts/linux/` created
- `docs/` created
- CI/CD baseline added

## 14. Templates

Use:
- `templates/repository/.gitignore.template`
- `templates/repository/.env.example.template`
- `templates/repository/README_TEMPLATE.md`
