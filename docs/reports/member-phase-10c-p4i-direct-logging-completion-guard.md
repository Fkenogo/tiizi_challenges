# Phase 10C-P4I — Direct Logging Completion Guard

Date: 2026-06-17  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — two-line fix, guards added, all validation passes

---

## Problem

P4C fixed `activityLogSessionService` so that time-bounded challenges (those with an `endDate`) are not immediately auto-completed the first time a member's `completionRate` reaches 100%. Without that guard, a member who logs enough activity on Day 1 of a 30-day challenge would see the challenge disappear from their Active rail that same day.

The two direct-logging paths were missed in P4C:

| Service | File | Condition before P4I |
|---------|------|----------------------|
| `workoutService.createWorkout` | `src/services/workoutService.ts:173` | `if (nextRate >= 100 && membership.status !== 'completed')` |
| `wellnessLogService.writeLog` | `src/services/wellnessLogService.ts:166` | `if (completionRate >= 100 && membership.status !== 'completed')` |

Both would unconditionally set `membership.status = 'completed'` whenever progress hit 100%, regardless of whether the challenge had a remaining endDate.

---

## Fix

Added `&& !endAt` to both completion conditions to match the pattern already in `activityLogSessionService.ts` (line 353).

### `src/services/workoutService.ts`

```ts
// Before
if (nextRate >= 100 && membership.status !== 'completed') {

// After
if (nextRate >= 100 && membership.status !== 'completed' && !endAt) {
```

`endAt` was already declared two lines earlier:
```ts
const endAt = challengeData.endDate ? new Date(challengeData.endDate) : null;
```

### `src/services/wellnessLogService.ts`

```ts
// Before
if (completionRate >= 100 && membership.status !== 'completed') {

// After
if (completionRate >= 100 && membership.status !== 'completed' && !endAt) {
```

`endAt` was already declared earlier:
```ts
const endAt = challenge.endDate ? new Date(challenge.endDate) : null;
```

---

## Behavior After Fix

| Challenge type | 100% progress reached | Membership status |
|---------------|----------------------|-------------------|
| Time-bounded (has `endDate`) | At any time | Stays `active` — lifecycle/endDate resolves it |
| Open-ended (no `endDate`) | When progress hits 100% | Set to `completed` (same as before) |

This matches `activityLogSessionService`'s behavior exactly. All three logging paths now share the same completion semantics.

---

## What Was Not Changed

- v2 scoring metadata (unchanged)
- Points allocation logic (unchanged)
- Progress updates (`activitiesCompleted`, `totalPoints`, `completionRate`, `lastActivityAt`) — all still applied on every log
- Leaderboard behavior (unchanged — Cloud Functions handle leaderboard writes independently)
- Firestore rules (no changes needed — `completionRate` and progress fields are already writable; no new fields introduced)

---

## Guards Added — `scripts/testScoringGuards.ts` Section 14

Added 4 new assertions (total now 89+):

1. `workoutService` completion condition includes `!endAt`
2. `wellnessLogService` completion condition includes `!endAt`
3. `activityLogSessionService` completion condition includes `!endAt` (anchor — ensures the reference doesn't regress)
4. All three services use the exact canonical pattern

---

## Validation Results

```
npm run test:scoring-guards          → scoring guards passed
npm run test:home-challenge-feeds    → home challenge feed guards passed
npm run test:home-performance-guards → home performance guards passed
npm run test:pilot-ux-polish-guards  → pilot UX polish guards passed
npx tsc -b --pretty false            → (no errors)
npm run build                        → ✓ built in 2.86s
firebase deploy --only firestore:rules --dry-run --project tiizi-challenges
  → rules file firestore.rules compiled successfully
  → Dry run complete!
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/workoutService.ts` | Added `&& !endAt` to membership completion condition |
| `src/services/wellnessLogService.ts` | Added `&& !endAt` to membership completion condition |
| `scripts/testScoringGuards.ts` | Added Section 14 — 4 new completion guard assertions |

---

## Deployment Notes

No Firestore rules changes. Deploys with the rest of the branch. No backfill needed — `challengeMembers` docs that were incorrectly set to `completed` can be identified via the admin console (look for `status: 'completed'` docs where the parent challenge is still active and has a future `endDate`), but that cleanup is out of scope for this phase.
