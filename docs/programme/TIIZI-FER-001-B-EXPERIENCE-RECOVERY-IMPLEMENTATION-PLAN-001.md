# TIIZI-FER-001-B — Experience Recovery Implementation Plan 001

**Status:** PROPOSED PLAN — planning only. **Implementation NOT AUTHORIZED.** Each package below needs its own Founder/Technical Lead authorization. No migration, media/payment configuration, deployment, production access or pilot launch is authorized by this document.
**Source baseline:** `origin/main` `542052c12ca7910a297da89f28ae01120b220980`; Master Programme v2.80; PR #107 open at `9e5477b`. Code facts below were read at that commit (`file:line` references are to it) and must be re-verified when a package starts.
**Depends on:** [A — Founder Decision Reconciliation 001](TIIZI-FER-001-A-FOUNDER-DECISION-RECONCILIATION-001.md) (FDR-01…06, Q1–Q7). **Companion:** [C — Current Work Reconciliation](TIIZI-FER-001-C-CURRENT-WORK-RECONCILIATION.md). **Principal reference:** [Founder Experience Recovery Baseline 001](../reports/TIIZI-V2-FOUNDER-EXPERIENCE-RECOVERY-BASELINE-001.md).
**This is not a roadmap.** It is a page-by-page work breakdown inside the existing Master Programme; sequence and status remain the Programme's.

## 1. Programme reconciliation (Programme Controller)

### 1.1 Historical technical completion — preserved, not reopened

| Area | Recorded state (Master Programme v2.80 / Disposition) | Evidence relied on here |
|---|---|---|
| Groups S2–S4 (establishment, Group Home, Members, Discovery/Join/Invitations, Settings) | COMPLETE / FOUNDER ACCEPTED / MERGED | Group wizard (5 steps), Home, Discover, Settings exist in `src/v2/groups/*` |
| Challenges S3a–S3d, S6, Challenge Page review | COMPLETE / FOUNDER ACCEPTED / MERGED | 7-step wizard, listing, detail, logging sheet, Together/Race/Streak result views |
| Today S5a–S5c | COMPLETE / FOUNDER ACCEPTED | `V2TodayScreen.tsx`, `GET /api/today` |
| Group Feed GF-01…04 | COMPLETE / FOUNDER ACCEPTED (migration 025 NOT deployed; CHECK-gap reconciliation pending) | `api/src/groupFeed*.ts`, `V2GroupFeedScreen.tsx` |
| MC-1 Member Bootstrap | COMPLETE as code (migration 026 NOT deployed) | `api/src/memberBootstrap.ts` |
| MC-2 Profile Foundation | Profile page, display-name edit/history, Group/Challenge summaries exist; **MC-2C legal presentation CONDITIONAL; MC-2D NOT STARTED** | `V2ProfileScreen.tsx`, `memberProfile*.ts`; migrations 026/027 not deployed |
| MC-3, MC-4, REC-1, MEDIA-1/2/3, CF-2…6, STEW-1, LIFE-1, BG-1 | **NOT STARTED** (verified: no code) | greps of `api/src`, `api/migrations`, `src/v2` |
| S8 payments / S9 production scheduler | NOT implemented | Programme v2.80 |

### 1.2 Current integrated-experience acceptance — shown separately

Per baseline §A, historical package acceptance is **not** current integrated-journey acceptance. This plan therefore adds one **derived** register (the "findings-and-acceptance register" the baseline permits) — a table inside the existing Technical Control Board, not a new document type — with one row per page and the states *preserve/verified · correction required · implementation missing · deferred by decision · needs Founder decision*. Initial values from this audit:

| Page | Integrated acceptance now | Basis |
|---|---|---|
| Welcome / registration | **Implementation missing** (welcome); registration exists, no legal line (`V2SignUpPage.tsx:162` "not published yet") | no slides in `src/v2` |
| Personalization (Interests/Goals) | **Implementation missing**; Q1 | no storage/API/UI |
| Discovery | **Correction required**: chronological only (`groupDiscovery.ts:120`); Challenge→Group join dead-ends | `V2ParticipationSection.tsx` copy only |
| Today | **Correction required**: no reminder, no pending-first, one generic empty state; logging navigates away | `todayView.ts` preserves server order; `V2TodayScreen.tsx:159,359` |
| Groups list/Home/wizard | **Preserve/verified**; Details **correction required**; Settings selector **correction required** | `V2GroupHomeScreen.tsx:433-497`; `V2GroupSettingsScreen.tsx` free-text |
| Member names | **Implementation missing** (MC-4): "Tiizi member" at `V2GroupHomeScreen.tsx:424`, `V2PendingApplications.tsx:11`; "A fellow participant" in 5 Challenge views | no name in roster/pending/race/collective payloads |
| Challenges list/detail | **Preserve**; description/actions **correction required** | `V2ChallengeHero.tsx:123-163` |
| Challenge wizard | **Preserve**; Activity Guide return **critical defect (verified)**; hosting search, labels, reps **correction required**; 118 catalogue **fixture defect** | see P0/P5 |
| Profile | **Correction required**: avatar opens a sheet (`MemberShell.tsx`); missing sections | baseline B.5 |
| Support Tiizi | **Implementation missing** (nothing on main; PR #107 info-only candidate) | C |
| Challenge Feed / Kudos / Share | **Implementation missing**; deferred by FD-PILOT-01 → restored by FDR-05 | no code |
| Media | **Implementation missing**; gradients/initials work | no code |

### 1.3 Dependencies and Founder approvals still required

- Technical: stable IDs for the 12 Interests (Disposition §5.3) → Interests persistence → ranking; MC-4 name projection → roster, pending list, race/collective, Feed name items; MEDIA-1 → MEDIA-2; CF open items (A §Q3) → CF-2/5; BG-1 only for *production* Feed draining.
- Legal/ops: MC-2C approved legal text → acknowledgement record/18+ gate (nothing here approves legal copy).
- Founder: A §Q1–Q7; written authorization per package; Founder acceptance per page (section 4).

## 2. Architecture checks (summary)

Preserve: creation engines; `cover_id` gradients as media fallback; `focus_tags`/`goal_ids`/custom fields; Log Activity sheet and `loggingIntent.ts` idempotency; Group Feed untouched (CF-01 forbids cross-reads and requires the family invariant test unchanged). Add **no**: second API, second media pipeline, second logging engine, participation/eligibility restriction from preferences, automatic sanctions from "what we avoid", comments/replies, in-app payment execution.

## 3. Sequence

`Gate 0 → P0 → P1a → P8a → P1b → P1c → P2 → P3 → P4 → P5 → P6 → P7 → P8b → Integrated walkthrough`

Rationale (differs from the baseline's numeric order only where noted: P0 is added, P8 is split into P8a/P8b and moved earlier): **P0** is a small set of independent, dependency-free defect fixes that unblock Founder walkthroughs of everything else (critical Activity Guide bug; 118 fixture). **P8a** (visually complete Support Tiizi with placeholders) moves up because it needs only the Profile shell (P1a) and no backend. **P1b/P1c** carry migrations and privacy risk and are not rushed ahead of visible fixes. P6 media precedes P7 only for Challenge covers; **P7 does not depend on media** (no media in the Feed). Nothing runs in large parallel rewrites; packages P1c, P6 and P7 must not run concurrently with another migration-owning package.

### Gate 0 — Record the disposition (documentation only)
Founder approves A. Technical Lead adds the A §7 programme row and the register in §1.2 to the Technical Control Board. Review PR #107 per C. Reviewer: R0. Acceptance gate: Founder approval of A.

---

### P0 — Critical defects and preview fixture
**Outcome:** Selecting an Activity from the Activity Guide returns to the same wizard step with all draft state intact; the disposable preview shows all 118 Activities; roster refreshes after approval.
**Source baseline:** `542052c` after Gate 0.
**Preserve:** wizard draft model (`challengeCreationDraft.ts`, route-state restore), PF-04 composer, canonical Activity definitions, `loggingIntent`.
**Confirmed defects (verified):**
1. Stateless Guide links drop the draft — `V2ChallengeCreationWizard.tsx` (`StepActivities` intro `<Link to="/v2/guide">`, ~:598) and `ActivityLibraryScreen.tsx:151-157` carry no route state; `:295` "Use in Challenge" navigates to `/v2/challenges/new` with no draft/step, resetting to step 0. The in-wizard row link path (`:660-666` → Guide "Add to this Challenge" → wizard route-state restore `:134-165`) works.
2. Fixture: migration 014 seeds 2 Activities; the 118 exist only via `npm run knowledge:import-s6` (imports as `draft`, `knowledgeCatalogueImport.ts:362`) **plus** a publish step. No preview seed does either.
3. `useReviewGroupApplication` (`useV2Groups.ts:130-142`) does not invalidate `['v2-group-roster', groupId]`; join/leave do.
**Files likely affected:** `V2ChallengeCreationWizard.tsx`, `ActivityLibraryScreen.tsx`, `challengeCreationDraft.ts` (route-state helper), `useV2Groups.ts`; preview seed scripts and a documented fixture procedure (no canonical content changes).
**Missing:** end-to-end check that all 118 are `challengeEligible` and composer-selectable (importer `readyForIngestion` report not yet run).
**Dependencies:** none. **PR #107:** none.
**Tests:** extend `scripts/testS6ChallengeActivityDiscovery.ts` for stateless-link and "Use in Challenge" paths (draft + step preserved; browser Back; refresh); `api/test` or script asserting composer returns 84 Fitness + 34 Wellness against the seeded preview DB; roster-invalidation guard test.
**Mobile-preview scenarios:** (a) fill steps 1–3, tap Activity Guide link, open an Activity, "Use in Challenge" → back at step 4 with Activity selected and steps 1–3 intact; (b) repeat via Guide list card; (c) preview Activity list shows 118 (filterable 84/34); (d) steward approves a request → roster shows new member without reload.
**Risk:** Low (R1).  **Reviewer:** R1 (distinct session).  **Founder gate:** walks scenarios a–d on mobile preview; records pass/fail per scenario.

### P1a — First entry shell: welcome and full Profile page
**Outcome:** Four swipeable, skippable slides before registration; avatar opens a full **My Profile** page; account sheet reduced to quick actions.
**Preserve:** sign-in/up, MC-1 bootstrap, `V2ProfileScreen.tsx` sections (display name, email self-visible, Groups, Challenges), small sheets for narrow edits.
**Existing:** no slides anywhere; avatar → bottom sheet listing Activity Guide / Profile (`MemberShell.tsx` ~:35-39, :94, :125-164); routes public only for `sign-in`/`sign-up` (`routes.tsx:89-90`).
**Scope:** new public `welcome` route with the four baseline slides (no WhatsApp/migration wording); skip, resume and "seen" flag (device-local acceptable as interim; no schema); avatar → `/v2/profile`; Profile section order scaffold per B.5 (placeholders only for sections whose capability is not yet present — never promise notification preferences, recognition or account actions not implemented). Registration unchanged (no questionnaire).
**Files:** `routes.tsx`, new `src/v2/onboarding/*`, `MemberShell.tsx`, `V2ProfileScreen.tsx`, `V2Locale.tsx`, boundary/route guards.
**Dependencies:** Q6 (public welcome route). **PR #107:** reusable only `orientationState.ts` seen-flag pattern and skippable layout; its slides are five (not four) and post-sign-in; do not merge wholesale (C).
**Tests:** welcome guard (four slides, skip, pre-auth reachable, no data calls); `testV2AuthReturnPaths.ts` regression; `testMobilePrimaryNavGuards.ts`; `testV2ProfileGuards.ts`; `npm run test:boundary`.
**Mobile scenarios:** new visitor sees 4 slides, skips from any slide, lands on sign-up; returning user not re-shown; avatar tap opens Profile page; Sign out and Activity Guide reachable.
**Risk:** Low–Medium (R1; touches shell routes).  **Reviewer:** R1.  **Founder gate:** welcome + Profile shell on mobile.

### P8a — Support Tiizi screen (placeholders; no payment capability)
**Outcome:** Prominent, permanent Profile entry opening a Support Tiizi screen: free-and-voluntary explanation, KES 500/1,000/2,000/5,000/Custom, frequency intention, clearly marked **non-payable placeholders** for recipient, holder name and WhatsApp; no active copy/payment/WhatsApp actions; no totals, meters or receipts.
**Preserve:** FD-PILOT-01 §16.8 (Challenge-level Support a Cause/Tiizi untouched).
**Existing:** nothing on main. PR #107 `V2SupportTiiziScreen`/card is a clean information-only shell (no payment controls, no network call) but contains a live `mailto:` of an unverified address and lacks amounts/frequency/placeholders (C).
**Files:** `src/v2/support/*`, Profile section, route; content in one config module with an explicit `activated: false` guard so real details can only be supplied by a later authorized change.
**Dependencies:** P1a (Profile page). Reuses #107 layout by cherry-pick or re-implementation.
**Tests:** guard asserting no `tel:`, `wa.me`, `mailto:` or copy control while placeholders are active; no number-like strings; no "paid/received/total" copy; frequency not persisted; boundary test.
**Mobile scenarios:** reach from Profile in ≤2 taps; select each amount and Custom; select frequency; confirm all contact lines read "placeholder – not payable".
**Risk:** Low (R1) — but **trust-sensitive copy**; Founder reviews wording.  **Reviewer:** R1.  **Founder gate:** screen acceptance as *placeholder-complete*; explicitly **not** payment acceptance.

### P1b — Optional Interests and Goals (persistence, onboarding, Profile edit)
**Outcome:** After account creation, two independent skippable steps (Interests 0–5, Goals 0–3), editable/clearable in Profile.
**Existing:** no member storage/API/UI; 9 Goals have IDs (`groupVocabulary.ts:17-27`); 12 Focus Areas are labels only (`groupVocabulary.ts:2-15`, `groupFocusAreas.ts:7-20`).
**Scope:** mint stable Interest IDs (additive, same 12 concepts; no Group data rewrite); member storage (**migration — number assigned at start**); extend `GET/PATCH /api/me` or sibling route (no second profile API); onboarding steps + Profile section; allow empty selections; each change audited with the member as actor (Disposition §4); explanatory copy that preferences never gate anything.
**Dependencies:** A FDR-01; Q1; MC-1/MC-2 present. **Risk:** Medium–High (migration, personal data) → **R2**, distinct reviewer.
**Tests:** `api/test` for bounds (0–5/0–3), clear, idempotent PATCH, owner-only visibility, unknown-ID rejection; UI guard for independent skip; migration test per existing pattern.
**Mobile scenarios:** skip both; choose 3 + skip goals; choose 5 (6th blocked); edit/clear in Profile; browse Groups/Challenges afterwards unaffected.
**Founder gate:** walkthrough of skip/edit/clear paths. **No deployment of the migration.**

### P1c — Member display names in authorized contexts (MC-4 minimum)
**Outcome:** Group roster, pending join requests and Challenge participants show display names instead of "Tiizi member"/"A fellow participant"; a neutral fallback only where `display_name` is NULL or context is unauthorized.
**Existing:** roster `{memberId, relationship, joinedAt}` (`groupReads.ts:466`); pending `{memberId, requestedAt}` (`groupReads.ts:339-348`); race/collective payloads carry no names (`V2CollectiveProgress.tsx:114`, `V2CompetitiveProgress.tsx:125,149`, `V2FinalizedCompetitiveResult.tsx:101,125`). Labels at `V2GroupHomeScreen.tsx:424`, `V2PendingApplications.tsx:11`. `members.display_name` nullable (migration 026).
**Scope:** read projections joined to `members.display_name`, scoped to the viewer's authorized Group/Challenge; no email, auth ids or previous names; no directory. Preserve `s3dRaceMemberIdentity` guarantees.
**Dependencies:** MC-2 names; FD-MC-03; FD-PILOT-01 §16.6. **Risk:** High (privacy/authorization) → **R2**.
**Tests:** `api/test` authorization matrix (member, non-member, pending, exited, discoverable-only); no-leak assertions; fallback for NULL names; UI guards.
**Mobile scenarios:** two disposable members in one Group see each other's names; a non-member sees none; steward sees applicant names; Race/Together/Streak views.
**Founder gate:** names visible exactly where authorized.

### P2 — Discovery and relevance
**Outcome:** Groups + Challenges discovery after optional personalization; suggestions ranked by current Interests/Goals **inside the existing discoverable set**; always a general fallback; invite-code entry; Challenge→host Group join/approval→return to the Challenge's own Join.
**Existing:** Group discovery ordering is `created_at DESC` (`groupDiscovery.ts:120`); no Groups+Challenges tab shell; invite flow works (`V2GroupInvitePanel`, `groupMutationRoutes.ts:300,364`); Challenge Join exists (`challengeParticipationRoutes.ts:129`); **no path** from the non-member prompt to the Group join and back (`V2ParticipationSection.tsx` ~:151).
**Scope:** optional preference-aware ordering (relevance only; ties and no-match fall back to current order; no hiding); discovery shell; returnTo from Challenge → Group join/approval → Challenge. Never auto-join; never create participation from preferences.
**Dependencies:** P1b; P1c optional. **Risk:** Medium (R1; R2 if ranking touches visibility predicates). **Reviewer:** R2 recommended for the ranking query.
**Tests:** ranking never adds items outside the authorized set; empty preferences = current order; round-trip test; approval-required path returns to Challenge after approval.
**Mobile scenarios:** with/without preferences; no-match; Challenge in unjoined Group (open + approval-required); invite code.
**Founder gate:** discovery and join-return walkthrough.

### P3 — Today recovery
**Outcome:** compact Streak reminder under the greeting; pending Streak cards first; completion acknowledgement; multi-Streak summary; three differentiated empty states; "Your Ongoing Challenges"; Log Activity opens the existing sheet in context.
**Existing:** "Required today" section already first with engine states `completed|pending` (`today.ts:50-62`, `V2TodayScreen.tsx:148-163`); `todayView.ts` preserves server order, no re-sort; single generic empty state (`:133-145`); Today's button only navigates to Challenge detail (`:159,359`); the sheet is `V2LogActivityDialog` (`V2LoggingSection.tsx:397`) needing a Challenge `detail`.
**Scope:** presentation re-order of **engine-provided** states only (UI never invents due/missed); empty-state variants from membership/participation facts already in the projection; mount the exported dialog from Today (fetch detail on demand), refresh Today after success; reuse `loggingIntent` idempotency.
**Dependencies:** none hard. **Risk:** Medium (R1). **Reviewer:** R1.
**Tests:** `todayProjection.test.ts` unchanged; `testS5bTodayGuards.ts` extended (ordering, reminder, empty variants); double-submit guard; refresh after log.
**Mobile scenarios:** 0/1/3 Streaks due; one completed; no Group; Group no Challenge; participating; log from Today and see authoritative refresh.
**Founder gate:** Today walkthrough with all three Challenge types.

### P4 — Groups targeted corrections
**Outcome:** About Group shows description, established date, member count, Steward (and creator only per Q2), Group Interests, Goals, culture, joining/discoverability, permissions — no fabricated values; sheet fits mobile with inner scroll and always-reachable Close; Settings uses the same selectable vocabulary; culture step gains optional "what we avoid" plus one bounded creator-defined expectation (**no automatic sanctions**); "Focus Areas" → "Group Interests" in member copy.
**Existing:** sheet `V2GroupHomeScreen.tsx:433-497` does not render `createdAt` (available, `groupsApi.ts:112`, null on discoverable subset) or count/steward name; nested `max-h-[72dvh]` (`V2GroupHomeScreen.tsx:434`) inside the outer panel `max-h-[92dvh]` (`V2Primitives.tsx:547`); Close not sticky; `focused` variant exists with scroll lock; Settings Focus Areas is comma-separated text (`V2GroupSettingsScreen.tsx:18-40`), Goals/norms not editable in Settings; no creator column; norms are six positive canonical items (`groupVocabulary.ts:29-36`).
**Scope:** read-only content additions from existing fields; sheet sizing via existing `V2Sheet` variants; Settings chip selector reusing `fetchGroupOptions` and existing caps; "what we avoid" vocabulary **needs Founder-approved wording (A §Q7)**; keep `focus_tags`, `goal_ids`, custom handling.
**Dependencies:** P1c for Steward name; Q2 (creator); Q7 (wording). **Risk:** Low–Medium (R1); R2 if a creator column/migration is approved.
**Tests:** `testS4aGroupHomeGuards.ts` additions (created date, count, no null labels); sizing guard; settings selector parity with wizard; `s4dGroupSettings.test.ts` regression.
**Mobile scenarios:** About on 360×640 and 390×844: scroll, Close visible; Group with/without optional fields; Steward edits Interests via chips.
**Founder gate:** Group Details + Settings on mobile.

### P5 — Challenge targeted corrections
**Outcome:** description excerpt with **Read more/less**, Log Activity and Leave beneath it; hosting Groups listed on search focus and refined while typing; step 3 labelled **Name & Appearance**, with copy distinguishing Support a Cause from Support Tiizi (wording only; §16.8 unchanged; no Challenge-level payment destination added); "reps" in member UI; Together/Race/Streak verified end to end.
**Existing:** hero clamps 3 lines with "Read more" opening a sheet, no "Read less"; actions share a row at `sm+` (`V2ChallengeHero.tsx:120-163`); hosting list renders only when search is non-empty (`StepHosting`, `:457-520`); label `'Challenge details'` (`challengeCreationDraft.ts:43`); `UNIT_LABELS reps: 'repetitions'` (`challengeCreationDraft.ts:115`; `unitLabel` used at wizard `:716,:923`); canonical unit string `reps` unchanged.
**Preserve:** listing, filters, logging sheet, review/create, "join this Challenge" choice; hosting eligibility remains server-validated at establishment.
**Dependencies:** P0 for the Guide fix. **Risk:** Low (R1). **Tests:** extend wizard/draft guards (label, reps, focus-list), hero layout guard, S3 result tests unchanged. **Mobile scenarios:** long description expand/collapse; actions below text; focus search shows eligible Groups; review shows "reps"; run one Challenge of each type through logging to result.
**Founder gate:** Challenge detail + wizard walkthrough for all three types.

### P6 — Shared media (profile image, Group cover, Challenge cover)
**Outcome:** optional uploads with gradient/initials fallback; one capability, three consumers.
**Existing:** no media code, table, route or bucket; profile image `{status:'not_configured'}` (`memberProfileRoutes.ts:56,76`); covers are allowlisted ids (migrations 018, 022); legacy V1 storage code is excluded and **not** reused.
**Scope (in order):** MEDIA-1 decision record (upload mode, limits, variants, takedown, budget owner) → MEDIA-2a ObjectStore port + R2 adapter (**R2 account/credentials/non-production environment authorized separately**) → 2b profile image → 2c Group cover (Steward) → 2d Challenge cover (§8.6 authority) → MEDIA-3 preview. Media references stored in Tiizi-owned asset records, never provider URLs; scope-based ownership (§8.5); existing `cover_id` kept as fallback.
**Dependencies:** FDR-03; P1a (profile); MEDIA-1; BG-1 only for cleanup. **Risk:** High (storage, personal images, migration) → **R2** per slice.
**Tests:** port contract tests with a fake store; authorization matrix per asset kind; fallback rendering; size/type rejection; no-leak of provider URLs.
**Mobile scenarios:** with/without upload for each kind; replace/remove; non-member cannot view Group-scoped cover.
**Founder gate:** MEDIA-3 preview on non-production only. No live user images.

### P7 — Challenge Feed and engagement (CF-2…CF-6)
**Outcome:** Challenge-local Feed per CF-01 v0.2: automatic A1–A6, explicit Share (preview, self-only, withdrawable), one Kudos, authorized announcements; no comments/replies.
**Existing:** none implemented. Reusable *patterns* only from Group Feed (outbox→projection→suppression; signed keyset cursor; per-request authorization recheck); tables, tuple and tests are **not** reusable and must not be touched.
**Dependencies:** FDR-05; Q3 answers before CF-2/CF-5; P1c (names); operator suppression capability; BG-1 for *production* draining. External share excluded (Q4). **Risk:** High → **R2**, slice by slice (CF-2 publication → CF-3 read API → CF-4 mobile → CF-5 engagement → CF-6 preview).
**Tests:** invariants from CF-01 §3 (Feed never alters Challenge truth; idempotent publication; audience recheck); Kudos audience equals read audience; no self-Kudos; Group Feed invariant test unchanged and passing.
**Mobile scenarios:** join → A1 card; Together 25/50/75; Share preview/publish/withdraw; Kudos toggle; Steward announcement; non-member sees nothing.
**Founder gate:** CF-6 preview.

### P8b — Support Tiizi activation
**Outcome:** actionable manual mobile-money guidance (copy recipient number, clear instructions, support WhatsApp) once real details exist.
**Preconditions (all required, Founder-verified):** A §Q5 facts; reconciliation/accounting handling; legal/privacy approval; disclosure that the Founder/operator collects on behalf of Tiizi. **Scope:** replace placeholder config and flip the `activated` guard — nothing else; no in-app confirmation of payment. **Paystack is not in scope** and needs a separate authorization (merchant eligibility, methods, settlement, reconciliation, recurring support) — frequency selection never implies a subscription.
**Risk:** Medium operational/trust (R1 code, Founder sign-off on data). **Founder gate:** explicit activation approval recorded with approved SHA.

### Integrated Founder walkthrough
A single mobile-preview session over the whole member journey on coherent disposable data: welcome → registration → optional preferences → discovery → join/approval → Challenge join → log from Today → Feed → Profile → Support. Output: page-by-page acceptance table (§1.2) with approved SHA and open dependencies. **CI-green or package-complete never equals "pilot-ready"**; legal, migration deployment, hosting and launch authorization remain separate.

## 4. Package summary

| Pkg | Outcome | Migration | Risk / Reviewer | Needs |
|---|---|---|---|---|
| Gate 0 | Disposition recorded | — | R0 | Founder approval of A |
| P0 | Guide return path; 118 preview; roster refresh | no | Low / R1 | — |
| P1a | Welcome + Profile page | no | Low–Med / R1 | Q6 |
| P8a | Support screen (placeholders) | no | Low / R1 | P1a |
| P1b | Optional Interests/Goals | **yes** | Med–High / **R2** | Q1, IDs |
| P1c | Display names (MC-4 min.) | no (read projection) | High / **R2** | — |
| P2 | Discovery + join-return | no | Med / R1–R2 | P1b |
| P3 | Today recovery | no | Med / R1 | — |
| P4 | Group Details/Settings | maybe (Q2) | Low–Med / R1 | P1c, Q2 |
| P5 | Challenge corrections | no | Low / R1 | P0 |
| P6 | Shared media | **yes** | High / **R2** | MEDIA-1, R2 account |
| P7 | Challenge Feed | **yes** | High / **R2** | Q3, P1c |
| P8b | Support activation | no | Med / R1 + Founder | Q5 |

Migration numbers are assigned only when the owning package starts (Disposition §12). No package deploys anything; hosted deployment is a separate authorization.

## 5. Independent review (Independent Code Reviewer)

An R1 review was performed by a separate agent session (not the author) and its findings were applied; it is summarized in §6. It is not a substitute for Technical Lead review or Founder acceptance. Where a review is absent or not independent the status is **PENDING** and no approval is claimed.

## 6. Review record

**Independent R1 review (separate agent session): PASS WITH FIXES — 8 required fixes applied** (Q-range references; decisions presented as recommendations not silent defaults; SUP-01/02 and T1 §V.6 authority gap added to FDR-04/Q5; FDR-03 relabelled "Restores (optional)"; 18+ declaration retained in the completion gate; Support-cause vs Support-Tiizi wizard copy added to P5; five line-reference corrections; Interests/Goals audit requirement added to P1b). The reviewer spot-checked 20+ `file:line` claims against `542052c` and confirmed MC package statuses against Master Programme v2.80. **Technical Lead review: PENDING. Founder acceptance: PENDING.** This is review of documents, not approval to implement.

**Disposition:** PROPOSED. STOP for Technical Lead and Founder review.
