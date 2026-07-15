# Phase 19A-7 — Milestone/Achievement Feed Posts — Changelog

**Date:** 2026-07-07

## Summary

Auto-generate milestone feed posts in Cloud Functions when activity thresholds are crossed (first log, collective 25/50/75/100%). Render milestone cards distinctly in FeedCard with an amber MilestoneBadge. Add Achievements filter chip to the group feed. Reactions, comments, and share remain fully functional on milestone cards.

## Modified Files

- `functions/src/memberActivitySummaries.ts` — `ChallengeDoc.groupCumulativeTarget`, `feedItemType: 'activity_log'` on feed docs, `COLLECTIVE_THRESHOLDS` constant, `checkAndQueueMilestones()` function, wired into `summarizeWorkoutCreated` and `summarizeWellnessLogCreated`
- `src/types/index.ts` — `FeedItemType`, `MilestoneType`, `feedItemType?`, `milestoneType?` on `GroupActivityFeedSummary`
- `src/features/Groups/FeedCard.tsx` — `MilestoneBadge` component, milestone body branch (bold headline instead of ActivityBox)
- `src/features/Groups/GroupFeedScreen.tsx` — `'achievements'` added to `FeedFilter`, `FILTER_CHIPS`, `applyFilter()`

## New Files

- `scripts/testGroupFeedMilestoneGuards.ts` — 22 guard assertions
- `docs/superpowers/reports/phase-19A-7-feed-milestone-achievement-posts.md`

## Milestones Implemented

| Milestone | Trigger | Doc ID |
|---|---|---|
| `first_log` | User's challengeLeaderboards doc absent pre-batch | `milestone_{challengeId}_{userId}_first_log` |
| `collective_25` | Team total crosses 25% of `groupCumulativeTarget` | `milestone_{challengeId}_collective_25` |
| `collective_50` | Team total crosses 50% | `milestone_{challengeId}_collective_50` |
| `collective_75` | Team total crosses 75% | `milestone_{challengeId}_collective_75` |
| `collective_complete` | Team total crosses 100% | `milestone_{challengeId}_collective_complete` |

## Deferred Milestones

| Milestone | Reason |
|---|---|
| `streak_3/7/14` | `challengeMembers.currentStreak` not updated by activity summarization CF |
| `competitive_leader` | Requires expensive `orderBy score desc limit 1` query per log |
| `challenge_complete` | Separate trigger (challenge status change), not activity log |

## Deploy Note

CF build required (`cd functions && npm run build`). No Firestore rules changes. No new Firestore indexes. Client-side filter is data-backed (milestone docs have `feedItemType: 'milestone'`).
