# Phase 19A-8D Changes — Feed Accuracy + Activity Logging Alignment

**Date:** 2026-07-07

## Files Modified

### `functions/src/memberActivitySummaries.ts`
- Full rewrite (all 8D fixes applied):
  - Removed `challengeMembers` write from `queueActivitySummaryWrites` (fixes double-counting of `cumulativeLoggedValue`)
  - Competitive branch: reads `challengeMembers.cumulativeLoggedValue` directly (post-log, client-owned) instead of recomputing from leaderboard prev + input.value
  - Competitive branch: `leaderDelta` and `leadingBy` only set when `leaderValue` > 0 (fixes "0 behind" bug; never uses `leaderScore` as unit proxy)
  - Competitive branch: `Tied for the lead` label when `leaderDelta === 0`
  - Competitive branch: `Leading by X unit` / `is leading with X unit` when `isLeading`
  - Streak branch: reads `challengeMembers.currentStreak` directly (post-log, streakEngine-owned); removes `newStreak` recomputation
  - Removed `memberUpdate` field from `SnapshotResult` type
  - Added `leadingBy?: number` computation

### `src/features/Groups/FeedCard.tsx`
- `SnapshotProgress` component: competitive type now renders two lines (progress + leader context)
- `SnapshotProgress` uses `snap.userCumulativeValue` for the progress line
- `SnapshotProgress` applies `text-primary` color for leading state, `text-slate-500` for trailing
- Outer days-remaining block gated on `!item.feedProgressSnapshot` (eliminates duplicate)

### `src/hooks/useFeedComments.ts`
- Both `addComment` and `addReply`: destructure `profile` from `useAuth()`
- Author name: `profile?.displayName ?? user!.displayName ?? user!.email?.split('@')[0] ?? 'Member'`
- Eliminates raw email showing as comment author for email/password accounts

## Files Created

### `scripts/testGroupFeedAccuracyGuards.ts`
- 18 new assertions covering:
  - Competitive reads post-log `cumulativeLoggedValue` from `challengeMembers` (not leaderboard)
  - `leaderDelta` guarded behind `leaderValue !== undefined`
  - "0 behind" bug: no `leaderScore` proxy usage
  - "Tied for the lead" label
  - "Leading by" / "is leading with" label
  - Collective `newTotal = prevTotal + input.value`
  - Streak reads `memberData.currentStreak` (no `newStreak` recompute)
  - CF does not `batch.set` on `challengeMembers`
  - Days rendered only once per FeedCard
  - `profile?.displayName` used in comments
  - Email split at `@` in fallback
  - `snap.userCumulativeValue` rendered for competitive

### `scripts/testGroupFeedProgressSnapshotGuards.ts` (updated)
- Replaced stale 8C assertions with 8D-accurate assertions:
  - `leadingBy` field on `FeedProgressSnapshot` type
  - Competitive reads from `challengeMembers` (not `prevCumulative + input.value`)
  - CF does NOT increment `cumulativeLoggedValue` on `challengeMembers`
  - Streak reads `memberData.currentStreak` directly (no `memberUpdate`)
  - `!item.feedProgressSnapshot` gate on outer days block
  - `snap.userCumulativeValue` rendered in `SnapshotProgress`
  - `snap.isLeading` used for conditional styling

## Summary

Phase 19A-8D corrects five bugs introduced or surfaced during Phase 19A-8C:

1. **Double-counting** — CF no longer writes to `challengeMembers` (client engines own it)
2. **"0 behind" bug** — competitive delta only uses `leaderValue`; never falls back to score
3. **Streak double-recompute** — streak snapshot reads post-log state written by `streakEngine`
4. **Duplicate "days left"** — outer days block gated on `!feedProgressSnapshot`
5. **Comment author email** — uses `profile.displayName` with email-prefix fallback

Total guard assertions: 133 passing across 6 scripts.
