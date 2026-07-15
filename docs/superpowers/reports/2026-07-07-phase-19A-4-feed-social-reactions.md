# Phase 19A-4 — Feed Social Reactions

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## Files Modified

| File | Change |
|---|---|
| `src/services/feedReactionService.ts` | **New** — read/write service for reactions subcollection |
| `src/hooks/useFeedReactions.ts` | **New** — React Query hook with set/clear mutations |
| `src/features/Groups/FeedCard.tsx` | Replaced placeholder buttons with Like/Applaud/Inspired reaction buttons; added `reactionSummary`, `onSetReaction`, `onClearReaction` props |
| `src/features/Groups/GroupFeedScreen.tsx` | Calls `useFeedReactions`; passes reaction summary + handlers to each `FeedCard` |
| `firestore.rules` | Added `groupActivityFeed/{feedItemId}` read rule + `reactions/{reactionUserId}` subcollection rules |
| `scripts/testGroupFeedReactionsGuards.ts` | **New** — 20 guard assertions |
| `scripts/testGroupFeedCardUiGuards.ts` | Updated stale Reply assertion (Reply is Phase 19A-5) |

**Not modified:** Cloud Functions, any Firestore collections, `src/types/index.ts`, other screens

---

## Data Model

```
groupActivityFeed/{feedItemId}/reactions/{userId}
{
  feedItemId: string,
  groupId: string,
  userId: string,
  reactionType: 'like' | 'applaud' | 'inspired',
  updatedAt: Timestamp,   // serverTimestamp on create/update
}
```

- Subcollection of `groupActivityFeed` — co-located with the feed item
- `userId` is the document ID — enforces one active reaction per user per feed item
- Toggling reaction type: `setDoc(..., { reactionType: 'inspired' }, { merge: true })` — overwrites previous type
- Clearing reaction: `deleteDoc(...)` — removes doc entirely

---

## Code Diff Summary

### `src/services/feedReactionService.ts`

- `getReactionSummaries(feedItemIds[], currentUserId)` — parallel `getDocs` per feed item; returns `Map<feedItemId, { counts, userReaction }>`
- `setReaction(feedItemId, groupId, userId, reactionType)` — `setDoc` with merge (idempotent upsert)
- `clearReaction(feedItemId, userId)` — `deleteDoc`

### `src/hooks/useFeedReactions.ts`

- `useQuery` with `staleTime: 30s` — reads summaries for all visible feed items
- `setReaction` mutation — invalidates query on success
- `clearReaction` mutation — invalidates query on success

### `src/features/Groups/FeedCard.tsx`

Replaced:
```tsx
<button disabled={!canEngage} aria-label="Applaud"><ThumbsUp /> Applaud</button>
<button disabled={!canEngage} aria-label="Reply"><MessageSquare /> Reply</button>
```

With:
```tsx
{REACTION_CONFIG.map(({ type, label, icon: Icon }) => {
  const count = reactionSummary?.counts[type] ?? 0;
  const active = reactionSummary?.userReaction === type;
  return (
    <button
      key={type}
      disabled={!canEngage}
      aria-pressed={active}
      className={active ? 'text-primary' : 'text-[#4c627e]'}
      onClick={() => active ? onClearReaction?.() : onSetReaction?.(type)}
    >
      <Icon size={14} className={active ? 'fill-primary' : ''} />
      {count > 0 ? count : label}
    </button>
  );
})}
```

`REACTION_CONFIG` = `[{ type: 'like', icon: Heart }, { type: 'applaud', icon: ThumbsUp }, { type: 'inspired', icon: Sparkles }]`

### `firestore.rules`

Added at the end of the `match /databases/{database}/documents` block:

```
match /groupActivityFeed/{feedItemId} {
  allow read: if isAuthenticated()
              && (isGroupMember(resource.data.groupId) || isPublicGroup(resource.data.groupId) || canAccessAdmin());
  allow create, update, delete: if false;  // written only by Cloud Functions

  match /reactions/{reactionUserId} {
    allow read: if isAuthenticated();
    allow create, update: if isAuthenticated()
                          && request.auth.uid == reactionUserId
                          && request.resource.data.userId == request.auth.uid
                          && isGroupMember(request.resource.data.groupId);
    allow delete: if isAuthenticated() && request.auth.uid == reactionUserId;
  }
}
```

---

## Commands Executed

```bash
npx tsx scripts/testGroupFeedReactionsGuards.ts   # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedLiveStatsGuards.ts    # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedCardUiGuards.ts       # ✅ 15 assertions passed
npx tsc --noEmit                                   # ✅ 0 errors
npm run build                                      # ✅ built in 3.21s
```

`firebase deploy --only firestore:rules` — **not run** (deploy constraint). Must be run by operator before reactions will work in production.

---

## Dependencies Added

None. `Heart`, `Sparkles` are from `lucide-react` (already a project dependency, v0.468.0).

---

## Rules Changes

Added `groupActivityFeed` top-level read rule. Previously this collection had no explicit read rule (default deny) — this was a latent bug; the feed hook worked only because Cloud Function writes bypass rules. Client-side reads now have an explicit allow.

Added `reactions/{reactionUserId}` subcollection rules:
- Reads: any authenticated user
- Create/update: own doc only (`auth.uid == reactionUserId`), must be a group member
- Delete: own doc only

---

## Risks / Limitations

1. **Read cost scales with feed size** — `getReactionSummaries` runs one `getDocs` per feed item. For 20 feed items: 20 subcollection reads on every feed load. Acceptable at MVP feed sizes. If feed grows beyond ~50 items, consider pre-aggregating counts into the feed item doc via Cloud Function trigger.

2. **No optimistic update** — Reaction counts refresh only after the mutation succeeds and `invalidateQueries` fires. On slow connections there is a brief delay between tap and count update. Optimistic update pattern can be added later without schema changes.

3. **`groupActivityFeed` read rule is new** — Before this phase, client reads of `groupActivityFeed` had no matching rule (implicit deny). The feed hook was only working because the Cloud Function service account bypasses rules. This phase adds the explicit `isGroupMember || isPublicGroup` read gate, which is correct. Verify existing feed behaviour is unchanged after deploying the new rules.

4. **Reply / comments deferred** — Phase 19A-5. No `feedReplies` or `feedComments` collection was created.

---

## Rollback Instructions

1. Revert `FeedCard.tsx` — restore original `<ThumbsUp> Applaud` and `<MessageSquare> Reply` placeholder buttons; remove `reactionSummary`, `onSetReaction`, `onClearReaction` props.
2. Delete `src/services/feedReactionService.ts`.
3. Delete `src/hooks/useFeedReactions.ts`.
4. Revert `GroupFeedScreen.tsx` — remove `useFeedReactions` import and call; remove reaction props from `<FeedCard>`.
5. Revert `firestore.rules` — remove the `groupActivityFeed` match block (both parent and subcollection rules).
6. Restore the Reply assertion in `scripts/testGroupFeedCardUiGuards.ts`.

---

## Manual QA Checklist

### Reactions — member view
- [ ] Feed card shows Like, Applaud, Inspired buttons (enabled)
- [ ] Tapping Like: button turns orange, icon fills, count increments
- [ ] Tapping the same reaction again: button returns to default, count decrements (toggle/clear)
- [ ] Tapping a different reaction while one is active: switches active reaction, count updates
- [ ] Count shows as number when ≥1, label text ("Like") when 0

### Reactions — non-member / public group view
- [ ] Like, Applaud, Inspired buttons are visible but disabled (greyed out)
- [ ] Tapping disabled buttons does nothing

### Share
- [ ] Mobile: tapping Share opens native share sheet
- [ ] Desktop: tapping Share copies text to clipboard (no error)

### Persistence
- [ ] Reaction survives page reload (stored in Firestore subcollection)
- [ ] Reaction from User A visible to User B within 30s (staleTime window)

### Feed items with no reactions
- [ ] Buttons show labels ("Like", "Applaud", "Inspired") not zero counts
- [ ] No crash or empty count display
