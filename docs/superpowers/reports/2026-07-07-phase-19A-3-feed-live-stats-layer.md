# Phase 19A-3 — Feed Live Stats Layer

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## Audit Findings

### Collections available for stats

| Collection | Key fields used |
|---|---|
| `challengeActivitySummaries/{challengeId}` | `totalValue` (team total) |
| `challengeLeaderboards/{challengeId_userId}` | `score`, `displayName` |
| `challengeMembers/{challengeId_userId}` | `currentStreak` |
| `challenges/{challengeId}` | `groupCumulativeTarget` |

### What exists vs. what needs future backend support

| Stat | Status |
|---|---|
| Collective team total | ✅ from `challengeActivitySummaries.totalValue` |
| Collective team target | ✅ from `challenges.groupCumulativeTarget` |
| Competitive poster score | ✅ from `challengeLeaderboards/{challengeId_userId}.score` |
| Competitive leader score | ✅ from top-1 leaderboard query (by score desc) |
| Competitive poster rank | ❌ not pre-computed — would require counting docs above poster (deferred) |
| Streak current streak | ✅ from `challengeMembers/{challengeId_userId}.currentStreak` |
| Streak daily target | ❌ not in `challengeMembers` — would need `challenges.requiredConsecutiveDays` wired (deferred) |

---

## Files Modified

| File | Change |
|---|---|
| `src/services/feedLiveStatsService.ts` | **New** — read-only batched stats service |
| `src/hooks/useFeedLiveStats.ts` | **New** — React Query hook wrapping the service |
| `src/features/Groups/FeedCard.tsx` | Added `CollectiveStats`, `CompetitiveStats`, `StreakStats` components; accept `stats?` prop |
| `src/features/Groups/GroupFeedScreen.tsx` | Call `useFeedLiveStats(feedItems)`; pass `stats={statsMap?.get(item.id)}` to `FeedCard` |
| `firestore.indexes.json` | Added `challengeLeaderboards (challengeId, groupId, score DESC)` index |
| `scripts/testGroupFeedLiveStatsGuards.ts` | **New** — 20 guard assertions |

**Not modified:** Cloud Functions, `firestore.rules`, `src/types/index.ts`, any Firestore collections

---

## Code Diff Summary

### `src/services/feedLiveStatsService.ts`

Three private fetch methods, one public `getStatsMap`:

- `fetchCollective(challengeIds[])` — batch-fetches `challengeActivitySummaries` + `challenges` docs to get `totalValue` and `groupCumulativeTarget`
- `fetchCompetitive(entries[])` — deduplicated by `challengeId`; fetches top-1 leaderboard per unique challenge + poster's own leaderboard doc
- `fetchStreak(entries[])` — fetches `challengeMembers/{challengeId_userId}` for `currentStreak`
- `getStatsMap(items[])` — partitions feed items by `challengeType`, runs three parallel batch fetches, returns `Map<itemId, FeedLiveStats>`

### `src/hooks/useFeedLiveStats.ts`

```typescript
export function useFeedLiveStats(items: GroupActivityFeedSummary[]) {
  const key = items.map((i) => i.id).join(',');
  return useQuery<Map<string, FeedLiveStats>>({
    queryKey: ['feed-live-stats', key],
    queryFn: () => feedLiveStatsService.getStatsMap(items),
    enabled: items.length > 0,
    staleTime: 60 * 1000,
  });
}
```

### `src/features/Groups/FeedCard.tsx`

Three new sub-components:

- `CollectiveStats` — renders team total / target text + progress bar; guarded by `total !== undefined`
- `CompetitiveStats` — renders score + "Leading!" or "X pts behind leader"; guarded by `posterScore !== undefined`
- `StreakStats` — renders "Day N streak" with Flame icon; guarded by `streak` being truthy

`FeedCard` now accepts `stats?: FeedLiveStats`. Per-type rendering:
- `collective` → `<CollectiveStats stats={stats} />` if stats provided; static fallback if not
- `competitive` → `<CompetitiveStats stats={stats} />` if stats provided; static fallback if not
- `streak` → `<StreakStats stats={stats} />` if stats provided; static fallback if not
- null/unknown type → `item.text` fallback unchanged

### `src/features/Groups/GroupFeedScreen.tsx`

```tsx
const { data: statsMap } = useFeedLiveStats(feedItems);
// ...
{feedItems.map((item) => (
  <FeedCard key={item.id} item={item} canEngage={canEngage} stats={statsMap?.get(item.id)} />
))}
```

---

## Commands Executed

```bash
npx tsx scripts/testGroupFeedLiveStatsGuards.ts  # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedCardUiGuards.ts      # ✅ 15 assertions passed
npx tsc --noEmit                                  # ✅ 0 errors
npm run build                                     # ✅ built in 3.53s
```

---

## Dependencies Added

None. `Flame` is from `lucide-react` (already a project dependency).

---

## Config Changes

Added `challengeLeaderboards (challengeId ASC, groupId ASC, score DESC)` index to `firestore.indexes.json`. Required for the competitive top-1 leader query.

---

## Risks / Limitations

1. **Competitive: no pre-computed rank** — poster rank (1st, 2nd, etc.) is not shown because it would require counting all leaderboard docs above the poster. Not attempted — would require a Cloud Function to pre-compute rank field.

2. **Streak: no daily target** — `challenges.requiredConsecutiveDays` exists but was not plumbed through `challengeMembers`. Not wired in this phase.

3. **`challengeLeaderboards` index must deploy before competitive stats load** — until `firebase deploy --only firestore:indexes` runs, competitive secondary stat queries will fail gracefully (return empty, show static fallback).

4. **Read cost** — `getStatsMap` issues up to 3×N Firestore reads per feed load (N = unique challengeIds). For a feed with 10 items across 3 challenges: ~9 reads. Acceptable. `staleTime: 60_000` prevents re-fetching on every render.

5. **Collective: `totalValue` vs `groupCurrentTotal`** — `challengeActivitySummaries.totalValue` is always the CF-maintained source; `challenges.groupCurrentTotal` is a denormalized field that may lag. This phase reads `challengeActivitySummaries` as the source of truth for team total.

---

## Rollback Instructions

1. Revert `FeedCard.tsx` — remove `CollectiveStats`, `CompetitiveStats`, `StreakStats` components; remove `stats?` prop; restore static context line rendering.
2. Delete `src/services/feedLiveStatsService.ts`.
3. Delete `src/hooks/useFeedLiveStats.ts`.
4. Revert `GroupFeedScreen.tsx` — remove `useFeedLiveStats` import and call; remove `stats=` prop from `<FeedCard>`.
5. Revert `firestore.indexes.json` — remove the `challengeLeaderboards` index entry.

---

## Manual QA Checklist

### Collective challenge feed cards
- [ ] Card shows "Team total: X / Y" with real numbers from Firestore
- [ ] Progress bar width matches (total / target) %
- [ ] When target is met, shows "Target reached!" instead of "X remaining"
- [ ] Card without `groupCumulativeTarget` shows total only, no progress bar
- [ ] Old doc with no `challengeType` still renders cleanly (no crash)

### Competitive challenge feed cards
- [ ] Card shows poster's score in points
- [ ] If poster is top scorer, shows "Leading!"
- [ ] If not, shows "X pts behind [leaderName]"
- [ ] Card for poster not yet on leaderboard falls back to static "Posted a new score"

### Streak challenge feed cards
- [ ] Card shows "Day N streak" with flame icon
- [ ] Old doc with null `currentStreak` falls back to static "Kept the streak alive"

### Null/unknown challengeType
- [ ] Renders `item.text` fallback; no crash, no fake stats

### Performance
- [ ] Navigating to feed tab: single batch of Firestore reads (not one per card)
- [ ] Navigating away and back: stats cached (no re-fetch within 60s)
