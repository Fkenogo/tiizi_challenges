# Phase 19A-0 — Group Feed Audit + Data Map

**Date:** 2026-07-06
**Branch:** fix/p0-pre-deploy-blockers
**Status:** AUDIT ONLY — no production files modified

---

## 1. Files Inspected

| File | Purpose |
|------|---------|
| `src/features/Groups/GroupFeedScreen.tsx` | Feed UI — renders feed cards |
| `src/hooks/useGroupInsights.ts` | `useGroupFeed()` hook wired to the UI |
| `src/services/groupInsightsService.ts` | Feed data service (currently used by UI) |
| `src/services/memberActivitySummaryService.ts` | Alternative optimized feed service (unused by UI) |
| `functions/src/memberActivitySummaries.ts` | Cloud Function — writes to `groupActivityFeed` |
| `functions/src/index.ts` | Cloud Function trigger registrations |
| `src/types/index.ts` | `GroupActivityFeedSummary` interface |
| `firestore.rules` | Security rules for feed-related collections |
| `firestore.indexes.json` | Composite indexes |

---

## 2. Current Feed Architecture

### Data flow (as-built)

```
User logs workout / wellness activity
  → client writes to workouts / wellnessLogs collection
  → Cloud Function triggers (onWorkoutCreated / onWellnessLogCreated)
  → Cloud Function writes pre-computed summary to groupActivityFeed/{id}
       (challenge name, activity label, value label, score, author name, cover image)
  → React Query invalidates 'group-feed' cache

UI read path (CURRENT — NOT using the pre-computed collection):
  GroupFeedScreen
    → useGroupFeed() [useGroupInsights.ts]
      → groupInsightsService.getGroupFeed()
        → parallel queries: workouts + wellnessLogs + groupMembers + challenges + users + exercises
        → merges, sorts, formats in-memory
        → returns GroupFeedItem[]
```

### Critical mismatch

The Cloud Function writes a fully pre-computed, denormalized `groupActivityFeed` collection. The UI **ignores it** and queries raw source collections instead. `memberActivitySummaryService.getGroupFeed()` provides the optimized read path that reads from `groupActivityFeed`, but it is **not wired to the UI**.

---

## 3. Current Data Model

### Firestore collection: `groupActivityFeed`

Written by Cloud Function (`memberActivitySummaries.ts` line 186–201):

```typescript
{
  groupId: string,
  challengeId: string,
  userId: string,
  authorName: string,          // user display name
  challengeName: string,
  challengeCoverImageUrl?: string,
  activityLabel: string,       // "Bench Press" | "Fasting" | "Hydration" | etc.
  valueLabel: string,          // "5 reps" | "11,000 steps" | etc.
  value: number,
  score: number,               // points earned (present in Firestore, NOT exposed in UI)
  scoringVersion: 'v2' | 'legacy',
  text: string,                // "Completed {valueLabel} in {challengeName}."
  source: 'workout' | 'wellness',
  createdAt: Timestamp,
}
```

### TypeScript interface: `GroupActivityFeedSummary` (types/index.ts lines 324–338)

```typescript
export interface GroupActivityFeedSummary {
  id: string;
  groupId: string;
  challengeId?: string;
  userId: string;
  source?: string;
  value?: number;
  score?: number;
  createdAt?: unknown;
  authorName?: string;
  text?: string;
  challengeCoverImageUrl?: string;
  activityLabel?: string;
  valueLabel?: string;
}
```

### Transformed type: `GroupFeedItem` (groupInsightsService.ts)

```typescript
export type GroupFeedItem = {
  id: string;
  author: string;        // display name
  text: string;          // activity description
  time: string;          // relative time "5m ago"
  imageUrl?: string;     // challenge cover image
  metric?: {
    label: string;       // exercise name or wellness category
    value: string;       // "100 reps" | "11,000 steps"
  };
};
```

**Fields present in Firestore but absent from `GroupFeedItem`:** `score`, `source`, `challengeId`, `userId`, `challengeName`, `scoringVersion`

### Collections also read by `groupInsightsService` (current unoptimized path)

| Collection | Purpose |
|-----------|---------|
| `workouts` | Raw workout logs (groupId + completedAt) |
| `wellnessLogs` | Raw wellness logs (groupId + loggedAt) |
| `groupMembers` | Membership verification |
| `challenges` | Challenge name + coverImageUrl lookup |
| `catalogExercises` | Exercise name lookup |
| `users` | Display name lookup |

---

## 4. Current Post Creation Flow

1. User submits workout log or wellness activity log from a screen (ChallengeDetailScreen / WorkoutLogScreen)
2. `useLogWorkout()` or `useLogWellnessActivity()` writes to `workouts` / `wellnessLogs`
3. Cloud Function triggers: `onWorkoutCreatedUpdateMemberSummaries` / `onWellnessLogCreatedUpdateMemberSummaries`
4. Cloud Function executes in a single Firestore batch:
   - Writes summary to `groupActivityFeed/{activityId}`
   - Updates `memberStats/{groupId_userId}` leaderboard entry
   - Updates `challengeSummaries` document
5. React Query success callback invalidates `'group-feed'` queryKey on both hooks

**Feed items are only generated for:** workout logging and wellness activity logging.

**Feed items are NOT generated for:**
- Challenge creation
- Challenge completion
- Cause contribution / pledge
- Member joining

**No duplication observed** in post creation — one write per user action.

---

## 5. Current UI Flow

```
Group navigation
  → GroupDetailScreen
    → "Feed" tab → GroupFeedScreen
      → useGroupFeed(groupId)
        → renders list of <article> elements (inline, no dedicated card component)
          → header: placeholder avatar div + authorName + relative time
          → body: item.text + optional metric box + optional challenge image
          → footer: Reply | Share | Bookmark buttons (all non-functional placeholders)
```

**No dedicated feed card component exists.** Rendering is inlined directly in `GroupFeedScreen.tsx` via `.map()`.

### Feed card UI elements (per item)

| Element | Source | Status |
|---------|--------|--------|
| Avatar | `<div className="bg-slate-200" />` placeholder | ❌ Placeholder only |
| Author name | `item.author` | ✅ Resolved |
| Relative timestamp | `item.time` (formatted from createdAt) | ✅ Present |
| Activity text | `item.text` | ✅ Present |
| Metric label | `item.metric.label` | ✅ Present |
| Metric value | `item.metric.value` | ✅ Present |
| Challenge cover image | `item.imageUrl` | ✅ Optional (shown when present) |
| Reply button | Disabled placeholder | ❌ No-op |
| Share button | Placeholder | ❌ No-op |
| Bookmark button | Placeholder | ❌ No-op |

---

## 6. Missing Data for Redesigned Cards

### Collective challenge card gaps

| Required field | Available in `groupActivityFeed`? | Available in Firestore? | Note |
|---------------|----------------------------------|------------------------|------|
| User avatar | ❌ | `users/{uid}.photoURL` | Needs separate fetch or denormalization |
| Challenge name | ✅ | ✅ `challengeName` | Present in `groupActivityFeed` |
| Activity name | ✅ | ✅ `activityLabel` | Present |
| Logged amount + unit | ✅ | ✅ `valueLabel` | Present |
| User contribution so far | ❌ | `memberStats` or `challengeContributions` | Not in feed doc; needs join or denormalization |
| Team progress | ❌ | `challengeSummaries` | Not in feed doc; needs join |
| Remaining target | ❌ | `challenges.donation.targetAmountKes` | Not in feed doc |
| Days remaining | ❌ | `challenges.endDate` | Not in feed doc; computable from challenge |
| Challenge type | ❌ | `challenges.challengeType` | **Not denormalized into feed** |
| Progress bar % | ❌ | Computed from above | Requires team progress + target |

### Streak challenge card gaps

| Required field | Available? | Note |
|---------------|-----------|------|
| Activity name | ✅ | `activityLabel` |
| Logged amount | ✅ | `valueLabel` |
| Daily target | ❌ | From `challenges.activities[].targetValue` |
| Current streak day | ❌ | From `memberStats.currentStreak` |
| Days left | ❌ | From `challenges.endDate` |
| Challenge type | ❌ | `challenges.challengeType` — not in feed doc |

### Competitive challenge card gaps

| Required field | Available? | Note |
|---------------|-----------|------|
| Activity name | ✅ | `activityLabel` |
| User's total progress | ❌ | From `memberStats` |
| Leader's progress | ❌ | From `challengeLeaderboard` or `memberStats` |
| Behind/ahead delta | ❌ | Computed |
| Days left | ❌ | From `challenges.endDate` |
| Challenge type | ❌ | Not in feed doc |

### Cross-card gap summary

The single most impactful missing field is **`challengeType`** — without it, the redesigned card cannot branch on Collective / Competitive / Streak. It is present in the `challenges` collection but is not denormalized into `groupActivityFeed` documents.

---

## 7. Social Engagement Current State

**Status: Visual placeholders only. Zero infrastructure.**

| Feature | Implemented | Notes |
|---------|------------|-------|
| Like / reaction | ❌ | No collection, no hook, no rule |
| Reply / comment | ❌ | Button present but disabled via `!canEngage` guard; no onClick handler; no collection |
| Share | ❌ | Button present; no onClick handler |
| Bookmark | ❌ | Button present; no onClick handler |
| Reply count display | ❌ | No count stored anywhere |
| Notification on reply | ❌ | No infrastructure |
| Firestore rules for replies | ❌ | No `feedReplies` collection rule exists |

`canEngage` is a prop/flag that gates the buttons — members can see them enabled, non-members cannot. But even when enabled (member view), clicking Reply does nothing.

---

## 8. Performance Risks

### CRITICAL

**1. UI reads raw collections, ignoring the pre-computed feed (6+ queries vs 1)**

`groupInsightsService.getGroupFeed()` runs 6+ parallel + serial Firestore queries to assemble feed items that the Cloud Function already pre-computed. This is pure waste.

- **Fix:** Switch `useGroupFeed()` to `memberActivitySummaryService.getGroupFeed()`.
- **Impact:** Zero schema migration needed; data already exists in `groupActivityFeed`.

**2. Missing index for `wellnessLogs` (groupId + loggedAt DESC)**

The compound query `where('groupId', '==', groupId), orderBy('loggedAt', 'desc')` has no matching index in `firestore.indexes.json`. The query fails silently in production (caught by `.catch()`). Feed shows no wellness activities in production.

- **Existing index (line 69–76):** Covers `(challengeId, loggedAt)` — not `(groupId, loggedAt)`.
- **Fix:** Add `(collectionGroup: wellnessLogs, groupId ASC, loggedAt DESC)` to `firestore.indexes.json`.

**3. Unbounded `groupMembers` load**

`loadGroupMemberships()` fetches ALL members with no limit. A group with 500 members loads 500 docs just to build a userId→displayName map.

- **Fix:** Irrelevant once we switch to reading `groupActivityFeed` (which already has `authorName` denormalized).

### MEDIUM

**4. No pagination on feed**

Feed is hardcoded to `limit(10)` with no cursor or "load more" support.

- **Fix:** Add cursor-based pagination to `memberActivitySummaryService.getGroupFeed()` (it already accepts `pageSize` parameter).

**5. `groupActivityFeed` index may be missing**

`memberActivitySummaryService.getGroupFeed()` queries `(groupId, createdAt DESC)` — this index is not confirmed in `firestore.indexes.json`.

- **Action needed:** Verify or add this index before switching the read path.

**6. Static relative timestamps**

`formatRelativeTime()` is computed once on render. "5m ago" becomes stale. No interval refresh.

- **Fix:** Use a `useEffect` interval or a library like `date-fns/formatDistanceToNow` on a 60s tick.

### LOW

**7. Duplicate challenge query**

`groupInsightsService` queries `challenges` twice (once for name/image map, once for fallback content). Irrelevant once we switch to the pre-computed path.

---

## 9. Recommended Implementation Sequence

### Phase 19A-1 — New Feed Card Data Model

**Goal:** Add missing fields to `groupActivityFeed` documents and update the Cloud Function to write them.

Fields to add to `groupActivityFeed`:
```
challengeType: 'collective' | 'competitive' | 'streak'
challengeEndDate: string          // ISO date, for "days left"
challengeStartDate: string        // ISO date
userPhotoURL?: string             // denormalize avatar at write time
userId: string                    // already present
```

Files to touch:
- `functions/src/memberActivitySummaries.ts` — add field reads from challenge doc
- `src/types/index.ts` — extend `GroupActivityFeedSummary`
- `firestore.indexes.json` — add `(groupId ASC, createdAt DESC)` index for `groupActivityFeed`

**No schema migration needed** — new fields are additive. Old docs simply lack them; UI falls back gracefully.

### Phase 19A-2 — Switch UI to Pre-Computed Feed

**Goal:** Wire `GroupFeedScreen` to `memberActivitySummaryService` instead of `groupInsightsService`.

Files to touch:
- `src/hooks/useGroupInsights.ts` — switch `useGroupFeed()` to call `memberActivitySummaryService.getGroupFeed()`
- `src/types/index.ts` — ensure `GroupActivityFeedSummary` has all needed fields
- `firestore.indexes.json` — verify/add `groupActivityFeed` index

**Risk:** None — data already exists. Performance improves from 6+ queries to 1.

### Phase 19A-3 — New Feed Card Component

**Goal:** Build a `FeedCard` component that branches on `challengeType`.

Files to touch:
- `src/features/Groups/GroupFeedScreen.tsx` — replace inline rendering with `<FeedCard>` component
- New file: `src/features/Groups/FeedCard.tsx` — three sub-layouts: CollectiveFeedCard, CompetitiveFeedCard, StreakFeedCard

No Firestore changes needed if Phase 19A-1 added `challengeType` and `challengeEndDate`.

**For progress stats (user contribution, team progress, rank):** These require a secondary real-time query per visible card or a batch pre-fetch. Recommend a single `getChallengeLiveStats(challengeId)` call that returns the relevant snapshot for the challenge, cached per challengeId. This is a separate query from the feed list query — not embedded in the feed doc itself.

### Phase 19A-4 — Social Engagement Infrastructure (future)

**Goal:** Implement replies on feed items.

New collection: `feedReplies/{replyId}`
```
{
  feedItemId: string,
  groupId: string,
  userId: string,
  authorName: string,
  text: string,
  createdAt: Timestamp,
}
```

Files to touch:
- `firestore.rules` — add `feedReplies` rules
- `firestore.indexes.json` — add `(feedItemId ASC, createdAt ASC)` index
- New service: `src/services/feedReplyService.ts`
- New hook: `src/hooks/useFeedReplies.ts`
- `src/features/Groups/FeedCard.tsx` — wire Reply button

---

## 10. Risks / Blockers

| Risk | Severity | Notes |
|------|---------|-------|
| `groupActivityFeed` index may not exist in Firestore | HIGH | Must add before switching read path or queries will fail |
| Wellness log feeds broken in prod today | HIGH | Missing `wellnessLogs` compound index causes silent query failure |
| `groupActivityFeed` docs lack `challengeType` | MEDIUM | Blocks card branching until Cloud Function is updated and new logs accumulate |
| Old feed docs (pre-Phase-19A-1) have no `challengeType` | LOW | Old items render as generic cards; acceptable fallback |
| User `photoURL` not in feed docs | MEDIUM | Avatars are placeholders until denormalized into feed at write time |
| Challenge live stats (team progress, rank) require extra queries | MEDIUM | Cannot embed dynamic stats in a static feed doc; need a separate real-time join |

---

## 11. Exact Next Implementation Prompt Recommendation

```
Phase 19A-1 — New Feed Card Data Model

Context:
- The group feed reads from `groupActivityFeed` collection (pre-computed by Cloud Functions)
- Current `groupActivityFeed` docs lack: challengeType, challengeEndDate, challengeStartDate, userPhotoURL
- These fields are needed for the redesigned feed cards that branch on challenge type
- Cloud Function that writes these docs is: functions/src/memberActivitySummaries.ts
- The feed data type is: GroupActivityFeedSummary in src/types/index.ts
- There is also a missing Firestore index for groupActivityFeed (groupId ASC, createdAt DESC)

Tasks:
1. Add to functions/src/memberActivitySummaries.ts:
   - Read challengeType, startDate, endDate from the challenge doc (already fetched in the function)
   - Denormalize these into the groupActivityFeed write at functions/src/memberActivitySummaries.ts line 186
   - Also denormalize userPhotoURL from the user record if available

2. Extend GroupActivityFeedSummary in src/types/index.ts:
   - Add: challengeType?: 'collective' | 'competitive' | 'streak'
   - Add: challengeStartDate?: string
   - Add: challengeEndDate?: string
   - Add: userPhotoURL?: string

3. Add missing Firestore indexes to firestore.indexes.json:
   - groupActivityFeed: (groupId ASC, createdAt DESC)
   - Verify wellnessLogs: (groupId ASC, loggedAt DESC) — currently missing

4. Also switch useGroupFeed() in src/hooks/useGroupInsights.ts to call
   memberActivitySummaryService.getGroupFeed() instead of groupInsightsService.getGroupFeed()
   — this reduces feed queries from 6+ to 1

5. Create guard script: scripts/testGroupFeedDataModelGuards.ts
   - Assert GroupActivityFeedSummary has challengeType, challengeEndDate, challengeStartDate, userPhotoURL fields
   - Assert memberActivitySummaryService.getGroupFeed() reads from groupActivityFeed collection
   - Assert useGroupFeed() uses memberActivitySummaryService (not groupInsightsService)

Run: npx tsc --noEmit && npm run build
Create: docs/superpowers/reports/2026-07-06-phase-19A-1-feed-data-model.md

Constraints:
- Do not modify GroupFeedScreen.tsx UI yet
- Do not add social engagement infrastructure yet
- Do not change Firestore security rules
- Only touch: functions/src/memberActivitySummaries.ts, src/types/index.ts, src/hooks/useGroupInsights.ts, firestore.indexes.json
```
