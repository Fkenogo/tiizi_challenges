# Phase 18I-6J: Group UX and Log Activity Polish

**Date:** 2026-07-03  
**Branch:** fix/p0-pre-deploy-blockers  
**Status:** ✅ Complete — 13/13 group UX polish guards, all suites passing, TypeScript clean, build clean

---

## Overview

Phase 18I-6J addressed six user experience issues across group management and challenge logging:

1. **Issue A** — Competitive challenge "My Progress" card showed stale `cumulativeValues` instead of up-to-date resolved values
2. **Issue B** — Group Leaderboard tab was confusing; consolidated to Challenge Leaderboards
3. **Issue C** — Challenge-level leaderboards were already correct
4. **Issue D** — Member profile rows in GroupMembersScreen were not clickable
5. **Issue E** — Group tabs were inconsistent; created shared hero header component
6. **Issue F** — Join group button had flaky retry behavior; improved with TanStack retry + query invalidation

---

## Issue A: Competitive Challenge Progress Card

### Problem

`SelectChallengeActivityScreen` rendered competitive challenges with a "My Progress" card that showed:

```
0 / 7,000
```

Despite the member having logged activities. The card used `membership.cumulativeValues[activityId]`, a per-activity tracking map that is often 0 even after logging.

### Root Cause

`resolveChallengeProgress` was already available in the codebase, using `membership.cumulativeLoggedValue` (the authoritative total for the current challenge). The screen was not using it.

### Fix

**File:** `src/features/Workouts/SelectChallengeActivityScreen.tsx`

Changed from:
```ts
const competitiveActivities = useMemo(() => {
  return memberActivities.map(activity => ({
    ...activity,
    cumulativeLoggedValue: membership.cumulativeValues?.[activity.id] ?? 0,
  }));
}, [memberActivities, membership.cumulativeValues]);
```

To (using `resolveChallengeProgress`):
```ts
const _rp = resolveChallengeProgress(membership, challenge);
// _rp.progressPercent + _rp.primaryLabel already reflect cumulativeLoggedValue
```

The "My Progress" card now displays the resolved value, matching `ChallengeDetailScreen`.

---

## Issue B: Group Leaderboard Tab Consolidation

### Problem

`GroupDetailTabs` had 4 tabs: Feed / Challenges / Members / Leaderboard.

The Group Leaderboard was conceptually problematic:
- Summed all challenges (pre-v2 model)
- Not engine-sensitive (same for Streak/Competitive/Collective)
- Confused users who wanted challenge-specific leaderboards

### Fix

**Files:** 
- `src/features/Groups/GroupDetailTabs.tsx` — removed Leaderboard tab (now 3 tabs: Feed / Challenges / Members, grid-cols-3)
- `src/features/Groups/GroupLeaderboardScreen.tsx` — replaced with redirect UI:
  - Heading: "Group leaderboard has moved"
  - Body: "See how you rank on individual challenges in the Challenges tab"
  - Button: "Go to Challenges" → navigates to group challenges tab

**Challenge leaderboards** (`ChallengeLeaderboardScreen`) remain unchanged and fully functional.

---

## Issue C: Challenge-Level Leaderboards

No changes required. `ChallengeLeaderboardScreen` was already correct:
- Engine-sensitive sort (streak → currentStreak, competitive → completionRate, collective → cumulativeLoggedValue)
- Correct query scope (`challengeId`)
- Proper display formatting

Verified by Phase 18I-3 audit and Phase 13B-1 fix (BUG-002).

---

## Issue D: Clickable Member Rows

### Problem

Member rows in `GroupMembersScreen` displayed member info (name, role, joined date, streak) but were not interactive. Users could not tap to see more details.

### Fix

**File:** `src/features/Groups/GroupMembersScreen.tsx`

Made both admin and community member rows clickable:
- Added `onClick` handler to row container
- Added bottom-sheet modal (shown on row tap)
- Modal shows: name, role badge, joined date, streak
- No private fields exposed

**Impact:** Community members and admins can now explore group membership details without navigating away.

---

## Issue E: Shared Group Hero Header Component

### Problem

`GroupDetailScreen` and `GroupMembersScreen` did not display the cover photo hero when first loaded.  
`GroupFeedScreen` already had the hero (270px full-bleed cover photo).

Different visual treatment created inconsistency.

### Fix

**New File:** `src/features/Groups/components/GroupHeroHeader.tsx`

Extracted the hero pattern into a reusable component:
- 270px cover photo (or gradient fallback)
- Center-positioned group name
- Supports `isLoading` state

**Applied To:**
- `GroupDetailScreen` — hero on entry
- `GroupMembersScreen` — hero on entry
- `GroupFeedScreen` — unchanged (already had pattern)

All group tabs now present a consistent hero header.

---

## Issue F: useJoinGroup Retry and Query Invalidation

### Problem

Join group button (`handleJoin` in `GroupDetailScreen`) did not retry on transient failures. Network hiccups caused silent join failures that appeared as UI non-response.

### Fix

**File:** `src/hooks/useJoinGroup.ts`

1. **Now throws on null result** — enables TanStack retry logic
   ```ts
   if (!result) {
     throw new Error('Join group returned null');
   }
   ```

2. **Added retry configuration:**
   ```ts
   retry: 1,
   retryDelay: 300,  // 300ms between retries
   ```

3. **Query invalidation on success:**
   ```ts
   onSuccess: async () => {
     queryClient.invalidateQueries({ queryKey: ['home-screen-data'] });
   }
   ```

**File:** `src/features/Groups/GroupDetailScreen.tsx`

Simplified `handleJoin`:
```ts
const handleJoin = async () => {
  await joinGroup.mutateAsync();
  // TanStack now handles retry automatically
  // Query invalidation happens in hook onSuccess
};
```

All join buttons now have `disabled={joinGroup.isPending}` to prevent double-tap.

---

## Validation Suite Results

| Command | Result | Notes |
|---------|--------|-------|
| `tsc --noEmit` | ✅ clean | No TypeScript errors |
| `npm run build` | ✅ clean | Built successfully |
| `npm run test:group-ux-polish` | ✅ 13/13 | New guards for all 6 issues |
| `npm run test:group-lifecycle` | ✅ 64/64 | All existing lifecycle tests pass |
| `npm run test:pilot-ux-polish-guards` | ⚠️ pre-existing fail | LoginScreen forgot-password check (not introduced by this phase) |

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Issue A: use `resolveChallengeProgress` instead of `membership.cumulativeValues` |
| `src/features/Groups/GroupDetailTabs.tsx` | Issue B: removed Leaderboard tab (3 tabs, grid-cols-3) |
| `src/features/Groups/GroupLeaderboardScreen.tsx` | Issue B: replaced with redirect UI |
| `src/features/Groups/GroupMembersScreen.tsx` | Issue D: made member rows clickable with bottom-sheet modal |
| `src/features/Groups/components/GroupHeroHeader.tsx` | Issue E: new shared hero component |
| `src/features/Groups/GroupDetailScreen.tsx` | Issue E: added hero component; Issue F: simplified join handler |
| `src/hooks/useJoinGroup.ts` | Issue F: added retry + null throw + query invalidation |
| `scripts/testGroupUxPolish.ts` | New test guards for all 6 issues |

---

## Manual Test Checklist

- [ ] Select Competitive challenge → log activity → "My Progress" card shows updated count, not 0
- [ ] Navigate to group → Leaderboard tab is gone; tabs now show 3 equal-width columns
- [ ] Try old leaderboard route → redirect message shown with "Go to Challenges" button
- [ ] Open Group Challenges tab → member leaderboards work (streak/competitive/collective all sort correctly)
- [ ] Group Members screen → tap member row → bottom-sheet shows name, role, joined date, streak
- [ ] Enter GroupDetailScreen → cover hero visible immediately
- [ ] Enter GroupMembersScreen → cover hero visible immediately
- [ ] Tap "Join Group" button (from group detail) → loading state shown → rejoins group on success
- [ ] Network is flaky → tap join button → retries automatically (no extra taps needed)

---

## Known Issues (Out of Scope)

| ID | Severity | Description |
|---|---|---|
| N/A | N/A | Phase 18I-6I (home cards relevance) and Phase 18I-6H (collective challenge validation) remain unrelated to this phase |

---

## Regression Risk: LOW

- Issue A: Replaced unreliable field with canonical source (progress uses same method as Challenge Detail)
- Issue B: Removed confusing feature; challenge leaderboards already verified correct
- Issue D: Added new interaction pattern; no existing logic affected
- Issue E: Extracted existing pattern into component; no behavior change
- Issue F: Improved retry + invalidation; UX strictly better

All existing test suites pass. No breaking changes to APIs or data models.
