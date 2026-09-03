# E1 Integrated Operational Governance Review — E1-IOG-REVIEW-001

**Task:** E1-IOG-REVIEW-001 (assurance / reconciliation only)
**Review target:** `docs/programme/working/EOG-E1-01-TIIZI-ENTITY-AND-OPERATIONAL-GOVERNANCE-STANDARD-FOUNDER-WORKING-DRAFT-v0.1.md`
(Founder Working Draft v0.1, 69 provisions, §§1–69 — read directly; NOT modified, renamed, relocated, approved or promoted by this task)
**Target status:** Founder Working Draft — NOT approved, NOT authoritative governance.
**Report status:** Evidence, not substantive governance. This report creates no entities, roles, permissions, policies, and amends no instrument.
**Date (UTC):** 2026-09-03

---

## 1. Executive disposition

**MATERIAL RECONCILIATION REQUIRED**

The draft is substantially well-oriented: its policy direction (group-first, voluntary participation,
self-accountability, minimal roles, visibility separation, deferred rewards, no parallel security
constitution, explicit downstream boundaries) aligns with approved authority and with the twelve E1
Founder Questions. No downstream-boundary breach and no entry blocker were found.

It is **not ready for approval candidacy** because two BLOCKER findings must be reconciled by the
Founder first:

- **F-E1 (BLOCKER):** §§27–31 route around the approved evidence chain. None of *Acceptance
  Authority*, *Accepted Activity Event*, *Submission Intent*, *Acceptance Decision*, *Evidence
  Eligibility*, *Calculation Authority* appear anywhere in the draft (zero occurrences each), while
  §28 introduces *admissibility* — a term absent from the entire `docs/` tree — as an apparently
  parallel gate with no named holder.
- **F-E2 (BLOCKER):** §§47–50 install *Challenge Engine* as the Recognition-determining authority.
  The term has zero occurrences in `docs/governance/` (only implementation reports), while approved
  authority assigns Derived Truth to Calculation Authority and leaves Recognition Authority
  deliberately DEFERRED (MOT-01).

A correction pass re-anchoring those two clusters on approved vocabulary, plus Founder decisions on
the ten items in §14, would make this a strong, compressible (~40-provision) approval candidate.

Finding counts: **BLOCKER 2 · MATERIAL 7 · MINOR 11 · EDITORIAL 3.**

---

## 2. Entry repository state

Reported before substantive work, primary worktree untouched throughout.

| Item | State |
|---|---|
| Repository path | `/Volumes/PRODUCTION/Projects/tiizi_revamp` |
| Branch | `main` |
| Local HEAD | `5a012396700fde9aee8aa2b72663a2c7e5564bd3` (matches previously observed) |
| `origin/main` | `c02ac4edbe842c998a546f59bb10926515a2409c` — **matches expected Stage EK closure SHA** |
| Intervening commits | None beyond known state. Local `main` is 8 commits behind `origin/main` (stale local pointer; `rev-list --left-right --count HEAD...origin/main` = `0 8`); remote fetch clean, no new commits affecting this task |
| Working-tree status | **99 status entries, preserved and undisturbed** (98 previously observed + the pre-existing untracked `docs/programme/working/` draft directory; no review file was created in the primary worktree — verified by grep for `E1-IOG`) |
| Merge/rebase/cherry-pick | None active (no `MERGE_HEAD` / `CHERRY_PICK_HEAD` / `REBASE_HEAD`; no rebase in progress) |
| Worktree inventory | Primary `5a01239 [main]`; `/private/tmp/tiizi-e1-entry [recon/e1-entry-assessment]`; `/private/tmp/tiizi-ek-final-recon`; `/private/tmp/tiizi-ekg01-recon`; review worktree below |
| Review worktree | `/tmp/tiizi-e1-iog-review` (resolves to `/private/tmp/tiizi-e1-iog-review`), clean detached HEAD `c02ac4e`, zero status entries; review branch `recon/e1-iog-review-001` created from it |

No reset, stash, clean, checkout-over, pull, merge, or modification of the dirty primary worktree
was performed. All substantive inspection ran in the clean linked worktree (reads) plus read-only
reads of the draft and of the assessment-branch file noted in §3.

---

## 3. Authority corpus actually reviewed

Baseline: `origin/main` @ `c02ac4e`. “Read” = full read; “searched” = whole-tree term search with
hits read in context; “spot” = cited sections verified.

**Constitutional / authority (read):**

- `docs/governance/00-TIIZI-CONSTITUTIONAL-ONTOLOGY-AND-FOUNDATIONAL-PRODUCT-CONCEPTS.md` (Part V principles incl. Truth Before Recognition, Participation Before Reward)
- `docs/governance/ownership/04-PLATFORM-ACCOUNTABILITY-FRAMEWORK.md` (PAF/EOG-01 framework, §§1–13)
- `docs/governance/platform/10-PLATFORM-AUTHORITY-MODEL.md` (PAM authority types §§4.A–4.K, chain §5, boundaries §6, delegation §7, trust §8)
- `docs/governance/platform/01-TIIZI-PLATFORM-CONSTITUTION.md`, `02-PLATFORM-PRINCIPLES.md`, `07-CONSTITUTIONAL-GLOSSARY.md` (searched; Glossary/Terminology hits read)
- `docs/governance/platform/03-PLATFORM-DOMAIN-AND-TERMINOLOGY-STANDARD.md`, `04-VERSION-2-LAUNCH-SCOPE.md` (Launch Scope exclusions/non-goals read), `08-PLATFORM-DATA-AND-INFORMATION-STANDARD.md` (searched)

**Registers / principles (read in relevant part; CGP-04 register rows verified):**

- `docs/governance/principles/CGP-04-ENTITY-RELATIONSHIP-ALLOCATION-REGISTER-v0.1.md` (§6 ALLOCATED/DEFERRED rows)
- `docs/governance/principles/CGP-03-GOVERNANCE-DOCUMENTATION-AND-TRACEABILITY-STANDARD-v0.1.md` (structure; compliance notes for this report in §15)
- `docs/governance/principles/33-CGP-02C-13-WHOLE-INSTRUMENT-FOUNDER-REVIEW-DRAFT-V0.md` (searched for Group/Challenge/Participation/Evidence/Recognition/authority propositions)

**Entity governance (read in relevant part):**

- `docs/governance/ownership/07-EOG-02-FOUNDER-APPROVAL-RECORD.md` (§§4–5: 18 approved principles, 17 deferred matters)
- `docs/governance/ownership/06-EOG-02-CONSTITUTIONAL-ACCOUNTABILITY-FRAMEWORK-FOR-GROUPS.md` (searched)
- `docs/governance/ownership/20-EOG-04-CONSTITUTIONAL-GOVERNANCE-OF-CHALLENGES-APPROVED.md` (§10 participation boundary, §17 deferrals, evidence chain §§388–404)
- `docs/governance/ownership/14-EOG-03-CONSTITUTIONAL-GOVERNANCE-OF-PLATFORM-KNOWLEDGE-APPROVED.md` (searched; Template/Creation boundaries)
- `docs/governance/ownership/27-EOG-05-ENTITY-OWNERSHIP-REGISTER-APPROVED.md` (via entry assessment + spot checks; AEV/DRV/KNW rows)
- GRP closure: `30-GRP-FOUNDATION-CLOSURE-EOG-02-EOG-05-IMPACT-ASSESSMENT.md`,
  `34-GRP-FOUNDATION-CLOSURE-FOUNDER-DECISION-RECORD.md` (GFC-02-B/03-A/04-B via entry assessment + spot checks),
  `35-GRP-FOUNDATION-CLOSURE-COMPLETION-REPORT.md` (searched)

**Domains (read in relevant part; key sections quoted):**

- `02-GROUP-DOMAIN-STANDARD.md` (visibility classifications ll.219–241; admin ll.152–176; lifecycle deferral l.78)
- `03-CHALLENGE-DOMAIN-STANDARD.md` (recognition l.237; ranking l.233; deferrals ll.92–98, 407–408)
- `04-ACTIVITY-EVENT-DOMAIN-STANDARD.md` (verification/correction deferrals §§7.9/14; eligibility boundary l.208)
- `01-PROFILE-DOMAIN-STANDARD.md` (searched for privacy/visibility/consent)
- `docs/governance/knowledge/EKG-01-TIIZI-KNOWLEDGE-GOVERNANCE-STANDARD-AND-KNOWLEDGE-ASSET-MODEL.md` (§§13–14 delegation precedent)

**Programme (read):**

- `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` §13 (Stage E1 purpose/deliverables/gate/dependencies) + stage tables
- `docs/programme/TIIZI-V2-PROGRAMME-GUIDE.md` (searched, §9 E1)
- `docs/programme/STAGE-EK-CLOSURE-DECISION-EK-CLOSE-01.md`; `STAGE-EK-KNOWLEDGE-FOUNDATION-AUDIT-AND-CARRY-FORWARD-ASSESSMENT.md` (E1 dependencies)
- `docs/programme/STAGE-E1-ENTRY-ASSESSMENT.md` — **ABSENT from the review worktree** (`origin/main`); present on assessment branch `recon/e1-entry-assessment` (`/private/tmp/tiizi-e1-entry/...`), read read-only and used as the FQ baseline (E1-FQ-01–12 wordings, CGP-04/EOG/GFC evidence map). It is assessment evidence, not authority.

**Not treated as authority:** `docs/architecture/`, `docs/reports/` (incl. challenge-engine audits/forensics),
Firestore rules, screens, V1 code/behaviour — used only as implementation/product evidence where noted
(§7 engine finding).

Five parallel read-only probe agents swept the corpus (evidence terminology; engine/recognition;
group governance; constitutional terms; programme/FQ); every MATERIAL+ claim below was re-verified
by direct read/grep before writing.

---

## 4. Authority / terminology findings (PASS 1)

Severity: BLOCKER / MATERIAL / MINOR / EDITORIAL. Every BLOCKER/MATERIAL item carries issue,
source, affected provisions, why-it-matters, and the required Founder reconciliation.

### F-E1 — BLOCKER — Evidence chain bypassed; “admissibility” is an unallocated parallel gate

- **Exact issue:** Draft §§27–31 govern evidence without once naming the approved chain. Verified
  zero occurrences in the draft of each of: *Acceptance Authority*, *Accepted Activity Event*,
  *Submission Intent*, *Acceptance Decision*, *Evidence Eligibility*, *Calculation Authority*,
  *Participation/Policy/Knowledge Authority*, *Trusted Backend/Platform Authority*. §28 instead
  introduces *admissibility* (“structural, semantic and Challenge-policy conditions … whether a
  record can legitimately be processed”), a term with **zero occurrences in the entire `docs/` tree**.
  No holder of the admissibility determination is named.
- **Authoritative source:** PAM `platform/10-PLATFORM-AUTHORITY-MODEL.md` §4.F (Acceptance Authority
  evaluates Submission Intent, establishes Accepted Activity Event), §5.4 (Trusted Acceptance),
  §5 chain (Submission Intent → Acceptance Decision → Accepted Activity Event → Policy/Evidence
  Eligibility → Calculation/Derived Truth), §6 boundaries 1/6/7; CGP-04 §6 ALLOCATED rows
  (Participant Authority → Submission Intent; Acceptance Authority → Accepted Activity Event;
  Policy Authority → Evidence Eligibility; Calculation Authority → Derived Truth); EOG-04 §§388–404.
- **Affected provisions:** §§27, 28 (core), 29–31 (downstream of the gap).
- **Why it matters:** §28’s checks (Challenge/Activity/Metric/Unit compatibility, Participation
  status, timing) are the joint operational content of the *Acceptance Decision* (Acceptance
  Authority) and *Evidence Eligibility* (Policy Authority). As written, §28 reads as a third,
  holder-less gate: it neither allocates the determination (forbidden to do silently — PAM §4.1
  “one relationship, one declared meaning”; PAF §10.14) nor references the allocated holders,
  weakening traceability to CGP-04 and risking Stage F implementing “admissibility” instead of the
  approved Acceptance/Eligibility determinations.
- **Founder reconciliation required:** Re-anchor §§27–31 on
  Submission Intent → Acceptance Decision → Accepted Activity Event → Evidence Eligibility →
  Derived Truth with holders named; either drop *admissibility* or define it explicitly as joint
  operational shorthand for the two approved determinations (with both holders cited). See §9 for
  the full evidence-terminology treatment and §14 FD-01.

### F-E2 — BLOCKER — “Challenge Engine” installed as Recognition authority without allocation

- **Exact issue:** Draft §48 makes “the governed Challenge Engine … determin[e]” Platform
  Recognition (11 occurrences of *Challenge Engine*; §§23–25, 47–48). The term has **zero
  occurrences in `docs/governance/`** — it exists only in `docs/architecture/` and `docs/reports/`
  implementation forensics, which are not authority.
- **Authoritative source:** PAM §§4.G/5.5/6.7 (Calculation Authority establishes Progress, Completion,
  Ranking, aggregates, Projections — i.e. all Derived Truth); CGP-04 §6 DEFERRED rows (Recognition
  Authority holder “not finally allocated”, MOT-01; Qualification “not finally allocated”);
  Challenge Domain Standard l.237 (“Recognition may truthfully acknowledge governed participation or
  outcome where later Policy permits”); EOG-05 DRV-09 provisional (MOT-01); Launch Scope l.63
  (challenge types, ranking/streak rules “subject to later approved decisions”).
- **Affected provisions:** §§23–25 (Engine-rules references), 47–48 (core), 50.
- **Why it matters:** The draft assigns to an unallocated implementation noun what approved
  governance assigns to Calculation Authority (Derived Truth) and deliberately defers (Recognition
  Authority, MOT-01). Approving §48 as written would pre-allocate MOT-01 by the back door and give
  Stage F a governance mandate to build “Engine authority” rather than implement Calculation
  Authority under Policy.
- **Founder reconciliation required:** Allocate (or expressly reserve to MOT-01) the Recognition
  Authority holder and the Engine’s status (implementation of Calculation Authority under Policy vs
  distinct governed role). See §10 and §14 FD-02.

### F-T03 — MATERIAL — Binary Public/Private Groups vs approved three-way information classification

- **Exact issue:** Draft §14 establishes Public/Private as the only classifications and states
  “Additional visibility classifications are not established by this Standard.”
- **Authoritative source:** Group Domain Standard ll.235–238 — approved information classifications
  **Public** (“specifically approved for access without a membership relationship”),
  **Authenticated-discoverable** (“Minimal Group information approved for governed discovery by an
  authenticated person”), **Private** (“restricted to specifically authorized purposes”); l.241
  (“Final Group discoverability and access rules remain deferred”); l.219 (“Group visibility does
  not imply public access”); EOG-02 deferred list (“Group discoverability, visibility and related
  privacy detail”).
- **Affected provisions:** §§14–16, 40–42.
- **Why it matters:** The middle category the draft deletes is exactly the one its own discovery
  model needs (authenticated non-member browsing a Public Group’s Challenges, §§15–16). A binary
  group-level label also collides in name with information-level classifications, inviting
  “Private Group ⇒ everything hidden / Public Group ⇒ everything visible” misreads that §§40–42
  otherwise correctly guard against.
- **Founder reconciliation required:** Confirm whether Public/Private are *group-level* categories
  coexisting with information-level Public/Authenticated-discoverable/Private (recommended), and
  retain the middle discovery tier or consciously remove it with reasons. See §11, §14 FD-03.

### F-T04 — MATERIAL — Recognition chain preempts MOT-01; qualification correctly absent

- **Exact issue:** Draft §§47–50 fully specify the Recognition authority chain down to “Platform
  Recognition” while Recognition Authority and qualification are CGP-04 DEFERRED (MOT-01).
- **Source:** CGP-04 §6 (two Recognition DEFERRED rows); Challenge Standard l.237; EOG-04 §17.2
  (“Recognition or Reward qualification”, l.86, deferred).
- **Affected:** §§47, 48, 50. **Why it matters:** Direction is compatible (Truth-Before-Recognition,
  ontology Part V), but an approval candidate must present §§47–50 as the *proposed MOT-01
  allocation* for explicit Founder decision, not as settled chain. §50 (“no routine human
  certification”) is compatible with PAM (no human authority type) but must not be read as
  allocating away the unallocated exceptional/admin role in recognition (ACT-adjacent).
- **Reconciliation:** Mark §§47–50 as the MOT-01 proposal; Founder allocates (FD-02).

### F-T05 — MATERIAL — §27 risks being read as resolving deferred Verification (ACT-03)

- **Exact issue:** “Tiizi does not ordinarily verify or certify that the physical or wellness activity
  … actually occurred” (§27) never engages the approved noun *Verification* (EOG-05 AEV-08, meaning
  deferred to ACT-03; Activity-Event Standard defers “Verification rules”, ll.118/401/479) or the
  unallocated Verification Authority holder (CGP-04 DEFERRED, ACT-03/ACT-04).
- **Source:** PAM §8 (“Trusted does not mean … infallible”); PAM §4.A (Participant Authority “Must
  not establish … Verification”); AEV Standard l.208 (“Eligibility is not acceptance, Verification
  or Progress”).
- **Affected:** §§27–28, 54 (“verification conditions” for rewards — term hygiene risk).
- **Why it matters:** Compatible as a description of ordinary operation, but without an explicit
  “this does not allocate Verification Authority (ACT-03)” guard, Stage F/G readers may treat the
  Verification-holder question as closed.
- **Reconciliation:** Add the guard; capitalize-or-avoid “verification” in §54 (FD-01/FD-05).

### F-T06 — MATERIAL — Extension author and creator-admin handoff are unallocated (FQ-02/05/07 gap)

- **Exact issue:** §23 permits extension by “an appropriately authorized actor”; §35 passes continuing
  administration to “the Accountable Steward or another validly authorized Group actor” when the
  creator leaves. Neither actor/handoff is allocated anywhere: stewardship
  reassignment/relinquishment/succession are CGP-04 DEFERRED; Group administration allocation is
  EOG-02-deferred; “who may modify an active Challenge” is UNRESOLVED (entry assessment §8).
- **Source:** CGP-04 §6 (Stewardship Reassignment/Relinquishment/Succession DEFERRED; Establishment
  Mechanism CHL-01 DEFERRED); EOG-02 §5 deferred list.
- **Affected:** §§6, 23, 35. **Why it matters:** Chains C and D (§5) terminate in unnamed authority;
  §6’s “stewardship-dependent actions may be restricted” adds new restrictive content that needs an
  explicit decision, not an implication.
- **Reconciliation:** Founder names the extension authority and the creator-departure handoff, or
  expressly reserves both to named FQs (FD-04, FD-06, FD-07).

### F-T07 — MATERIAL — §62 pre-records the FQ-11 outcome without the required Founder decision

- **Exact issue:** §62 declares existing authority + this Standard “provide the E1 Security & Trust
  governance necessary for progression to Stage F.”
- **Source:** E1-FQ-11 (entry assessment §9): “If the Founder judges PAM §§8/11/13 sufficient … this
  FQ may close with no new text — **recorded as a decision, not a document**.”
- **Affected:** §62. **Why it matters:** The conclusion is plausibly correct, but only the Founder
  can close FQ-11, and closure must be a recorded decision. A draft cannot self-certify its own
  sufficiency gate.
- **Reconciliation:** Founder records the FQ-11 decision explicitly; §62 then stands as its
  memorial (FD-05).

### F-T08 — MATERIAL — Reopening prohibition decides a deferred EOG-04 matter (needs confirmation)

- **Exact issue:** §26 (“cannot be extended, reopened or reactivated as the same Challenge”) decides
  “finalization and reopening,” expressly deferred in EOG-04 §17.2.
- **Source:** EOG-04 §17.2 deferral list; entry assessment E1-FQ-05.
- **Affected:** §§23, 26, 57. **Why it matters:** The substance (extension-before-end vs new-identity-
  after-end) is coherent and matches EOG-04 identity-continuity principles, but it is a substantive
  E1 decision, not a restatement — it must be adopted knowingly, with the snapshot/retention/access
  remainders of FQ-05 still open.
- **Reconciliation:** Explicit Founder adoption (FD-04).

### MINOR findings (no Founder policy choice; handle in correction pass)

- **M-01:** *Accountable Steward* usage matches the PAF §5.3 formal-term rule; §§5–6 track EOG-02
  principles 4–8. “Transfer + acceptance” is new-compatible (cf. GFC-02-B successor-continuous
  model) but resolves CGP-04 DEFERRED rows → keep, but route through explicit approval +
  CGP-04 reconciliation (FD-09).
- **M-02:** *Administrator/Super Admin* §§37–38, EKG-01 §§13–14 precedent (“Super Admin … conferring
  no independent authority”; capability-specific delegation), Group Standard ll.152/171/176, PAM
  §6.8 — consistent. “Super Admin” capitalization matches EKG-01.
- **M-03:** *Charter* hierarchy (§§7, 46) respects GFC-03-A/EOG-02 principle 15 (Charter = Governed
  Subject, subordinate, not Authority). Charter form/content/amendment/binding (§7 prefilled
  articles; §46) is legitimate new FQ-09 content, not conflict — but amendment authority/binding/
  versioning remain unanswered (see §8 FQ-09).
- **M-04:** *Stewardship Council / Governance Body* (§8) matches EOG-02 principle 8 / GFC-04-B
  (“supports but never replaces”). Prefer the approved alias “Stewardship Council” (EOG-05 C-GRP-08
  via CG-08) over bare “Governance Body” for register consistency.
- **M-05:** *Delegation* conditions (§37) match PAM §7 + PAF §8 + CGP04-P29–P32 (explicit, scoped,
  attributable, revocable; ≠ transfer). PAF §5.12/§8.3 note stewardship changes only via governed
  reassignment — §37’s last line complies.
- **M-06:** *Participant/Participation* (§§9, 19–20, 36) matches PAM §5.8, EOG-04 §10
  (voluntary, Challenge-specific, “Participation ≠ Governance”), CGP-04 rows. *Challenge Creator as
  historical attribution* (§35) is new-compatible (cf. CGP-04 “Group creation → Creator”).
- **M-07:** *Truth/Derived Truth* (§§2, 42, 47–48, 68) used consistently with PAM §5; but Calculation
  Authority is never named — same root cause as F-E1.
- **M-08:** *Kudos* (§51) has zero `docs/` occurrences: new product-layer vocabulary. Its boundary
  (“does not establish or alter Truth/Recognition/Evidence/ranking”) is exactly right per PAM
  §§4.7/4.10/6 (origin/contribution/presentation ≠ approval/truth) — keep, but label as product
  vocabulary for Stage F, and drop the “financial contribution to a cause” example (see §12).
- **M-09:** *Template/Wizard* boundary (§§18, 49) matches EOG-03 §13 / EOG-04 §17.3 (boundaries, not
  governance) and EOG-05 C-KNW-16 provisional (CG-06). Omission: *Creation Mechanism* (CTL C-CTL-07,
  provisional CG-07) unmentioned — carry into FQ-01 work, not a defect.
- **M-10:** PAF file header still reads “Draft for founder review. No accountability relationship is
  allocated” (§13) although EOG-01 vocabulary was Founder-approved (05-EOG-01-FOUNDER-APPROVAL-RECORD;
  entry assessment §6.1). Corpus status-hygiene note, not a draft defect — recommend mechanical
  reconciliation under CGP-03, no E1 policy content.
- **M-11:** *Consent withdrawal prospectivity* (§44) and *minimum necessary* (§45) correctly restate
  PAM least-privilege/cross-cutting privacy and the HID-06/07 expression-vs-record distinction;
  consent-record mechanics remain for the later Consent standard (EOG-05) — correctly not invented.

### EDITORIAL (correction pass, no escalation)

- **E-01:** “Acceptance Authority / Verification / Accepted Activity Event” appear in the task’s
  caution list but nowhere in the draft — that absence is F-E1, not a wording tweak.
- **E-02:** §14 “not generally discoverable” and §16 “minimum information legitimately required” are
  vague quantifiers; replace with the Group Standard’s “specifically authorized purposes” test.
- **E-03:** §§23/57 say “preserves the original end date / timing historically” while §57 also
  requires amendments never be backdated — consistent, but use one phrasing in both places.

---

## 5. Internal consistency findings (PASS 2)

- **Chain A (Group First → Membership → creation → Participation): COHERENT.** §§2–3, 9, 17, 19
  state one consistent progression; “must be a Member before create/join” (§3) matches EOG-02/
  EOG-04 boundaries. No circularity.
- **Chain B (discovery → join → eligibility → voluntary Participation): COHERENT.** §16’s
  five-step chain and “Discoverable ≠ Member ≠ Eligible ≠ Participant” match Group Standard l.183
  (“Being represented or discoverable does not establish membership”) and EOG-04 §10.2.
- **Chain C (creator attribution → admin → leaves → continuity): GAP (see F-T06).** §35’s handoff
  (“may pass to the Steward or another validly authorized Group actor”) names no allocation; the
  fallback actor may not exist (Group administration unallocated). Internally consistent as prose,
  ungrounded as governance.
- **Chain D (Collective Active → extension → preservation → ending): COHERENT with one gap.**
  Extension-before-end, same-identity continuation, no-reset, attributable, history-preserving
  (§§23, 57) are mutually consistent; the authorizing actor is unnamed (F-T06).
- **Chain E (Ended → repeat → new identity): COHERENT.** §26’s six “new” items + “operational
  history does not carry forward” are crisp and internally complete; Template-like reuse (§26)
  does not contradict §18 (Template configures, establishment creates). Requires Founder adoption
  as a decided (not restated) rule (F-T08).
- **Chain F (self-report → admissibility → calculation → Derived Truth → Recognition): BROKEN
  (see F-E1/F-E2).** The chain skips every approved intermediate authority and holder.
- **Chain G (correction → dispute → integrity): COHERENT.** §§30–31, 58: self-correction default,
  history-preserving material correction, no impersonation-rewrite, exceptional handling needs
  “separately valid authority” — correctly defers ACT-04 allocation; matches AEV Standard §14
  (ll.325–337).
- **Chain H (Public Group → discovery → Profile/Evidence privacy): COHERENT, subject to F-T03.**
  §§40–42’s separations (community discoverable ≠ data public; raw Evidence ≠ derived progress ≠
  leaderboard ≠ feed) are the correct operationalization of Group Standard ll.219/235–238 and PAM
  cross-cutting privacy.
- **Chain I (Engine → type rules → config → Recognition): ASSERTED, NOT GROUNDED (see F-E2/F-T04).**
  Internally the chain is well-formed; its authority link (Engine determination) has no approved
  source.
- **Chain J (Recognition → Kudos → Reward): COHERENT.** §§51–54 keep three distinct layers with
  correct boundaries (acknowledgement ≠ Truth; recognition ≠ promise of Reward). Reward example
  hygiene only (M-08, §12).

No circular authority was found. Missing handoffs: extension authorizer, creator-departure
recipient, suspension/removal authorizer (§13 “appropriately authorized Group action” — Group
administration unallocated), anomaly-flag responder (§29 flags with no governed consumer — correctly
deferred as “mechanisms downstream,” but FQ-06 should name the consumer class).

---

## 6. Existing-authority duplication findings (PASS 3)

Rule applied: compress to reference + operational application; do NOT delete where removal would
impair interpretability or reopen an E1 question.

| Draft cluster | Already governed by | Recommendation |
|---|---|---|
| §§2–3, 9, 19–20 (distinct relationships; voluntary; no auto-enrolment) | PAM §5.8; PAF §§4.9/6; EOG-02 §§12/15; EOG-04 §10; CGP-04 rows | **Shorten** to 2–3 operational sentences + citations; keep the §16/§68 formulations as the instrument’s normative core |
| §§5–6 (stewardship singularity; no silent assignment) | EOG-02 principles 4–8; PAF §§4.3/10.14; CGP-04 rows | **Retain only the new**: transfer+acceptance procedure, succession-gap restriction (both need FD-06/FD-09); reference the rest |
| §§32–34, 37–39 (contextual authority; minimal roles; delegation; revocation) | PAM §7; PAF §§7–9; CGP04-P29–P32 | **Shorten** to E1 application (Steward→Member capability delegation; revocation prospectivity); cite the constitutional conditions once |
| §§43, 60 (visibility/preservation ≠ truth/access) | PAM §§4.10/4.14/6; PAF §4.14 | **Merge** into one boundary proposition cited twice, not restated per part |
| §62–63 (no parallel security constitution; tech boundary) | PAM §§8/11/13–14; EKG-01 §14; CGP04-P41/P42 | **Keep §63** (it is the E1/F/H allocation doing real work); §62 stands only via FD-05 decision |
| §§68–69 (principles/sufficiency) | Restatements of the above | **Keep §68** as the compressed normative spine; fold §69’s “new instrument” test into approval-front-matter, not the standard |

**Do NOT compress away:** §§23–26 (type-specific lifecycle — new E1 decisions); §§27–31 (evidence
operations — subject to F-E1 re-anchor); §§40–42/44–45 (visibility/consent rules — new governance);
§§55–61 (preservation specifics — new governance); §26 reopening rule (needs FD-04 adoption, then keep).

---

## 7. Downstream-boundary findings (PASS 4)

**Verdict: PASS with two boundary watches.** §§64–67 draw the F/G/H/Reward lines correctly, and the
draft repeatedly refuses what it must refuse (no formulas, scoring, ranking mechanics, streak
algorithms, Engine internals, feeds, recommendations, notifications, moderation UX, field-level
visibility, permission matrix, Wizard/Template UX, IAM/RBAC, schemas, Firestore rules, APIs,
persistence, migration, reward infrastructure).

- **W-01 (MINOR):** §21 correctly labels post-withdrawal evidence-weighting a “Stage F calculation
  matter” — not a leak, but FQ-04’s “effect on truth” split (governance here / calculation in F)
  needs Founder confirmation (FD-07-axis, §8).
- **W-02 (MINOR):** §42 names “leaderboard information” among visibility layers while leaderboard
  mechanics are F (FQ-13). Visibility-of-leaderboard is legitimately E1 (purpose-limited
  visibility); mechanics are F. Keep the sentence, add “mechanics per Stage F” to prevent
  misreading.
- **No G/H content found.** No product permission matrix, no schemas, no migration rules.
- **Deferred-maturity discipline kept:** §§64–67 + §69 correctly refuse individual/non-Group
  Challenge models (Launch Scope ll.14/69–71/83: excluded), governance-maturity models, and reward
  infrastructure.

---

## 8. FQ-01–FQ-12 coverage matrix (PASS 5)

FQ wordings per `STAGE-E1-ENTRY-ASSESSMENT.md` §9 (assessment branch; evidence, not authority).

| FQ | Draft coverage | Classification | Reason |
|---|---|---|---|
| FQ-01 Challenge establishment | §§17–18 (+§§7, 49) | **PARTIAL** | “Who may create” answered (any Member; Charter-restrictable — matches Founder decision). Authenticating authority for identity/purpose/Goal (CHL-01) unnamed; Template/Creation governance folded minimally (M-09) |
| FQ-02 Stewardship continuity | §§6, 35 | **PARTIAL** | Transfer+acceptance + gap restriction proposed, but relinquishment-without-successor procedure, succession, stewardship-failure (GFC-02-B procedures) unspecified; §6 restriction needs FD-06 |
| FQ-03 Membership lifecycle | §§10–13 | **SATISFIED** (conditional) | Invitation/entry/suspension/restoration/removal/departure covered at governance level; processes rightly deferred. Conditional on FQ-07: the §13 authorizer is unallocated Group administration |
| FQ-04 Participation | §§19–21 | **PARTIAL** | Eligibility/entry/withdrawal/removal/history covered; voluntary core matches EOG-04 §10. “Effect on truth” deferred to Stage F (§21) — acceptable split only if Founder confirms (W-01) |
| FQ-05 Lifecycle | §§22–26, 57 | **PARTIAL** | Type-specific ending + extension-vs-new-identity decided (needs FD-04). Missing: states/transitions inventory, active-Challenge amendment (Goal/target/config per EOG-04 §17.2), snapshots/archival/access rules |
| FQ-06 Evidence integrity | §§27–31 | **CONFLICT** (vocabulary) | Substance direction compatible (self-accountability; history-preserving correction), but chain vocabulary contradicts approved allocation by omission (F-E1); acceptance criteria + Verification holder (ACT-03) + correction authority (ACT-04) unallocated (F-T05) |
| FQ-07 Roles/delegation | §§32–39 | **PARTIAL** | Vocabulary + delegation conditions correct (M-05/M-06); canonical role→authority assignments absent — which is the FQ itself (extension authorizer, suspension authorizer, creation authenticator). Admin allocation/specific powers still missing |
| FQ-08 Privacy/visibility/consent | §§40–46 | **PARTIAL** | Governance-level rules correct in direction; Public/Private needs F-T03 reconciliation; visibility-class operation mechanics + consent-record mechanics rightly left to later standards |
| FQ-09 Charter/Body | §§7–8, 46 | **PARTIAL** | Hierarchy + optionality + subordination correct (M-03/M-04); the deferred core (requirement, amendment authority, binding effect, versioning, council composition/procedure) still unanswered — that is the remaining FQ-09 work |
| FQ-10 Recognition | §§47–51 | **PARTIAL** (with BLOCKER) | Direction compatible; authority proposed via unallocated Engine (F-E2); qualification absent (correct — that is the FQ). Present §§47–50 as the MOT-01 proposal for allocation (FD-02) |
| FQ-11 Security & Trust | §§62–63 | **PARTIAL** | §63 boundary correct; §62 asserts sufficiency only the Founder can record (F-T07/FD-05) |
| FQ-12 Preservation | §§55–61 | **SATISFIED** (conditional) | What/for-whom/intelligibility answered; no universal period (correct); superior-obligation override correct (§61). Conditional on Founder confirming “how long as policy” needs no universal answer |

**Totals: SATISFIED 2 (both conditional) · PARTIAL 9 · CONFLICT 1 · MISSING 0.** Every E1 question
is materially engaged; none is absent. The two conditionals and the conflict are all resolved by
the FD items in §14 — i.e. the draft is one Founder correction pass away from full coverage.

---

## 9. Special finding — Evidence terminology (REQUIRED)

Minimum-necessary quotes; exact references.

**Q1 — What does “Acceptance Authority” currently mean?**
Governed event acceptance (system acceptance under policy), **not** factual verification of
real-world activity. PAM §4.F: “Purpose: Evaluate Submission Intent and establish Accepted Activity
Events as authoritative Activity Information” (`platform/10-PLATFORM-AUTHORITY-MODEL.md:172–176`);
“Source of authority: Trusted Platform Authority acting under approved evidence and activity
governance” (:180). PAM §5.4: “Acceptance Authority evaluates Submission Intent under approved
Knowledge and Policy, makes an Acceptance Decision and establishes the Accepted Activity Event as
authoritative Activity Information” (:329–331). EOG-04: “Acceptance Authority evaluates Submission
Intent under approved Knowledge, Policy and participation context” (l.404).

**Q2 — Factual verification, system acceptance, or governed event acceptance?**
Governed event acceptance. Nothing in the approved chain certifies that the physical activity
occurred: PAM §5.2 “Neither establishes that a participant acted” (:323); PAM §8 “Trusted does not
mean: infallible” (:392–397); PAM §4.A, Participant Authority “Must not establish: … Verification”
(:95–101) — i.e. *Verification* is a separate, still-deferred matter (EOG-05 AEV-08 → ACT-03;
Activity-Event Standard: “Verification rules” deferred, ll.118/401/479).

**Q3 — Is “admissibility” compatible?**
Only if explicitly mapped. Approved law knows exactly two post-submission gates: the *Acceptance
Decision* (Acceptance Authority) and *Evidence Eligibility* (Policy Authority “for a declared
calculation”; PAM §6.7; AEV Standard l.208: “Eligibility is not acceptance, Verification or
Progress”). §28’s checklist is their joint operational content. As a free-standing third gate with
no holder, it is NOT compatible — it violates PAM §4.1 (one meaning) and PAF §10.14 (no silent
assignment). As explicitly-defined joint shorthand with both holders cited, it is compatible.

**Q4 — Does draft wording weaken approved governance?**
Yes, by omission: F-E1 (chain bypass) + §54’s lowercase “verification conditions” (preempts ACT-03
by casual usage). No approved proposition is directly contradicted in substance — the
self-accountability direction matches PAM §§4.A/5.3 (“Intent is an expression for evaluation, not
an accepted fact,” :327) and PAF §4.7 (origin ≠ acceptance).

**Q5 — Terminology correction to bring back (NOT resolved here):** FD-01 (§14).

## 10. Special finding — Challenge Engine / Recognition (REQUIRED)

- “Challenge Engine” has **no approved governed definition or authority allocation** (zero
  `docs/governance/` hits; implementation-only usage in `docs/architecture/challenge-engine-spec.md`
  and member-phase forensic/report audits — product evidence, not authority).
- The draft’s upper chain (Platform Governance → Challenge Type/Engine rules → particular
  configuration) is consistent with EOG-04 composition/governance boundaries; the lower link
  (Engine determination → Recognition) is not: Derived Truth belongs to Calculation Authority (PAM
  §§4.G/5.5/6.7 — Progress, Completion, Ranking, aggregates, Projections), and Recognition
  Authority is CGP-04-DEFERRED (MOT-01), never assigned to any human *or* system actor. No
  instrument assigns Recognition Authority differently — the field is empty, not contested.
- Draft §50’s “no routine human certification” is compatible with PAM (no human authority type
  exists) but must not extinguish the unallocated exceptional/admin recognition role (MOT-01).
- **Do not invent Engine authority.** Required: Founder allocates Recognition Authority holder +
  Engine status (implementation of Calculation Authority under Policy vs distinct governed role) —
  FD-02 (§14). Until then §§47–50 are a proposal, not a chain.

## 11. Special finding — Public / Private Groups (REQUIRED)

- No approved *group-level* Public/Private categories exist. What exists is the Group Standard’s
  *information-level* three-way classification (ll.235–238) with final discoverability rules
  deferred (l.241) — see F-T03.
- As E1 minimum classification, binary Public/Private: **aligns in direction** (EOG-02 deferred
  “discoverability, visibility and related privacy detail”; Group Standard contemplates
  authenticated discovery, l.236), **conflicts in closure** (§14’s “no additional classifications”
  deletes the approved middle tier and decides a deferred matter).
- **Nothing in approved authority prevents non-members viewing Public Group Challenge discovery
  information:** Group Standard l.235 expressly approves Public information “for access without a
  membership relationship”; l.236 provides the authenticated-discovery tier; l.183
  (“discoverable ≠ membership”) and EOG-04 §10.2 support the §16 chain — subject throughout to
  minimum-necessary, purpose limitation, and Profile/Evidence separations (§§40–42, correctly drawn).
- Reconciliation: FD-03 (§14).

## 12. Special finding — Future Rewards (REQUIRED)

- Searched `docs/governance/` for reward/prize/incentive/financial-benefit/financial-contribution:
  **rules: none.** Every hit is a deferral, boundary, or principle: Challenge Standard ll.92/98/407
  (“Reward rules” for future standards), EOG-04 l.86 (“Recognition or Reward qualification”
  deferred), Launch Scope l.63 (“rewards … subject to later approved decisions”) and l.95 (launch
  “does not … approve a reward model”), ontology “Participation Before Reward: Reward, where later
  governed, must never substitute for meaningful participation” (00:236), Challenge Standard l.233
  (Ranking “is not Recognition, Reward or arbitrary score”), l.237 (Recognition “does not create …
  Reward authority”).
- No prohibition on future Group-declared Rewards exists; no permission mechanics exist either.
- **Classification: SAFE TO PRESERVE AS DEFERRED CAPABILITY**, on conditions the draft already
  meets: no model, no funding/fulfilment/payment/dispute mechanics (§§53–54, 67 defer all of it),
  ordinary self-accountability model untouched (§54, compatible with F-E1 fix), V2 Phase 1
  non-requirement explicit (§§53, 67). Two hygiene notes: (a) §51’s “financial contribution to a
  cause” Kudos example should be removed — acknowledgement copy must not imply contribution
  accounting before any such governance exists; (b) §54’s “verification conditions” needs F-T05
  term hygiene.
- No Founder reconciliation of substance required — confirm preservation only (FD-08).

---

## 13. Compression map (PASS 6)

Target: **~40 provisions in 10 parts** (from 69 provisions / 15 parts + purpose). No full rewrite
offered; map only, as instructed. “Retain” means keep the exact substantive concepts cited.

- §1 + §69 → **1 front-matter block** (purpose + sufficiency test; the “new instrument” test moves
  to approval front-matter, not the standard).
- §§2 + 9 + 19 + 20 → **2** (operating progression; three-relationship distinction + no-auto-enrolment).
  Retain: “Membership determines belonging; configuration determines eligibility; Member determines
  participation”; “eligibility/discovery/invitation ≠ Participation”.
- §§3 + 17 → **1** (Group First + creation right). Retain: exactly-one-Group; Member-before-create/join;
  any-Member-may-create default + Charter restriction.
- §§4 + 5 + 6 (first half) → **2** (establishment attribution; singular stewardship + transfer/acceptance +
  no-silent-assignment). Retain EOG-02 principles by citation, not restatement.
- §§6 (gap clause) + 35 + 37 → **2** (stewardship continuity; delegation + creator-admin). Needs FD-06/FD-07.
- §§7 + 8 + 46 → **2** (Charter hierarchy + proportionality; optional Council). Retain: Platform → Charter →
  Operations; Council never replaces Steward.
- §§10 + 11 + 12 + 13 → **2** (admission modes + invitations; voluntary departure + suspension/removal/
  restoration + history persistence).
- §§14 + 15 + 16 + 40 → **2–3** (group-level visibility + discovery chain + visibility separation).
  Needs FD-03; retain “Discoverable ≠ Member ≠ Eligible ≠ Participant”.
- §§18 + 49 → **1** (Wizard/Template boundary). Retain: facilitate/configure/carry, never authority.
- §§21 + 26 (+§58) → **2** (withdrawal/removal prospectivity; ended-rule + new-identity). Needs FD-04.
- §§22 + 23 + 24 + 25 + 57 → **4** (common lifecycle; Collective+extension; Streak; Competitive; history).
  Retain type-specific ending conditions + extension-before-end vs new-after-end.
- §§27 + 28 + 29 → **2 after FD-01 re-anchor** (self-accountability; Acceptance+Eligibility determinations;
  anomaly flags with no-verdict semantics). Drop “admissibility” or define as joint shorthand.
- §§30 + 31 → **1–2** (community accountability limits; self-correction + history preservation).
  Retain: no group rewrite of another’s assertion; no silent rewrite.
- §§32 + 33 + 34 + 36 + 38 + 39 → **3** (contextual authority + minimal vocabulary; participant authority;
  platform admin + revocation prospectivity).
- §§41 + 42 + 44 + 45 → **3** (profile separation + evidence-visibility layers; consent + prospectivity;
  minimum necessary). §43 + §60 merge into one cited boundary proposition.
- §§47 + 48 + 50 → **2 after FD-02** (recognition-follows-truth; determination chain as MOT-01 proposal;
  no routine human certification). §51 → **1** (Kudos boundary, product vocabulary).
- §§52 + 53 + 54 + 67 → **2** (recognition≠reward; deferred capability + reward-specific integrity).
- §§55 + 56 + 61 → **3** (intelligibility standard; group/challenge/participation/authority schedules;
  retention + superior obligations). §§58–59 fold into schedules.
- §§62 + 63 + 64 + 65 + 66 → **3** (security requirements memorial via FD-05; technical boundary;
  F/G/H + rewards deferral table).
- §68 → **retain as the 11-line normative spine** (add the re-anchored evidence line after FD-01).

---

## 14. Exact Founder decisions required

Nothing below is decided here. Each needs an attributable Founder record before approval candidacy.

- **FD-01 (BLOCKER):** Re-anchor §§27–31 on the approved chain (Q5, §9): name Submission Intent,
  Acceptance Decision/Accepted Activity Event (Acceptance Authority), Evidence Eligibility (Policy
  Authority), Derived Truth (Calculation Authority); drop or explicitly define “admissibility”;
  add the ACT-03 non-allocation guard; fix §54 “verification” hygiene.
- **FD-02 (BLOCKER):** Allocate or reserve (MOT-01) the Recognition Authority holder; fix the Engine’s
  status (implementation of Calculation Authority under Policy vs distinct governed role); adopt
  §§47–50 as proposal or amended text.
- **FD-03:** Adopt group-level Public/Private coexisting with information-level
  Public/Authenticated-discoverable/Private, or amend; retain or consciously remove the middle tier.
- **FD-04:** Adopt the reopening prohibition (§26) as a decided E1 rule; name the extension
  authorizer (§23); state which FQ-05 remainders (states inventory, active amendment, snapshots,
  archival/access) stay open into Stage F entry.
- **FD-05:** Record the FQ-11 closure decision explicitly (PAM-sufficiency or new requirements);
  §62 then memorializes it.
- **FD-06:** Adopt transfer+acceptance (§6) incl. the succession-gap restriction; specify
  relinquishment-without-successor, succession, and stewardship-failure handling (or reserve to
  named follow-up).
- **FD-07:** Name the creator-departure administration handoff (§35); confirm the FQ-04 “effect on
  truth” governance/calculation split (§21/W-01); name the suspension/removal authorizer class
  (§13) or reserve to FQ-07 assignments.
- **FD-08:** Confirm preservation of the deferred Reward capability (no model, no mechanics).
- **FD-09:** Trigger mechanical CGP-04 reconciliation (CGP03-P31/P38) for every DEFERRED row this
  instrument resolves (stewardship reassignment/relinquishment/succession; establishment CHL-01;
  membership lifecycle; participation withdrawal; verification ACT-03/04; recognition MOT-01) —
  plus the 3 EK-resolved knowledge rows already outstanding.
- **FD-10:** Approve the §13 compression (69 → ~40 provisions) and the correction-pass mandate
  (MINOR/EDITORIAL items M-01–M-11, E-01–E-03, W-01–W-02).

## 15. Recommended next action

1. Founder records decisions FD-01–FD-10 (direct decision per CGP03-P28 acceptable).
2. A bounded correction pass applies them to the working draft (still under `docs/programme/working/`,
   still unpromoted) — evidence-chain re-anchor, Engine/MOT-01 allocation, visibility reconciliation,
   compression map.
3. Re-validate the corrected draft against CGP-04 + PAM chain, then promote to approval candidate
   through the Master Programme §13 checklist (Founder Review → Validation → Traceability → Approval
   → Adoption Record → Programme/Dashboard Updated).

**CGP-03 compliance note for this report:** evidence-only record (no governance changed); sources
cited with exact paths/sections/quotes; baseline pinned (`origin/main c02ac4e`); working draft
explicitly unpromoted; single new file on an unmerged review branch (§16). No authority or
programme state was changed by this task.

---

## 16. Recording

- **Review branch:** `recon/e1-iog-review-001` (from `origin/main c02ac4e` in the clean worktree)
- **Baseline commit:** `c02ac4edbe842c998a546f59bb10926515a2409c`
- **Files created:** `docs/programme/E1-IOG-REVIEW-001.md` (this report) — ONLY file changed
- **Files unmodified:** working draft untouched; Master Programme, decision registers, approved
  governance, Stage E1/F status all untouched
- **Validation:** no repository documentation-validation gate exists (no Makefile/markdownlint/vale;
  `package.json` governs the app build only); performed self-check — markdown structure, section
  numbering §§1–16 complete per task §J, severity counts reconciled, quotes verified against sources
- **Merge:** none (per instruction — branch left unmerged for review)


