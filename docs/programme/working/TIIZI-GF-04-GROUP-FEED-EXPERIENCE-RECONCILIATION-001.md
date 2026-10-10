# TIIZI GF-04 Group Feed Experience — Reconciliation 001

**Status:** GF-04 RECONCILIATION 001 — COMPLETE / FOUNDER ACCEPTED / MERGED / CLOSED. PR #88; accepted head `d5ade7d750986cc94ef8390c1d7f646b53a36428`; merge commit `08e5f6571f5519ed943f43f72002b22111a02a80`.

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

## Founder acceptance (2026-10-10)

**Acceptance-stage status (superseded by Final closure below):** FOUNDER ACCEPTED / READY TO MERGE.

**Accepted implementation head:** `f3628ef581950a4e2954228b8430d817c4382210` (PR #88, branch `reconcile/gf-04-group-feed-experience-001`; direct descendant of the R1-reviewed head `627b033fa44a5854d811324a4465d3d51f39be2d` via `6573fd1` and `f3628ef`). Repository CI: SUCCESS.

### Review chain
- **R1:** PASS WITH NON-BLOCKING NOTES.
- **NB-1** (expired cursor on any full-Feed refetch): corrected in R1.
- **NB-2** (canonical Group detail key): corrected in R1.
- **NB-3** (temporary full-screen "Refreshing Group activity…"): corrected through Founder follow-up 001. The Feed is replaced only on first load with no cache; background/manual refresh and Challenge return keep cached pages visible, Refresh refetches in place with an inline "Refreshing…" state, scroll position is restored, and bounded `invalid_cursor` recovery and 404 handling are unchanged.
- **Founder actionability correction:** the hosted Challenge card offered "Log activity" for any active participation. It now composes the same canonical gates as Challenge Detail (served status `active` and live end state): Finished shows no Log activity; ended/non-finalized reads "View" (never "View results"); finalized reads "View results"; running eligible Challenges keep "Log activity". Today and the Challenges list were checked and did not share the defect.

### Founder acceptance evidence
1. Group Home placement: Hosted Challenges → Group activity → Members.
2. Compact 3-event Group activity preview with authorized presentation only.
3. Four-event contract: `challenge_established`, `challenge_started`, `together_goal_achieved`, `challenge_ended`.
4. Real Together goal-crossing: Summit Steps Together crossed its goal through the accepted activity flow, producing `together_goal_achieved` and `challenge_ended`. The existing local feed processor (`feed:process`) was required because no scheduler is deployed. This is DEVELOPMENT/local proof only; no production automation exists.
5. Ordinary activity logging does not create Group Feed events.
6. Finished Challenge actionability and Challenge Detail logging closure as above.
7. Feed refresh correction as above.
8. Mobile-only member shell intact at wide viewport (bottom Today / Challenges / Groups navigation, no desktop navigation).
9. The temporary synthetic GF-04 fixture was removed; legitimate Founder-generated preview activity and resulting canonical state were preserved.

### Boundaries
No deployment, no production access, no scheduler deployed, no GF-01 / GF-02 / GF-03 change, no migration 025 change, no migration 026, no Product Truth change. PR #77 remains OPEN / DRAFT / UNMERGED / SUPERSEDED BY ACCEPTED PR #88 and is not closed.

### Migration 025 follow-up
**NON-BLOCKING FOR GF-04 / MUST BE RECONCILED BEFORE MIGRATION 025 DEPLOYMENT.** See "Known gap" above; the storage CHECK constraints remain a historical superset of GF-01 v1.1 and migration 025 is NOT deployed.

## Final closure (2026-10-10)

**Final disposition:** GF-04 RECONCILIATION 001 — COMPLETE / FOUNDER ACCEPTED / MERGED / CLOSED.

| Item | Value |
| --- | --- |
| Pull request | #88 (`reconcile/gf-04-group-feed-experience-001`) |
| Accepted source head | `d5ade7d750986cc94ef8390c1d7f646b53a36428` |
| Accepted implementation head | `f3628ef581950a4e2954228b8430d817c4382210` |
| Merge commit (main) | `08e5f6571f5519ed943f43f72002b22111a02a80` |
| Founder acceptance | 2026-10-10 |
| Repository CI | Green (Cloudflare Workers Builds is the external, non-gating check) |
| Deployment / production access | None |
| Scheduler | None deployed; the Together-goal publication evidence is DEVELOPMENT/local only and used the existing local feed processor |

### PR #77 supersession
PR #77 (`impl/gf-04-group-feed-experience-001`, head `ee18e629616c3a136ecd069cae5208871348ee09`) was historical implementation source only. Its five-family implementation is stale, it **MUST NOT be merged**, and the canonical implementation is PR #88 / main. It is not modified or closed by this record.

### Migration 025 follow-up (unchanged in substance)
**NON-BLOCKING FOR GF-04 / MUST BE RECONCILED BEFORE MIGRATION 025 DEPLOYMENT.** Migration 025 is unchanged, no migration 026 exists, and migration 025 is NOT deployed.

### Boundaries
Documentation-only closure. No application, migration, Product Truth or deployment change. The next product capability is not begun.
