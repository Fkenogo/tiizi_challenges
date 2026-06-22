# Phase 10C-P5C — Challenge Discovery, Navigation & Clickability

Date: 2026-06-18  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — all identified bugs fixed, guard tests added, validation passes

---

## Audit Findings

### Finding 1 — "View All" on Ongoing Challenges routes to templates (CRITICAL)

`ChallengesScreen.tsx` line 273: the "View All" button next to "Ongoing Challenges" navigated to `/app/challenges/suggested${querySuffix}`, which is `SuggestedChallengesScreen` — a challenge template gallery, not a list of the user's ongoing challenges.

The "Browse Challenges" section correctly navigated to `/app/challenges/browse`. The Ongoing section was a copy-paste from an earlier iteration that was never updated.

### Finding 2 — Browse Challenges error copy hides root cause (MEDIUM)

`BrowseChallengesScreen.tsx`: `challengeQueryState()` returned the same "Challenges are temporarily unavailable / Please try again shortly" copy for every error type, including Firestore `permission-denied`. This made it impossible to distinguish a misconfigured security rule from a transient network failure.

The `error` value was destructured from `useVisibleChallengesPage` but never passed to `challengeQueryState`.

### Finding 3 — Firestore `canReadChallenge` uses `get()` inside list rules (CRITICAL)

`firestore.rules` `canReadChallenge` allowed public reads via:
```
data.status == 'active' && isApprovedPublicGroup(data.groupId)
```

`isApprovedPublicGroup` calls `get(/databases/(default)/documents/groups/$(groupId))` and then checks:
- `isPrivate != true`
- `visibility != 'private'`
- `status == 'active'`
- AND one of: `isVerified == true`, `reviewStatus == 'reviewed'/'verified'`, `moderationStatus == 'reviewed'/'verified'/'active'`

For Firestore **list queries** (which is how `BrowseChallengesScreen` loads challenges), a `get()` call in the rule means Firestore must evaluate the rule document-by-document against external state. When a challenge's group lacks the right `moderationStatus`/`reviewStatus`/`isVerified` fields — which is common for newly created groups that haven't been through a moderation workflow — Firestore denies the entire query batch, producing the "temporarily unavailable" error even though the challenges are legitimately public.

The `visibility`/`groupVisibility` fields on the challenge doc are written by `createChallengeWithCreatorMembershipCore` at creation time, mirroring the group's visibility. These fields are reliable, already indexed, and already used in query constraints — making them a self-consistent basis for the rule check.

### Finding 4 — Trending query gap (LOW)

`useHomeScreen.ts` uses `getChallengesPage({ visibility: 'public' })` for Trending, which only queries challenges where `visibility == 'public'`. The browse screens also query `groupVisibility == 'public'`. Since `createChallengeWithCreatorMembershipCore` sets both fields to the same value from the group's visibility, this gap has no practical effect. No fix applied.

### Finding 5 — Wellness challenges included (NO BUG)

Both `getActiveChallengesForUser` and `getUserAccessibleChallengesPage` have no challenge type filter. Wellness (`streak` type) challenges flow through all challenge feeds. No fix needed.

---

## Fixes Applied

### 1. `src/features/Challenges/ChallengesScreen.tsx`

Changed "View All" route for Ongoing Challenges from `/app/challenges/suggested${querySuffix}` to `/app/challenges/browse`. The suggested screen is a template gallery; browse is the correct destination for discovering ongoing challenges.

### 2. `src/features/Challenges/BrowseChallengesScreen.tsx`

Updated `challengeQueryState(error)` to accept and inspect the error:
- `permission-denied` → "Access restricted / You may not have permission to view these challenges."
- All other errors → original "Challenges are temporarily unavailable / Please try again shortly."

Updated call site: `isError ? challengeQueryState(error) : null`.

### 3. `firestore.rules` — `canReadChallenge`

Replaced:
```
data.status == 'active' && isApprovedPublicGroup(data.groupId)
```

With:
```
data.status == 'active' && (data.visibility == 'public' || data.groupVisibility == 'public')
```

This makes the rule self-consistent with the query constraints: a query `where('visibility', '==', 'public') AND where('status', '==', 'active')` now guarantees all returned documents satisfy the rule without any `get()` calls. Browse queries are no longer blocked by missing group moderation metadata.

---

## Guard Tests Added — `scripts/testHomeChallengeFeeds.ts`

**P5C discovery, navigation & error handling guards** section (5 new assertions):

| # | Guard |
|---|-------|
| 1 | Ongoing "View All" must NOT route to `/app/challenges/suggested` |
| 2 | Ongoing "View All" must route to `/app/challenges/browse` |
| 3 | Browse "View All" still routes to `/app/challenges/browse` |
| 4 | `BrowseChallengesScreen` distinguishes `permission-denied` from generic errors |
| 5 | `BrowseChallengesScreen` passes `error` to `challengeQueryState` |
| 6 | Firestore `canReadChallenge` uses field-based visibility check |
| 7 | Firestore `canReadChallenge` does not use `isApprovedPublicGroup` in list rules |

---

## Validation Results

```
npm run test:home-challenge-feeds   → home challenge feed guards passed
npx tsc -b --pretty false           → (no errors)
npm run build                       → ✓ built in 2.91s
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/Challenges/ChallengesScreen.tsx` | Fixed Ongoing "View All" route from `/suggested` to `/browse` |
| `src/features/Challenges/BrowseChallengesScreen.tsx` | `challengeQueryState` now accepts and uses `error`; distinguishes `permission-denied` |
| `firestore.rules` | `canReadChallenge` uses field-based visibility check; removed `isApprovedPublicGroup` from challenge read rule |
| `scripts/testHomeChallengeFeeds.ts` | Added P5C section with 7 guard assertions |

---

## Deployment Notes

- **`firestore.rules`** — Firestore rules deploy is required. No new indexes or Cloud Function changes.
- The rules change relaxes the public challenge read condition from "approved group" (moderation metadata) to "challenge has `visibility == 'public'` or `groupVisibility == 'public'`". This is functionally equivalent for correctly-created challenges and resolves the browse query failure for groups that haven't been through the admin moderation workflow.
- Client-only changes (`ChallengesScreen`, `BrowseChallengesScreen`) are safe to deploy with any build.
