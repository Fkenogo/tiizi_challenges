# Phase 19A-5 — Feed Comments + Replies

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## Files Modified

| File | Change |
|---|---|
| `src/services/feedCommentService.ts` | **New** — comment/reply CRUD service |
| `src/hooks/useFeedComments.ts` | **New** — `useFeedComments` + `useCommentReplies` hooks |
| `src/features/Groups/FeedCommentSection.tsx` | **New** — inline comment panel component |
| `src/features/Groups/FeedCard.tsx` | Re-added MessageSquare Reply button; added `showComments` toggle state; renders `FeedCommentSection` when open |
| `firestore.rules` | Tightened reaction reads; added `canReadFeedItem()` helper; added comments + replies subcollection rules |
| `scripts/testGroupFeedCommentsGuards.ts` | **New** — 20 guard assertions |

**Not modified:** Cloud Functions, `src/types/index.ts`, `firestore.indexes.json`, other screens, other guards

---

## Data Model

```
groupActivityFeed/{feedItemId}/comments/{commentId}
{
  feedItemId: string,
  groupId: string,
  userId: string,          // doc writer; enforced by rules
  authorName: string,      // denormalized from Firebase Auth
  authorPhotoURL?: string,
  text: string,            // max 500 chars
  replyCount: number,      // set to 0 on create; not auto-incremented (MVP)
  createdAt: Timestamp,
  updatedAt: Timestamp,
}

groupActivityFeed/{feedItemId}/comments/{commentId}/replies/{replyId}
{
  feedItemId: string,
  commentId: string,
  groupId: string,
  userId: string,
  authorName: string,
  authorPhotoURL?: string,
  text: string,            // max 500 chars
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

---

## Code Diff Summary

### `src/services/feedCommentService.ts`

- `MAX_COMMENT_LENGTH = 500` — exported constant used in service validation and UI
- All writes call `text.trim()` and throw if empty or over limit
- `addComment` / `addReply` use `addDoc` (auto-ID); `deleteOwnComment` / `deleteOwnReply` use `deleteDoc`
- Firestore rules enforce the same constraints server-side

### `src/hooks/useFeedComments.ts`

- `useFeedComments(feedItemId)` — `useQuery` for comment list (staleTime: 30s); `addComment` + `deleteComment` mutations, both invalidate query on success
- `useCommentReplies(feedItemId, commentId, enabled)` — same pattern; `enabled: false` when reply thread is closed (lazy fetch)

### `src/features/Groups/FeedCommentSection.tsx`

Components:
- `CommentInput` — textarea with `maxLength={500}`, real-time char counter below 50 remaining, Enter-to-submit (Shift+Enter = newline), Post button disabled when empty or pending
- `CommentAvatar` — photo URL or initials fallback, 32px
- `ReplyRow` — renders a single reply; Trash2 delete button for own replies
- `CommentRow` — renders comment + reply toggle; `useCommentReplies` with `enabled={showReplies}`; reply input shown when thread is open
- `FeedCommentSection` — root component; renders loading/empty state, comment list, comment input; shows "Join group to comment" for non-members

### `src/features/Groups/FeedCard.tsx`

```tsx
const [showComments, setShowComments] = useState(false);

// In social actions bar (added alongside reaction buttons):
<button onClick={() => setShowComments(v => !v)} aria-expanded={showComments}>
  <MessageSquare size={14} /> Reply
</button>

// Below social bar (conditional):
{showComments && (
  <FeedCommentSection feedItemId={item.id} groupId={item.groupId} canEngage={canEngage} />
)}
```

### `firestore.rules` — changes

**New helper:**
```
function canReadFeedItem(feedItemId) {
  let feedItem = get(/databases/(default)/documents/groupActivityFeed/$(feedItemId));
  return isGroupMember(feedItem.data.groupId)
      || isPublicGroup(feedItem.data.groupId)
      || canAccessAdmin();
}
```

**Reaction read — tightened (Phase 19A-4 → 19A-5):**
```
// Was:  allow read: if isAuthenticated();
// Now:  allow read: if isAuthenticated() && canReadFeedItem(feedItemId);
```

**Reaction delete — tightened:**
```
// Added resource.data.userId == request.auth.uid belt-and-suspenders check
allow delete: if isAuthenticated()
              && request.auth.uid == reactionUserId
              && resource.data.userId == request.auth.uid;
```

**New comments rules:**
```
match /comments/{commentId} {
  allow read: if isAuthenticated() && canReadFeedItem(feedItemId);
  allow create: if isAuthenticated()
                && request.resource.data.userId == request.auth.uid
                && isGroupMember(request.resource.data.groupId)
                && request.resource.data.text is string
                && request.resource.data.text.size() > 0
                && request.resource.data.text.size() <= 500;
  allow update: if isAuthenticated()
                && resource.data.userId == request.auth.uid
                && request.resource.data.text is string
                && request.resource.data.text.size() > 0
                && request.resource.data.text.size() <= 500
                && request.resource.data.userId == resource.data.userId;
  allow delete: if isAuthenticated() && resource.data.userId == request.auth.uid;

  match /replies/{replyId} { /* same pattern */ }
}
```

---

## Commands Executed

```bash
npx tsx scripts/testGroupFeedCommentsGuards.ts    # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedReactionsGuards.ts   # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedLiveStatsGuards.ts   # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedCardUiGuards.ts      # ✅ 15 assertions passed
npx tsc --noEmit                                  # ✅ 0 errors
npm run build                                     # ✅ built in 3.51s
```

`firebase deploy --only firestore:rules` — **not run** (deploy constraint). Must be run by operator.

---

## Dependencies Added

None. `Trash2` is from `lucide-react` (already a project dependency).

---

## Rules Changes Summary

| Change | Reason |
|---|---|
| Added `canReadFeedItem(feedItemId)` helper | Reusable group-membership check for subcollection reads |
| Reaction reads: `isAuthenticated()` → `canReadFeedItem()` | Tighten from Phase 19A-4 — was too broad |
| Reaction delete: added `resource.data.userId == request.auth.uid` | Belt-and-suspenders ownership check |
| Comments create: `isGroupMember + text size(0..500)` | Members-only, length-bounded |
| Comments update: `resource.data.userId check + no userId mutation` | Owner-only, prevents hijacking |
| Replies: same pattern as comments | Consistent subcollection policy |

---

## Risks / Limitations

1. **`canReadFeedItem` costs 1 extra read per rules evaluation** — Every reaction/comment/reply read triggers a `get()` on the parent feed item doc. For a feed card with 3 open reactions + 5 comments + 2 replies, that's ~10 parent doc reads at rule evaluation time. Acceptable at MVP scale; if read costs become significant, pre-denormalize `groupId` into each subcollection doc and use `isGroupMember(resource.data.groupId)` directly instead of `get()`.

2. **`replyCount` field not auto-incremented** — Set to 0 on create and never updated by the client (would require a transaction). The reply button shows "Reply" until thread is opened, then shows actual count from loaded data. A Cloud Function trigger on `replies/{replyId}` create/delete could maintain this counter for future use.

3. **`commentCount` not shown on collapsed card** — No aggregate count is stored on the feed item doc. Count is visible only after opening the panel. Adding a count would require either a Cloud Function trigger or a client-side transaction (risky for MVP).

4. **`authorName` not server-validated against Firebase Auth** — Firestore rules verify `userId == auth.uid` but cannot verify that `authorName` matches the user's display name without an expensive `get(/users/...)` call per write. A malicious client could submit any `authorName` value for their own userId. Acceptable for MVP — mitigate later with a Cloud Function that normalizes `authorName` post-write.

5. **No pagination on comments or replies** — `getDocs` fetches all comments/replies for a feed item. For items with many comments this will be slow. Add `limit(20)` + cursor-based pagination in a future phase.

6. **Deploy gate** — Tightened reaction read rules will deny existing reaction reads in production until `firebase deploy --only firestore:rules` is executed.

---

## Rollback Instructions

1. Revert `FeedCard.tsx` — remove `showComments` state, remove Reply button, remove `FeedCommentSection` import and usage.
2. Delete `src/features/Groups/FeedCommentSection.tsx`.
3. Delete `src/services/feedCommentService.ts`.
4. Delete `src/hooks/useFeedComments.ts`.
5. Revert `firestore.rules` — remove `canReadFeedItem()` helper; revert reaction read back to `isAuthenticated()`; revert reaction delete to remove `resource.data.userId` check; remove comments and replies match blocks.

---

## Manual QA Checklist

### Comment panel
- [ ] Feed card shows Reply button
- [ ] Tapping Reply opens comment panel inline below the card
- [ ] Tapping Reply again closes the panel
- [ ] Panel shows "No comments yet. Be the first!" when empty
- [ ] Panel shows loading spinner while fetching

### Adding comments — member
- [ ] Comment input is visible and enabled for group members
- [ ] Pressing Enter (without Shift) submits the comment
- [ ] Pressing Post button submits the comment
- [ ] Empty input: Post button is disabled (cannot submit)
- [ ] After submit: comment appears in list, input clears
- [ ] Character counter appears when within 50 chars of limit
- [ ] Cannot submit a comment over 500 characters

### Comment ownership
- [ ] Own comments show trash icon
- [ ] Tapping trash removes the comment from list
- [ ] Other users' comments have no delete control

### Replies
- [ ] Each comment shows Reply link below it
- [ ] Tapping Reply link expands reply thread for that comment only
- [ ] Reply input visible when thread is open (group members only)
- [ ] Replies display with author name, avatar, timestamp
- [ ] Own replies show trash icon
- [ ] Tapping trash removes the reply

### Non-member view
- [ ] Comment panel opens when Reply tapped
- [ ] Existing comments visible
- [ ] "Join group to comment" message shown instead of input
- [ ] Reply inputs within threads are hidden for non-members

### Persistence
- [ ] Comments survive page reload
- [ ] Reaction reads still work after new rules deploy (tightened from 19A-4)
