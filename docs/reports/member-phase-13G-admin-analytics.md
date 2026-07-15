# Phase 13G — Admin Analytics Accuracy

**Date:** 2026-06-26  
**Branch:** fix/p0-pre-deploy-blockers  
**Scope:** Admin dashboard analytics — correctness audit of every displayed metric  
**Code changes:** 1 file modified  
**Schema changes:** None  
**Firestore rules changes:** None

---

## Audit Findings

### Metrics Audited

| Metric | Data Source | Verdict |
|---|---|---|
| Total Challenges | `challenges` collection — document count | ✅ Correct |
| Active Challenges | `challenges` — `status === 'active'` filter | ✅ Correct |
| Completed Challenges | `challenges` — `status === 'completed'` filter | ✅ Correct |
| Avg Participants | `challenges.participantCount` average | ✅ Correct (maintained by Phase 13D BUG-005 fix) |
| **Avg Completion %** | `challenges.progress` average | ❌ **WRONG — always 0** |
| Challenge Types | `challenges.challengeType` group-by | ✅ Correct |

---

## Root Cause — `avgCompletionRate` Always Zero

### What the code did

```typescript
// adminChallengeService.ts — getChallengeAnalytics() (before fix)
const withCompletion = all.map((c) => Number(c.progress ?? 0));
const avgCompletionRate = withCompletion.length
  ? withCompletion.reduce((sum, v) => sum + v, 0) / withCompletion.length
  : 0;
```

This averaged `challenge.progress` across all challenge documents.

### Why `challenge.progress` is always 0

`progress: 0` is written exactly once — in `createChallengeFromAdmin()` at challenge creation. No engine ever updates it:

| Engine | Writes to challenge doc? | Writes `progress`? |
|---|---|---|
| LegacyEngine | No | No |
| StreakEngine | No | No |
| CompetitiveEngine | No | No |
| CollectiveEngine | Yes (`groupCurrentTotal`, `status`) | No |

Confirmed by grep: the only occurrence of `.progress` in services (excluding `adminChallengeService.ts`) is in the initial `progress: 0` write in `createChallengeFromAdmin`.

### Correct source of truth

All four engines write `completionRate` to the **`challengeMembers`** document on every log event:

- `LegacyEngine` → `completionRate = activitiesCompleted / totalActivities × 100`
- `StreakEngine` → `completionRate = currentStreak / requiredConsecutiveDays × 100` (capped at 100 on completion)
- `CompetitiveEngine` → `completionRate = average of per-activity rates`
- `CollectiveEngine` → `completionRate = cumulativeLoggedValue / memberTarget × 100`

The member `completionRate` is merged into `challengeMembers/<membershipId>` via `batch.set(membershipRef, membershipUpdate, { merge: true })` in both `workoutService.ts` and `wellnessLogService.ts`.

---

## Fix

**File:** `src/services/adminChallengeService.ts` — `getChallengeAnalytics()`

Replace the `challenge.progress` average with a `challengeMembers` query that averages `completionRate` across non-abandoned members.

```typescript
// BEFORE
const withCompletion = all.map((c) => Number(c.progress ?? 0));
const avgCompletionRate = withCompletion.length
  ? Number((withCompletion.reduce((sum, value) => sum + value, 0) / withCompletion.length).toFixed(2))
  : 0;

// AFTER
const [challengeSnap, memberSnap] = await Promise.all([
  getDocs(collection(db, this.collectionName)),
  getDocs(query(collection(db, 'challengeMembers'), where('status', 'in', ['active', 'completed']))),
]);
// ...
const memberRates = memberSnap.docs.map((d) => Number(d.data().completionRate ?? 0));
const avgCompletionRate = memberRates.length
  ? Number((memberRates.reduce((sum, v) => sum + v, 0) / memberRates.length).toFixed(2))
  : 0;
```

**Design decisions:**

- **Filter to `status in ['active', 'completed']`** — excludes `abandoned` members. Counting abandoned members (who logged nothing after joining) would artificially deflate the average. The metric should reflect members who are actively participating or have completed.
- **Parallel fetch** — `challengeSnap` and `memberSnap` are fetched via `Promise.all`, so the extra query adds no serial latency.
- **No UI change** — `ChallengeAnalyticsScreen.tsx` displays `data?.avgCompletionRate ?? 0` unchanged. The value is now correct.

---

## Regression Guards (13G-1 through 13G-4)

| Guard | What it tests |
|---|---|
| 13G-1 | `getChallengeAnalytics` reads from `challengeMembers` collection |
| 13G-2 | Query filters members to `status in ['active', 'completed']` |
| 13G-3 | `completionRate` field is read from member documents |
| 13G-4 | `challenge.progress` is no longer used for `avgCompletionRate` |

---

## Validation

```
npx tsc -b --pretty false         → 0 errors ✅
npm run build                     → ✓ built in 3.74s ✅
npm run test:scoring-guards       → scoring guards passed (13C-1 through 13G-4) ✅
```

---

## Files Changed

| File | Change |
|---|---|
| `src/services/adminChallengeService.ts` | `getChallengeAnalytics` — replaced `challenge.progress` average with `challengeMembers.completionRate` average across non-abandoned members |
| `scripts/testScoringGuards.ts` | Guards 13G-1 through 13G-4 |
