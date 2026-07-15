# Phase 19A-6 — Feed Filters + Empty States — Changelog

**Date:** 2026-07-07

## Summary

Added six data-backed filter chips (All, Workouts, Wellness, Collective, Competitive, Streak) to the group feed. Filtering is client-side using existing `source` and `challengeType` fields. Replaced the single generic empty state with two contextual states: one for a fully empty feed (with Browse Challenges + Log Activity CTAs) and one for a filter with no results (with Clear Filter CTA). No Firestore changes.

## Modified Files

- `src/features/Groups/GroupFeedScreen.tsx` — `FeedFilter` type, `FILTER_CHIPS`, `applyFilter()`, `activeFilter` state, filter chip row, two contextual empty states

## New Files

- `scripts/testGroupFeedFiltersGuards.ts` — 18 guard assertions
- `docs/superpowers/reports/2026-07-07-phase-19A-6-feed-filters-empty-states.md`

## Filter Chips

| Chip | Field | Value |
|---|---|---|
| All | — | all |
| Workouts | `source` | `'workout'` |
| Wellness | `source` | `'wellness'` |
| Collective | `challengeType` | `'collective'` |
| Competitive | `challengeType` | `'competitive'` |
| Streak | `challengeType` | `'streak'` |

**Deferred:** Comments/Engagement, Cause Support — no feed data fields to support them.

## Deploy Note

No deploy required. Client-side only.
