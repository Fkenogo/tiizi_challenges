# Phase 18I-6I: Home Challenge Cards Relevance

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers
**Status:** ✅ Complete

## Changes

### My Challenges — sort by recent user activity

`useHomeScreen.ts`: `ongoingMemberChallenges` now sorted before `.slice(0, 10)`:
- Tier 1: challenges with `lastActivityAt` → descending (most recently logged first)
- Tier 2: no `lastActivityAt` → ascending `endDate` (soonest deadline first)
- Limit raised from 3 → 10 (carousel shows 3 at a time, user swipes for more)
- Zero new Firestore reads: `lastActivityAt` was already in `membershipSummaries`

### Most Active — ranked by totalLogs

`useHomeScreen.ts`:
- `mostPopularOngoing` renamed to `mostActiveOngoing` in type and return value
- Batch-reads `challengeActivitySummaries/{id}` for all ongoing candidate IDs (chunked `in` queries, ≤6 batches)
- Sort: `totalLogs` desc → `participantCount` desc fallback
- Missing docs treated as `totalLogs = 0` (not excluded)
- Stat label: `"X logs"` when `totalLogs > 0`; `"X members"` fallback
- Limit raised from 3 → 5

`HomeScreen.tsx`:
- Section header: `"Most Popular"` → `"Most Active"`
- All `effectiveMostPopular` / `fallbackMostPopular` / `mostPopularOngoing` references renamed

## Guards added

11 new guards in `scripts/testHomeChallengeFeeds.ts`.

## Validation

```
npx tsc --noEmit
→ clean (no output)

npm run build
→ ✓ built in 5.91s (chunk size warnings are pre-existing)

npm run test:home-challenge-feeds
→ ✅ testHomeChallengeFeeds: all guards passed

npm run test:challenge-activity-model
→ === Results: 44 passed, 0 failed ===

npm run test:scoring-guards
→ scoring guards passed

npm run test:challenge-creation-backend
→ challenge creation backend tests passed

npm run test:challenge-creation-6combos
→ testChallengeCreation6Combinations: all guards passed ✅

npm run audit:challenge-creation-payloads
→ auditChallengeCreationPayloads: all guards passed ✅

npm run test:admin-challenge-management
→ === Results: 66 passed, 0 failed ===
```

## Manual Test Checklist

- [ ] My Challenges: a challenge logged today appears before an unlogged joined challenge
- [ ] My Challenges: with no logs anywhere, joined challenges sort by nearest end date
- [ ] My Challenges: up to 10 cards appear (swipe carousel to see cards 4–10)
- [ ] Most Active: section header reads "Most Active"
- [ ] Most Active: a challenge with many logs appears before one with more participants but fewer logs
- [ ] Most Active: card shows "X logs" (not "X people joined") for active challenges
- [ ] Most Active: card shows "X members" for challenges with no activity summary
- [ ] Competitive/Streak challenges still show correct progress on My Challenges cards
- [ ] Live progress enrichment still works on first My Challenges card
- [ ] Privacy: only challenges from accessible groups/public appear
