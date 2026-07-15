# Phase 19A-2 — Challenge-Type Feed Card UI Redesign

**Date:** 2026-07-06
**Branch:** fix/p0-pre-deploy-blockers

---

## Problems Fixed

| # | Problem | Fix |
|---|---------|-----|
| 1 | Feed card rendering inlined in `GroupFeedScreen` with no card component | Extracted to dedicated `FeedCard.tsx` |
| 2 | All cards looked identical regardless of challenge type | Card now branches on `challengeType` with type-specific context lines |
| 3 | Large 220px full-width challenge cover image dominated every card | Removed; challenge name shown as compact text label |
| 4 | Grey placeholder circle for every avatar | Avatar shows `userPhotoURL` when available; falls back to coloured initials |
| 5 | `useGroupFeed()` returned `GroupFeedItem[]` (transformed shim) losing new fields | Hook now returns raw `GroupActivityFeedSummary[]`; `FeedCard` handles all display logic |
| 6 | Social actions: only Reply + Share + Bookmark (no Applaud) | Now: Applaud (ThumbsUp) + Reply (MessageSquare) + Share with `navigator.share` |
| 7 | No days-remaining context | `FeedCard` computes and shows "N days left" from `challengeEndDate` |

---

## Files Modified

| File | Change |
|------|--------|
| `src/features/Groups/FeedCard.tsx` | **New** — dedicated feed card component branching on `challengeType` |
| `src/features/Groups/GroupFeedScreen.tsx` | Removed inline card markup; imports and renders `<FeedCard>`; dropped unused icon imports |
| `src/hooks/useGroupInsights.ts` | `useGroupFeed()` now returns raw `GroupActivityFeedSummary[]` (removed `toFeedItem()` shim) |
| `scripts/testGroupFeedCardUiGuards.ts` | **New** — 15 guard assertions |

**Not modified:** `memberActivitySummaryService.ts`, `groupInsightsService.ts`, `firestore.rules`, Cloud Functions, any Firestore collections

---

## Code Diff Summary

### `src/hooks/useGroupInsights.ts`

```typescript
// Before (Phase 19A-1 interim shim):
queryFn: async () => {
  if (!groupId) return [];
  const items = await memberActivitySummaryService.getGroupFeed(groupId);
  return items.map((item) => memberActivitySummaryService.toFeedItem(item));
},

// After:
queryFn: () => (groupId ? memberActivitySummaryService.getGroupFeed(groupId) : Promise.resolve([])),
```

### `src/features/Groups/FeedCard.tsx` (new)

Key sub-components:

```
Avatar          — userPhotoURL img | coloured initials fallback
TypeBadge       — collective (blue) | competitive (purple) | streak (amber) | null (hidden)
ActivityBox     — orange-tinted metric box (activityLabel + valueLabel)
contextLine()   — 'Added to team progress' | 'Posted a new score' | 'Kept the streak alive' | null
daysRemaining() — computed from challengeEndDate; null when missing or expired
handleShare()   — navigator.share() → clipboard fallback
```

Card layout per challenge type:

| Section | Collective | Competitive | Streak | Null/unknown |
|---------|-----------|------------|--------|-------------|
| Type badge | Blue "Collective" | Purple "Competitive" | Amber "Streak" | Hidden |
| Challenge name | ✅ | ✅ | ✅ | ✅ if present |
| Activity box | ✅ | ✅ | ✅ | ✅ if present |
| Context line | "Added to team progress" | "Posted a new score" | "Kept the streak alive" | Falls back to `item.text` |
| Days left | ✅ from `challengeEndDate` | ✅ | ✅ | ✅ if present |
| Cover image | ❌ removed | ❌ | ❌ | ❌ |

### `src/features/Groups/GroupFeedScreen.tsx`

```tsx
// Before (62 lines of inline card markup):
{feedItems.map((item) => (
  <article key={item.id} ...>
    <div className="h-12 w-12 rounded-full bg-slate-200" />
    ...220px cover image...
  </article>
))}

// After (1 line):
{feedItems.map((item) => (
  <FeedCard key={item.id} item={item} canEngage={canEngage} />
))}
```

---

## Commands Executed

```bash
npx tsx scripts/testGroupFeedCardUiGuards.ts  # ✅ 15 assertions passed
npx tsc --noEmit                               # ✅ 0 errors
npm run build                                  # ✅ built in 3.17s
```

---

## Dependencies Added

None. `ThumbsUp`, `MessageSquare`, `Share2` are all from `lucide-react` (already a project dependency).

---

## Config Changes

None.

---

## Risks / Limitations

1. **Old `groupActivityFeed` docs lack `challengeType`** — Documents written before Phase 19A-1 Cloud Function update have `null` for `challengeType`. These render the generic fallback path (no type badge, `item.text` shown). This is the correct safe fallback.

2. **Old docs lack `challengeEndDate`** — "Days left" simply doesn't appear for pre-19A-1 docs. No error.

3. **Old docs lack `userPhotoURL`** — Avatar shows initials. Graceful.

4. **`navigator.share` not available in all browsers** — Falls back to `navigator.clipboard.writeText`. If both are unavailable (e.g. non-secure context), share silently does nothing. Acceptable for a placeholder social action.

5. **`toFeedItem()` in `memberActivitySummaryService` is now unused by the feed hook** — It is still exported and used by other callers if any. It was not removed to avoid regressions in anything that may depend on it.

6. **No live team/rank/streak stats** — Context lines ("Added to team progress", "Posted a new score", "Kept the streak alive") are static strings, not live-computed. This is correct and documented; live stats require a secondary query per card (Phase 19A-3 or later).

---

## Rollback Instructions

1. Revert `GroupFeedScreen.tsx` — restore inline card markup and old icon imports; remove `FeedCard` import.
2. Delete `src/features/Groups/FeedCard.tsx`.
3. Revert `useGroupInsights.ts` — restore `toFeedItem()` mapping in `queryFn`.
4. Delete `scripts/testGroupFeedCardUiGuards.ts`.

---

## Manual QA Checklist

### Feed renders correctly
- [ ] Navigate to any group → Feed tab → feed loads without errors
- [ ] Each card shows: author name, relative timestamp, challenge name, activity box, context line, days left
- [ ] Empty state "No updates yet" still shows when feed is empty
- [ ] Members-only gate still shows for non-members on private groups

### Challenge type branching
- [ ] Card for a **Collective** challenge shows blue "Collective" badge and "Added to team progress"
- [ ] Card for a **Competitive** challenge shows purple "Competitive" badge and "Posted a new score"
- [ ] Card for a **Streak** challenge shows amber "Streak" badge and "Kept the streak alive"
- [ ] Card for old doc (null challengeType) shows no badge and falls back to `item.text`

### Avatar
- [ ] User with `photoURL` set: card shows their profile photo
- [ ] User without `photoURL`: card shows initials on orange-tinted circle

### Days remaining
- [ ] Challenge with `challengeEndDate` in future: shows "N days left"
- [ ] Challenge ending today: shows "Challenge ends today"
- [ ] Old doc with no `challengeEndDate`: days line absent

### Social actions
- [ ] Member view: Applaud and Reply buttons are enabled (not greyed)
- [ ] Non-member view: Applaud and Reply buttons are greyed/disabled
- [ ] Share button: taps → native share sheet (mobile) or silently copies text (desktop)

### No cover image dominance
- [ ] No large 220px full-width cover image in any feed card

---

## Collective / Streak / Competitive Fallback Notes

- **challengeType `null`** (pre-19A-1 docs): No badge. Text from `item.text` shown below activity box. No "days left". Renders cleanly.
- **challengeType `'collective'`** (new docs): Blue badge. "Added to team progress." Days left. No fake team progress bar — that is Phase 19A-3.
- **challengeType `'competitive'`** (new docs): Purple badge. "Posted a new score." Days left. No fake rank/delta — Phase 19A-3.
- **challengeType `'streak'`** (new docs): Amber badge. "Kept the streak alive." Days left. No fake streak day — Phase 19A-3.

---

## Next Recommended Phase

**Phase 19A-3 — Live Challenge Stats on Feed Cards**

Now that `FeedCard` branches on challenge type, add real live stats to each card via a secondary query:

- **Collective:** Show team total progress + target + progress bar (from `challengeActivitySummaries/{challengeId}`)
- **Competitive:** Show poster's rank and score delta from leader (from `challengeLeaderboards` where challengeId + groupId)
- **Streak:** Show user's current streak count (from `memberStats` or `challengeMembers`)

Implementation approach:
- New hook: `useChallengeLiveStats(challengeId, userId, groupId)` — returns `{ teamTotal, teamTarget, userRank, leaderScore, userStreak }` from pre-computed summary collections
- Pass result as optional prop to `FeedCard` or compute inside a `FeedCardWithStats` wrapper
- All data is already in Firestore from existing Cloud Functions — no new writes needed
- Use `staleTime: 60_000` to avoid per-card over-fetching; batch by unique challengeId across visible feed items
