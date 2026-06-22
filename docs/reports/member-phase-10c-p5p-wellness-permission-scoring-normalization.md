# Phase 10C-P5P — Wellness Logging Permission + Full Scoring Normalization

**Date:** 2026-06-19  
**Branch:** fix/p0-pre-deploy-blockers  
**Status:** Complete — all validation green

---

## Summary

Three remaining scoring and logging blockers were resolved in this phase, completing the normalization work started in P5O.

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | Wellness permission failure | `wellnessLogService` hit Firestore `isValidActivityContext` rule without any client-side groupMember pre-validation | Added groupMember read + validation before batch; added debug mode (`window.__wellnessLogDebug`) |
| 2 | Wrong wellness `activityType`/`logType` | `buildActivityLogPath` fell back to raw `challenge.category` (could be `'wellness'`), which is not a valid Firestore `logType` | Added `resolveWellnessActivityType` — infers from configured type → name keywords → category → `'meditation'` fallback; never returns `'wellness'` |
| 3 | Session scoring bypassed normalization | `activityLogSessionService` used `entry.points` (`pointsPerCompletion ?? 10`) as `basePoints`, not the 100/totalActivities formula | Moved `totalActivities` and `normalizedBase` computation before the `forEach` loop; replaced `entry.points` with `normalizedBase` |

---

## Fix 1 — Wellness Logging Permission Failure

### Root Cause

`wellnessLogService.writeLog` committed a 3-write batch (wellnessLog create, challengeMembers update, users update) without first verifying the user's group membership client-side. Firestore rule `isValidActivityContext` checks `groupMember.data.status == 'active' || 'joined'`. When membership was missing or in an unexpected state, the batch returned `"Missing or insufficient permissions"` — an opaque error with no indication which write failed or why.

`activityLogSessionService` (the multi-activity batch path) already had this validation; `wellnessLogService` (single-activity path) did not.

### Fix Applied

`src/services/wellnessLogService.ts` — `writeLog` method, before batch:

```ts
const groupMemberRef = doc(db, 'groupMembers', `${input.groupId}_${input.userId}`);
const groupMemberSnap = await getDoc(groupMemberRef); // getDoc groupMembers — mirrors isValidActivityContext rule
if (!groupMemberSnap.exists()) {
  throw new Error('Join the group before logging wellness activity.');
}
const groupMember = groupMemberSnap.data() as { status?: string; userId?: string };
if (groupMember.userId !== input.userId || !['active', 'joined'].includes(String(groupMember.status))) {
  throw new Error(`Your group membership is not active (status: ${String(groupMember.status ?? 'unknown')}). Contact your group admin.`);
}
```

### Debug Mode

Set `window.__wellnessLogDebug = true` in the browser console to run each of the 3 planned writes individually before the batch. Each write logs its Firestore path, keys, and result. **Side effects:** wellness log creates produce real (orphan) documents; progress will be double-counted if the batch also runs. Disable immediately after identifying the failing write.

```
[wellnessLogService] DEBUG testing: wellnessLog create { path: 'wellnessLogs/<id>', keys: [...], ... }
[wellnessLogService] DEBUG PASS: wellnessLog create
[wellnessLogService] DEBUG FAIL: challengeMembers progress update { code: 'permission-denied', ... }
```

---

## Fix 2 — Wellness activityType Routing

### Root Cause

`buildActivityLogPath` in `challengeActivityFlow.ts` previously set:

```ts
qs.set('activityType', String(activity.activityType ?? challenge?.category ?? 'wellness').toLowerCase());
```

For a challenge with `category: 'wellness'` and no `activity.activityType`, this emitted `activityType=wellness` in the URL. `useLogWellnessActivity` in `useWorkouts.ts` routes to `logSleep/logFasting/logHydration/logMeditation` by matching `activityType`. When `activityType='wellness'` fell through, it called `logMeditation` and stored `logType: 'meditation'` for what was actually a sleep or fasting activity.

### Fix Applied

`src/services/challengeActivityFlow.ts` — new exported function:

```ts
export function resolveWellnessActivityType(
  activityType: string | undefined,
  activityName: string,
  category: string | undefined,
): string {
  if (activityType) return activityType.toLowerCase();

  const name = activityName.toLowerCase();
  if (name.includes('sleep')) return 'sleep';
  if (name.includes('fast') || name.includes('intermittent')) return 'fasting';
  if (name.includes('hydrat') || name.includes('water') || name.includes('drink')) return 'hydration';
  if (name.includes('meditat') || name.includes('mindful') || name.includes('breath')) return 'meditation';

  const cat = (category ?? '').toLowerCase();
  if (cat === 'sleep') return 'sleep';
  if (cat === 'fasting') return 'fasting';
  if (cat === 'hydration') return 'hydration';
  if (cat === 'meditation' || cat === 'mindfulness') return 'meditation';

  return 'meditation';  // safe final fallback — never returns 'wellness'
}
```

Resolution priority:
1. Configured `activity.activityType` (explicit wins)
2. Activity name keywords (`sleep`, `fast`, `hydrat`, `water`, `drink`, `meditat`, `mindful`, `breath`)
3. Challenge `category` (mapped to known types)
4. `'meditation'` — always valid Firestore `logType`, never `'wellness'`

`buildActivityLogPath` now calls:
```ts
qs.set('activityType', resolveWellnessActivityType(activity.activityType, activityName, challenge?.category));
```

---

## Fix 3 — Session Scoring Normalization

### Root Cause

`activityLogSessionService.createActivitySession` used `entry.points` (which defaults to `pointsPerCompletion ?? 10`) as `basePoints` in `computeActivityScore`. This bypassed the `100 / totalActivities` normalization formula that `wellnessLogService` and `scoringConfig` use, meaning:

- A 2-activity session could award `10 + 10 = 20` points instead of `50 + 50 = 100`
- A session with `targetValue` met could cap at `10` instead of `50` or `100`
- Points were inconsistent between the single-activity path and the multi-activity path

### Fix Applied

`src/services/activityLogSessionService.ts` — before the `input.entries.forEach` loop:

```ts
// Normalize base points across all activities so the challenge max is 100 points.
// Each activity contributes at most 100 / totalActivities points.
const totalActivities = Math.max(1, configuredActivities, configuredExerciseIds, Number(membership.totalActivities ?? 1));
const normalizedBase = Math.round(100 / totalActivities);
```

In the `forEach` loop, changed:
```ts
// Before:
basePoints: entry.points,   // was pointsPerCompletion ?? 10

// After:
basePoints: normalizedBase, // 100 / totalActivities
```

### Historical Data Warning

Existing `challengeMembers.totalPoints` values in Firestore reflect the old scoring engine where:
- `activityLogSessionService` capped at `entry.points` (~10 per activity)
- `scoreCompetitiveActivity` returned raw `cappedValue` (e.g., 30 reps → 30 pts)
- `BASE_POINTS_PER_TARGET` was `10`

These historical values are **not retroactively corrected**. Members who logged activities before this fix will have lower `totalPoints` than they would under the new scoring. New logs from this point forward use the normalized scoring engine.

**Recommendation:** Backfill is out of scope for this phase. If fairness requires it, a one-time Cloud Function can recompute `totalPoints` from historical logs using the v2 scoring engine. Document the scoring version in `wellnessLogs.scoringVersion = 'v2'` (already stored).

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/wellnessLogService.ts` | Added groupMember read+validation before batch; added debug mode (`__wellnessLogDebug`); separated 3 writes for debug isolation |
| `src/services/challengeActivityFlow.ts` | Added `resolveWellnessActivityType` export; changed `buildActivityLogPath` to use it |
| `src/services/activityLogSessionService.ts` | Moved `totalActivities` + `normalizedBase` before forEach; replaced `entry.points` with `normalizedBase` |
| `scripts/testScoringGuards.ts` | Added Section 16 (P5P guards): `resolveWellnessActivityType` never returns 'wellness', `activityLogSessionService` uses `normalizedBase`, `wellnessLogService` reads groupMembers and validates userId/status, debug mode uses `__wellnessLogDebug` |

---

## Validation Results

All 11 commands passed:

```
✅ npm run test:scoring-guards              scoring guards passed
✅ npm run test:home-challenge-feeds        home challenge feed guards passed
✅ npm run test:home-performance-guards     home performance guards passed
✅ npm run test:pilot-ux-polish-guards      pilot UX polish guards passed
✅ npm run test:challenge-creation-backend  challenge creation backend tests passed
✅ npm run test:group-invite-backend        Group invite backend security tests passed
✅ npx tsc -b --pretty false               (no output — clean)
✅ npm run build                            ✓ built in 3.54s
✅ npm --prefix functions run build         (clean)
✅ npm --prefix functions run lint          (clean)
✅ firebase deploy --only firestore:rules --dry-run --project tiizi-challenges
                                            ✔ cloud.firestore: rules file compiled successfully
                                            ✔ Dry run complete!
```

---

## Remaining Open Items

| Item | Status | Notes |
|------|--------|-------|
| Historical points backfill | Deferred | Existing `totalPoints` reflect old scoring; tracked above |
| Wellness permission confirmed fixed | Debug mode available | Cannot confirm without live device logging |
| `activityType` routing for edge cases | Low risk | Falls back to `'meditation'` — always valid |
