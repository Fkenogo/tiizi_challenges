# TIIZI — CF-01 CHALLENGE FEED PRODUCT TRUTH / CAPABILITY DEFINITION

**Document type:** V2 Product Truth / capability definition (CF-1)
**Version:** 0.2
**Date:** 2026-10-10
**Base:** `365c958bf69f6d79ae262e81045abae9c777c19c`
**Companion:** `docs/programme/TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md`

**Status:**
- **EFFECTIVE (Founder-decided, 2026-10-10):** §2 amendment; §3 invariants that restate existing Product Truth; §4 v1 event decisions; §5 retention and access; §6 Share, Kudos and announcement rules; §7 comments status; §9 boundary with the Group Feed.
- **PROPOSED (genuinely unresolved detail):** the items marked **[PROPOSED]** in-line and listed in §11. Everything not so marked is effective.
- **Implementation:** **not authorized.** CF-2 (publication/event model) and later packages need separate Founder authorization.

**V1 exclusion:** archived V1 feed behaviour is not consulted (AGENTS.md §1).

## 1. Authority chain and supersession

| Record | Position |
|---|---|
| Stage F T1 §P/§Q/§R; FR-V2-130, 131, 132, 134, 136, 137 | In force; general feed rules (Feed is never truth; Kudos never affect performance; Feed does not expand visibility) |
| FR-V2-128 as reconciled by F-E-01 ("no Challenge-specific Feed") | **SUPERSEDED** by the 2026-10-10 Founder direction. Original text retained as history |
| FR-V2-129, FR-V2-212 | In force for the Group Feed; the Challenge Feed's Share follows the same affirmative principle (§6.1) |
| FR-V2-133 (no comments/replies in initial V2) | **Remains in force** for general member comments/replies (§7) |
| GF-01 v1.1 / GF-02 / GF-03 / GF-04 | **Unchanged.** Group Feed has exactly four automatic families |
| Migration 025 | **Unchanged**; Group-Feed-specific; not deployed; its event-type CHECK gap must be reconciled before deployment |

## 2. Effective amendment

> **Tiizi includes a governed Challenge-specific Feed as a Challenge-local engagement surface. Its content does not create or alter Challenge Truth.**

There is still no Home Feed. The Group Feed remains the single community stream *of the Group* and is unchanged.

## 3. Invariants (EFFECTIVE)

1. Exactly one Challenge Feed per Challenge. It answers "What is happening in this Challenge?"
2. It is scoped to one Challenge; it is not a Group Feed, not a Home/Today stream and not a view over the Group Feed.
3. Entries derive from canonical PostgreSQL truth (Challenge lifecycle, participation, accepted activity, derived state, finalization), from an explicit validated member action (Share, Kudos), or from a steward announcement. Client-authored payloads, client timestamps and client-computed facts never create Feed truth.
4. Showing something in the Feed never makes it Challenge evidence, score, progress, completion, ranking, result or Recognition (FR-V2-130/132/134). A Feed row can be suppressed, expired or withdrawn without touching Challenge truth.
5. The Feed does not expand visibility; current Group membership and current Challenge visibility are rechecked on every read for every viewer (T1 §P.8; FR-V2-136/137).
6. Minimum disclosure: no raw evidence, notes, location, exact routine time, health-like detail, email or provider ids.
7. No member-authored free-form posts, captions or comments in v1. Steward announcements are the only free text.
8. Kudos and any reaction never count toward ranking, recommendation, status, progress, results or Recognition.
9. Automatic publication is server-side, idempotent by a server-owned key, and must not be able to alter or fail the source Challenge's business outcome.

## 4. v1 event allow-list (EFFECTIVE)

### 4.1 AUTOMATIC

| # | Moment | Actor shown | Metric shown | Source of truth | Persistence | Dedupe / idempotency |
|---|---|---|---|---|---|---|
| A1 | **Participant joined** | The participant's **display name only**; no other personal data | None | `challenge_participations` insert (episode) | Event row referencing the participation episode | Key = participation episode id |
| A2 | **Challenge started** | None | None | `challenges` `establishment → active` | Event row | Key = challenge + `started` |
| A3 | **Together progress milestone** | None (actor-free) | **Percentage only: 25%, 50%, 75%** | Together derived state | Event row | Key = challenge + goal version + milestone |
| A4 | **Together goal reached** | None | None | `collective_goal_reached false → true` | Event row | Key = challenge + goal version |
| A5 | **Challenge ended** | None | None | `challenges` `active → ended` | Event row | Key = challenge + `ended` |
| A6 | **Finalized results ready** | None | Generic "Results are ready" card; actual results remain on Challenge Detail | `challenge_finalizations` | Event row | Key = challenge (exactly once) |

All automatic cards are template-typed. A2, A4 and A5 are the same source transitions that publish to the Group Feed; the Challenge Feed records them as **separate publications** for a different audience and never reads the Group Feed.

### 4.2 EXPLICIT SHARE ONLY

| # | Moment | What the member may share | Excluded | Source of truth |
|---|---|---|---|---|
| S1 | **Accepted participant activity** | Activity name; the member's **own accepted value**; unit; their display name | Notes, evidence, location, raw metadata | `challenge_activity_records` (accepted) |
| S2 | **Streak milestone** | The member's **own** milestone only | Anyone else's data | Participation derived state |
| S3 | **Race finish / personal result** | The member's **own** result only | **No numeric final position** in a Feed Share; canonical Challenge Results continues to show authorized result truth | `challenge_participation_finals` |

### 4.3 NOT APPROPRIATE (not published in v1, by any route)

Participant left; live Race rank/position movement; routine automatic personal activity; a "Challenge established" card inside the Challenge's own Feed.

### 4.4 Duplication with the Group Feed
Only A2, A4 and A5 coincide with Group Feed source transitions. That is intentional: separate publication records, separate projections, different audiences. A1, A3, A6 and all Shares and announcements do not appear in the Group Feed.

## 5. Retention, audience, ordering (EFFECTIVE)

- **Retention:** the Feed is available for the **Challenge lifetime plus 90 days after the Challenge ends**. After expiry the Feed projection/presentation is removed. Canonical Challenge evidence and results are never deleted or changed because of Feed retention. Shares, Kudos and announcements follow their Feed item.
- **Audience:** a member who still holds authorized Group and Challenge visibility. A participant who has exited the Challenge may read while they remain otherwise authorized to view that Challenge. Leaving or losing Group or Challenge visibility removes Feed access on the next read; denial is indistinguishable from not-found.
- **Ordering and paging:** newest first by server-assigned transition (or Share/announcement) time, tie-break event UUID; never by Kudos count. Keyset pagination with a **signed, Challenge-bound, expiring cursor**; default page **20**, maximum **50**.
- **Account deletion (per FD-MC-06a):** the member's Shares are withdrawn and their Kudos removed; their participant name renders as "Former member".

## 6. Engagement (EFFECTIVE)

### 6.1 Explicit Share
Explicit member action; **preview before publishing**; **self-only**; **default is not shared**; **withdrawable** by the sharer (hides the item; never alters the underlying activity or result); the underlying activity/result never changes; one source item cannot silently create duplicate shares (one active Share per member per source item). Ordinary activity is never published automatically. No free-text caption. Same affirmative principle as FR-V2-212 / T1 §R.1. External sharing is independent and out of scope.

### 6.2 Kudos — REQUIRED BEFORE PILOT
One Kudos type only. Any Challenge-visible member may Kudos an item. **No self-Kudos.** One Kudos per member per item. **Toggle off / undo** supported. The **aggregate Kudos count is visible** to Challenge Feed viewers; the **giver sees their own active/inactive state**. **No public list of givers in v1.** Never affects ranking, recommendation, status, progress, results or Recognition. Rate-limiting and abuse protections are required. The Feed item's retention controls the Kudos lifetime. Kudos is distinct from Platform Recognition.
- **[PROPOSED]** Which items are Kudos-able: member-owned Shares and steward announcements. Whether automatic system cards (A1–A6) are Kudos-able is not decided; "no self-Kudos" implies an item owner, which system cards lack, and A1 belongs to the joiner. Until decided, treat system cards as not Kudos-able.

### 6.3 Steward announcements — REQUIRED BEFORE PILOT
**Authors:** the Group Accountable Steward; and the Challenge creator **where the creator is an authorized, distinct Challenge-administration actor**. **Requirements:** attributed author; timestamp; bounded text length; edit and delete; **durable edit history**; operator suppression/takedown; no effect on Challenge truth; **no member-authored free-form posts**.
- **[PROPOSED]** Precise rule for when a Challenge creator qualifies. The repository records `created_by_member_id` per Challenge and Groups may allow members to create Challenges, but no distinct Challenge-administration authority is defined; this must be defined before CF-5. The text length bound is also to be set.

### 6.4 Summary tiers
| Feature | Tier |
|---|---|
| Automatic moments (§4.1) | Required before pilot |
| Explicit Share (§6.1) | Required before pilot |
| Kudos (§6.2) | **Required before pilot** |
| Steward announcements (§6.3) | **Required before pilot** |
| Comments / replies, multiple reaction types, feed notifications, aggregation, external share | Later |

Engagement actions never modify evidence, score, progress, results or Recognition truth.

## 7. Comments and replies (EFFECTIVE)
Not required before pilot. A later capability requiring a separate Product Truth and moderation decision; not part of CF-5 v1. **FR-V2-133 remains in force** for general member comments/replies.

## 8. Moderation, suppression, persistence (EFFECTIVE direction; mechanisms PROPOSED)

Automatic cards are templates; Shares and Kudos are structured; announcements are the only free text. An attributable **operator suppression/takedown** capability is required (projection-only; never alters source truth), consistent with GF-01 §9. **[PROPOSED]** persistence shape: a Challenge-scoped publication/outbox and rebuildable projection for automatic moments, and separate tables for Shares, Kudos and announcements; references and minimal state, not copies of evidence or names; names and titles resolved at read time; own tables, **not** `group_feed_*`. Table design and migration numbers are assigned when CF-2 is authorized and begins (no number reserved now). A recorder separate from `recordChallengePublication`; the existing domain write paths must not gain a second publication dependency unless CF-2 proves it cannot fail the source transaction.

## 9. Boundary with the Group Feed (EFFECTIVE)

| Aspect | Group Feed (GF-01 v1.1, unchanged) | Challenge Feed |
|---|---|---|
| Question | "What is happening in this Group?" | "What is happening in this Challenge?" |
| Scope | One per Group | One per Challenge |
| Content | Four automatic, actor-free, number-free cards | §4 allow-list |
| Participant activity | Never | Explicit Share only |
| Engagement | None | Share, Kudos, announcements |
| Storage / API | `group_feed_*` (migration 025); Group read API | Own storage and read API |
| Cross-reads | None | None |

The existing invariant test for the four Group Feed families must continue to pass untouched.

## 10. Read model, experience and dependencies

- **Read model [PROPOSED]:** a Challenge-scoped read under the canonical API prefix; per request authenticate, map the member, recheck Group and Challenge visibility, read the projection, resolve names/titles at read time, apply suppression and retention, return typed items plus the viewer's own Share/Kudos state.
- **Experience [PROPOSED]:** mobile-only; a compact "Challenge activity" section on Challenge Detail with "View all"; Share and Kudos on the item and after logging. Placement is a CF-4 experience decision.
- **Dependencies:** name-bearing items (A1, S1–S3) depend on MC-4 (member identity projection). Actor-free automatic moments do not. Production draining of publication, retention expiry and media cleanup depend on BG-1. Operator suppression is needed before CF-5 is declared complete.

## 11. Remaining open detail (all [PROPOSED])

1. Kudos-able item set (system cards or not). 2. Rule for when a Challenge creator is an authorized distinct administration actor, and the announcement length bound. 3. Table/projection design, idempotency-key format and migration numbering (assigned when CF-2 starts). 4. Placement and layout (CF-4). 5. Read-API response shape (CF-3). 6. Whether Kudos counts display for A-cards if later made Kudos-able. All other content above is Founder-decided.

## 12. Non-goals

No Home Feed. No change to the Group Feed, GF-01/02/03/04 or migration 025. No Recognition issuance. No general comments or replies. No free-form member posts. No media in the Feed. No popularity ranking. No external sharing. No implementation by this document.

**Disposition:** CF-01 v0.2 — Founder-decided v1 contract EFFECTIVE; remaining detail PROPOSED. CF-2 not authorized.
