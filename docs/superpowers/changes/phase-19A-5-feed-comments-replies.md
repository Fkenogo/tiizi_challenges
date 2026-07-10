# Phase 19A-5 — Feed Comments + Replies — Changelog

**Date:** 2026-07-07

## Summary

Implemented inline comments and threaded replies on group feed cards. Reply button on each card toggles an inline panel. Group members can add/delete own comments and replies. Non-members can read but not write. Reaction reads were tightened from Phase 19A-4 (now follow parent feed item access, not bare `isAuthenticated()`).

## New Files

- `src/services/feedCommentService.ts` — `getComments`, `addComment`, `deleteOwnComment`, `getReplies`, `addReply`, `deleteOwnReply`; `MAX_COMMENT_LENGTH = 500`
- `src/hooks/useFeedComments.ts` — `useFeedComments(feedItemId)` + `useCommentReplies(feedItemId, commentId, enabled)`
- `src/features/Groups/FeedCommentSection.tsx` — inline comment panel with nested reply threads
- `scripts/testGroupFeedCommentsGuards.ts` — 20 guard assertions
- `docs/superpowers/reports/2026-07-07-phase-19A-5-feed-comments-replies.md`

## Modified Files

- `src/features/Groups/FeedCard.tsx` — Reply button restores MessageSquare; `showComments` toggle state; `FeedCommentSection` renders when open
- `firestore.rules` — `canReadFeedItem()` helper; tightened reaction reads/deletes; comments + replies subcollection rules

## Key Behaviours

| Feature | Behaviour |
|---|---|
| Reply button | Toggles inline comment panel per-card |
| Empty submit | Blocked — Post button disabled |
| Max length | 500 chars; counter shown at <50 remaining |
| Delete | Trash icon on own comments/replies only |
| Reply threads | Lazy-loaded per comment on toggle |
| Non-members | Can view, cannot write |
| `commentCount` | Not shown on collapsed card (loaded on open) |

## Deploy Note

`firebase deploy --only firestore:rules` required. Tightened reaction read rules will deny existing reaction reads in production until deployed.
