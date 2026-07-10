# Phase 19A-6 — Feed Filters + Empty States

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## Files Modified

| File | Change |
|---|---|
| `src/features/Groups/GroupFeedScreen.tsx` | Added `FeedFilter` type, `FILTER_CHIPS`, `applyFilter()`, `activeFilter` state, filter chip row, two contextual empty states |
| `scripts/testGroupFeedFiltersGuards.ts` | **New** — 18 guard assertions |

**Not modified:** `FeedCard.tsx`, `FeedCommentSection.tsx`, services, hooks, `firestore.rules`, `firestore.indexes.json`, any other file

---

## Available Filters (data-backed)

| Filter ID | Field used | Value matched |
|---|---|---|
| `all` | — | all items |
| `workout` | `source` | `'workout'` |
| `wellness` | `source` | `'wellness'` |
| `collective` | `challengeType` | `'collective'` |
| `competitive` | `challengeType` | `'competitive'` |
| `streak` | `challengeType` | `'streak'` |

**Deferred (not shown):**
- `engagement` / Comments — no field in `GroupActivityFeedSummary` distinguishes engagement-only items
- `cause_support` — `donation.enabled` is not surfaced in feed summary docs

---

## Code Diff Summary

### `src/features/Groups/GroupFeedScreen.tsx`

**New type + constant:**
```typescript
type FeedFilter = 'all' | 'workout' | 'wellness' | 'collective' | 'competitive' | 'streak';

const FILTER_CHIPS: { id: FeedFilter; label: string }[] = [
  { id: 'all',         label: 'All' },
  { id: 'workout',     label: 'Workouts' },
  { id: 'wellness',    label: 'Wellness' },
  { id: 'collective',  label: 'Collective' },
  { id: 'competitive', label: 'Competitive' },
  { id: 'streak',      label: 'Streak' },
];
```

**Filter function (pure, client-side):**
```typescript
function applyFilter(items: GroupActivityFeedSummary[], filter: FeedFilter) {
  if (filter === 'all') return items;
  if (filter === 'workout' || filter === 'wellness') return items.filter(i => i.source === filter);
  return items.filter(i => i.challengeType === filter);
}
```

**State:**
```typescript
const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
const filteredItems = applyFilter(feedItems, activeFilter);
```

**Filter chip row** (horizontal scroll, above feed list):
```tsx
<div role="tablist" aria-label="Feed filters" className="flex gap-2 overflow-x-auto px-4 ...">
  {FILTER_CHIPS.map(chip => (
    <button
      key={chip.id}
      role="tab"
      aria-selected={activeFilter === chip.id}
      className={activeFilter === chip.id ? 'bg-primary text-white' : 'border border-slate-200 bg-white ...'}
      onClick={() => setActiveFilter(chip.id)}
    >
      {chip.label}
    </button>
  ))}
</div>
```

**Empty states:**

| Condition | State shown |
|---|---|
| `feedItems.length === 0 && activeFilter === 'all'` | "Nothing posted yet" + Browse Challenges + Log Activity CTAs |
| `feedItems.length > 0 && filteredItems.length === 0` | "No results" + "No updates match this filter yet." + Clear Filter button |

**Preserved:** private-group gate, loading/error states (implicit via React Query), reactions, comments, live stats — all wired unchanged.

---

## Commands Executed

```bash
npx tsx scripts/testGroupFeedFiltersGuards.ts      # ✅ 18 assertions passed
npx tsx scripts/testGroupFeedCommentsGuards.ts     # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedReactionsGuards.ts    # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedLiveStatsGuards.ts    # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedCardUiGuards.ts       # ✅ 15 assertions passed
npx tsc --noEmit                                   # ✅ 0 errors
npm run build                                      # ✅ built in 3.24s
```

---

## Dependencies Added

None.

---

## Config / Rules Changes

None. Filtering is entirely client-side. No new Firestore indexes, no rules changes.

---

## Risks / Limitations

1. **Filter counts not shown** — Chips show label only, not "Workouts (4)". Adding counts would require iterating `feedItems` per filter. Deferred as it adds render complexity for limited value.

2. **`source` field may be absent on old feed docs** — Pre-Phase-19A-1 feed docs may lack the `source` field. These items will not appear under Workouts or Wellness filters (treated as undefined). They remain visible under All. This is the correct safe fallback.

3. **Filter resets on navigation** — `activeFilter` is local component state; navigating away and back resets to 'All'. This is intentional for MVP — no persistence needed.

4. **"Comments / Engagement" and "Cause Support" filters deferred** — Neither is supported by current `GroupActivityFeedSummary` fields. Adding them would require either new fields in the Cloud Function writes or a separate Firestore query.

5. **No "Group with no active challenges" empty state variant** — The spec suggested this variant but it requires knowing whether the group has any challenges, which would need a separate `useGroupChallenges` query. Deferred to avoid adding an unscoped read. The "Nothing posted yet" state with "Browse Challenges" CTA covers this case functionally.

---

## Rollback Instructions

1. Revert `GroupFeedScreen.tsx` — remove `FeedFilter` type, `FILTER_CHIPS`, `applyFilter`, `activeFilter` state, filter chip row; revert empty states to original "No updates yet" single state; restore `feedItems.map(...)` from `filteredItems.map(...)`.
2. Delete `scripts/testGroupFeedFiltersGuards.ts`.

---

## Manual QA Checklist

### Filter chips
- [ ] Six chips visible: All, Workouts, Wellness, Collective, Competitive, Streak
- [ ] Chips scroll horizontally on narrow screens without wrapping
- [ ] Active chip shows orange background + white text
- [ ] Inactive chips show white background + slate border
- [ ] Tapping a chip filters the feed list immediately (no reload)
- [ ] Tapping All shows all feed items again

### Filter accuracy
- [ ] Workouts: shows only items where source = 'workout'
- [ ] Wellness: shows only items where source = 'wellness'
- [ ] Collective: shows only cards with Collective badge
- [ ] Competitive: shows only cards with Competitive badge
- [ ] Streak: shows only cards with Streak badge

### Empty states
- [ ] Group with no feed at all (All filter): "Nothing posted yet" with Browse Challenges + Log Activity buttons
- [ ] Browse Challenges navigates to /app/challenges
- [ ] Log Activity navigates to /app/home
- [ ] Active filter yields no results: "No results" + "No updates match this filter yet." + Clear Filter button
- [ ] Clear Filter button resets to All filter and shows all items
- [ ] Filtered empty state does NOT show Browse Challenges / Log Activity CTAs

### Preserved behaviour
- [ ] Private group gate still shown for non-members
- [ ] Reaction buttons still functional on filtered cards
- [ ] Comment panel still opens/closes on filtered cards
- [ ] Live stats still displayed on filtered cards
- [ ] Share button still functional
