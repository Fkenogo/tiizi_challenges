# Phase 19A-8 — Final QA + Performance Cleanup

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Files Modified

| File | Change |
|---|---|
| `functions/src/memberActivitySummaries.ts` | Added `.slice(0, 280)` server-side story cap in both `summarizeWorkoutCreated` and `summarizeWellnessLogCreated` |
| `scripts/testGroupFeedFinalQaGuards.ts` | **New** — 18 final QA guard assertions |

**Not modified:** `firestore.rules`, `firestore.indexes.json`, all frontend files, all other scripts.

---

## 2. Performance Findings

### GroupFeedScreen — data sources ✅
- Reads only from `groupActivityFeed` via `useGroupFeed` (from `useGroupInsights`)
- No direct queries to `workouts`, `wellnessLogs`, `exercises`, `challenges`, or `users`
- Feed docs are fully denormalized: `authorName`, `challengeName`, `activityLabel`, `valueLabel`, `story`, etc. are all embedded at write time by the Cloud Function
- Live stats (`useFeedLiveStats`) run additional reads to `challengeActivitySummaries` and `challengeLeaderboards`, but only once per feed render with `staleTime: 60_000`

### Reactions — load strategy ✅
- `useFeedReactions` batch-fetches reaction subcollections for all visible feed items at mount time
- `staleTime: 30_000` prevents re-fetches on focus/navigation
- One `getDocs` per feed item in parallel — acceptable for typical feed sizes (10–20 items)
- No per-render reads; invalidation is mutation-triggered only

### Comments — lazy loading ✅
- `FeedCommentSection` renders only when `showComments === true` (user taps Reply)
- No comment reads until a card is explicitly opened
- Replies within a comment thread are gated by `enabled={showReplies}` in `useCommentReplies`
- **Double lazy:** comments only on Reply tap; replies only on View Replies tap

### Summary: no excessive reads
The feed is built on fully precomputed docs. Live stats and reactions add reads but are bounded and cached. Comments/replies are fully on-demand.

---

## 3. Rules + Index Deployment Requirements

### Firestore Rules — requires deploy

`firestore.rules` covers:
- `groupActivityFeed/{feedItemId}` — read: members + public groups; write: Cloud Functions only
- `reactions/{reactionUserId}` — read: `canReadFeedItem`; write/delete: own doc + group member
- `comments/{commentId}` — read: `canReadFeedItem`; create: group member + 1–500 char; update/delete: owner
- `replies/{replyId}` — same pattern as comments

**Deploy command:**
```bash
firebase deploy --only firestore:rules
```

### Firestore Indexes — requires deploy

Required indexes (all present in `firestore.indexes.json`):

| Collection | Fields | Purpose |
|---|---|---|
| `groupActivityFeed` | `groupId ASC, createdAt DESC` | Group feed query |
| `groupActivityFeed` | `challengeId ASC, createdAt DESC` | Challenge feed query |
| `challengeLeaderboards` | `challengeId ASC, groupId ASC, score DESC` | Live stats competitive |

No new indexes needed for Phase 19A reactions, comments, stories, or filters (all either use single-field reads or collection scans on subcollections).

**Deploy command:**
```bash
firebase deploy --only firestore:indexes
```

### Cloud Functions — requires deploy
```bash
firebase deploy --only functions
```

### Full deploy (recommended for pilot):
```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
```

---

## 4. Commands Executed

```bash
npx tsx scripts/testGroupFeedFinalQaGuards.ts    # ✅ 18 assertions passed
npx tsx scripts/testGroupFeedStoriesGuards.ts    # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedMilestoneGuards.ts  # ✅ 22 assertions passed
npx tsx scripts/testGroupFeedFiltersGuards.ts    # ✅ 18 assertions passed
npx tsx scripts/testGroupFeedCommentsGuards.ts   # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedReactionsGuards.ts  # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedLiveStatsGuards.ts  # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedCardUiGuards.ts     # ✅ 15 assertions passed
npx tsc --noEmit                                 # ✅ 0 errors
cd functions && npm run build                    # ✅ 0 errors
npm run build                                    # ✅ built in 3.36s
```

**Total: 153 guard assertions, all passing.**

---

## 5. Remaining Risks

### Acceptable / documented
1. **Reaction batch reads on feed load** — `useFeedReactions` fires one `getDocs` per feed item on mount. For a feed with 20 items this is 20 subcollection reads. With `staleTime: 30s` this is bounded and will not re-fire on focus. If feed pagination is added in future, batching should be revisited.

2. **Story 280-char cap is UI-enforced on client, server-enforced in CF** — A client bypassing the UI (direct Firestore write via Admin SDK or emulator) could write a longer string. The CF cap prevents this for all production writes. The UI `maxLength={280}` enforces it for all user-facing writes.

3. **Collective milestone race condition** — two near-simultaneous logs can both read the same `totalValue` pre-batch and both attempt to write the same milestone doc. The doc ID is deterministic and the writes are idempotent (same data), so this is safe but results in two writes to the same doc.

4. **Chunk size warning on build** — the frontend bundle exceeds 500kB. This is a pre-existing condition not introduced by Phase 19A. Code-splitting is outside this phase's scope.

### Deferred features (by design)
- `streak_3/7/14` milestones — `challengeMembers.currentStreak` not updated in activity CF
- `competitive_leader` milestone — requires expensive leaderboard query per log
- `challenge_complete` milestone — needs a separate trigger on challenge status change
- Comments/Engagement feed filter — no `feedItemType` field distinguishes engagement-only items
- Cause Support feed filter — `donation.enabled` not surfaced in feed summary docs

---

## 6. Manual QA Checklist

### Feed performance (can be verified via browser Network tab)
- [ ] GroupFeedScreen loads: only `groupActivityFeed` query visible (no workouts/wellnessLogs/exercises)
- [ ] Feed reactions load as a batch on screen mount (not per-interaction)
- [ ] Comment reads only appear after tapping Reply on a card
- [ ] Reply reads only appear after tapping "View replies" on a comment

### Story safety
- [ ] Log activity with exactly 280 characters → story saves and renders fully
- [ ] Log activity with 281+ characters (test via API or emulator) → story stored as first 280 chars

### Filters — all 7 chips
- [ ] All, Workouts, Wellness, Collective, Competitive, Streak, Achievements — all visible and functional
- [ ] Achievements shows only milestone cards
- [ ] Clear Filter resets to All

### Rules + indexes (test via Firebase console or emulator)
- [ ] Non-member cannot read feed items in a private group
- [ ] Non-member cannot create reactions or comments
- [ ] Member can create reaction, delete own reaction
- [ ] Non-owner cannot delete another member's comment
- [ ] `groupActivityFeed` query by `groupId` + `createdAt DESC` uses the composite index (no full-scan warning in console)

### Phase 19A regression check
- [ ] Reactions (Like / Applaud / Inspired) functional on all card types
- [ ] Comments + replies load and post correctly
- [ ] Milestone cards show amber badge, no StoryBlock
- [ ] Activity cards with story show left-accented StoryBlock
- [ ] Activity cards without story render identically to pre-19A-7B
- [ ] Share button functional
- [ ] Live stats (team progress bar, score, streak) display on appropriate cards

---

## 7. Rollback Instructions

**Phase 19A-8 only (story cap):**
1. In `functions/src/memberActivitySummaries.ts`, change `.trim().slice(0, 280) || undefined` back to `.trim() || undefined` in both `summarizeWorkoutCreated` and `summarizeWellnessLogCreated`
2. Delete `scripts/testGroupFeedFinalQaGuards.ts`
3. `cd functions && npm run build`

**Full Phase 19A rollback** — see individual phase reports:
- Phase 19A-7B: `docs/superpowers/reports/2026-07-07-phase-19A-7B-personal-activity-stories.md`
- Phase 19A-7: `docs/superpowers/reports/phase-19A-7-feed-milestone-achievement-posts.md`
- Phase 19A-6: `docs/superpowers/reports/2026-07-07-phase-19A-6-feed-filters-empty-states.md`
