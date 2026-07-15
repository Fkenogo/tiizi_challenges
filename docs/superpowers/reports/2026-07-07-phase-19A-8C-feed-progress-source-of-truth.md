# Phase 19A-8C — Feed Progress Source of Truth

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Root Cause Confirmed

Three distinct bugs caused the "Progress updates as the challenge moves." fallback to appear on every feed card:

### Bug 1 — `challengeLeaderboards` never tracked `cumulativeLoggedValue`
The CF wrote `score: FieldValue.increment(input.score)` to `challengeLeaderboards` but never wrote a `cumulativeLoggedValue` field. The `feedLiveStatsService.fetchCompetitive` read `cumulativeLoggedValue` from `challengeLeaderboards` docs and always got `undefined`. `CompetitiveStats` then returned `<StatsFallback />`.

### Bug 2 — `challengeMembers` never updated after activity logs
`challengeMembers` docs were created by `summarizeChallengeMemberCreated` but never written to by activity log CF functions. Fields like `currentStreak`, `lastLogDate`, and `cumulativeLoggedValue` were permanently absent. `feedLiveStatsService.fetchStreak` read `currentStreak` from `challengeMembers` and always got `undefined`. `StreakStats` then returned `<StatsFallback />`.

### Bug 3 — No `feedProgressSnapshot` in feed docs
Feed docs had no embedded progress state. The UI always fell through to `useFeedLiveStats` which depended on the two broken paths above. Even when live stats worked (collective), if `challenge.groupCumulativeTarget` was unset, `CollectiveStats` returned `<StatsFallback />`.

### Write Order
The feed doc and all summary/leaderboard increments were in the same atomic batch — so ordering was never the issue. The fix is to pre-read state, compute post-log values, and embed them in the feed doc at write time.

---

## 2. Files Modified

| File | Change |
|---|---|
| `functions/src/memberActivitySummaries.ts` | Added `buildFeedProgressSnapshot()` function; added `activities?` and new fields to `ChallengeDoc`; added `FeedProgressSnapshot` and `SnapshotResult` types; added `cumulativeLoggedValue: FieldValue.increment()` to `challengeLeaderboardPayload`; added `challengeMembers` batch write (cumulativeLoggedValue + streak state); updated `queueActivitySummaryWrites` signature to accept snapshot + memberStreakUpdate; updated both summarize functions to call `buildFeedProgressSnapshot` before batch |
| `src/types/index.ts` | Added `FeedProgressSnapshot` interface; added `feedProgressSnapshot?: FeedProgressSnapshot` to `GroupActivityFeedSummary` |
| `src/features/Groups/FeedCard.tsx` | Added `SnapshotProgress` component; updated render block to prefer `feedProgressSnapshot` over live stats; imported `FeedProgressSnapshot` type |
| `scripts/testGroupFeedProgressSnapshotGuards.ts` | **New** — 36 assertions |

---

## 3. `feedProgressSnapshot` Shape Implemented

```typescript
type FeedProgressSnapshot = {
  challengeType: string;          // 'collective' | 'competitive' | 'streak'
  unit?: string;                  // activity unit (steps, min, km, etc.)
  loggedValue?: number;           // value from this specific log
  userCumulativeValue?: number;   // competitive: user's new cumulative logged value
  teamCumulativeValue?: number;   // collective: team total after this log
  targetValue?: number;           // collective: groupCumulativeTarget; competitive: activities[0].targetValue
  remainingValue?: number;        // collective: target - newTotal
  percentComplete?: number;       // collective: 0–100
  daysRemaining?: number;         // from challenge.endDate
  streakDay?: number;             // streak: new streak day number
  dailyTarget?: number;           // streak: activities[0].dailyTarget or targetValue
  leaderName?: string;            // competitive: leader's displayName
  leaderValue?: number;           // competitive: leader's cumulativeLoggedValue (if available)
  leaderDelta?: number;           // competitive: how far behind leader (if not leading)
  isLeading?: boolean;            // competitive: true when poster's new score >= leader
  label: string;                  // precomputed human-readable copy
};
```

---

## 4. How Each Challenge Type Now Renders

### Collective
Pre-reads `challengeActivitySummaries.totalValue` (before this log). Computes `newTotal = prevTotal + input.value`. Reads `groupCumulativeTarget` from challenge doc and `activities[0].unit` for unit.

**label:** `"Team progress: 90,000 / 100,000 steps"`

**UI (SnapshotProgress):**
```
Team progress: 90,000 / 100,000 steps
[████████████████░░] 90%
10,000 steps remaining
3 days left
```

### Competitive
Pre-reads poster's `challengeLeaderboards` doc for `prevCumulativeLoggedValue` + `prevScore`. Queries `challengeLeaderboards` by `score DESC limit 2` to find current leader. Computes `newCumulative = prevCumulative + input.value` and `newScore = prevScore + input.score`. Determines `isLeading` by comparing `newScore >= leaderScore`.

**labels:**
- Leading: `"Fred is leading with 58,000 steps"`
- Behind: `"8,000 steps behind Alex"`
- No context yet: `"Progress: 5,000 / 50,000 steps"` or `"Logged 5,000 steps"`

**UI (SnapshotProgress):** label only (no progress bar for competitive).

### Streak
Pre-reads `challengeMembers` doc for `currentStreak` and `lastLogDate`. Computes `newStreak` based on whether today is consecutive with `lastLogDate`. Writes `currentStreak` and `lastLogDate` back to `challengeMembers` in the batch.

**label:** `"Day 4 streak — keep the fire burning"`

**UI (SnapshotProgress):**
```
Day 4 streak — keep the fire burning
Daily target: 30 min
3 days left
```

### Old docs (no `feedProgressSnapshot`)
Falls through to `CollectiveStats` / `CompetitiveStats` / `StreakStats` with live stats unchanged. `StatsFallback` still appears for old docs without data.

---

## 5. Additional Writes Added to Batch

Every activity log CF invocation now also writes to `challengeMembers`:
```
{
  cumulativeLoggedValue: FieldValue.increment(input.value),
  updatedAt: FieldValue.serverTimestamp(),
  // streak challenges only:
  currentStreak: <computed>,
  lastLogDate: "YYYY-MM-DD",
}
```

And `challengeLeaderboards` now also writes:
```
{
  cumulativeLoggedValue: FieldValue.increment(input.value),
  // ...existing fields unchanged
}
```

---

## 6. Commands Executed and Results

```bash
npx tsx scripts/testGroupFeedProgressSnapshotGuards.ts  # ✅ 36 assertions passed
npx tsx scripts/testGroupFeedProgressGuards.ts           # ✅ 24 assertions passed
npx tsx scripts/testGroupFeedFinalQaGuards.ts            # ✅ 18 assertions passed
npx tsx scripts/testGroupFeedLiveStatsGuards.ts          # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedCardUiGuards.ts             # ✅ 15 assertions passed
npx tsc --noEmit                                         # ✅ 0 errors
npm run build                                            # ✅ built in 3.61s
cd functions && npm run build                            # ✅ 0 errors
```

**Total guard assertions: 113, all passing.**

---

## 7. Dependencies Added

None. No new npm packages, no new Firestore indexes required.

The competitive leader query uses the existing `challengeId ASC, groupId ASC, score DESC` composite index.

---

## 8. Config Changes

None. `firestore.rules` and `firestore.indexes.json` unchanged.

---

## 9. Risks / Limitations

### Known limitations

1. **Collective: duplicate `challengeActivitySummaries` read.** Both `buildFeedProgressSnapshot` and `checkAndQueueMilestones` read this doc. This is one extra read per collective log CF invocation. Not batched; acceptable for MVP.

2. **Competitive: leader comparison uses pre-log score.** The leader query runs before the batch commits. If the poster just became the new leader after this log (edging out another user), `isLeading` is computed correctly because we compare `newScore >= leaderScore`. But if two users log simultaneously, the leader shown may be stale by one invocation. This resolves on the next feed refresh.

3. **Competitive: `leaderValue` may be `undefined` on old leaderboard docs.** Old docs without `cumulativeLoggedValue` fall back to score-based delta. As users log more activities, their docs get updated and `leaderValue` becomes available.

4. **Streak: CF cannot detect missed days from the past.** If a user logs today after missing yesterday, the CF correctly resets streak to 1. But if their `challengeMembers` doc had no `lastLogDate` (old doc), their streak is treated as day 1 on first post-8C log.

5. **`activities` array on challenge doc.** If a challenge has no `activities[0]` (old challenge format), `unit` and `dailyTarget` are `undefined`. The snapshot still writes a valid `label` using `input.unit` as the fallback unit.

6. **Snapshot is immutable after write.** Feed docs are written once; `feedProgressSnapshot` reflects state at log time. The label will not update if team subsequently completes the goal. The `SnapshotProgress` component always shows the post-log snapshot state, not live state. For live updates, `useFeedLiveStats` (live stats path for old docs) is available but not wired for new docs.

---

## 10. Manual QA Checklist

- [ ] Log a collective activity → feed card shows "Team progress: X / Y unit" + progress bar + remaining
- [ ] Log a competitive activity (not leading) → card shows "X unit behind [leader name]"
- [ ] Log a competitive activity (leading / only participant) → card shows "[Name] is leading with X unit"
- [ ] Log a streak activity (day 1) → card shows "Day 1 streak — keep it up"
- [ ] Log a streak activity (consecutive day) → card shows "Day N streak — [phrase]"
- [ ] Log a streak activity (after a gap) → card shows "Day 1 streak" (reset)
- [ ] Old feed doc (no feedProgressSnapshot) → falls back to live stats or StatsFallback gracefully
- [ ] Milestone cards unchanged (amber badge, no stats section)
- [ ] Story block still renders below stats for activity cards
- [ ] Reactions + comments + share still functional

---

## 11. Rollback Instructions

**Phase 19A-8C only:**

1. Revert `functions/src/memberActivitySummaries.ts` to Phase 19A-8B version:
   - Remove `buildFeedProgressSnapshot` function
   - Remove `FeedProgressSnapshot` / `SnapshotResult` types
   - Remove `activities?` from `ChallengeDoc`
   - Remove `cumulativeLoggedValue` from `challengeLeaderboardPayload`
   - Remove `challengeMembers` batch write from `queueActivitySummaryWrites`
   - Revert `queueActivitySummaryWrites` signature to remove snapshot/memberUpdate params
   - Revert both summarize functions to not call `buildFeedProgressSnapshot`

2. Revert `src/types/index.ts`: remove `FeedProgressSnapshot` interface and `feedProgressSnapshot` from `GroupActivityFeedSummary`

3. Revert `src/features/Groups/FeedCard.tsx`: remove `SnapshotProgress` component, revert render block to Phase 19A-8B version

4. Delete `scripts/testGroupFeedProgressSnapshotGuards.ts`

5. Run: `npm run build && cd functions && npm run build`
