# TIIZI-PFD-ACTIVITY-VISIBILITY-003 — Founder UX Acceptance and Engineering Handover

**Authority:** Founder acceptance, 2026-11-09
**Status:** UX ACCEPTED — CONNECTED IMPLEMENTATION PENDING
**Scope:** Preservation of the frontend Founder preview and planning handover only. No backend implementation, merge, or deployment is authorized by this record.

## 1. Source and preservation

- Accepted V2 source baseline: `2476c9fe5ac62d888fd0fcbc02e2dc3a8fc2b384`.
- Preservation branch: `codex/tiizi-pfd-activity-visibility-003`.
- The Founder preview was isolated at the exact baseline SHA in `/Users/theo/.codex/worktrees/activity-visibility-preview-001/tiizi_revamp`. Its four uncommitted frontend prototype changes were retained. This record is committed with them; see the commit containing this file for the exact preserved head SHA.
- `npm run preview:founder` was running against this worktree at `http://127.0.0.1:65291/v2/today` during the accepted walkthrough. It used the existing loopback-only API, Auth Emulator, and disposable PostgreSQL fixture. No production service was used.
- The read-only PRG-01 collector observed exact HEAD `2476c9fe…`, detached state, and only the four prototype files modified/untracked. Its cached `origin/main` (`3de78e4e…`) was 22 commits behind and remote freshness was unknown; that cache was not used as the accepted source.
- PR #150 (`3aa0147d…`), PR #162 (`22add9ea…`), and PR #163 (`3e8c663f…`) are open and unmerged. Their heads are ancestors of the accepted baseline; #163 is stacked on #162. Their worktrees and the separate accepted baseline worktree were not modified.

## 2. Founder-approved experience

The Founder accepts the placement, structure, and interaction patterns shown in the TIIZI-PFD-ACTIVITY-VISIBILITY-002 walkthrough:

1. Today — **Your activity today** personal timeline.
2. Challenge detail — participant count.
3. Challenge detail — Challenge Feed section.
4. Activity Logging confirmation — **Share to Challenge** or **Keep private**, with a permitted-fields preview.

The existing connected Activity Logging experience remains accepted. Existing V2 Today, Challenge progress, Group, onboarding, Challenge creation, and Activity Logging behavior remain the product baseline.

Acceptance of the presented UX does not mark its new visibility capabilities as connected or production-ready, and does not authorize backend implementation. The preserved additions are a frontend-only preview guarded for development mode.

## 3. Capability status

| Capability | Status and authority |
|---|---|
| Activity logging, accepted submission, and Challenge progress | Existing connected V2 capability; accepted by Founder. The walkthrough submitted a local preview Activity through this existing path. |
| Today “Your activity today” history | UX accepted. The displayed Activity, Streak, Challenge-join, and Group-join records are fictional preview data. No personal history read API is present; history needs separate read authority and an authorized owner-only read contract. |
| Challenge participant count | UX accepted. Displayed preview counts are fictional sample counts, not connected participant reads. Existing Challenge detail/hosted surfaces have some server-derived participation counts; a consistent member-facing count read and its permission/definition must be confirmed before reuse or extension. |
| Challenge Feed | UX accepted. The walkthrough cards are fictional. CF-01 v0.2 is effective product truth for the Challenge-local Feed, but its status explicitly says implementation is not authorized. It must have its own publication/read authority; Group Feed storage and APIs are separate and unchanged. |
| Optional Share to Challenge | UX accepted. The prototype choice and permitted-fields preview are local UI state only; there is no working Publish action, publication, or persistence. CF-01 §6.1 requires explicit preview, self-only fields, private by default, and withdrawal without changing the underlying Activity. |
| External sharing, Share-to-Group, Kudos, and announcements | Not part of this accepted prototype. CF-01 external share is out of scope; this record does not authorize new engagement or Group Feed functionality. |

Fictional preview records and counts are visibly labelled `SAMPLE DATA · FICTIONAL PREVIEW`. The Feed explicitly says private Activity is absent unless its owner shares it. The prototype does not create an alternate source of Activity, Challenge, Group, Feed, or Recognition truth.

## 4. Engineering-readiness packages — planning only

These are proposed bounded packages, not implementation authorization. Each requires the normal Technical Lead/Founder scope and authorization gate before engineering begins.

### H1 — Personal Activity history authority

- Establish the separate authorization for a member to read their own accepted Activity records; do not infer broad community read access from Challenge progress or Feed visibility.
- Assess canonical accepted records (including Challenge Activity records) and any authorized join/membership event sources. The current API explicitly has no member Activity-history route (`api/src/app.ts`); Today’s timeline is not backed by a personal event/history query.
- Define owner identity binding, ordering, pagination, retention/deletion behavior, and which events belong on Today. Keep performed/occurred time distinct from record/acceptance time when both are available.
- Acceptance: only the signed-in owner can read their personal history; unauthorized cross-member reads are denied; newest-first ordering and timestamp semantics are verified; source Challenge/Group links resolve only where the viewer is authorized.

### P1 — Participant count read and visibility

- Inventory existing server-derived counts before adding any read path. Do not expose a count by summing client-visible rows or participation episodes without defining member-versus-episode semantics.
- Obtain or confirm the count definition (for example, active distinct participants versus all participation episodes), visibility for discoverable/non-member views, and behavior after exit/rejoin.
- Acceptance: Together, Race, and Streak show the authorized count; counts reconcile with canonical participation; Race/Together contributor and standings presentation stays intact; Streak remains without a leaderboard or accidental member roster.

### CF-2/CF-3/CF-4 — Challenge Feed authority, read, and experience

- CF-01 v0.2 governs the separate Challenge-local Feed. Its effective automatic families are A1–A6; explicit share families are S1–S3 subject to the unresolved Streak schedule. Entries cannot create or alter Challenge Truth; publication must be server-derived/idempotent; Group Feed is never read or reused.
- CF-01 explicitly states CF-2 and later implementation packages are not authorized. Obtain separate Founder authorization before implementation. Resolve the CF-01 open details before affected components: Kudos-able item set; qualifying distinct Challenge-admin/announcement-author rule and announcement text bound; persistence/idempotency design; API response shape; placement/layout; and Streak S2 milestone schedule before implementing S2.
- The CF-01 acceptance dependencies include current authorized Group membership and Challenge visibility rechecked on every read, member display-name projection (MC-4) for name-bearing events, and BG-1 publication/retention processing for production. Operator suppression/takedown is required before CF-5 completion. Migration 025 remains Group-Feed-specific and unchanged.
- Acceptance: event allow-list, audience/visibility recheck, retention (Challenge lifetime plus 90 days), newest-first signed Challenge-bound cursor paging, idempotency, and suppression are covered; explicit Shares show only permitted fields; the existing Group Feed invariant remains unchanged; no Feed item changes progress, scoring, results, ranking, or Recognition.

### S1 — Explicit Share publication and withdrawal

- Keep logging success independent of sharing. Add a server-authorized explicit action only after separate authorization; preview the member’s own accepted Activity name, accepted value, unit, and display name. Exclude notes, evidence, location, raw metadata, exact routine time, points, and other members’ data.
- Default to private; enforce one active Share per member/source item; allow the sharer to withdraw/hide the Feed item without changing Activity evidence or progress. Do not add external sharing or Share-to-Group under this package.
- Acceptance: private by default; no automatic Share; preview matches the published fields; no duplicate active Share; withdrawal removes visibility under the current audience predicate while preserving the accepted Activity and progress; unauthorized and cross-member Share/withdraw attempts fail.

## 5. Remaining Founder/product decisions

The UX acceptance in this record does not resolve these product/authorization details:

- Personal history’s final event inventory, retention, and whether Today entries link to related entities under the same authorization predicate.
- The exact participant-count definition and which viewers may see it.
- CF-01’s listed proposed details and the qualifying Streak S2 milestone schedule. The existing Challenge-local placement is accepted for this prototype; any materially different final Feed scope still follows CF-01 and separate authorization.
- Whether the accepted Share flow should offer publishing immediately after submission, from an existing Activity later, or both; any such connected behavior still needs the authorized withdrawal and audience rules above.

No unresolved choice is silently assigned a new product rule here.

## 6. Verification and handover boundary

- `npm run build`: passed on the preserved frontend changes; existing Browserslist, mixed static/dynamic import, and large-chunk warnings were emitted.
- `npm run test:v2-dom`: attempted but Vite could not start because it received `EPERM` writing a temporary config bundle beside `vite.config.ts` in the managed worktree. No DOM test assertions ran.
- Browser walkthrough: Today timeline, Race sample count/Feed, and accepted local Activity submission with local-only Share preview were observed. Together/Streak sample participant counts are type-conditioned in the preview component; no real counts or Feed events were read. The Activity submission updated only the disposable local preview fixture.
- No backend, schema, API, engine, Recognition, or Group Feed implementation was performed. No merge or deployment was performed.

**Next boundary:** preserve for review and plan authorization only. Stop before backend implementation until Founder scope and required authority are explicitly approved.
