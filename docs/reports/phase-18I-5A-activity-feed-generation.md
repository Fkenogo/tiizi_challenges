# Phase 18I-5A — Activity Feed Generation After Challenge Logging

**Date:** 2026-06-30
**Branch:** fix/p0-pre-deploy-blockers
**Bugs fixed:** Group feed empty after logging challenge activity

---

## 1. Root Cause

Two bugs, together making the group feed completely empty after any challenge log:

### Root Cause #1 — Missing Firestore composite index (Critical)

`getGroupFeed` in `groupInsightsService.ts` queries `wellnessLogs` with:

```ts
getDocs(query(
  collection(db, 'wellnessLogs'),
  where('groupId', '==', groupId),
  orderBy('loggedAt', 'desc'),
  limit(10),
))
```

This requires a composite index on `wellnessLogs: [groupId ASC, loggedAt DESC]`.

**`firestore.indexes.json` had no such index.** Firestore threw a "requires an index" error on every feed load. Because `getGroupFeed` runs both queries in `Promise.all`, the missing index caused the entire `Promise.all` to reject. React Query caught the error and returned empty data — making the group feed appear blank even when workouts existed.

The workouts query was fine — `workouts [groupId ASC, completedAt DESC]` index existed. But since both queries share a single `Promise.all`, one failure made both results unreachable.

### Root Cause #2 — `loggedAt` stored as Firestore Timestamp, not ISO string (Secondary)

`wellnessLogService.writeLog` stored:
```ts
const now = Timestamp.now();
const logPayload = {
  loggedAt: now,   // ← Firestore Timestamp object
  ...
};
```

But `WellnessLog.loggedAt` is typed as `string`, and `getGroupFeed` formatted it as:
```ts
ts: Date.parse(wl.loggedAt) || 0,
time: formatRelativeTime(wl.loggedAt),
```

`Date.parse(TimestampObject)` → NaN → `ts = 0` for all wellness items. The feed would sort them to the end (after workouts) and show "Recently" for all timestamps. Once the index is fixed, this would produce a visible display bug: all wellness feed items always show "Recently" regardless of when they were logged.

---

## 2. Firestore Fields Expected by Group Feed

### `workouts` collection

| Field | Type | Required by getGroupFeed |
|-------|------|--------------------------|
| `groupId` | string | ✅ Yes — query filter |
| `completedAt` | ISO string | ✅ Yes — sort timestamp + display |
| `userId` | string | ✅ Yes — name lookup |
| `challengeId` | string | ✅ Yes — challenge title |
| `exerciseId` | string | ✅ Yes — exercise name lookup |
| `value` | number | ✅ Yes — metric display |
| `unit` | string | ✅ Yes — metric display |

### `wellnessLogs` collection

| Field | Type | Required by getGroupFeed |
|-------|------|--------------------------|
| `groupId` | string | ✅ Yes — query filter |
| `loggedAt` | **ISO string** | ✅ Yes — sort timestamp + display |
| `userId` | string | ✅ Yes — name lookup |
| `challengeId` | string | ✅ Yes — challenge title |
| `activityId` | string | ✅ Yes — logged |
| `logType` | 'fasting' \| 'hydration' \| 'sleep' \| 'meditation' | ✅ Yes — metric label |
| `value` | number | ✅ Yes — metric display |
| `unit` | string | ✅ Yes — metric display |

---

## 3. Files Changed

| File | Change |
|------|--------|
| `firestore.indexes.json` | Added composite index: `wellnessLogs [groupId ASC, loggedAt DESC]` |
| `src/services/wellnessLogService.ts` | Changed `loggedAt: now` (Timestamp) → `loggedAt: now.toDate().toISOString()` (ISO string) |
| `src/services/groupInsightsService.ts` | Added Timestamp→ISO backward-compat conversion when reading `wl.loggedAt` |
| `scripts/testScoringGuards.ts` | Added guards 18I-5A-1 through 18I-5A-11 |

---

## 4. Exact Fix

### Fix 1: `firestore.indexes.json` — add missing index

```json
{
  "collectionGroup": "wellnessLogs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "groupId", "order": "ASCENDING" },
    { "fieldPath": "loggedAt", "order": "DESCENDING" }
  ]
}
```

**Why:** Firestore requires explicit composite indexes for any query combining `where` + `orderBy` on different fields. Without this, every `getGroupFeed` call throws, and the feed is perpetually empty.

### Fix 2: `src/services/wellnessLogService.ts` — ISO string for `loggedAt`

```ts
// Before:
const now = Timestamp.now();
loggedAt: now,   // Firestore Timestamp

// After:
const now = Timestamp.now();
loggedAt: now.toDate().toISOString(),   // ISO string — consistent with WellnessLog type
```

**Why:** `WellnessLog.loggedAt` is typed as `string`. `Date.parse(Timestamp)` → NaN → all wellness items showed "Recently" and sorted to ts=0.

### Fix 3: `src/services/groupInsightsService.ts` — Timestamp→ISO conversion when reading

```ts
// Before:
const wellnessLogs = wellnessSnap.docs.map((d) => ({
  id: d.id, ...(d.data() as Omit<WellnessLog, 'id'>)
}));

// After:
const wellnessLogs = wellnessSnap.docs.map((d) => {
  const data = d.data() as Omit<WellnessLog, 'id'>;
  const rawLoggedAt = data.loggedAt as unknown;
  const loggedAt =
    typeof rawLoggedAt === 'string'
      ? rawLoggedAt
      : rawLoggedAt != null && typeof (rawLoggedAt as { toDate?: unknown }).toDate === 'function'
        ? (rawLoggedAt as { toDate: () => Date }).toDate().toISOString()
        : '';
  return { id: d.id, ...data, loggedAt };
});
```

**Why:** Any existing `wellnessLogs` docs written before this fix stored `loggedAt` as a Firestore Timestamp. This conversion handles those docs so the feed display is correct for all data — old and new.

---

## 5. What Was Not Changed

- Scoring formulas — untouched ✅
- Firestore write paths (workouts, challengeMembers) — untouched ✅
- `group-feed` query invalidation in `useWorkouts.ts` — already correct from Phase 18I-4G ✅
- `getGroupFeed` merge + deduplication + sort logic — untouched ✅
- Workout `completedAt` field — already ISO string, no change needed ✅
- `wellnessLogService` membership update — untouched ✅

---

## 6. Regression Guards

| ID | What it guards |
|----|----------------|
| 18I-5A-1 | `firestore.indexes.json` contains `wellnessLogs` index with `groupId` and `loggedAt` fields |
| 18I-5A-2 | `wellnessLogService` stores `loggedAt: now.toDate().toISOString()` (ISO string) |
| 18I-5A-3 | `wellnessLogService` logPayload does NOT assign `loggedAt: now,` (raw Timestamp) |
| 18I-5A-4 | `getGroupFeed` queries `wellnessLogs` with `where('groupId', '==', groupId)` |
| 18I-5A-5 | `getGroupFeed` wellnessLogs query uses `orderBy('loggedAt', ...)` |
| 18I-5A-6 | `getGroupFeed` queries `workouts` with `where('groupId', '==', groupId)` |
| 18I-5A-7 | `getGroupFeed` applies Timestamp→ISO conversion when reading wellness `loggedAt` |
| 18I-5A-8 | `getGroupFeed` deduplicates by composite `id` via `seen` Set |
| 18I-5A-9 | `getGroupFeed` sorts newest first with `b.ts - a.ts` |
| 18I-5A-10 | `getGroupFeed` caps merged output to 10 items via `.slice(0, 10)` |
| 18I-5A-11 | `firestore.indexes.json` contains `workouts [groupId, completedAt]` index |

---

## 7. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 3.47s
npm run test:scoring-guards               → ✅ All guards passed (incl. 18I-5A-1…11)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```

---

## 8. Deploy Note — Index Deployment Required

The new Firestore index must be deployed before the feed fix is live in production:

```bash
firebase deploy --only firestore:indexes
```

Without deploying the index, the `wellnessLogs [groupId, loggedAt]` query will continue to fail in production even after the code is deployed. Deploy the index first (or simultaneously with the code).

---

## 9. Manual Retest Steps

### Setup
1. Create or open an active group challenge
2. Ensure at least one user (user A) is a group member

### Test 1 — Single user feed
1. As user A, navigate to the challenge → Log an activity (workout or wellness)
2. On the WorkoutLoggedScreen, tap "Go to Feed"
3. **Expected:** Group feed shows the just-logged activity as the newest item, with correct timestamp (e.g., "Just now" or "1m ago")
4. **Before fix:** Feed would appear empty or show "Challenge created" placeholder

### Test 2 — Wellness-specific timestamp
1. As user A, log a wellness activity (e.g., hydration steps)
2. Navigate to the group feed
3. **Expected:** Wellness entry shows correct relative time (not "Recently" for all items)
4. **Before fix (secondary bug):** Wellness items always showed "Recently"

### Test 3 — Multi-user feed ordering
1. As user B, join the same group challenge
2. User A logs an activity
3. User B logs an activity shortly after
4. Navigate to group feed
5. **Expected:** User B's activity appears above user A's (newest first)

### Test 4 — Mixed workout + wellness
1. User A logs a workout (fitness)
2. User A logs a wellness activity (e.g., meditation)
3. Navigate to group feed
4. **Expected:** Both entries appear, sorted newest first, no duplicates

### Test 5 — Feed cap
1. Log 12+ activities across users
2. Navigate to group feed
3. **Expected:** At most 10 items shown
