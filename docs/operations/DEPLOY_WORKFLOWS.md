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
| `analytics-release-preflight` | manual | Read-only host check before a release (details in 2a). Still valid today. | Keep; run before risky releases. Not part of the normal chain |
| `analytics-host-repair` | PR, push, manual | CI tests for the release-artifact script (runs automatically) plus a manual NGINX/TLS repair (details in 2a) | Keep the tests. The manual repair is break-glass: keep it, do not run it routinely |

### 2a. What the two analytics workflows actually do (read from the files, 2026-11-19)

**`analytics-release-readonly-preflight`** (manual, target staging or production, read-only, 24 runs, last 2026-10-19).
On the target host it checks: the hostname is the expected one; `cwscx-backend` is active and runs from `/opt/cwscx`;
at least 1 GB of disk is free; `/health` reports the database healthy; six key backend files match the checked-out
source (`require_installed_source` makes a mismatch fatal); the live database Alembic head equals
`20260714_000032` (the current head in this repo) and the auth-timestamp catalog is compatible; an anonymous call to
`/dashboard-visits/all` returns 401; the NGINX site and its TLS certificate map to the right hostname and the served
certificate is the configured one; and the served dashboard bundle is identical to the installed file. It also lists
rollback bundles and certificates. It changes nothing.
Overlap with the normal chain: the deploys already run a health check, `nginx -t`, and (production/staging) the
artifact digest validation. They do not check the database head, installed-source equality or certificate match.
**Caveat:** the expected head is hard-coded. The next Alembic migration will make this workflow fail until the value
is updated, so it must be bumped with every migration or it will give a false alarm.

**`analytics-host-repair`** has two jobs. `test` runs automatically on pushes and PRs that touch the artifact or repair
scripts (unit tests in a locked-down container); this is the part that keeps running. `repair` is manual
(`staging_tls` or `production_site`) and runs `scripts/linux/analytics_host_repair.py` as root on the host to fix
the NGINX site and TLS certificate, restoring the old files if verification fails. It ran 3 times, last on
2026-10-15, for the analytics release incident. It reaches the `production` host and reconfigures NGINX, so it is a
break-glass tool rather than a deploy step.

**Assessment.** Neither is dead code, and neither should be deleted on a hunch. They are not part of the release chain,
which is why they feel like clutter. The cheapest fix is naming and documentation, not removal: label them as
"pre-release host check" and "emergency repair", mention them in the runbook, and make the preflight's expected
database head read from the repo instead of a literal.

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
3. **Keep and relabel the analytics helpers** (see 2a) instead of retiring them; derive the preflight's expected database head from the repo.
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
- **Still open:** is the preflight wanted as a step in `promote` (a read-only check before production), or kept as a
  separate manual tool?
