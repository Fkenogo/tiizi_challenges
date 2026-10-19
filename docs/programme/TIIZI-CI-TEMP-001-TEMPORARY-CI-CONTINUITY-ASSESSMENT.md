# TIIZI-CI-TEMP-001 — Temporary CI Continuity Assessment

**TEMPORARY INFRASTRUCTURE CONTINUITY ASSESSMENT
NOT A CI PROVIDER MIGRATION
NOT AUTHORIZATION TO MERGE BLOCKED PRs
NOT AUTHORIZATION TO BEGIN MC-2B**

**Authority:** Founder Direction — Miledge Engineering Update: Temporary CI Continuity (2026-10-15).
**Date:** 2026-10-15. **Canonical base inspected:** `origin/main` @ `a358b308ee583c2dfc2715668b4a1be8eda714e0`.
**Branch (isolated, LOCAL ONLY, unpushed):** `docs/tiizi-ci-temp-001`.
**Status:** ASSESSMENT ONLY. Nothing activated, no settings changed, no PR opened/merged.
**Programme constraint (preserved):** MC-2A / PR #93 remains under its existing STOP instruction
pending Founder disposition; this assessment does not alter that state.

## Phase 1 — Repository and CI inventory (from repository truth @ `a358b30`)

- **Workflow files:** exactly one — `.github/workflows/ci.yml` (workflow name `ci`; triggers:
  `push` to `main`, all `pull_request`). No other workflow, Dependabot, or codeowners config
  (`.github/` contains only `workflows/`).
- **Jobs (all `ubuntu-latest`, six total):**

| Job (check name) | Steps |
|---|---|
| `api (typecheck, test, build)` | checkout; setup-node 22 + npm cache (`api/package-lock.json`); `npm ci`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `build` (`tsc`) in `api/` |
| `api image (build, liveness)` | checkout; `docker build -f api/Dockerfile`; `docker run` with dummy env (`DATABASE_URL` placeholder, `FIREBASE_PROJECT_ID=ci-project`); `curl /health` = 200; `/ready` must be exactly 503; container cleanup (`always`) |
| `web (typecheck, build)` | checkout; setup-node 22; `npm ci` at root, `functions/`, `api/` (root typecheck resolves cross-package imports); root `npm run build` (`tsc -b && vite build`) |
| `functions (build, typecheck)` | checkout; setup-node 22; `npm ci`, `build`, `lint` (`tsc --noEmit`) in `functions/` |
| `boundary (V1 exclusion + API namespace)` | checkout; setup-node 22; root `npm ci`; five guards: `test:boundary`, `test:boundary-regression`, `test:v2-experience-boundary`, `test:v2-runtime-boundary`, `test:s5b-today` |
| `api contract (/api namespace)` | checkout; setup-node 22; `npm ci` in `api/`; `npx vitest run test/apiNamespaceContract.test.ts` |

- **Verification-surface mapping:** lint = `functions` lint (tsc) only — no eslint/style gate anywhere;
  typecheck = api/web(via build)/functions/boundary(implicit); unit tests = api `vitest run`
  (PGlite-backed, `@electric-sql/pglite` in api deps); integration = same suite + api-image
  liveness/readiness; **no Firebase/emulator tests in CI** (8 Firestore-emulator tests skip
  without an emulator); **no database service in CI** (no Postgres service; PGlite in-process);
  **no browser/E2E** (no Playwright in CI); build verification = api/web/functions + docker image;
  security/contract/schema = api-contract + boundary guards + `audit:secrets` exists as a script
  but is NOT wired into CI; docs/governance checks = boundary guards (AGENTS.md/V2 namespace).
- **Runtimes:** Node 22 (GH `setup-node` `node-version: 22`; engines: api `>=20`; Dockerfiles
  `node:22-slim`); npm (`npm ci` everywhere; lockfiles at root/api/functions); **no Python, no
  Java, no browser dependency in CI**; Docker required (api-image job only).
- **External services/secrets/env:** NONE. `grep secrets. .github/workflows/` returns nothing;
  api-image uses inline dummy values. No secret is needed to reproduce CI.
- **Branch protection:** `GET branches/main/protection` → **404 "Branch not protected."**
  There are NO required status checks and NO protection dependencies. (This is load-bearing
  for Phase 7.)

## Phase 2 — Blocked work inventory (billing-startup failures, NOT test failures)

GitHub Actions is failing at runner startup on every recent run with the annotation
*"The job was not started because your account is locked due to a billing issue."*
Jobs never start (3–5s runs); this must never be read as an application-test signal.

| PR | Branch | Head SHA | Base | Merge state | Required checks | Latest Actions result |
|---|---|---|---|---|---|---|
| #93 | `docs/mc2-profile-foundation-readiness` | `9b18811` | main | OPEN, MERGEABLE, UNSTABLE | none (unprotected) | failure — billing startup (run 38528899580, 4s) |
| #94 | `docs/ci-efficiency-alignment-001` | `ab50718` | main | OPEN, MERGEABLE, UNSTABLE | none (unprotected) | failure — billing startup (runs 38527626958/38528912002, 4–5s) |

- PR #93 (MC-2A) included for completeness; its separate Founder STOP disposition is preserved —
  this assessment proposes no merge action on it.
- PR #94 is itself CI-related (CI-efficiency alignment: PR-only cancel-in-progress + record;
  touches `.github/workflows/ci.yml` + a programme record). Its failures are likewise
  startup/billing, not test failures.

## Phase 3 — Local verification baseline

- **Already-run mandatory verification (evidence, not re-executed here):** MC-1 main-line code
  passed hosted CI run #264 (6/6 green, run 38139796235); docs-only heads on the same tree
  (`c8dd05a` era) passed 6/6 when Actions was available. Real-PostgreSQL MC-1 concurrency proof
  and PGlite suites are recorded in programme records.
- **Local toolchain present (this machine):** Node v22.23.2, npm 10.9.8, Docker available —
  sufficient to reproduce every CI job locally.
- **Proportionate local verification actually run in this assessment:** static, no installs —
  (a) proposed CircleCI YAML parses and its 6 jobs mirror the 6 GitHub jobs 1:1;
  (b) every npm script the proposal invokes exists in root/api/functions `package.json`
  (`typecheck/test/build/lint/test:boundary/test:boundary-regression/test:v2-experience-boundary/test:v2-runtime-boundary/test:s5b-today`);
  (c) `test/apiNamespaceContract.test.ts` target exists; (d) `git diff --check` clean.
  No heavy `npm ci` matrix was run: it would duplicate green evidence at disproportionate
  cost for an assessment whose deliverable is the continuity design.
- **Hosted-only dependencies:** NONE. Nothing in CI needs an emulator, a hosted database, a
  secret, or a browser. The api-image job needs only a Docker daemon (present on CircleCI
  machine executors and locally).

## Phase 4 — CircleCI Free feasibility (checked against current provider docs, Oct 2026)

**A. Runtime compatibility — COMPATIBLE.** `cimg/node:22.20` (verify tag at activation; never
`lts`, which no longer means Node 22) on `small` (1 vCPU/2 GB, 5 credits/min) covers all five
node jobs; `ubuntu-2204:current` machine `medium` (10 credits/min) covers api-image with native
Docker. npm caching via checksum-keyed cache (no paid DLC). No Python/Java/browser needed.

**B. Test/service compatibility — COMPATIBLE.** PGlite tests run in-process (no service);
no emulator/service/secret required; docker build/run/curl works natively on the machine
executor; all repository scripts invoked already exist.

**C. GitHub integration — VERIFIED from docs:**
- CircleCI builds GitHub PRs (trigger "PR opened or pushed to"); same-repo PRs need no fork
  settings (both open PRs are same-repo branches).
- **Exact-head verification: YES.** `CIRCLE_SHA1` is the commit under test; the `checkout`
  step checks out that revision; the proposal *asserts*
  `test "$(git rev-parse HEAD)" = "$CIRCLE_SHA1"` and prints SHA + PR + branch every job.
- Statuses appear on the GitHub PR automatically as `ci/circleci: <job>` (job-level status
  updates; optional workflow-level GitHub Checks via the CircleCI web app — admin action,
  not required for the pilot).
- Branch protection CAN recognize `ci/circleci:*` names — but there is nothing to satisfy:
  main is unprotected, so this is moot (see Phase 7).
- Required check names are provider-specific: CircleCI can **never** satisfy GitHub Actions'
  check names (`api (typecheck, test, build)` etc.). Explicitly decoupled below.

**Two separate findings (must not be conflated):**
1. *"CircleCI can independently verify the exact PR SHA"* — **TRUE**, by design + assertion step.
2. *"CircleCI can satisfy the existing GitHub protected-branch required check"* — **VACUOUSLY
   TRUE: there are no required checks** (main unprotected). It cannot and need not reproduce
   Actions' check names.

**D. Free-tier feasibility — FEASIBLE with large headroom.**
- Allowance: 30,000 credits/month Free (private usage); repository is PUBLIC, so the 400,000
  open-source Linux allowance may additionally apply. 5 free active users (Tiizi needs ~2);
  extra users cost 25,000 credits each — watch only if bots/humans exceed 5.
- Rates (2026-08-31 price list): docker `small` 5/min, `medium` 10/min; machine `medium`
  10/min; remote-Docker avoided by using the machine executor; no DLC.
- Estimate: ~14 node job-minutes × 5 + ~3 machine minutes × 10 ≈ **~100 credits/run** →
  ~15 checkpoint runs over ~2 weeks ≈ **~1,500 credits (~5% of the 30k allowance)**.
- Concurrency on Free is lower than paid — the 6-job workflow simply takes longer if
  serialized; no design change needed (no matrix, no fan-out beyond 6 jobs).
- No credit card expected for Free signup (verify at signup; no paid plan created — DO NOT
  create one). Private repos supported on Free regardless (moot: repo is public).

**No material CircleCI limitation found → no second provider assessed** (per objective).

## Phase 5 — Minimum temporary pipeline design

- One workflow (`verify`), six jobs, same names/shapes as GitHub CI, parallel like today.
- Economy levers (no per-commit waste): enable **"Auto-cancel redundant workflows"** in
  CircleCI Project Settings (safe, reversible — mirrors PR #94's cancel-in-progress intent)
  + procedural rule: push only meaningful checkpoints. No config-level path filtering (keeps
  the proposal minimal and reviewable).
- Proposal: `.circleci/config.yml` (in this isolated branch, unmerged, inactive). Validated:
  YAML parses; job set == GitHub job set; every invoked script exists.
- Exact diff: new file `.circleci/config.yml` (~270 lines, header documents purpose, cost,
  activation checks) + this record. Shown in STOP report; full text stays on the local branch.

## Phase 6 — Secrets and manual setup (Founder/account actions — NOT performed)

1. CircleCI account via GitHub sign-in (free; verify no card demanded).
2. Create/select the CircleCI organization for the GitHub user/org.
3. "Set Up Project" for `Fkenogo/tiizi_challenges` (GitHub App install path from the
   CircleCI web app ONLY — never start from GitHub; requires GitHub admin on the repo).
4. Confirm trigger covers PRs ("PR opened or pushed to"); leave fork-PR builds OFF
   (both PRs are same-repo; no secret exists to leak to forks anyway).
5. Enable "Auto-cancel redundant workflows" (Project Settings → Advanced).
6. (Optional) Enable GitHub Checks for the Checks tab (admin; job-level statuses work regardless).
7. Secrets/env vars: **NONE required** (verified: zero `secrets.*` in `ci.yml`; dummy env is
   inline). Nothing to copy, nothing to print.
8. Branch filters: none needed (assessment-time pushes are manual checkpoints).
9. **No GitHub required-check configuration needed** (main unprotected; determination A).

## Phase 7 — Branch protection decision

**A. No branch-protection change required.** Main is unprotected; there are no required checks
to satisfy, keep, waive, or re-point. CircleCI statuses (`ci/circleci: *`) will appear on PRs
as independent evidence without touching any setting.

Recommended temporary operating procedure (safer than any settings change):
**local verification → CircleCI independent exact-head verification → technical review →
Founder merge authorization**, with GitHub's (currently non-reporting) checks treated as
unavailable evidence, never as passed. No required check is bypassed because none exists;
CircleCI results are recorded as *independent verification*, never represented as a GitHub
Actions pass.

## Phase 8 — Rollback / GitHub Actions restoration

1. Confirm billing restored; re-run normal GitHub Actions on all outstanding exact heads
   (PR #93, #94) and require green before any merge decision.
2. Restore GitHub Actions as the sole primary hosted CI (no config change needed — `ci.yml`
   is untouched by this assessment).
3. In CircleCI: turn off PR triggers / unfollow the project; uninstall the GitHub App
   installation IF one was created for the pilot (Org Settings → VCS Connections).
4. Delete the temporary branch and remove `.circleci/config.yml` (it must not linger as a
   second CI authority); keep this assessment record as history.
5. Retain only genuinely useful residue (e.g. local-first verification notes), if any.
6. Confirm zero paid resources (none creatable on Free without explicit purchase — verify
   plan page shows Free, 0 purchases) and zero secrets introduced (none ever existed).
7. No branch-protection restoration needed (nothing was changed).

## Phase 9 — Documentation (this record)

File: `docs/programme/TIIZI-CI-TEMP-001-TEMPORARY-CI-CONTINUITY-ASSESSMENT.md` (this file),
on isolated local branch `docs/tiizi-ci-temp-001` with `.circleci/config.yml`.
Unpushed, unactivated, unmerged — full text available for Founder review on request.

## Addendum TIIZI-CI-TEMP-001A — CircleCI pilot readiness (2026-10-15, branch HEAD only)

Heads re-confirmed: `origin/main` @ `a358b30`; PR #93 @ `9b18811` OPEN; PR #94 @ `ab50718` OPEN.

**1. Six-job equivalence audit (`.github/workflows/ci.yml` vs `.circleci/config.yml`, command-level).**
All six jobs reproduce the GitHub commands 1:1 (same `npm ci` order — including root →
functions → api sequencing in `web`; same five boundary guards; same vitest target file;
same api-image dummy env, `curl /health`, `/ready == 503`, `always()` cleanup).
Meaningful differences (all benign, none weakens verification):
- Node `22` (floating 22.x) → pinned `cimg/node:22.20` (tag EXISTENCE verified
  `2026-10-15` via `docker manifest inspect`; refresh at activation, never `lts`).
- `ubuntu-latest` → `cimg/node` (Debian) for node jobs, `ubuntu-2204:current` for Docker —
  equivalent for node/npm/curl workloads.
- `setup-node` npm cache → explicit checksum-keyed `restore/save_cache` (per-package keys;
  parameterized cache commands were REMOVED after audit — nested parameter-in-checksum
  templating is of uncertain support, so all cache keys are now literal).
- `checkout@v4` (shallow) → CircleCI `checkout` + explicit SHA assertion (stronger, not weaker).
- `auto-cancel` is a reversible Project Setting, not config syntax (mirrors PR #94 intent).
- No secrets in either; no test exclusions added; no matrix; no conditional skips.

**2. Exact-head strategy (selected: separate config/checkout + `target-sha` parameter).**
Per official docs ("Trigger options": web/API triggers accept separate `config` and
`checkout` refs plus `parameters`; "Pipeline values": `CIRCLE_SHA1` = last commit of the
build; `pipeline.git.*` describe the checkout state): the pilot triggers with config =
isolated branch, checkout = target PR branch (or `pull/<n>/head`), `target-sha` = exact
commit. Config fetches + checks out `target-sha` and FAILS CLOSED on mismatch; empty
`target-sha` preserves ordinary mode (assert HEAD == CIRCLE_SHA1). The three SHAs
(config-source, CIRCLE_SHA1, code-under-test) are printed in every job. CIRCLE_SHA1 alone
was NOT relied upon — its meaning varies by trigger type, hence the parameter + assertion.
Caveat recorded in-config: statuses may attach to the config-source commit, so pilot
evidence = run URL + asserted SHAs + job results (externally accessible), NOT a PR status.
Full PR-status association would require in-PR config — a separate Founder decision that
would touch PR #93 under STOP (not proposed).

**3. Cost/triggers reconfirmed.** ~100 credits/run (≈70 node + ≈30 machine); ~1,500 per
15 runs (« 30k Free; public repo may draw on 400k OSS). Trigger = MANUAL web/API invocation
only (exactly one pipeline per invocation; no automatic triggers enabled during pilot) —
this is the checkpoint-execution preference implemented.

**4. Pilot target.** PR #94 head `ab50718` — an open PR SHA (proves the PR-SHA objective
literally) with zero product-code change; its SHA is untouched by this method. Fallback:
`origin/main` @ `a358b30` baseline. Either executes all six jobs with externally
accessible evidence and no merge or stage change.

**5. Tool validation.** `cimg/node:22.20` tag verified existent. Vendor `circleci` CLI is
NOT installed (installing shared tooling judged disproportionate) — no `config validate`
run. Compensating evidence: YAML parses; only long-stable schema keys used (`version 2.1`,
`executors`, `machine`/`docker`, `resource_class` small/medium — both Free-eligible, no
approval-required classes, no DLC, no GPU); top-level `parameters` (2.1 feature) +
`<< pipeline.parameters.* >>` in `run` steps are canonical documented usage; every
invoked npm script verified present. Residual risk: vendor-schema edge cases — mitigated
because the FIRST pilot run itself is the validator (manual trigger, ~100 credits).

**6. Push/PR requirement.** YES — pushing the isolated branch is REQUIRED before any live
run (CircleCI reads config from GitHub). NOT done. No PR needs opening for the
parameterized pilot method; a Codex review of the config would additionally require a PR
(Founder decision — not requested).

**STOP: pilot design complete. No activation, no settings change, no merge, no MC-2B.**

## Addendum TIIZI-CI-TEMP-001C — Shared CircleCI OAuth Handover Reconciliation (2026-10-17)

**Mode:** bounded reconciliation only. No hosted pipeline, project activation, setting change, credential installation, push, merge, PR #93 action or programme-gate change was performed. **PR #93 remains under Founder STOP; MC-2B remains unauthorized.** MILEDGE-CI-INFRA-006 was used as technical guidance only.

### 1. Repository and revisions

- Repository confirmed through GitHub: public `Fkenogo/tiizi_challenges`, default branch `main`.
- `origin/main` in the isolated worktree is `a358b308ee583c2dfc2715668b4a1be8eda714e0`. GitHub's current recent-commit result and both open PR base SHAs also identify `a358b308ee583c2dfc2715668b4a1be8eda714e0` as the latest observed main commit. A direct `git ls-remote` refresh was blocked by this host's DNS/network failure.
- Isolated config worktree: `/private/tmp/tiizi-ci-temp`, branch `docs/tiizi-ci-temp-001`, starting HEAD `727569d6f910471755bfc82cf8e4355886403a5d`, two commits ahead of `origin/main`. It was clean before this reconciliation. The 001C config and this assessment update are now local uncommitted changes; no application code changed. The worktree remains isolated from the primary checkout and other worktrees.
- The primary `/Volumes/PRODUCTION/Projects/tiizi_revamp` checkout was already dirty with unrelated application and untracked files. It was not edited. The isolated CI worktree contains only the two intended 001C modifications.
- PR #93 is OPEN at `9b188119dfff6c09ebb5305bed78b1b22d4d5284`, branch `docs/mc2-profile-foundation-readiness`; STOP preserved.
- PR #94 is OPEN at `ab507184cb9aeb61fcd45bceacdf000bf2d7274d`, branch `docs/ci-efficiency-alignment-001`. Its live GitHub PR head was re-read immediately before preparation and matches the supplied SHA.

### 2. CircleCI identity and project state

- The MILEDGE handover records the shared CircleCI organization `gh/Fkenogo` (organization ID `080a287a-9598-4485-903b-128d09bd08b7`) and GitHub OAuth integration. That is historical evidence from 2026-10-16; this task did not repeat central identity troubleshooting.
- Local `circleci auth me` returns **“No CircleCI API token found.”** Therefore no authenticated read-only project query was possible. Whether `gh/Fkenogo/tiizi_challenges` exists, its project ID, pipeline definition ID, OAuth/App type, config path, follow state, triggers, project settings, environment variables and contexts remain **unverified**. No new org or project was created.
- Because the expected org slug is `gh/Fkenogo`, an existing project under it is expected to be OAuth, but that is not proof of Tiizi project integration type. No GitHub App-specific `pipeline.event.github.*`, `pipeline.event.name`, `pipeline.trigger.type`, or `pipeline.git.*` expressions occur in the proposed config; no event field is required for the manual run.
- **Do not push yet.** The project might be followed with an all-push OAuth trigger; the handover documents that pushes to a config-bearing branch can start builds. Read-only trigger/follow/settings checks are required before a separate push authorization.

### 3. 001C configuration correction and exact-head method

- Fixed the duplicate top-level `version: 2.1` key that made the 001A YAML invalid.
- Kept the existing `target-sha` parameter name, and made its empty default fail closed.
- Each of the six jobs now fetches the public config branch `docs/tiizi-ci-temp-001` over HTTPS and asserts that fetched config revision equals `CIRCLE_SHA1`. It then fetches only the approved PR #94 branch by explicit `refs/heads/docs/ci-efficiency-alignment-001`, asserts the fetched branch head equals the full `target-sha`, checks out that SHA detached, and asserts `git rev-parse HEAD` equals it. `CIRCLE_SHA1` is logged, not trusted as proof of the application SHA. All six jobs repeat the same guard before installing dependencies or running application commands.
- The job does not use CircleCI's `checkout` command or checkout SSH keys. Since this repository is public, both config-revision and target-revision Git fetches use anonymous HTTPS; there is no account-wide GitHub token and no key is installed. The CircleCI project/config retrieval mechanism itself still depends on the existing project integration, which is unverified.
- Config source will be this isolated branch after an authorized push. The final commit SHA for the 001C edits does not exist yet because the changes remain uncommitted; current branch HEAD remains `727569d6f910471755bfc82cf8e4355886403a5d`. Current proposed `.circleci/config.yml` blob SHA: `7a516ad65e62def4db62188eb7003a80bd81b0b1`.

### 4. Six-job equivalence

Compared with `.github/workflows/ci.yml` at the inspected main baseline: **six of six jobs retained, with commands, package directories, npm lockfiles, and failure behavior equivalent.** `api` keeps `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` in `api/`. `api-image` builds and starts the Docker image with dummy environment only, checks `/health` and `/ready == 503`, and removes the container with CircleCI `when: always`. `web` installs root, functions, then API dependencies with `npm ci` and runs the root typecheck/Vite build. `functions` keeps `npm ci`, build and `npm run lint` (TypeScript validation). `boundary` retains all five guards. `api-contract` keeps `npm ci` and `npx vitest run test/apiNamespaceContract.test.ts`. No tests, failure conditions, or cleanup were removed or softened.

### 5. Validation, executors and credit exposure

- `circleci config validate .circleci/config.yml`: **PASS** after correction. The first validation failed on the duplicate `version` key; the corrected config validates. `git diff --check`: clean.
- Executors remain Node `cimg/node:22.20` on Docker `small` for five jobs and `ubuntu-2204:current` on Linux VM `medium` for `api-image`; native Docker is used there, with no remote-Docker/DLC charge. CircleCI's current docs/pricing list x86 Docker small at 5 credits/min and Linux VM medium at 10 credits/min, and Free includes Linux/Docker resources. The existing 001A assessment records the `cimg/node:22.20` tag check on 2026-10-15; not rechecked here. Tiizi account plan/resource entitlement is unverified.
- Estimate remains about 14 aggregate Docker job-minutes × 5 plus 3 Linux VM job-minutes × 10 = **about 100 credits for one full run**. This is an estimate, unconfirmed by billing evidence. If the account is Free and all six jobs hit the documented 1-hour per-job Free limit, compute exposure is at most **2,100 credits** for one pipeline (5 × 60 × 5 + 1 × 60 × 10), excluding unusual storage overage. Free pricing currently advertises 30,000 monthly credits and 30x cloud concurrency; six jobs should not queue due to the Free concurrency cap. Actual plan, balance, open-source credit classification, cached data and billing usage require CircleCI UI evidence. Cache use is ordinary checksum-keyed npm cache; no DLC. First run may miss caches.
- Expected duration is about 17 minutes of aggregate job time, with wall-clock time subject to concurrent capacity and queueing. No prior Tiizi CircleCI run data exists to confirm duration. Each Free job has a 1-hour cap; no explicit job timeout/retry/parallelism expansion is added.
- Provider references checked 2026-10-17: [CircleCI OAuth organization and pipeline behavior](https://circleci.com/docs/guides/integration/using-the-circleci-github-app-in-an-oauth-org/), [Free plan pricing and concurrency](https://circleci.com/pricing/), [resource class pricing](https://circleci.com/pricing/price-list/), [Free job runtime limits](https://circleci.com/docs/reference/configuration-reference/), and [Ubuntu 22.04 machine image with Docker](https://circleci.com/developer/machine/image/ubuntu-2204).

### 6. Checkout, status association and one-run command

- The six job fetches of this public repository do not need a deploy key. A project setup may provision its own repository-scoped read-only deploy key under OAuth; no key is assumed or installed here. Since no CircleCI `checkout` occurs inside the job, tests do not receive checkout SSH keys. Project variables/contexts were not inspectable due missing CLI auth, so secret exposure from existing project settings is unresolved.
- Status association is not verified for Tiizi. MILEDGE's successful OAuth pilot reported status on the config commit, not the PR head. Record the CircleCI URL and exact SHAs as independent evidence, never as a GitHub Actions pass.
- Re-read PR #94 remains `ab507184cb9aeb61fcd45bceacdf000bf2d7274d`. The intended command shape is below, but it is **not yet executable as an exact command** because the actual Tiizi project and pipeline definition IDs could not be queried. Do not substitute Miledge IDs and do not run it.

```bash
circleci pipeline run \
  --project gh/Fkenogo/tiizi_challenges \
  --definition-id <Tiizi-pipeline-definition-id-from-read-only-project-query> \
  --branch docs/tiizi-ci-temp-001 \
  --param target-sha=ab507184cb9aeb61fcd45bceacdf000bf2d7274d \
  --json
```

This single manual invocation would execute all six mandatory verification jobs against exactly PR #94's full head SHA. Expected resource use is approximately 100 credits; Free-plan compute ceiling is approximately 2,100 credits if all six jobs each reach the one-hour limit. No automatic trigger or deployment is specified by this command.

### 7. Required manual actions, risks and verdict

Founder/manual actions before a hosted run: (1) obtain the actual Tiizi project and pipeline definition IDs through an authenticated read-only CircleCI query; confirm project integration is OAuth and config path `.circleci/config.yml`; (2) inspect follow/trigger settings and project env vars/contexts; confirm no push-triggered pipeline will start from the config-branch push and no unnecessary secrets are exposed; (3) confirm plan/resource class, credit balance, cache/billing state in the CircleCI UI; (4) authorize pushing the prepared isolated config branch after those checks; (5) authorize the one exact command above after replacing the pipeline ID and re-reading both branch heads. No key installation is recommended for these public HTTPS fetches; any project setup key is CircleCI-managed and would require separate review/approval.

**Verdict: CONDITIONAL GO — configuration is locally valid and preserves all six gates, but project identity/settings, exact pipeline ID, plan/balance, secret context and push-trigger safety are unverified. No push or hosted run is ready until those specific read-only checks and Founder authorizations are complete.** PR #93 STOP and the MC-2B gate remain unchanged.

## Addendum TIIZI-CI-TEMP-001D — CircleCI Access and Pilot Unblocking (2026-10-17)

**Authority:** Founder review, 2026-10-17. **Hosted execution remains unauthorized.** This addendum records read-only access attempts and does not change the 001C gates.

### 1. Local 001C correction review

The two uncommitted files are limited to `.circleci/config.yml` and this assessment. The config correction removes the duplicate YAML version key, preserves all six jobs, and enforces config-source and application exact-SHA checks. It removes reliance on checkout credentials by fetching the public repository over HTTPS before application commands. No application files or programme gates changed. Local validation passes and the edits are committed in the containing local-only commit; no push was performed.

### 2. CircleCI CLI context and authentication

- `circleci` binary: `/opt/homebrew/bin/circleci`; Homebrew reports version `1.5.0`.
- `circleci version` and `circleci org list` fail during CLI initialization with `getting boot time: operation not permitted` in this execution environment. `circleci auth me` runs and reports `No CircleCI API token found`.
- Shell identity is `theo` (UID 501), `HOME=/Users/theo`, Darwin host `KENOGO-2.local`; `CIRCLECI_HOME` is unset, `CIRCLE_TOKEN` is absent, and `$HOME/.circleci/cli.yml` and `$HOME/.circleci/` are absent. No credential value was read or copied.
- MILEDGE-CI-INFRA-006 records the CircleCI account as GitHub-connected `Fkenogo`, with its CLI token held in the macOS keychain. This process has no visible CircleCI token/config and the sandbox prevents full CLI initialization. The keychain was not inspected, so whether the token is absent, in another credential store/session, or inaccessible from this execution cannot be distinguished.
- **STOP account inspection.** Founder manual action: in the normal macOS login session where CircleCI credentials are managed, run `circleci auth login` and complete authentication using the existing GitHub-connected **Fkenogo** account. Do not create a CircleCI user or new token. Then run `circleci auth me` and `circleci org list`. Continue with read-only project queries only if those commands show the recorded Fkenogo account and `gh/Fkenogo` organization.

### 3. Project, settings and trigger status

Because authenticated org discovery is unavailable, the existence of `gh/Fkenogo/tiizi_challenges`, its project ID, OAuth/App integration type, pipeline definition ID, config path, followed/enabled state, automatic triggers, environment-variable names, contexts and access permissions remain **unverified**. No project was created. The isolated branch cannot be declared safe to push: the project may follow all pushes and start a pipeline when a branch containing `.circleci/config.yml` is pushed. **Do not push until the read-only trigger/follow query confirms no automatic hosted run will start.**

### 4. Final technical verification

- `circleci config validate .circleci/config.yml`: **PASS**. `git diff --check`: **PASS**.
- Executors: five Docker `small` jobs through the shared Node 22 executor; one Linux machine `medium` job for the API image, with native Docker.
- Six gates remain: API typecheck/Vitest/build; API Docker build/start, health 200, ready 503 and cleanup; web typecheck/build; functions build/TypeScript validation; all five boundary guards; API namespace contract test.
- No deployment/publish/release steps or test-required secrets are present. Jobs do not use CircleCI `checkout` credentials; they fetch the public repo over HTTPS before installing dependencies or running tests. No repository or account-wide token is introduced.
- The configuration-source SHA guard is appropriate for the proposed OAuth manual invocation by config branch: the shared Miledge handover records `circleci pipeline run --branch <config-branch>` loading config from that branch and setting the matching checkout revision. Each job re-fetches that config branch and checks it against `CIRCLE_SHA1`; application SHA proof separately requires fetched PR branch head = `target-sha` = detached `HEAD`. Tiizi's actual pipeline type remains unverified, so this guard is locally validated but not live-confirmed.
- Project-level secrets remain unknown. If project variables or contexts expose secrets to these jobs, test code from the target branch could read them. Review variable names and context grants before any run; do not expose values in the report. This is an avoidable risk until that inspection is complete.

### 5. Pilot command and STOP state

Latest GitHub PR #94 head re-read: `ab507184cb9aeb61fcd45bceacdf000bf2d7274d`. Project/pipeline IDs are unavailable, so the exact command cannot be completed. Do not substitute IDs from Miledge, do not execute, and do not push:

```bash
circleci pipeline run \
  --project gh/Fkenogo/tiizi_challenges \
  --definition-id <Tiizi-pipeline-definition-id-from-read-only-project-query> \
  --branch docs/tiizi-ci-temp-001 \
  --param target-sha=ab507184cb9aeb61fcd45bceacdf000bf2d7274d \
  --json
```

**Verdict: CONDITIONAL GO for preparation only.** Outstanding manual actions: restore access to the existing Fkenogo CLI identity; read and record Tiizi project/pipeline IDs and OAuth/config details; inspect follow/trigger settings before deciding whether the branch can be pushed; inspect project env-var names and contexts/access without reading values; confirm plan and credit balance; obtain separate Founder authorization for push and for the one hosted invocation. No hosted pipeline, push, settings change, credential installation, merge, PR #93 action or MC-2B work occurred. PR #93 Founder STOP and PR #94 independent review authority remain preserved.


## Addendum TIIZI-CI-TEMP-001E — Cancellation and Closure (2026-10-17)

**Authority:** Miledge Infrastructure Founder Decision, 2026-10-17.
**Disposition: CANCELLED — ALTERNATIVE NOT REQUIRED.**

- The repository is public. Its unchanged `.github/workflows/ci.yml` retains all six mandatory jobs on standard `ubuntu-latest` GitHub-hosted runners: API typecheck/Vitest/build; API image build/start, health and readiness checks with cleanup; web typecheck/build; Functions build/TypeScript validation; five boundary guards; and API namespace contract test.
- GitHub documents standard hosted runner use as free and unlimited for public repositories. The two latest available PR runs (#94 run 273, #93 run 272; run IDs 38528912002 and 38528899580) are marked completed/failure across all six jobs. Their step summaries and logs were unavailable in this evidence query. These records do not prove a successful run or identify test failures; the prior billing/startup interruption remains distinct from test results. **Availability: NOT YET CONFIRMED.** The next independently authorized ordinary PR update or main-branch workflow event can provide verification without a CI-only commit.
- CircleCI feasibility work reconciled the shared Miledge OAuth guidance, preserved all six job gates, added fail-closed exact-head verification, and locally validated the isolated configuration. The CircleCI CLI was unauthenticated, so Tiizi project state could not be verified. No CircleCI hosted run occurred, no CircleCI configuration branch was found on the remote, and no CircleCI resources were activated by this work. GitHub Actions remains the selected CI.
- PR #93 remains under Founder STOP; PR #94 retains independent review authority; MC-2B remains unauthorized. No PR, branch protection, or application code was changed.

This closure is a local documentation-only proposal on an isolated branch. It has not been pushed or merged.
