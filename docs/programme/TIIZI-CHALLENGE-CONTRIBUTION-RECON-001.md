# TIIZI-CHALLENGE-CONTRIBUTION-RECON-001 — Challenge Contributions / Donations / Tiizi Support Reconciliation

**Type:** Assessment only. No implementation, no schema/migration change, no product-code change.

**Reviewed main SHA:** `0ca85a3c14c6aa37659ce0ccc226845852d6eff0` (Master Programme 1.81; S3a COMPLETE / FOUNDER ACCEPTED / MERGED; S3 IMPLEMENTATION IN PROGRESS; S3b NOT STARTED — verified: no S3b branch, no S3b commits).

**Resolves:** the S3a-closure future input "Challenge contributions/donations/Tiizi Support" (S3a record §8), sufficiently to determine whether S3b may proceed unchanged.

**Experience Reference reviewed:** `Fkenogo/tiizi-prototye` @ `cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6` (the adopted reference; read-only, not modified).

**Disposition: A — S3b MAY PROCEED UNCHANGED.**

---

## 1. Reviewed main SHA

`0ca85a3c14c6aa37659ce0ccc226845852d6eff0`. Entry state verified, no material drift.

## 2. Documents / sources inspected

- Stage F approved product truth: `docs/programme/STAGE-F-TIIZI-V2-PRODUCT-DEFINITION-DRAFT.md` (T1 §§V, W, X; §121 Participation Before Reward), `docs/programme/STAGE-F-TIIZI-V2-FUNCTIONAL-REQUIREMENTS-DRAFT.md` (T2 FR-V2-151…174, §§27–29), approval `docs/programme/STAGE-F-FOUNDER-APPROVAL-DECISION-STAGE-F-FAD-01.md` (T1 + T2 through FR-V2-214 approved).
- Entity/operational governance: `docs/governance/ownership/37-EOG-E1-01-*.md` (§36 Community Acknowledgement), `docs/governance/ownership/01-…-VALIDATION.md`, `docs/governance/ownership/28-…-MATRIX.md`, `docs/governance/platform/10-PLATFORM-AUTHORITY-MODEL.md`.
- Reconciliation: `docs/experience/TIIZI-EA-01-PRODUCT-TRUTH-RECONCILIATION.md` (M31/M32/M33/O9, §§380–382, S8/S9 rows).
- Charter + slice: `docs/experience/TIIZI-S3-CHALLENGE-EXPERIENCE-CHARTER.md`, `docs/experience/TIIZI-S3A-PARTICIPATION-ACCESS.md` (§§7–8).
- V1 architecture + audits (reference): `docs/architecture/challenge-architecture.md` (donation config/lifecycle), `docs/reports/member-phase-6-donation-audit.md`, `docs/reports/member-phase-10c-p6h-crit3-step3b-challenge-detail-redesign.md`, `docs/AUDIT_REPORT_2026-04-05.md`.
- V1 implementation residue (frozen): `src/services/donationService.ts`, `src/services/adminDonationService.ts`, `src/hooks/useDonations.ts`, `src/features/Donate/DonateScreen.tsx`, `src/features/Admin/Donations/`, V1 `CreateChallengeWizard.tsx` + `ChallengeDonationSection.tsx` + `challengeFormValidation.ts`, `ChallengeDetailScreen.tsx`, `firestore.rules` (donation collections), `functions/src/challengeCreationBackend.ts`, `functions/src/supportDonationSummary.ts`, `functions/src/adminMetricsCore.ts`.
- V2 engine: `api/src/` (incl. `challengeComposer.ts`, `challengeDefinition.ts`), `api/test/pf04ChallengeComposer.test.ts`, all 17 `api/migrations/*.sql` (zero donation/pledge/cause hits).
- Experience Reference: `docs/TIIZI-EXPERIENCE-REFERENCE.md`, `SupportView.tsx`, `ChallengeDetailView.tsx`, `CreateChallengeWizard.tsx`, `ChallengeCard.tsx`, `GroupDetailView.tsx`, `CreateGroupModal.tsx`, `LogActivityModal.tsx`, `Header.tsx`, `ProfileDrawer.tsx`, `types.ts`, `OperatorPlatform.tsx`, `operatorMockData.ts`, `mockData.ts`, `assumptionsData.ts`.

## 3. Authoritative contribution truth found (CURRENT, Founder-approved)

T1 §W (Social Causes) + T2 §28 (FR-V2-163…174), approved under STAGE-F-FAD-01:

- A Social Cause is an **optional add-on to a Challenge (Collective, Competitive, or Streak) — NOT a fourth Challenge type** (T1 §W.1). Off by default (W.2).
- Creator configuration: cause title, description, **beneficiary**, reason, **fundraising Goal**, payment destination — initially a **direct external payment destination** (W.3; FR-V2-169 mobile-money account/phone or later-supported destination).
- Lifecycle: Draft → Cause Review → Approved → Active. **Ordinary Challenges do NOT require Platform approval** (W.4; FR-V2-170…173).
- **Tiizi custody/escrow of Social Cause funds is NOT authorised** (W.9; confirmed by FAD-01 context per EA-01 M33).
- Self-report is NOT verified payment (W.10); totals must be labelled **"community-reported"**, NEVER "Amount Raised" without reliable payment evidence (W.11); creator closing declaration recorded but unverified (W.12); discrepancy ≠ misconduct (W.13).
- **W.14 — Financial contribution NEVER changes Challenge truth or Recognition** (no effect on progress, Derived Truth, finishing position, Streak, Recognition). Mirrored in T2 FR-V2-168 and T1 §121.
- Fundraising Goal is **distinct from the Challenge Activity Goal**; reaching one does not affect the other (W.7; FR-V2-165/166).
- Contributions are **money** (financial) in this model; cause attachment is to the **Challenge**, not the Group or participant.
- Legal/regulatory/fundraising compliance is downstream of the product definition (W.15).

## 4. Authoritative Tiizi Support truth found (CURRENT, Founder-approved)

T1 §V (Support Tiizi) + T2 §27 (FR-V2-155…162) + FR-V2-151…154 (free-use baseline):

- **"Tiizi Support" means voluntary financial support for the Tiizi Platform itself** — NOT for a Challenge, NOT for a cause (T1 §V.2; FR-V2-161 beneficiary = the Tiizi Platform; FR-V2-154).
- Represented by a **permanent Profile CTA**, independent of Groups and Challenges (V.3; FR-V2-155).
- Challenge-level support is **optional, off by default**, with suggested and/or open amounts (V.4; FR-V2-156…158). Enabling it does **not** trigger Challenge approval (W.5).
- **Payment → eligibility is prohibited**; participation and support are independent (V.5; FR-V2-153; FR-V2-160 no-performance-effect).
- Destination is **Tiizi-controlled**, provider processes downstream; **payment provider selection is deferred** (V.6; FR-V2-162).
- Not a fee, not a subscription (FR-V2-151/152); notifications about it must be restrained, never nagware (T1 §1248).

Authority status: support/donation authority is **unallocated** — "No support or donation entity exists in the current EOG-05 inventory" (ownership matrix §28); E1 validation leaves SUP-01/02 pending ("Support and donation decisions are not allocated"). EA-01 (M31/M32/M33/O9) places ALL Support/Cause assembly in **S8** (gated) / S9-operator-read, explicitly "Founder/authority-gated, not merely late… must not block earlier slices" (EA-01 §§380–382, 402).

## 5. Experience Reference findings (interaction guidance, NOT authority)

Consistent with product truth; three ledgers never mixed (`SupportView.tsx:12`; `OperatorPlatform.tsx:45`):

- **A. General Support Tiizi** — standalone Support surface, mock M-Pesa/card amounts (KES 200/500/1,000), "Nothing is charged" (`SupportView.tsx:18–28`).
- **B. Challenge-linked Support Tiizi** — creation Step 6 offer (off by default; $1/2/5/10 + custom; join/during/both) + detail strip hidden when completed; copy repeats "never affects eligibility, progress or results" (`CreateChallengeWizard.tsx:101–105,1148–1179`; `ChallengeDetailView.tsx:232–251`; `types.ts:170–172,189–195`).
- **C. Community Cause** — creation cause toggle + name only (no amount/target/beneficiary/payment fields; "Tiizi does not handle financial donations or payment escrow", `CreateChallengeWizard.tsx:673–704`); detail cause-awareness banner with "no Amount Raised shown" (`ChallengeDetailView.tsx:283–292`); cause amounts are movement (km dedicated), money pledges only as self-reported external notes (`operatorMockData.ts:103–109`).
- **Activity logging surface has zero donation/cause/support references** (`LogActivityModal.tsx`, full read) — logging is movement-only.
- **Completion/results surface has zero donation linkage** (finished banner + read-only record only).
- **Group surfaces carry zero cause/support-money fields** (`GroupDetailView.tsx`, `CreateGroupModal.tsx`).
- "Contributors/contributions" wording in detail/card = movement toward the shared total, not money.
- Assumption `asm-cause-support` (NEEDS FOUNDER DECISION): movement dedication + external-pledge indicators in scope; financial custody/verified totals/escrow NOT assumed.

## 6. Historical / reference-only findings (NOT current authority)

- V1 "Fitness + Cause" implementation (frozen tree): embedded `challenge.donation` config (`enabled/causeName/causeDescription/targetAmountKes/window/phone/cardUrl/disclaimer/approvalStatus`), draft→admin-approval→active lifecycle enforced client + callable + rules, `challengeContributionPledges` (pledged/confirmed/skipped, honor-system "marked as sent"), `supportDonations` (intent/confirmed, off-app manual mobile money to a hardcoded number, no gateway), legacy admin-only `donationCampaigns/donationTransactions`, `platformSettings/support` config, functions aggregates (`supportDonationSummary/current`, `adminMetrics/revenue`).
- All exhibit pre-governance properties incompatible with current truth as V2 scope: honor-system verification, hardcoded payment destination, mixed-currency sums, client-stamped lifecycle fields, and — decisively — **zero linkage to scoring/leaderboards/results** (verified import-graph isolation; PF-04 composer contract rejects donation keys: `api/src/challengeComposer.ts:206–221`, test asserts `donation:{enabled:true}` throws `INVALID_DRAFT`).
- Classification: **D (implementation residue with no current authority)** for V2 purposes; useful only as interaction/label reference (e.g. "community-reported", "marked as sent") when S8 is authorised. V1 architecture/audit docs are **C (historical/reference-only)**.

## 7. Current V2 engine capability

- Challenge establishment/configuration (PF-03 definition contract, PF-04 composer, S2b seams): IMPLEMENTED — no contribution/support fields exist or are accepted.
- Participation (episodes, join/withdraw, myParticipation): IMPLEMENTED — no financial dimension.
- Activity application (`applyChallengeActivity` + governing-config-at-acceptance + idempotency): IMPLEMENTED — movement/measurement only.
- Derived progress / finishing positions / streaks: IMPLEMENTED — pure fold over accepted activity.
- Finalisation / frozen results: IMPLEMENTED (CLI) — no contribution inputs.
- Group authority / membership: IMPLEMENTED — no cause/finance dimension.
- Financial/contribution infrastructure: **absent by design** — `api/` has zero donation/contribution/support business logic; all 17 migrations clean; composer exclusion contract enforced by test.
- Recognition: deferred (MOT-01-gated, S8); Community Acknowledgement (Kudos) permitted by EOG §36 (see §12).

## 8. Contribution capability gap map

| Requirement (from T1 §W / T2 §28) | Classification |
|---|---|
| Cause as challenge add-on (any of 3 types), off by default | DOCUMENTED / ENGINE MISSING (S8 scope) |
| Cause fields (title/desc/beneficiary/reason/goal/destination) | DOCUMENTED / ENGINE MISSING |
| Draft → review → approved → active cause lifecycle | DOCUMENTED / ENGINE MISSING (V1 residue exists but unauthoritative) |
| Distinct fundraising goal, separate from activity goal | DOCUMENTED / ENGINE MISSING |
| Community-reported totals labelling (never "Amount Raised") | DOCUMENTED / ENGINE MISSING |
| Creator closing declaration | DOCUMENTED / ENGINE MISSING |
| No-custody / external-destination model | DOCUMENTED; custody NOT authorised — no engine to build |
| Payment provider / verification evidence | NOT DEFINED (FR-V2-162 deferred; downstream per W.15) |
| Authority allocation (SUP-01/02, inventory amendment) | CONTRADICTORY-CLASS: REQUIRES FOUNDER DECISION at S8 time, not now |
| Any effect on eligibility/activity/progress/results/recognition | Prohibited by W.14/FR-V2-168 — **no capability wanted** |

## 9. Tiizi Support capability gap map

| Requirement (from T1 §V / T2 §27) | Classification |
|---|---|
| Permanent standalone Profile CTA | DOCUMENTED / ENGINE MISSING (S8 scope; profile itself is S8) |
| Challenge-level optional offer (off by default, suggested/open amounts) | DOCUMENTED / ENGINE MISSING (S8 scope) |
| Voluntary, never affects eligibility/activity/progress/recognition | Prohibited-from-coupling — **no capability wanted** in S3 |
| Tiizi-controlled destination + provider | NOT DEFINED (FR-V2-162 deferred) |
| Authority allocation (SUP-01/02) | REQUIRES FOUNDER DECISION at S8 time, not now |

## 10. Relationship to Challenge activity

None. Contributions are not activities, cannot count toward Challenge progress, and are not submitted through the activity pipeline. The composer contract explicitly excludes donation keys, so a cause/support dimension **cannot smuggle into** the S3b activity model even accidentally. Experience Reference logging surface confirms the separation.

## 11. Relationship to Challenge progress

None, by constitutional-grade prohibition (T1 §W.14, §121; T2 FR-V2-160/168). Progress/derived truth fold only over accepted activity events. S3c has no contribution input to represent.

## 12. Relationship to results / recognition

- Results: frozen finals derive from activity truth only. Cause closing declarations and community-reported totals are recorded artefacts of a later (S8) surface, not components of frozen results.
- Recognition: Platform Recognition is MOT-01-gated (S8) and unaffected by contributions (W.14). **Group-originated Community Acknowledgement (EOG-E1-01 §36) MAY acknowledge "financial contribution to a cause" as a social Group event** — permitted, not required. It explicitly "does not establish or alter Accepted Activity Events, Evidence Eligibility, Derived Truth, Ranking, Challenge results or Platform Recognition." → No S3 dependency; a later slice may emit acknowledgement events without touching S3 outputs. No recognition redesign undertaken here.

## 13. Relationship to Groups

Cause attaches to the **Challenge**, not the Group. Groups host Challenges (S2/S4); Group surfaces carry no cause/support configuration in either product truth or the Experience Reference. The S3a note ("Group establishment works but is not the comprehensive final Group experience") is unaffected — full Groups Experience remains S4, which need not absorb cause configuration (cause config belongs with Challenge creation, an S8-gated add-on).

## 14. S3b impact — NO IMPACT

S3b binds the existing activity-application pipeline (`POST …/activity`, governing config, idempotency, fail-closed rejections). Recovered truth proves the activity model is definitionally closed to financial contributions (W.14 + composer exclusion). Beginning S3b now cannot assemble an incomplete or incorrect activity model on this axis — there is nothing contribution-shaped to omit.

## 15. S3c impact — NO IMPACT

Live progress/type-state derives from accepted activity only. No contribution inputs exist in the fold; none are authorised to be added.

## 16. S3d impact — NO IMPACT

Frozen finals derive from activity truth only. Community-reported cause totals and closing declarations are not result components.

## 17. S3 charter validity

**Valid unchanged.** The charter excludes "reference elements with no engine truth (… contributions …)" from S3. This assessment confirms the exclusion is substantively correct, not merely a gap: product truth *prohibits* coupling contributions to the S3 lifecycle, and places Support/Cause assembly in S8 under pending authority decisions.

## 18. Prerequisite domain/engine work required

**None before S3b.** Later, for S8: (a) SUP-01/02 authority allocation + EOG-05 inventory amendment; (b) cause-custody scope confirmation (custody currently NOT authorised — the S8 model must remain no-custody/external-destination unless the Founder decides otherwise); (c) payment provider selection (FR-V2-162) and verification-evidence design; (d) contribution privacy/consent surfacing (FR-V2-174). All S8-gated; none block S3.

## 19. Founder decisions required before S3b

**None.** The decisions this domain needs (authority allocation, custody scope, provider, S8 placement confirmation) are all scoped to S8 assembly and are already recorded as pending in EA-01/EOG. No new decision is required to begin S3b.

## 20. Recommended exact next programme action

Authorise and begin **S3b — Activity logging / application** under the currently approved S3 charter, unchanged. The RECON-001 item is closed by this assessment: contributions/donations/Tiizi Support are reconciled as an S8-gated, never-coupled dimension with no S3 representation required.

## 21. S3b NOT STARTED — confirmation

Confirmed: no S3b branch, no S3b commits, no S3b implementation. This task performed assessment only.

## 22. No implementation/schema/migration changes — confirmation

Confirmed: no product code, schema, migration, or configuration modified. The sole repository artefact of this task is this assessment report (documentation). Work performed in an isolated detached worktree; `origin/main` untouched.

## 23. Deviations / blockers

None. Preflight SHA matched expected (`0ca85a3…`); programme state as expected (MP 1.81, S3a MERGED).

---

## 8. Media remains separate — confirmation

- Group cover media: deferred (S3a record §7; Master Programme deferred observations). Requires future canonical media/reference authority.
- Challenge cover media: deferred (same). Requires future canonical media/reference authority.
- Neither was inspected beyond this confirmation, and neither blocks this reconciliation or S3b.
