# TIIZI GF-04 — Group Feed Experience Assembly

**Status:** GF-04 IMPLEMENTED / R1 TECHNICALLY ACCEPTED / AWAITING FOUNDER MOBILE PREVIEW
**Review classification:** R1 — targeted technical review — PASS (2026-10-06)
**Canonical base:** `fec8706c6985a9668ad9226868c56d0d90693876`
**Branch:** `impl/gf-04-group-feed-experience-001`
**Founder authorization:** GF-04 implementation authorization in the task record, 2026-10-05
**Product authority:** GF-01 effective; GF-03 accepted and merged
**External review authority:** [FEF-EWPCS-001-AMD-001 — Development Preview and Proportionate Review](https://github.com/Fkenogo/founder-engineering-framework/blob/main/docs/engineering/FEF-EWPCS-001-AMD-001-DEVELOPMENT-PREVIEW-AND-PROPORTIONATE-REVIEW.md), APPROVED — ACTIVE

## Scope delivered

GF-04 assembles the accepted GF-03 endpoint in the existing V2 mobile Group experience. The member/steward-only Group Home section is inserted after Hosted Challenges and before Members. Its compact preview requests `limit=3`, shows no more than three cards, uses the approved bounded empty copy, and exposes a contextual View all activity link. Feed loading and errors remain isolated from Group Home.

The full Feed route is `/v2/groups/:groupId/feed`, inside the authenticated V2 member shell and route Group scope. It requests the API-default first page of 20, passes the opaque `nextCursor` unchanged through TanStack Query, appends pages in API order with an explicit Load more activity button, and resets to page one for refresh. A subsequent `invalid_cursor` resets accumulated pages once; a 404 removes Feed cache, invalidates the Group detail read, and returns to Group Home without rendering cached Feed rows. A preview 404 also clears Feed cache and invalidates Group detail so Group Home re-proves the current relationship and visibility.

Feed query keys bind Group ID and Firebase UID. Identity changes remove the GF-04 query family; successful leave removes that Group's Feed query. Feed queries revalidate on mount and focus and hide accumulated rows during a foreground revalidation. The response adapter allows only the seven GF-03 presentation fields. Cards render the server presentation title, current Challenge title, formatted `occurredAt`, and a canonical Challenge link; no client ordering or event consolidation was added.

Challenge Detail return state is limited to a UUID-shaped Group ID and accepted only when it equals the currently loaded Challenge's authoritative Group ID. It constructs the fixed internal Feed path; all other entry paths keep their existing Back to Challenges behavior.

Time uses relative rounded minutes/hours under 24 hours, Yesterday where the viewer-local calendar makes that exact, and a viewer-local calendar date otherwise. Semantic `<time>` includes the authoritative ISO timestamp and accessible full date. Feed actions meet the 44px minimum touch target; rows and navigation have visible keyboard focus.

## Verification evidence

- **Structural/source guards:** retain coverage for Group Home placement and audience, route presence, fixed presentation fields, no social affordances, no V1 imports, and no Today integration.
- **Executable client-state proofs:** deterministic Node/tsx tests use real TanStack QueryClient instances for Group+UID cache isolation, Group leave cleanup, bounded identity/logout cleanup, 404 Feed removal and Group-detail invalidation. Pure policy tests execute the one-time invalid-cursor recovery cycle, refresh reset, fixed 404 destination, ordered page composition, and exact opaque cursor URL transport round-trip. Challenge return-path tests cover matching/mismatched/malformed Group IDs, ignored arbitrary returnTo/external values, and ordinary Challenge entry.
- Focused GF-04 structural, client-state, and time-format checks: pass after this R1 evidence correction.
- Existing S4a Group Home guards: pass after updating the old no-Feed assertion to reflect the later Founder-authorized single read surface.
- V2 experience boundary: pass.
- V2 frontend guards: pass.
- Repository boundary guard: pass.
- Root TypeScript project build and Vite production build: pass.
- `git diff --check`: pass.
- Preview install/build emitted the existing Browserslist age notice and large-chunk advisory; no build failure.

The Founder mobile preview and acceptance gate remains pending. No local fabricated data is committed as product truth.

## Files / boundaries

The implementation adds the typed API adapter, scoped query keys/hooks, preview, event row, full screen, contextual route, bounded Challenge return handling, structural guards, and executable client-state proofs. This record update changes documentation only: it records R1 TARGETED TECHNICAL REVIEW — PASS with no implementation change. GF-04 is IMPLEMENTED / R1 TECHNICALLY ACCEPTED / AWAITING FOUNDER MOBILE PREVIEW; Founder mobile preview and acceptance remain pending and are not recorded here.

No GF-01, GF-02 or GF-03 server implementation, route, query, cursor, storage, or migration was changed. Migration 025 remains NOT deployed. No Today, Kudos, Share, Recognition, posts, comments, reactions, notifications, moderation, V1 Feed, scheduler, or production deployment work occurred.

## Required R1 review

The targeted reviewer should inspect the exact pushed implementation head for:

1. GF-03 API use, query Group/UID scoping and route Group scope;
2. identity/leave cleanup, revalidation and 404/401 behavior;
3. opaque cursor pass-through, Load More, refresh and one-time invalid-cursor recovery;
4. no client sorting or ended/finalized consolidation;
5. returned-field minimization and fixed server presentation titles;
6. Group-bound Challenge navigation return state;
7. mobile touch targets, loading/empty/error states and keyboard/screen-reader affordances;
8. focused tests and explicit Today/social/backend/migration/V1 exclusions.

Escalate to R2 and stop if any server authorization, cross-Group boundary, GF-03 query/cursor or other security authority must change. This record grants no merge, migration deployment, production deployment, or later-slice authorization.

## R1 result — PASS (2026-10-06)

R1 TARGETED TECHNICAL REVIEW — PASS on the exact implementation head `e9e576aed6a8094e70cd0552323dcf17ef1eb150` (PR #77). Scope reviewed was the eight items above; no server authorization, cross-Group boundary, GF-03 query/cursor, or other security authority change was required, so no R2 escalation. No implementation change was made for this record update. Status is GF-04 IMPLEMENTED / R1 TECHNICALLY ACCEPTED / AWAITING FOUNDER MOBILE PREVIEW. Founder mobile preview and acceptance remain pending and are not recorded.
