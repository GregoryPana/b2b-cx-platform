# CI/CD And Repository Standard

This document explains how future DTO bespoke applications should be managed in source control and deployed.

It covers:
- current standard in GitHub
- future target in GitLab CE
- why we deploy the way we do
- step-by-step setup for beginners

## 1. Plain-language summary

The source code lives in a repository.

CI/CD means:
- CI checks that code builds and tests correctly
- CD packages and deploys the code to the server

For our internal apps, deployment must happen from inside the network when the target VM is not publicly reachable.

## 2. Current standard: GitHub

Use:
- private GitHub repository
- GitHub Actions for CI/CD
- self-hosted runners for staging and production deploy jobs

### Why not public GitHub runners for deploy?

Because the production and pre-production VMs are internal-only.

Public runners cannot safely or reliably reach them.

Correct model:
- CI checks can run on GitHub-hosted runners
- deploy job runs on internal self-hosted runner

## 3. Future target: self-hosted GitLab CE

The future target is:
- self-hosted GitLab CE for repositories and CI/CD

Design today so migration later is easier:
- keep deployment logic in shell scripts under version control
- keep environment assumptions documented
- avoid CI logic that exists only inside a GitHub-specific action
- keep packaging/deploy steps portable

## 4. Standard branching model

Default:
- `main` is the protected default branch
- feature work happens in feature branches
- hotfix work happens in hotfix branches

Recommended branch naming:
- `feature/<short-name>`
- `fix/<short-name>`
- `hotfix/<short-name>`
- `docs/<short-name>`

## 5. Standard deployment model

### CI jobs

Run on hosted runners if acceptable:
- backend tests
- frontend build checks
- linting
- template validation

### Deploy jobs

Run on self-hosted runners:
- shared pre-production VM runner for staging/test deploys
- dedicated production VM runner for production deploys

### Trigger rules

Default:
- staging deploy: manual only
- production deploy: manual only

Why:
- safer change control
- easier coordination with users
- avoids accidental deployment during active troubleshooting

## 6. Standard release flow

1. Developer pushes branch
2. CI runs tests and builds
3. Code is reviewed and merged to `main`
4. Release is manually triggered for staging
5. Staging is validated
6. Release is manually triggered for production
7. Production smoke checks run

## 7. Standard deployment packaging

Keep deployment logic outside the CI platform where possible.

Recommended:
- build a release bundle
- archive it on the VM
- install from the bundle
- deploy backend
- deploy frontend assets
- deploy NGINX config
- run verification

Why:
- easier rollback
- easier GitHub to GitLab migration later
- same scripts can be run manually in emergencies

Required hardening on self-hosted runners:
- fetch full history where needed
- force checkout the exact triggering commit
- clean untracked files before build

Why:
- stale local files on self-hosted runners are a real failure mode
- CWSCX hit stale build and provenance issues during troubleshooting

Required verification contents after deployment:
- `verify_release.sh` must check the application health endpoint
- `verify_release.sh` must check the application readiness endpoint
- default checks should include:
  - `curl -kfsS https://<host>/api/health`
  - `curl -kfsS https://<host>/api/health/ready`
- if the app also serves frontends, the verifier should check the expected SPA routes return success

## 8. Beginner step-by-step: set up a new GitHub repo

1. Create a new private repository in GitHub
2. Name it using kebab-case
3. Clone it locally
4. Copy the INTERNAL DEV KIT templates into it
5. Create GitHub environments for `staging` and `production`
6. Add the staging and production secrets and variables
7. Check whether a suitable self-hosted runner already exists
8. Register a new runner only if no suitable runner is available
9. Push the first commit
10. Run CI
11. Trigger staging manually

## 9. Required GitHub repository settings

Recommended baseline:
- private repository
- protected `main`
- pull request review required
- status checks required before merge
- Actions enabled
- environments created:
  - `staging`
  - `production`

Recommended environment secrets:
- `STAGING_BASE_URL`
- `PRODUCTION_BASE_URL`

Environment details must be configured in GitHub under `Settings > Environments`:

- `staging`
- `production`

Each environment should document or store:

- public/internal base URL used for smoke checks
- deploy path on the VM, for example `/opt/<app-name>`
- systemd service name, for example `<app-name>`
- runner name expected to perform the deploy
- runner labels required by the workflow

Recommended base URL secrets:

- `STAGING_BASE_URL`
- `PRODUCTION_BASE_URL`

Current DTO repository convention for environment-scoped secrets:

- `STAGING_HOST`
- `STAGING_PATH`
- `STAGING_BASE_URL`
- `STAGING_SSH_KEY`
- `STAGING_USER`
- `PRODUCTION_HOST`
- `PRODUCTION_PATH`
- `PRODUCTION_BASE_URL`
- `PRODUCTION_SSH_KEY`
- `PRODUCTION_USER`

Use `STAGING_PATH` and `PRODUCTION_PATH` for the default deployment path when the workflow supports it. Use `STAGING_BASE_URL` and `PRODUCTION_BASE_URL` for post-deploy verification.

Local development must not depend on GitHub environment secrets or variables. The application should run locally using defaults, `.env.example`, or a developer-owned local `.env` file. Staging and production values should only be required by deployment workflows.

Common environment variables can be configured under the GitHub environment `Variables` section when they are not secret:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_FROM`

If the self-hosted runner is installed directly on the target VM, SSH secrets are not required because the deploy installs locally.

If the runner deploys to another VM over SSH, configure environment secrets using a consistent naming pattern:

- `<ENV>_HOST`
- `<ENV>_USER`
- `<ENV>_SSH_KEY`
- `<ENV>_PATH`

For staging and production separation, use environment-scoped secrets rather than repository-wide secrets where possible.

### Current standard staging target

Unless a project says otherwise, the current shared staging VM is:

- host: `cwscx-tst01.cwsey.com`
- IP: `172.17.1.213`

This is the current universal staging environment. It may change later. If a project has a different staging target, use the project-specific target instead.

Typical staging values for the current shared staging VM:

- `STAGING_HOST`: `cwscx-tst01.cwsey.com`
- `STAGING_PATH`: `/opt/<app-name>`
- `STAGING_BASE_URL`: `https://cwscx-tst01.cwsey.com`

If NGINX uses a self-signed certificate, the verification script should use `curl -kfsS` so the smoke check still works.

### Local development vs deployment values

Local development must stay simple.

Developers and testers should be able to run the application locally without GitHub secrets. Local values should come from:

- built-in safe defaults
- `.env.example`
- a local `.env` file that is not committed

GitHub environment secrets and variables are for staging and production deployment only. They should not be required just to run the application on a developer laptop.

## 10. Self-hosted runner standard

A self-hosted runner is a small GitHub agent installed on a VM. GitHub sends deployment jobs to it.

For internal DTO applications, deploy jobs should run on a runner that is inside the network and can reach the target VM.

There are two valid patterns:

- local deploy runner: the runner is installed directly on the target VM and deploys into local folders such as `/opt/<app-name>`
- remote deploy runner: the runner is installed on another internal VM and deploys to the target VM over SSH

Prefer local deploy runners for simple single-VM applications because no SSH key is needed between VMs.

### Pre-production runner

- installed on the shared pre-production VM or another internal VM with access to it
- labels: `self-hosted`, `linux`, `staging`
- existing shared runners can be reused if they have network reachability and the workflow labels match
- if an existing runner only has `self-hosted`, either add environment labels or deliberately target `self-hosted` in the workflow for that environment
- example existing staging runner: `cwscx-tst01` with label `self-hosted`

The current shared staging VM is `cwscx-tst01.cwsey.com` unless a project states another staging target.

### Production runner

- installed on the dedicated production app VM or another internal VM with guaranteed reachability
- labels: `self-hosted`, `linux`, `production`
- production should normally use a dedicated runner or a runner protected through the `production` environment approval rules

### Minimal requirements

- internet access to GitHub or GitLab
- write access to `/opt/<app-name>`
- passwordless sudo only for approved deploy commands
- `git`, `bash`, `systemctl`, `nginx`, `rsync`, `zip`, `unzip`, `curl`

Also install the runtime tools required by the application, for example:

- Node.js and npm for frontend or Node-based report scripts
- Python 3 and `python3-venv` for FastAPI backends

### How to check if a runner already exists

Check in GitHub first.

For a repository-level runner:

1. Open the repository in GitHub
2. Go to `Settings > Actions > Runners`
3. Look for an online runner with the expected name and labels

For an account-level or organization-level runner:

1. Open the account or organization settings in GitHub
2. Go to `Actions > Runners`
3. Confirm whether the runner is available to the repository

Plain-language rule:

- If the runner appears under the repository runners page, the repository can use it.
- If the runner appears only under another repository, this repository cannot use it.
- If the runner appears under organization or account runners and is assigned to this repository, the repository can use it.
- If the runner is not visible to the repository, register a new runner or update runner access from the account/organization runner settings.

On the VM, check running runner services with:

```bash
sudo systemctl list-units --type=service | grep actions.runner
sudo systemctl status actions.runner*
```

The service name usually shows the owner, repository, and runner name. Example:

```text
actions.runner.GregoryPana-b2b-cx-platform.cwscx-tst01.service
```

That example means the runner is registered for `GregoryPana/b2b-cx-platform`. It does not automatically mean it is available to another repository.

### When to reuse an existing runner

Reuse an existing runner when all of these are true:

- it is visible to the repository in GitHub
- it is online
- it is inside the network needed for deployment
- it has the labels used by the workflow `runs-on` line
- it has permission to write to the deploy path
- using it will not mix deployments from unrelated applications into the same folder

If the runner is account-level or organization-level, reuse is usually fine if labels and access are controlled correctly.

If the runner is repository-level for another repository, do not assume it can be reused. Register a new runner for the new repository or create an account/organization-level runner that is deliberately shared.

### How to avoid interfering with an existing runner

Do not install a new runner into the same folder as an existing runner.

Use a separate folder per runner, for example:

```bash
/home/<user>/actions-runner-existing-app
/home/<user>/actions-runner-new-app
```

Use a separate runner name per repository or application, for example:

```text
cwscx-tst01-existing-app
cwscx-tst01-new-app
```

Install each runner as its own systemd service using `./svc.sh install <user>` from that runner folder.

This creates separate services similar to:

```text
actions.runner.<owner>-<repo>.<runner-name>.service
```

This avoids interference because each runner has:

- its own folder
- its own registration token
- its own systemd service
- its own working directory
- its own repository access

### How to register a new repository-level runner

Use this when no suitable runner is visible to the repository.

In GitHub:

1. Open the repository
2. Go to `Settings > Actions > Runners`
3. Click `New self-hosted runner`
4. Choose `Linux` and the correct CPU architecture, usually `x64`
5. GitHub will show download and configure commands

On the VM, create a new folder for this runner:

```bash
mkdir -p /home/<user>/actions-runner-<app-name>
cd /home/<user>/actions-runner-<app-name>
```

Run the GitHub-provided download commands in that folder.

Then run the GitHub-provided configure command. Use a clear runner name:

```bash
./config.sh --url https://github.com/<owner>/<repo> --token <token-from-github> --name <vm-name>-<app-name> --labels self-hosted --unattended
```

If the workflow expects labels such as `linux` and `staging`, include them:

```bash
./config.sh --url https://github.com/<owner>/<repo> --token <token-from-github> --name <vm-name>-<app-name> --labels self-hosted,linux,staging --unattended
```

Install the runner as a systemd service:

```bash
sudo ./svc.sh install <user>
sudo ./svc.sh start
```

Check it is running:

```bash
sudo systemctl status actions.runner*
```

Then return to GitHub and confirm the runner appears as online under `Settings > Actions > Runners`.

### How to register an account-level or organization-level runner

Use this when one runner should be shared across multiple repositories.

In GitHub account or organization settings:

1. Go to `Actions > Runners`
2. Create a new runner there instead of inside a single repository
3. Configure repository access so only approved repositories can use it
4. Use clear labels, for example `self-hosted`, `linux`, `staging`

Only use shared runners when labels and access are controlled. A shared runner with only `self-hosted` can accidentally pick up jobs from the wrong repository if multiple workflows target only `self-hosted`.

### Runner label rule

GitHub routes jobs by labels, not by the runner service name.

If a workflow says:

```yaml
runs-on: [self-hosted, linux, staging]
```

Then the runner must have all three labels:

```text
self-hosted
linux
staging
```

If a runner only has:

```text
self-hosted
```

Then the workflow must either target only `self-hosted`, or the runner must be updated with the missing labels.

For safety, prefer specific labels such as:

```text
staging
production
<app-name>
```

This prevents the wrong runner from picking up a deployment.

## 11. Repository standards

Every repo should include:
- `README.md`
- `.env.example`
- `.gitignore`
- `backend/`
- `frontend/`
- `scripts/`
- `docs/`
- CI/CD workflow files

See `05_REPOSITORY_STRUCTURE_STANDARD.md`.

## 12. GitHub workflow design rules

- avoid putting important business logic only inside workflow YAML
- keep reusable deploy logic in scripts
- do not require interactive commands
- do not deploy from a developer laptop
- do not use destructive DB reset steps in deploy
- verify exact commit and clean workspace before building release
- use an environment-agnostic verification script name such as `verify_release.sh`
- validate required deployment environment values before installing a release

## 13. Future GitLab CE design rules

When moving to GitLab CE later:
- keep the same release bundle concept
- keep manual staging and production jobs
- use GitLab runners inside the internal network
- keep scripts under `scripts/linux/`

## 14. Beginner step-by-step: first staging deploy

1. Confirm the repo is pushed
2. Confirm CI passes
3. Confirm pre-production runner is online
4. Confirm `/opt/<app-name>/.env` exists on the VM
5. Open GitHub Actions
6. Select the staging workflow
7. Click `Run workflow`
8. Wait for the job to complete
9. Open the application URL
10. Check `/api/health` and `/api/health/ready`

## 15. Troubleshooting

### Problem: deploy job never starts

Likely causes:
- self-hosted runner offline
- wrong labels in workflow
- environment protection waiting for approval

Checks:
- GitHub -> Settings -> Actions -> Runners
- confirm the runner name is online, for example `cwscx-tst01`
- confirm the workflow `runs-on` labels match the labels attached to that runner
- runner service status on VM

### Problem: deploy reaches VM but fails with permissions error

Likely causes:
- runner user cannot write under `/opt/<app-name>`
- sudoers config incomplete

Checks:
- folder ownership
- `sudo -l` for runner user

### Problem: build or deploy behaves unexpectedly and looks stale

Likely causes:
- self-hosted runner workspace contains stale files
- wrong branch or wrong commit is still present in workspace
- previous build artifacts were not cleaned

Checks:
- confirm the workflow hardening step ran
- confirm exact commit checkout happened
- confirm `git clean -ffdx` ran before build
- see Section 7 for the required self-hosted runner hardening behavior

### Problem: staging deploy works but production deploy cannot connect

Likely causes:
- production runner is not inside the reachable network
- DNS or firewall issue
- production workflow still assumes public SSH/SCP

### Problem: rollback is impossible

Likely causes:
- no release archive retained
- deployment is copying files directly without packaging

## 16. Required operational reminders

- always keep previous release bundles
- always verify routes after deploy
- always keep deploy scripts in source control
- always document runner names and labels

## 17. Templates in this folder

- `templates/github/workflows/deploy-staging.yml.template`
- `templates/github/workflows/deploy-production.yml.template`
- `templates/gitlab/.gitlab-ci.yml.template`
