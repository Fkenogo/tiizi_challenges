# Phase 10C-P4E — Cloud Function Leaderboard Scoring

Date: 2026-06-17  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — Cloud Functions now use v2 stored points for leaderboard scoring; legacy behavior preserved

---

## Summary

P4C and P4D wired the scoring engine into all client and service logging paths. This phase closes the final gap: the `memberActivitySummaries` Cloud Functions were still computing leaderboard score from raw activity value (workouts) or the stored `points` field without checking scoring version (wellness). Leaderboards were therefore inconsistent with the v2 engine — a 0-point anti-gaming result on the client would still increment the leaderboard.

---

## What Changed

### `functions/src/memberActivitySummaries.ts`

**`ActivitySummaryInput` type** — added two new fields:

```ts
score: number;
scoringVersion: 'v2' | 'legacy';
lastScoringMethod?: string;
```

The `score` field replaces the old implicit raw-value–based scoring. The version and method fields are written to `challengeLeaderboards` for transparency and future backfill.

---

**`summarizeWorkoutCreated`** — replaced raw-value score with v2-aware branch:

```ts
const isV2 = stringValue(data, 'scoringVersion') === 'v2';
const storedPoints = numberValue(data, 'points');
const score = isV2
  ? clampNumber(storedPoints, 0, ACTIVITY_SUMMARY_LIMITS.maxActivityScore)
  : clampNumber(Math.round(value), 1, ACTIVITY_SUMMARY_LIMITS.maxActivityScore);
const scoringMethod = isV2 ? (stringValue(data, 'scoringMethod') || undefined) : undefined;
```

- **v2 path:** reads `data.points` (engine-computed, stored by `workoutService`) and clamps to `[0, 1000]`. The min is 0 — allowing the anti-gaming floor to reach the leaderboard.
- **Legacy path:** `Math.round(value)` clamped to `[1, 1000]` — identical to pre-P4E behavior.

---

**`summarizeWellnessLogCreated`** — same branch pattern:

```ts
const isV2 = stringValue(data, 'scoringVersion') === 'v2';
const storedPoints = numberValue(data, 'points');
const score = isV2
  ? clampNumber(storedPoints, 0, ACTIVITY_SUMMARY_LIMITS.maxActivityScore)
  : clampNumber(Math.round(storedPoints || value || 1), 1, ACTIVITY_SUMMARY_LIMITS.maxActivityScore);
```

- **v2 path:** reads `data.points` (engine-computed, stored by `wellnessLogService` or `activityLogSessionService`).
- **Legacy path:** `storedPoints || value || 1` clamped to `[1, 1000]` — identical to pre-P4E behavior for old wellness logs that may have either field.

---

**`queueActivitySummaryWrites`** — adds `lastScoringVersion` (and optionally `lastScoringMethod`) to `challengeLeaderboards`:

```ts
const challengeLeaderboardPayload: Record<string, unknown> = {
  ...,
  lastScoringVersion: input.scoringVersion,
  updatedAt: FieldValue.serverTimestamp(),
};
if (input.lastScoringMethod) {
  challengeLeaderboardPayload.lastScoringMethod = input.lastScoringMethod;
}
```

`groupActivityFeed` documents now include `scoringVersion` for display-layer reference.

---

### `scripts/testScoringGuards.ts` — Section 11 (P4E guards)

Added 5 assertions:

1. Cloud Function does NOT import `computeActivityScore` (server scoring reads stored points, not recompute)
2. Cloud Function reads `scoringVersion` from document data
3. Cloud Function reads `points` from document data for v2 scoring
4. Cloud Function does NOT use raw value as leaderboard score for v2 (`isV2` path must not do `Math.round(value)`)
5. v2 branch uses `clampNumber(storedPoints, 0, ...)` — min is 0, not 1

The previously failing assertion (`doesNotMatch` with `/isV2.*clampNumber.*,\s*1,/s`) was replaced with a targeted positive assertion:

```ts
assert.match(
  memberActivitySummaries,
  /clampNumber\(storedPoints,\s*0,/,
  'memberActivitySummaries v2 branch must use min=0 for score ...',
);
```

The `s` (dotall) flag caused the old regex to span both the v2 branch and the legacy branch across newlines, incorrectly flagging correct code.

---

## Scoring Consistency — All Paths

| Logging path | Score source | Leaderboard score | Status |
|---|---|---|---|
| `workoutService` → Firestore → CF trigger | `computeActivityScore(v, t, type)` → stored `points` | `data.points` (v2) | ✅ |
| `wellnessLogService` → Firestore → CF trigger | `computeActivityScore(v, t, type, logType)` → stored `points` | `data.points` (v2) | ✅ |
| `activityLogSessionService` → Firestore → CF trigger | `computeActivityScore(entry)` → stored `points` | `data.points` (v2) | ✅ |
| Legacy workout logs (no `scoringVersion`) | Stored `value` | `Math.round(value)` clamped to [1, 1000] | ✅ preserved |
| Legacy wellness logs (no `scoringVersion`) | Stored `points` or `value` | `storedPoints \|\| value \|\| 1` clamped to [1, 1000] | ✅ preserved |

---

## What Is Not Changed

| System | Status | Next phase |
|---|---|---|
| Leaderboard backfill (old documents) | Not started | P4H |
| `functions/src/scoringConfig.ts` | No calls added — CF reads stored `points` | — |
| Any CF that doesn't write `challengeLeaderboards` | Unchanged | — |

---

## Validation Results

```
npm run test:scoring-guards          → scoring guards passed
npm run test:home-challenge-feeds    → home challenge feed guards passed
npm run test:home-performance-guards → home performance guards passed
npm run test:pilot-ux-polish-guards  → pilot UX polish guards passed
npm run test:challenge-creation-backend → challenge creation backend tests passed
npm run test:group-invite-backend    → Group invite backend security tests passed
npx tsc -b --pretty false            → (no errors)
npm run build                        → ✓ built in 3.59s
npm --prefix functions run build     → (no errors)
npm --prefix functions run lint      → (no errors)
```

---

## Files Changed

| File | Type | Description |
|---|---|---|
| `functions/src/memberActivitySummaries.ts` | Modified | v2-aware score branching in both CF handlers; `lastScoringVersion` / `lastScoringMethod` on leaderboard writes |
| `scripts/testScoringGuards.ts` | Modified | 5 new P4E guards; fixed failing `doesNotMatch` with dotall regex → positive assertion |

---

## Deployment Notes

- Cloud Function changes are backwards-compatible: legacy documents (no `scoringVersion`) fall through to the existing raw-value path.
- No Firestore schema migration needed.
- No leaderboard backfill — historical documents will have legacy-scored entries; P4H will address this.
- Do not deploy until sign-off on P4E and any remaining P4x phases.
