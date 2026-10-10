# TIIZI — MEMBER COMPLETION ASSESSMENT 001

**Assessment date:** 2026-10-10
**Assessed base:** `365c958bf69f6d79ae262e81045abae9c777c19c` (canonical `main`; Master Programme v2.50; GF-04 closed, PR #77 superseded)
**Status:** **ASSESSMENT ONLY / NO IMPLEMENTATION AUTHORIZED. STOP FOR FOUNDER REVIEW.**
**Scope:** (A) V2 Profile, (B) V2 onboarding / profile completion, (C) Challenge Feed, (D) sequencing. This record authorizes nothing. The Master Programme is intentionally not updated.

## Founder disposition update (2026-10-10) — READ FIRST

This assessment is preserved as written (commit `0ee5da0`). The Founder has since superseded parts of its recommendations. **Where this document conflicts with `TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md`, that record governs.** Status of this assessment is unchanged: assessment only, no implementation authorized.

| Assessment position | Now |
|---|---|
| §A.7 / §A.9 / FD-MC-07: profile image blocked and deferred; pilot uses initials | **SUPERSEDED.** Media (profile, Group cover, Challenge cover) is required before pilot; MV-206 voluntarily adopted as external guidance. See `TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md` |
| §0.6 / §C.1 / §C.8 / FD-MC-09: Challenge Feed contradicts settled Truth; none for pilot | **SUPERSEDED.** Tiizi will have a governed Challenge-specific Feed, pre-pilot. See `TIIZI-CF-01-CHALLENGE-FEED-PRODUCT-TRUTH.md` |
| §B.7 / FD-MC-04: interests/goals not collected until a consumer exists | **SUPERSEDED.** Interests and goals are required onboarding components, for recommendation relevance only |
| §B.3: progressive, non-blocking, no interests/goals | **REVISED.** Still no V1 gate; a bounded interests/goals step is part of onboarding |
| §D.2: Challenge Feed last | **SUPERSEDED.** Re-planned sequence in the Disposition §10 |
| FD-MC-01 / 02 / 03 / 05 / 06 | **APPROVED / directed** as recorded in the Disposition |
| §C.6 migration 025 and outbox | **Stands.** 025 stays Group-Feed-specific; a Challenge Feed uses its own tables |
| §C.4 event matrix | Retained as the first-pass analysis; the revised proposal is CF-01 §4 |

The factual findings (§A–§C evidence, including the member-provisioning gap, the lost sign-up name, and the absence of recommendation logic noted in the Disposition) are unchanged.

## 0. Executive summary

1. **A brand-new V2 sign-up cannot use the product today.** Sign-up creates a Firebase Auth account only. Nothing creates the PostgreSQL `members` row, and every `/api/*` call from an unknown subject returns `401 unknown_member` (`api/src/auth.ts:121-124`; `api/README.md` "No auto-provisioning … not yet implemented"). `createMember` exists but has no caller. Member rows exist today only because preview scripts seed them. This is the real "onboarding" gap and it is infrastructure, not experience. It blocks pilot more than Profile or Feed do.
2. **V2 Profile is a placeholder** (`V2ProfilePage` → `V2Placeholder`, "Profile, recognition & notifications (S8)"). There is no profile table, endpoint, or editing authority. The only member "profile" is the Firebase display name cached in `localStorage`. The sign-up name is not even written to Firebase (`createUserWithEmailAndPassword` with no `updateProfile`, `src/context/AuthContext.tsx:81-88`), so it is lost on the next sign-in, which falls back to the email prefix.
3. **No governed human-readable member identity exists.** Other people render as "Tiizi member" (S4B). Profile display name is therefore a dependency of rosters, Race/Together attribution and any future Challenge Feed, not just of the Profile page.
4. **Product Truth for Profile is a ceiling, not a spec.** Stage F fixes the concepts (Member vs Profile, `displayName` required, optional photo/interests/goals/region/personalInfo/privacy) and IDP-01/IDP-02 are Founder-approved. The Profile Domain Standard explicitly **defers** field definitions, completion workflow, editing workflow, media, retention and deletion. IDP-03 (lifecycle/deletion) and IDP-04 (profile media) are **still pending** (unticked).
5. **Profile image is blocked, and there is no "approved media-storage work" in the repository.** I found no merged or open PR, branch, programme row or working record approving it. The direction is settled (S3-compatible store + API-issued signed URLs, ARCH-001), but the vendor is an open procurement choice (CF-001), IDP-04 is pending, and `storage.rules` cover only group/challenge covers. If an approval exists outside the repo, it needs to be brought in as a record before it can be relied on.
6. **A Challenge Feed contradicts settled Product Truth.** Stage F reconciliation F-E-01 SUPERSEDED FR-V2-128: "There is no Challenge-specific Feed and no separate Home Feed." GF-01 v1.1 only says finalized results "may later be incorporated into a separately authorized Challenge Feed", which is a future possibility, not authority. Building one needs a **new Founder decision that reopens a settled rule**. The most defensible interpretation of the Founder's need is likely achievable without a Feed (see §C.7).
7. **Recommended order:** member provisioning first, then one "Member Profile & Entry" programme (Profile before onboarding), with the Challenge Feed last and gated on a Founder decision.

## 1. Evidence base and boundaries

Authority order used: Founder-approved Product Truth and governance → current V2 PostgreSQL/domain code at the assessed SHA → accepted S1–S6/GF records → experience records (presentation only). V1 was **not** used as design input (AGENTS.md §1). Where V1 appears below it is cited from existing documentation purely as historical evidence of what must not carry forward. The frozen Experience Reference repository (`Fkenogo/tiizi-prototye`) is outside this session's repository scope and was **not** inspected; EA-01's reconciliation rows (M4, M27, M35) were used instead. Nothing was run against a database, deployed or accessed in production. Findings about runtime behaviour (e.g. `unknown_member` for new sign-ups) come from reading code, the API README and existing tests, not from executing a live flow.

Key sources: `docs/governance/domains/01-PROFILE-DOMAIN-STANDARD.md`; `docs/reports/platform-foundation-decisions/02-IDENTITY-PROFILE-AND-PRIVACY-DECISIONS.md` (IDP-01…04); `docs/governance/ownership/27-EOG-05-ENTITY-OWNERSHIP-REGISTER-APPROVED.md` (HID-01…08); `docs/programme/STAGE-F-TIIZI-V2-CANONICAL-INFORMATION-CONTRACT-DRAFT.md` §4.1, §4.2, §4.27; Stage F FRs §30 and the FR-V2-128/129 supersessions; `docs/product-truth/TIIZI-GF-01-GROUP-FEED-EVENT-CONTRACT.md` v1.1; `docs/experience/TIIZI-EA-01-PRODUCT-TRUTH-RECONCILIATION.md` (M4, M27, M35); `docs/architecture/TIIZI-V2-FORWARD-TECHNOLOGY-ARCHITECTURE-DECISION.md` and `TIIZI-CF-001-…`.

## A. V2 PROFILE

### A.1 What V2 Profile does now

- `/v2/profile` renders `V2Placeholder` ("Your profile is just getting started"). It reads no data (`src/v2/member/memberPages.tsx`).
- Reached only through the **account sheet** (`MemberShell.tsx`), which lists Activity Guide and Profile. The sheet states that account settings, language and sign-out "arrive with the next slices". **There is no sign-out in V2 member navigation.** The header account trigger is hard-coded `name="Member"`.
- Today greets by first name using `useAuth().profile.displayName`, i.e. Firebase display name cached in `localStorage` (`tiizi_profile`). Not a governed store, not server-side, not shared across devices.
- Persistence: `members(member_id, auth_provider, auth_subject, created_at, updated_at, role)` (migrations 001, 002). **No profile columns or table.** No `/api/me`, no member read/write endpoint other than `GET /api/memberships/me` (groups). Operator console has a members read for operators only.

### A.2 Placeholder / incomplete

Everything: page content, editing, display-name persistence, sign-out, language, privacy controls, recognition (MOT-01 deferred), Support Tiizi CTA (payment/contribution execution absent), notification preferences (Notifications is also a placeholder).

### A.3 Fields with canonical authority today

| Field / concept | Authority | Status |
|---|---|---|
| Member ID (UUID), auth mapping | `members` table; CIC §4.1 | **Canonical, implemented** |
| `displayName` | CIC §4.2 (**Required Information**) | **Authorized, not persisted** |
| `email` | CIC §4.1; "privileged-operational by default" | Authorized as Member data; not stored in PG; not shown to others |
| `photoURL` | CIC §4.2 optional | Authorized concept; **blocked** (IDP-04 pending, no storage) |
| `exerciseInterests[]`, `wellnessInterests[]`, `goals[]`, `region` | CIC §4.2 optional; HID-04/05 | Authorized concept; vocabulary should derive from Activity categories; **no approved consumer** (see A.4) |
| `personalInfo` (free-form object) | CIC §4.2 optional; FR-V2-185 | Concept only. IDP-01 says health/body/contact/birth-date must not be broadly readable. **Do not build** without a field list |
| `privacySettings` | CIC §4.2/§4.27; IDP-01/02 | Visibility classes approved; **no field-level matrix and no enforcement mechanism** |
| Consent record (version, time, source, user) | IDP-02 approved; HID-06/07 | Approved contract; **not implemented anywhere in V2** |
| Account status (active/suspended/deleted), lifecycle | CIC §4.1; IDP-03 | **IDP-03 pending**; no V2 mechanism |
| Recognition | EOG §33-36 | MOT-01 deferred |

### A.4 Deferred fields (no authority)

Field definitions beyond the CIC list; birthday, gender, height/weight (IDP-01 forbids broad readability; V1 collected them in Firestore); phone; bio; profile photo; account export/deactivate/delete (EA-01 M35 "FOUNDER (data-rights mechanism)"); retention. Interests/goals: the concept is authorized, but FD-S5 and the Groups correction state Goals/Focus Areas "confer no recommendation authority", and FR-V2-053 interest relevance is a MAY. So interests have no approved consumer, and collecting them now would collect data with no purpose (Profile Standard §9 rule 11: no undeclared purpose).

### A.5 Recommended classification (for the Founder decision pack, not a decision)

| Class | Fields |
|---|---|
| **Required identity/profile facts** | `displayName` (only) |
| **Optional profile facts** | `region` (low risk); photo (later, after IDP-04); interests/goals (later, when a consumer exists) |
| **Preferences** | Language/locale (V2 locale provider exists; persistence undefined); notification preferences (S8, depends on Notifications); interests/goals when authorized |
| **Privacy / visibility settings** | None until a field-level visibility matrix exists. IDP-02: a toggle that cannot be enforced must not ship. Pilot default: `displayName` is visible to **shared-group** members only; everything else Private. No toggles |
| **Privileged-operational** | email, provider ID, member UUID, any health/body/birth/contact data |
| **Consent** | Terms/Privacy version acceptance record (IDP-02), source = sign-up |

### A.6 Editing authority

Principle exists (CIC §4.2: Member is authority for own profile content; Participant Authority may express permitted preferences). The **workflow** (editing, validation, audit trail "Profile changes are audit-recorded (§4.28)", display-name history) is explicitly deferred by the Profile Standard §11. Authority to build an edit flow exists only for a self-service, member-only display-name change, and even that needs a short Founder disposition on audit/history and content policy. No other party (Group, Steward, Operator) gets edit authority.

### A.7 Profile image

**Blocked.** Reasons: IDP-04 pending; Profile Standard defers media lifecycle; no object-storage vendor or adapter; `storage.rules` have no profile path; V2 deliberately uses governed local gradients for Group/Challenge covers with "no upload pipeline" (Challenge Founder Experience Review 001). No "approved media-storage work" is recorded in the repo (§0.5). Pilot should use initials, not images. No Firebase Storage path should be reused (V1's `profile-photos` attempt had no rules and a data-URL fallback, per IDP-04 evidence).

### A.8 New schema / API / migration needed

Yes, for any real Profile: (1) a profile store keyed 1:1 by `member_id` (new migration 026+; CIC §4.2 says Profile has no independent identity, so either columns on `members` or a 1:1 table; this is an engineering design choice for the work package); (2) `GET/PATCH /api/me` (or equivalent via the canonical prefix constant); (3) a member-identity projection endpoint/field for shared-group attribution; (4) a consent record table if consent is captured (IDP-02); (5) member provisioning at the auth boundary (§B). **Migration 025 is unrelated and must not be touched.** No Firestore for any of this (AGENTS §2.3-2.4).

### A.9 Minimum pilot-ready Profile

1. Server-persisted `displayName`, set at sign-up (fixes the lost-name bug) and editable by the member only.
2. `/v2/profile` shows: name, email (own, read-only), groups and Challenges summary from existing reads, Activity Guide link, **sign-out**, Terms/Privacy links. No photo, no body data, no toggles, no recognition, no Support CTA until S8/payment authority exists.
3. `displayName` available to shared-group members through a governed projection (replaces "Tiizi member"), minimum-necessary only.
4. Honest empty states for deferred items; nothing that looks like a setting but does nothing.

## B. V2 ONBOARDING / PROFILE COMPLETION

### B.1 What a new V2 member receives today

Sign-in/sign-up (`V2SignUpPage`): name, email, password (or Google). On success: Firebase account; `localStorage` profile `{displayName,email}`; redirect to `resolveV2NextPath` (default `/v2/today`). `V2AuthGuard` = session check only. **No onboarding gate, no group prerequisite**, by deliberate S1 design (`v2NextPath.ts`, S1 record). Consent is a passive sentence with `/terms` and `/privacy` links; no recorded acceptance.

Then every API call fails `401 unknown_member`; Today shows the generic "We couldn't load your day"; Create Group maps the error to a sign-in prompt (`V2CreateGroupScreen.tsx:65`). The member never reaches a usable state without out-of-band seeding.

### B.2 What is missing

Member provisioning (blocking); persisted display name; consent record; first-run orientation; explanation of Group→Challenge model; entry paths for invited Group/Challenge states. Not missing by design: forced profile setup, interests, goals, body data.

### B.3 Blocking, progressive or hybrid?

**Recommendation: progressive / non-blocking, with one invisible blocking technical step (provisioning).** Basis: EA-01 M4 ("no forced setup"; states brand-new / no group / in-group-no-challenge / invited / active commitments), the S1 no-gate decision, the Profile Standard (completion workflow deferred), and minimum-necessary (FR-V2-183). The only fact Tiizi needs before use is a display name, which sign-up already collects. A hybrid (soft nudge on Profile, never a gate) is acceptable; a hard gate is not recommended because no required field beyond name has authority.

### B.4 Required before use vs deferred

| Before use | Deferred to Profile / later |
|---|---|
| Authenticated identity; PG member row (automatic); display name (collected at sign-up); acceptance of Terms/Privacy (recorded, versioned) | region, photo, interests, goals, preferences, notification prefs, language persistence, any personal/health data |

### B.5 Resume / re-entry

With no gate, re-entry is stateless: orientation is derived from server truth (Group count, participation) and an optional "seen" flag. Requirements: deep-link `next` already preserved; orientation must be dismissible and re-openable; Today already has states for no-group / no-challenge (S5b) and should remain the home for them. Any "seen orientation" flag is a client convenience unless the Founder wants it durable (then it needs a store).

### B.6 Consent / privacy

IDP-02 (approved): consent record with consent version, terms/privacy version, acceptance time, source, user identity; toggles must be enforceable. Needed for pilot: a versioned Terms/Privacy acceptance captured at sign-up. **Open:** who owns the legal text and its version identifier (the root `/terms` and `/privacy` routes exist but their content authority was not assessed). Withdrawal is prospective (CIC §4.27). No health/body consent flow is needed because those fields are not collected.

### B.7 Are interests/goals/preferences authorized V2 truth?

Concept: yes (CIC §4.2, HID-04/05). Collection at onboarding: **not recommended**: no approved consumer, recommendation authority explicitly not conferred, and V1 collected them as a gate. A Founder decision is needed to say what interests are *for* before they are collected.

### B.8 New domain authority required?

Member provisioning and consent are within already-approved authority (CIC §4.1, IDP-02) and need engineering design, not new Product Truth. Orientation content is experience-only (EA-01 M4). Interests/goals/personal info need a Founder decision first.

### B.9 Recommended pilot onboarding

1. Sign-up → automatic, idempotent, transactional member provisioning at the API auth boundary (`findMemberByAuth` then `createMember`), writing display name and consent record. Also fixes name persistence.
2. Land on Today (unchanged). Brand-new state shows a short, skippable "How Tiizi works" (Groups → Challenges → logging) with Create / Join / Discover actions. No forced fields.
3. Profile shows a quiet "complete your profile" only for items that have authority (none beyond name at pilot).
4. No V1 4/5-step flow, no interests/goals/privacy screens, no completion percentage.

**V1 note (historical only):** V1 stored interests, goals, body measurements, birthday, gender and privacy flags in Firestore `users/{uid}` behind route gates (`docs/superpowers/reports/phase-18I-6O-onboarding-audit.md`). That data model conflicts with IDP-01 minimal disclosure, is Firestore (excluded authority) and is not a V2 source.

## C. CHALLENGE FEED

### C.1 Authority state

- **FR-V2-128 SUPERSEDED**: no Challenge-specific Feed; Group Feed is the single community stream; Challenge-specific information is "presented through the Challenge experience itself, not through a Feed".
- **GF-01 v1.1** invariant 1: the Group Feed is "not a Home/Today stream or a Challenge-local stream". Finalization was removed from the Group Feed *because* it "would let Group Feed density drift into a Challenge Feed"; it "may later be incorporated into a separately authorized Challenge Feed capability — deferred/future authority only".
- Group Feed is unchanged: four families, no actor identity, no numbers, 90-day retention, keyset pagination (20/50), current-active-member read audience.
- Share, Kudos, Recognition, comments, reactions, announcements: all deferred/excluded (GF-01 §8, §12; FR-V2-133).
- Therefore a Challenge Feed has **no Product Truth**, and opening one would reverse a reconciliation decision. This is a Founder decision, not an engineering package.

### C.2 What exists in V2 for Challenge-level information

Challenge Detail (`/v2/challenges/:id`): hero, participation, type-specific live progress (Together contributors without rank; Race leaderboard; Streak daily consistency), results-pending and sealed finalized results (S3d). All reads re-prove visibility per request (`requireChallengeVisible`). Member names are not shown for other people (identity gap, §0.3).

### C.3 Available primitives

`challenges` (lifecycle timestamps), `challenge_participations` (join/exit episodes, immutable), `member_activity_events` / `challenge_activity_records` (accepted activity), `challenge_derived_state` / `challenge_participation_derived` (progress, goal reached), `challenge_finalizations` / `challenge_participation_finals` (sealed results, positions, streak outcomes), `activity_submission_intents`. All PostgreSQL, immutable or append-only. A Challenge-scoped event stream could be *derived* from these; none exists today.

### C.4 Candidate event classes

Legend: **A** = AUTHORIZED, **AS** = AUTHORIZED WITH EXPLICIT SHARE ONLY, **D** = DEFERRED / NEEDS PRODUCT TRUTH, **N** = NOT APPROPRIATE. "Authorized" here means only "not prohibited and already covered by existing Product Truth for *some* surface"; no Challenge Feed surface is authorized, so every row is conditional on the §C.7 Founder decision.

| Candidate | Class | Source of truth | Privacy risk | Actor visibility | Persist? | Dedupe / idempotency | Auto vs explicit | Duplicates Group Feed? |
|---|---|---|---|---|---|---|---|---|
| Member activity logged | **N** (auto) / **AS** (Share) | `challenge_activity_records` | High: routine personal activity, health-like detail | Would expose individual | Source only | Per accepted record | Auto prohibited (FR-V2-129, FR-V2-212, T1 §P.4) | No |
| Participant joined | **D** | `challenge_participations` | Medium: discloses a personal commitment; GF-01 NOT PUBLISHABLE for Group Feed | Named actor needs identity projection | Source | Per participation episode | Auto would need new Truth | No |
| Participant left | **N** | `challenge_participations` | High: discloses withdrawal/offboarding | n/a | n/a | n/a | Not appropriate | No |
| Streak progress/milestones | **AS** | derived/finals | Medium-high: personal | Self only unless shared | Share record | Per milestone | Explicit Share only (T1 §P.5/R.1); Share capability deferred | No |
| Together contributions | **D** | derived state / contributors | Medium: contributor attribution (S3c shows contribution without rank) | Named contributors need consent policy | Source | Per contribution | Needs Truth; aggregate only is safer | Partly (goal crossing) |
| Goal reached | **A** (already Group Feed) | `challenge_derived_state.collective_goal_reached` | Low (group-level) | None | Group Feed outbox | Existing unique key | Automatic | **Yes** — identical to `together_goal_achieved` |
| Race position / rank change | **N** | derived leaderboard | High: comparative/ranking, popularity pressure | n/a | n/a | n/a | GF-01 says NOT PUBLISHABLE | No |
| Challenge started / ended | **A** (already Group Feed) | `challenges.status` transitions | Low | None | Group Feed outbox | Existing | Automatic | **Yes** |
| Finalized results | **D** | `challenge_finalizations` | Medium: per-person results | Group-level summary low risk; individual high | Source is already immutable | Exactly-once by PK | v1.1 explicitly reserves this for a future Challenge Feed | No (removed from Group Feed) |
| Member result / share | **AS** | `challenge_participation_finals` | Medium-high | Self-chosen | Share record | Per share | Explicit Share only; Share not authorized | No |
| Comments | **N** | none | Moderation burden | n/a | n/a | n/a | FR-V2-133: none in initial V2 | No |
| Reactions | **D** | none | Popularity mechanics | n/a | n/a | n/a | Excluded (GF-01 §12, T1 §Q) | No |
| Kudos | **D** | none | Popularity, abuse | n/a | n/a | n/a | Operations undecided (FD-GF01-11) | No |
| Recognition | **D** | none | Credential implication | n/a | n/a | n/a | MOT-01 deferred; explicit Share only | No |
| Steward announcements | **D** | none | Free-form content moderation | n/a | n/a | n/a | No authoring authority (GF-01 §4) | No |

Result: **nothing is both new and clearly authorized.** The only auto-eligible rows duplicate the Group Feed; everything personal is Share-gated or deferred. A Challenge Feed built today would be either a re-skin of Group Feed events (duplication, which F-E-01 and v1.1 were written to prevent) or would require Truth that does not exist.

### C.5 Cross-cutting design answers (if a Challenge Feed is later authorized)

- **Retention:** no basis; Group Feed's 90 days is a Group Feed operating policy "not an invariant" of other domains. Needs its own decision.
- **Pagination:** reuse the GF-01 §7 pattern (keyset on source-transition time and UUID, signed cursor, 20/50) as a design precedent; it is not authority.
- **Membership visibility:** must recheck current Group membership *and* Challenge visibility per read (T1 §P.8, FR-V2-136/137). Challenge reads already do this.
- **Historical access:** unaddressed for Challenge scope; GF-01's "no former-member entitlement" would be the safe default, but past participants of an ended Challenge are exactly who would want it. Founder decision.
- **API / read model:** a new Challenge-scoped read (e.g. under the canonical API prefix) and a projection; none exists.
- **New migration?** Yes, a new migration (026+) and new tables. Not an extension of 025.

### C.6 Migration 025 and outbox reuse

- **Migration 025 must remain Group-Feed-specific.** `group_id NOT NULL`, `source_type CHECK ('challenge')`, an event-type CHECK that is already a superset of GF-01 v1.1 (still includes `challenge_finalized`), and group-named tables. It is **not deployed** and "MUST BE RECONCILED BEFORE MIGRATION 025 DEPLOYMENT" (GF-04 record). Widening it for another feed would compound that debt and couple two authorities. Not modified here.
- **Outbox pattern is reusable; the outbox is not.** The transactional-outbox + idempotency-key + rebuildable-projection + keyset-read pattern (`groupFeedPublication.ts`, `groupFeedReads.ts`) is sound precedent. But `recordChallengePublication` is called inside five domain write paths (establishment, activation, activity application, ending, finalization). A Challenge Feed must use its own recorder and tables, and its failure path must not be able to fail those transactions. Sharing the Group Feed outbox would let one feed's contract change break the other's. Also note no scheduler is deployed (`feed:process` is a manual internal command), so any new feed inherits the same operational gap.

### C.7 Smaller alternative that may meet the actual need

The need ("what is happening inside this Challenge?") is largely met by Challenge Detail's live progress and results, plus the Group Feed's four cards deep-linking to it. The missing piece that makes Challenge Detail feel lifeless is **human-readable member identity** (names on contributors and leaderboards), which is Profile work (§A), and an optional *Challenge activity summary* section derived from existing reads with no new store. Neither needs a Feed or a Founder reversal. I recommend the Founder confirm which problem a Challenge Feed is meant to solve before choosing.

### C.8 Recommended Challenge Feed scope

**None for pilot.** If the Founder reopens the concept, start from an assessment-to-Product-Truth step (a `CF-01`-style contract) before any engineering, limited initially to Group-level, actor-free, template-typed events plus finalized-results-ready, and leave personal items to a Share capability.

## D. SEQUENCING

### D.1 Dependency chain

```
Member provisioning (auth boundary) ─┬─> Profile (displayName store, /api/me, identity projection)
                                     ├─> Consent record
                                     └─> Onboarding orientation (needs working Today)
Profile identity projection ──> names on roster / Together contributors / Race / results
Profile + Share/Kudos Truth ──> Challenge Feed (and only after the §C.7 Founder decision)
Media storage (IDP-04 + vendor) ──> Profile photo (post-pilot)
```

### D.2 Recommended order

0. **Member provisioning + persisted display name + consent record**: unblocks every new user. Part of the Profile & Entry programme but should be its first, separately reviewable slice.
1. **Profile** (minimum pilot scope above), including the shared-group identity projection.
2. **Onboarding orientation** (progressive, non-blocking): small, mostly experience, depends on 0 and benefits from 1.
3. **Challenge Feed**: last, behind a Founder decision; likely replaced by identity-enriched Challenge Detail.

### D.3 One programme or two?

**One programme ("Member Profile & Entry") with independent slices**, because provisioning, consent, display name and identity projection are shared dependencies of both. Keep the Challenge Feed a **separate, independent capability** with its own Product Truth gate.

## E. REQUIRED FOUNDER DECISIONS

| ID | Decision | Why it is needed |
|---|---|---|
| FD-MC-01 | Approve member auto-provisioning at the API auth boundary (create on first authenticated request, idempotent) | `api/README.md` marks it intended-but-unbuilt; affects account creation |
| FD-MC-02 | Profile pilot field set: confirm `displayName` required, `region` optional, no photo/body/birth/contact data | Profile Standard defers field definitions |
| FD-MC-03 | Display-name visibility: shared-group only? Uniqueness? Content policy? Change history? | IDP-01 matrix incomplete; CIC §4.2 "previous names may be retained" |
| FD-MC-04 | Decide the purpose of interests/goals before collecting them | No approved consumer; recommendations not authorized |
| FD-MC-05 | Terms/Privacy ownership, version identifier, and capture at sign-up | IDP-02 consent record has no V2 implementation |
| FD-MC-06 | IDP-03 account lifecycle/deletion/retention (pending) | Needed before data export/deactivate and before real personal data scales |
| FD-MC-07 | IDP-04 profile-media ownership + object-storage vendor/procurement | Blocks profile photo; confirm whether any approval exists outside the repo |
| FD-MC-08 | Whether the member identity projection may show display names in rosters/Race/Together contributors | Changes S3c/S3d/S4B "no identity" posture |
| FD-MC-09 | Whether to reopen "no Challenge-specific Feed" (FR-V2-128 / F-E-01), and the problem it should solve | Reverses settled Product Truth |
| FD-MC-10 | If reopened: Challenge Feed event allow-list, audience/history, retention, Share/Kudos prerequisites | No Truth exists |
| FD-MC-11 | Sign-out/account actions and Support Tiizi CTA scope in the pilot Profile | Account sheet currently has none; payment authority absent |

## F. PROPOSED NEXT WORK PACKAGES (none authorized)

| WP | Title | Depends on | Notes |
|---|---|---|---|
| MC-1 | Member provisioning + persisted display name + versioned consent record | FD-MC-01/02/05 | New migration 026+; fixes lost sign-up name; API tests for idempotency and concurrent first requests |
| MC-2 | Profile Product Truth contract (pilot) | FD-MC-02/03/04/08 | Docs-only, like GF-01; field list, visibility matrix, edit/audit rules |
| MC-3 | V2 Profile read/self-edit (`/api/me`, `/v2/profile`, sign-out) | MC-1, MC-2 | Initials avatar; no photo; honest empty states |
| MC-4 | Member identity projection for shared-group contexts | MC-2, FD-MC-08 | Replaces "Tiizi member" in roster, contributors, Race, results; minimum-necessary |
| MC-5 | New-member orientation on Today | MC-1 | Progressive, skippable, experience-only |
| MC-6 | Challenge Feed Product Truth decision (assessment → contract) | FD-MC-09/10 | Docs/decision only; no engineering until accepted |
| MC-7 | Profile media (later) | FD-MC-07, vendor, IDP-04 | Post-pilot; S3-compatible adapter + signed URLs |

Suggested order: MC-1 → MC-2 → MC-3 → MC-4 → MC-5; MC-6 in parallel as a decision track; MC-7 deferred. Also recorded, not part of this assessment: reconcile migration 025's event-type CHECK before any deployment; no scheduler exists for `feed:process`, lifecycle or expiry jobs.

## G. Findings summary

- **Authority gaps:** Profile field definitions, edit/completion workflow, account lifecycle (IDP-03), profile media (IDP-04), field-level visibility matrix, consent capture, Share/Kudos/Recognition operations, Challenge Feed concept itself.
- **Implementation gaps:** member provisioning; display-name persistence (and loss bug); `/v2/profile` content; sign-out; member identity projection; consent record; orientation.
- **Schema/API gaps:** profile store, `/api/me`, identity projection, consent table, (if ever) Challenge Feed tables and read API. All need migration 026+.
- **Media:** blocked; no approved record found in repo; direction settled, vendor not.
- **Privacy/consent:** IDP-01/02 approved but unenforced and unimplemented in V2; `email` must stay privileged; no health/body/birth/contact collection at pilot.

## H. Boundaries confirmed

Assessment only. No Profile, onboarding or Challenge Feed implementation. No change to GF-01/02/03/04, Group Feed Product Truth, migration 025, or any migration. No scheduler, media upload, Kudos/Recognition/Share/comments/reactions. No V1 reuse. No deployment, no production access, Master Programme unchanged.

**Disposition:** TIIZI MEMBER COMPLETION ASSESSMENT 001 — COMPLETE / AWAITING FOUNDER REVIEW. ASSESSMENT ONLY / NO IMPLEMENTATION AUTHORIZED.
