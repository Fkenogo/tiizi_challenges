# Phase 10C-P3A Pilot Fixes

Date: 2026-06-15  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — all three High defects resolved, all validation passes

---

## Summary

This phase fixes the three High-priority defects from the Phase 10C-P2 authenticated smoke test that blocked the closed pilot:

1. Home Goals Cannot Save — Firestore permission denied
2. Public Group Discovery Empty — query not satisfying Firestore read rules
3. Group Detail Lifecycle Filtering — expired challenges surfaced as active

---

## Fix 1: Home Goals Cannot Save

### Root Cause

`src/services/dailyGoalsService.ts` writes `dailyGoals` and `dailyGoalsAnalytics` fields to `users/{uid}` using `setDoc` with `{ merge: true }`. The `userSelfWritableFields()` function in `firestore.rules` did not include these two fields, so the `isSafeUserUpdate` and `isSafeUserCreate` guards rejected the write with `Missing or insufficient permissions`.

### Files Changed

- `firestore.rules` — added `'dailyGoals'` and `'dailyGoalsAnalytics'` to `userSelfWritableFields()`

### Decision

The `dailyGoals` data is personal, user-owned, and low-privilege (goal text and booleans). Adding these fields to the existing self-writable allowlist is the least-privilege approach: the user can only write their own document and cannot escalate any privileged field. No structural change to where data lives is required.

---

## Fix 2: Public Group Discovery Empty

### Root Cause

`groupService.getGroupsPage()` queried `where('status', '==', 'active')` and `where('isPrivate', '==', false)` but not `where('visibility', '==', 'public')`. The Firestore rules function `isPublicGroupData` requires `isPrivate != true AND visibility != 'private' AND status == 'active'`. Because the query did not guarantee `visibility != 'private'`, Firestore's query-level rules evaluation could not validate that all returned documents would be readable, causing the entire query to fail silently (collapsed to an empty state in the UI).

The legacy fallback query (`orderBy('createdAt', 'desc')` with no filters) was also broken for the same reason and has been removed.

### Files Changed

- `src/services/groupService.ts` — added `where('visibility', '==', 'public')` to the main `getGroupsPage` query; removed the legacy fallback query block that bypassed rule constraints
- `firestore.indexes.json` — added composite index on `groups(status ASC, isPrivate ASC, visibility ASC, createdAt DESC)` required by the updated three-field equality query
- `src/features/Groups/GroupsScreen.tsx` — extracted `isError` from `usePublicGroupsPage` and added a distinct error state in the Discover tab (previously errors and empty results showed the same UI)

### Index Added

```json
{
  "collectionGroup": "groups",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "isPrivate", "order": "ASCENDING" },
    { "fieldPath": "visibility", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

This index must be deployed to Firestore before the fix is live. It does not affect any other query.

---

## Fix 3: Group Detail Lifecycle Filtering

### Root Cause

`GroupDetailScreen.tsx` selected the active challenge with:

```ts
const activeChallenge = groupChallenges.find((challenge) => challenge.status === 'active') || groupChallenges[0];
```

This check only inspects `status` and ignores `startDate`/`endDate`. A challenge with `status === 'active'` and a past `endDate` (e.g., `7 day squat + Pushup madness`, ended 2026-06-14) was surfaced as the active challenge even though the detail view computed it as Completed.

The `upcomingChallenge` selection used `challenge.id !== activeChallenge?.id` with no lifecycle check, so it could also surface expired challenges.

### Files Changed

- `src/features/Groups/GroupDetailScreen.tsx` — imported `isChallengeOngoing` from `../../services/challengeLifecycle`; replaced the raw `status === 'active'` comparison with `isChallengeOngoing(challenge)` for active challenge selection; applied `!isChallengeOngoing(challenge)` as the guard for upcoming challenge selection

`isChallengeOngoing` checks `status === 'active'`, `startDate <= now`, and `endDate >= now`, matching the Home challenge feed filter exactly.

---

## Tests Added

### Script: `scripts/testP3aPilotFixes.ts`

Run with: `npm run test:p3a-pilot-fixes`

Asserts:

1. `firestore.rules` contains `'dailyGoals'` and `'dailyGoalsAnalytics'` in `userSelfWritableFields`
2. `groupService.ts` includes `where('visibility', '==', 'public')` in the public group discovery query
3. `firestore.indexes.json` contains a composite index covering `status`, `isPrivate`, `visibility`, and `createdAt` on the `groups` collection
4. `isChallengeOngoing` returns `false` for expired-active, completed, archived, and cancelled challenges
5. `isChallengeOngoing` returns `true` for a genuinely active in-range challenge
6. `GroupDetailScreen.tsx` imports and uses `isChallengeOngoing`
7. `GroupDetailScreen.tsx` no longer contains a raw `challenge.status === 'active'` comparison for challenge selection

---

## Validation Results

```
npm run test:p3a-pilot-fixes       → P3A pilot fix guards passed
npm run test:home-challenge-feeds  → home challenge feed guards passed
npm run test:home-performance-guards → home performance guards passed
npx tsc -b --pretty false          → (no errors)
npm run build                      → ✓ built in 3.55s
```

---

## Files Changed (Complete List)

| File | Change |
|------|--------|
| `firestore.rules` | Added `dailyGoals`, `dailyGoalsAnalytics` to `userSelfWritableFields()` |
| `firestore.indexes.json` | Added composite index for public group discovery |
| `src/services/groupService.ts` | Added `visibility == public` filter, removed legacy fallback query |
| `src/features/Groups/GroupsScreen.tsx` | Exposed `isError` from hook; added error state in Discover tab |
| `src/features/Groups/GroupDetailScreen.tsx` | Imported `isChallengeOngoing`; replaced raw status check |
| `scripts/testP3aPilotFixes.ts` | New test script |
| `package.json` | Registered `test:p3a-pilot-fixes` script |

---

## Deployment Notes

- `firestore.rules` must be deployed before goals saving will work in production.
- `firestore.indexes.json` must be deployed before public group discovery will work in production. Index build time on a live Firestore instance is typically 1–5 minutes; the UI will show an error state (now handled) until the index is ready.
- No Cloud Functions changes. No data migration required.
- Do not deploy until P3A is reviewed and approved.
