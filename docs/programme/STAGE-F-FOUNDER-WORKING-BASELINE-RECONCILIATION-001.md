# STAGE F Founder Working-Baseline Reconciliation — 001

- Type: Assessment / reconciliation only. No product behaviour implemented; no code, governance authority or baseline source modified; Stage F NOT marked complete; Stage G/H NOT authorized.
- Convention note: `docs/programme/review/` does NOT exist in this repository. Review/reconciliation reports conventionally live directly under `docs/programme/` (e.g. `E1-IOG-REVIEW-001.md`, `STAGE-EK-EKG-01-REPOSITORY-RECONCILIATION-REPORT.md`, `CGP-03/04-REPOSITORY-RECONCILIATION-AND-VALIDATION-REPORT.md`). This report therefore lives at `docs/programme/STAGE-F-FOUNDER-WORKING-BASELINE-RECONCILIATION-001.md`.

## 1. Entry repository state

- Repository path: `/Volumes/PRODUCTION/Projects/tiizi_revamp`
- Local branch at entry: `main`, HEAD `5a01239` (`5a012396700fde9aee8aa2b72663a2c7e5564bd3`)
- `origin/main` SHA at entry (after `git fetch origin --prune`): `382cafc` (`382cafc5f358a7a58000ab03725f4b5453833e21`)
- Ahead/behind: ahead 0, behind 14 (`git rev-list --left-right --count HEAD...origin/main` = `0 14`)
- Working-tree status count: **99 paths** (modified + untracked), i.e. substantial unrelated dirty work as expected
- Incomplete Git operation state: **none** — no `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, `BISECT_LOG`, `rebase-merge`, or `rebase-apply` present
- Worktree inventory (`git worktree list`): primary `/Volumes/PRODUCTION/Projects/tiizi_revamp` (`5a01239 [main]`) plus 6 pre-existing linked worktrees under `/private/tmp/` (`tiizi-e1-entry`, `tiizi-e1-file`, `tiizi-e1-iog-review`, `tiizi-e1-recon`, `tiizi-ek-final-recon`, `tiizi-ekg01-recon`)

## 2. Authoritative origin/main SHA

`382cafc5f358a7a58000ab03725f4b5453833e21` (Merge PR #7, E1-EOG filing).

Intervening commits `HEAD..origin/main` (14, inspected before proceeding):

```text
382cafc Merge PR #7 (file/e1-eog-filing-003)
b8d67c9 docs(governance): file EOG-E1-01 and close Stage E1
ea1bb20 Merge PR #6 (recon/e1-iog-recon-002)
7d4d688 Stage E1 final repository reconciliation (E1-IOG-RECON-002)
7fa65c9 Merge PR #5 (recon/e1-iog-review-001)
ef32ee3 Stage E1 integrated operational-governance review (E1-IOG-REVIEW-001)
c02ac4e Merge PR #4 (recon/ek-final-reconciliation)
758c1bb Founder Stage EK Closure Decision + Master Programme sync (v1.45)
5c3379b Stage EK final reconciliation (v1.44)
40fda30 Merge PR #3 (rekon/ekg01-reconciliation)
b9d900c Founder approval of EKG-01 v0.1 (EKG-01-FAD-01)
4dd8287 Merge PR #2 (ekg01-reconciliation)
6008c67 EKG-01 bounded corrections + D-01 Founder resolution
80a3e35 Stage EK EKG-01 repository reconciliation report
```

`git log --stat HEAD..origin/main -- docs/programme/working docs/programme/review` is **empty**: none of the 14 commits touches Stage F material. They are exclusively Stage EK / EKG-01 / Stage E1 governance filings and closures. **No intervening commit materially affects Stage F authority.** Effect: Stage E1 is now Complete/filed (dependency of Stage F per Master Programme §14 satisfied); nothing else changes Stage F inputs.

## 3. Clean-worktree safety confirmation

- Primary dirty worktree was NOT reset, cleaned, stashed, checked out, pulled into, merged into, or otherwise disturbed. All reconciliation reads of the untracked baselines were read-only (`head`, `grep`, file reads).
- All authority/implementation evidence was taken from a clean linked worktree: `/tmp/tiizi-stagef-recon` @ `382cafc`, `git status --porcelain` count **0** (clean).
- Material note: `docs/programme/working/` does NOT exist on `origin/main` — the 11 Founder Working Baselines are **untracked local working evidence** present only in the primary worktree. They were inventoried and read in place (read-only); the reconciliation branch ( §20) is based on `origin/main` and adds only this report.

## 4. Working-baseline file inventory + hashes

All 11 files: status Founder Working Baseline, dated 2026-09-04, **untracked on authoritative main**. The seven `*-v0.1.md` files additionally carry “Not Yet Repository-Reconciled” and “does not authorize implementation”.

| # | Filename (`docs/programme/working/`) | Document title (line 1) | Ver/status | Lines | SHA-256 (short) |
|---|---|---|---|---|---|
| 1 | `TIIZI-V2-STAGE-F-PRODUCT-MODEL-FOUNDER-WORKING-BASELINE-v0.1.md` | Tiizi V2 — Stage F Product Model | v0.1, Not Yet Reconciled | 783 | `6b31bbb8…` |
| 2 | `TIIZI-V2-STAGE-F-COLLECTIVE-CHALLENGE-PRODUCT-DEFINITION-FOUNDER-WORKING-BASELINE-v0.1.md` | Stage F — Tiizi V2 Collective Challenge Product Definition | v0.1, Not Yet Reconciled | 622 | `faa531b5…` |
| 3 | `TIIZI-V2-STAGE-F-COMPETITIVE-CHALLENGE-PRODUCT-DEFINITION-FOUNDER-WORKING-BASELINE-v0.1.md` | Stage F — Tiizi V2 Competitive Challenge Product Definition | v0.1, Not Yet Reconciled | 642 | `71562b85…` |
| 4 | `TIIZI-V2-STAGE-F-STREAK-CHALLENGE-PRODUCT-DEFINITION-FOUNDER-WORKING-BASELINE-v0.1.md` | Stage F — Tiizi V2 Streak Challenge Product Definition | v0.1, Not Yet Reconciled | 696 | `866d56d8…` |
| 5 | `TIIZI-V2-STAGE-F-SHARED-CHALLENGE-EXPERIENCE-FOUNDER-WORKING-BASELINE-v0.1.md` | Stage F — Tiizi V2 Shared Challenge Experience | v0.1, Not Yet Reconciled | 1031 | `0df5df6d…` |
| 6 | `TIIZI-V2-STAGE-F-FUNCTIONAL-REQUIREMENTS-BASELINE-FOUNDER-WORKING-BASELINE-v0.1.md` | Stage F — Tiizi V2 Functional Requirements Baseline | v0.1, Not Yet Reconciled | 858 | `1a966fd7…` |
| 7 | `TIIZI-V2-STAGE-F-LOGICAL-PRODUCT-AND-DOMAIN-MODEL-FOUNDER-WORKING-BASELINE-v0.1.md` | Tiizi V2 Logical Product & Domain Model (Stage F Founder Working Baseline) | v0.1, Not Yet Reconciled | 1129 | `02ee9869…` |
| 8 | `TIIZI-V2-CALCULATION-AND-DERIVED-TRUTH-MODEL-FOUNDER-WORKING-BASELINE.md` | Stage F — Tiizi V2 Calculation & Derived Truth Model | Founder Working Baseline | 558 | `aa570df1…` |
| 9 | `TIIZI-V2-RECOGNITION-AND-ACHIEVEMENT-MODEL-FOUNDER-WORKING-BASELINE.md` | Stage F — Tiizi V2 Recognition & Achievement Model | Founder Working Baseline | 545 | `3bf48042…` |
| 10 | `TIIZI-V2-CONTRIBUTION-AND-CAUSES-FUNCTIONAL-MODEL-FOUNDER-WORKING-BASELINE.md` | Stage F — Tiizi V2 Contribution & Causes Functional Model | Founder Working Baseline | 738 | `77712c92…` |
| 11 | `TIIZI-V2-NOTIFICATIONS-FEED-DISCOVERY-AND-SOCIAL-BEHAVIOUR-MODEL-FOUNDER-WORKING-BASELINE.md` | Stage F — Tiizi V2 Notifications, Feed, Discovery & Social Behaviour Model | Founder Working Baseline | 833 | `80fffeab…` |

Full SHA-256 (in filename order as inventoried): `aa570df180b97a72b51ba3cf114c0f7c97f4598d70eeee2152aeb91bfc608566` (08-Calculation), `77712c9221628c1fed99a77c126d91b423bee5ffac4691732f999ab15b8df5c7` (10-Contribution), `80fffeabd13ee77d7396c518ac6d8290fe190678db468bdfb4a9378991d4c511` (11-Notifications), `3bf480426bf23cd5282d211b7d0e25f2c05be58b43539469c0cbb7df4437e772` (09-Recognition), `faa531b57e76036f9417250a5b71402e0b1356b004e6953a94596b112fc04219` (02-Collective), `71562b85e41c884ff7d8e3b4ad557fbfd45b707cce82dcbad5f28de028887a18` (03-Competitive), `1a966fd7ba3755513b423a6d8aee9580e87136626d9c9ea95430b3c60bff77aa` (06-FR), `02ee9869b4a72b85853467139289a0e13d53502d5f13545963724506dcfed159` (07-Logical), `6b31bbb8720aa6ea64a1b204f834b1676db7ce6ab96ef07867b9271e87777453` (01-Product Model), `0df5df6d92422109dc9466023879b4917066e86d7e902486eaf05c9acba6c301` (05-Shared Experience), `866d56d8077aeb5bd4bb7958ee850de158b32ded2fdef91034d3404b909ea3bc` (04-Streak).

Obvious cross-references to sibling Stage F baselines: FR baseline §34 (Repository Reconciliation Requirement, ¶827–854) names the full reconciliation source list; Calculation §§41 (¶541–551) and ¶555 explicitly cite and supersede older “multiple Challenges / no separate logging” wording; Shared Experience §61 (¶930–938) fixes Challenge-Engine terminology against the Recognition model; each type definition defers detail to the Calculation specification (Competitive ¶206; Collective/Streak summary ¶¶599/673); Product Model §37 (¶711) maps its relationship to the detailed baselines. Out of scope but present in the same folder: two EOG-E1-01 files (working draft v0.1, 999 lines; approved v0.2, 661 lines) — E1 material, not Stage F baselines, not reconciled here except as authority evidence.

## 5. Authoritative evidence reviewed

Classification: **(A) current authority** unless noted.

- `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` (A) — §14 Stage F “Not Started”; 5 deliverables (Functional Requirements; Canonical Information Contract; Calculation & Derived Truth; Knowledge Runtime Contract; Technical Architecture Mapping); 9-step per-deliverable checklist; completion gate; dependency “Stage E1 must be Complete” (now satisfied, §2).
- `docs/programme/TIIZI-V2-PROGRAMME-GUIDE.md` (A) — §10 Stage F “Not Started” with the same 5 planned outputs; Stage E1 closure note: “FQ-01–FQ-12 governed; ACT-03/ACT-04 and MOT-01 preserved deferred; Reward implementation deferred. No implementation was authorized… Next: Stage F when Founder-authorized.”; standing rule that V1 implementation is not authority (§97).
- `docs/governance/ownership/37-EOG-E1-01-TIIZI-ENTITY-AND-OPERATIONAL-GOVERNANCE-STANDARD.md` + `37-EOG-E1-01-FOUNDER-APPROVAL-RECORD.md` (A) — filed/approved on origin/main; §§19/22 Policy/Calculation Authority boundaries; §35 Challenge-Engine boundary (“not… a Platform Authority, constitutional entity or final Recognition Authority”); preserved deferrals: ACT-03/ACT-04, MOT-01, detailed Rewards, exact visibility fields, feeds/discovery/notifications/social product behaviour left to Stage F; EOG-09 notes CHL-02–04 (Challenge lifecycle) still pending.
- `docs/governance/knowledge/EKG-01-TIIZI-KNOWLEDGE-GOVERNANCE-STANDARD-AND-KNOWLEDGE-ASSET-MODEL.md` (A) — EKG-01 v0.1 approved (EKG-01-FAD-01 on main).
- `docs/programme/CGP-03-…` / `CGP-04-…REPOSITORY-RECONCILIATION-AND-VALIDATION-REPORT.md` (A) — repository reconciliation/validation reports; no Stage F content.
- Domain standards (A): `docs/governance/domains/01-PROFILE-DOMAIN-STANDARD.md`, `02-GROUP-DOMAIN-STANDARD.md`, `03-CHALLENGE-DOMAIN-STANDARD.md`, `04-ACTIVITY-EVENT-DOMAIN-STANDARD.md` (+ validation companions). Group stewardship, Challenge/Activity meaning, Profile — all treated as fixed inputs, not reopened.
- Decision/gap registers (A/B): `docs/governance/ownership/01-ENTITY-OWNERSHIP-DECISION-GAPS.md` (MOT-01 “remains pending; Presentation Authority cannot establish qualification”; EOG-06–EOG-09 lifecycle gaps incl. CHL-02–04, GRP-02–04, IDP-03) — current-status evidence for §10.
- Visibility/privacy (A, sampled): `docs/reports/platform-foundation-decisions/02-IDENTITY-PROFILE-AND-PRIVACY-DECISIONS.md`; member-phase-10c privacy/visibility reports. Direction: consent, minimum-necessary disclosure, visibility boundaries differ across raw evidence/Derived Truth/feed — compatible with the Notifications baseline’s “visibility governs presentation” rule.
- PAM: no file matching `PAM` found on origin/main — referred to via FR §34 checklist; treated as procedural control, no content conflict possible from this review (EVIDENCE NEEDED only if consolidation cites specific PAM clauses).
- Historical/working/implementation-precedent material (B/D/E, not authority): V1/V2 history under `docs/reports/`, `docs/input/`; current `src/`/`functions/`/Firestore rules (implementation precedent only — never authority, per Guide §97 and FR ¶854); the 11 working baselines themselves (D).
- Superseded/stale (C): EOG-E1-01 working draft v0.1 in the working folder (superseded by filed v0.2/approval record); any V1 assumptions in code (see §9).

## 6. Internal consistency findings

Disposition key: A aligned · B mechanical consolidation · C internal working-baseline inconsistency (older wording superseded by later Founder position — NOT a governance change). Severity: BLOCKER / MATERIAL / MINOR / EDITORIAL. “Latest Founder position” = the rule stated in the task brief and confirmed present in the later (afternoon, non-v0.1) baselines.

- **F-A-01** · MATERIAL · **C** · Logical Model §4 ¶106 (“The same Activity Event may independently become eligible Evidence for multiple Challenges”), §9.3 ¶462–474 (“One Member Activity Event may have zero, one or many Challenge Evidence Associations”), ¶597, ¶862, ¶981/1030 (“One Activity Event may be eligible for multiple Challenges”) · Latest: Calculation §§“no initial V2 cross-Challenge matching” (¶45), “No automatic cross-Challenge Activity reuse or attribution” (¶496–507), ¶555 explicitly superseding “multiple Challenges / should not need separate [logging]” wording; per-challenge deliberate logging required · Disposition: carry the Calculation rule as governing; delete/replace the one-to-many association wording at consolidation (keep “eligible/canonical Activities shared” per Calculation ¶445, which is about canonical Activities, not event reuse).
- **F-B-01** · MATERIAL · **C** · Logical Model “Highest Performance” §§ (¶545, ¶625) and §11.4-adjacent competitive-mode language · Latest: no Highest Performance mode approved for initial V2; race-to-target only · Disposition: remove HP provisions at consolidation.
- **F-B-02** · MATERIAL · **C** · Competitive def ¶206 (tie/timestamp rules deferred to calc spec, “must not be invented”), ¶225 (“Exact ordering among non-completers belongs to the detailed calculation rules”), ¶¶528/566/596–597 (tie-break formula + non-completer ordering listed as open/deferred) · Latest: Calculation §16 ¶187–191 (identical governed completion points share position, no artificial tie-breaker) and §17 ¶193–207 (non-finishers: no finishing position, actual progress visible, never labelled failed/fourth/fifth) · Disposition: close as settled; replace deferrals with the settled rules. Competitive def ¶¶166/178 (one finisher does not end Challenge), ¶619 summary, §§18–19 (closes at configured end; position is Derived Truth, recalculated on correction) already aligned (A).
- **F-C-01** · MATERIAL · **C** · Logical Model §11.4 “Weekly-frequency Streak calculation” (¶650–660, consecutive successful weeks) · Latest: Calculation §20 ¶233 — initial V2 supports **daily** Streaks only · Disposition: remove weekly provisions at consolidation.
- **F-C-02** · MATERIAL · **C** · Streak def §“late joining” ¶294–296 (leaves late-join options explicitly open) and ¶649 (timezone/day-boundary deferred) · Latest: Calculation §27–28 ¶306–345 (one governing Challenge timezone; device tz must not shift Challenge-day) and rules 19–21 ¶531–533 (late joining does not change duration; full period stays denominator; 30-day stays /30) · Disposition: close as settled. No sum-based-Streak or participant-denominator provision was found in the older files (verified by search); Done-based scoring (Calculation §§21–22 ¶242–270, all-requirements-Done) stands uncontested. Streak def §§17/19 ¶250–288 (no auto-extension, Run Again = new Challenge, no carry-over) already aligned (A).
- **F-D-01** · MINOR · **A/B** · Collective model: Collective def §§15–19 ¶243–327 (extension only while Active, never after end/completion; authority persons, no invented universal role; Run Again ≠ extension) and summary ¶599; Calculation §§10–11 ¶120/148–152, rules 4–7 ¶510–514 (goal-crossing counts in full; may exceed 100%; expiry below Goal reports actuals, no failure label) · No conflicting older statements found; the two files are mutually consistent · Disposition: keep; mechanical merge only. Genuinely open product parameter (not a Founder question): ¶288 establishes no universal extension cap — carry as an explicit open parameter, see §13.
- **F-E-01** · MATERIAL · **C** · Older permissive feed/social wording — FR-V2-128/129 (¶491–497: Challenge “SHOULD provide a social Feed”, “MAY surface … Activity”), FR-V2-133 (¶507: “MAY support … comments or replies”), Shared Experience §26 ¶416–430 (per-Challenge Feed surfacing “Activity logs” etc.), ¶460 (replies/comments “where Stage F defines it”), ¶596/812/833, Collective §23 ¶353–357, Streak ¶455 (“Challenge Feed may surface relevant Streak events”) · Latest: Notifications baseline — no separate Home Feed (¶56, rule 1 ¶691); routine logging does NOT auto-create Group Feed content (¶181, rule 7 ¶702); Share-to-Group explicit-only (§14 ¶199–219, §49 ¶634–638, rule 43 ¶759); no comments/replies (¶277, rules 16–18 ¶717–719), no DMs, no followers/popularity (§“does not exist to create … follower economy” ¶42; ¶300–302; rules ¶802–804 anti-requirements); aggregation against exhaust (¶542, rule 35 ¶745); visibility governs all presentation · Disposition: the older “Challenge Feed” concept must be re-mapped at consolidation to Challenge view (operational state) + Group Feed (community stream) + explicit Share-to-Group; delete the comments/replies MAY and the Activity-log surfacing permissions.
- **F-F-01** · MINOR · **A/B** · Recognition authority: every file already carries the boundary — FR ¶558 (“Challenge Engine MUST NOT independently be treated as Recognition Authority”), SharedExp §61 ¶930–938 (Engine is a practical concept; not Recognition Authority), Collective ¶400–402, Streak ¶420–422, Product Model ¶522, Calculation exclusions ¶492–495, Recognition baseline ¶18 (does not resolve MOT-01) · Latest: EOG-E1-01 approved §35 (filed authority) + Recognition baseline (Result ≠ Platform Recognition ≠ Community Acknowledgement; Derived Truth precedes Recognition; no badge/XP/level architecture ¶229–275/460–497; history ≠ showcase; recognition follows corrected truth; rewards deferred) · Disposition: aligned; consolidation needs only a mechanical terminology sweep to the approved §35 wording. The EOG working draft’s stronger “engines determine applicable Platform Recognition” phrasing (draft ¶689–728) is E1-scope draft language superseded by the filed v0.2 — not a Stage F finding.
- **F-G-01** · MINOR · **A** · Contributions & Causes: Contribution baseline verified point-for-point against the latest position — no custody/payment integration (§21), never an entry fee (¶122, rule 8 ¶644), optional challenge CTA off-by-default, Social Cause optional capability with Platform review before fundraising active (¶183/253/522/592/657), voluntary + direct-to-declared-destination (¶207), self-report ≠ verified payment (§24 ¶327–355, rules 20–21 ¶664–665), “Community-reported contributions” must never be presented as confirmed “Amount Raised” (§24 ¶350–355, rules 24–25 ¶671–674, ¶679), closing declaration + differences ≠ misconduct, no custody/escrow (§43 ¶572–577, rule 37 ¶695), money never alters fitness truth (Product Model §33; FR summary ¶806–823 item 15). Older high-level mentions (Product Model §§30–33; SharedExp summary ¶1007; FR summary items 13–15; cause-review gate: Collective ¶488; FR-V2-204) are consistent · Disposition: aligned; no supersession needed. Operational cause-review detail = downstream (G, see §8 FR-V2-204).

## 7. Governance-conformance findings

- **F-GOV-01** · MINOR · **MECHANICAL TERMINOLOGY ALIGNMENT NEEDED** · “Challenge Engine” / “Challenge Feed” / “leaderboard-as-standing” phrasing across the v0.1 files vs EOG-E1-01 approved §35 and §§265/479/634–651 (exact finishing/ranking/leaderboard calculations = Stage F detail; visibility boundaries; feeds/discovery/social = Stage F product behaviour; recognition qualification subject to MOT-01) · Disposition: adopt approved terms at consolidation; substance already inside the permitted Stage F boundary.
- **F-GOV-02** · MINOR · **AUTHORITY QUESTION PRESERVED / DOWNSTREAM** · Collective extension + Run Again + reopening rules (Collective §§15–19; Streak §17; Calculation §11) vs EOG-09 (CHL-02–04 Challenge/participation lifecycle still pending) and EOG preserved deferrals · Assessment: compatible Stage F elaboration (authorized persons, Active-only, no same-Challenge reopening); flag for a lifecycle-standards cross-check at filing, do not reopen.
- **F-GOV-03** · EDITORIAL · **COMPATIBLE STAGE-F ELABORATION** · Canonical Activities shared across types (Calculation ¶445) vs EKG-01 Knowledge authority + ACT-03/04 preserved deferrals (FR ¶315–318; Calculation ¶70) · Assessment: sharing canonical meaning is Knowledge-layer reuse, not event-reuse; no conflict provided consolidation keeps the F-A-01 distinction explicit.
- **No SUBSTANTIVE CONFLICT WITH AUTHORITY found.** Nothing in the 11 baselines reopens Stage EK, Stage E1, Group stewardship, Knowledge authority, the visibility model, ACT-03/ACT-04, or MOT-01. EVIDENCE NEEDED is limited to: (a) specific PAM clauses if consolidation cites PAM (no PAM file found on main); (b) exact visibility-field list at implementation (deferred by EOG itself — downstream, not a Stage F blocker).

## 8. Functional Requirement reconciliation

Method: the FR baseline contains **206 requirements (FR-V2-001 → FR-V2-206)**. Section-level triage below covers the whole set; item-level classification is given for every tension-area and every formerly-open item. Carrying the full 206-row schedule is consolidation-task work (§17, next task), not assessment work.

- Membership/Groups/Challenge establishment, templates, wizard, discovery, participation (FR-V2-001 ≈ ¶46 through the establishment sections): **KEEP AS-IS**, minor wording alignment to domain standards at consolidation.
- Competitive (FR-V2-100 finish order: KEEP; **FR-V2-101 tie rules, FR-V2-102 non-completer ordering: SUPERSEDED BY LATER FOUNDER DECISION** — settled by Calculation §§16–17, see F-B-02; FR-V2-103 no assumed extension: KEEP).
- Streak (FR-V2-104–108+ interval/reset/remain: KEEP; late-join/late-logging/timezone items: **SUPERSEDED** — settled by Calculation §§27–28/rules 19–21, see F-C-02).
- Calculation semantics FRs: **KEEP**, wording-aligned to Calculation rules 1–25 (¶506–539).
- Feed/social (FR-V2-128–134): **FR-V2-128/129/133 SUPERSEDED-CONSTRAINED** per F-E-01 (Challenge-Feed SHOULD→ re-map; Activity surfacing MAY→ Share-to-Group-only; comments MAY→ deleted); FR-V2-130 (Feed ≠ truth), 131/132 (Kudos, no performance effect), 134 (social ≠ authority): **KEEP AS-IS**.
- Recognition (incl. FR-V2-144 leaderboard ≠ Recognition, FR-V2-147 MOT-01 gating ¶560–561): **KEEP AS-IS**; MOT-01 preserved, not resolved (see §10).
- Contributions (incl. FR-V2-204 cause due diligence → **DOWNSTREAM/NOT STAGE F** as the requirement itself permits (“Stage F or appropriate downstream”); FR-V2-205 contribution visibility → **KEEP WITH WORDING ALIGNMENT**, substance settled by Contribution §24).
- Re-evaluation of the old “Explicit Stage F Decisions Still Required” block (§31 ¶747–776):
  - FR-V2-198 tie-breaking → **SETTLED** (share position, no artificial breaker).
  - FR-V2-199 non-completer ordering → **SETTLED** (no finishing position, actuals visible).
  - FR-V2-200 streak late joining → **SETTLED** (allowed where eligible; denominator unchanged).
  - FR-V2-201 late logging/grace → **SETTLED** (no ordinary late-logging grace period; cf. Streak def ¶324, Calculation ¶293/rule 17 ¶529, Notifications rule ¶743).
  - FR-V2-202 time boundaries → **SETTLED** (one governing Challenge timezone).
  - FR-V2-203 notification rules → **SUBSTANTIALLY ADDRESSED** by the 833-line Notifications baseline (trigger families, aggregation, failure semantics); any residual exact trigger catalogue is downstream technical detail (**G**), not a Founder question.
  - FR-V2-204 cause due diligence → **G (proper downstream deferral)**, operations detail for Platform review before live fundraising.
  - FR-V2-205 contribution visibility → **SETTLED** (community-reported vs confirmed Amount Raised).
  - FR-V2-206 detailed calculation spec → **SETTLED** (Calculation model rules 1–25 (¶506–539) + type sections (§§10–28); deterministic enough for consolidation, implementation detail follows).
- §32 non-authorizations (¶780–800: no code/migrations/APIs/payments/custody/rewards/RBAC/V1-migration, no ACT-03/04/MOT-01 resolution) and §33 summary (¶804–823) stand; §34 reconciliation requirement (¶827–854) is discharged by this report.

## 9. Existing implementation reconciliation

Evidence base: clean mirror `/tmp/tiizi-stagef-recon` @ `382cafc` (read-only). V1-vs-V2 lineage was NOT exhaustively separated per file; classifications E3 below are conservative (legacy-looking) rather than asserted.

- **F-IMP-01** · MINOR · **E1 ALREADY ALIGNED** · Challenge-specific logging: `src/features/Workouts/ChooseChallengeToLogScreen.tsx` routes logging per challenge (`challengeId` param, “Choose a challenge to log against”) — consistent with no-auto-association.
- **F-IMP-02** · MINOR · **E1 ALREADY ALIGNED** · No Home Feed: `src/features/Home/useHomeScreen.ts` contains no feed concept — consistent with Home-as-dashboard.
- **F-IMP-03** · MATERIAL · **E2 DIFFERS** · Comments/replies implemented: `src/features/Groups/FeedCommentSection.tsx`, `src/hooks/useFeedComments.ts`, `src/services/feedCommentService.ts` (108 lines) — contradicts settled no-comments position; Stage G remediation candidate.
- **F-IMP-04** · MATERIAL · **E2 DIFFERS** · Competitive ranking by order, not governed completion: `ChallengeLeaderboardScreen.tsx` (444 lines) assigns `rank: idx + 1` over top-20/top-10 with “Your Rank #n”; `leaderboardSort` (`src/utils/leaderboardSort.ts`) sorts v2-competitive by `completionRate → totalPoints` — no tie-sharing, no non-completer exclusion; contradicts §§16–17 race-to-target rules.
- **F-IMP-05** · MATERIAL · **E2 DIFFERS** · Streak leaderboard exists (`leaderboardSort` v2-streak branch `currentStreak → longestStreak → totalPoints`, plus mini-leaderboards) — contradicts “No Streak Leaderboard” (Calculation §34; Recognition §16).
- **F-IMP-06** · MINOR · **E2 DIFFERS** · Collective per-member ranked display (`leaderboardSort` v2-collective branch; ranked screens) sits in tension with “must not accidentally turn every Collective Challenge into a leaderboard competition” (Collective ¶410); FR-V2-144 only forbids equating rank with Recognition, so remediation is presentation-scoping, not removal.
- **F-IMP-07** · MATERIAL · **E2/E5** · `challengeProgressResolver.ts` (291 lines) is a single canonical resolver (good architecture: groupTotal/userContribution/sessionDelta separation, no double-count) but shows no V2 completion-closure, tie, non-completer, 100%+, or timezone/denominator semantics — resolution of exact deltas is Stage G work.
- **F-IMP-08** · MINOR · **E4 NO IMPLEMENTATION** · Kudos: zero `kudo` hits in `src/`/`functions/` — FR-V2-131/132 unimplemented (expected pre-Stage G; not a conflict).
- **F-IMP-09** · MINOR · **E5 CANNOT DETERMINE** · Notifications screens exist (`src/features/Notifications/NotificationsScreen.tsx`, admin `NotificationsScreen`) but canonical-trigger conformance was not surveyed; donation/support-tiizi + admin donation screens exist on main while current donation-guard work is dirty-worktree-only (out of scope) — entry-fee/CTA-default/review-gate conformance not verified on main.
- Count: E1 = 2, E2 = 5 (3 MATERIAL display/calculation, 1 MINOR, 1 mixed), E3 = 0 asserted (none classified legacy without lineage proof), E4 = 1, E5 = 1 (+1 partial). No implementation was treated as authority.

## 13. Exact genuine Founder questions remaining, if any

**None.** No substantive Founder Stage F question remains open. Every item in the old §31 open block is settled by a later Founder baseline (§8) or properly downstream:

- Product parameters carried open (not blockers, to be recorded as parameters in consolidation): (a) universal Collective extension cap/count — Collective ¶288 explicitly establishes none; (b) exact notification trigger catalogue residual (FR-V2-203) — downstream technical; (c) exact leaderboard UI (Competitive ¶595) — downstream presentation; (d) Streak late-join eligibility criteria (“where eligibility permits”) — Challenge-configuration detail.
- No item above requires a Founder decision before consolidation; none was manufactured from mere implementation-detail gaps.

## 14. Proposed minimum authoritative Stage F document architecture

Two authoritative instruments (minimum sufficient; avoids duplicate authority and a governance loop):

- **T1 — Stage F Product Definition** (single consolidated instrument; skeleton: current Product Model §§1–39). Absorbs the product-model, type-definition, experience, domain, calculation, recognition, contribution, and notifications content as numbered Parts with a controlled Calculation & Derived Truth schedule. Directly satisfies Master Programme deliverable “Calculation & Derived Truth” and feeds “Canonical Information Contract” (Logical model content) — see §16 gaps.
- **T2 — Stage F Functional Requirements** (single requirements instrument). The cleaned FR-V2-001→206 set with §31 closed, §32 carried, full 206-row disposition schedule from §8. Satisfies Master Programme deliverable “Functional Requirements”.

Why not 11 separate instruments: the 11 files overlap heavily (each type definition repeats establishment/feed/recognition/extension boilerplate); separate authority would re-create the inconsistency surface this report closes. Why not one mega-document: requirements (testable SHALLs) and product definition (meaning/behaviour) have different readers and different Master Programme deliverable slots.

## 15. 11-file source→target consolidation map

| # | Source (working, untracked) | Target | Treatment |
|---|---|---|---|
| 1 | Product Model v0.1 | **T1** Parts 1–4 (proposition, flow, Groups, establishment) + T1 §37 relationship map retired | Skeleton; §§26–27/31–33 re-homed to T1 Social/Recognition/Contribution Parts |
| 2 | Collective def v0.1 | **T1** Part: Collective Challenge (F-D-01 keep) | Keep; extension authority + ¶288 open-parameter carried |
| 3 | Competitive def v0.1 | **T1** Part: Competitive Challenge | Apply F-B-02 (replace ¶206/225/596–597 deferrals with settled rules) |
| 4 | Streak def v0.1 | **T1** Part: Streak Challenge | Apply F-C-02 (replace ¶294–296/649 with settled rules) |
| 5 | Shared Experience v0.1 | **T1** Part: Shared Experience + Feed/Social rules | Apply F-E-01 (re-map Challenge Feed; delete comments MAY ¶460); §61 → T1 terminology |
| 6 | FR Baseline v0.1 (206 FRs) | **T2** (whole) | §8 dispositions; close §31; carry §32 |
| 7 | Logical/Domain v0.1 | **T1** Part: Domain Model + schedule feeding Canonical Information Contract | Apply F-A-01 (replace one-to-many association), F-B-01 (delete HP), F-C-01 (delete weekly §11.4); F-GOV-03 distinction kept |
| 8 | Calculation model | **T1** Controlled Schedule: Calculation & Derived Truth (governing over all type Parts) | Governing; unchanged substance |
| 9 | Recognition model | **T1** Part: Recognition & Achievement | Unchanged substance; §35 term sweep |
| 10 | Contribution model | **T1** Part: Contributions & Causes | Unchanged substance (F-G-01) |
| 11 | Notifications/Feed/Social model | **T1** Part: Notifications, Feed, Discovery & Social | Governing over older feed wording (F-E-01) |

All 11 sources to be hash-pinned as superseded working evidence on filing (hashes §4); no source file edited by this task.

## 16. Stage F readiness assessment

Disposition: **A. READY FOR CONSOLIDATION — no substantive Founder question remains** (§13).

Master Programme Stage F deliverables/checklist against this package:

- Already substantively satisfied (by consolidation T1+T2, i.e. mechanical work only): Functional Requirements (T2); Calculation & Derived Truth (T1 schedule).
- Genuinely outstanding (separate Stage F work, NOT blockers for product-definition consolidation): Canonical Information Contract (Logical model is input, not the contract); Knowledge Runtime Contract (EKG-01 runtime expression); Technical Architecture Mapping (explicitly downstream-facing; borders Stage G).
- Downstream, must not block Stage F: implementation remediation (F-IMP-03–07 → Stage G); exact notification triggers, leaderboard UI, extension caps (parameters/Stage G detail); cause-review operations (Platform ops); ACT-03/ACT-04/MOT-01 resolutions (their own governance tracks); V1→V2 migration.
- Stage F must NOT be marked Complete by this task: per-deliverable checklist (Discovery→Dashboard Updated, incl. Founder Review/Approval/Adoption) has not run for any of the 5 deliverables.

## 17. Exact next recommended task

Bounded consolidation-drafting task (Founder-authorized, separate turn): create **T1 Stage F Product Definition** and **T2 Stage F Functional Requirements** as drafts from the §15 map, applying dispositions F-A-01, F-B-01, F-B-02, F-C-01, F-C-02, F-E-01, F-GOV-01 mechanically; include the full 206-row FR disposition schedule; hash-pin all 11 sources as superseded working evidence; run the Master Programme per-deliverable checklist through Draft (not Approval/Adoption). Do NOT include: implementation, migration, governance amendments, ACT-03/04/MOT-01 resolution, or Stage F completion marking.

## 18. Validation performed

- Entry: `git rev-parse --show-toplevel`, `branch --show-current`, `rev-parse HEAD`, `rev-parse origin/main`, `rev-list --left-right --count`, `status --porcelain` (count 99), marker-file check (no incomplete op), `worktree list`, `fetch origin --prune`, `log --oneline HEAD..origin/main` + empty `--stat` on working/review paths.
- Inventory: `ls` + `wc -l` + `head -8` (titles/versions) + `shasum -a 256` for all 11 files; `ls-tree -r origin/main` proving `docs/programme/working/` absent on main; review-folder convention proven by `ls-tree` (reports live under `docs/programme/`).
- Content: targeted `grep -n` (regex mode) across all 11 files for every tension-area keyword family (§§6–8 cite file+section+line); direct reads of Calculation ¶185–345/505–535, FR §31–34 ¶747–858, SharedExp §26, Contribution §§21/24/43, Product Model headings; 5 parallel read-only subagent analyses (product-defs, shared+FR, models, authority, implementation) used as triage input with every cited claim re-verified by direct grep/read before inclusion.
- Authority: `git show origin/main:<guide>` §10; `git grep` on main for Stage F/MOT-01/ACT-03/EOG deferrals; `ls-tree` for domain standards, EKG-01, EOG approval record, CGP-03/04, visibility/privacy, PAM (absent).
- Implementation: `grep -ril` + targeted reads on the clean mirror (`leaderboardSort.ts` full sort function, `challengeProgressResolver.ts` header + layout, `ChooseChallengeToLogScreen.tsx`, `ChallengeLeaderboardScreen.tsx` ranking lines, `useHomeScreen.ts` feed absence, kudo zero-hit, notifications/donation file lists). No code executed, modified, or tested; no behaviour asserted beyond quoted lines.
- Adherence: `git status` in both worktrees after reads (primary untouched by this task’s writes; report exists only in the recon worktree branch).

## 19. Exact files changed

- ADDED: `docs/programme/STAGE-F-FOUNDER-WORKING-BASELINE-RECONCILIATION-001.md` (this report; only file in the commit).
- Modified: none. Baseline sources, governance/programme authority, `src/`, `functions/`, rules, migrations, APIs, tests: untouched.

## 20. Commit SHA / branch / push status

- Branch: `recon/stage-f-founder-baselines-001` (from `origin/main` `382cafc`, in `/tmp/tiizi-stagef-recon`).
- Commit: `55f54be239c573a355827f78c81a66df6b6c5b4e` (1 file, +230 lines; amended pre-push to record this SHA — final SHA in return summary).
- Push: `git push -u origin recon/stage-f-founder-baselines-001`, no force, no merge (status in return summary).

## 10. ACT-03 / ACT-04 / MOT-01 preservation check

- MOT-01: pending per `01-ENTITY-OWNERSHIP-DECISION-GAPS.md` (EOG-06 row) and EOG-E1-01 filed deferrals; preserved in ALL 11 baselines (Product Model ¶522; FR ¶560–561/796–798; SharedExp ¶576/996–997; Collective ¶402/587–588; Competitive ¶398/607–608; Streak ¶345/422/661–662; Logical ¶711/1075; Calculation ¶492–495; Recognition ¶18). **Preserved, not resolved, not reopened.**
- ACT-03/ACT-04: preserved deferrals per EOG filed standard (“to the extent not already resolved”) and Guide §10; preserved in Product Model ¶402/744–745, FR ¶315–318/796–797, SharedExp ¶926/996, Collective ¶347/587, Competitive ¶344/607, Streak ¶345/661, Calculation ¶70/492–493. Calculation §19 correctly routes legitimate corrections through recalculation **without inventing** verification/correction authority. **Preserved, not resolved by inference.**
- Rewards: deferred everywhere (Recognition baseline; FR §32; Guide) — no badge/XP/level implementation authorized.

## 11. Known tension-area results A–G

- **A. Cross-Challenge Activity** — LATEST (challenge-specific; deliberate separate logging; no auto matching) confirmed in Calculation ¶¶45/496–507/555. Superseded: Logical ¶¶106/462–474/597/862/981/1030 (F-A-01). Implementation already aligned (F-IMP-01).
- **B. Competitive** — LATEST (race-to-target; governed completion order; shared ties; no non-completer position; no HP mode; closes at end; Derived Truth recalculates) confirmed in Calculation §§15–19. Superseded: Logical HP mode (F-B-01); Competitive-def deferrals now settled (F-B-02). Implementation differs (F-IMP-04).
- **C. Streak** — LATEST (daily-only; Done-based; multi-activity; all-Done; no grace; reset-stays-in; one timezone; late-join fixed denominator; no leaderboard; Days/Best/Current-Final; never reopen) confirmed in Calculation §§20–28 + rules. Superseded: Logical weekly §11.4 (F-C-01); Streak-def open/deferred items now settled (F-C-02).
- **D. Collective** — LATEST confirmed in both Collective def and Calculation (F-D-01, no conflict). Open parameter: universal extension cap (see §13).
- **E. Home/Feed/Social** — LATEST confirmed in Notifications baseline. Superseded older permissive wording across FR/SharedExp/Collective/Streak (F-E-01). Implementation differs on comments (F-IMP-03); aligned on no-Home-Feed (F-IMP-02).
- **F. Recognition** — LATEST confirmed in Recognition baseline + filed EOG §35; all files already carry the boundary (F-F-01, aligned).
- **G. Contributions & Causes** — LATEST confirmed point-for-point in Contribution baseline (F-G-01, aligned); cause-review operations downstream.

## 12. New findings

Nothing outside §§6–10 except: (a) the FR baseline’s own §34 reconciliation checklist anticipates exactly this task and is discharged here; (b) `docs/programme/working/` + `docs/programme/review/` both absent on main — the “11 working baselines” are untracked working evidence, so consolidation must file them as generated outputs (hash-pinned) rather than edit them in place; (c) no PAM file on main — consolidation must not cite PAM clauses blindly (F-GOV evidence note).
