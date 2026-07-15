# Phase 19A-8C Changes — Feed Progress Source of Truth

**Date:** 2026-07-07

## Files Modified

### `functions/src/memberActivitySummaries.ts`
- Added `activities?: Array<...>` to `ChallengeDoc` type
- Added `FeedProgressSnapshot` and `SnapshotResult` local types
- Added `fmtNum()` and `daysRemainingFor()` helpers
- Added `buildFeedProgressSnapshot()` async function (collective, competitive, streak branches)
- Added `cumulativeLoggedValue: FieldValue.increment(input.value)` to `challengeLeaderboardPayload`
- Added `challengeMembers` batch write in `queueActivitySummaryWrites` (cumulativeLoggedValue + streak state)
- Updated `queueActivitySummaryWrites` signature: `feedProgressSnapshot?`, `memberStreakUpdate?` params
- Updated `summarizeWorkoutCreated`: calls `buildFeedProgressSnapshot` before batch; passes result to `queueActivitySummaryWrites`
- Updated `summarizeWellnessLogCreated`: same as above

### `src/types/index.ts`
- Added `FeedProgressSnapshot` interface (16 fields + required `label`)
- Added `feedProgressSnapshot?: FeedProgressSnapshot` to `GroupActivityFeedSummary`

### `src/features/Groups/FeedCard.tsx`
- Added `FeedProgressSnapshot` to imports from `../../types`
- Added `SnapshotProgress` component (renders `label`, progress bar, remaining, dailyTarget, daysRemaining)
- Updated render block: `item.feedProgressSnapshot ? <SnapshotProgress> : <CollectiveStats|CompetitiveStats|StreakStats|text>`

## Files Created

### `scripts/testGroupFeedProgressSnapshotGuards.ts`
- 36 assertions covering: type shape, CF writes, collective/competitive/streak snapshot logic, cumulativeLoggedValue tracking, challengeMembers update, streak day computation, FeedCard snapshot preference, milestone card isolation, StoryBlock preservation

## Summary

Every new activity feed post now includes a `feedProgressSnapshot` field written by the Cloud Function using pre-batch reads + known log contribution. `FeedCard` prefers this snapshot (always present for new docs) over `useFeedLiveStats` (kept as fallback for old docs). `challengeLeaderboards` now tracks `cumulativeLoggedValue`. `challengeMembers` is now updated on every log (cumulativeLoggedValue + streak state for streak challenges).
