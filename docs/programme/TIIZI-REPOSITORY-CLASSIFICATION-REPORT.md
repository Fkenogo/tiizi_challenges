# Tiizi Repository Classification Report

**Purpose:** Clarify which repository material is current authority, current programme evidence, V2 carry-forward input, V1/legacy evidence, engineering working material, or a candidate for later archiving.

**Authority boundary:** This report does not move, delete, supersede, approve or adopt any file. It is an information-architecture classification to support a later controlled cleanup decision.

**Assessment baseline:** GitHub `main`, current V2 programme at Master Programme v1.27 / CGP-02D In Progress.

---

## 1. Executive Finding

The repository is not conceptually broken, but it is **visually and navigationally overloaded**.

The main source of confusion is that several generations of Tiizi work coexist at the same apparent level:

- V1 / pre-beta product and implementation documents;
- older clean-build and technical specification material;
- wellness and exercise catalogue material;
- current V2 constitutional authority;
- current programme-management records;
- detailed historical programme evidence;
- current engineering source code.

A file's location near the repository root does not currently indicate its authority.

The recommended treatment is therefore **classification first, archive/move later**.

---

## 2. Classification Vocabulary

| Class | Meaning |
| :--- | :--- |
| **A — Current Authority** | Governing record whose approved/current status controls V2 meaning, authority or programme state. |
| **B — Current Programme Evidence** | Controlled evidence supporting the current programme without independently overriding authority. |
| **C — V2 Input / Carry-Forward** | Useful product, content, knowledge or implementation evidence to reconcile into later V2 stages. |
| **D — V1 / Legacy Evidence** | Historical material retained to understand prior product/implementation decisions. |
| **E — Engineering Working Material** | Source, scripts, tests, operational documentation and current implementation working material. |
| **F — Candidate for Archive** | Material that should probably be moved out of the primary navigation surface after a safe dependency/link audit. |
| **G — Unclear / Founder Direction** | Material whose future treatment should be decided only after deeper dependency or intent review. |

---

## 3. Current Authority — Class A

### `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md`

**Classification:** A — Current Authority

**Role:** Single authoritative source of Tiizi V2 programme state, stage sequence, dependencies, status and current next action.

**Treatment:** Keep prominent. Never archive while V2 programme is active.

### `docs/governance/platform/`

**Classification:** A — Current Authority / constitutional foundation family, subject to each document's recorded status and the Constitutional Foundation Index.

**Role:** Platform Constitution, Principles, Authority Model, constitutional index and related approved foundation instruments.

**Treatment:** Keep as primary constitutional authority.

### `docs/governance/principles/02-CGP-01-CONSTITUTIONAL-GOVERNANCE-PRINCIPLES.md`

**Classification:** A — Current Authority

**Role:** Approved constitutional governance philosophy.

### Current CGP-02 whole-standard corpus and attributable Founder records

**Classification:** A or B depending on each document's recorded status.

**Important:** Drafts, candidates, validation reports, decision records and adopted/approved instruments must not be flattened into one authority level. Their own controlled status remains decisive.

---

## 4. Current Programme Evidence — Class B

### `docs/programme/`

This folder currently contains a large body of planning packages, authorization packages/records, validation reports, completion reports, transition reports and review evidence.

**Classification:** Mostly B — Current Programme Evidence, with the Master Programme as A.

**Treatment:** Preserve. Improve navigation rather than deleting history.

Recommended later internal grouping, if link-safe:

```text
docs/programme/
  current/
  evidence/
  history/
```

This report does **not** authorize that move.

### `docs/reports/`

**Classification:** Primarily B and D depending on subject/date.

**Treatment:** Keep as evidence but later distinguish active governance evidence from historical engineering reports.

---

## 5. V2 Input / Carry-Forward — Class C

These are particularly important because they contain product/knowledge work that should not be lost when Stage EK begins.

### `catalogExercises_CLEAN.json`

**Classification:** C — V2 Input / Carry-Forward

**Reason:** Large exercise catalogue / content corpus. Useful candidate input to future Knowledge Asset reconciliation.

**Risk:** Do not treat existing schema, IDs or field semantics as automatically authoritative V2 design.

### `docs/input/ISOMETRIC-EXERCISES-CONTENT-DETAIL.md`

**Classification:** C

**Reason:** Detailed exercise content input.

### `docs/architecture/wellness-activity-framework.md`

**Classification:** C with some D characteristics.

**Strong reusable concept:** activity identity is separate from target.

**Reason:** Contains mature wellness-activity catalogue thinking, stable identity rules, metrics and challenge-specific target separation.

**Risk:** It was written as implementation-phase architecture and references V1 schemas/Firestore assumptions. Final V2 treatment belongs in Stage EK/F.

### `docs/architecture/challenge-architecture.md`
### `docs/architecture/challenge-data-model.md`
### `docs/architecture/challenge-engine-spec.md`

**Classification:** C / D

**Reason:** Strong evidence of prior challenge concepts, engine behaviour, data model and implementation assumptions.

**Treatment:** Use during EK/F/G reconciliation; do not treat as current constitutional/product authority.

### Wellness template/catalogue content

Examples:

- `WELLNESS_CHALLENGES_OVERVIEW.md`
- `WELLNESS_CHALLENGE_SYSTEM_SPEC.md`
- `WELLNESS_QUICK_START.md`
- wellness template JSON/data where present

**Classification:** C + D

**Reason:** Contains useful catalogue categories, template concepts, activity/target examples, safety considerations and historical product intent.

**Risk:** Several documents describe themselves as implementation-ready / production-ready. That status is historical and must not be interpreted as current V2 authority.

---

## 6. V1 / Legacy Evidence — Class D

### Root-level pre-beta documents

- `PRE-BETA-AUDIT.md`
- `PRE-BETA-CLEANUP-PLAN.md`
- `TODO.md`
- `CHANGE.md`

**Classification:** D, with `CHANGE.md` also serving historical engineering trace.

**Reason:** These describe prior product/engineering state and should not drive current V2 roadmap decisions.

**Recommended eventual treatment:** Move to a clearly labelled legacy/history area after link/dependency review.

### Older clean-build / screen / audit documents under `docs/`

Examples:

- `docs/CLEAN_BUILD_SPEC.md`
- `docs/TIIZI_TECHNICAL_SPECIFICATION_CLEAN_BUILD.md`
- `docs/AUDIT_REPORT_2026-02-27.md`
- `docs/AUDIT_REPORT_2026-04-05.md`
- `docs/REQUIRED_SCREENS.md`
- `docs/SCREEN_ALIGNMENT_AUDIT_2026-02-28.md`
- `docs/HOME_DATA_INCIDENT_REPORT_2026-02-28.md`

**Classification:** Primarily D.

**Reason:** Important for understanding V1 and prior clean-build efforts, but not current V2 programme authority.

---

## 7. Engineering Working Material — Class E

### `src/`, scripts, tests, Firebase configuration and runtime assets

**Classification:** E — Engineering Working Material / current implementation evidence.

**Role now:** Existing implementation to be preserved and later assessed in Stage G.

**Important:** Current code is not automatically V2 product truth.

### `.claude/`, `.codex/`

**Classification:** E

**Role:** Agent/development environment support.

### `NEXT-CODING-AGENT-PROMPTS.md`
### `WELLNESS_CODING_AGENT_PROMPTS.md`

**Classification:** E + F

**Reason:** Historical execution aids, not product or programme authority.

**Recommended later treatment:** archive once confirmed no active workflow depends on them.

---

## 8. Candidate for Archive — Class F

The strongest archive candidates are files that are both historical and highly visible at the repository root, because they create false authority by proximity.

Priority archive candidates after link/dependency audit:

1. `PRE-BETA-AUDIT.md`
2. `PRE-BETA-CLEANUP-PLAN.md`
3. `NEXT-CODING-AGENT-PROMPTS.md`
4. `WELLNESS_CODING_AGENT_PROMPTS.md`
5. `WELLNESS_QUICK_START.md`
6. `README_WELLNESS_DOCS.md`
7. older `docs/*AUDIT*` / clean-build files
8. older screen-alignment/build prompt material

Possible archive target later:

```text
docs/archive/v1/
docs/archive/pre-v2/
docs/archive/engineering-history/
```

The exact structure should be chosen only after checking relative links, tooling references and scripts.

---

## 9. Material That Should NOT Be Archived Yet

Do not archive merely because a document predates the current governance programme.

Keep readily accessible until Stage EK/F/G reconciliation is complete:

- exercise catalogue/data;
- wellness activity framework;
- challenge architecture/data-model/engine documents;
- useful template/catalogue specifications;
- entity ownership evidence;
- historical decisions that establish provenance;
- any V1 specification needed to explain current implementation behaviour.

These are the evidence base for deciding what V2 carries forward.

---

## 10. Why the Repository Feels Confusing

The principal information-architecture problems are:

### 10.1 Root-level authority ambiguity

Legacy wellness and pre-beta files sit beside README and current project files, visually suggesting equal relevance.

### 10.2 `docs/` generation mixing

Old clean-build/audit material sits beside newer architecture and governance folders.

### 10.3 Programme evidence volume

The governance programme correctly preserves detailed planning, validation and decision evidence, but the human navigation layer does not sufficiently separate the current decision surface from historical execution evidence.

### 10.4 Knowledge work is not labelled as a carry-forward corpus

Exercise/wellness/challenge materials remain scattered, making it difficult to see that they are inputs to future Stage EK rather than abandoned work.

---

## 11. Recommended Future Repository Shape

This is a target information architecture, not an authorized move plan:

```text
README.md

docs/
  programme/
    TIIZI-V2-PROGRAMME-GUIDE.md
    TIIZI-V2-MASTER-PROGRAMME.md
    current/
    evidence/
    history/

  governance/
    platform/
    principles/
    ownership/
    domains/

  knowledge-input/
    exercises/
    wellness/
    challenge-composition/

  architecture/
    [current/future approved architecture after Stage F]

  archive/
    v1/
    pre-v2/
    engineering-history/

src/
...
```

A future cleanup should avoid moving `docs/governance/` merely for aesthetics because large numbers of controlled links and records depend on its established structure.

---

## 12. Cleanup Strategy

Recommended sequence:

### Cleanup 1 — Navigation only

- Add a Start Here programme guide to README.
- Label legacy files conceptually without moving them.

### Cleanup 2 — Link/dependency audit

- Search all repository references to candidate archive files.
- Identify scripts/tooling that depend on paths.

### Cleanup 3 — Controlled archive move

- Move only clearly historical files.
- Update relative links in one bounded change.
- Preserve Git history.

### Cleanup 4 — Stage EK input pack

When Stage EK begins, explicitly assemble a controlled **Prior Knowledge Work Reconciliation Input Pack** rather than moving all old material into current authority folders.

---

## 13. Current Decision Recommendation

No broad repository move should occur before the current whole-standard Founder review (D-02) unless a specific file is actively causing an operational problem.

The immediate clarity need is solved by:

1. a human-readable Programme Guide;
2. README navigation;
3. this classification report.

After D-02/CGP-02 is stabilized, a bounded archive/link cleanup can be considered without mixing it with constitutional decision work.

---

## 14. Non-Effects

This report:

- moves no file;
- deletes no file;
- changes no programme status;
- changes no constitutional authority;
- begins no Stage EK work;
- classifies no V1 schema as approved V2 architecture;
- changes no application code.
