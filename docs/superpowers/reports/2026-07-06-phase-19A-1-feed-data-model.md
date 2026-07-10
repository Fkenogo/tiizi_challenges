# Phase 19A-1 — Feed Data Model + Switch to Precomputed Feed

**Date:** 2026-07-06
**Branch:** fix/p0-pre-deploy-blockers

---

## Problems Fixed

| # | Problem | Fix |
|---|---------|-----|
| 1 | `groupActivityFeed` docs missing `challengeType`, preventing card branching | Added `challengeType` read from challenge doc and write to feed doc in Cloud Function |
| 2 | `groupActivityFeed` docs missing `challengeStartDate` / `challengeEndDate` | Added fields from challenge doc; used for "days remaining" in redesigned cards |
| 3 | `groupActivityFeed` docs missing `userPhotoURL` | Denormalized from user doc at write time; used for avatar in redesigned cards |
| 4 | UI read from 6+ raw collections instead of pre-computed `groupActivityFeed` | Switched `useGroupFeed()` to `memberActivitySummaryService.getGroupFeed()` + `toFeedItem()` |
| 5 | Missing Firestore index for `groupActivityFeed (groupId, createdAt DESC)` | Added to `firestore.indexes.json` |
| 6 | Missing Firestore index for `groupActivityFeed (challengeId, createdAt DESC)` | Added to `firestore.indexes.json` (covers `getChallengeActivityLogs` query) |
| 7 | `GroupActivityFeedSummary` type missing new fields | Extended with `challengeType`, `challengeStartDate`, `challengeEndDate`, `userPhotoURL`, `challengeName` |

---

## Files Modified

| File | Change |
|------|--------|
| `functions/src/memberActivitySummaries.ts` | `ChallengeDoc` type extended with `challengeType`, `startDate`, `endDate`; `UserDoc` extended with `photoURL`; `queueActivitySummaryWrites()` adds `challengeType`, `challengeStartDate`, `challengeEndDate`, `userPhotoURL` (optional) to feed doc write; both `summarizeWorkoutCreated` and `summarizeWellnessLogCreated` now pass `user?.photoURL` |
| `src/types/index.ts` | `GroupActivityFeedSummary` extended with `challengeName?`, `challengeType?`, `challengeStartDate?`, `challengeEndDate?`, `userPhotoURL?` |
| `src/hooks/useGroupInsights.ts` | `useGroupFeed()` now uses `memberActivitySummaryService.getGroupFeed()` + `.toFeedItem()` instead of `groupInsightsService.getGroupFeed()`; `memberActivitySummaryService` imported |
| `firestore.indexes.json` | Added two `groupActivityFeed` indexes: `(groupId ASC, createdAt DESC)` and `(challengeId ASC, createdAt DESC)` |
| `scripts/testGroupFeedDataModelGuards.ts` | New — 17 guard assertions |

**Not modified:** `GroupFeedScreen.tsx`, `groupInsightsService.ts`, `memberActivitySummaryService.ts`, `firestore.rules`

---

## Code Diff Summary

### `functions/src/memberActivitySummaries.ts`

```typescript
// ChallengeDoc now includes:
challengeType?: string;
startDate?: string;
endDate?: string;

// UserDoc now includes:
photoURL?: string;

// queueActivitySummaryWrites signature:
function queueActivitySummaryWrites(
  db, batch, input, challenge, displayName,
  userPhotoURL?: string,  // NEW
)

// Feed doc write now includes:
challengeType: challenge?.challengeType ?? null,
challengeStartDate: challenge?.startDate ?? null,
challengeEndDate: challenge?.endDate ?? null,
// userPhotoURL added only when present (not null-written)
if (userPhotoURL) feedDoc.userPhotoURL = userPhotoURL;

// Both summarize* functions now:
const user = await loadUser(db, userId);
const displayName = displayNameFor(userId, user);
queueActivitySummaryWrites(db, batch, input, challenge, displayName, user?.photoURL);
```

### `src/types/index.ts`

```typescript
export interface GroupActivityFeedSummary {
  // ... existing fields ...
  challengeName?: string;       // NEW
  challengeType?: 'collective' | 'competitive' | 'streak';  // NEW
  challengeStartDate?: string;  // NEW
  challengeEndDate?: string;    // NEW
  userPhotoURL?: string;        // NEW
}
```

### `src/hooks/useGroupInsights.ts`

```typescript
// Before:
import { groupInsightsService } from '../services/groupInsightsService';
queryFn: () => (groupId ? groupInsightsService.getGroupFeed(groupId) : Promise.resolve([])),

// After:
import { memberActivitySummaryService } from '../services/memberActivitySummaryService';
queryFn: async () => {
  if (!groupId) return [];
  const items = await memberActivitySummaryService.getGroupFeed(groupId);
  return items.map((item) => memberActivitySummaryService.toFeedItem(item));
},
```

### `firestore.indexes.json` — 2 indexes added

```json
{ "collectionGroup": "groupActivityFeed", "fields": [{ "groupId": "ASCENDING" }, { "createdAt": "DESCENDING" }] }
{ "collectionGroup": "groupActivityFeed", "fields": [{ "challengeId": "ASCENDING" }, { "createdAt": "DESCENDING" }] }
```

---

## Commands Executed

```bash
npx tsx scripts/testGroupFeedDataModelGuards.ts  # ✅ 17 assertions passed
npx tsc --noEmit                                  # ✅ 0 errors
npm run build                                     # ✅ built in 3.29s
```

Indexes deploy (pending authorization):
```bash
firebase deploy --only firestore:indexes
```

---

## Dependencies Added

None.

---

## Config Changes

- `firestore.indexes.json` — 2 new `groupActivityFeed` composite indexes

---

## Indexes Added

| Collection | Fields | Purpose |
|-----------|--------|---------|
| `groupActivityFeed` | `groupId ASC, createdAt DESC` | `getGroupFeed(groupId)` — the primary group feed query |
| `groupActivityFeed` | `challengeId ASC, createdAt DESC` | `getChallengeActivityLogs(challengeId)` — per-challenge log view |

**Already present (confirmed):**
- `wellnessLogs (groupId ASC, loggedAt DESC)` — existed at line 69–76 before this phase

---

## Risks / Limitations

1. **Existing `groupActivityFeed` docs lack new fields** — Documents written before this phase have no `challengeType`, `challengeStartDate`, `challengeEndDate`, or `userPhotoURL`. Old docs will have `null` for these fields (explicitly written as `null` in the feed doc). The `toFeedItem()` transformer ignores these fields (they're not in `GroupFeedItem`), so old items render identically to today. The redesigned card (Phase 19A-2) must handle `null`/`undefined` gracefully.

2. **No backfill of old docs** — Old `groupActivityFeed` documents are not retroactively updated. This is intentional: the Cloud Function only triggers on new writes. If a full backfill is needed later it would require a one-time admin script.

3. **Cloud Function `challengeType` depends on Firestore challenge doc field** — If a challenge was created before `challengeType` was a field (very old data), the field will be `null`. The Cloud Function safe-falls to `?? null`.

4. **`userPhotoURL` not written for users without `photoURL`** — The field is conditionally written only when truthy. Firestore docs for those users will simply not have the field (undefined, not null). Treated consistently with other optional fields.

5. **Indexes not yet deployed** — `firebase deploy --only firestore:indexes` must be run before the pre-computed feed path works in production. Until then, `groupActivityFeed` queries may fail with a Firestore "requires an index" error.

---

## Rollback Instructions

1. Revert `functions/src/memberActivitySummaries.ts` — remove `challengeType`/`startDate`/`endDate` from `ChallengeDoc`; remove `photoURL` from `UserDoc`; remove new fields from `queueActivitySummaryWrites`; restore single `loadUser` pattern.
2. Revert `src/types/index.ts` — remove 5 new fields from `GroupActivityFeedSummary`.
3. Revert `src/hooks/useGroupInsights.ts` — restore `groupInsightsService.getGroupFeed()` call; remove `memberActivitySummaryService` import.
4. Revert `firestore.indexes.json` — remove the 2 `groupActivityFeed` index entries.
5. Delete `scripts/testGroupFeedDataModelGuards.ts`.
6. Run `firebase deploy --only firestore:indexes` to remove the deployed indexes.

---

## Manual QA Checklist

- [ ] Open Group Feed in the app — feed still loads without errors
- [ ] Feed shows same post content as before (author name, activity text, metric, image)
- [ ] No console errors about missing Firestore index (deploy indexes first)
- [ ] Log a new workout in a challenge → feed item appears (Cloud Function triggered)
- [ ] New feed item in Firestore has `challengeType`, `challengeStartDate`, `challengeEndDate` fields
- [ ] New feed item has `userPhotoURL` if the user has a profile photo
- [ ] Old feed items (pre-phase) still render without errors (null fields handled)

---

## Next Recommended Phase

**Phase 19A-2 — Feed Card UI Redesign**

With the data foundation in place:

1. Create a dedicated `FeedCard` component (`src/features/Groups/FeedCard.tsx`)
2. It receives `GroupActivityFeedSummary` directly (not the `GroupFeedItem` shim)
3. Branch on `challengeType`:
   - `'collective'`: show team progress + days left + progress bar
   - `'competitive'`: show user rank + behind/ahead delta + days left
   - `'streak'`: show current streak + daily target + days left
   - `undefined`/`null`: render the current generic card layout (safe fallback)
4. Show `userPhotoURL` in avatar (with placeholder fallback)
5. Wire the `Reply` button to a new `feedReplyService` (or keep as placeholder until Phase 19A-4)
6. Replace inline `.map()` rendering in `GroupFeedScreen` with `<FeedCard item={item} />`

Files to touch: `GroupFeedScreen.tsx`, new `FeedCard.tsx`, `useGroupInsights.ts` (return raw `GroupActivityFeedSummary[]` instead of the `GroupFeedItem` shim)
