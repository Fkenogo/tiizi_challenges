# Phase 10C-P4H — Leaderboard Scoring Backfill

Date: 2026-06-17  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — backfill script created, dry-run confirms credential guard, all validation passes

---

## Summary

P4B–P4G wired the v2 scoring engine into all logging paths and Cloud Functions. New logs (post-deployment) will have correct leaderboard scores automatically. This phase creates the one-time admin script to rebuild `challengeLeaderboards.score` from stored log data for logs that existed before deployment.

---

## What Was Delivered

### `scripts/backfillLeaderboardScoring.ts`

A dry-run-first admin script that:

1. **Reads** `users`, `challenges`, `workouts`, `wellnessLogs`, and the existing `challengeLeaderboards` state.
2. **Groups** logs by `(challengeId, userId)`.
3. **Scores** each log using the same logic as `functions/src/memberActivitySummaries.ts`:
   - **v2 logs** (`scoringVersion == 'v2'`): `clamp(storedPoints, 0, 1000)` — allows 0-point anti-gaming floor to land correctly.
   - **Legacy workout logs**: `clamp(Math.round(value), 1, 1000)` — identical to pre-P4E CF behavior.
   - **Legacy wellness logs**: `clamp(Math.round(storedPoints || value || 1), 1, 1000)` — identical to pre-P4E CF behavior.
4. **Writes** rebuilt `challengeLeaderboards` documents in apply mode only, using `{ merge: true }` to preserve CF-written fields like `lastScoringMethod`.
5. **Reports** read counts, v2 vs legacy log splits, planned write counts, stale doc count, and the top-10 score deltas for manual review.

---

### Safety Guardrails

| Guard | Mechanism |
|-------|-----------|
| Requires credentials | Exits with clear error if `GOOGLE_APPLICATION_CREDENTIALS` is not set |
| Requires explicit production confirm | Exits with error if project is `tiizi-challenges` and `CONFIRM_PROJECT_ID` ≠ `tiizi-challenges` |
| Default dry-run | No writes unless `--apply` flag is passed |
| Never touches source logs | Only `challengeLeaderboards` collection is written; `workouts` and `wellnessLogs` are read-only |
| No source log deletes | Script contains no `.delete()` calls |
| Batch safety | Commits in chunks of 450 ops to stay under Firestore 500-op batch limit |

---

### Scoring Logic

Mirrors `functions/src/memberActivitySummaries.ts` exactly:

```ts
// v2 workout or wellness
clampNumber(storedPoints, 0, MAX_ACTIVITY_SCORE)

// Legacy workout
clampNumber(Math.round(numberValue(row, 'value')), 1, MAX_ACTIVITY_SCORE)

// Legacy wellness
clampNumber(Math.round(storedPoints || value || 1), 1, MAX_ACTIVITY_SCORE)
```

`MAX_ACTIVITY_SCORE = 1000` — same as the CF constant.

---

### Output Fields Written to `challengeLeaderboards`

| Field | Value |
|-------|-------|
| `challengeId` | From log |
| `groupId` | From log or challenge lookup |
| `userId` | From log |
| `displayName` | Resolved from users collection |
| `activityCount` | Total logs processed for this `(challengeId, userId)` pair |
| `score` | Sum of per-log scores (v2 or legacy path) |
| `lastActivityAt` | Most recent log timestamp |
| `lastScoringVersion` | `'v2'` / `'legacy'` / `'mixed'` depending on log mix |
| `backfilledAt` | Server timestamp — marks that this doc was rebuilt by the script |
| `updatedAt` | Server timestamp |

---

### npm Scripts Added

```
npm run backfill:leaderboard-scoring          # dry-run (requires credentials)
npm run backfill:leaderboard-scoring:apply    # apply (requires credentials + CONFIRM_PROJECT_ID for production)
```

---

### `scripts/testScoringGuards.ts` — Section 13 (P4H guards)

Added 7 new assertions:

1. Script requires `GOOGLE_APPLICATION_CREDENTIALS`
2. Script requires `CONFIRM_PROJECT_ID` for production apply
3. Script requires `--apply` flag for writes
4. Script does NOT write to `workouts` collection
5. Script does NOT write to `wellnessLogs` collection
6. Script writes to `challengeLeaderboards`
7. v2 path uses `clampNumber(..., 0, ...)` — min=0, allows anti-gaming 0-point floor
8. Legacy workout path uses `Math.round(value)`
9. Legacy wellness path uses `storedPoints || value || 1`

---

## Validation Results

```
npm run test:scoring-guards          → scoring guards passed   (85 assertions, 9 new P4H guards)
npm run test:home-challenge-feeds    → home challenge feed guards passed
npm run test:home-performance-guards → home performance guards passed
npm run test:pilot-ux-polish-guards  → pilot UX polish guards passed
npx tsc -b --pretty false            → (no errors)
npm run build                        → ✓ built in 3.44s
npm --prefix functions run build     → (no errors)
npm --prefix functions run lint      → (no errors)

npm run backfill:leaderboard-scoring →
  [backfill] ERROR: GOOGLE_APPLICATION_CREDENTIALS is not set.
  [backfill]   Export the path to a service account key JSON before running:
  [backfill]   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
  exit 1
```

The credential check is the expected output in environments without service account credentials. The guard is working correctly.

---

## How to Run After Deployment

### Dry-run (always run first)

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/tiizi-challenges-sa.json
export FIREBASE_PROJECT_ID=tiizi-challenges
npm run backfill:leaderboard-scoring
```

Review the JSON output. Check:
- `scoreChanges.docsWithScoreDelta` — how many leaderboard docs will change
- `scoreChanges.sampleChanges` — top-10 largest deltas; verify they make sense
- `logs.v2Logs` vs `logs.legacyLogs` — ratio of v2 to legacy logs processed
- `scoreChanges.staleLeaderboardDocs` — docs that exist but have no matching logs (investigate before applying)

### Apply

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/tiizi-challenges-sa.json
export FIREBASE_PROJECT_ID=tiizi-challenges
export CONFIRM_PROJECT_ID=tiizi-challenges
npm run backfill:leaderboard-scoring:apply
```

---

## Post-Backfill Verification

After applying, verify in the Firebase console or via a read script:

1. Sample 3–5 `challengeLeaderboards` docs with `lastScoringVersion: 'v2'` — confirm `score` matches `sum(workouts.points)` for that `(challengeId, userId)`.
2. Sample 3–5 docs with `lastScoringVersion: 'legacy'` — confirm `score` is consistent with `Math.round(value)` for old logs.
3. Confirm `backfilledAt` is present on written docs.
4. Check that no `workouts` or `wellnessLogs` docs were modified (`updatedAt` should be unaffected).

---

## Stale Leaderboard Docs

The dry-run report includes `scoreChanges.staleLeaderboardDocs` — docs in `challengeLeaderboards` that have no matching workout or wellness log. These may be:
- Docs created by the Cloud Function for users who later deleted their logs (not possible under current rules, but defensively handled)
- Orphans from test data

The backfill script does **not** delete these. If stale docs need cleanup, run a separate targeted cleanup after manual review.

---

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `scripts/backfillLeaderboardScoring.ts` | New | Scoring-aware leaderboard rebuild script |
| `package.json` | Modified | Added `backfill:leaderboard-scoring` and `backfill:leaderboard-scoring:apply` scripts |
| `scripts/testScoringGuards.ts` | Modified | 9 new P4H safety guards (85 total) |

---

## Deployment Notes

- Run dry-run **after** deploying the branch (P4B–P4G) to Firestore and Functions.
- Run apply only once per environment, then verify.
- The script is idempotent: running it twice produces the same result (absolute score recompute, not incremental).
- After backfill, the Cloud Functions will keep scores current for all new v2 logs automatically — no scheduled re-run needed.
