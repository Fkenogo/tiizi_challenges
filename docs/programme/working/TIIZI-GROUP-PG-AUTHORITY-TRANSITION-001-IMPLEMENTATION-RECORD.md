# TIIZI-GROUP-PG-AUTHORITY-TRANSITION-001 — Implementation Record

**Status:** **COMPLETE / FOUNDER ACCEPTED / MERGED** — source PR #50, merge commit `7cffb4b8f7c9b50c613a91067b7ca8c05554e52b`.

**Current disposition:** The V2 Group authority transition completed by establishing PostgreSQL as authoritative V2 Group, Group Membership, and Group-scoped Challenge Group/Membership authority. There is no V1 operational-data cutover to perform: V1 is frozen/reference-only, V1 operational data is outside the V2 continuity baseline, and V1-to-V2 migration and Firestore-to-PostgreSQL reconciliation are NOT REQUIRED. V2 environments use fresh V2 data. Persistent V2 deployment is a later deployment activity, not an unfinished Firestore data migration.

## Entry baseline and programme

- Entry `origin/main`: `9324e384c02be014fb91b9419e3e4b5e1033b8ac` (fetched; matches expected baseline).
- Master Programme at entry: v2.08.
- S4a/S4b remain complete and merged. S4c remains NOT STARTED; S4d and S6 remain untouched.
- Worktree: `/private/tmp/tiizi-group-pg-authority-transition`, branch `impl/tiizi-group-pg-authority-transition-001`.

## Authority contract

The current V2 authority is PostgreSQL for Group identity, governed settings, lifecycle, privacy/admission policy, Challenge-creation policy, Steward attribution, membership state/lifecycle/roster, eligible member count, and Challenge Group/Membership authorization. Firebase Auth remains the authentication/token-verification provider, and provider UID is resolved to the Tiizi member UUID through `members`. Firestore is not a V2 Group/Membership authority, fallback, or dual-write target. Legacy Firestore IDs are not part of the V2 continuity baseline and do not create a reconciliation obligation.

## Candidate schema and runtime changes

- Added migration `019_group_postgres_authority.sql`: Group policy, Steward UUID, normalized unique invite code, membership lifecycle attribution/timestamps, indexes, update timestamp triggers, one active owner uniqueness and deferred Steward/member relation checks.
- Added PostgreSQL Group and membership authority resolvers and PostgreSQL Group read projection. V2 Group create/join/leave routes now write in PostgreSQL transactions; Group detail, roster, count, liveness and Challenge Group visibility read PostgreSQL. Challenge participation/creation authorities and the challenge-create CLI now resolve Group membership from PostgreSQL.
- The initial candidate included Group reconciliation/import tooling while data preservation requirements were unresolved. Founder disposition later established a fresh V2 data baseline; Pass 005 removed the unneeded Group/V1 import and reconciliation tooling. No V1 import path remains authorized or required.
- No invitation resolver, discovery/search/pagination, approval/rejection operation, S4d/S6 work, Feed, Council, or Steward transfer was added.

## Historical initial reconciliation assessment — superseded by Pass 004B

At the time of the initial assessment, a real-data dry-run was not executed because no matched datasets were configured. Founder disposition in Pass 004B subsequently established that no such dry-run is required: V1 data is outside V2 continuity, V2 is a fresh rebuild, and no production Firebase inspection or reconciliation is authorized or needed.

No apply, import, data repair, UUID remapping, cutover, production migration, or deployment occurred. Existing PostgreSQL UUIDs and Challenge FKs have not been changed. Production Groups and membership counts are unknown from this worktree.

## Firestore retirement boundary

- V2 API runtime wiring no longer imports the Firestore Group mutation/read or Challenge-creation authority adapters. New API Group writes do not dual-write Firestore.
- Frozen V1 browser Group services and legacy Firebase Functions may remain as historical/reference code. They are not V2 authority; no V1 operational data population is to be reviewed or migrated for this V2 transition.
- Firebase Auth and unrelated Firestore domains remain unchanged.
- The former Firestore adapters and shadow importer source remain present but are no longer wired into V2 API runtime. A later cleanup should retire them only after code-reference and V1 impact review.

## Validation

- Dedicated PostgreSQL transition tests: 7 passed.
- API typecheck and build: passed.
- Functions build: passed.
- Root TypeScript/Vite build: passed.
- Full API suite at this candidate before the last no-dual-write assertion was added: 689 passed, 8 skipped, 23 failed (54 files). The additional focused assertion passes; the complete suite has not been rerun after that test-only addition. Failures are concentrated in older S2-G/S4a/S4b/API authority tests that still assert Firestore fake-store state and outage behavior. These failures remain unresolved; do not treat accepted S4a/S4b regression validation as complete.
- V2 boundary scripts and full responsive/browser journeys were not completed.
- Founder preview was not run: no configured database, Firebase Auth project, or reconciled Group dataset is available.
- Deployment: none.

## Historical rollback/cutover notes — superseded

Earlier pass notes discuss Firestore reconciliation and a future data cutover because those were open questions at the time. Founder disposition in Pass 004B resolved them: V1 is frozen/reference-only, no V1 operational data is required in V2, and no Firestore-to-PostgreSQL reconciliation or Group-data cutover remains outstanding. The authority transition is the V2 persistence and runtime authority change recorded in Pass 005. Any future rollback of a deployed V2 application is a deployment/release operation and does not create a V1 data-migration obligation.

At the time of the initial implementation record, the Master Programme had not been changed because the transition had not occurred. This statement is historical and is superseded by the Pass 005 closure entry below and Master Programme v2.09. S4c has not started. S4d/S6 remain untouched.

## Pass 003 — runtime boundary and regression realignment

- Entry candidate: `ab657e3260b39d7bcd5e42a8a13e00054715b5ae`; fetched `origin/main` remains `9324e384c02be014fb91b9419e3e4b5e1033b8ac`. Work remains on the isolated branch/worktree above.
- Route tracing resolved the prior contradictory report. Registered `/v2/groups`, `/v2/groups/new`, `/v2/groups/:groupId`, and `/v2/operator/groups` resolve respectively to V2 Groups, create, Group Home, and static operator surfaces. The data-bearing V2 routes use `useV2Groups` / Group detail and roster hooks and `groupsApi` / V2 Challenge APIs through the Tiizi API to PostgreSQL. `useGroups.ts` and `groupService.ts` are V1 `/app/*` consumers, not reachable from registered V2 routes. `groupInsightsService.ts`, `userAnalyticsService.ts`, `workoutService.ts`, `wellnessLogService.ts`, and `challengeService.ts` remain legacy V1 consumers; unrelated activity/analytics domains were not migrated.
- The prior 23-versus-listed-24 discrepancy came from erroneous supplied per-file counts. Captured Pass002 runner output contained 23 failed tests: `ebc01GroupAuthority` 8, `s2gGroupEstablishment` 5, `s4aCorr001` 2, `s4aGroupHome` 5, and `s4bMembers` 3 (sum 23). The prompt's listed counts sum to 24 and were not the runner's actual counts.
- Reworked those five test files to assert PostgreSQL state and fail-closed behavior, using a poison Firestore adapter to prove no fallback. These tests exposed and led to correction of a genuine API regression: PostgreSQL Group detail, roster, and Group-filtered Challenge read failures now return the established 503 unavailable response. Focused rewritten tests passed (43 tests).
- Added a transitive dependency graph guard rooted at `src/v2/routes.tsx`, resolving relative and `@/` imports. It detects reachable Firestore reads/writes targeting `groups` or `groupMembers`; its regression fixture proves the former hook→service path would be caught, while Firebase Auth, unrelated Firestore collections, and unreachable legacy modules are allowed. Direct V2 Group-collection access is checked separately. Both graph regression and V2 runtime boundary guard pass.
- Full API suite after the product/test corrections: 53 files passed, 1 skipped; 713 passed and 8 skipped (721 total). The skips are the pre-existing Firestore emulator-only tests when `FIRESTORE_EMULATOR_HOST` is unset. API typecheck/build, Functions typecheck/build, root TypeScript/Vite build, relevant programme guards (S2-G, S2b, S3a–S3d, S4a/S4b, V2 runtime/experience/frontend, auth returns, membership cache, emulator mode, mobile navigation), and `git diff --check` passed. Root Vite emitted its pre-existing stale caniuse-lite and large chunk advisories.
- `groupMutations.ts` remains LEGACY / RETAINED / NON-AUTHORITATIVE: no active V2 route selects it, no PostgreSQL failure fallback reaches it, and V2 writes do not dual-write through it. API entry wiring uses PostgreSQL adapters; legacy Firestore adapters remain outside active authority wiring.
- No database credentials were requested or used. No real data was read or modified; migration 019 was not applied to a configured database; reconciliation, import, apply, and cutover were not run. The test suite uses disposable in-process PGlite fixtures only.
- This pass does not complete real-data readiness. Founder review must precede development-environment configuration and a dry-run reconciliation. No merge, PR, or deployment occurred. S4c remains NOT STARTED; S4d/S6 remain untouched.

## Pass 004B — Founder disposition: clean V2 establishment

Founder disposition supersedes the earlier reconciliation/cutover assumptions recorded above:

> Tiizi V2 is a fresh rebuild. V1 is frozen/reference-only. V1 operational data is not part of the V2 continuity baseline and requires no migration. V2 environments are established using fresh V2 data.

- V1 operational data, Groups, memberships, Challenges, identifiers, Firestore-to-PostgreSQL reconciliation, matched Firestore/PostgreSQL datasets, and a future V1 migration programme are OUT OF SCOPE / NOT REQUIRED / NOT AUTHORIZED for V2 establishment. Production Firebase inspection is NOT REQUIRED and MUST NOT be performed.
- S4a/S4b Founder Preview Groups, memberships, Challenges, and their local identifiers are disposable/recreatable. Fresh synthetic V2 fixtures are sufficient; no prior IDs or relationships must be preserved.
- Supersedes the earlier statements that legacy Firestore IDs remain for reconciliation, that V1 Groups must be reviewed against the production population at cutover, and that a real-data reconciliation is a prerequisite. Those were made under the former Founder disposition and are stale for V2 continuity.
- The candidate's reconciliation CLI/apply path was created under that former disposition. It is not required or authorized for V2 establishment and must not be used to import V1 data. It remains in the candidate until separately authorized source cleanup; no source changes are made by this record update.
- Migration 019 adds V2 schema only; it performs no row import. Its `tiizi.group_reconciliation` timestamp-trigger exception exists solely for the now-unneeded importer to preserve imported `updated_at`; it is not needed for fresh V2 writes. This is retained as a known nonessential compatibility seam in this validation pass, not invoked.
- Pass 004B validation uses disposable PGlite and synthetic members/groups/challenges only. No Firestore, Firebase project, production or persistent PostgreSQL target is used.

### Pass 004B validation record

- Entry candidate: `9d570adf73100bdf77e2fd8df1ae6e32ae0fe75e`; `origin/main` remained `9324e384c02be014fb91b9419e3e4b5e1033b8ac`. Validation used the existing isolated worktree on `impl/tiizi-group-pg-authority-transition-001`; accepted history was not rewritten.
- Migration 019 is additive PostgreSQL schema establishment only. It contains no data import. The repository's API test harness applies migrations to disposable in-process PGlite databases (`api/test/helpers.ts`); migration tests and the full suite passed. The applied schema was exercised through the same fixture setup. No persistent database was configured or changed.
- Schema/domain evidence covers Group and Membership UUID/FK relationships, uniqueness and lifecycle constraints, the deferred Group Steward-to-active-owner-membership invariant, invite-code normalization/uniqueness, indexes, and Group UUID Challenge references. The synthetic V2 path is covered by `groupAuthorityTransition.test.ts`, `s2gGroupEstablishment.test.ts`, Challenge establishment/creation tests, and the rest of the API suite. Those tests establish Groups and memberships via the governed PostgreSQL path, verify pending/leave/Steward behavior and fail-closed authorization, and establish Challenge rows against Group UUIDs. No V1 or Firebase records are fixtures for this pass.
- Full API suite: 53 files passed, 1 skipped; 713 tests passed, 8 skipped. Skips are Firebase Rules emulator tests requiring `FIRESTORE_EMULATOR_HOST`; no emulator or remote Firebase project was used. API typecheck/build passed. V2 runtime boundary, Firestore dependency graph, S2 Group establishment, S4a Group Home, and S4b Members guards passed. (No deployment/browser preview or persistent development database was part of this disposable schema pass.)
- V2 authority evidence: Group API runtime and membership/challenge authority are wired to PostgreSQL adapters. Boundary guards establish no registered V2 browser Group Product Truth path to Firestore; no V2 Group Firestore fallback or dual-write was exercised or introduced. Remaining Firestore references are legacy adapters/fixtures, V1/reference code, or historical comments/tooling, not active V2 authority. Some comments in `api/src/app.ts` and `api/src/challengeCreateCli.ts` still describe the superseded Firestore authority; they are documentation drift for future bounded cleanup, not runtime blockers.
- The preexisting reconciliation CLI and its timestamp-trigger bypass are not used or required for clean V2 establishment. Migration 019's `groups_discovery_idx` is an additive index with no discovery behavior; S4c remains unstarted.
- Result: clean V2 schema/authority validation passed in disposable PGlite. No application data was modified; migration 019 was not persistently applied; no Firebase project (including historical production) was queried; no reconciliation, import, cutover, merge, or deployment occurred. This validates the candidate's clean V2 authority path, not a persistent development deployment. Recommended next step: Founder review of this validation record, then separately authorize creation/configuration of a disposable or development V2 PostgreSQL environment if persistent local preview evidence is required before the authority transition is considered complete.
- S4c remains NOT STARTED. S4d and S6 remain unchanged.

## Pass 005 — persistent clean V2 PostgreSQL baseline

- Entry candidate: `6ac2849fc214436347051d075643aed76f20abfc`; `origin/main` remained `9324e384c02be014fb91b9419e3e4b5e1033b8ac`. The accepted branch history was not rewritten. Validation used an isolated loopback-only PostgreSQL 17.11 cluster and disposable database `tiizi_v2_pass005`; this is synthetic V2 validation data, not a shared or production dataset.
- Migration 019 was applied using the repository's `npm run migrate`. It established V2 Group authority schema and imported no legacy data. Migration 020, `020_remove_group_reconciliation_timestamp_bypass.sql`, was then applied. It removes the unused reconciliation-only timestamp-trigger bypass; Group and Membership `updated_at` timestamps are maintained by the database. The migration ledger contains 001–020 in order. Migration 020 is DDL-only.
- Schema inspection confirmed the `groups`, `group_memberships`, `members`, and `challenges` relations; Group primary key, Steward/member foreign keys and deferred invariants, unique legacy identifier and normalized invite-code index, membership uniqueness/status/lifecycle constraints and indexes, and Challenge-to-Group foreign key/index. All migrations 001–020 applied cleanly.
- A synthetic API journey against PostgreSQL after migration 020 passed: Group creation, persisted detail/Steward relationship, exactly one active Steward membership, ordinary join, roster, blocked Steward leave, ordinary leave, roster update, and Group persistence after rebuilding the API app. The earlier Pass 005 journey against this database also established a Group Challenge through the governed API, verified its canonical Group UUID FK and hosted Challenge read, and confirmed membership authorization.
- Full API suite: 51 passed, 1 skipped; 705 passed, 8 skipped (713 tests). The existing Firestore Rules emulator-only skip remains because `FIRESTORE_EMULATOR_HOST` is not configured. API typecheck/build, Functions lint/build, root TypeScript/Vite build, and all applicable S2-G, S2b, S3a–S3d, S4a/S4b, V2 runtime/experience/dependency, auth-return, membership-cache, Firebase emulator-mode, and mobile navigation guards passed. The root build emitted the existing stale caniuse-lite and large chunk advisories.
- Group import/reconciliation and membership parity tooling was removed because Founder disposition excludes V1 operational data and requires no V1-to-V2 migration or Firestore-to-PostgreSQL reconciliation. Unrelated Knowledge import/parity tooling remains. Historical Phase A notes are identified as superseded. The earlier Pass 004B note that cleanup was deferred is superseded by this record; prior sections remain historical.
- No Firebase project, emulator, production or remote PostgreSQL database was queried. No production/Firebase data was modified. No V1 data was imported. No reconciliation, cutover, PR, merge, or deployment occurred. Synthetic rows exist only in the disposable local cluster.
- Current V2 Group and Membership authority is PostgreSQL via the Tiizi API. Firestore is not used as fallback or dual-write authority. Firebase Auth remains an identity/token-verification service. `groupMutations.ts` and Firestore adapters remain legacy/non-authoritative where retained.
- Result: clean V2 persistent PostgreSQL baseline validation passed. The work is saved in a local candidate commit for Founder review; it has not been pushed, merged, or deployed. S4c remains NOT STARTED; S4d/S6 remain unchanged.

## Closure — COMPLETE / FOUNDER ACCEPTED / MERGED

- Founder accepted source `c36e0aea164242f0b85dd305554a6d3e7b877c2b` was published as PR #50 against `main` at `9324e384c02be014fb91b9419e3e4b5e1033b8ac` and merged using the normal merge-commit path as `7cffb4b8f7c9b50c613a91067b7ca8c05554e52b`. The accepted source SHA is an ancestor of the merged `origin/main`.
- **V2 Group authority:** PostgreSQL. **V2 Group Membership authority:** PostgreSQL. **Group-scoped Challenge Group/Membership authority:** PostgreSQL. The Tiizi API is the application boundary. **Firebase Auth:** retained for authentication/token verification and provider UID to Tiizi identity mapping only. **Firestore Group/Membership authority for V2:** none; no fallback or dual-write.
- **V1:** frozen/reference-only. **V1 operational data migration:** NOT REQUIRED. **Firestore-to-PostgreSQL reconciliation:** NOT REQUIRED. **V2 data baseline:** fresh V2 data. No production Firebase was queried and no production or V1 data was migrated.
- Pass 005 acceptance evidence: isolated PostgreSQL 17.11 migrations 019–020 and synthetic V2 Group/Membership/Challenge validation; full API suite 705 passed / 8 skipped; all four repository GitHub CI jobs passed. The external Cloudflare Workers Builds check failed and is non-gating under established repository disposition. No deploy occurred.
- **Transition status: COMPLETE / FOUNDER ACCEPTED / MERGED.** S4a and S4b remain COMPLETE / FOUNDER ACCEPTED / MERGED. S4c — Discovery + Join + Invitations remains NOT STARTED and is next. S4d remains NOT STARTED / queued after S4c. S6 Activity Library / Activity Guide remains OUTSTANDING / NOT STARTED.
