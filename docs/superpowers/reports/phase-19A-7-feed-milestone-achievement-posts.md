# Phase 19A-7 — Milestone/Achievement Feed Posts

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## Files Modified

| File | Change |
|---|---|
| `functions/src/memberActivitySummaries.ts` | `ChallengeDoc.groupCumulativeTarget`, `feedItemType: 'activity_log'` tag, `COLLECTIVE_THRESHOLDS`, `checkAndQueueMilestones()`, wired into both summarize functions |
| `src/types/index.ts` | `FeedItemType`, `MilestoneType` types; `feedItemType?`, `milestoneType?` on `GroupActivityFeedSummary` |
| `src/features/Groups/FeedCard.tsx` | `MilestoneBadge` component, Trophy/Star import, milestone body branch |
| `src/features/Groups/GroupFeedScreen.tsx` | `'achievements'` filter in `FeedFilter`, `FILTER_CHIPS`, `applyFilter()` |
| `scripts/testGroupFeedMilestoneGuards.ts` | **New** — 22 guard assertions |

---

## Cloud Function Logic

### `checkAndQueueMilestones(db, batch, input, challenge, displayName, userPhotoURL?)`

Called after `queueActivitySummaryWrites(...)` and before `batch.commit()` in both `summarizeWorkoutCreated` and `summarizeWellnessLogCreated`.

Runs two checks in parallel:

**`first_log`:**
- Reads `challengeLeaderboards/{challengeId}_{userId}` (pre-batch, so no score yet)
- If absent → check `groupActivityFeed/milestone_{challengeId}_{userId}_first_log` doesn't exist → write milestone doc

**`collective_25/50/75/100`:**
- Only runs when `challenge.challengeType === 'collective'` and `groupCumulativeTarget > 0`
- Reads `challengeActivitySummaries/{challengeId}.totalValue` (pre-batch)
- Computes `prevPct` and `newPct = (prevTotal + input.value) / target * 100`
- For each threshold in `[25, 50, 75, 100]`, if `prevPct < threshold <= newPct`:
  - Checks milestone doc doesn't exist → writes it
- Doc IDs: `milestone_{challengeId}_collective_25/50/75/100/collective_complete`

**Duplicate prevention:** Each milestone check reads the target doc before writing. Deterministic doc IDs also prevent double-writes at the Firestore level (set with no merge for milestone docs).

---

## FeedCard Changes

**`MilestoneBadge`** — amber styling, Trophy icon for team milestones, Star for personal.

**Card body branch:**
```tsx
{item.feedItemType === 'milestone' ? (
  item.text && <p className="mt-3 text-[17px] leading-[24px] font-black text-slate-900">{item.text}</p>
) : (
  <>
    <ActivityBox ... />
    {/* live stats / context line */}
  </>
)}
```

Reactions, comments, and share bar are outside the branch — unchanged, always rendered.

---

## GroupFeedScreen Changes

```typescript
type FeedFilter = 'all' | 'workout' | 'wellness' | 'collective' | 'competitive' | 'streak' | 'achievements';

// In applyFilter():
if (filter === 'achievements') return items.filter((i) => i.feedItemType === 'milestone' || i.feedItemType === 'achievement');
```

---

## Commands Executed

```bash
npx tsx scripts/testGroupFeedMilestoneGuards.ts    # ✅ 22 assertions passed
npx tsx scripts/testGroupFeedFiltersGuards.ts      # ✅ 18 assertions passed
npx tsx scripts/testGroupFeedCommentsGuards.ts     # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedReactionsGuards.ts    # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedLiveStatsGuards.ts    # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedCardUiGuards.ts       # ✅ 15 assertions passed
npx tsc --noEmit                                   # ✅ 0 errors
cd functions && npm run build                      # ✅ 0 errors
npm run build                                      # ✅ built in 3.71s
```

---

## Deferred Milestones

| Milestone | Reason deferred |
|---|---|
| `streak_3/7/14` | `challengeMembers.currentStreak` not incremented by activity summarization CF; would require separate streak-tracking logic |
| `competitive_leader` | Requires `orderBy score desc limit 1` query per log — expensive and racy |
| `challenge_complete` | Triggered by challenge status change, not individual activity log; different CF or trigger needed |

---

## Risks / Limitations

1. **Collective thresholds read stale `totalValue`** — `checkAndQueueMilestones` reads `challengeActivitySummaries.totalValue` before the batch commits the new increment. Two near-simultaneous logs could both see `prevTotal` below a threshold and attempt to write the same milestone doc. The existence check before `batch.set` is a soft guard; Firestore does not support conditional writes in a batch. However, because the doc ID is deterministic, both batches would write identical data — result is idempotent, just two writes instead of one.

2. **`first_log` race** — same as above: two simultaneous first logs could both pass the leaderboard existence check. Both milestone docs would write to the same path with the same data (idempotent).

3. **Achievements filter shows empty on groups with no milestones** — the existing filtered-empty state ("No updates match this filter yet. / Clear Filter") handles this correctly.

---

## Manual QA Checklist

- [ ] First activity logged in a challenge: milestone card appears in feed with "Achievement" amber badge and "First activity logged..." headline
- [ ] Team collective challenge reaches 25%: milestone card appears with "Team Milestone" amber badge and "Team reached 25% of the goal!" headline
- [ ] Milestone card shows reactions (Like, Applaud, Inspired)
- [ ] Milestone card shows Reply → opens comment section
- [ ] Milestone card shows Share
- [ ] Achievements filter chip visible in feed filter row
- [ ] Achievements filter shows only milestone cards
- [ ] Regular activity cards no longer appear in Achievements filter
- [ ] All, Workouts, Wellness, Collective, Competitive, Streak filters unchanged
