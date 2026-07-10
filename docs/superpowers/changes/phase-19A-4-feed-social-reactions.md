# Phase 19A-4 — Feed Social Reactions — Changelog

**Date:** 2026-07-07

## Summary

Replaced placeholder Applaud/Reply buttons with working Like, Applaud, and Inspired reaction buttons. Reactions are stored in a Firestore subcollection (`groupActivityFeed/{id}/reactions/{userId}`). One reaction per user per feed item. Group members can react; non-members see disabled buttons. Reply/comments deferred to Phase 19A-5.

## New Files

- `src/services/feedReactionService.ts` — read/write service (getReactionSummaries, setReaction, clearReaction)
- `src/hooks/useFeedReactions.ts` — React Query hook with set/clear mutations + cache invalidation
- `scripts/testGroupFeedReactionsGuards.ts` — 20 guard assertions
- `docs/superpowers/reports/2026-07-07-phase-19A-4-feed-social-reactions.md`

## Modified Files

- `src/features/Groups/FeedCard.tsx` — Like (Heart), Applaud (ThumbsUp), Inspired (Sparkles) buttons with live counts and active highlight; accepts `reactionSummary`, `onSetReaction`, `onClearReaction` props
- `src/features/Groups/GroupFeedScreen.tsx` — calls `useFeedReactions(feedItems)`; passes reaction data + handlers to each card
- `firestore.rules` — `groupActivityFeed` read rule + `reactions/{reactionUserId}` subcollection write rules
- `scripts/testGroupFeedCardUiGuards.ts` — updated stale Reply assertion

## Reaction UX

| State | Display |
|---|---|
| No reactions yet | Label text ("Like", "Applaud", "Inspired") |
| Count ≥ 1 | Number shown instead of label |
| Current user reacted | Button and icon highlight in primary orange |
| Tap same again | Clears reaction (toggle) |
| Tap different | Switches reaction type |
| Non-member | Buttons visible, disabled |

## Deploy Note

`firebase deploy --only firestore:rules` must be run before reactions work in production.
