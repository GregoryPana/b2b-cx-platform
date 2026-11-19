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
| `analytics-release-preflight` | manual | Read-only inspection of staging or production hosts | Candidate to retire or fold into a "preflight" step |
| `analytics-host-repair` | PR, push, manual | One-off repairs (for example staging TLS) plus tests for the artifact script | Candidate to retire the manual repair once it is no longer needed; its tests stay |

## 3. Why there are "so many" deploy actions

- **Different instances.** Internal and DMZ differ in auth mode, build, host and approval environment, so they cannot
  share one deploy.
- **Separation of duties.** Building, validating and installing are separate jobs on separate runners with their own
  environment approvals. This is deliberate: it is what lets production trust a staging result.
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
   and producer, and still waits for the `production` environment approval. The three existing workflows stay for
   manual use and recovery. Value: removes the copy and paste step, not any safety check.
2. **Reusable workflows for the shared shell.** Move the install and rollback script into one reusable workflow or a
   script under `scripts/linux/` called by staging and production. Lower risk if done as a script first.
3. **Retire the analytics helpers** once the incidents they were written for are closed, keeping their unit tests.
4. **Delete the unused change-detection jobs** (or make them gate something), so nobody assumes they do.

Not recommended: merging internal and DMZ deploys, or letting production rebuild. Both would weaken the guarantee
that production runs exactly what was tested.

## 6. Open questions for the owner

- Are `analytics-release-preflight` and the manual repair path of `analytics-host-repair` still used?
- Should `promote` pause for approval between staging and production, or only at the existing `production`
  environment gate?
