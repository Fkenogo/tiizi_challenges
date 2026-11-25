# TIIZI CI-Efficiency Alignment — Local-First Verification Record

**Record:** TIIZI-CI-EFFICIENCY-ALIGNMENT-001
**Direction:** Miledge Engineering Update — CI Usage & Verification Efficiency (Founder Direction)
**Base:** `origin/main` @ `a358b30` (PR #92 merge)
**Branch:** `docs/ci-efficiency-alignment-001` (isolated worktree; main checkout untouched)
**Status:** ALIGNED AND RECORDED

This task does not modify Tiizi Product Truth, feature scope, architecture
authority, deployment architecture, security policy, or programme sequencing.
Held/unmerged work (e.g. EBC-05 reference-only branch, PF-05 unapproved
assembly) is untouched. `main` branch protection: none configured (API 404) —
no required-checks configuration was altered.

## 1. Workflow inventory (`.github/workflows/ci.yml` — the only workflow)

Triggers: `push` on `main` only + all `pull_request` events. No path filters.
No matrices. No caches missing — every Node job uses `setup-node` npm cache.
No `concurrency` block existed before this record.

| Job | Proves | Class |
|---|---|---|
| `api` (typecheck, test, build) | Full `api` vitest suite (PGlite-backed, incl. namespace + GF-01 invariant), `tsc --noEmit`, `tsc` build | Mandatory |
| `api-image` (build, liveness) | Production Dockerfile builds; `/health` 200 without credentials; `/ready` is 503 (never 401) on unreachable DB | Mandatory (release-sensitive; only Docker-dependent gate) |
| `web` (typecheck, build) | Root `tsc -b && vite build` with `functions` + `api` deps installed (scripts/ import both) | Mandatory |
| `functions` (build, typecheck) | Functions `tsc` build + `tsc --noEmit` lint | Mandatory |
| `boundary` (V1 exclusion + API namespace) | AGENTS.md §§1–3 guard + regression fixture + V2 experience/runtime boundary + S5b Today guards | Mandatory (constitutional enforcement) |
| `api-contract` (/api namespace) | Single file `test/apiNamespaceContract.test.ts` — a strict subset of the `api` job's full `npm test` | Useful but duplicative (same file already runs inside `api`) |

Consumption drivers: six jobs each do a fresh checkout + `npm ci` (api deps
installed 3×: `api`, `web`, `api-contract`; functions 2×; root 2×). This
repetition is inherent to GitHub-hosted runner isolation, preserves per-job
failure attribution, and is NOT removed. Heaviest single job: `api-image`
(Docker build). No duplicate push+PR execution exists (push fires on `main`
only, so feature-branch pushes run once via `pull_request`; the post-merge
`main` push run is the exact-head record and is retained). Obsolete-head waste
was the one real inefficiency: no `cancel-in-progress` existed.

## 2. Mandatory CI gates (unchanged)

All six jobs above remain mandatory in practice; none removed, skipped, or
weakened. `main` has no branch-protection required-checks list to update.
`boundary` in particular MUST keep failing closed per AGENTS.md §3.

## 3. Local-first verification model

Everything except `api-image` runs locally with Node 22 + npm (no paid
infra, no self-hosted runners):

- During implementation: focused affected tests —
  `npx vitest run test/<file>.test.ts` in `api/`, or the relevant
  `npm run test:<name>` guard script at root.
- Before publishing a material correction: affected tests + related
  integration/security checks — `api` typecheck/test, `functions` build/lint,
  `boundary` guard set, `test:architecture-guards`.
- Before requesting formal review: complete local suite —
  `npm run build` (web), `npm run build && npm run lint` (functions),
  `npm run typecheck && npm test && npm run build` (api),
  full `boundary` five-guard set, Firestore rules tests
  (`api/test/firestoreMembershipRules.test.ts`, `@firebase/rules-unit-testing`),
  Firebase emulator mode script (`test:firebase-emulator-mode`), guard scripts
  under `scripts/test*.ts|*.mjs`.
- Before final merge: required exact-head GitHub CI (all six jobs) + existing
  independent review + Founder approval gates.

Cannot run locally and retained in CI: `api-image` Docker liveness/readiness
(requires Docker; reproducible on any Docker host but not in plain Node).
No Playwright/Cypress E2E exists in-repo; browser verification is Founder
local preview per FOUNDER-DEVELOPMENT-WORKFLOW-ALIGNMENT-2026-09-11
(local-first review loop; hosted envs only where material). No lint/format
gate beyond `tsc` (no eslint/prettier configs in CI scope).

## 4. GitHub CI checkpoint model

One coherent push → one full six-job run on the exact head. PR pushes are the
formal checkpoint; post-merge `main` push re-verifies the exact merged head.
No experimental pushes to test CI config (validated locally via actionlint +
YAML parse + unaffected local gates).

## 5. Implemented low-risk efficiencies

1. PR-only `cancel-in-progress` concurrency
   (`group: ci-${{ github.ref }}`, cancels only when
   `github.event_name == 'pull_request'`). Superseded PR heads stop
   consuming minutes; `main` push runs never cancel. Coverage, triggers,
   matrices, caching, security, approvals: untouched.

Nothing else was changed. Deliberately NOT implemented (see §7).

## 6. Protections confirmed unchanged

Product Truth, implementation scope, V1-exclusion boundary + guard, `/api`
namespace, PostgreSQL authority, deployment architecture (Cloud Run + Cloud
SQL package, Firebase hosting/functions predeploy), security rules/policy,
Founder/reviewer approval requirements, branch protection state, providers,
runners, paid infrastructure: all unchanged.

## 7. Founder approval required (recommendations, NOT implemented)

1. `api-contract` job removal or fold into `api` — strictly duplicative
   coverage (same file runs in `api`'s full suite); saves one runner + one
   `npm ci` per run. Requires Founder decision because it deletes a visible
   gate.
2. Docs-only `paths-ignore` (e.g. `docs/**`, `**/*.md`) — mixed code+docs PRs
   still run; pure-docs PRs skip expensive suites. Requires Founder decision
   because it changes when mandatory gates execute.
3. Docker layer caching for `api-image` — requires Founder decision (build
   determinism/cache-invalidation trade-off).
4. Job-merge / cross-job artefact sharing to cut repeated `npm ci` — NOT
   recommended (weakens failure attribution, couples unrelated gates).

## 8. Validation

- `actionlint .github/workflows/ci.yml` — clean.
- Python YAML parse + trigger/concurrency semantics inspection — correct:
  PR runs cancel superseded heads; `main` push runs unaffected.
- Local gates affected by change: none code-related (workflow-only diff);
  `boundary` guard set + `api` contract test remain byte-identical in what
  they execute.
- Final diff: 8-line `concurrency` block in `ci.yml` + this record.

## 9. Founder final disposition (PR #94 — OPEN, DO NOT MERGE)

Accepted, subject to final verification:

1. Tiizi-specific local-first verification approach (§3).
2. PR-only cancellation of superseded CI runs (§5.1).
3. Preservation of all six mandatory CI jobs (§2).
4. Preservation of push-to-main verification.
5. Existing independent review and merge requirements.

No additional CI architecture changes are authorised.

DEFERRED — NOT AUTHORISED (do not implement):

- `api-contract` removal or folding (§7.1).
- Documentation-only `paths-ignore` (§7.2).
- Docker layer caching (§7.3).
- CI job consolidation (§7.4).
- Alternative CI providers or self-hosted runners.

GitHub Actions is blocked by an account billing lock (PR #94 run
`38527626958`: all six jobs never started). No workflow retries, no check
removal or bypass, no billing/provider/runner changes. Exact-head CI
verification stays required and PENDING until the account is unlocked; PR #94
remains on hold and MUST NOT be merged until exact-head CI passes plus
existing independent review completes.
