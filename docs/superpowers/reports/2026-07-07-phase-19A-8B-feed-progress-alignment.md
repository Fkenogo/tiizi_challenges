# Phase 19A-8B — Feed Progress Alignment

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Root Cause

Three bugs combined to produce blank or misleading progress sections on feed cards:

1. **Empty `{}` truthy bug.** The old render pattern `stats ? <CollectiveStats stats={stats} /> : <fallback>` never showed the fallback because `{}` (an empty object, returned while data is loading or when no challenge doc exists) is truthy. The inner component then returned null because its key field was `undefined`, leaving a blank stats section with no fallback.

2. **Missing unit.** `feedLiveStatsService` did not read `activities[0].unit` from the challenge doc, so collective and streak cards showed "490 / 500" with no unit label.

3. **Score ≠ cumulative value for competitive.** The service used `leaderboard.score` (a computed integer) for "user's progress" display. The user's actual cumulative logged value lives in `challengeMembers.cumulativeLoggedValue`. Both are needed: score for leader comparison, cumulative for the progress bar.

---

## 2. Files Modified

| File | Change |
|---|---|
| `src/services/feedLiveStatsService.ts` | **Full rewrite.** Added `unit`, `posterCumulativeValue`, `perPersonTarget`, `streakDailyTarget` to `FeedLiveStats` type. Added `firstActivityUnit()` and `firstActivityTarget()` helpers. `fetchCollective` batches challenge doc reads in parallel for unit. `fetchCompetitive` now 4-way parallel: leaderboard leader query, leaderboard poster read, challenge doc (target+unit), challengeMembers doc (cumulativeLoggedValue). `fetchStreak` now 2-way parallel: memberSnaps + challengeSnaps for dailyTarget+unit. |
| `src/features/Groups/FeedCard.tsx` | **Updated stats components.** Removed `contextLine()` function and its call. Added `StatsFallback` component. `CollectiveStats`, `CompetitiveStats`, `StreakStats` each return `<StatsFallback />` when their key datum is `undefined`. Render conditions changed from `stats ? <Component />` to always-render (each component handles its own fallback). Unit displayed inline with progress values. |
| `scripts/testGroupFeedProgressGuards.ts` | **New** — 24 assertions for Phase 19A-8B. |
| `scripts/testGroupFeedLiveStatsGuards.ts` | Fixed stale assertion: replaced old `contextLine()` string check with `StatsFallback` check. |

---

## 3. Service Changes — Read Budget

Phase 19A-8B adds reads but keeps them batched:

| Path | Before | After | Notes |
|---|---|---|---|
| `challengeActivitySummaries` | 1 per collective challenge | unchanged | |
| `challenges` | 0 | 1 per unique challenge (collective + competitive + streak) | batched per type |
| `challengeLeaderboards` | 1 per item (poster) + 1 query (leader) | unchanged | |
| `challengeMembers` | 0 | 1 per (challengeId, userId) pair | batched across all competitive + streak items |

All new reads are batched by `challengeId`. No per-card reads. `staleTime: 60_000` unchanged.

---

## 4. Commands Executed

```bash
npx tsx scripts/testGroupFeedProgressGuards.ts    # ✅ 24 assertions passed
npx tsx scripts/testGroupFeedFinalQaGuards.ts     # ✅ 18 assertions passed
npx tsx scripts/testGroupFeedLiveStatsGuards.ts   # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedCardUiGuards.ts      # ✅ 15 assertions passed
npx tsc --noEmit                                  # ✅ 0 errors
npm run build                                     # ✅ built in 3.99s
```

**Total: 77 guard assertions covering Phase 19A-8B + prior phases, all passing.**

---

## 5. What Each Card Now Shows

### Collective
```
Progress: 490 / 500 km
[████████████████░░] 98%
10 km remaining
3 days left
```

### Competitive
```
Progress: 120 / 200 km
2 pts behind Alex
3 days left
```
(If user is leading: "Leading!" instead of delta line.)

### Streak
```
🔥 Day 7 streak
Daily target: 30 min
3 days left
```

### Any type — no live stats yet
```
Progress updates as the challenge moves.
```

---

## 6. Screens / Flows to Test Manually

- [ ] Group feed: collective challenge card shows "Progress: X / Y unit" + progress bar + remaining
- [ ] Group feed: competitive challenge card shows "Progress: X / Y unit" + "Leading!" or "X pts behind leader"
- [ ] Group feed: streak challenge card shows "Day X streak" + "Daily target: Y unit"
- [ ] Feed card with no challenge doc → shows `StatsFallback` gracefully (no crash, no blank)
- [ ] Old feed docs (no `feedItemType` field, no `story`) render identically to pre-19A-7B
- [ ] Milestone cards show amber badge and no stats section
- [ ] StoryBlock still renders on activity cards that have `story`
- [ ] Reactions, comments, share still work on all card types

---

## 7. Risks

1. **`challengeMembers` doc may not exist** for older challenge members. `fetchCompetitive` guards with `if (!snap.exists()) continue` — competitive cards without a member doc fall through to `StatsFallback` cleanly.

2. **`activities[0].unit` absent on old challenge docs.** `firstActivityUnit` returns `undefined` in this case; unit is omitted from the display (shows "490 / 500" not "490 / 500 undefined").

3. **`perPersonTarget` from `activities[0].targetValue`** is an activity-level target, not an overall challenge target. For multi-activity competitive challenges this is the target for activity[0] only. Acceptable for MVP; a per-user challenge target field would be the correct long-term solution.

4. **Additional reads vs. prior phases.** Phase 19A-8B adds `challenges` + `challengeMembers` reads to competitive and streak live stats. These are bounded by feed page size (typically 10–20 items), batched, and cached at `staleTime: 60s`.

---

## 8. Rollback Instructions

**Phase 19A-8B only:**

1. Revert `src/services/feedLiveStatsService.ts` to the Phase 19A-8 version (remove `firstActivityUnit`, `firstActivityTarget`, `challengeMembers` reads, `posterCumulativeValue`, `perPersonTarget`, `streakDailyTarget`, `unit` from `FeedLiveStats`)
2. Revert `src/features/Groups/FeedCard.tsx`: restore `contextLine()` function, revert stats components to return `null` when no data, restore `stats ? <Component />` gate
3. Delete `scripts/testGroupFeedProgressGuards.ts`
4. Restore prior `testGroupFeedLiveStatsGuards.ts` (old contextLine assertion)
5. `npm run build`

**Full Phase 19A rollback** — see:
- Phase 19A-8: `docs/superpowers/reports/2026-07-07-phase-19A-8-final-qa-performance-cleanup.md`
- Phase 19A-7B: `docs/superpowers/reports/2026-07-07-phase-19A-7B-personal-activity-stories.md`
- Phase 19A-7: `docs/superpowers/reports/phase-19A-7-feed-milestone-achievement-posts.md`
