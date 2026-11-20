# Deploy workflows: what exists, why, and what could be simpler

Audience: whoever runs or maintains releases. Written 2026-11-19 from the workflow files on `main`
(`.github/workflows/`, about 1,900 lines across 13 files). Nothing here changes behaviour; it is a map and a set of
proposals.

## 1. How a release reaches production today

Production internal (Entra) is a three-step chain, started by hand each time:

| Step | Workflow | Runs on | Needs from you | Produces |
|---|---|---|---|---|
| 1 | `deploy-staging` | GitHub runner (tests/builds), then `cwscx-tst01` | nothing | A staging deploy and a run id |
| 2 | `export-validated-staging` | `cwscx-tst01` | the staging run id | The exact staging ZIP as an artifact, plus its SHA256 and source commit |
| 3 | `deploy-production` | `production` runner | export run id, SHA256, source commit | The same ZIP installed on `cwscx-app01` |

Production never rebuilds. It downloads the artifact from step 2 and validates the ZIP against the digest, source
commit and producing run you supply (`scripts/linux/analytics_release_artifact.py validate`). So what reaches
production is byte-for-byte what was tested on staging.

The DMZ (mystery-shopper public instance) is a separate chain: `deploy-mystery-public` with an `action` of
`establish_baseline`, `deploy`, `rollback` or `recover`. It builds its own signed bundle (`release/SHA256SUMS`),
needs the previous good release id as `fallback_release_id`, and waits for approval on the `mystery-public`
environment.

## 2. Every workflow, and whether it earns its place

| Workflow | Trigger | Purpose | Verdict |
|---|---|---|---|
| `backend-ci`, `frontend-dashboard-ci`, `frontend-survey-ci` | push / PR | Tests and builds. `test` is a required check. | Keep |
| `mystery-public-release-ci` | push / PR | Builds and validates the DMZ bundle. Job `release-contract` is a required check. | Keep |
| `analytics-calculation-assurance` | push / PR / manual | Analytics maths checks | Keep |
| `tutorial-drift-guard` | PR | Warns when a recorded screen changes. Non-required by design. | Keep |
| `deploy-staging` | manual | Test, build, install on staging | Keep |
| `export-validated-staging` | manual | Freeze the tested ZIP | Keep, but see section 4 |
| `deploy-production` | manual | Install the frozen ZIP | Keep |
| `deploy-mystery-public` | manual | DMZ build, deploy, rollback, recover | Keep |
| `mystery-public-preflight` | manual | Read-only check of the DMZ host | Keep (cheap safety check before a first or risky DMZ deploy) |
| `analytics-release-preflight` | removed 2026-11-20 | Was a manual read-only host check | Removed (see 2a) |
| `analytics-host-repair` | PR, push | CI tests for the release-artifact and repair scripts only. Manual repair job removed 2026-11-20. | Keep the tests |

### 2a. The two analytics workflows (history)

On 2026-11-20 the manual parts were removed on the owner's instruction. What they did, for the record and in case
any of it is wanted back:

- **`analytics-release-readonly-preflight` (deleted).** Read-only host check, last run 2026-10-19: service running,
  disk >= 1 GB, `/health` and database healthy, six backend files equal to the checkout, live Alembic head equal
  to a hard-coded `20260714_000032`, anonymous API returns 401, NGINX site and TLS certificate correct, served
  dashboard bundle equal to the installed one. The normal deploys do not cover the database head, installed-source or
  certificate checks. Restore it from git history if needed. The hard-coded head had to be bumped for every migration.
- **`analytics-host-repair`, manual `repair` job (deleted).** Ran `scripts/linux/analytics_host_repair.py` as root to
  fix NGINX and TLS (`staging_tls`, `production_site`), restoring old files if verification failed; last run
  2026-10-15. The `test` job stays and runs automatically.
- **Left in place:** `scripts/linux/analytics_host_repair.py` and its tests, and `inspect_auth_timestamp_metadata.py`.
  Nothing calls the repair script now. It can be deleted later together with its tests if it is judged obsolete.

## 3. Why there are "so many" deploy actions

- **Different instances.** Internal and DMZ differ in auth mode, build, host and approval environment, so they cannot
  share one deploy.
- **Separation of duties.** Building, validating and installing are separate jobs on separate runners. This is
  deliberate: it is what lets production trust a staging result. Only the DMZ `mystery-public` environment has a
  required reviewer; `staging` and `production` have none (checked 2026-11-19).
- **Historical helpers.** The two analytics workflows were added for specific incidents (a host repair, a release
  inspection). They are still listed beside the real deploys, which is most of the noise.
- **Manual handoff.** Nothing links step 1 to 2 to 3, so you copy a run id, a SHA256 and a source commit between
  forms. That handoff is the part that feels heavy, and it is also where a typo can cost a failed run.

## 4. Duplication worth knowing about

- `deploy-staging` and `deploy-production` both contain a "detect changed components" job with nearly the same path
  filters. In production the result is only read for the summary text; it does not gate the deploy. Staging's gate is
  always true for a manual run.
- Both deploy jobs carry their own copy of the install, health-check and rollback shell (`deploy_release` and
  `rollback_release` functions, repeated and only differing in host names and site name).
- The DMZ workflow is about 500 lines because four actions live in one file with repeated host checks.

## 5. Proposals, in order of value and safety

1. **A `promote` workflow (recommended; planned as the next item).** One manual workflow that runs staging, then
   export, then production in sequence, passing the run id, SHA256 and source commit between jobs automatically.
   Keep every existing gate: the production job still downloads the artifact, still validates digest, source commit
   and producer, and still stops on a bad digest. (Today `production` has no required reviewer, so there is no human pause; see section 6.) The three existing workflows stay for
   manual use and recovery. Value: removes the copy and paste step, not any safety check.
2. **Reusable workflows for the shared shell.** Move the install and rollback script into one reusable workflow or a
   script under `scripts/linux/` called by staging and production. Lower risk if done as a script first.
3. Retire the analytics helpers: done 2026-11-20 (manual parts removed, see 2a).
4. **Delete the unused change-detection jobs** (or make them gate something), so nobody assumes they do.

Not recommended: merging internal and DMZ deploys, or letting production rebuild. Both would weaken the guarantee
that production runs exactly what was tested.

## 6. Decisions

- **Approvals (decided 2026-11-19):** for now there is no required reviewer on `staging` or `production`. The control
  is the pull request: a commit is approved on `main` (one approving review, required checks) and then deployed.
  The DMZ keeps its required reviewer on `mystery-public`. Today only the DMZ deploy waits for a human.
- **Keep the option open.** A required reviewer on `production` can be added later in GitHub (Settings, Environments,
  production) with no workflow changes, because the deploy jobs already name `environment: production`. The
  `promote` workflow must be written so that the production job keeps that `environment:` line and any later
  reviewer takes effect automatically. Do not remove it.
- **Preflight:** removed, so `promote` will not include it.
