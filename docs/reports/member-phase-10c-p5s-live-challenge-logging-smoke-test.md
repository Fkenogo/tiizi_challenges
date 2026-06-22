# Phase 10C-P5S — Challenge Logging Smoke Test

**Date:** 2026-06-19  
**Branch:** fix/p0-pre-deploy-blockers  
**Method:** Static analysis — code tracing, Firestore rule cross-reference, data flow audit  
**Scope:** Post P5P/P5R fixes — wellness logging, exercise scoring, multi-activity sessions, completion flow, history/trending display  

> **Note on method:** This report is based on static analysis of the current codebase and Firestore rules, not live browser execution. Findings are labeled **CONFIRMED** (provable from code) or **PREDICTED** (likely given the code path but not observable without a running device). All findings include the exact code location.

---

## Summary Table

| # | Flow | Severity | Finding | Status |
|---|------|----------|---------|--------|
| F1 | Wellness logging | **HIGH** | `SelectChallengeActivityScreen` still passes `activityType='wellness'` to session service — writes wrong `logType: 'meditation'` | CONFIRMED |
| F2 | Completion display | **MEDIUM** | `ChallengeDetailScreen` completed banner shows "1 of **0** activities" — `totalActivities` is `0` in Firestore (never updated after join) | CONFIRMED |
| F3 | Trending section | **LOW** | Completed challenges reappear in Trending with "Join" action (not "View" or "Completed") — `joinedChallengeIds` excludes completed memberships | CONFIRMED |
| F4 | Exercise scoring | **LOW** | `workoutService.logWorkout` (direct path) uses `BASE_POINTS_PER_TARGET = 100` without `normalizedBase` — correct for 1-activity challenges, over-awards on multi-activity direct-log | CONFIRMED |
| F5 | Re-logging | **LOW** | Completed challenges can be re-logged repeatedly — Firestore rule `isSafeChallengeProgressUpdate` permits `activitiesCompleted` to stay at max while `totalPoints` increments each time | CONFIRMED |
| F6 | Wellness logging | **PASS** | Permission failure (`Missing or insufficient permissions`) fixed — groupMember pre-validation added in P5P | CONFIRMED |
| F7 | Exercise scoring | **PASS** | Points are normalized, not raw reps — `scoreCompetitiveActivity` uses `ratio × basePoints` since P5O | CONFIRMED |
| F8 | Multi-activity session | **PASS** | Mixed-unit raw value addition eliminated — each entry scored independently through `computeActivityScore` | CONFIRMED |
| F9 | Ongoing/Active filter | **PASS** | Completed challenges are excluded from Ongoing (ChallengesScreen) and Active (HomeScreen) | CONFIRMED |
| F10 | Completed Challenges | **PASS** | Profile → Wins routes to `/app/challenges/history` → `CompletedChallengesScreen` queries `status=='completed'` | CONFIRMED |
| F11 | Wellness log write | **PASS** | `logType` is always one of `['fasting','hydration','sleep','meditation']` — Firestore rule enforces this | CONFIRMED |

---

## Flow 1 — Wellness Challenge Logging

### F1 ⚠️ HIGH — `SelectChallengeActivityScreen` still emits `activityType='wellness'`

**Code path:**  
`ChallengeDetailScreen` → `SelectChallengeActivityScreen` → `activityLogSessionService`

**Root cause:**  
[`SelectChallengeActivityScreen.tsx:200`](src/features/Workouts/SelectChallengeActivityScreen.tsx):
```ts
activityType: String(optional.activityType ?? challenge.category ?? 'wellness'),
```

When `activity.activityType` is undefined (common in wellness challenges configured without it) and `challenge.category` is `'wellness'`, this emits `'wellness'` as `activityType` into the session entry.

`activityLogSessionService.normalizedWellnessType('wellness')` falls through all branches and returns `'meditation'` (the catch-all). The document stored in Firestore has `logType: 'meditation'` for what may be a sleep or hydration challenge.

This path is **not covered** by the P5P fix. The P5P fix added `resolveWellnessActivityType` to `buildActivityLogPath` (used by single-activity log screens). `SelectChallengeActivityScreen` builds entries directly, bypassing `buildActivityLogPath`.

**Effect:**
- `logType: 'meditation'` stored for sleep/fasting/hydration challenges logged via "Save Activities"
- Wrong `logType` does not cause a permission error (Firestore allows `'meditation'`)
- Affects data integrity and any future analytics on wellness log types

**Recommended fix:**  
Import `resolveWellnessActivityType` from `challengeActivityFlow.ts` and use it in `SelectChallengeActivityScreen` entry construction:

```ts
// Before:
activityType: String(optional.activityType ?? challenge.category ?? 'wellness'),

// After:
activityType: resolveWellnessActivityType(
  optional.activityType,
  label,
  challenge.category,
),
```

**Files:** [`src/features/Workouts/SelectChallengeActivityScreen.tsx:200`](src/features/Workouts/SelectChallengeActivityScreen.tsx)

---

### F6 ✅ PASS — Wellness permission failure resolved

**Tested path:** `wellnessLogService.writeLog` → `batch.commit()`

The P5P fix added groupMember pre-validation before the batch:
```ts
const groupMemberSnap = await getDoc(groupMemberRef); // getDoc groupMembers
if (!groupMemberSnap.exists()) { throw new Error('Join the group...'); }
if (!['active', 'joined'].includes(String(groupMember.status))) { throw ... }
```

This mirrors the Firestore `isValidActivityContext` rule exactly. The permission failure is now caught client-side with a meaningful error message rather than an opaque "Missing or insufficient permissions."

**Confidence:** High — the fix pattern matches `activityLogSessionService` (which has worked correctly).

---

### F11 ✅ PASS — `logType` is always a valid Firestore enum value

Both log paths guarantee this:
- `wellnessLogService`: `logType` is the literal `'fasting' | 'hydration' | 'sleep' | 'meditation'` parameter passed to `writeLog`
- `activityLogSessionService`: `normalizedWellnessType(activityType)` always returns one of the four (even when input is `'wellness'` → `'meditation'`)

Firestore rule: `data.logType in ['fasting', 'hydration', 'sleep', 'meditation']` — enforced at write time. No write can store an invalid `logType`.

---

## Flow 2 — Exercise Challenge Logging (Scoring)

### F7 ✅ PASS — Points are normalized, not raw reps

**Tested path:** Any value logged via `activityLogSessionService` or `wellnessLogService`

`computeActivityScore` with `basePoints = Math.round(100 / totalActivities)`:

| Scenario | Old behavior | New behavior |
|----------|-------------|-------------|
| 30 pushups, target 40, 1-activity challenge | 30 pts (raw cappedValue) | 25 pts (30/120 × 100) |
| 40 pushups, target 40, 1-activity challenge | 40 pts | 33 pts |
| 120 pushups, target 40, 1-activity challenge | 120 pts | 100 pts (capped) |
| 30 pushups, target 40, 2-activity challenge | N/A (session fixed in P5P) | 12 pts (30/120 × 50) |

### F4 ⚠️ LOW — `workoutService.logWorkout` (direct path) unnormalized

**Code location:** [`src/services/workoutService.ts:98-102`](src/services/workoutService.ts)
```ts
const scoring = computeActivityScore({
  value: input.value,
  targetValue: input.targetValue ?? 0,
  challengeType: (challengeData.challengeType as ChallengeType) ?? 'collective',
  // no basePoints → defaults to BASE_POINTS_PER_TARGET = 100
});
```

**When this path is triggered:**  
Only via `LogWorkoutScreen` (`/app/workouts/log`), which is reached from `ExerciseDetailScreen`. `ChallengeDetailScreen` always routes to `SelectChallengeActivityScreen` instead.

**Effect:**  
For a 3-activity challenge where the user navigates to an individual exercise and logs directly: each workout earns up to 100 pts → potential 300 pts for a challenge that should max at 100. This is unlikely to occur in practice (the normal log flow goes through `SelectChallengeActivityScreen`) but represents a scoring inconsistency.

**Recommended fix:** Pass `normalizedBase` to `workoutService.createWorkout` — requires reading the challenge membership count before scoring. Medium complexity; low urgency.

---

## Flow 3 — Multi-Activity Challenge

### F8 ✅ PASS — Mixed-unit raw values not summed

**Code path:** `SelectChallengeActivityScreen` → `activityLogSessionService`

Each entry is scored independently through `computeActivityScore` with its own `targetValue` and `normalizedBase`. The `totalPoints` displayed on the success screen (`result.totalPoints`) is the sum of individual scored points, not raw values.

For a challenge with activity A (reps) and activity B (seconds):
```
normalizedBase = Math.round(100 / 2) = 50
A: score = computeActivityScore(value=15, target=30, basePoints=50) → proportional to 50
B: score = computeActivityScore(value=45, target=60, basePoints=50) → proportional to 50
total = sum of normalized scores ≤ 100
```

### `completionRate` correctness

`activityLogSessionService`:
```ts
const nextCompleted = Math.min(
  membership.activitiesCompleted + entries.length,
  totalActivities
);
const nextRate = Math.min(100, Math.round((nextCompleted / totalActivities) * 100));
```

For a 2-activity challenge logged in one session, `entries.length = 2`, `totalActivities = 2`:
```
nextCompleted = min(0+2, 2) = 2
nextRate = min(100, round(2/2 * 100)) = 100
```

`completionRate = 100` is **correct** here. The false 100% bug from P5O (where `targetValue` was always equal to `value`) is fixed. The success screen's `completionRate` now derives from the actual activity-level target sums.

---

## Flow 4 — Completion and History

### F2 ⚠️ MEDIUM — Completed banner: "1 of 0 activities"

**Code location:** [`src/features/Challenges/ChallengeDetailScreen.tsx:337`](src/features/Challenges/ChallengeDetailScreen.tsx)
```tsx
{membership.activitiesCompleted} of {membership.totalActivities} activities
```

**Root cause:** `challengeService.joinChallenge` writes `totalActivities: 0` to Firestore on join:
```ts
batch.set(memberRef, {
  ...
  totalActivities: 0,  // ← never updated
  activitiesCompleted: 0,
  ...
});
```

`isSafeChallengeProgressUpdate` (Firestore rule) does NOT allow `totalActivities` in the update key set — it can only be written on create. Log services never update it.

The completed banner therefore always displays `"1 of 0 activities"` (or `"N of 0"` for multi-activity).

**Effect:** Cosmetic only — scoring and `completionRate` use the correct `configuredActivities` count from the challenge doc. Only the display in `ChallengeDetailScreen` is wrong.

**Recommended fix:** Either:
- Set `totalActivities = challenge.activities.length` in `joinChallenge` before writing the member doc (correct fix — matches what Firestore sees)
- Or read `challenge.activities.length` in `ChallengeDetailScreen` when `membership.totalActivities === 0`

**Files:** [`src/services/challengeService.ts:266`](src/services/challengeService.ts) (joinChallenge)

### F9 ✅ PASS — Completed challenges excluded from Ongoing and Active

**ChallengesScreen:**
```ts
const ongoingCards = useMemo(() => {
  return visibleChallenges
    .filter((item) => membershipIndex.get(item.id) !== 'completed') // ← excludes completed
```

`getUserChallengeMembershipIndex` queries ALL memberships (no status filter) and includes `status='completed'`. So `membershipIndex.get(id) === 'completed'` for completed challenges → correctly excluded from Ongoing.

**HomeScreen:** `getActiveChallengesForUser` queries `where('status', '==', 'active')` → completed memberships never appear in active list.

### F10 ✅ PASS — Profile → Completed Challenges works

`ProfileScreen` → `navigate('/app/challenges/history')` → `CompletedChallengesScreen`  
→ `challengeService.getCompletedChallengesForUser(uid)` → `where('status', '==', 'completed')`

Route is registered: [`src/App.tsx:284`](src/App.tsx)

### F3 ⚠️ LOW — Trending shows completed challenges as "Join"

**Code path:** `useHomeScreen.ts:143`
```ts
const joinedChallengeIds = new Set<string>(
  activeChallenges.map((challenge) => challenge.id) // only 'active' memberships
);
```

Completed memberships are not in `activeChallenges` (queried with `status: ['active']`). So a challenge the user has completed appears in Trending with `joined = false` → `actionLabel = 'Join'`.

**Effect:** A user who completed a challenge sees it in Trending marked "Join" — misleading. Clicking it will navigate to `ChallengeDetailScreen` where they can see the "Challenge Completed" banner, so no data corruption occurs.

**Recommended fix:** Also add completed membership IDs to `joinedChallengeIds`:
```ts
const joinedChallengeIds = new Set<string>([
  ...activeChallenges.map((c) => c.id),
  // add completed challenge IDs from membershipIndex
]);
```

---

## Flow 5 — Re-logging Completed Challenges

### F5 ⚠️ LOW — Firestore rule permits re-logging after completion

**Scenario:** User has completed a 1-activity challenge. `activitiesCompleted = 1`, `status = 'completed'`, `totalPoints = 75`.

User logs again. `wellnessLogService` computes:
```ts
completed = Math.min(1+1, 1) = 1  // capped at totalActivities
```

Firestore `isSafeChallengeProgressUpdate` checks:
```
activitiesCompleted (1) >= existingActivitiesCompleted (1) ✓
activitiesCompleted (1) <= activityCount (1) ✓
totalPoints (75+50=125) >= existingChallengePoints (75) ✓
totalPoints (125) <= 75 + (1 * 1000) = 1075 ✓
```

The update succeeds. `totalPoints` accumulates unboundedly across repeated logs.

**Note:** `wellnessLogService` checks `membership.status !== 'completed'` before setting `status='completed'` again — so `status` and `completedAt` are idempotent. Only `totalPoints` grows.

**Severity:** Low — requires deliberate repeated logging by the user. Not exploitable at scale (each log requires a valid `value > 0` and a real session). Product decision whether to gate by status check.

**Recommended fix (if needed):** In `wellnessLogService.writeLog` and `activityLogSessionService`, throw before scoring if `membership.status === 'completed'`:
```ts
if (membership.status === 'completed') {
  throw new Error('You have already completed this challenge.');
}
```

---

## Scoring Normalization Verification

| Challenge type | Activities | Path | basePoints | Formula | Max total pts |
|---------------|-----------|------|-----------|---------|--------------|
| Wellness (single) | 1 | wellnessLogService | 100 | `100/1` | 100 |
| Wellness (2-activity) | 2 | wellnessLogService | 50 | `100/2` | 100 |
| Exercise (direct) | 1 | workoutService | 100 | `BASE_POINTS_PER_TARGET` | 100 ✓ |
| Exercise (direct) | 3 | workoutService | 100 (bug) | `BASE_POINTS_PER_TARGET` | 300 ⚠️ |
| Multi-activity session | N | activityLogSessionService | `100/N` | `Math.round(100/totalActivities)` | 100 |
| Competitive (target met) | 1 | any | 100 | `ratio × basePoints` | 100 |
| Competitive (3× over) | 1 | any | 100 | capped at 3× target | 100 |
| Streak (binary) | 1 | any | 100 | `targetMet ? basePoints : 0` | 100 |

---

## Firestore Rule Compliance Summary

| Rule | Client behavior | Verdict |
|------|----------------|---------|
| `isValidActivityContext` (groupMember.status) | Pre-validated client-side in wellnessLogService + sessionService | ✅ |
| `logType in ['fasting','hydration','sleep','meditation']` | Guaranteed by normalizedWellnessType; 'wellness' → 'meditation' | ✅ (but wrong value for F1) |
| `value > 0 && value <= 10000` | Enforced by assertSafeActivityValue | ✅ |
| `points >= 0 (v2) / > 0 (legacy)` | Guaranteed — value > 0 means some points always computed | ✅ |
| `scoringVersion == 'v2'` | All three log services set `scoringVersion: 'v2'` | ✅ |
| `isSafeChallengeProgressUpdate`: allowed keys | Log services only write allowed keys | ✅ |
| `activitiesCompleted <= activityCount` | `Math.min(existing+1, totalActivities)` where totalActivities = configuredActivities | ✅ |
| `totalPoints <= existing + (activityCount * 1000)` | `normalizedBase ≤ 100 ≤ 1000` per activity | ✅ |

---

## Recommended Fixes (Priority Order)

| Priority | Finding | Fix | Complexity |
|----------|---------|-----|-----------|
| 1 — HIGH | F1: `SelectChallengeActivityScreen` emits `activityType='wellness'` | Use `resolveWellnessActivityType` in entry construction | Low (1-line change + import) |
| 2 — MEDIUM | F2: Completed banner shows "0 activities" | Set `totalActivities = activities.length` in `joinChallenge` | Low (1-line change) |
| 3 — LOW | F3: Completed challenges show "Join" in Trending | Include completed IDs in `joinedChallengeIds` | Low (add getCompletedMembershipIds to query) |
| 4 — LOW | F4: `workoutService` unnormalized for multi-activity | Pass `normalizedBase` from challenge read | Medium |
| 5 — LOW | F5: Re-logging after completion adds points | Guard `if (membership.status === 'completed') throw` | Low |

---

## Validation

No code was changed in this phase. All validation commands remain green from P5R:

```
✅ npm run test:scoring-guards
✅ npm run test:home-challenge-feeds
✅ npm run test:home-performance-guards
✅ npm run test:pilot-ux-polish-guards
✅ npm run test:challenge-creation-backend
✅ npm run test:group-invite-backend
✅ npx tsc -b --pretty false
✅ npm run build
```
