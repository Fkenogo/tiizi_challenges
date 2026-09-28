# TIIZI S6 Catalogue Importer — bounded implementation record

**Baseline:** `e45ecc9094bc6aae64fc71467904ea2afd0af834`

**Branch:** `impl/tiizi-s6-catalogue-importer-001`

**Status:** locally implemented and validated; no catalogue records applied outside disposable PGlite tests

**Scope:** S6 content ingestion preparation only. S6 UI, publication, and deployment remain not started.

## Knowledge boundary corrections

PF-01 defines immutable Activity Code identity, versioned Knowledge content,
and lifecycle/readiness/eligibility boundaries. PF-02 stores primary metrics,
secondary metrics, compatible units, components, and load-reporting bases as
the governed product contract. Neither PF-01 nor PF-02 makes a scalar
`metricUnit` or a difficulty rating required canonical Product Truth.

Coded V2 create/revision validation therefore accepts an empty legacy
`difficulty` and scalar `metricUnit`. Supplied optional difficulty and scalar
unit values remain supported; legacy/codeless validation still requires the
existing legacy fields. KCS Universal readiness now accepts a non-empty
governed compatible-unit contract for coded records, while existing PF-02
metric/unit compatibility validation remains mandatory. The change removes
legacy storage requirements from the coded V2 boundary without changing the
Activity Product Truth.

The create seam accepts a validated PF-02 contract so the canonical contract
is written with version 1. It does not create an empty version followed by a
second initial version. Existing contract setters retain their established
versioned write path. No database schema change is required.

## Tiizi-owned KCS class applicability

`api/src/s6KcsApplicability.ts` is the repository-owned mapping. Consultant
`contentClasses` and other system fields are rejected. U is universal. Q is
derived from declared quantitative metrics other than binary completion. T
applies to Fitness records with technique content. P applies to Wellness
records with protocol steps. C applies when completion is a metric or the
content defines completion meaning. M applies to explicit semantic/avoidance
content, serving units, and the governed Wellness/Nutrition & Hydration/Eating
Pattern classification. S applies where a safety caution is present; the
Knowledge model also adds S automatically for Fitness.

Applicability is not satisfaction and does not mark publication readiness.
The existing KCS gate continues to evaluate content on publish and
establishment. The 118-candidate mapping yields U 118, Q 111, T 84, P 34, C
43, M 7, and S 118. The S count reflects 84 automatically safety-sensitive
Fitness records and the 34 Wellness records, each of which has explicit
Activity safety/caution content in this candidate. All 118 identities have
determinable class applicability; incomplete/ambiguous identity fails closed.

## Fasting reconciliation

The prior blanket `Draft / Not Challenge Eligible` language in
`WEL-NUT-009-FASTING.md` is superseded. Fasting records actual elapsed
duration in hours and is not converted to days. Tiizi does not prescribe a
fasting regimen or verify a participant's report. Proportionate informational
caution remains. Standard content readiness, publication lifecycle, and
Challenge eligibility are separate; this correction neither publishes
Fasting nor grants eligibility.

## Importer contract

`api/src/knowledgeCatalogueImport.ts` validates the entire JSON candidate
against the exact 118-code identity manifest before any write. It verifies
84 Fitness / 34 Wellness, identity fields, allowed input keys, PF-02 metric,
unit, pair, component and load-basis vocabularies, and KCS applicability. It
reconciles records by Activity Code only. The machine-readable plan includes
per-code create/update/no-op/conflict actions, exact field-level deltas,
existing UUID/lifecycle, class applicability counts, errors, and notices for
editorial/source notes not persisted as runtime Knowledge content.

### Candidate field mapping

| Candidate field | Existing Knowledge target |
| --- | --- |
| `activityCode`, `name`, `domain` | `activity_code`, `name`, `kind` |
| `category`, `classification` / `family` | `category`, `subcategory` (classification takes precedence where present) |
| Description, measurement guidance, unit semantics, setup, execution, cues, mistakes, technique reference, protocol steps, framing, completion meaning, semantic definition, equipment, environment, safety notes, adaptation, avoidance condition | Existing KCS columns mirrored in `knowledge_items` and `knowledge_item_versions` |
| `primaryMetrics`, `secondaryMetrics`, `compatibleUnits` | PF-02 contract columns and version snapshot |
| `components` | Existing `activity_components` / version component snapshot |
| `loadReportingBases` | PF-02 load-basis columns and version snapshot |
| `candidateId` | Reconciliation-only; equals the canonical Activity Code and is not persisted |
| `editorialNotes`, `sourceNotes` | Retained in candidate/research artifacts; not runtime Knowledge fields. Dry-run reports this explicitly. |
| UUID, difficulty, scalar `metricUnit`, lifecycle, readiness, eligibility, selectability, version/timestamps/provenance | Not imported from the candidate; UUID/lifecycle/versioning are controlled by the Knowledge domain, and readiness/eligibility are derived by existing server logic. |

There are no unsupported runtime Activity content fields in the 118-record
candidate. Editorial/source notes are intentionally outside the runtime model.

`npm run knowledge:import-s6` defaults to dry-run. Only an explicit
`--apply` selects writes. Apply mode first completes full-catalogue
validation/planning, then uses the existing Knowledge create/revision and
PF-02 contract/component/load-basis write functions inside a per-record
transaction. New records receive PostgreSQL-owned UUIDs and begin Draft.
Existing UUID and lifecycle are preserved. Publication, eligibility, and
composer selectability are not written by the importer. A same-content
rerun is a no-op; real existing-record deltas use the established versioned
Knowledge write paths. Per-record transactions allow an interrupted run to
resume safely: committed records reconcile to no-op and remaining codes
continue by Activity Code.

For FIT-STR-001 Push-Up and WEL-MND-003 Breathing Practice, existing coded
records are resolved by code and never recreated. Existing identity,
measurement contract, and lifecycle are protected. Existing non-empty
exemplar content wins when candidate wording differs; candidate content may
fill an empty field and is recorded as a normal Knowledge revision. In
particular, the current Breathing Practice record receives only genuinely
missing authored detail; its existing measurement guidance remains intact.

Weight bases remain optional for FIT-STR-019, FIT-STR-023, FIT-STR-025, and
FIT-STR-036. No basis is inferred. PF-02 continues to reject Weight
configurations unless a governed basis is present. Fasting remains
duration/hours; Fruit and Vegetable Intake remain participant-reported
quantity/servings without universal serving equivalences.

The importer writes only to the configured PostgreSQL Knowledge authority;
it does not use Firestore or the legacy Firestore importer. This task did not
run CLI dry-run or apply against any configured database. Automated apply
coverage uses disposable PGlite databases only.
