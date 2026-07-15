# Phase 19A — Challenge Performance Source-of-Truth Manual Test Matrix

**Date:** 2026-07-08
**Branch:** fix/p0-pre-deploy-blockers
**Prerequisite:** Phases 19A-10A through 10E deployed (or testing on this branch against a dev environment).

---

## Before You Start

For each test scenario:
1. Open browser DevTools → Network tab, filter `firestore`.
2. Open the JS console to watch for errors.
3. Use a test account that has no prior history in the challenge (avoids stale `cumulativeLoggedValue` from before 10A).

---

## A. Collective Challenge

**Setup:** A v2 collective challenge is active. Test user has joined. `groupCumulativeTarget` is set (e.g., 700 reps / km / minutes).

| # | Step | Expected result | Source verified |
|---|------|----------------|-----------------|
| A1 | Join the challenge as a new member. | `challengeMembers` doc created with `cumulativeLoggedValue: 0`. | `challengeMembers` |
| A2 | Log first activity (e.g., 50 reps). | Confirmation screen shows "+50" delta. | `WorkoutLoggedScreen` |
| A3 | Navigate to Home → My Challenges card. | Progress bar and label reflect `cumulativeLoggedValue` (50), not 0. | `challengeMembers.cumulativeLoggedValue` |
| A4 | Open Challenge Detail. | Leaderboard and team total reflect CF-updated `challengeActivitySummaries.totalValue`. | `challengeActivitySummaries` |
| A5 | Open Group Feed. | Feed card shows team cumulative progress via `feedProgressSnapshot.teamCumulativeValue`. | `groupActivityFeed.feedProgressSnapshot` |
| A6 | Log a second activity (30 more). | Home card shows 80 total. Feed card shows new snapshot with 80. | `challengeMembers.cumulativeLoggedValue` |
| A7 | Check that user contribution is NOT doubled. | `feedProgressSnapshot.userCumulativeValue` ≈ 80, not 160. | CF snapshot (10A/10B guards) |
| A8 | Check team total is NOT sum-of-members. | Team total from `challengeActivitySummaries.totalValue` accounts for all members; not re-computed client-side. | `challengeActivitySummaries.totalValue` |

---

## B. Competitive Challenge

**Setup:** A v2 competitive challenge is active. User A and User B have both joined.

| # | Step | Expected result | Source verified |
|---|------|----------------|-----------------|
| B1 | User A logs 100 reps. | User A's `challengeMembers.cumulativeLoggedValue` = 100. | `challengeMembers` |
| B2 | User B logs 60 reps. | User B's `cumulativeLoggedValue` = 60. | `challengeMembers` |
| B3 | User B opens feed — sees User A's post. | Feed card shows "X ahead of you" (User A leading by ~40). NOT "0 behind leader". | `feedProgressSnapshot.leaderDelta` / `leadingBy` |
| B4 | User B logs 50 more (now 110 total). | User B now leads. Feed shows User B ahead of leader. | `challengeMembers.cumulativeLoggedValue` |
| B5 | User A views Challenge Detail leaderboard. | Ranking uses `challengeLeaderboards.score`, not raw cumulative. | `challengeLeaderboards.score` |
| B6 | Both users are equal (e.g., both 100). | Competitive display shows "tied" or "0 behind leader" — this is the one legitimate "0 behind" state. | `feedProgressSnapshot.leadingBy == 0` |
| B7 | Open SelectChallengeActivityScreen for User B. | Screen shows User B's current cumulative from `challengeMembers`. Cache invalidates after next log. | `challenge-leaderboard-snapshot` TanStack key |

---

## C. Streak Challenge

**Setup:** A v2 streak challenge is active. Test user has joined.

| # | Step | Expected result | Source verified |
|---|------|----------------|-----------------|
| C1 | Log day 1 activity. | `challengeMembers.currentStreak` = 1 after CF fires. | `challengeMembers.currentStreak` |
| C2 | Check Home card after log. | Home shows "Day 1" or streak progress from `currentStreak`. | `challengeMembers.currentStreak` |
| C3 | Check feed card for day 1. | `feedProgressSnapshot.streakDay` = 1 or 0 (if snapshot fires before streak increments). | `feedProgressSnapshot.streakDay` |
| C4 | Simulate day 2 (or log again next calendar day). | `currentStreak` = 2. Home and feed reflect updated streak. | `challengeMembers.currentStreak` |
| C5 | Log a multi-activity wellness streak (if applicable). | `cumulativeLoggedValue` non-zero and updating per session. | `challengeMembers.cumulativeLoggedValue` |
| C6 | Check ChallengeCompletedScreen (end of challenge). | "Final Streak" shows `currentStreak`. No raw workout count shown as streak metric. | `challengeMembers.currentStreak` |

---

## D. Multi-Activity Wellness Session

**Setup:** A wellness challenge with multiple activities (e.g., hydration + sleep + meditation). Test user has not previously logged.

| # | Step | Expected result | Source verified |
|---|------|----------------|-----------------|
| D1 | Open Log Activity screen. | Session form shows all required activities. | `activityLogSessionService` |
| D2 | Complete all activities and submit. | Session commits to Firestore. `challengeMembers.cumulativeLoggedValue` set to sum of session values (not 0). | `activityLogSessionService` (10A fix) |
| D3 | Return to Home. | Home first card shows non-zero progress. NOT 0 despite not using `workouts` collection. | `membership?.cumulativeLoggedValue` (10C fix) |
| D4 | Open Challenge Detail. | Leaderboard shows user's progress. | `challengeMembers.cumulativeLoggedValue` |
| D5 | Open Group Feed. | Feed card shows `feedProgressSnapshot` with non-zero `userCumulativeValue`. | `feedProgressSnapshot` |
| D6 | Log a second session. | `cumulativeLoggedValue` is additive (session 1 + session 2). NOT reset to session 2 alone. | `nextCumulativeLoggedValue = prev + sessionTotal` |
| D7 | Verify no double-counting. | CF `memberActivitySummaries` trigger fires but does not re-write `cumulativeLoggedValue` to `challengeMembers`. | CF 10B rule |

---

## E. Legacy / Old Documents

**Setup:** Feed cards from before Phase 19A (no `feedProgressSnapshot` field).

| # | Step | Expected result | Source verified |
|---|------|----------------|-----------------|
| E1 | Scroll feed to older posts (pre-19A). | Feed cards render without errors. No blank/crash where `feedProgressSnapshot` is missing. | `FeedCard.tsx` null-safe fallback |
| E2 | Old posts show days remaining or basic label. | Fallback path renders `daysLabel` or static text. Does NOT throw on missing `feedProgressSnapshot`. | `FeedCard.tsx` conditional render |
| E3 | Live stats overlay on old posts. | `feedLiveStatsService` enriches with current data. No crash if `challengeLeaderboards.cumulativeLoggedValue` is absent. | `feedLiveStatsService` reads from `challengeMembers` |
| E4 | Old `challengeMembers` docs with missing `cumulativeLoggedValue`. | Home and completed screen show `0` gracefully — no NaN, no crash. | `?? 0` coercion guards throughout |
| E5 | Challenge with no activities array. | No crash in `buildChallengeProgress`. Target defaults to 0 or 1. | `challengeProgressResolver.ts` |

---

## Pass / Fail Tracking

| Scenario | Tester | Date | Pass/Fail | Notes |
|----------|--------|------|-----------|-------|
| A — Collective | | | | |
| B — Competitive | | | | |
| C — Streak | | | | |
| D — Multi-activity wellness | | | | |
| E — Legacy documents | | | | |

---

## Known Acceptable Gaps

1. **Historical `cumulativeLoggedValue = 0`** — users who logged multi-activity wellness sessions before 10A will show `0` as their historical total until they log again. This is accepted; the field is now the source of truth going forward.
2. **Streak day from `currentStreak`** — `currentStreak` is updated by the client engine in the same batch as the log. CF snapshot may occasionally reflect `currentStreak` before the client write if the CF fires faster (very unlikely in practice; client writes atomically).
3. **`uniqueDays` in ChallengeCompletedScreen streak view** — still derived from raw workout documents for the "Active Days" counter. For wellness-only streak challenges, this may undercount. This is a known gap deferred to a future phase.
