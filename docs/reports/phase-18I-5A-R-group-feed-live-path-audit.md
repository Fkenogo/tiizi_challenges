# Phase 18I-5A-R — Group Feed Live Path Audit

**Date:** 2026-06-30
**Branch:** fix/p0-pre-deploy-blockers
**Symptom:** Group feed shows "No updates yet" after successfully logging a workout — even though scoring, home card, challenge detail, and leaderboard all update correctly.

---

## 1. Root Cause

**File:** `firestore.rules` — `wellnessLogs` match block
**Type:** Firestore security rule blocking group-scoped collection query

### The broken rule

```
match /wellnessLogs/{logId} {
  allow read: if isAuthenticated()
              && (
                resource.data.userId == request.auth.uid
                || canAccessAdmin()
              );
```

`getGroupFeed` in `groupInsightsService.ts` queries wellnessLogs like this:

```ts
getDocs(query(
  collection(db, 'wellnessLogs'),
  where('groupId', '==', groupId),
  orderBy('loggedAt', 'desc'),
  limit(10),
))
```

**Firestore evaluates `allow read` for collection queries** by checking whether the rule's condition can be guaranteed for all returned documents given the query constraints. The query filters on `groupId`, not `userId`. So Firestore knows some returned documents may have `resource.data.userId != request.auth.uid` — and it denies the entire query with `PERMISSION_DENIED`.

### The cascade

```
getGroupFeed() {
  const [workoutsSnap, wellnessSnap, ...] = await Promise.all([
    getDocs(workoutsQuery),     // ← would succeed (workouts: allow read if isAuthenticated())
    getDocs(wellnessLogsQuery), // ← THROWS PERMISSION_DENIED
    ...
  ]);
}
```

`Promise.all` rejects on the first rejection. The wellness query fails → the entire `getGroupFeed` throws → React Query catches it → `data` stays at its default `[]` → `feedItems.length === 0` → "No updates yet" renders.

**Workout docs ARE written correctly** (with `groupId`, `completedAt`, etc.) — they're just unreachable because the wellnessLogs query failure kills the whole feed read.

### Why Phase 18I-5A was incomplete

Phase 18I-5A correctly identified and fixed:
- ✅ Missing `wellnessLogs [groupId, loggedAt]` composite index
- ✅ `loggedAt` stored as Firestore Timestamp instead of ISO string
- ✅ Backward-compat Timestamp→ISO conversion when reading

Phase 18I-5A did NOT fix:
- ❌ The Firestore security rule for `wellnessLogs` that blocks cross-user reads in a group context
- ❌ The fragility of `Promise.all` — any single query failure kills the entire feed

The index fix was necessary but not sufficient. Even with the correct index, the query is rejected by the security rule before Firestore even uses the index.

---

## 2. Write Path Audit — Fitness Workout

**Path:** `LogWorkoutScreen` → `useLogWorkout` → `workoutService.createWorkout` → Firestore

### `groupId` propagation

| Step | How `groupId` flows |
|------|---------------------|
| URL params | `params.get('groupId') ?? undefined` in `LogWorkoutScreen` |
| `logWorkout.mutateAsync({ groupId })` | Passed from screen to mutation |
| `workoutService.createWorkout(input)` | `payload.groupId = input.groupId` |
| Firestore write | `batch.set(workoutRef, removeUndefinedDeep(payload))` → `groupId` in doc |

**`groupId` is written to the workout document when it's present in the URL.** It is `undefined` (omitted) only if the user navigated to the challenge directly without `?groupId=...` in the URL. The app always passes `groupId` when navigating from a group context.

### Sample workout document payload

```json
{
  "userId": "abc123",
  "challengeId": "ch_xyz",
  "exerciseId": "pushups",
  "value": 100,
  "unit": "reps",
  "groupId": "grp_abc",
  "completedAt": "2026-06-30T14:23:11.000Z",
  "date": "2026-06-30",
  "loggedAt": "<Timestamp>",
  "verified": false,
  "points": 50,
  "scoringVersion": "v2"
}
```

All required feed fields (`groupId`, `challengeId`, `userId`, `completedAt`, `exerciseId`, `value`, `unit`) are present.

---

## 3. Read Path Audit — Group Feed

**Path:** `GroupFeedScreen` → `useGroupFeed(id)` → `groupInsightsService.getGroupFeed(groupId)`

`GroupFeedScreen` gets `id` from `useParams<{ id: string }>()` (the group route param at `/app/group/:id/feed`). This matches the `groupId` written to the workout document when the user navigated from the same group context.

`useGroupFeed` query key: `['group-feed', groupId, user?.uid]`

`useLogWorkout` invalidation: `queryClient.invalidateQueries({ queryKey: ['group-feed'] })` — partial key match, correctly invalidates all `group-feed` queries.

---

## 4. Files Changed

| File | Change |
|------|--------|
| `firestore.rules` | Added `\|\| isGroupMember(resource.data.groupId)` to `wellnessLogs` read rule |
| `src/services/groupInsightsService.ts` | wellnessLogs query wrapped in `.catch()` — failure logs error and returns `null`; downstream uses `wellnessResult?.docs ?? []` |
| `scripts/testScoringGuards.ts` | Added guards 18I-5A-R-1 through 18I-5A-R-9 |
| `scripts/auditGroupFeedAfterLog.ts` | New diagnostic script (Admin SDK, bypasses rules) |

---

## 5. Exact Fixes

### Fix 1: `firestore.rules` — wellnessLogs group-scoped read

```diff
  match /wellnessLogs/{logId} {
    ...
    allow read: if isAuthenticated()
                && (
                  resource.data.userId == request.auth.uid
+                 || isGroupMember(resource.data.groupId)
                  || canAccessAdmin()
                );
```

**Why this works:** The `getGroupFeed` query constrains `where('groupId', '==', groupId)`. Firestore sees that `resource.data.groupId == groupId` is guaranteed for all returned docs. If the current user `isGroupMember(groupId)`, all returned docs satisfy `isGroupMember(resource.data.groupId)` — so Firestore allows the query.

### Fix 2: `groupInsightsService.getGroupFeed` — resilience

```ts
// Before: one failed query kills all feed items
const [workoutsSnap, wellnessSnap, memberships, challengeMap] = await Promise.all([...]);

// After: wellness failure is isolated — workout items still appear
const [workoutsSnap, wellnessResult, memberships, challengeMap] = await Promise.all([
  getDocs(workoutsQuery),
  getDocs(wellnessLogsQuery).catch((err) => {
    console.error('[getGroupFeed] wellnessLogs query failed — check security rules and index deployment:', err);
    return null;
  }),
  ...
]);
const wellnessLogs = (wellnessResult?.docs ?? []).map(...);
```

---

## 6. Regression Guards (18I-5A-R-1 … 18I-5A-R-9)

| ID | What it guards |
|----|----------------|
| 18I-5A-R-1 | `workoutService` payload includes `groupId: input.groupId` |
| 18I-5A-R-2 | `getGroupFeed` queries `workouts` with `where('groupId', '==', groupId)` |
| 18I-5A-R-3 | `getGroupFeed` maps workouts into `workoutItems` feed entries |
| 18I-5A-R-4 | `getGroupFeed` wellnessLogs query has `.catch()` fallback |
| 18I-5A-R-5 | `getGroupFeed` handles null wellnessResult with safe access |
| 18I-5A-R-6 | `useLogWorkout` invalidates `['group-feed']` on success |
| 18I-5A-R-7 | `useLogWellnessActivity` invalidates `['group-feed']` on success |
| 18I-5A-R-8 | `firestore.rules` wellnessLogs allows `isGroupMember(resource.data.groupId)` reads |
| 18I-5A-R-9 | `getGroupFeed` maps wellnessLogs into `wellnessItems` feed entries |

---

## 7. Validation

```
npx tsc --noEmit                    → ✅ No errors
npm run build                       → ✅ Built in 3.66s
npm run test:scoring-guards         → ✅ All guards passed (incl. 18I-5A-R-1…9)
npm run test:home-challenge-feeds   → ✅ All guards passed
```

---

## 8. Diagnostic Script

```bash
# Requires service account (bypasses security rules — for diagnosis only)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
  npx tsx scripts/auditGroupFeedAfterLog.ts <groupId>
```

The script:
1. Queries `workouts where groupId == groupId` (newest 10) via Admin SDK
2. Queries `wellnessLogs where groupId == groupId` (newest 10) via Admin SDK
3. Reports all required field presence, `loggedAt` type (Timestamp vs ISO), and missing fields
4. Simulates `getGroupFeed` transformation and prints what the feed would render
5. Prints diagnosis summary including root cause and required deploys

---

## 9. Required Deploys

Both must be deployed before the fix is live in production:

```bash
# Security rules — critical, unblocks the group feed read
firebase deploy --only firestore:rules

# Indexes — required for wellnessLogs group feed query (from Phase 18I-5A)
firebase deploy --only firestore:indexes
```

**Order matters:** Deploy rules first. Even after the code fix (`.catch()` resilience), a `PERMISSION_DENIED` error on the wellnessLogs query will be logged to console but won't block workout feed items. Deploying the rules removes the error entirely and enables wellness items in the feed too.

---

## 10. Manual Retest Steps

1. Ensure rules and indexes are deployed to the Firebase project
2. Open a group that has an active challenge
3. Confirm you are a joined member of the group
4. Navigate to the challenge from the group context (URL must include `?groupId=...`)
5. Log a fitness workout
6. On `WorkoutLoggedScreen`, tap **Go to Feed →**
7. **Expected:** Group feed shows the just-logged workout as the newest item with correct name, value, unit, and timestamp (e.g., "Just now")
8. **Before fix:** "No updates yet" even with a valid workout just logged

### Two-member test
1. Member A logs a workout
2. Member B logs a workout
3. Member A opens the group feed
4. **Expected:** Both items appear, Member B's item first (newest first sort)
