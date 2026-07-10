# Phase 19A-10L — Group Card Active Challenge Count + WorkoutLoggedScreen Completion CTA

**Date:** 2026-07-08
**Branch:** fix/p0-pre-deploy-blockers
**Status:** ✅ Complete

---

## Issue 1 — Group Cards Show Total Historical Challenges

### Symptom
Group listing cards displayed all non-completed challenges — including **draft challenges created
by the current user** — as the "Challenges" badge count. Example: "Golden 50's — 13 Challenges"
when only 2 were active.

### Root Cause
`GroupsScreen.normalizedGroups` filtered challenges with:
```typescript
if (!challenge.groupId || challenge.status === 'completed') return;
```
`useChallenges()` → `getUserAccessibleChallenges()` returns `status === 'active'` challenges **plus**
any `status === 'draft'` challenges the current user created. The GroupsScreen only excluded
`'completed'`, so the user's own draft challenges inflated the count.

### Fix
Changed the filter to:
```typescript
if (!challenge.groupId || challenge.status !== 'active') return;
```
Only `status === 'active'` challenges are counted. Drafts, expired, and any other status are excluded.

Also updated the badge label from `"Challenge"/"Challenges"` to `"Active Challenge"/"Active Challenges"`.

---

## Issue 2 — WorkoutLoggedScreen "View Completion" CTA Inconsistency

### Symptom
The "View Completion" button appeared or disappeared inconsistently. When it appeared, it could
mislead users to a completion screen before they had actually finished the challenge.

### Root Cause
```typescript
const showCompletion = legacyCompletion >= 80 || overallCompetitivePct >= 80;
```
Both `legacyCompletion` and `overallCompetitivePct` were both `membership?.completionRate`.
A threshold of 80% showed the CTA prematurely — at 80% progress, not 100% completion.

### Fix
```typescript
const showCompletion =
  resolved.isUserCompleted ||
  String(membership?.status ?? '').toLowerCase() === 'completed';
```

- `resolved.isUserCompleted` is computed by `resolveChallengeProgress` per challenge type:
  - **collective:** `groupTarget > 0 && groupTotal >= groupTarget` (team has reached the goal)
  - **competitive:** `completionRate >= 100` or all per-activity targets met
  - **streak:** `currentStreak >= requiredConsecutiveDays`
- `membership?.status === 'completed'` is the Firestore authoritative signal (written by the
  server when the completion cascade fires)

Also removed the now-unused `overallCompetitivePct` variable.

---

## Files Modified

| File | Change |
|---|---|
| `src/features/Groups/GroupsScreen.tsx` | `status !== 'completed'` → `status !== 'active'`; label: "Active Challenge(s)" |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | `showCompletion` uses `resolved.isUserCompleted`; removed `overallCompetitivePct` |
| `scripts/testGroupCardActiveChallengeCountGuards.ts` | New — 4 assertions |
| `scripts/testWorkoutLoggedCompletionCtaGuards.ts` | New — 6 assertions |

---

## Guard Assertions

### `testGroupCardActiveChallengeCountGuards.ts`
1. `normalizedGroups` filter uses `status !== 'active'` (excludes drafts, expired, completed)
2. Does NOT use `status === 'completed'` as the only exclusion
3. Badge label contains "Active Challenge"
4. Badge label does NOT use bare "Challenge"/"Challenges"
5. `activeChallenges` is derived from `challengeCountByGroup` (not raw Firestore field)

### `testWorkoutLoggedCompletionCtaGuards.ts`
1. `showCompletion` references `resolved.isUserCompleted`
2. `showCompletion` checks `membership?.status === 'completed'`
3. `showCompletion` does NOT use `>= 80` threshold
4. `showCompletion` does NOT use `overallCompetitivePct`
5. "View Completion" button is gated by `showCompletion`
6. WorkoutLoggedScreen still uses `resolveChallengeProgress` + `activitySummaryTotal` (continuity)

---

## Validation

```
npx tsx scripts/testGroupCardActiveChallengeCountGuards.ts        → ✅ All guards passed
npx tsx scripts/testWorkoutLoggedCompletionCtaGuards.ts           → ✅ All guards passed
npx tsx scripts/testCollectiveTeamProgressRegressionGuards.ts     → ✅ All guards passed
npx tsx scripts/testGroupFeedProgressSnapshotGuards.ts            → ✅ All guards passed
npx tsx scripts/testGroupFeedStepCapGuards.ts                     → ✅ All guards passed
npx tsx scripts/testChallengePerformanceFinalRegressionGuards.ts  → ✅ All guards passed
npx tsc --noEmit                                                  → ✅ Clean
npm run build                                                     → ✅ Clean
cd functions && npm run build                                     → ✅ Clean
```

---

## Risks

- **Issue 1:** Groups with challenges in states other than `'active'` (e.g., groups that only have
  completed challenges) will now show "0 Active Challenges" — which is the correct behavior.
  The "Active Now" pill on the group cover image continues to use the same `activeChallenges`
  field, so it will correctly disappear when there are no active challenges.
- **Issue 2:** Users who were at 80–99% completion and previously saw "View Completion" will
  no longer see it until they fully complete the challenge. This is the intended behavior —
  the completion screen is only meaningful at 100%.

---

## Rollback

**Issue 1:** Revert the `normalizedGroups` filter condition and the badge label text in
`src/features/Groups/GroupsScreen.tsx`.

**Issue 2:** Revert `showCompletion` to
`const showCompletion = legacyCompletion >= 80 || overallCompetitivePct >= 80;`
and restore `const overallCompetitivePct = membership?.completionRate ?? 0;`.

---

## Manual Test Checklist

### Group card active challenge count
- [ ] Open Groups listing → My Groups tab
- [ ] Confirm a group with 2 active challenges shows **"2 Active Challenges"** (not "13 Challenges")
- [ ] Confirm a group with 1 active challenge shows **"1 Active Challenge"** (singular)
- [ ] Confirm a group with no active challenges shows **"0 Active Challenges"** (no "Active Now" pill)
- [ ] Create a draft challenge in a group → confirm it does NOT increment the badge count
- [ ] Open Groups → Discover tab → confirm discovered groups show correct active count

### WorkoutLoggedScreen before challenge completion
- [ ] Open a collective challenge at 50% of team goal → log an activity
- [ ] Confirm WorkoutLoggedScreen shows **"Go to Feed"** but NOT "View Completion"
- [ ] Confirm the team progress shown uses `challengeActivitySummaries.totalValue`

### WorkoutLoggedScreen after challenge completion (collective)
- [ ] Log the amount needed to reach the team's goal (e.g., group at 9,800 / 10,000, log 200)
- [ ] Confirm WorkoutLoggedScreen shows both **"Go to Feed"** and **"View Completion"**
- [ ] Tap "View Completion" → confirm values match Challenge Detail and Group Feed

### WorkoutLoggedScreen after challenge completion (competitive)
- [ ] Log enough to bring `completionRate` to 100% on a competitive challenge
- [ ] Confirm both CTAs appear

### WorkoutLoggedScreen after challenge completion (streak)
- [ ] Complete the final required day on a streak challenge
- [ ] Confirm both CTAs appear

### Regression: collective / competitive / streak progress values
- [ ] All source-of-truth rules remain: team total = `challengeActivitySummaries.totalValue`;
  user contribution = `challengeMembers.cumulativeLoggedValue`; streak = `currentStreak`
