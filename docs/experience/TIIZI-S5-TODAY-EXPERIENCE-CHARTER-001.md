# TIIZI-S5 — Today Experience Charter 001

**Task:** TIIZI-S5-TODAY-EXPERIENCE-CHARTER-001 — bounded readiness / charter. **No implementation.**

**Base:** `origin/main` @ `a2275fe2a80a4ec283e606412fadf91d1da4f468` (post PR #65; verified, expected canonical SHA)

**Master Programme:** v2.20 → v2.21 (post-console programme reconciliation; S5 recorded as the next coherent unresolved member-facing slice)

**Status:** CHARTER PREPARED FOR FOUNDER REVIEW — **implementation NOT AUTHORISED / NOT STARTED**. S5 is NOT implemented. No read model, migration, API or route exists for S5.

**Experience Reference:** `Fkenogo/tiizi-prototye` @ `cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6` (adopted; EXPERIENCE REFERENCE ONLY). Product Truth and governed implementation remain authoritative.

**Charter rule (authority-first, as S3/S4):** canonical Product Truth → governed authority → persistence/read models → experience binding. Today **exposes** existing truth and adds only the bounded read contract named here. It must never become a second authority, and must never invent state.

---

## 1. Why S5 is next (sequencing reconciled against work actually completed)

EA-01 §D.3 fixed the order: … → S3 Challenge Experience → S4 Groups Experience → **S5 Today** → S6 Guide → S7 Templates → S8 Profile/Recognition/Support → S9 Operator → S10 Commercial.

Reconciled against `main` @ `a2275fe`:

| Slice | Actual state on main | Blocks S5? |
| ----- | -------------------- | ---------- |
| S1–S3 | COMPLETE / FOUNDER ACCEPTED / MERGED | no |
| S4 (a–d) | COMPLETE / FOUNDER ACCEPTED / MERGED | no |
| S6 | COMPLETE / FOUNDER ACCEPTED / MERGED (PR #60) | no — already done |
| Operator Console baseline | ACCEPTED / MERGED / CLOSED (PR #64/#65) | no |
| **S5 — Today** | **NOT STARTED — placeholder only** | **this slice** |
| S7 — Templates | **PF-06 NOT BEGUN**; PF-06 is the gate | n/a |
| S8 — Profile/Recognition/Support | **NOT implemented**; MOT-01 + donation/cause-custody authority unresolved | n/a |
| S9 — Operator | **PARTIAL only** (bounded Console baseline); production scheduler NOT implemented | n/a |
| S10 — Commercial | excluded pending commercial-model decision | n/a |

**Conclusion: S5 — Today IS the next coherent unresolved member-facing slice.** Its EA-01 entry condition ("S3 + S4 assembled") is satisfied. S7/S8/S9/S10 are all gated or deferred and none of them precedes Today in EA-01 ordering. There is **no Product Truth or capability dependency that blocks S5 itself** — but two capability gaps bound its first slice (§§5, 6, 7).

## 2. Accepted Product Truth for Today (binding)

- **EA-01 §D.3 / M2:** "Today — action home ordered required activity → challenge attention → invitations → upcoming → bounded recent-community summary linking to Group Feed."
- **EA-01 §D.2.4:** "Today after Challenge and Groups Experience — correct. Today composes required activity, attention, invitations and upcoming events from those slices; it cannot precede them without fabricating state."
- **T1 §O.1:** "Home is not a Feed. It is an accountability and operational dashboard… answers: *What matters to me right now?*"
- **T1 §O.5:** Home does not duplicate the Group Feed. Home answers "what matters to me"; Group Feed answers "what is happening in this Group?"
- **T1 §§P.4–P.6:** routine personal Activity is NOT auto-published; Feed is curated; system exhaust must not become Feed content.
- **FR-V2-128 / FR-V2-129:** SUPERSEDED by F-E-01 — Group Feed is the single community stream; there is **no Home Feed**.
- **FR-V2-130:** Feed is never a truth source.

**Today MUST NOT become:** a generic dashboard; a duplicate Challenges page; a duplicate Groups page; an Activity catalogue; a second social Feed; an analytics dashboard; a recommendation engine; a recognition engine; a notification centre.

**Note on T1 §O.2 items 3 and 5.** T1 §O.2 lists "results and milestones" and "recommendations" as Home priorities. EA-01 §D.3 (Founder-approved, later) is the operative sequence and **deliberately does not carry them into Today**; Recognition is S8/MOT-01-gated and recommendations are excluded by the "no recommendation engine" boundary. S5 therefore implements T1 §O.2 items **1 and 2 only**, plus bounded upcoming (item 4, Challenge-local calendar events only). Recorded as a **Founder decision required** (§11, FD-S5-001).

## 3. Element-by-element capability classification (A–E)

**Classification key.** A = capability exists and can be assembled now · B = Product Truth exists but capability/read model missing · C = experience-only assembly decision · D = genuinely deferred · E = Founder decision required.

| # | Proposed Today element | Class | Basis |
| - | ------------------------ | ----- | ---- |
| 1 | **Required / actionable Activity** — outstanding requirements today, missed streak day, pending today's logging | **B** (partly A) | Server truth exists (`ParticipationTruthState.dayStates`, `currentStreak`, `lastCompletedDay`; `ApiChallengeDetail.governingToday`/`serverNow`). **Gap:** no cross-challenge "my participations" read, and `doneToday` exists only client-side in `src/v2/challenges/progressView.ts`. Needs the bounded read model (§5). |
| 2 | **Challenge attention — active / starting / ending / final result** | **A** | `GET /v1/challenges` returns entitled Challenges with `myParticipation`; `GET /v1/challenges/:id` returns `startDate`, `endDate`, `timezone`, `governingToday`, `serverNow`, `finalized`, `finalizedAt`, frozen `final`. All Challenge-local, server-derived. |
| 3 | **Invitations / requests needing member attention** | **B → OMITTED at S5** | **No inbound invitation record or inbox read exists.** S4c provides only `listPendingMembershipsForMember` (the member's **own outgoing** join requests) and invite-**code** resolution. See §6. |
| 4 | **Upcoming commitments** — starting soon / ending soon | **A** (bounded) | Challenge-local `startDate`/`endDate` + governed IANA `timezone` + server `governingToday`. Uses existing Challenge-local calendar semantics; creates no second scheduling authority. |
| 5 | **Community moments / Group Feed** | **D — deferred** | No feed publication seam, no eligible-event enumeration, no Share-to-Group seam, no schema. Product Truth forbids a second stream on Home. See §7. |
| 6 | **Support Tiizi / Social Cause** | **D** at S5 | Support is voluntary, must not gate participation, no payment execution exists (S8). Cause approval is Operator authority. See §8. |
| 7 | Group/Challenge context (which Group a Challenge belongs to) | **A** | `GET /v1/memberships/me` returns memberships + pending memberships with bounded Group projection. |
| 8 | Notification badges / notification centre | **D** | S8. `/v2/notifications` is a placeholder on main. |
| 9 | Recognition / milestones / leaderboards | **D** | MOT-01-gated, S8. S4 §9.1 forbids Group leaderboards. |
| 10 | Discovery / recommendations ("Challenges in Your Groups You Can Join") | **D** at S5 | Recommendation engine is an explicit Today boundary. `GET /v1/groups/discover` exists but ranking/recommendation is out of scope and would duplicate the Challenges page. |

## 4. What Today will show (first slice — bounded)

Ordered, single-column, mobile-first:

1. **Greeting + governing date** — rendered from server `governingToday`/server clock, **never a client-formatted "now"**.
2. **Needs you now** (required/actionable Activity) — for each entitled active Challenge where today's requirements are not complete: Challenge identity, what's outstanding, and the existing governed log-activity action. Empty state when nothing is outstanding.
3. **Your challenges** (Challenge attention) — active Challenges with the member's own governed progress (current streak, days completed, collective contribution, competitive standing where applicable). **This is the member's own truth only — no other participants' data, no cross-Challenge ranking.**
4. **Starting soon / Ending soon** (upcoming) — bounded, Challenge-local calendar, capped and explicitly ordered.

**Every row links into the existing assembled experience** (Challenge detail / logging / Groups). Today **introduces no new write path**. The only mutation Today may trigger is the **existing** governed `POST /v1/challenges/:challengeId/activity` via the existing logging surface.

## 5. Required read model — one bounded server-authoritative projection

**Decision: a bounded member Today read model IS required.** Assembling from existing reads would require the frontend to fan out per-Challenge detail requests and re-derive `doneToday` client-side — exactly the "fabricating state" EA-01 §D.2.4 warns against, and it would duplicate the engine's own `governingToday` semantics. One coherent server-authoritative projection is therefore preferred over multiple frontend queries.

**Proposed contract: `GET /v1/today`** (authenticated; member identity resolved server-side from the token, never from the body).

- **Source authorities:** `challenge_participations` (own, cross-challenge), `challenge_participation_derived` (`ParticipationTruthState`), `challenge_activity_records` (accepted-only, for today's requirement satisfaction), `challenges` (`startDate`/`endDate`/`timezone`/`status`/type), challenge finalization rows, `memberships` (own), `members` (identity only).
- **Returned state:** `{ governingToday, serverNow, timezonePolicy, needsAction[], attention[], upcoming[], groups[] }` where each Challenge item carries `{ challengeId, name, groupId?, type, status, phase, myParticipation: { currentStreak, daysCompleted, completionStatus, todayComplete, outstandingRequirementCount, accumulatedValue, unit, finishingPosition? }, finalized?, finalAvailable? }`.
- **Privacy boundaries:** **member-scoped by construction** — the projection is built from `member_id` resolved server-side and MUST NOT return any other member's data, roster, identity, activity, or presence. Group projections use the existing bounded `ApiMembershipGroup` field set only (no roster, no steward identity, no invite code). Identity-smuggling and cross-member access MUST fail closed, matching the S4c pattern.
- **Ordering semantics:** fixed hierarchy — `needsAction` (outstanding requirements desc, then nearest end date), `attention` (active first, then by start date), `upcoming` (ascending start date, then ascending end date). Ties broken by canonical UUID for determinism.
- **Empty-state semantics:** an empty section is **omitted**, not rendered as an empty card; the page still shows the greeting. A member with no Challenges gets a single honest empty state pointing at the assembled Challenges/Groups destinations. Empty is never an error and never fabricates a placeholder item.
- **Timezone / calendar handling:** `governingToday` and all day-boundary logic are taken from the **existing engine** (`derivedTruth`, `challengeReads`) per Challenge, using each Challenge's governed IANA `timezone`; server clock only. The client MAY format but MUST NOT recompute. Member-local rendering of an already-resolved date is permitted; a client-computed "today" is not.
- **MUST NOT calculate:** no new scoring, streak, ranking, recommendation, eligibility, or "is the member behind" judgement; no cross-Challenge aggregation or composite score; no notification/event generation; no Group Feed or community event derivation; no payment, donation, contribution or cause state; no Recognition; no social-proof or peer-pressure metric; no invented counts.

## 6. Invitations — disposition

**Today does NOT surface invitations in the first S5 slice.**

- S4c (`TIIZI-S4C-DISCOVERY-JOIN-INVITATIONS.md`) explicitly excluded "invitation inbox/history/expiry/revocation/rotation". Verified on main: the only invitation-adjacent capability is **stored invite-code resolution** (code → group identity → existing governed join), and `listPendingMembershipsForMember` which returns the member's **own outgoing** `pending` join requests.
- There is **no inbound invitation entity, no pending-invitation table, and no "list my invitations" read**. An invitation inbox would therefore have to be invented.
- **Exact missing capability for a future invitations slice:** a governed inbound invitation record (who invited, which Group, when, expiry/revocation/rotation per S4c's stated exclusions) plus a member-scoped read and an accept/decline seam routed through the existing admission authority. Until that exists, Today shows **nothing** in this slot — not a fake inbox, not a placeholder implying one.

## 7. Group Feed — disposition for S5

**S5 does NOT include community moments.** Specifically:

- T1 §§O.1/O.5 and FR-V2-128/129 forbid a second community stream on Home; FR-V2-129 (superseded, settled by F-E-01) leaves Group Feed as the single stream.
- Verified on main: **zero** feed artefacts exist — no feed schema, no feed publication seam, no Share-to-Group seam, no client Feed. A repository-wide search for feed/post/timeline/broadcast/share capability across `api/src`, `api/migrations` and `src/v2` returns nothing.
- S4 Charter §10 already deferred the Feed for exactly this reason (insufficient implementation authority; the reference Feed implies forbidden behaviours).
- Therefore the correct option is **(1) omit community moments for the first S5 slice**. Option (2) is rejected because an empty "coming later" card would advertise a capability that does not exist and would re-open the Group programme by implication. Options (3) and (4) are rejected because no authoritative event/read model exists — inventing one would create a second feed.

Today MUST NOT create a feed, implement community broadcasting, auto-publish personal Activity, or silently reopen the Group Feed programme. **Group Feed remains deferred and is not an S5 prerequisite.**

## 8. Support / Social Cause — disposition

**Today carries no support-related attention at S5.** Support is voluntary and must never gate participation (T1 §W; the PR #64 Challenge surfaces already enforce this). S8 payment/contribution execution is NOT implemented, Cause approval is Operator authority, and Today must not become a donation dashboard. An S5 Challenge-attention row MAY carry a bounded informational note (e.g. "Cause pending approval" / "Support available") sourced from existing Challenge configuration only, with **no amount, no payment action, and no progress toward a fundraising Goal** (T1 W.7 — the fundraising Goal is distinct from the Challenge Activity Goal). Default: **no support block on Today at all**; defer entirely to S8.

## 9. Experience Reference binding (prototype → ADOPT / ADAPT / OMIT / DEFER)

Prototype Home is `src/components/today/TodayView.tsx` (verified at `cfa696f`), four sections: greeting/time-horizon → "Urgent Action Required Today" streak card → "Active Challenge Progress" → "Opportunities to Join" → "Community Moments".

| Prototype element | Disposition | Product Truth reason |
| --- | --- | --- |
| Section shell, single-column rhythm, section heading weight, orange action accent, "N Active Challenges" pill | **ADOPT** | Presentation assembly only; information hierarchy matches EA-01 M2. |
| Greeting "What to do today, {first name}" | **ADOPT** | Action-home framing; correct hierarchy. |
| Hardcoded date `"Tuesday, Sep 15"` | **ADAPT** | Must be server `governingToday` + Challenge timezone, never a literal (§5). |
| Streak card — Day X of Y, current/best streak, "Today's activities" checklist, Done/Pending | **ADAPT** | Structure adopted; values must come from engine `dayStates`/`currentStreak`/`governingToday`, not prototype `streakMeta`. |
| Fabricated countdowns (`"8h 24m remaining today"`, hardcoded `"6 days remaining in window"`, `"3 qualified finishers"`) | **OMIT** | Invented metrics; the "6 days" literal contradicts the prototype's own `startDate`/`endDate`. |
| Active Challenge Progress — Collective/Race cards, own contribution | **ADAPT** | Member's own governed progress only; no peer data. |
| Finishing standings / "Your Progress Toward Finish" / "84.5 / 100 km" analytics card | **OMIT** | Analytics dashboard; forbidden by the Today boundary. "3 qualified finishers so far" is an invented aggregate. |
| "Opportunities to Join: Challenges in Your Groups You Can Join" | **DEFER** | Recommendation engine; would duplicate the Challenges page. |
| "Community Moments" feed (peer logs, cheers) | **OMIT** | Second social stream; forbidden by T1 §§O.1/P.4 and no feed authority exists (§7). |
| Notification bell + live unread badge on Home | **DEFER** | Notification centre is S8; no governed notification read exists. |
| "Flagged: Midnight Ultra (review sample)" card with a Join CTA | **OMIT** | Prototype test fixture leaking into member-facing UI. |
| Reference chrome (`ExperienceBar` persona switcher, journey shortcuts, target simulator) | **OMIT** | Not product UI; must not contaminate the product surface. |
| Support/donation elements | **OMIT** | S8; no payment execution (§8). |

**Net:** the prototype contributes **presentation and hierarchy**, never mock data, mock authority, invented metrics, unsupported actions, or simulated behaviour.

## 10. Behaviour, empty states, privacy, exclusions

**Mobile-first.** Single column, one task per row, primary action reachable without horizontal scroll; progressive disclosure. **Desktop** widens to a bounded two-column presentation of the same ordered sections — it must not add sections, ranks, or comparisons.

**Empty / loading / error states (governed, as S1):**
- No participations → single honest empty state linking to Challenges/Groups.
- Nothing outstanding today → the "Needs you now" section is omitted; a quiet "You're done for today" confirmation is permitted (experience-only assembly decision, class **C**), carrying no new state.
- Challenge finalised → link to the existing S3d results surface; Today does not re-render results.
- Read failure → generic governed error state; Today MUST NOT silently show partial truth as complete.

**Privacy / integrity rules (binding):** member-scoped reads only; identity resolved server-side; no other member's data; no roster/steward/invite-code leakage; no client-recomputed calendar or streak; no client-authoritative actionability; cross-member access fails closed.

**Exclusions (binding on S5):** no Group Feed; no notification centre; no Recognition; no leaderboard/ranking; no recommendations; no Activity catalogue (S6 owns it); no duplicate Challenges or Groups pages; no payment/contribution/donation execution; no cause approval; no new scheduling authority; no analytics dashboard; no new write paths beyond the existing governed activity log; no V1 shell reuse (V1 remains frozen/reference-only per EA-01); no prototype code copied into Tiizi.

## 11. Founder decisions required

- **FD-S5-001 — Today scope confirmation.** Confirm S5's first slice implements T1 §O.2 items **1 and 2 plus bounded upcoming**, and **defers** T1 §O.2 item 3 (results/milestones → S8/MOT-01) and item 5 (recommendations → excluded), superseding the literal T1 §O.2 five-item list with the EA-01 §D.3 five-band order. *Genuinely required: T1 §O.2 and EA-01 §D.3 disagree on whether results/milestones and recommendations belong on Today.*
- **FD-S5-002 — Invitations deferred.** Confirm Today shows nothing in the invitations band until a governed inbound invitation record + read + accept/decline seam exists. *Genuinely required: EA-01 places invitations in the Today hierarchy, but no such capability exists; surfacing anything would fabricate it.*
- **FD-S5-003 — Group Feed omission.** Confirm S5 omits community moments entirely and does not re-open the Group programme. *Genuinely required: EA-01 §D.3 describes a "bounded recent-community summary linking to Group Feed"; the reference supplies a feed, but no Group Feed exists and Product Truth forbids a second stream.*

No other Founder decision is required. Everything else above is bounded by existing authority.

## 12. Implementation sequence (authorisation candidate — not authorised)

On Founder charter acceptance, S5 proceeds as:

- **S5a — Today read model (server).** `GET /v1/today` bounded projection per §5. Engine-reusing; no new engine semantics; no schema change expected (the projection reads existing tables). Governed tests: member scoping, cross-member denial, identity-smuggling rejection, timezone/`governingToday` correctness, empty state, ordering determinism.
- **S5b — Today surface (member).** Replace the `/v2/today` placeholder with the four ordered sections per §4, bound to `GET /v1/today`, mobile-first then desktop. Reuses the existing member shell, `V2Primitives`, and the existing logging action. No new routes, no new writes.
- **S5c — Founder preview + acceptance.** Preview at the FD-S3-001 slice-to-preview boundary; record acceptance; close S5.

Each step stops at a Founder-preview boundary. **None of this is authorised by this charter.**

## 13. Founder preview acceptance criteria

1. Today opens with no client-computed date; the displayed date equals the server `governingToday` for the member's timezone context.
2. "Needs you now" lists exactly the outstanding requirements for the governing day, from engine truth; a fully-complete day shows no outstanding work.
3. Challenge attention shows only the member's own participation/progress; no other member's identity, activity, or presence appears anywhere on the surface.
4. Upcoming is Challenge-local (each Challenge's own IANA timezone) and ordered; it does not introduce a second scheduling authority.
5. Empty states are honest and non-fabricating: no placeholder Challenge, invitation, or community item is invented.
6. No community feed, notification centre, recommendation list, leaderboard, analytics card, donation block, or payment action is present.
7. Mobile and desktop render the same ordered sections with no additional content on desktop.
8. Acting from Today uses the existing governed logging path; acceptance/rejection behaviour is unchanged from S3b.
9. A read failure produces the governed error state and never a partially-truthful Today.

## 14. Validation performed (charter task)

- Canonical base verified: `origin/main` @ `a2275fe2a80a4ec283e606412fadf91d1da4f468`; expected SHA matches.
- Prototype reference verified at `cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6`; read-only, unmodified.
- Every capability claim in §§3–5 verified directly against source on `origin/main` (`api/src/derivedTruth.ts`, `api/src/challengeReads.ts`, `api/src/challengeParticipations.ts`, `api/src/memberships.ts`, `api/src/challengeParticipationRoutes.ts`, `api/migrations/005_phase_c2b_activity_application.sql`, `src/v2/challenges/progressView.ts`, `src/v2/member/memberPages.tsx`, `src/v2/routes.tsx`).
- Group Feed absence verified by repository-wide search across `api/src`, `api/migrations`, `src/v2` — no artefacts.
- S4c invitation exclusions verified in `docs/experience/TIIZI-S4C-DISCOVERY-JOIN-INVITATIONS.md` and `api/src/memberships.ts`.
- `git diff --check` clean; **no application/runtime file changed** (documentation only).
- S5 NOT marked implemented; no implementation authorised.

---

**Files referenced:** `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` (v2.21), `docs/programme/TIIZI-V2-PROGRAMME-GUIDE.md`, `docs/experience/TIIZI-EA-01-PRODUCT-TRUTH-RECONCILIATION.md`, `docs/experience/TIIZI-EXPERIENCE-INTEGRATION-MAP.md`, `docs/experience/TIIZI-EXPERIENCE-REFERENCE-ADOPTION-RECORD.md`, `docs/experience/TIIZI-S3-CHALLENGE-EXPERIENCE-CHARTER.md`, `docs/experience/TIIZI-S4-GROUPS-EXPERIENCE-CHARTER.md`, `docs/experience/TIIZI-S4C-DISCOVERY-JOIN-INVITATIONS.md`, `docs/programme/TIIZI-PLATFORM-OPERATOR-CONSOLE-BASELINE-001.md`, `docs/programme/TIIZI-PLATFORM-OPERATOR-CONSOLE-ASSEMBLY-001.md`, `docs/programme/TIIZI-CHALLENGE-FOUNDER-EXPERIENCE-REVIEW-001-CORRECTION-003.md`, `docs/programme/STAGE-F-TIIZI-V2-PRODUCT-DEFINITION-DRAFT.md`, `docs/programme/STAGE-F-TIIZI-V2-FUNCTIONAL-REQUIREMENTS-DRAFT.md`, `docs/programme/STAGE-F-TIIZI-V2-CANONICAL-INFORMATION-CONTRACT-DRAFT.md`.
