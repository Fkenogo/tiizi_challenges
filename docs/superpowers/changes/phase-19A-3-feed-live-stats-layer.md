# Phase 19A-3 — Feed Live Stats Layer — Changelog

**Date:** 2026-07-07

## Summary

Added a read-only live stats layer to the group activity feed. Feed cards now show real data from Firestore for each challenge type rather than static context strings.

## New Files

- `src/services/feedLiveStatsService.ts` — batched read-only stats service
- `src/hooks/useFeedLiveStats.ts` — React Query hook (staleTime: 60s)
- `scripts/testGroupFeedLiveStatsGuards.ts` — 20 guard assertions
- `docs/superpowers/reports/2026-07-07-phase-19A-3-feed-live-stats-layer.md`

## Modified Files

- `src/features/Groups/FeedCard.tsx` — CollectiveStats, CompetitiveStats, StreakStats sub-components; optional `stats` prop
- `src/features/Groups/GroupFeedScreen.tsx` — calls `useFeedLiveStats`; passes stats to each card
- `firestore.indexes.json` — added `challengeLeaderboards (challengeId, groupId, score DESC)` index

## What Each Challenge Type Shows

| Type | Live stat shown |
|---|---|
| Collective | Team total / target + progress bar |
| Competitive | Poster score + "Leading!" or "X pts behind [leader]" |
| Streak | Day N streak (with flame icon) |
| Null / unknown | `item.text` fallback (unchanged) |

## Breaking Changes

None. All stats are optional — missing or null values fall back to the static Phase 19A-2 context lines.
