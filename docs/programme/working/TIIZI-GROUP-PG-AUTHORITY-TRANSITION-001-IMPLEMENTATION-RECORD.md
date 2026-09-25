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
