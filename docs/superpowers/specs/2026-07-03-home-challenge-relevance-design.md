# Home Challenge Cards Relevance — Design Spec

**Date:** 2026-07-03  
**Phase:** 18I-6I  
**Branch:** fix/p0-pre-deploy-blockers  
**Status:** Approved — ready for implementation plan

---

## Goal

Replace static ordering in the Home page's two challenge sections with relevance-based ranking that surfaces the most useful challenges for each user.

---

## Audit Summary

### "My Challenges" — current state

- Source: `getUserChallengeMembershipSummaries(uid)` reads `challengeMembers` docs for the user. Already returns `lastActivityAt` per challenge.
- Sort: `startDate` descending (most recently *started* challenge first). Ignores activity recency.
- Limit: 3 cards hard-coded.
- Live progress enrichment: only the first card gets a live log query. Unchanged by this spec.

### "Most Popular" — current state

- Source: `allChallenges` (up to 60 docs from `getVisibleChallengesForUser`), already in memory.
- Sort: `participantCount` descending. Static join count only.
- Limit: 3 cards.
- Privacy: safe — `allChallenges` is scoped to public groups + user's accessible groups.

### Key discovery: `challengeActivitySummaries` collection

Cloud Functions (`memberActivitySummaries.ts`) write a per-challenge aggregate on every workout and wellness log:

```
challengeActivitySummaries/{challengeId}:
  totalLogs       — incremented per log (both workout and wellness)
  totalScore
  totalValue
  uniqueParticipantIds  — array
  lastActivityAt  — ISO string of most recent log
  updatedAt
```

This is maintained automatically. No new Cloud Function work needed.

---

## Design

### Section A — "My Challenges": sort by recent user activity

**Data:** No new Firestore reads. `membershipSummaries.get(challengeId).lastActivityAt` is already fetched.

**Sort logic (two tiers):**

```
Tier 1: ongoing joined challenges WHERE lastActivityAt IS NOT NULL
        → sort by lastActivityAt DESC (most recently logged first)

Tier 2: ongoing joined challenges WHERE lastActivityAt IS NULL
        → sort by endDate ASC (soonest deadline first — most urgent)
```

**Limit:** Fetch up to **10** joined ongoing challenges. The existing horizontal carousel renders 3 at a time; the user swipes to see more. No UI layout changes needed.

**Unchanged:** live progress enrichment applies to the first card only (same as today).

---

### Section B — "Most Active": replace "Most Popular"

**Rename:** Section header changes from "Most Popular" → "Most Active".

**Source:** `allChallenges` (already fetched, up to 60 docs). Filter to ongoing only (same as today).

**Enrich with `challengeActivitySummaries`:**

After filtering, batch-read `challengeActivitySummaries/{id}` for the ongoing candidate IDs using Firestore `in` queries (chunks of 10, so ≤6 batches for 60 candidates; in practice 5–20 reads).

Build an activity map: `Map<challengeId, { totalLogs, lastActivityAt }>`.

**Sort:**

```
Primary:   totalLogs DESC    (from challengeActivitySummaries, 0 if missing)
Secondary: participantCount DESC  (fallback for equal or missing totalLogs)
```

**Limit:** Top **5** challenges.

**Privacy:** Guaranteed by `allChallenges` source (same public + user's groups scoping as today).

**Card stat label:** Show `"X logs"` (from `totalLogs`) instead of `"X people joined"`. If `totalLogs` is 0 or missing, fall back to `"X members"` using `participantCount`.

---

## Performance

| Operation | Cost | Notes |
|-----------|------|-------|
| My Challenges sort | 0 extra reads | `lastActivityAt` already in membershipSummaries |
| Most Active enrich | ≤60 reads | Chunked `in` queries on challengeActivitySummaries |
| Live progress (first card) | 1 read | Unchanged |

The `challengeActivitySummaries` batch read replaces the sort-by-participantCount with no unbounded queries. Maximum 60 reads in the worst case; typical 5–20.

**Guard:** Do not read `challengeActivitySummaries` for challenges not in `allChallenges` (already guaranteed by building the batch from filtered candidates).

---

## Data Model — No Changes

No new fields, collections, or Cloud Function changes. All data already exists:
- `challengeMembers.lastActivityAt` — membership doc field, already fetched
- `challengeActivitySummaries.totalLogs` — maintained by existing Cloud Functions
- `Challenge.participantCount` — maintained by existing Cloud Functions

**Future recommendation** (not in scope): Add `totalLogs` directly to challenge docs via Cloud Function counter so the enrichment batch read can be eliminated. Document in post-phase notes.

---

## Files to Change

| File | Change |
|------|--------|
| `src/features/Home/useHomeScreen.ts` | New sort for `myChallenges`; batch-read `challengeActivitySummaries`; new sort for `mostActive`; rename field `mostPopularOngoing` → `mostActiveOngoing`; up limit from 3 → 10 for My Challenges, 3 → 5 for Most Active |
| `src/features/Home/HomeScreen.tsx` | Update field reference `mostPopularOngoing` → `mostActiveOngoing`; update section header text |
| `src/types/index.ts` (if needed) | Add `totalLogs?: number` to Challenge type if not present (already exists on ChallengeActivitySummary) |
| `scripts/testHomeChallengeFeeds.ts` | Add guards (see below) |

---

## Test Guards

New guards in `scripts/testHomeChallengeFeeds.ts`:

1. `useHomeScreen sorts myChallenges by lastActivityAt before unlogged challenges`
2. `useHomeScreen includes joined challenges with no lastActivityAt as Tier 2 fallback`
3. `useHomeScreen Tier 2 no-log challenges sorted by endDate asc`
4. `useHomeScreen reads challengeActivitySummaries for Most Active ranking`
5. `useHomeScreen sorts Most Active by totalLogs before participantCount`
6. `useHomeScreen Most Active falls back to participantCount when totalLogs missing`
7. `useHomeScreen My Challenges limit is 10`
8. `useHomeScreen Most Active limit is 5`
9. `HomeScreen renders section label "Most Active" not "Most Popular"`
10. `useHomeScreen Most Active uses chunked in-query (no unbounded read)`
11. `useHomeScreen myChallenges uses lastActivityAt from membershipSummaries (no new Firestore read)`

---

## What Is NOT Changed

- Live progress enrichment on the first My Challenges card — unchanged
- Competitive leaderboard fetch — unchanged
- `todaysGoals` — unchanged
- Progress resolver (`buildChallengeProgress`) — unchanged
- Privacy scoping of `allChallenges` — unchanged
- Card UI components (`ActiveChallengeCard`, carousel) — no layout changes
- Challenge detail navigation — unchanged
