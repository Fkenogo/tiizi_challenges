# Phase 19A-7B — Personal Activity Stories

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Files Modified

| File | Change |
|---|---|
| `src/types/index.ts` | Added `story?: string` to `GroupActivityFeedSummary` |
| `functions/src/memberActivitySummaries.ts` | Added `story?` to `ActivitySummaryInput`; reads `notes` from Firestore data and denormalizes as `story` into feed doc; blank story not written |
| `src/features/Groups/FeedCard.tsx` | Added `StoryBlock` component with left-accent styling and Read more / Show less collapse; renders only when `item.story?.trim()` is truthy and `feedItemType !== 'milestone'` |
| `src/features/Workouts/LogWorkoutScreen.tsx` | Renamed label to "How are you feeling?"; added helper text; placeholder "Feeling stronger today 💪"; `maxLength={280}`; character counter |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | Same UX changes as LogWorkoutScreen |
| `scripts/testGroupFeedStoriesGuards.ts` | **New** — 20 guard assertions |

**Not modified:** `firestore.rules`, `firestore.indexes.json`, `GroupFeedScreen.tsx`, any other file.

---

## 2. UX Changes

### Log screens (both Workout and Wellness)

| Before | After |
|---|---|
| Label: "Notes" | Label: "How are you feeling?" |
| Placeholder: "How did it feel? (optional)" / "Add optional context..." | Placeholder: "Feeling stronger today 💪" |
| No helper text | Helper: "Share your progress, celebrate a milestone or encourage your teammates." |
| No character limit enforced | `maxLength={280}` + live counter "N/280" |
| `h-[170px]` / `h-[150px]` textareas | `h-[120px]` + `resize-none` |

Max 280 characters — social content, not journaling.

---

## 3. Data Model Changes

### `ActivitySummaryInput` (Cloud Function internal type)
```typescript
story?: string;  // denormalized from Firestore `notes` field
```

### `GroupActivityFeedSummary` (frontend type)
```typescript
story?: string;  // optional — old docs without this field render normally
```

### Feed doc in Firestore (`groupActivityFeed/{activityId}`)
- `story` field written only when `notes.trim()` is non-empty
- Blank / whitespace-only notes → field absent from doc

---

## 4. Feed Rendering Changes

### `StoryBlock` component
- Left orange border accent (`border-l-[3px] border-primary`)
- `whitespace-pre-wrap` — preserves line breaks and emoji
- Collapsed to 4 lines (`maxHeight: 80px`) when content overflows
- "Read more" button expands inline; "Show less" collapses
- Overflow detection via `scrollHeight` on mount

### Render guard
```tsx
{item.feedItemType !== 'milestone' && item.story?.trim() && (
  <StoryBlock story={item.story.trim()} />
)}
```

Milestone cards are unaffected. Cards without a story render exactly as before.

---

## 5. Backward Compatibility

- `story?` is optional on `GroupActivityFeedSummary` — old feed docs without the field render normally
- No existing fields renamed or removed
- No Firestore rules changes — `story` is written by Cloud Functions (Admin SDK), not by client
- No Firestore index changes

---

## 6. Commands Executed

```bash
npx tsx scripts/testGroupFeedStoriesGuards.ts      # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedMilestoneGuards.ts    # ✅ 22 assertions passed
npx tsx scripts/testGroupFeedFiltersGuards.ts      # ✅ 18 assertions passed
npx tsx scripts/testGroupFeedCommentsGuards.ts     # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedReactionsGuards.ts    # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedLiveStatsGuards.ts    # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedCardUiGuards.ts       # ✅ 15 assertions passed
npx tsc --noEmit                                   # ✅ 0 errors
cd functions && npm run build                      # ✅ 0 errors
npm run build                                      # ✅ built in 3.22s
```

---

## 7. Risks / Limitations

1. **`scrollHeight` overflow detection on mount** — `useEffect` fires after first paint. If the text is very close to the 4-line boundary, there may be a one-frame flicker before the "Read more" button appears. This is a negligible cosmetic issue.

2. **Notes field name** — The underlying Firestore field on workout/wellness docs remains `notes`. The feed summary doc uses `story`. The rename is handled in the CF without any migration of existing data.

3. **Existing feed docs** — Docs written before this phase lack the `story` field. They render normally because `story?` is optional and the StoryBlock guard is `item.story?.trim()`.

4. **Emoji rendering** — Emoji are stored as Unicode in Firestore. `whitespace-pre-wrap` preserves them. No special encoding needed.

5. **maxLength is UI-only** — The 280-char cap is enforced by the `maxLength` HTML attribute on the textarea. The Cloud Function does not re-validate length. A direct Firestore write (Admin SDK test script, etc.) could write a longer string, which would still render safely in the StoryBlock.

---

## 8. Rollback Instructions

1. Revert `src/features/Workouts/LogWorkoutScreen.tsx` — restore "Notes" label, original placeholder, remove `maxLength`, remove helper text, remove counter.
2. Revert `src/features/Workouts/LogWellnessActivityScreen.tsx` — same.
3. Revert `src/features/Groups/FeedCard.tsx` — remove `StoryBlock`, `useRef`, `useEffect` from named imports, remove story render line, remove `STORY_MAX_LINES` constants.
4. Revert `src/types/index.ts` — remove `story?: string` from `GroupActivityFeedSummary`.
5. Revert `functions/src/memberActivitySummaries.ts` — remove `story?` from `ActivitySummaryInput`, remove `story: stringValue(data, 'notes').trim() || undefined` from both input objects, remove `if (input.story) feedDoc.story = input.story;`.
6. Delete `scripts/testGroupFeedStoriesGuards.ts`.

---

## 9. Manual QA Checklist

### Log screen
- [ ] Log workout: section label reads "How are you feeling?" (not "Notes")
- [ ] Log wellness: section label reads "How are you feeling?" (not "Notes")
- [ ] Helper text: "Share your progress, celebrate a milestone or encourage your teammates." visible below label
- [ ] Placeholder text: "Feeling stronger today 💪"
- [ ] Character counter visible (e.g. "0/280")
- [ ] Counter updates as user types
- [ ] Cannot type beyond 280 characters
- [ ] Textarea does not resize when dragged

### Feed stories — basic
- [ ] Log activity with "Feeling stronger today 💪" → feed card shows story in left-accented block
- [ ] Log activity with emojis → emojis render correctly in feed card
- [ ] Log activity with blank notes → feed card shows no story block (identical to pre-phase)
- [ ] Existing feed items without story → render identically to before

### Feed stories — collapse
- [ ] Short story (≤4 lines) → no "Read more" button
- [ ] Long story (>4 lines) → collapses to 4 lines, "Read more" button appears
- [ ] Tap "Read more" → full text shown, "Show less" appears
- [ ] Tap "Show less" → collapses again
- [ ] No modal opens on expand

### Milestone cards
- [ ] Milestone feed cards show amber MilestoneBadge
- [ ] Milestone cards do NOT show StoryBlock even if story field present

### Preserved behaviour
- [ ] Like / Applaud / Inspired reactions functional on cards with and without stories
- [ ] Reply → comment section opens/closes on cards with and without stories
- [ ] Share button functional on cards with and without stories
- [ ] Achievements filter still shows milestone cards only
