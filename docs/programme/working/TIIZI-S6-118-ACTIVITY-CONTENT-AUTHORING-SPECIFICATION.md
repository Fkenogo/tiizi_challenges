# TIIZI S6 — 118 Activity Content Authoring Specification

**Work item:** TIIZI-S6-CONTENT-POPULATION-PREPARATION-001
**Status:** Preparation artifact; S6 experience assembly NOT STARTED
**Assessment baseline:** `4b252e2e0026c4e7798201a30c65cac0b3beadf9` (offline detached checkout; exact commit previously verified as canonical main)
**Master Programme:** v2.13
**Purpose:** Provide external content consultants one bounded authoring contract for all governed Activity candidates and define a repeatable validation and later import path. This document does not authorize publication or population.

## 1. Authority and scope

The canonical candidate list is the Stage EK Founder Working Baseline, which contains 118 candidates: 84 Fitness and 34 Wellness. The machine-readable transcription is [`activity-master-inventory.json`](s6-content/activity-master-inventory.json); the consultant-safe identity-only projection is [`activity-consultant-input.json`](s6-content/activity-consultant-input.json).

**Identity allocation:** PF-01's approved `AAA-AAA-000` format and governed-baseline-family rule, together with the baseline's unique `ID` for all 118 candidates, support preserving each exact baseline ID as the immutable Activity Code. This is direct identity carry-forward, not generation from names or a new abbreviation/numbering convention. The two previously allocated codes remain unchanged. All 118 codes are now allocated in the canonical manifest; this does not allocate database UUIDs, create PostgreSQL rows, or imply publication. `activityCode` is the primary consultant handoff identity.

PF-01 specifies `AAA-AAA-000` (three uppercase letters, hyphen, three uppercase letters, hyphen, three digits), language independence, global uniqueness, and immutability after allocation. Its implementation notes that new codes come from the governed baseline families and explicitly uses the canonical ID field for its two initial exemplars; the 118 baseline supplies that ID for every candidate. The first segment tracks the original Fitness/Wellness domain mnemonic; the middle segment is the baseline family mnemonic (for example STR, CAR, MND), but PF-01 says it is a stable mnemonic, not a live category pointer. The final three digits are the existing per-family baseline serial. Reclassification or renaming never rewrites the code. Database uniqueness conflicts reject; codes are never silently renumbered to resolve a collision. The accepted inventory has 118 unique codes and preserves all 118 baseline IDs verbatim. The allocation evidence is the accepted Stage EK 118-Activity baseline; PF-01 source in `api/migrations/013_pf01_activity_product_contract.sql` and `api/src/knowledge.ts`; PF-01 identity proofs in `api/test/pf01ActivityProductContract.test.ts`; and the v2.13 Master Programme PF-01 closure. The baseline ID is preserved exactly rather than deriving any code segment from a name. Activity meaning and content are governed by the Activity Content & Catalogue Definition (ACCD), Stage EK governance and its working baselines, and Stage F KCS/CIC/requirements. The canonical V2 Knowledge model and administration routes enforce lifecycle, version, publication readiness and Challenge eligibility. PostgreSQL is the current V2 Knowledge authority. This authoring format is a transfer/validation format only; it is not a second catalogue authority or runtime store.

V1 catalogue material is historical evidence only. Consultants must not use it to override the supplied V2 inventory, measurement baseline, ACCD or reviewed exemplar patterns.

## 2. Package supplied to a consultant

Supply only the documents/data listed at the end under **EXTERNAL CONTENT CONSULTANT BRIEF INPUTS**. The consultant returns one JSON batch using [`activity-content-template.json`](s6-content/activity-content-template.json). The identity manifest is supplied read-only. One record is included as a complete worked example for the already-governed Push-Up exemplar; it is not a content-quality target for every type of Activity.

The batch may contain fewer than 118 records during staged authoring. A complete package intended for population must reconcile to all expected Activity Codes, or explicitly identify the subset and its scope. Missing records are reported; they are never synthesized by the validator.

## 3. Authoring boundary

### 3.1 Identity and classification — consultants must not redefine

The following are supplied by Tiizi in `activity-consultant-input.json` and must be echoed unchanged:

- `activityCode` (primary handoff identity), `candidateId` (baseline cross-reference), canonical `name`, `domain`, governed `category`, `classification`, and `family` where present;
- `knowledge_id` UUID is intentionally not supplied to consultants and is allocated only by the database when a canonical Knowledge record is created;
- any name, category, classification or identity change. A consultant may raise a change request in `editorialNotes`, but may not silently substitute a value.

Tiizi has allocated all 118 Activity Codes in the canonical manifest by preserving each governed baseline `ID` exactly. Existing codes are unchanged. Codes are immutable and language-independent; later name or category changes do not change them. This is inventory identity allocation only, not a database write. Consultants must echo all supplied identity/classification values unchanged. Validation matches by Activity Code first and compares the other fields against the manifest. Any changed or unknown identity value fails closed.

### 3.2 Consultant-authored content

Use the API/KCS field names below wherever applicable. Write concise participant-facing English that describes the canonical Activity itself, not a particular Challenge target or schedule.

| Authoring field | Meaning / handling |
|---|---|
| `description` | Clear authoritative description and purpose; explain what the participant does. Required for all. |
| `measurementGuidance` | What the participant reports/counts and how to report it. Required for all. |
| `unitSemantics` | What one unit/occurrence means for this Activity. Required when KCS class Q applies. |
| `setup`, `execution` | Preparation and method. Required when KCS class T applies. |
| `formCues`, `commonMistakes`, `techniqueReference` | At least one useful cue/error list/reference is required when T applies. Keep `techniqueReference` an authored/approved reference description, not an invented URL. |
| `protocolSteps`, `sessionFraming` | Ordered procedure and practice context when a governed Wellness protocol/practice needs them. `protocolSteps` is required when KCS class P applies. |
| `completionMeaning` | What counts as completion when KCS class C applies. |
| `semanticDefinition` | Distinguishing definition where KCS class M applies. |
| `equipment`, `environment` | State applicable requirements honestly. Omit where no useful claim is applicable; an explicit reviewed value such as `None required` is acceptable. Do not infer equipment from an exercise name. |
| `adaptation` | Safe practical adaptation/difficulty pointer when T applies. Do not provide clinical rehabilitation advice. |
| `safetyNotes` | Proportionate supported cautions. Do not invent diagnosis, treatment, clinical thresholds or claims. Fitness receives KCS S automatically; therefore its publication readiness requires safety notes. |
| `avoidanceCondition` | Only where the governed avoidance Activity genuinely needs a clear non-performance/reporting condition. |
| `editorialNotes`, `sourceNotes` | Review notes and research provenance for editors; not participant-facing content and not publication evidence by themselves. |

Do not add Challenge targets, sets, schedules, frequency, scoring, reward, ranking, or verification claims to canonical Activity content. Those are controlled by downstream Challenge and verification authorities.

### 3.3 Measurement contract — proposals require Tiizi review

A record carries `measurementContract` with `primaryMetrics`, `secondaryMetrics`, `compatibleUnits`, optional `loadReportingBases`, and optional `components`. This gives the validator enough structure to check a proposal against the baseline and runtime vocabularies; it does not delegate contract authority to a consultant.

- Copy the Activity's existing metric/unit compatibility from the supplied 118 baseline unless a documented editorial change is proposed. Any changed or newly proposed compatibility needs Tiizi Product/Governance review before population.
- Allowed core Metrics are exactly `completion`, `repetitions`, `duration`, `distance`, `weight`, `quantity`.
- Allowed Units are exactly `completion`, `reps`, `repetitions`, `seconds`, `minutes`, `hours`, `metres`, `kilometres`, `grams`, `kilograms`, `steps`, `millilitres`, `litres`, `servings`, `pages`, `acts`, `flights`. `reps` and `repetitions` are accepted spellings of the Repetitions unit. Every unit must belong to its canonical metric, and each selected Activity metric/unit tuple must match that Activity's governed compatibility.
- Do not introduce a metric or unit identifier. A genuine need beyond these lists is a Product/Governance change request, not a content-side extension.
- An Activity may have zero secondary metrics. Do not invent a secondary metric. `metricUnit` in the V2 record is an existing API compatibility/display field and must resolve to a compatible primary unit; the importer selects it under the reviewed mapping.
- Components are only needed where the Activity is composed of named required sub-activities. PF-02 currently supports `ALL_REQUIRED`; a component is not an independent Activity and does not receive its own Activity Code. Do not create optional/alternative components or a component solely to encode sets, sides, equipment, or target structure.
- `loadReportingBases` is optional and only applies where Weight is supported. Allowed values: `TOTAL_LOADED_IMPLEMENT`, `PER_IMPLEMENT`, `SINGLE_IMPLEMENT`, `PER_SIDE`, `MACHINE_DISPLAYED_LOAD`. The PF-02-CORR-001 rules and applicable metric contract govern which basis applies. Proposals require validation/review.

The schema validates identifier vocabulary and basic structure. It cannot by itself prove that an Activity meaning is safe, complete, or compatible; the Tiizi validator cross-checks the activity-specific baseline relation and existing domain rules, then routes all proposals/changes for review.

## 4. Completeness and review requirements

“Required” below means required for the record to be considered structurally complete and/or pass the existing KCS gate. A field's presence never means it is automatically approved for publication.

| Class | Requirements |
|---|---|
| Required for all | Known `candidateId`; one non-empty `description`; one non-empty `measurementGuidance`; reviewed governed identity/category; a valid reviewed primary metric and at least one compatible unit; a truthful measurement-unit explanation where Q applies. |
| Required when applicable | `unitSemantics` for Q; `setup` and `execution`, at least one of `formCues`/`commonMistakes`/`techniqueReference`, and `adaptation` for T; non-empty ordered `protocolSteps` for P; `completionMeaning` for C; `semanticDefinition` for M; non-empty `safetyNotes` for S. Fitness automatically receives S under current server rules. Applicable equipment/environment content is supplied where it is genuinely needed, not filled with fabricated data. |
| Optional | Secondary metrics; additional cues/mistakes; equipment/environment where not applicable; session framing; editorial/source notes; components and load bases only when governed and applicable. Empty secondary metrics/components/load bases are legitimate. |
| System-derived / consultant must not supply | UUID, Activity Code allocation (including for unallocated candidates), lifecycle/publication status, publication readiness/issues, Challenge eligibility/issues, composer selectability, version number, creation/update/publish timestamps, database provenance/authority fields, locale version snapshots, and any server-calculated readiness outcome. |

The server's KCS `assessPublicationReadiness` result is the publication gate. Readiness is content/version-specific and is not a consultant declaration. Publication remains a separate Tiizi action. Challenge eligibility is further derived from publication, readiness and valid Activity/Metric/Unit contract. Composer selectability is further constrained by the existing V2 catalogue seam. No batch may set these booleans or bypass the API gates.

## 5. Validation report

A future validator should emit a JSON and human-readable summary with these counts/lists:

1. `expectedActivities`, `receivedActivities`, `missingActivities`, `unexpectedActivities` keyed by Activity Code;
2. `duplicateActivities`, `identityMismatches`, including changed code and candidate/name/domain/category/classification/family disagreement;
3. `invalidCategories`, `invalidActivityCodes` (if any code appears in a consultant package), `invalidMetrics`, `invalidUnits`, `invalidMetricUnitPairs`, `baselineContractChanges`, `invalidLoadReportingBases`, `invalidComponents`;
4. `requiredContentMissing`, `conditionalContentMissing`, with candidate ID, field, rule/class and exact reason;
5. `warnings`, `reviewRequired`, and provenance/source notes;
6. aggregate `readyForIngestion` and `requiresReview` counts plus per-candidate disposition.

Mechanical package completeness must be demonstrable before import: **118 expected, 118 received, 0 missing, 0 duplicate**. That condition alone does not imply content completeness, publication readiness, Challenge eligibility, or Founder acceptance. Invalid input fails closed; no record is silently skipped, auto-corrected, published or fabricated.

Suggested per-record validator states are `STRUCTURE_INVALID`, `IDENTITY_REVIEW`, `CONTENT_INCOMPLETE`, `CONTRACT_REVIEW`, `READY_FOR_EDITORIAL_REVIEW`, `READY_FOR_INGESTION`. None maps directly to Published.

## 6. Population and ingestion design

### 6.1 Recommended mechanism

After the consultant specification and initial return have been reviewed, implement one bounded, repeatable repository CLI/import utility for reviewed batches. It should:

1. validate JSON Schema and reject unknown fields;
2. reconcile every record to the checked-in 118 Activity Code manifest (no frontend catalogue, no duplicate authoring store);
3. validate domain/category, candidate IDs, existing immutable codes, metrics/units, per-Activity contract, component relationships and load bases against the governed baselines and current Tiizi vocabularies;
4. run KCS/readiness and Challenge eligibility calculations using existing canonical domain logic and produce a complete dry-run report;
5. stop before writes when there are duplicates, unknowns, identity/code conflicts, invalid contracts, malformed records or unreviewed amendments;
6. require explicit approved/apply mode after editorial/governance review; create or revise **draft** PostgreSQL Knowledge items transactionally, preserve assigned UUID and immutable Activity Code, and preserve append-only version history. Re-runs resolve each manifest Activity Code against the existing Knowledge row and compare its candidate association; a code conflict or association mismatch fails closed. The manifests are controlled authoring/reconciliation inputs, not runtime stores;
7. leave publication as an explicit separate action through existing publication policy; never set eligibility/selectability directly.

Keep consultant JSON as an input artifact to the importer, not as a live runtime read source. The canonical result remains in PostgreSQL Knowledge and its existing version/component/compatibility records.

### 6.2 Existing APIs and migration position

The authenticated Knowledge admin API provides list, create, revise, publish, retire, compatibility and locale-text operations; create/revise invoke KCS validation and versions; PF-02 has governed component/load-basis seams. These are sufficient for individually administered records. They do not expose a single atomic, idempotent 118-record batch/import operation with candidate-ID reconciliation, complete fail-closed report, review checkpoint and cross-record transaction. A small repository CLI invoking existing domain services in a transaction is cleaner than adding an import API or one migration per Activity. The existing `knowledgeImport.ts` is a legacy Firestore-to-PostgreSQL compatibility importer and is **not** the content-authoring import path; do not extend it into Firebase authority for S6.

Migrations 013–017 already provide PF-01 identity/version/locale snapshot foundations, exemplar records, PF-02 components, load reporting bases and versioned measurement contracts, and PF-03 Challenge Definition pins. No schema change is justified by this preparation. A future authoring import should use the established APIs/domain functions and migrations; only a discovered contract gap proven by the reviewed 118 records could justify a later schema decision.

## 7. S6 implementation position

Current repository-defined/provisioned V2 authored exemplars: **2** (Push-Up and Breathing Practice). The canonical identity manifest now covers 118 candidates with 118 codes. This is not 118 PostgreSQL rows or published records. No content was authored and no records were populated here. S6 Library/Guide UI remains NOT STARTED. No Activity is marked published, publication-ready, eligible or selectable by this specification.

No global Product Truth issue currently prevents preparing content against the governed metric/unit vocabulary, category baseline, KCS and PF contracts. PF-01 allocation is completed in the governed inventory manifest; no persistence is implied. Individual candidate concepts or proposed contract deviations may require bounded editorial/Product review before ingestion. In particular, consultant deliverables cannot decide that a baseline candidate should be renamed, split, merged, recategorized, assigned a new metric/unit, or newly coded.

## 8. EXTERNAL CONTENT CONSULTANT BRIEF INPUTS

Provide exactly these three bounded files, not repository-wide access:

1. `docs/programme/working/s6-content/activity-consultant-input.json` — 118 Tiizi-supplied identity/classification records; `activityCode` is primary identity. No UUID or internal database fields are exposed.
2. `docs/programme/working/s6-content/activity-content-template.json` — strict return schema, exact field boundaries, governed metric/unit vocabulary and one complete Push-Up example.
3. `docs/programme/working/TIIZI-S6-118-ACTIVITY-CONTENT-AUTHORING-SPECIFICATION.md` — extracted content rules, completeness conditions, safety boundary, validator expectations and examples.

These are the minimum external package. They include the governed identity/classification and authoring requirements needed for the assignment, so consultants need not inspect the repository. Prior authored definitions and source standards remain Tiizi editorial references. CLU-01 does not restrict this 118-Activity assignment. Do not give consultants production credentials, database access, V1 authority, publication privileges, or permission to change identity/taxonomy/metric/unit vocabularies. A research prompt is a separate later deliverable and is not included here.
