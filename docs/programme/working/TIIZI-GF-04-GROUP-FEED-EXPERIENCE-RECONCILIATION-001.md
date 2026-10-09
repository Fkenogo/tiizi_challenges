# TIIZI GF-04 Group Feed Experience — Reconciliation 001

**Status:** IMPLEMENTED CANDIDATE / CURRENT MAIN ALIGNED / FOUR-EVENT CONTRACT ALIGNED / AWAITING FOUNDER MOBILE REVIEW. Not merged.

**Base:** `origin/main` `0893bac165ff17ce14feb27bbee6f1800cbcb2c2`. **Branch:** `reconcile/gf-04-group-feed-experience-001`.

**Historical source (not authority):** frozen PR #77 (`impl/gf-04-group-feed-experience-001`, head `ee18e629616c3a136ecd069cae5208871348ee09`), which remains OPEN / DRAFT / UNMERGED and was not modified. The earlier implementation record in that PR is stale (it describes five event families) and is intentionally not carried forward. The Master Programme is intentionally not changed here; it is reconciled separately after Founder review.

## Authority applied

GF-01 v1.1 (`docs/product-truth/TIIZI-GF-01-GROUP-FEED-EVENT-CONTRACT.md`): exactly four automatic families — `challenge_established`, `challenge_started`, `together_goal_achieved`, `challenge_ended`. Challenge finalization is Challenge-domain truth and is not Group Feed publishable. GF-02 publication authority and the GF-03 member read contract are unchanged. Current member shell: mobile-only, centered `max-w-md` canvas, header brand / bell / account, bottom Today / Challenges / Groups navigation.

## Reconciliation

| Area | Result |
| --- | --- |
| Four-event contract | Pure client module `src/api/groupFeedContract.ts` holds exactly the four families and the four GF-03 presentation titles. No finalization family exists in any GF-04 runtime, UI or test fixture. The frontend is a separate package and cannot import API source, so drift against `api/src/groupFeedPublication.ts` and the GF-03 titles is prevented by `npm run test:gf04-group-feed`. |
| Presentation | Server-supplied `presentationTitle` is rendered unchanged: "A new Challenge is available", "The Challenge has started", "The Group reached its Challenge goal", "The Challenge has ended". No result-ready presentation. |
| Group Home | Compact "Group activity" preview (3 events, "View all activity") sits after Hosted Challenges and before Members (About is a sheet); members and steward only (existing membership rule). |
| Full Feed | `/v2/groups/:groupId/feed` inside the member shell: default 20-event page, Load More, Refresh, loading / empty / error states, bounded invalid-cursor recovery, 404 handling that clears the Group's Feed cache, invalidates Group detail and returns to Group Home. |
| Challenge return | Fixed internal path only; accepted solely when the origin Group UUID matches the Challenge's Group; otherwise the ordinary Challenges back path. |
| Cache | Query keys scoped by Group and authenticated UID (shared builder, used by the screen and hook); whole Feed family cleared on identity change; the Group's Feed cleared on successful leave. |
| Pagination | Server order preserved; no client sort, no prefetch, opaque cursor never decoded. |
| Mobile shell | No responsive/desktop classes, fixed chrome or widened pages in Feed surfaces; route is a child of the member shell; shell unchanged. |

## Files

Ported with reconciliation: `src/api/groupFeedApi.ts` (now re-exports the contract), `src/api/groupFeedRequest.ts`, `src/v2/challenges/V2CreatedChallengeScreen.tsx`, `src/v2/challenges/challengeReturnPath.ts`, `src/v2/components/V2Primitives.tsx` (optional `className` on `V2Button`), `src/v2/groups/V2GroupFeedEvent.tsx`, `V2GroupFeedPreview.tsx`, `V2GroupFeedScreen.tsx` (shared query-key builder), `V2GroupHomeScreen.tsx`, `groupFeedClientPolicy.ts`, `groupFeedQueryKeys.ts`, `groupFeedTime.ts`, `useV2GroupFeed.ts`, `useV2Groups.ts`, `src/v2/routes.tsx`, `package.json` (`test:gf04-group-feed`), `scripts/testGF04GroupFeedGuards.ts`, `scripts/testS4aGroupHomeGuards.ts`.

New: `src/api/groupFeedContract.ts`; `scripts/testMobilePrimaryNavGuards.ts` gains the authorized `groups/:groupId/feed` member route.

Dropped: the PR's Master Programme edit and its stale implementation record (both superseded by current main / this record).

## Boundaries preserved

No GF-01 / GF-02 / GF-03 change, no migration change, no scheduler, Kudos, Share, Recognition, comments, posts, reactions, Today Feed or Challenge Feed. V1 not consulted. No deployment, no production access. S6 and Operator Console untouched.

## Known gap (recorded, not changed)

`api/migrations/025_group_feed_publication_authority.sql` still lists `challenge_finalized` in its storage-level event-type CHECK constraints. The application layers (GF-02 publication authority and the GF-03 read allow-list) reject it, so it cannot be published or read, but the storage constraint is wider than GF-01 v1.1. Per the task boundaries, migration 025 was not changed and no migration 026 was created; narrowing the constraint would be a separate governed change.
