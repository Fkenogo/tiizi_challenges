# Phase 10B-P3 - Home Screen Performance Cleanup

Date: 2026-06-14

## Status

PASS. Home now relies primarily on server-generated `memberHome/{uid}` and `userMetrics/{uid}` summary documents.

No deploy was run.

## Root Cause

Home still had live fallback logic from before Phase 7 summaries existed. The screen and hook could load dashboard state by querying raw or semi-raw collections whenever summary data was missing or empty.

## Old Home Read Pattern

Initial Home load could trigger:

| Source | Query shape | Why it existed | Replacement |
|---|---:|---|---|
| `users/{uid}` profile setup | document read | display name, onboarding goal | auth profile for display; no Home fallback profile read |
| `users/{uid}` identity | document read | display name/photo fallback | auth profile/Firebase user |
| `groupMembers` | `where(userId == uid)` | joined group count and accessible group IDs | `memberHome.joinedGroupCount` / `userMetrics.joinedGroupsCount` |
| `groups` | document batches by membership | group count/list support through `getMyGroups()` | removed from Home |
| `challengeMembers` | `where(userId == uid)` | active membership index/progress | `memberHome.primaryActiveChallenge`, `userMetrics.activeChallengesCount` |
| `challenges` | visible/access queries, up to 60 | active challenge and trending fallback | active challenge from `memberHome`; trending uses one bounded public page |
| `challenges` missing ID lookup | `documentId in (...)` | repair missing membership challenge docs | removed from Home |
| `challengeActivitySummaries` | challenge summary doc | collective active challenge progress fallback | progress label from `memberHome.primaryActiveChallenge` |

## New Home Read Pattern

Home dashboard now reads:

- `memberHome/{uid}`: primary active challenge, active/completed challenge counts, joined group count, recent activity count.
- `userMetrics/{uid}`: streak, activity counts, joined/active/completed counts, last activity.
- `challenges` bounded public page: `status == active`, `visibility == public`, `orderBy(startDate desc)`, `limit(5)` for the trending carousel.
- `users/{uid}` daily goals document remains through `useDailyGoals`; this is a per-user document read, not a collection scan.

Missing summary docs now show:

`Syncing your dashboard...`

The screen does not silently scan raw collections to fill the gap.

## Files Changed

- `src/features/Home/useHomeScreen.ts`
- `src/features/Home/HomeScreen.tsx`
- `src/services/challengeService.ts`
- `scripts/testHomePerformanceGuards.ts`
- `package.json`

## UI Behavior Preserved

- Active challenge card: from `memberHome.primaryActiveChallenge`.
- Joined group summary: from `memberHome.joinedGroupCount` or `userMetrics.joinedGroupsCount`.
- Streak/progress summary: added compact summary cards for streak, active challenges, recent activity.
- Recent activity summary: from `memberHome.recentActivityCount` or `userMetrics.totalActivitiesLogged`.
- Trending challenges: still shown, now from a bounded public challenge page.
- Quick actions/navigation: unchanged.
- Daily goals: unchanged, still per-user document backed.

## Read Reduction

Expected first-load reduction for established users:

- Before: multiple reads across profile, group memberships, groups, challenge memberships, visible challenges, missing challenge lookups, and activity summary fallback. Depending on membership count this could be 6+ query/doc operations and dozens of documents.
- After: 2 member summary document reads + 1 bounded `limit(5)` challenge query + 1 per-user daily goals document read.

Expected impact:

- Lower cold Home latency.
- Fewer permission-sensitive reads.
- Fewer re-renders and refetch loops.
- Predictable Firestore cost as user history grows.

## Remaining Fallback Reads

Remaining Home reads are intentionally bounded:

- `dailyGoalsService.getTodayGoals(uid)`: one user-owned document.
- `challengeService.getChallengesPage({ pageSize: 5, statuses: ['active'], visibility: 'public' })`: one indexed bounded public query.

No Home collection scan or membership-index fallback remains.

## Test / Guard Added

`npm run test:home-performance-guards`

This sentinel fails if `src/features/Home/useHomeScreen.ts` reintroduces:

- direct Firestore imports
- `getDocs()` / `collection()` calls
- `groupService`
- `userProfileService`
- `memberActivitySummaryService`

## Validation Output

`npm run test:home-performance-guards`

```text
home performance guards passed
```

`npm run test:challenge-creation-backend`

```text
challenge creation backend tests passed
```

`npm run test:group-invite-backend`

```text
Group invite backend security tests passed
```

`npx tsc -b --pretty false`

```text
passed with no output
```

`npm run build`

```text
✓ 1844 modules transformed.
✓ built in 4.00s
```

Existing bundle warning remains:

```text
Some chunks are larger than 500 kB after minification.
```

## Deployment Notes

Hosting deploy is required for the Home UI/hook changes.

No Firestore rules, indexes, or Functions changes are required for this phase.
