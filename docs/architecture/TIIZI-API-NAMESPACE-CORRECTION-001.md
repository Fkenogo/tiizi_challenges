# TIIZI-API-NAMESPACE-CORRECTION-001 — `/v1` Removal and the Product-Neutral `/api` Namespace

**Document type:** Architecture / programme record

**Status:** IMPLEMENTED CANDIDATE — awaiting Founder review (Pass 001)

**Date:** 2026-10-02

**Authority:** Founder disposition — TIIZI PERMANENT V1 EXCLUSION, PASS 001
(accepting *TIIZI V1 PERMANENT EXCLUSION & ACTIVE-REPOSITORY QUARANTINE
ASSESSMENT 001*)

**Baseline:** `origin/main` @ `6866e325aeb64b12d17748b4638cd500028f86ee`

---

## 1. Decision

The active Tiizi API namespace changed from `/v1/*` to `/api/*`.

`/api` is the current, active, **product-neutral** API namespace. It carries no
API-version meaning.

The retired `/v1` namespace is **not** an active API surface. No compatibility
alias, redirect, proxy, duplicate registration, fallback route, or transitional
adapter was introduced. An authenticated request to a `/v1/*` path does not
reach the current API.

---

## 2. Why `/v1` was removed

### 2.1 `/v1` never had API-version authority

`/v1` was an informal, undocumented path prefix. It was not a contract version:

- **No published contract existed.** There was no OpenAPI/Swagger/`*.yaml`
  specification anywhere in the repository.
- **No versioning policy existed.** No document defined what `/v1` meant, how a
  version would be revised, deprecated, or retired.
- **There was no `/v2` API namespace.** V2 domain objects were served *under*
  `/v1`. A prefix that reads as a version while no version boundary exists and
  while the current product is V2 does not version anything.

### 2.2 No external consumer existed

Removing `/v1` created no compatibility obligation because no external consumer
was identified:

- no native/mobile/desktop client (`react-native`, `expo`, `electron`,
  `cordova`, `capacitor`) in any package manifest;
- no API proxy, edge route, or redirect configuration (`wrangler.toml`,
  `_routes.json`, `_redirects`, `_headers` all absent);
- Firebase Hosting declares a single SPA fallback rewrite and never proxied
  `/api` or `/v1` to the API — the client uses an absolute cross-origin base
  URL, so Hosting is not in the API request path;
- every documented consumer in the repository is in-repo web code.

### 2.3 `/v1` created a real conceptual collision

`/v1` is not the archived Product V1 product marker — that is the browser route
root `/app/*`. Because `/v1` *reads* as "product/API version 1", its presence
next to a V2 product created a standing ambiguity: it implied that archived
Product V1 was still structurally present in the active API surface.

That ambiguity has a cost. Every contributor and coding agent reading a
`/v1/...` path has to be told that it does not mean Product V1. A boundary that
must be re-explained on every encounter is documentation, not structure. The
Founder's permanent-exclusion direction requires the boundary to be structural.

Removing `/v1` removes the ambiguity at its source.

---

## 3. Separation of concepts

| Concept | Meaning | Status |
| --- | --- | --- |
| `/app/*` | Archived Product V1 browser shell | Excluded from V2; frozen / reference-only |
| `/api/*` | Current active Tiizi API namespace | **Active**; product-neutral; no version meaning |
| `/v2/*` | Current active V2 browser shell | Active |
| `/v1/*` | Retired informal API prefix | **Not an active surface**; no alias |
| `/health`, `/ready` | Unversioned infrastructure routes | Active; outside the API namespace; auth-exempt |

`/app/*` and `/api/*` are unrelated concepts that previously shared a
coincidental "v1" token.

---

## 4. What changed

### 4.1 Server

- **56 active routes migrated** (37 reads / 19 writes) across 12 registration
  modules: `groupIdentity`, `memberships`, `knowledge`,
  `challengeActivityRoutes`, `challengeReads`, `groupReads`,
  `challengeParticipationRoutes`, `challengeCreationRoutes`,
  `groupMutationRoutes`, `challengeCreationSeamRoutes`,
  `socialCauseApprovalRoutes`, `operatorConsoleRoutes`.
- **Canonical prefix constant** introduced: `api/src/apiPrefix.ts` exports
  `API_PREFIX` and `apiPath()`.
- The API authentication `onRequest` hook now checks
  `` request.url.startsWith(`${API_PREFIX}/`) `` instead of a `/v1/` literal.
  This was the single highest-risk line in the migration: missing it would have
  made every migrated route unauthenticated.
- `GET /health` and `GET /ready` are unchanged: unversioned, outside the API
  namespace, and auth-exempt.

### 4.2 Client

- **Canonical prefix constant** mirrored: `src/api/apiClient.ts` exports
  `API_PREFIX` and `apiPath()`.
- All eight client modules that construct request paths
  (`challengeCreationApi`, `groupsApi`, `knowledgeApi`, `operatorConsoleApi`,
  `socialCauseReviewApi`, `v2ChallengeApi`, `membershipsApi`,
  `groupIdentityBridge`) now compose paths through `API_PREFIX`.
- The prefix was previously duplicated as a literal at every one of the 50
  client call sites; it is now expressed once per surface.

### 4.3 Tests, guards, tooling, docs

- `api/test/*` (32 files) migrated; version tokens (`computeActivityScore/v1`,
  `ebc04/v1`) deliberately preserved.
- `scripts/*` guard assertions migrated; Google Identity Toolkit
  `identitytoolkit.googleapis.com/v1` paths deliberately preserved.
- Current operational documentation updated: `api/README.md`, `api/DEPLOY.md`.

---

## 5. Structural V1 exclusion (Pass 001 scope)

This correction is the **namespace/boundary** pass. It does not remove archived
V1 source; that is a separate bounded Pass 002.

Landed in this pass:

1. **`AGENTS.md` (repository root)** — the canonical repository-level
   coding-agent instruction surface, establishing the TIIZI V1 EXCLUSION
   BOUNDARY. Archived Product V1 must not participate in V2 implementation,
   Product Truth, data authority, compatibility, design precedent, or
   engineering decisions unless the Founder explicitly reopens it.
2. **`boundary` CI job** — a permanent architecture guard
   (`scripts/boundaryGuard/guard.mjs`) that runs in CI and proves:
   1. registered V2 runtime cannot import or transitively reach archived
      Product V1 browser modules;
   2. current V2 Group/Challenge runtime and active API registration cannot
      reach legacy Firestore Group/Challenge authority;
   3. no active API route is registered under `/v1/*`;
   4. no active V2 API client contains a `/v1/*` request target;
   5. no registered V2 navigation/runtime root can reach an `/app/*` route;
   6. the guard itself fails on a deliberately introduced prohibited
      dependency, `/v1` route, or `/v1` client target.
3. **Guard regression fixture** — `scripts/testBoundaryGuardRegression.mjs`
   runs the guard's checks against synthetic module maps and asserts each
   check fails when a prohibited change is introduced. A guard that cannot
   fail is not a guard.
4. **`/api` contract suite** — `api/test/apiNamespaceContract.test.ts` proves
   representative authenticated READ and WRITE operations on `/api` across the
   major domains and proves the retired `/v1` namespace does not resolve.

### 5.1 Defect found by the guard

The guard is a transitive import-graph analysis, not a filename check. On first
run it found a genuine structural defect:

`api/src/groupMutations.ts` — a provider-neutral module — imported
`isGroupDocActive` from `api/src/firestoreGroupAuthority.ts`, the legacy
Firestore authority adapter. Although every direct importer of
`groupMutations.ts` used type-only imports, `groupMutations.ts` itself was
reachable from the active API composition root and therefore put a legacy
Firestore authority module inside the active API module graph.

The predicate already existed in the neutral `api/src/groupLiveness.ts` (and was
already used from there by the PostgreSQL authority and the governed read
paths). `groupMutations.ts` now imports the neutral module, and no legacy
Firestore authority module is reachable from the active API registration.

The guard also found that shared neutral `src/components/Auth/ProtectedRoute.tsx`
defaulted `loginPath` to the archived V1 shell (`/app/login`), meaning any
consumer that omitted the prop would route an unauthenticated user into archived
Product V1 experience. `loginPath` is now a required prop and the archived V1
shell supplies its own value at its own call sites. A cross-generation default
can no longer exist.

---

## 6. Verification

- API typecheck and build; full API test suite.
- Frontend typecheck and build.
- Functions build and lint.
- New `boundary` guard and its regression fixture.
- New `/api` contract suite.
- `git diff --check`.

Every remaining `/v1` occurrence in the candidate is classified as historical
documentation, archived V1 implementation awaiting Pass 002 removal, a
deliberately preserved external version token (Google Identity Toolkit;
`computeActivityScore/v1`; `ebc04/v1`), or an exclusion-proving test fixture.
There is no active `/v1` route and no active `/v1` client target.

---

## 7. PR #67

PR #67 (`feat(api): add S5a Today member projection`) remains **HELD**:
unchanged, unmodified, unmerged. This namespace correction does not reject its
Product Truth or its projection logic.

After this correction merges, S5a must be rebased onto current `main` and
`GET /v1/today` must become `GET /api/today`. S5a implementation status is not
advanced by this record.

---

## 8. Non-effects

This record and the change it describes:

- do not modify archived Product V1 browser routes (`/app/*`);
- do not modify legacy Product V1 implementation to make it compatible with
  `/api`;
- do not delete archived V1 source (deferred to Pass 002);
- do not deploy, access production, alter Cloudflare, or run production
  migrations;
- do not merge PR #67;
- do not advance S5a implementation status.
