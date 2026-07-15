# Phase 10C-P5ZA — Remove Wellness Client User Stats Write

**Date:** 2026-06-21  
**Status:** Implemented  
**Scope:** smallest safe fix from P5Z independent audit

## Summary

Removed the legacy `users/{uid}` stats write from the single-activity wellness logging batch in `wellnessLogService`.

The wellness logging batch now contains only:

1. `wellnessLogs/{autoId}` create
2. `challengeMembers/{challengeId}_{uid}` progress update

No scoring logic, Firestore rules, or challenge progress logic was changed.

## Reason

The client-side user stats write is unnecessary for wellness logging. Server-owned summary and metrics functions already listen to `wellnessLogs` creates, and the newer `activityLogSessionService` path already avoids client-side `users/{uid}` writes.

Removing the write:

- reduces the failing client batch from three writes to two,
- removes the `users/{uid}` permission surface from wellness logging,
- avoids replacing the whole `stats` map via nested `set(..., { merge: true })`,
- keeps raw activity logging aligned with the server-owned summary pattern.

## Code Changes

### `src/services/wellnessLogService.ts`

Removed:

- `userRef`
- `userStatsUpdate`
- debug write entry labeled `users stats update`
- `users update` entry in `plannedWrites`
- `batch.set(userRef, userStatsUpdate, { merge: true })`

Preserved:

- `wellnessLogs` payload and create write
- `challengeMembers` progress update
- scoring calculation
- completion/status transition logic
- always-on batch failure diagnostics for the remaining two writes
- debug-mode individual write diagnostics for the remaining two writes

### `scripts/testScoringGuards.ts`

Updated Section 20 guards to assert:

- `wellnessLogService` does not build or write a `users/{uid}` stats update,
- `plannedWrites` includes only `wellnessLogs create` and `challengeMembers update`,
- `wellnessLogService` still writes `wellnessLogs`,
- `wellnessLogService` still writes `challengeMembers`.

## Validation

Validation results:

```txt
npm run test:scoring-guards              passed — scoring guards passed
npm run test:home-challenge-feeds        passed — home challenge feed guards passed
npm run test:home-performance-guards     passed — home performance guards passed
npm run test:pilot-ux-polish-guards      passed — pilot UX polish guards passed
npm run test:challenge-creation-backend  passed — challenge creation backend tests passed
npm run test:group-invite-backend        passed — Group invite backend security tests passed
npx tsc -b --pretty false                passed — exit code 0, no output
npm run build                            passed — Vite built 1848 modules in 3.22s
```

## Deploy Requirement

- **Hosting deploy:** required to ship the updated client bundle.
- **Firestore rules deploy:** not required.
- **Functions deploy:** not required for this change.
