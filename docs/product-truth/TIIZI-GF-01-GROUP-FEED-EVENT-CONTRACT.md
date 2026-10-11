# TIIZI — GF-01 GROUP FEED EVENT CONTRACT

**Document type:** V2 Product Truth / event contract
**Status:** **APPROVED / EFFECTIVE — FOUNDER DISPOSITION (2026-10-05), AS AMENDED BY FOUNDER DISPOSITION (2026-10-06)**
**Version:** 1.1
**Effective date:** 2026-10-05
**Amendment date (v1.1):** 2026-10-06
**Amendment history:** v1.0 APPROVED / EFFECTIVE — FOUNDER DISPOSITION (2026-10-05). v1.1 narrows Group Feed automatic publication from five event families to exactly four: `challenge_finalized` (“Challenge results are ready”) is NO LONGER GROUP-FEED-PUBLISHABLE. Challenge finalization itself remains authoritative Challenge/domain truth; only its authority to publish as a separate Group Feed event is removed.
**Assessment basis:** `TIIZI-GROUP-FEED-CAPABILITY-ASSESSMENT-001.md` (Founder-directed accepted basis; assessment source commit `d9ac55774f6607d634ef1fb75a18214cc40e0469`, PR #74)
**Repository baseline reviewed:** `origin/main` = `d71994ffb92c98da986a1205b47febbeff4df484`; Master Programme v2.31.

This contract records the Founder disposition approving GF-01 subject to the bounded corrections in the disposition. It establishes V2 Group Feed Product Truth for engineering translation. It does not authorize GF-02, implementation, Share, Kudos, Today GF-07, Recognition, API, schema, migration, UI, deployment, or any other excluded capability.

> **Editorial cross-reference (2026-10-10; no rule in this contract is changed):** the reconciliation line below that restates FR-V2-128 ("no Challenge-specific … Feed") is historical. By Founder direction of 2026-10-10 Tiizi includes a separate, governed Challenge-specific Feed (`docs/product-truth/TIIZI-CF-01-CHALLENGE-FEED-PRODUCT-TRUTH.md`). That is a different capability from this Group Feed. GF-01 v1.1's four automatic families, audience, disclosure, retention and pagination rules, and migration 025's Group-Feed-specific scope, are unchanged.

## 1. Purpose and authority

The Group Feed is the single community stream belonging to one Group. It answers **“What is happening in this Group?”** It presents only an explicit, bounded set of meaningful Group/Challenge state events. It is a projection of authoritative source truth and never establishes or changes that truth.

This effective contract operationalizes the approved Stage F Product Definition T1 §§O, P, Q, R and X; Product Requirements T2 §21–22, FR-V2-128–134 and FR-V2-212; EOG-E1-01 §§7–9, 29–32, 38–39; the Group Domain Standard §§2, 4.5, 4.7 and 4.10; and the accepted S4/S5 experience records. It is subordinate to those instruments. It narrows the Stage F eligible-event category into a version-one allow-list and does not silently authorize new event families.

**V1 exclusion:** Archived V1 Feed behavior is frozen, non-authoritative, and excluded from V2 Feed design and implementation by `AGENTS.md` §§1–3. Do not inspect or use V1 Feed material as inspiration, precedent, compatibility, migration, fallback, or a source of missing Product Truth. Its physical presence creates no V2 authority. GF-01 and downstream Feed work derive solely from the V2 authority chain in this contract.

### Product Truth reconciliation

- **T1 §P.1 / T2 §21 F-E-01 reconciliation and settled effect for FR-V2-128:** one Group stream; no Challenge-specific or Home Feed.
- **T1 §P.3 / T2 §21 F-E-01 reconciliation and settled effect for FR-V2-129:** T1's enumerated automatic-event families are the only automatic-event ceiling. This contract chooses which have an authoritative V2 source now and which remain deferred. A technical state change not listed here is not Feed content.
- **T1 §§P.4–P.6, R / T2 §21 F-E-01 reconciliation and settled effect; FR-V2-212:** routine personal Activity is never automatic. Personal Activity, milestones, Streak results, Competitive finishes and Recognition require an affirmative explicit Share. System exhaust is excluded.
- **T1 §P.7:** similar events may only be aggregated after each underlying personal event was independently shared; aggregation is not a consent or privacy bypass. GF-01 version one has no Share capability, so it has no personal-event aggregation.
- **T1 §P.8 / T2 FR-V2-136–137:** Feed does not expand Group or Challenge visibility. Current access to every represented source is rechecked.
- **T2 FR-V2-130, 132, 134:** Feed and social acknowledgements are never Activity evidence, calculation, result, governance authority or Recognition input.
- **T1 §Q / T2 §21 F-E-01 reconciliation and settled effect for FR-V2-133:** no comments or reply threads in initial V2.

## 2. Feed invariants

1. Exactly one Group Feed exists per Group; it is not a Home/Today stream or a Challenge-local stream.
2. Only the event families classified **AUTO-PUBLISH ELIGIBLE** below may be automatically represented. No generic “all domain events” subscription is permitted.
3. An automatic entry is created only from the named authoritative transition, by server-controlled publication. Client interpretation, client-authored event payloads, and client timestamps cannot create Feed truth.
4. Only an active/joined Group member may read the Group Feed, subject to any narrower visibility of the source Challenge. The Accountable Steward has the same read audience as any other active member.
5. Feed cards disclose no individual Activity, evidence, note, health-like detail, Challenge progress value, rank, score, participant count or personal result in version one.
6. Source truth is always upstream. The Feed cannot establish participation, Activity acceptance, Streak, Together/Race progress, ranking, completion, results, Recognition, payment, support or membership.
7. Cards are typed, template-generated factual summaries. No free-form Feed posts, comments, replies, images, or member-supplied captions.
8. No Kudo/reaction, popularity score or popularity-based ranking is within this contract.

## 3. Audience and access/history semantics

**Read audience:** a person with a current PostgreSQL Group Membership in `active` or `joined` status. The Accountable Steward qualifies through the same current membership. Stewardship, delegation, authorship, Challenge hosting and Platform operations do not independently grant Feed access.

| Viewer or change | Effective rule |
|---|---|
| Active/joined ordinary member | May read that Group Feed, subject to source Challenge visibility. |
| Accountable Steward | Same Feed audience and source-visibility rules as an ordinary member. |
| Pending applicant | No Feed read or event preview. Existing pending application state remains available through its current authority. Feed API denial is indistinguishable from an unavailable/unknown Feed. |
| Rejected applicant | No Feed read. |
| Authenticated non-member of discoverable Group | No Feed read. Discoverability grants only the existing minimum Group/Challenge discovery projection. |
| Non-member of private Group | No Feed read; preserve indistinguishable-not-found privacy posture. |
| Member immediately after leaving/removal | Access is revoked on the next server read. Clear client Feed state; do not permit cached access to survive the membership transition. |
| Former/left member | No historical Feed entitlement. Rejoining grants access to the then-current retained Feed, not a special former-member archive. |
| Group becomes private | No expansion or change for current members; all non-members remain excluded. Recheck Group status/privacy on every read. |
| Challenge visibility becomes narrower | Hide each event from any viewer who no longer has source access. Do not expose a placeholder that confirms a hidden Challenge or event existed. |
| Challenge visibility becomes broader | Does not broaden Group Feed audience. Group Feed remains current-member-only. |
| Actor/member later leaves | Do not delete an otherwise valid Group/Challenge state event solely because its actor later left. Version-one automatic cards do not identify the actor. Underlying sources retain any required historical attribution. |
| Account deactivated/deleted | No member name, avatar, email, or account identifier is displayed in version-one automatic cards. Recheck source visibility and deletion obligations; suppress the card if its source or lawful visibility basis is removed. Preserve source attribution only within the upstream authority to the extent governance requires. |
| Group deactivated | Feed becomes unreadable while inactive. |
| Group permanently deleted under a future authorized lifecycle | Suppress and purge Feed projection/outbox content for that Group; preserve only any separate minimum governance audit record required by superior policy. |

For a private Group or denied viewer, return the same generic not-found response used by Group authority where applicable. Never treat “public”, “discoverable”, “event-time member”, or “was once a member” as a Feed access grant. This implements EOG §7 prospective departure while respecting §§30–32 and §39: historical attribution/preservation does not create visibility or perpetual access.

## 4. Event taxonomy and automatic-publication allow-list

The classification applies to the event class itself. “Explicit Share only” describes a possible future route under T1 §§P.5/R.1 and FR-V2-212; **it is not included in GF-01 version-one Feed capability** (see §9). “Deferred pending future authority” means no item is publishable until the listed authority is separately established and approved.

| Candidate | Exactly one classification | Authoritative transition / decision |
|---|---|---|
| Group created | **NOT PUBLISHABLE** | Group creation is not in T1 §P.3's automatic allow-list. The new Group Home is the authoritative place to see the Group; suppressing an extra creation post avoids system exhaust. |
| Member joined Group | **NOT PUBLISHABLE** | Join/approval is authoritative in Group Membership but not in T1 §P.3's event list. It also discloses membership. No automatic join card. |
| Member left/removed | **NOT PUBLISHABLE** | Leave/removal is a Membership event, not a Feed event. It may reveal sensitive governance/offboarding; source history remains upstream. |
| Challenge created | **AUTO-PUBLISH ELIGIBLE** | One event on successful committed establishment of the canonical Group Challenge (`challenges` identity row and required definition/configuration accepted). Failed/partial requests, drafts, retries, or duplicate establishment attempts emit none. |
| Challenge opened/started | **AUTO-PUBLISH ELIGIBLE** | One event on the canonical Challenge lifecycle transition `establishment → active` (actual `challenges.status` change), not on a planned date, client clock, scheduled notification, or read-time inference. |
| Challenge joined | **NOT PUBLISHABLE** | Individual participation is not in T1 §P.3's automatic list. Do not disclose a member's personal commitment or participation episode. |
| Arbitrary/non-terminal Challenge threshold | **NOT PUBLISHABLE** | No percentage thresholds, “nearing goal” events, rank changes, or inferred milestones. A threshold must be a specifically approved canonical milestone to qualify. |
| Together collective milestone / Goal achieved | **AUTO-PUBLISH ELIGIBLE** | In version one, only the canonical Together Goal crossing: `challenge_derived_state.collective_goal_reached` changes `false → true` and `goal_completed_at` is set by the authoritative derived-state transaction after accepted Activity. Other percentage thresholds are not included. Unique per Challenge/goal version; recomputation/retry cannot duplicate. |
| Routine Accepted Activity | **EXPLICIT SHARE ONLY** | Accepted event/application is not itself publishable. T1 §§P.4–P.5/R.1 and FR-V2-212 require a separate affirmative Share. No Share capability ships in GF-01 version one. |
| Streak continuation/day completion | **NOT PUBLISHABLE** | Routine personal continuity is not an automatic community event and is not an individual milestone. No per-day post, routine, count, or reset state. |
| Personal Streak milestone/result | **EXPLICIT SHARE ONLY** | T1 §P.5/R.1 requires a Member's affirmative Share. No Share capability ships in GF-01 version one. |
| Race progress/rank movement | **NOT PUBLISHABLE** | No live progress, rank movement, comparative activity or position-change cards. T1 §§P.4–P.6 prohibit routine personal Activity and system exhaust; no Race movement/rank presentation is authorized here. |
| Challenge ended | **AUTO-PUBLISH ELIGIBLE** | One event on canonical lifecycle `active → ended` (`challenges.status` transition). It states only that the Challenge window ended; it does not imply goal completion or participant success. The ended card navigates to canonical Challenge Detail, where finalized results may later be visible. |
| Challenge finalized / Challenge-level final results ready | **NOT PUBLISHABLE IN GROUP FEED (v1.1 amendment)** | Finalization (`finalized_at: null → non-null` plus the committed immutable `challenge_finalizations` record) remains authoritative Challenge/domain truth, but it no longer publishes a Group Feed event. Rationale: the Group Feed is Group-level Challenge/community lifecycle activity; a separate final-results publication duplicates Challenge-specific activity and would let Group Feed density drift into a Challenge Feed. Finalized results remain available through canonical Challenge Detail and may later be incorporated into a separately authorized Challenge Feed capability — which is deferred/future authority only and is not authorized here. |
| Individual result/rank / Competitive finish | **EXPLICIT SHARE ONLY** | T1 §R.1 permits a Member to choose to share a Competitive finish; the Feed never auto-publishes an individual result. A future Share may describe only the actor's own generic finish, not numeric rank/score or another member's result. No Share capability ships in GF-01 version one. |
| Valid Challenge extension | **DEFERRED PENDING FUTURE AUTHORITY** | T1 §P.3 permits this event family, but current V2 has no approved extension mutation/lifecycle authority. A later Product Truth and source transition must define a valid extension before publication. |
| Accountable Steward change | **DEFERRED PENDING FUTURE AUTHORITY** | EOG §38 requires materially intelligible stewardship history, but current V2 has no authorized transfer/successor transition. Do not infer from role fields, bootstrap or reconciliation. A later stewardship authority must define the event. |
| Important Group announcement from Steward | **DEFERRED PENDING FUTURE AUTHORITY** | T1 §P.3 permits important announcements, but there is no approved announcement authoring/content authority. No announcement composer or free-form social post is created here. A separate bounded Steward communication authority is required. |
| Cause activated / closing declared | **DEFERRED PENDING FUTURE AUTHORITY** | T1 §P.3 permits these Cause lifecycle events, but current approval/configuration state is not itself Cause activation or a closing declaration and no matching authoritative transition exists. A Cause lifecycle authority must define each transition. |
| Cause/support contribution or pledge | **DEFERRED PENDING FUTURE AUTHORITY** | Approval/configuration is not evidence of a contribution. Contribution/reconciliation, custody and privacy authority do not establish a Group Feed contribution event. A future approved contribution source and consent contract are required. |
| Future Platform Recognition | **EXPLICIT SHARE ONLY** | T1 §P.5/R.1 and FR-V2-212 require explicit Share for personal Recognition; MOT-01 and Recognition issuance/read authority are still deferred. No Feed Recognition card before both authorities exist and the person explicitly shares it. |

### Exact version-one automatic event families

Only these four canonical source transitions may produce an automatic GF-01 v1 Feed event: Challenge established, Challenge started, Challenge ended, and Together canonical Goal achieved. Challenge finalization remains an authoritative Challenge/domain transition but is NOT a Group Feed event and produces no Group Feed card. The ended presentation always remains visible according to normal retention/visibility/suppression rules; the v1.0 ended/finalized presentation-consolidation authority is removed because no finalized Group Feed event remains. The event producer uses the authoritative source transaction/transition identifier and a server-owned idempotency key. One source transition produces at most one Feed item per Group. No member join/leave, activity log, Streak day, Race progress/rank, arbitrary threshold, Cause, Stewardship or announcement event is inferred.

T1 §§P.3 and P.7 allow future extension and aggregation as described above, but neither permits turning all underlying changes into cards. A later threshold taxonomy or event class requires a Product Truth amendment before engineering.

## 5. Per-event disclosure contract

“Current visibility” means current Group membership plus current authorized visibility to the source Challenge at read time. T1 §P.8 applies per viewer. The server resolves both Group and Challenge identity from canonical IDs; the client cannot supply actor, title, event text, Group scope or source visibility.

| Event | Actor identity | Group / Challenge identity | Fixed title and allowed subtitle | Numbers | Time | Deep link | Personal/result information and visibility |
|---|---|---|---|---|---|---|---|
| Challenge created | None; no creator name/avatar/member ID | Current Group name is already in Group context; current visible Challenge title may appear | **“A new Challenge is available”**; no free-form subtitle | Prohibited | Store server transition time; display relative time to nearest minute, then calendar date; never seconds | Canonical V2 Challenge detail | No creator participation, member list, activity, goal value/unit, or private configuration. Hide when viewer lacks current Challenge visibility. |
| Challenge started | None | Same | **“The Challenge has started”**; no free-form subtitle | Prohibited | Same | Canonical V2 Challenge detail | No participant status/progress/activity. Recheck current Challenge visibility. |
| Together Goal achieved | None; no contributor attribution | Same | **“The Group reached its Challenge goal”**; no amount, who contributed, or generated congratulatory claim | All values, units, member count and contribution shares prohibited in card | Use canonical goal-crossing server transition time; display nearest minute/date only | Canonical V2 Challenge detail (authoritative progress/result section) | Group-level status only. No individual participation, contribution totals, contributors or rank. Recheck Challenge and derived-state visibility. |
| Challenge ended | None | Same | **“The Challenge has ended”**; does not say “completed”, “won”, or “goal achieved” | Prohibited | Use server `active → ended` transition time; display nearest minute/date only | Canonical V2 Challenge detail | Does not expose who participated or succeeded. Recheck current Challenge visibility. |

For all automatic events: no raw Activity, evidence, submission payload, note, exact personal routine, location, health-like detail, email, provider ID, avatar, or profile field is persisted or displayed. Event titles are enumerated templates, not free text. The Group name and Challenge title are resolved from the current source and rendered only if still visible; do not freeze a possibly stale title into a permanent card. A title is never a substitute for the authoritative Challenge or Group detail screen.

(Challenge finalized has no Group Feed disclosure row: v1.1 removed its Group Feed publication authority. Challenge finalization remains upstream Challenge/domain truth and finalized results remain available through canonical Challenge Detail.)

### Future explicit-Share disclosure ceiling

Share events are not part of the first Feed capability. If a future independently authorized Share exists, its initial data ceiling should be the actor's own generic achievement state plus the source Challenge title, with no raw record/note/evidence, exact routine/time, score, value, rank, another Member's information or cause amount. The Member must preview and choose one specific Group. Every affected Member's consent and the source's visibility must be respected. This ceiling is a recommendation for a future Share contract, not authority to implement it now.

## 6. History, retention and correction

### 6.1 Retention policy

**GF v1 operating retention baseline: 90 days.** Retain Feed projection items for a rolling 90 days from the authoritative source transition time; older items expire from the active Feed projection (no member-facing archive). This is the approved initial V2 Feed operating policy, not an invariant of Group, Challenge, Activity or historical Product Truth. A future attributable Product/Platform policy decision may change projection retention without rewriting upstream truth. Expiry MUST NOT delete authoritative Group truth, Challenge truth, Participation, Activity, Derived Truth, Finalization, or Recognition when later introduced. Each upstream authority retains its own governing retention and audit requirements.

### 6.2 Minimum persisted event fields

Persist only what a bounded, rebuildable projection needs: immutable Feed event UUID; Group UUID; allow-listed event type and contract version; authoritative source type/UUID; source transition/version identifier; server-assigned transition timestamp; idempotency key; delivery/projection state; and a minimal suppression/correction state plus source reference. Do not duplicate source copy, actor name/avatar, activity values, profile fields, cause amount, result/rank, or client-supplied payload. Group/Challenge display names and access are resolved from current authorized source reads. Internal outbox retry metadata is not member-facing truth.

### 6.3 Correction and restriction

- Re-evaluate Group status/membership and Challenge visibility on every Feed page/read. If a source becomes inaccessible, corrected so the event is no longer true, deleted/deactivated, or invalidated, suppress the card immediately; do not reveal a “hidden event” placeholder.
- If a correction leaves the event eligible but changes its factual meaning, the projection may be regenerated from corrected upstream truth only through an attributable correction transition. Do not silently rewrite the old card as though corrected truth had always existed. The upstream source remains the truth and retains its own correction history.
- The Feed never repairs or changes a source fact. Invalid/duplicate projection rows are suppressed; a correct row can be rebuilt from an eligible source transition without making Feed the source.
- Automatic event cards have no Member withdrawal control. A future explicitly shared card must be withdrawable by its sharing Member under its separate Share contract; withdrawal hides it from Feed/Today but never retracts or alters upstream Activity/Derived Truth.

### 6.4 Deletion and attribution

No actor identity is shown on version-one automatic cards. If an account is deactivated/deleted, recheck whether the source may remain visible; suppress the card if its visibility basis no longer exists. Preserve historical attribution in upstream authority only to the extent EOG §§38–39 require and superior privacy/deletion obligations allow. Do not preserve an independent Feed identity snapshot. Group inactivity hides all cards; a future authorized permanent Group deletion purges Feed rows and keeps only the minimum separate audit trace required by policy. Challenge source removal/restriction suppresses affected cards. Feed itself has no delete/restore or archive authority.

### 6.5 Audit / traceability

Each publication must trace to one eligible authoritative transition. Each deduplication, suppression, correction and purge action records the Feed event UUID, source reference, action type/reason code, acting system or authorized authority, and server time. Keep the member-facing Feed projection to the 90-day operating baseline. Traceability records follow the minimum applicable V2 operational/audit retention policy; do not infer that Feed expiry deletes a required operational audit record. The source authority remains the durable historical record under EOG §§38–39. No Feed-only history may override source correction, privacy, deletion or access rules.

## 7. Ordering and pagination

- Newest source transition first, ordered by server-assigned source-transaction timestamp (the time the authoritative state transition committed), not member-reported Activity occurrence time, client time, asynchronous projector arrival, Kudo count or popularity.
- Deterministic per-Group keyset: `(source_transition_at DESC, feed_event_id DESC)`. Event UUID is the stable tie-break; it does not imply causal ordering for simultaneous transitions.
- Default page size: 20. Maximum: 50. Server clamps/rejects values outside the bounded contract.
- Use keyset pagination only; no offset pagination. Opaque cursor version 1 binds Group UUID, order version, last key, direction, page contract and expiry. Authenticate/sign the cursor server-side; reject tampering, cross-Group reuse, unsupported version and expired cursors. Cursor expiry is 24 hours.
- Late projection delivery retains the authoritative source-transition timestamp, so it appears at its true system-transition position after refresh; it is never backdated to a Member's Activity timestamp. Newly committed events appear at the head on refresh; existing pages remain stable and clients deduplicate by Feed event UUID.
- If an item expires, is corrected, or becomes invisible between pages, skip it and continue using the last scanned key. Do not return a placeholder or leak its former position/count. A cursor whose contract version expires requires a fresh first-page read.
- The member-facing display uses relative time rounded to the nearest minute for recent cards, then a date label; seconds and precise member activity times are never shown.

## 8. Explicit Share disposition

**Decision: B — Share-to-Group is separately deferred.** GF-01 v1 contains no Share button, endpoint, authoring flow, shared-item persistence or Today representation of a share. This does not cancel Stage F T1 §§P.5/R.1 or FR-V2-212; it keeps their explicit-consent requirement binding for any later Share capability.

Future allowable source categories under Stage F are the Member's own Activity, personal milestone, Streak result, Competitive finish and Recognition. Eligibility, self-only scope, consent preview, Group audience, source visibility, affected-member consent, redaction, withdrawal, duplicate prevention, correction and deletion require a separately approved Share Product Truth/engineering package before implementation. No free-form post composer is permitted by this decision.

## 9. Moderation and takedown boundary

The first Feed contains only server-generated, typed, governed state summaries—no comments, replies, arbitrary reactions, Member posts, media or Steward announcements. It is not a general social-content moderation surface.

- **Automatic suppression:** the trusted projection/read authority suppresses a duplicate, malformed, stale, source-invalid or no-longer-visible projection under the rules in §6. It records a reason code and source link.
- **Correction:** only the upstream domain authority corrects Group/Challenge/Derived/Finalization truth. Feed projection re-materializes or suppresses the derived card; it cannot edit source truth or write custom member-facing copy.
- **Emergency projection suppression:** an authorized Platform operational authority MUST be capable of suppressing an individual Feed projection where necessary for incorrect publication, source invalidation/correction, privacy or visibility failure, security issue, deletion obligation, or another attributable operational safety requirement. Suppression affects the projection only and MUST NOT alter upstream Product Truth. It requires an attributable reason and audit trace, preserves permitted traceability, and may be reversed only where policy permits and after source eligibility/visibility is revalidated. This is not general Feed editing or social-content moderation and creates no Member, Steward, or broad administrator authority. Detailed Operator/RBAC implementation remains governed by later applicable authority; engineering must not invent unrestricted permissions.
- **Audit:** automated suppression and any later authorized exceptional action must retain the minimum trace in §6.5, with the actor, source, reason and server time. A later policy may specify longer audit retention.

## 10. Mobile Group Home placement

**The approved additive placement is:** a compact **“Group activity”** section on the member-mobile Group Home, after the existing hosted-Challenges section and before the existing roster/About detail. Its “View all activity” action opens the single Group Feed for that Group. The compact section is a first-page preview of that same Feed read model, not another Feed or store.

Keep current S4 Group identity, hosted Challenges, Members/Stewardship, About/settings and pending-application relationships intact. This placement inserts a bounded section without replacing or reordering the accepted Group capabilities. It does not authorize a desktop member experience or a new navigation destination beyond opening the Group's same Feed. Founder preview and acceptance remain a separate downstream experience gate.

## 11. Today boundary

Confirm the future authority relationship:

`Group Feed read authority → bounded Today community summary`

Today may consume only a bounded summary from the **single V2 Group Feed read authority**. It must never become a second Feed, event store, publication authority, Kudo authority, or independent visibility interpreter. The exact “three items / preceding seven days” setting, if retained, is a **proposed GF-07 initial experience parameter**, not enduring GF-01 Product Truth. GF-01 does not authorize GF-07 or modify Today/S5.

## 12. Explicit exclusions

GF-01 v1 does not authorize or include: Kudos/reactions; Platform Recognition issuance; Share-to-Group capability; member join/leave events; individual result/rank cards; live Race progress or ranking; Streak continuation/day events; arbitrary percent thresholds; Challenge extension; Cause activation/closing/contribution events until their authority exists; Steward change or announcements until their authority exists; comments/replies; free-form posts; media/file uploads; messaging/presence; Group/Challenge social graph; Leaderboards; system notifications; separate Today stream/store; deletion/transfer lifecycle not already authorized; Operator moderation UI; deployment.

**Kudos boundary:** the concept remains lightweight peer/community acknowledgement, categorically separate from policy-governed Platform Recognition. Kudos are explicitly excluded from GF-01 implementation authority. Their target, repetition/toggle, undo, counts, privacy, identity, abuse/rate limits, moderation and idempotency are not decided here. Neither Kudos nor Recognition may alter Activity, progress, ranking, Streak, completion, results or governance.

## 13. Downstream engineering implications (not authorization)

If separately authorized, GF-02 may specify a PostgreSQL transactional outbox/publication record written atomically with the four eligible source transitions and a rebuildable Group-scoped projection. Each source event requires a unique source-transition idempotency key. The projection is not an event authority and should resolve current source names/visibility at read time. Every read reauthorizes current membership and source Challenge access. The Group Feed API uses `/api/*` and the canonical API prefix/client composition; client-created events are impossible. Group-keyed keyset pagination follows §7. Today may later consume only the Group Feed read seam. The projector must not block or change source domain transactions if presentation publication is delayed; failures/retries must be observable and idempotent.

GF-02 must not begin merely because this contract is effective. A separate Founder authorization is required before engineering starts. Any inability to meet deletion/takedown obligations or to recheck source visibility blocks publication until separately resolved.

## 14. Founder decision package

Founder disposition: **APPROVED / EFFECTIVE**, subject to the bounded corrections recorded in this contract. The decisions below are effective GF-01 Product Truth; downstream implementation remains subject to separate authorization.

| Decision | Effective disposition |
|---|---|
| FD-GF01-01 — Single Feed/invariants | Record §§1–2 as effective: one Group stream, no Home/Challenge duplicate, projection-only authority and no popularity mechanics. |
| FD-GF01-02 — Automatic event allow-list | Record only the four automatic transitions in §4: Challenge establishment, Challenge start, Challenge end, and Together Goal achieved. Challenge finalization is NOT PUBLISHABLE IN GROUP FEED (v1.1 amendment, 2026-10-06): it remains authoritative Challenge/domain truth with results available through canonical Challenge Detail, and is eligible only for a separately authorized future Challenge Feed. All other row classifications are effective as marked. |
| FD-GF01-03 — Minimal disclosure | Record §5: no actor identity, no numbers or individual result/rank in v1 auto cards; template-only titles; current Group/Challenge source-visibility rechecks. |
| FD-GF01-04 — Audience/history | Record current active/joined members only; pending/rejected/nonmember/former denied; immediate revoke on leave/removal; eligible old cards remain for current readers for the retention window without actor identity. |
| FD-GF01-05 — Retention/correction | Record GF v1 operating retention baseline of 90 days for the Feed projection, expiry rather than member archive, minimal source-linked projection, immediate suppression on source invalidity/visibility loss, traceable correction and EOG-constrained attribution; this is changeable by attributable future policy without rewriting upstream truth. |
| FD-GF01-06 — Ordering/pagination | Record source-transition commit timestamp and UUID tie-break, newest first, 20 default/50 maximum, signed Group-bound keyset cursor version 1 with 24-hour expiry. |
| FD-GF01-07 — Share | Record B: separately defer Share-to-Group while preserving Stage F's explicit-consent rule. No Share UI/API/composer in GF-01 v1. |
| FD-GF01-08 — Moderation/takedown | Record automatic correction/suppression and the narrow emergency projection-suppression capability in §9; no general moderation role or UI. |
| FD-GF01-09 — Group Home placement | Record additive compact Group activity section after hosted Challenges and before roster/About; View all opens the same Feed. |
| FD-GF01-10 — Today boundary | Record Feed-read-authority → bounded Today summary. Three items / seven days, if used, are proposed GF-07 experience parameters only; GF-07 and Today changes are not authorized. |
| FD-GF01-11 — Kudos/Recognition | Record Kudos excluded from GF-01 implementation authority. Keep the Product Truth distinction; do not decide Kudo operations. Keep Recognition MOT-01-gated and explicit-Share-only once authoritative. |
| FD-GF01-12 — Engineering gate | Record that GF-01 approval does not authorize GF-02. GF-02 is the next proposed engineering package and remains NOT IMPLEMENTATION-AUTHORISED unless separately authorized. |

## 15. Programme treatment and status

Master Programme v2.32 records GF-01 COMPLETE / FOUNDER APPROVED; V2 Group Feed Product Truth/event contract ready for engineering translation; GF-02 as the next proposed Feed engineering package and NOT IMPLEMENTATION-AUTHORISED unless separately authorized. This does not displace Stage G completion work or authorize GF-02.

No S7/S8/S9 work is opened. This contract records Product Truth only and makes no source, API, UI, database, migration, Today, deployment or production change. No V2 Feed implementation occurred.

## Final disposition

**GF-01:** APPROVED / EFFECTIVE — FOUNDER DISPOSITION 2026-10-05
**GROUP FEED:** PRODUCT TRUTH FROZEN FOR ENGINEERING TRANSLATION; IMPLEMENTATION NOT STARTED
**GF-02:** NEXT PROPOSED ENGINEERING PACKAGE; NOT IMPLEMENTATION-AUTHORISED
**KUDOS / SHARE / TODAY GF-07 / RECOGNITION:** DEFERRED / EXCLUDED AS STATED ABOVE
**MASTER PROGRAMME:** v2.32 records GF-01 approval and GF-02 proposal only.
