# TIIZI — CF-01 CHALLENGE FEED PRODUCT TRUTH / CAPABILITY DEFINITION

**Document type:** V2 Product Truth / capability definition (CF-1)
**Version:** 0.1 (draft)
**Date:** 2026-10-10
**Base:** `365c958bf69f6d79ae262e81045abae9c777c19c`
**Status:**
- **§2 amendment — EFFECTIVE by Founder direction (2026-10-10):** Tiizi includes a governed Challenge-specific Feed.
- **§3–§14 detailed contract — PROPOSED, AWAITING FOUNDER REVIEW.** Nothing below §2 is Product Truth until the Founder accepts it. Anything marked *Founder decision* is open.
- **No implementation is authorized** (CF-2…CF-6 are separate packages).
**Companion:** `docs/programme/TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md`

**V1 exclusion:** Archived V1 feed behaviour is not consulted or used (AGENTS.md §1). This definition derives from V2 Product Truth and V2 runtime only.

## 1. Authority chain and supersession

| Record | Position |
|---|---|
| Stage F T1 §P (Group Feed), §Q (Kudos), §R (Sharing); FR-V2-130, 131, 132, 134, 136, 137 | In force; govern feeds generally (Feed is never truth; Kudos never affect performance; Feed does not expand visibility) |
| FR-V2-128 as reconciled by F-E-01 ("no Challenge-specific Feed") | **SUPERSEDED by the 2026-10-10 Founder direction.** Original text retained as history |
| FR-V2-129 / FR-V2-212 | In force **for the Group Feed**. Applied to the Challenge Feed by analogy only where §6 says so (Founder decision) |
| FR-V2-133 (no comments/replies in initial V2) | **Not reopened by this record.** See §9 |
| GF-01 v1.1 / GF-02 / GF-03 / GF-04 | **Unchanged.** Group Feed has exactly four automatic families |
| Migration 025 | **Unchanged**; stays Group-Feed-specific |

## 2. Effective amendment

> **Tiizi includes a governed Challenge-specific Feed as a Challenge-local engagement surface. Its content does not create or alter Challenge Truth.**

Consequences that are part of the amendment: there is still no Home Feed; the Group Feed is unchanged; the Challenge Feed is a different capability with its own scope, storage and read model.

## 3. Invariants (proposed)

1. Exactly one Challenge Feed per Challenge. It answers "What is happening in this Challenge?"
2. It is scoped to one Challenge and is **not** a Group Feed, a Home/Today stream, or a view over the Group Feed.
3. Every entry derives from canonical PostgreSQL truth (Challenge lifecycle, participation, accepted activity, derived state, finalization) or from an explicit, validated member action (Share, Kudos) or a Steward announcement. Client-authored payloads, client timestamps and client-computed facts never create Feed truth.
4. Showing something in the Feed never makes it Challenge evidence, score, progress, completion, ranking, result or Recognition (FR-V2-130/132/134). A Feed row can be suppressed, expired or withdrawn without touching Challenge truth.
5. The Feed does not expand visibility. Current Group membership **and** current Challenge visibility are rechecked on every read for every viewer (T1 §P.8; FR-V2-136/137).
6. Minimum disclosure: no raw evidence, notes, location, exact time-of-day routine, health-like detail, email or provider ids.
7. Cards are typed, template-generated, or a validated structured Share. **No free-form posts or member captions in the first version.** Steward announcement is the only free text and is a later/SHOULD-tier item.
8. Kudos and any reaction never count toward ranking, recommendation, status or influence (T1 §Q.4).
9. Publication is server-side, transactional with the source transition where the source is a Challenge transition, idempotent by a server-owned key, and **cannot block or fail the source transaction's business outcome** beyond what the existing outbox pattern already does.

## 4. Candidate Feed moments

Legend. **Mode:** AUTO = system-published from a canonical transition; SHARE = published only after the member's explicit, previewed Share; ANN = steward-authored. **Classification:** AUTHORIZED (proposed to be allow-listed) / AUTHORIZED WITH EXPLICIT SHARE ONLY / DEFERRED / NOT APPROPRIATE. Every row is a proposal for Founder review.

| # | Moment | Classification | Mode | Actor shown | Amount / metric shown | Source of truth | Privacy implication | Persistence | Dedupe / idempotency | Retention (proposed) | Audience | Historical visibility | Duplicates Group Feed? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Accepted participant activity | **AUTHORIZED WITH EXPLICIT SHARE ONLY** | SHARE | Yes (sharer, by choice) | Sharer's own value+unit and activity name only (ceiling; *Founder decision*) | `challenge_activity_records` (accepted) | Personal/health-adjacent; never automatic (T1 §P.4 spirit) | Share row referencing the source record, not a copy of evidence | One Share per (member, source record); re-share is a no-op | See §8 | Challenge-visible members | Same as live while retained | No |
| 2 | Participant joined | **AUTHORIZED** | AUTO | Yes (display name via MC-4) | None | `challenge_participations` insert | Discloses a commitment, but participation is already visible to Challenge viewers (Together contributors, Race board). *Founder confirm* | Event row | Key = participation episode id | See §8 | Challenge-visible members | Retained per §8; not hidden on later exit | No (GF-01: join is NOT PUBLISHABLE in Group Feed) |
| 3 | Participant left | **NOT APPROPRIATE** | — | — | — | — | Reveals withdrawal/offboarding | None | — | — | — | — | No |
| 4 | Challenge started | **AUTHORIZED** | AUTO | None | None | `challenges` `establishment→active` | Low | Event row | Key = challenge + `started` | §8 | Challenge-visible | As live | **Same source transition as a Group Feed event, separate publication.** Intentional: different audience/scope |
| 5 | Together contribution / progress moments | **AUTHORIZED** (fixed percent milestones only) | AUTO | None | Percent milestone only; no per-person amounts | `challenge_derived_state` | Group total is already visible in Challenge Detail; no attribution | Event row | Key = challenge + goal version + milestone | §8 | Challenge-visible | As live | No (Group Feed has only goal-reached; GF-01 forbids other thresholds there) |
| 6 | Together goal reached | **AUTHORIZED** | AUTO | None | None (or "goal reached") | `collective_goal_reached false→true` | Low | Event row | Key = challenge + goal version | §8 | Challenge-visible | As live | **Same source transition as `together_goal_achieved`, separate publication** |
| 7 | Streak milestones | **AUTHORIZED WITH EXPLICIT SHARE ONLY** | SHARE | Yes (sharer) | Sharer's own milestone label (e.g., days) | derived/participation | Personal consistency | Share row | One per (member, milestone) | §8 | Challenge-visible | As live | No |
| 8 | Race progress moments | Rank/position change: **NOT APPROPRIATE**. Personal finish: **AUTHORIZED WITH EXPLICIT SHARE ONLY**. "First to finish" and similar: **DEFERRED / NEEDS PRODUCT TRUTH** | SHARE | Sharer | Generic finish only; no numeric rank unless Founder allows | derived / finals | Comparative pressure; popularity mechanics | Share row | Per (member, finish) | §8 | Challenge-visible | As live | No |
| 9 | Challenge ended | **AUTHORIZED** | AUTO | None | None | `challenges` `active→ended` | Low; does not imply success | Event row | Key = challenge + `ended` | §8 | Challenge-visible | As live | **Same source transition as `challenge_ended`, separate publication** |
| 10 | Finalized results | **AUTHORIZED** (card only) | AUTO | None | None in card ("Results are ready"); values live on Challenge Detail | `challenge_finalizations` | Results are shown elsewhere; card carries none | Event row | Key = challenge (exactly once) | §8 | Challenge-visible | As live | **No** — v1.1 removed this from the Group Feed and reserved it for a Challenge Feed |
| 11 | Participant result moment | **AUTHORIZED WITH EXPLICIT SHARE ONLY** | SHARE | Sharer | Sharer's own generic result (completed / finished); numeric rank only if Founder allows | `challenge_participation_finals` | Personal result | Share row | Per participation final | §8 | Challenge-visible | As live | No |
| 12 | Steward announcement | **DEFERRED / NEEDS PRODUCT TRUTH** (SHOULD-tier) | ANN | Steward role label | Text only | New authoring authority | Free text; moderation | Announcement row | Client idempotency key | §8 | Challenge-visible | As live | No (GF-01 defers Group announcements separately) |
| 13 | Kudos | See §9 | SHARE-like action on a Feed item | Kudos giver (visible to item owner only; *Founder decision*) | Aggregate count (display policy *Founder decision*) | new | Popularity risk | Kudos row | One per (giver, item), toggle | Follows item | Challenge-visible | Follows item | No |
| 14 | Comments / replies | **DEFERRED** (LATER) | — | — | — | — | Moderation | — | — | — | — | — | No |
| 15 | Recognition | **DEFERRED** (MOT-01) | SHARE | — | — | — | Credential implication | — | — | — | — | — | No |
| 16 | Challenge established | **NOT APPROPRIATE** as a Challenge Feed entry | — | — | — | — | The Challenge's own creation precedes its audience; the Challenge Detail is the record | — | — | — | — | — | (Group Feed carries it) |

**Net effect:** automatic entries are actor-free lifecycle and group-level progress moments; all personal content is explicit Share. The only auto moment with an actor is "participant joined" (row 2), flagged for Founder confirmation.

## 5. Audience, access and history (proposed)

- **Read audience:** a member who currently (a) has an `active`/`joined` membership of the Challenge's Group and (b) currently passes the Challenge visibility rule. Group Steward gets no extra read right.
- **Pending/rejected/non-member/left members:** no read. Denial indistinguishable from not-found, as in GF-01.
- **Leave Group / lose Challenge visibility:** access ends on the next read; clear client cache.
- **Participants who exited the Challenge but remain in the Group:** may still read (they retain Challenge visibility) *(Founder decision: confirm)*.
- **Ended/finalized Challenges:** feed stays readable to current audience for the retention window, so participants can revisit it.
- **Actor later deactivated/deleted:** actor shown as "Former member" (LIFE-1); their Shares and Kudos are removed or anonymized per the lifecycle decision.
- **Account deletion of an item owner:** their Share rows are withdrawn.

## 6. Explicit Share rules (proposed)

Separate affirmative act after the activity, milestone or result; default is **not** shared (T1 §R.1). Member sees a **preview** of exactly what will appear and chooses to publish to this Challenge's feed. Self-only: a member shares only their own items. No free-text caption in v1. Withdrawable by the sharer at any time (hides the item; never alters the underlying activity or results). Duplicate-share prevention by source record. Shared content respects Challenge visibility at every read. Whether FR-V2-212's "Share to Group" rule must be mirrored literally for the Challenge Feed is a *Founder decision* (recommended: yes, same pattern). External share (T1 §R.2) remains independent and out of scope.

## 7. Persistence and idempotency (proposed)

Own tables (new migration 026+; **not** `group_feed_*`): an outbox/publication record for automatic moments (Challenge id, event type, source transition id/version, server transition time, idempotency key, state), a rebuildable projection, and separate tables for Share, Kudos and announcements when those tiers are built. Persist references and minimal state, not copies of evidence or names; resolve names/titles at read time. Server-owned idempotency keys of the form (challenge, event type, source transition version) or (member, source record). A separate recorder from `recordChallengePublication`; the five existing domain write paths must not gain a second publication dependency unless CF-2 is authorized and proves it cannot fail the source transaction.

## 8. Retention, ordering, pagination (proposed)

- **Retention:** the Group Feed's 90 days is a Group Feed operating policy, not a rule for this feed. Proposed: automatic moments retained for the Challenge's life plus 90 days after it ends; Shares and Kudos follow their item; expiry removes projection only, never Challenge truth. *Founder decision.*
- **Ordering:** newest first by server-assigned source-transition (or Share) timestamp, tie-break by event UUID. Never by Kudos count or popularity.
- **Pagination:** keyset only; default 20, max 50; signed, Challenge-bound, expiring cursor — the GF-01 §7 pattern as design precedent, not authority.

## 9. Engagement layer (proposed tiers)

| Feature | Tier | Authority / who may act | Audience | Persistence | Undo / delete | Moderation / abuse | Notification dependency | Privacy |
|---|---|---|---|---|---|---|---|---|
| Explicit Share | **MUST HAVE** | Participant, own items only | Challenge-visible | Share row → source record | Sharer withdraws; hides item | Structured only, no free text, so low | None | Preview + consent; own data only |
| Kudos (single lightweight reaction) | **MUST HAVE** | Any member who can read the item; not on own item | Item visible to audience; giver identity visible to item owner only (*Founder decision*) | Kudos row; one per giver+item | Toggle off removes it | Rate limit; no counts used for ranking | None for v1 (a later notification is optional) | Counts never used for ranking/recommendation/status |
| Steward announcements | **SHOULD HAVE** | Group Accountable Steward (Challenge creator inclusion = *Founder decision*) | Challenge-visible | Announcement row with author, time | Author/steward edit and delete; edit history kept | Free text: length limit, report path, operator suppression | Optional | Steward-authored only; no member data |
| Multiple reaction types | LATER | — | — | — | — | — | — | — |
| Comments / replies | **LATER** | Would require superseding FR-V2-133 for this feed (*Founder decision FD-MC-09b*) | — | — | — | Highest moderation cost | Needed to be useful | — |
| Notifications for feed activity | LATER | Notifications is currently a placeholder | — | — | — | — | — | — |

Engagement actions must not modify evidence, score, progress, results or Recognition truth.

## 10. Moderation and takedown (proposed)

Automatic moments are template-typed. Share is structured. Kudos is a toggle. Therefore the first version needs no general social-content moderation. It does need the same narrow **projection-suppression** capability GF-01 §9 describes (an attributable system/operator action that hides a Feed row without changing source truth) and, for announcements, report/remove.

## 11. Read model and API (proposed, for CF-3)

A Challenge-scoped read under the canonical API prefix (client composed via the mirror constant). Per request: authenticate; map to member; recheck Group membership and Challenge visibility; read the projection; resolve titles/names at read time; apply suppression and retention filters; return typed items with the viewer's own Share/Kudos state. No client-supplied event content. Responses follow the existing indistinguishable-not-found posture.

## 12. Mobile experience (proposed, for CF-4)

Mobile-only member shell (Today / Challenges / Groups unchanged). A compact "Challenge activity" section on Challenge Detail with "View all" to a full feed screen, mirroring the proven Group Feed structure (first-page preview of the same read model; refresh and load-more; cached pages stay visible). Placement relative to progress/results is an experience decision for CF-4. Share and Kudos affordances live on the item and on the post-logging confirmation.

## 13. Dependencies

Actor-bearing moments (joined, Share, Kudos attribution) depend on **MC-4 member identity projection**. Actor-free moments (started, goal, milestones, ended, results-ready) do not. Profile images depend on MEDIA-2b. A scheduler or equivalent processor is needed to drain the outbox in any environment beyond manual local runs.

## 14. Explicit non-goals

No Home Feed. No change to the Group Feed. No change to GF-01/02/03/04 or migration 025. No Recognition issuance. No comments in v1. No free-form member posts. No media in the Feed. No ranking by popularity. No external sharing. No implementation by this document.

## 15. Open Founder decisions

(a) Whether the metric ceiling for shared activity may include value+unit. (b) Confirm "participant joined" as automatic with actor. (c) Together milestone percent set (proposed 25/50/75). (d) Retention and historical access. (e) Kudos giver visibility and count display. (f) Announcement authors. (g) Comments timing (FD-MC-09b). (h) Mirror FR-V2-212 for Share. (i) Whether a Race "finish" Share may show numeric position.

**Disposition:** CF-01 v0.1 — direction EFFECTIVE; detailed contract PROPOSED / AWAITING FOUNDER REVIEW. No implementation authorized.
