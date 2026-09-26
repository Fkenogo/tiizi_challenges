# TIIZI-GROUP-PG-AUTHORITY-TRANSITION-001 — Implementation Record

**Status:** Candidate implementation prepared; reconciliation and authority cutover NOT EXECUTED. **Not ready to merge or deploy.**

## Entry baseline and programme

- Entry `origin/main`: `9324e384c02be014fb91b9419e3e4b5e1033b8ac` (fetched; matches expected baseline).
- Master Programme at entry: v2.08.
- S4a/S4b remain complete and merged. S4c remains NOT STARTED; S4d and S6 remain untouched.
- Worktree: `/private/tmp/tiizi-group-pg-authority-transition`, branch `impl/tiizi-group-pg-authority-transition-001`.

## Authority contract

The intended post-transition authority is PostgreSQL for Group identity, governed settings, lifecycle, privacy/admission policy, Challenge-creation policy, Steward attribution, membership state/lifecycle/roster, eligible member count, and Challenge membership authorization. Firebase Auth remains the authentication/token-verification provider and the Firebase UID is resolved to the Tiizi member UUID through `members`. Firestore is not a fallback or a V2 Group dual-write target. Legacy Firestore IDs remain only as reconciliation/compatibility identifiers.

## Candidate schema and runtime changes

- Added migration `019_group_postgres_authority.sql`: Group policy, Steward UUID, normalized unique invite code, membership lifecycle attribution/timestamps, indexes, update timestamp triggers, one active owner uniqueness and deferred Steward/member relation checks.
- Added PostgreSQL Group and membership authority resolvers and PostgreSQL Group read projection. V2 Group create/join/leave routes now write in PostgreSQL transactions; Group detail, roster, count, liveness and Challenge Group visibility read PostgreSQL. Challenge participation/creation authorities and the challenge-create CLI now resolve Group membership from PostgreSQL.
- Added explicit reconciliation report/apply functions and `group:reconcile` CLI. Apply mode is gated by a safe dry-run result and runs transactionally; the CLI's default mode is dry-run.
- No invitation resolver, discovery/search/pagination, approval/rejection operation, S4d/S6 work, Feed, Council, or Steward transfer was added.

## Reconciliation and cutover evidence

The required real-data dry-run was **not executed**. The worktree has no `DATABASE_URL`, Firebase credentials, or project selection. `npm run group:reconcile -- --dry-run` therefore cannot access either authoritative dataset. A synthetic PGlite reconciliation test confirms conflict detection and read-only behavior, but does not prove production data is safe to reconcile.

No apply, import, data repair, UUID remapping, cutover, production migration, or deployment occurred. Existing PostgreSQL UUIDs and Challenge FKs have not been changed. Production Groups and membership counts are unknown from this worktree.

## Firestore retirement boundary

- V2 API runtime wiring no longer imports the Firestore Group mutation/read or Challenge-creation authority adapters. New API Group writes do not dual-write Firestore.
- Legacy V1 browser Group services and legacy Firebase Functions remain in the repository for their existing paths. Their Firestore writes do not update PostgreSQL and are not V2 authority. They must be reviewed at cutover against the actual legacy Group population.
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

## Rollback boundary and next gate

Before a production apply/cutover, deploy rollback is not relevant; the candidate branch is unmerged. After a future PostgreSQL-authoritative write cutover, rollback cannot simply point the API at stale Firestore: writes must be replayed/reconciled or a compatible reverse synchronization boundary must be rehearsed. The production cutover remains blocked until a real dry-run reports no unresolved mapping/owner/Challenge conflicts, the apply is reviewed, S4a/S4b regression tests are updated and green against PostgreSQL, and a local Founder preview is completed.

Master Programme was not changed because the transition has not occurred. S4c has not started. S4d/S6 remain untouched.

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
