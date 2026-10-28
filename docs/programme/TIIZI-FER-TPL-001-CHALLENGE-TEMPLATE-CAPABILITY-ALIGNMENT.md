# TIIZI-FER-TPL-001 — Challenge Template Capability Alignment

**Status:** FOUNDER-ALIGNED DOCUMENTATION (FD-TPL-01…04 recorded, §5) — documentation and architecture reconciliation only. **P5T — IMPLEMENTATION NOT STARTED / NOT AUTHORIZED.** No code, schema, migration, deployment, data write or production access is authorized by this document. P5T needs its own written Founder/Technical Lead authorization per slice.
**Founder direction:** 28 October 2026 — Operator-created, pre-filled Challenge Templates are **required for Complete Product Experience (CPE) acceptance** before the Controlled Pilot. The pilot limits users, not features (Disposition §17 / FER-001-A FDR-00).
**Source baseline:** `origin/main` `d5e1ed4a600dee8464412e3372943c8c2780640a` (Master Programme v2.82). Code facts below were read at that commit and must be re-verified when P5T starts. This document does **not** edit the Master Programme (see §6).
**Amends (additively):** [FER-001-B](TIIZI-FER-001-B-EXPERIENCE-RECOVERY-IMPLEMENTATION-PLAN-001.md) (new package P5T, sequence, summary, CPE gate) and the derived [Technical Control Board](TIIZI-TECHNICAL-CONTROL-BOARD.md). FER-001-A and C are unchanged; historical Founder decisions are preserved.

## 1. Current capability and reuse assessment

**Finding: the architecture for Templates was decided at PF-04 and never built. There is no Template implementation to preserve and nothing to compete with.**

| Area | What exists on main | Reuse for P5T |
|---|---|---|
| Product direction | `api/src/challengeComposer.ts:17-23` (PF-04, merged v1.65): the Wizard is *the* creation system; Templates are authored **through the same Wizard** (`TEMPLATE_AUTHORING` mode, PF-06); a member Template only pre-populates the same Composer draft ("Use a Template" → review/adjust → Preview → Establish); Templates never bypass PF-03, never establish Challenges, and there is never a second Template configuration form. Master Programme v1.65 repeats this: "PF-06 — Challenge Template System & Admin Management follows PF-05". | **Governing.** P5T is the delivery of PF-06 inside FER-001. No decision needs re-opening. |
| Composer mode | `ComposerMode = 'CHALLENGE' \| 'TEMPLATE_AUTHORING'` (`challengeComposer.ts:57`); both modes share every field and the same PF-03 validator (`:54-56`). | Reuse as is. |
| Template serialization | `serializeComposerDraft` / `parseComposerDraft` exist "for PF-06 Template compatibility (Template → draft)" (`:739-752`); `normalizeComposerDraft` rejects unknown fields fail-closed (no points, rewards, donation, V1 keys). | Reuse as the Template configuration codec. No new draft format. |
| Semantic authority | `validateChallengeDefinition` (PF-03, `challengeDefinition.ts`, "Wizard Preview, Template validation and Challenge establishment never …" `:13`); `POST /api/challenge-definitions/preview` (`challengeCreationSeamRoutes.ts:83`); stale-Activity detection (`observedVersion`, `STALE_ACTIVITY`; "detected, never auto-fixed"). | Reuse for publish-time validation and adoption-time staleness. No second validator. |
| Establishment | `POST /api/challenges` (`challengeCreationRoutes.ts:441`) is the single governed establishment path; authority = live Group + live membership + Charter `allowMemberChallenges` (`challengeCreationAuthority.ts:1-12`); hosting eligibility server-validated. | Reuse unchanged except the additive mandatory provenance reference (FD-TPL-03, §2.5). Template adoption ends in this call, made by the member. |
| Member Wizard | Seven visible steps and `WizardState` (`challengeCreationDraft.ts`); route-state restore plus member-scoped `sessionStorage` backup and Activity Guide round trip (`challengeDraftSession.ts`, P0). Step 1 already says "Templates are not available yet — you are setting this Challenge up from scratch" (`V2ChallengeCreationWizard.tsx:497`). | Reuse. `WizardState` already carries a **relative duration** (`durationDays`, `scheduleMode: 'preset'`) with `deriveEndDate` (inclusive) and `startDate` defaulting to today (`createInitialWizardState`). |
| Operator Console | `/v2/operator/templates` route and nav slot exist (`routes.tsx:123`, `OperatorShell.tsx:18`) but render a **deferred placeholder** (`operatorPages.tsx:228`). Console authority is **read-only** (`platform_operator_console_readers`, migration 024; `operatorConsoleRoutes.ts:318` returns `canManageAccess: false`). The only write-capable operator capability is the separate Cause-review roster (migration 023); that separation is deliberate ("Cause decisions use their separate roster"). | Reuse the route, shell and desktop layout. **Write authority does not exist and must be added** (see §2.3). |
| Legacy Templates | `migrations/002_phase_b_knowledge.sql:5-6` left `challengeTemplates`/`wellnessTemplates` in Firestore "until a later domain migration". The placeholder says the Operator identity has no read path to them. | **Do not read, migrate or bridge.** Firestore Challenge/template authority is V1 (AGENTS.md §1.1); V2 PostgreSQL is the sole domain authority. Templates start empty and are authored fresh. |
| Lifecycle vocabulary | Knowledge uses `draft → published → retired`, forward-only (`knowledge.ts:24,57`). | Reuse the same three words and semantics for Templates. |
| Constitutional | EOG-04 (approved) — a Template/Creation Mechanism "cannot establish Challenge identity", cannot establish Policy applicability, permission or truth, and cannot become an equal Challenge authority (`docs/governance/ownership/20-EOG-04-CONSTITUTIONAL-GOVERNANCE-OF-CHALLENGES-APPROVED.md` lines 208, 346, 542, 690). `docs/governance/domains/05-KNOWLEDGE-ASSET-DOMAIN-STANDARD.md:551`: a Template "may propose or preconfigure references to governed Knowledge" but is not Knowledge authority. | Binding. Drives §4 boundaries. |
| Existing Template data/tests | None in `api/migrations`, `api/src`, `src/v2` beyond the items above. | — |

**Gaps (what P5T must add):** a PostgreSQL Template store with versioned immutable snapshots; an Operator Template-author capability and write routes; a Wizard entry choice and Template browse/preview; a Template→`WizardState` hydration function; mandatory internal provenance on the established Challenge (FD-TPL-03); searchable Operator and member Template Libraries (FD-TPL-02); adoption reporting (FD-TPL-04); tests.

## 2. P5T scope and dependencies

**P5T — Challenge Template Authoring and Adoption.** Required before CPE acceptance (capability 12). Delivered as independently reviewed slices; never one large rewrite.

### 2.1 Slices

| Slice | Content | Migration | Risk / Reviewer |
|---|---|---|---|
| **P5T-1 Template authority** | `challenge_templates` + immutable `challenge_template_versions`; template-author roster (§2.3); Operator write routes (create/save draft, preview, publish, revise, retire); member read routes (published only, searchable and filterable); publish-time PF-03 validation; separate author/publisher audit identities (FD-TPL-01); **mandatory provenance on the established Challenge (FD-TPL-03)**; adoption-read contract (FD-TPL-04). | **yes** (number assigned at start) | High (authority, new write capability) → **R2** |
| **P5T-2 Operator authoring (desktop-first)** | Extract the Wizard's step components so they run in `TEMPLATE_AUTHORING` mode inside `/v2/operator/templates`; searchable and filterable Template Library, create/edit, preview, publish/revise/retire, and adoption counts by Template/version (FD-TPL-02, FD-TPL-04). Behaviour-preserving extraction first, with existing Wizard guards green. | no | Medium (refactor of a 1,100-line file) → **R1**; **R2** for the Wizard step extraction |
| **P5T-3 Member adoption (mobile-first)** | Entry choice, searchable and filterable library, preview, hydrate draft, host selection, review/establish via existing paths; provenance reference carried to establishment. | no (provenance schema lands in P5T-1) | Medium → **R1**; the provenance contract is defined and R2-reviewed in P5T-1, P5T-3 only consumes it; **R2** for any further change to the establishment contract |
| **P5T-4 Integrated preview** | Both journeys on disposable data for Together, Race and Streak; Founder acceptance. | no | Founder |

### 2.2 Template structure (minimum)

Reusable configuration — stored in the Template version as a serialized Composer draft (`mode: 'TEMPLATE_AUTHORING'`) plus template-only metadata:

| Field | Source / note |
|---|---|
| `title`, `description` | Composer `title`/`description`. `instructions` only if the visible Wizard exposes it (today it does not). |
| `challengeType` | `collective` / `competitive` / `streak` (Together / Race / Streak). |
| `activities[]` | Composer activity: Activity UUID or Code (identity only, never a name), `observedVersion`, `kind`, `metric`, `unit`, `targetValue`, `componentIds`, `loadBasis`, `durationMode`, `completionOccurrence`, `activityVariant`, `position`. Together/Race: one primary; Streak: several (existing `allowsMultipleActivities`). |
| `goalValue` / `goalUnit` | Together/Race, derived from the primary activity as the Wizard does today. |
| `durationDays` (integer ≥ 1), optional `durationPresetDays[]` | **Relative duration.** Replaces `startDate`/`endDate`. Streak `requiredConsecutiveDays` is derived from `durationDays` exactly as `challengeCreationDraft.ts` does today. |
| `coverId` (optional) | Allowlisted `cover_id` only (migration 022). No media upload in Templates; the approved optional media architecture (P6) is unchanged. A media reference may be added later only through P6's asset records. |
| Template metadata (distinct from Challenge) | `templateId`, `slug`, `version`, `lifecycle`, short member-facing `summary`, optional `category`/`focus` tags from the existing Group Interests vocabulary for catalogue filtering only, `sortOrder`, author, timestamps. **Metadata never flows into the Challenge** except provenance (§2.5). Search and filter use title, description, type, included Activities and the governed category/focus tags where present. |

Instance-specific — **never stored in a Template**: hosting Group; `startDate`/`endDate`; `timezone`; `creatorJoins`; membership and participation; results/progress; Social Cause fields; `supportTiiziEnabled` (stays at its Wizard default `false`); idempotency key; activation. `temporalConditions` and `instructions` are excluded until the visible Wizard supports them.

### 2.3 Operator authoring and authority

- Authorized Operator Console users only. Console **read** access is not sufficient. Intended design (table name to be confirmed by the Technical Lead, §5): a new narrow roster `platform_operator_template_authors`, modelled exactly on migration 023 (explicit, revocable, out-of-band grants, grant reference, no self-service). This follows the existing precedent of separating write capabilities from the read-only Console roster; it adds no new governance framework.
- **Operator Library:** desktop-first, searchable and filterable (title, description, type, lifecycle, Activity, tag), with per-Template/version adoption counts (FD-TPL-02, FD-TPL-04). Authors may publish their own Templates; no second approver (FD-TPL-01). There is no publication cap and no required inventory.
- Routes under `/api/operator/templates/*` (write) and `/api/challenge-templates/*` (member read, authenticated, **published versions only**). There is no client-side database path and no direct table editing; Firestore rules are not involved.
- Save-draft accepts incomplete configurations (like the Wizard). **Publish** is the gate: the server normalizes the draft (`normalizeComposerDraft`, unknown fields rejected), runs it through the existing preview/validator with a synthetic anchor window of the Template's `durationDays`, checks every Activity is current and Challenge-eligible, and rejects anything incomplete or invalid with the Composer issue list. Retired/stale Activities block publication.
- **Preview** before publish renders the Template exactly as a member would see it and reuses the Wizard review presentation.

### 2.4 Member adoption

1. At `/v2/challenges/new`: **Start from scratch** (today's flow, unchanged) or **Use a template**.
2. Open the **searchable Template Library** of published, adoptable Templates: search by title and relevant description; filter by Challenge type (Together / Race / Streak); filter or browse by included Activity and governed category where metadata supports it. Preview shows name, description, type, included Activities with targets, metrics and units, relative duration, and applicable settings.
3. **Use this template** copies the published snapshot into a **new `WizardState`** (client-side; no server "adopt" call creates anything) and opens the existing Wizard, landing on *Who is hosting* because the type is already set. Earlier steps stay reachable.
4. Every field remains editable within existing Wizard rules; the member selects an authorized hosting Group (server-validated at establishment, unchanged), reviews, and establishes through the existing PF-04/PF-03 preview and `POST /api/challenges`. **An adopted Template never creates a Challenge, membership or participation.**
5. If the member already has an in-progress draft, adopting asks to *continue* or *replace*; it never silently overwrites. The hydrated draft uses the same route-state/`sessionStorage` carriers, so the Activity Guide round trip and refresh behave as for any draft. Sign-out clearing (P1d) applies unchanged.
6. **Relative duration → dates:** hydration sets `startDate` = member's local today (as `createInitialWizardState` already does), `endDate = deriveEndDate(startDate, durationDays)` (inclusive), `scheduleMode: 'preset'`, `durationDays` from the Template, timezone from the member. The member may change the start date or switch to custom dates under existing rules. Absolute dates are never stored in a Template, so a Template can never be "in the past".
7. **Stale Templates:** a published version whose Activity has since been retired or revised is flagged by the server on read (`adoptable: false` with a reason) and hidden from the member catalogue; the Operator sees it as needing revision. Already-open member drafts keep working until preview, where the existing `STALE_ACTIVITY` handling applies. Nothing is auto-upgraded.

### 2.5 Governance and lifecycle

- States **draft → published → retired** (forward-only for a version; a revision creates a new draft then a new published version; the prior version is superseded, not edited).
- **Published versions are immutable snapshots**; the member catalogue shows the latest published version of each non-retired Template. Retire hides it from the catalogue; it never affects existing Challenges.
- **Existing Challenges are unaffected** by later Template edits or retirement because a Challenge stores its own configuration and shares no row with a Template.
- **Provenance (mandatory, FD-TPL-03):** when a Challenge is established from a Template, the source Template ID and published version are persisted internally on the Challenge, set server-side in the establishing transaction from a verified, published Template reference supplied by the member's establishing call; a forged, unpublished or unknown reference is rejected or ignored, never trusted. Informational only: no behaviour, scoring, recognition, permission, membership, participation or ownership depends on it; it is immutable once written and unaffected by later Template edits or retirement. It records "started from", not "identical to". Ownership stays the establishing member's and the hosting Group's; the Template author is never copied as owner. It is **not shown to members**. This is the only change to the establishment path and is additive (an optional reference in, a stored pair out); it needs R2 review. Challenges established from scratch carry none.
- **Adoption measurement (FD-TPL-04):** an adoption is a Challenge successfully established from a Template. Operator-only read counts by Template and version are derived from `challenges` establishment records and their provenance. Opening, previewing or selecting a Template is not counted, and no member-level tracking or separate analytics store is added.
- Audit: author, publisher, reviser and retirer identities and times are recorded as **separate fields** on the Template and version rows (FD-TPL-01), even when one person holds several roles.

### 2.6 Relationship to other packages

| Package | Relationship |
|---|---|
| **P0** (merged) | Draft preservation and Activity Guide return are prerequisites already satisfied; P5T tests re-assert them for a hydrated draft. |
| **P5** | **P5T follows P5.** Adoption flows through the Wizard that P5 corrects (Name & Appearance label, hosting list on search focus, "reps", Together/Race/Streak end-to-end). Doing P5T first would build on labels and behaviour about to change. |
| **P6** | **P5T precedes P6 and does not depend on it.** Templates use allowlisted `cover_id` only. Both P5T-1 and P6 own migrations and must not run concurrently (B §3 rule). A later optional media reference reuses P6 asset records without changing the Template model. |
| P1c / P2 / P7 | No dependency. P7's Challenge Feed treats an adopted Challenge like any other. |
| P1d | Operator authoring needs no member legal gate; the Operator write roster is out-of-band. |
| FER-001-A | Adds a CPE capability by Founder direction of 28 Oct 2026; A's eleven-capability list is preserved as historical and extended, not rewritten (see B amendment). |

## 3. Boundaries (testable)

Templates must not: become a Challenge until a member establishes one; override engine rules or PF-03; introduce scoring, recognition or points; enroll or auto-join anyone; bypass Group hosting permission (`allowMemberChallenges`, live membership); change canonical Activity definitions; carry payment, donation, Social Cause or Support Tiizi fields; copy Template authorship as Challenge ownership; or add media beyond the approved optional-media architecture. PostgreSQL remains the sole domain authority; Firebase Auth remains identity only; no Firestore or V1 path is read or written.

## 4. Technical decisions resolved by existing authority

| Decision | Resolved by |
|---|---|
| One creation system; Template authored through the same Wizard, never a second form | PF-04 `challengeComposer.ts:17-23`; Master Programme v1.65 |
| Template configuration format | `serializeComposerDraft`/`parseComposerDraft`; `TEMPLATE_AUTHORING` mode |
| Single validator | PF-03 `validateChallengeDefinition`; preview seam |
| Establishment path and hosting authority | `POST /api/challenges`, `challengeCreationAuthority.ts` |
| Template cannot establish identity, policy or truth | EOG-04; Knowledge Standard §551 |
| Store in PostgreSQL; no Firestore/V1 templates | AGENTS.md §1; migration 002 note superseded for V2 |
| Lifecycle vocabulary and forward-only semantics | `knowledge.ts` lifecycle |
| Operator Console desktop-first; member mobile-first | Programme form-factor rule (S5 entry) |
| Write capability separate from read-only Console readers | Migrations 023/024 precedent |
| Relative duration | Existing `durationDays` / `deriveEndDate` / `scheduleMode: 'preset'` |
| Cover | Allowlisted `cover_id` (migration 022); P6 owns uploads |
| No payment or contribution fields | FD-PILOT-01 §16.8; Contribution Reconciliation; `normalizeComposerDraft` rejects them |
| Stale Activity handling | PF-04 "detected, never auto-fixed" |

## 5. Founder decisions (recorded, 28 October 2026)

All questions previously open in this document are settled. **No Founder decision remains open for P5T.** These decisions are binding on P5T; they authorize no implementation.

- **FD-TPL-01 — Operator authoring and publication (APPROVED).** Templates are created and managed in the Tiizi Admin/Operator Console by an explicitly authorized Operator, who may create, save and edit drafts, preview, **publish their own Template**, revise and retire, and keep adding Templates. **No second-Operator approval is required.** Every authoring, publication, revision and retirement action is audited; **author and publisher identities are recorded separately, even when the same person.** General Operator Console read access does not grant Template management permission.
- **FD-TPL-02 — Continuous, searchable and filterable Template Library (APPROVED).** Templates form a continuously managed library, similar in experience to the Activity Library, for both Operators (management) and members (adoption). There is **no fixed catalogue size and no numerical publication cap**. About four Templates per Challenge type (Together, Race, Streak) is an **illustrative content-seeding target only** — not an acceptance threshold, a permanent distribution requirement or a restriction on future publishing. No new Founder approval cycle is needed each time an authorized Operator publishes another Template. **CPE acceptance rests on the functionality of the library and adoption journey, not on an inventory count.**
- **FD-TPL-03 — Internal Template provenance (APPROVED; mandatory).** On establishment from a Template, the source Template ID and published version are persisted internally. Provenance is informational only; immutable for the established Challenge; independent of ownership, scoring, recognition, Group membership and participation; and unaffected by later Template edits or retirement. **It is not displayed to members** ("Started from Template X" is not shown).
- **FD-TPL-04 — Template adoption measurement (APPROVED).** The Operator Console provides internal visibility into adoption. An **adoption is a Challenge successfully established from a Template.** Opening, previewing or selecting a Template is not an adoption. Counts are derived from governed Challenge establishment records and the internal provenance of FD-TPL-03, by Template and version. No separate analytics authority and no additional member tracking.

Technical Lead confirmations (not Founder matters): the migration number; the provenance column names and the shape of the establishing call's verified Template reference (§2.5); the Operator roster table name; the shape of the shared step-component extraction; the adoption-report query shape.

## 6. Programme alignment and change-log handling

- FER-001-B and the Technical Control Board are amended in this PR (additively; see their changes).
- **The Master Programme is deliberately not edited here.** P2 may be changing `main`, and a duplicate or colliding change-log row must not be created. If an entry is later needed, it is prepared only **after rebasing on the then-current `main`**, as the **next free version** (currently v2.83 on the `d5e1ed4` baseline; verify at the time), recording only: P5T required before CPE; its position after P5 and before P6; the two separate journeys; and the founder acceptance evidence below. Until then the Control Board and FER-001-B are the recording surfaces.
- Founder acceptance evidence for P5T (all three Challenge types; **no inventory count is required**): on disposable data, (a) an authorized Operator searches the library, then authors, previews, publishes (own Template, no second approver), revises and retires Templates for each of Together, Race and Streak on desktop; (b) a member searches and filters the library, previews, adopts each type, edits permitted fields, selects an authorized Group, reviews and establishes; (c) each resulting Challenge logs to a correct result under existing engine rules; (d) a later Template revision and a retirement leave all three Challenges and their provenance unchanged; (e) adopting alone created no Challenge, membership or participation; (f) provenance is persisted internally and not shown to members; (g) the Operator adoption report counts exactly the established Challenges and not previews. The Operator authoring journey and the member adoption journey are accepted separately.

## 7. Future test plan (to be written with P5T; none exist yet)

| # | Test | Slice |
|---|---|---|
| 1 | Operator-only authoring: non-operator, Console-reader-only and revoked author all denied on every write route | 1 |
| 2 | Draft/publish/retire authorization matrix, including member read of draft/retired Templates denied | 1 |
| 3 | Invalid-template rejection at publish: unknown fields, missing Activity/metric/unit/target, stale or retired Activity, incompatible metric/unit, zero/negative duration, Streak with no Activity | 1 |
| 4 | Published catalogue visibility: only latest published, adoptable, non-retired; stale Templates hidden | 1, 3 |
| 5 | Version immutability: a published version cannot be updated or deleted at the database and API layers; a revision creates a new version | 1 |
| 6 | Template→Wizard prefill fidelity: every reusable field maps to `WizardState` exactly; instance fields stay at Wizard defaults | 3 |
| 7 | Editable customization: each permitted field editable; type change behaves as in the existing Wizard | 3 |
| 8 | Hosting Group required and authorized: cannot establish without a Group; non-member, restricted-Charter and inactive Group denied by the existing server check | 3 |
| 9 | Relative-duration resolution: start = member-local today; inclusive end; leap/month boundaries; Streak `requiredConsecutiveDays`; custom-date switch | 3 |
| 10 | Existing draft preservation and Activity Guide round trip with a hydrated draft; continue/replace prompt; sign-out cleanup | 3 |
| 11 | Together, Race and Streak: adopt → establish → log → result under unchanged engine tests | 3, 4 |
| 12 | No change to existing Challenges after Template revision or retirement | 1, 3 |
| 13 | No auto-membership, no auto-participation, no scoring bypass: adoption makes no write; establishment path unchanged; Template carries no scoring/recognition/payment keys | 1, 3 |
| 14 | Provenance: persisted on every Template-established Challenge from a verified published reference; forged/unknown reference rejected or ignored; immutable; unaffected by Template revision/retirement; never changes ownership; never rendered to members | 1, 3 |
| 15 | Boundary: `npm run test:boundary`; no Firestore/V1 import; Operator pages desktop layout; member pages mobile-first at 360×640 and 390×844 | 2, 3 |
| 16 | Library search and filter: title/description search, type filter, Activity/category filter; Operator and member libraries; unrestricted growth (publishing beyond any count succeeds; no cap or minimum-inventory check anywhere) | 1, 2, 3 |
| 17 | Author/publisher separation: both identities recorded and distinct fields even when equal; author may publish own Template; Console-reader-only denied; every authoring, publication, revision and retirement action audited | 1 |
| 18 | Adoption measurement: only a successfully established Challenge counts; open/preview/select and failed or abandoned establishment do not; counts per Template and version; Operator-only access | 1, 2 |

Mobile-first (member) and desktop-first (Operator) are separate, separately tested journeys with separate acceptance evidence.

## 8. Review record

Independent review (separate agent session, R1): **PASS WITH FIXES** — no blockers; four citation/wording nits (quote marks on "ONLY creation path", `canManageAccess` source, missing file paths for two governance citations, test-count wording and "unchanged" overclaim) applied in the follow-up commit. All file:line claims in §1/§4 verified; Master Programme untouched; B and Board edits additive. Exact-head review of the Founder-alignment revision: recorded in PR #114. This document records direction and authorizes no implementation; P5T implementation is not started and not authorized.
