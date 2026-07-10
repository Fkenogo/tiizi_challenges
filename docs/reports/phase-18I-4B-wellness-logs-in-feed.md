# Phase 18I-4B — Add wellnessLogs to Group Feed

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Fixes:** BUG-3-4 from Phase 18I-3 audit

---

## 1. Problem

`groupInsightsService.getGroupFeed()` queried only the `workouts` Firestore collection. Wellness activities (steps, hydration, sleep, meditation, fasting) are written to the separate `wellnessLogs` collection and were therefore completely invisible in the group feed. After logging a wellness activity, the feed showed either stale workout items from other users or the challenge-creation fallback.

---

## 2. Fix

### `src/services/groupInsightsService.ts`

**Import:** Added `WellnessLog` to the type import from `'../types'`.

**`getGroupFeed()`:** Replaced the single `workouts` query with parallel reads of both collections, then merged, deduplicated, sorted, and limited the result.

**New fetch pattern:**
```ts
const [workoutsSnap, wellnessSnap, memberships, challengeMap] = await Promise.all([
  getDocs(query(collection(db, 'workouts'), where('groupId', '==', groupId), orderBy('completedAt', 'desc'), limit(10))),
  getDocs(query(collection(db, 'wellnessLogs'), where('groupId', '==', groupId), orderBy('loggedAt', 'desc'), limit(10))),
  loadGroupMemberships(groupId),
  loadChallengesByGroup(groupId),
]);
```

**Merge logic:**
1. Map each workout to a `RawItem` (composite key `workout:<id>`, timestamp from `completedAt`)
2. Map each wellness log to a `RawItem` (composite key `wellness:<id>`, timestamp from `loggedAt`)
3. Deduplicate by composite key using a `Set<string>`
4. Sort by `ts` descending (newest first)
5. Slice to 10
6. Map to `GroupFeedItem`

**Wellness item shape:**
```ts
{
  id: wl.id,
  author: shortUserLabel(wl.userId, userMap.get(wl.userId)),
  text: `Logged ${wl.value} ${wl.unit} in ${challengeMap.get(wl.challengeId)?.name || 'group challenge'}.`,
  time: formatRelativeTime(wl.loggedAt),
  imageUrl: challengeMap.get(wl.challengeId)?.coverImageUrl,
  metric: {
    label: logTypeLabel[wl.logType] ?? 'Wellness',  // 'Fasting' | 'Hydration' | 'Sleep' | 'Meditation'
    value: `${wl.value} ${wl.unit}`,
  },
}
```

**Challenge-created fallback:** Still present, but now triggers only when BOTH `workouts` and `wellnessLogs` are empty for the group.

---

## 3. What Was Not Changed

- `GroupFeedItem` interface — untouched ✅
- `GroupFeedScreen.tsx` — untouched ✅ (renders `feedItems` map unchanged)
- `useGroupFeed` hook — untouched ✅
- All other `GroupInsightsService` methods — untouched ✅
- Scoring engines, leaderboard, logging services — untouched ✅

---

## 4. Pre-existing Guard Compatibility

A pre-existing guard (12F-B) requires `limit(10)` to appear in `getGroupFeed`. Both sub-queries use `limit(10)`, satisfying the guard. The final merged output is also capped at `.slice(0, 10)`.

---

## 5. Files Changed

| File | Change |
|------|--------|
| `src/services/groupInsightsService.ts` | `WellnessLog` import; `getGroupFeed` reads both `workouts` + `wellnessLogs`, merges, deduplicates, sorts, limits to 10 |
| `scripts/testScoringGuards.ts` | Added guards 18I-4B-1 through 18I-4B-10 |

---

## 6. Regression Guards

| ID | What it guards |
|----|---------------|
| 18I-4B-1 | `getGroupFeed` queries `wellnessLogs` collection |
| 18I-4B-2 | `getGroupFeed` still queries `workouts` collection |
| 18I-4B-3 | `wellnessLogs` query is scoped to `groupId` |
| 18I-4B-4 | Merged results are sorted by `b.ts - a.ts` (descending) |
| 18I-4B-5 | Final result is sliced to 10 |
| 18I-4B-6 | Deduplication (`seen` Set) is applied before sorting |
| 18I-4B-7 | `GroupFeedItem` shape (`author`, `text`, `time`) still used |
| 18I-4B-8 | Challenge-created fallback still present |
| 18I-4B-9 | `loggedAt` used as timestamp field for wellness logs |
| 18I-4B-10 | Wellness items derive a label from `logType` |

---

## 7. Manual Retest Required

Yes — log a wellness activity in a group challenge, then navigate to the group feed. The logged activity should now appear as a feed item with the wellness metric label (e.g. "Steps · 2,500 steps").

---

## 8. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 7.39s
npm run test:scoring-guards               → ✅ All guards passed (incl. 18I-4B-1…10)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```
