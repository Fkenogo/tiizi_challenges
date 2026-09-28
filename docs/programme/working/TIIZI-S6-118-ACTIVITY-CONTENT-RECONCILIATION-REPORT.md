# TIIZI S6 — 118 Activity Content Reconciliation Report

## Outcome

The three accepted consultant JSON batches have been reconciled field by field against the canonical Tiizi identity manifest, the governed 118-Activity measurement baseline, Knowledge Content Standards, PF-01/PF-02 contracts, and existing Push-Up and Breathing Practice exemplars. The result is a complete **draft content candidate** for all 118 Activities. It is not populated, published, or marked ready for ingestion.

- Assessment baseline: `4b252e2e0026c4e7798201a30c65cac0b3beadf9` (Founder-accepted S4d closure)
- Identity/preparation source: `63fad90bfd5f73359aaa5e338018ca2b11a61fbe`
- GitHub access: canonical remote was verified from the repository configuration, but fetch could not resolve `github.com` during this task. The already verified local objects above were used; revalidate live `main` before population or publication.
- Branch: `impl/tiizi-s6-activity-catalogue-reconciliation-001`
- Candidate: `docs/programme/working/s6-content/tiizi-118-activity-reconciled-content.json`

## Consultant inputs

The three files below are the accepted authored JSON inputs. SHA-256 values are recorded in the provenance and validation JSON artifacts. Paths below identify the Founder supplied files; Consultant 1 did not have an accompanying report in the supplied folder.

| Input | Supplied file | SHA-256 | Report |
|---|---|---|---|
| Consultant 1 | `consultant-01/deepseek_json_20260928_9de7c6.json` | `3434a4830bf9b418631b14e317912d2ab0ca57457ff12b598994899e8e9e10f3` | No report file was present |
| Consultant 2 | `consultant-02/gemini-code-1790580524438.json` | `25948766fae6ebc7efffc21e8e7788c3d6f5ca4d57791784cd3155672f4fdc4e` | `gemini-code-1790580459902.md`, SHA-256 `cca94c62a619dc51277c48d8530fb85acb92ad0c0669c3bc5e74774f5f431bd8` |
| Consultant 3 | `consultant-03/tiizi-118-activity-authored-content.json` | `fa723030bd35a65390b79319a88c1c9a485384733b8da473cf53fe163b45f3ea` | `TIIZI-118-ACTIVITY-CONTENT-AUTHORING-REPORT.md`, SHA-256 `e2c8fd8c73d572663c3ec14dd7577a103e41437bf3454f2e5a2d17297135cd9d` |

Consultant 1 contributed 300 field selections, Consultant 2 contributed 494, and Consultant 3 contributed 1,000 across 1,388 populated field selections. Counts describe provenance selections, not quality scores. No consultant was selected wholesale. All three were compared for each identity and field; complementary material was combined where appropriate. Consultant reports were treated as contextual research, never as Product Truth.

## Reconciliation method and authority

For each canonical Activity Code, the build starts from `activity-master-inventory.json`; name, domain, category, classification, family, and code are copied from that identity authority. Any consultant mismatch fails the build. The three content records are then reconciled field by field. Concise and actionable text is preferred; useful arrays are deduplicated; protocol sequences are selected intact from a source rather than spliced into a potentially incoherent procedure. Field-level consultant and Tiizi-source provenance is held separately in `tiizi-118-activity-reconciliation-provenance.json`.

The canonical Activity measurement sets are read from the accepted 118-Activity governed baseline. Consultant metrics and units are proposals only and cannot add or remove a governed Activity measurement. Compatible metrics and units are copied from that baseline, with `reps` used as the canonical display spelling where both `reps` and the accepted alias `repetitions` appear. Components and load bases are retained only when supported by governed evidence. The script is deterministic and fails closed for missing consultant records, identity drift, invalid schema, ungoverned measurement tuples, or validation errors.

The field model follows the existing Knowledge/KCS and PF-01/PF-02 structures: descriptive and instructional content, measurement guidance and unit semantics, technique/practice modules, safety notes, protocol steps, session framing, completion meaning, avoidance conditions, components, and load reporting bases. No new Activity identity, taxonomy, measurement, or runtime authority is created.

## Systematic corrections

- **Activity truth / Challenge truth:** actual performance remains the Activity result. Challenge target comparison, streak completion, ranking, frequency, and schedule rules are not encoded as Activity metrics or thresholds. The validator confirms no streak/target-derived completion leak.
- **Completion:** retained only where the canonical Activity measurement contract allows it. It was not added merely because Streak Challenges may use completion targets.
- **Reading:** canonical `quantity` + `pages` is retained; no `reading` metric is invented.
- **Stair Climbing:** canonical `quantity` + `flights` is retained where specified by the baseline.
- **Sports:** no `score` metric is added. The baseline-governed actual measures remain authoritative.
- **Load-based Activities:** PF-02 governs load-basis interpretation. No basis is inferred for four unresolved candidates; their Weight configurations remain unavailable pending Tiizi resolution while other governed measures remain in the candidate.
- **Fasting (`WEL-NUT-009`):** its contract is `duration` + `hours`. The content records actual elapsed fasting hours, never converts hours to days, and avoids prescribing frequency, intake rules, or a protocol. Proportionate general safety language is retained. Existing Product Truth keeps Fasting Draft and not Challenge Eligible pending review.
- **Safety and wellness language:** unsupported disease, treatment, diagnostic, guarantee, and clinical-outcome claims were removed or neutralized. Practical cautions and boundaries were retained where useful. No numeric clinical thresholds were introduced. A few medical-care disclaimers remain as disclaimers (not treatment guidance).
- **Activity-specific normalization:** consultant-set times, targets, and schedules were removed where they would turn Activity content into a Challenge threshold or unsupported universal rule. Behavioral content intrinsic to the Activity, such as meal planning, remains represented as the practice itself.
- **Existing exemplars:** Push-Up content is reconciled to the Tiizi PF-01 exemplar. Breathing Practice keeps its exemplar protocol while its measurement guidance is phrased at Activity level; Challenge configuration decides which supported measure applies.

## Validation

Run from the repository root:

```sh
python3 scripts/reconcileS6ActivityCatalogue.py \
  /path/to/consultant-01.json \
  /path/to/consultant-02.json \
  /path/to/consultant-03.json
```

The utility writes the draft candidate, field-level provenance, and machine-readable validation report. It performs no database or publication operation. Its report currently records:

- 118 expected and received; 84 Fitness; 34 Wellness; 118 unique Activity Codes.
- No missing, unexpected, duplicate, or identity-drifted records.
- No malformed records, schema errors, invalid metrics, invalid units, invalid metric/unit relationships, missing required content, or missing conditional content.
- Fasting contract check passes (`duration` + `hours`; no conversion to days).
- No consultant supplied runtime/system fields and no Challenge-derived Streak completion leak.
- Result after the bounded review-resolution pass: `PASS_WITH_REVIEW`; `readyForIngestion: false`; draft-only; 0 database writes and 0 publication effects.

Six genuine Tiizi review items remain. The earlier Fasting review item has been resolved for content-candidate purposes under the Founder disposition; its lifecycle/eligibility restriction remains separately in force.

1. `FIT-STR-019`, `FIT-STR-023`, `FIT-STR-025`, `FIT-STR-036` — PF-02 provides the authorized basis vocabulary but the repository does not define the exact load configuration for these Activities. Keep Weight configurations fail-closed; do not infer a basis.
2. `WEL-NUT-002`, `WEL-NUT-003` — the baseline and CLU-01 require authoritative serving semantics but do not define them. Current serving examples remain review-only draft guidance.

These are recorded as review boundaries, not missing candidate records. Validation now reports structural/authored-content completeness separately from unresolved measurement semantics, server-computed publication readiness, and Challenge eligibility. Fasting's lifecycle state is recorded as Draft and Not Challenge Eligible without treating that restriction as a content-ingestion failure. The complete machine report, including each decision, exact unresolved issue, and input hash, is `tiizi-118-activity-reconciliation-validation.json`.

## Bounded review-item resolution

| Activity | Decision | Evidence and disposition |
|---|---|---|
| `WEL-NUT-009` Fasting | Resolved for content candidate; Draft and Not Challenge Eligible retained | Founder approves actual elapsed hours, no days conversion, no prescribed duration/frequency/intake/schedule/clinical thresholds, and proportionate general caution. The existing Fasting definition explicitly says Draft/not Challenge Eligible and identifies safety as a publication dependency. Lifecycle/eligibility do not fail structural content ingestion. Server publication readiness was not evaluated. |
| `FIT-STR-019` Glute Bridge | Unresolved; Weight basis empty | The baseline allows Weight where applicable. Neither it nor the load convention establishes whether a supported configuration means total loaded implement, per implement, single implement, per side, or machine displayed load. PF-02 forbids inference from the name. Consultant descriptions do not establish Product Truth. |
| `FIT-STR-023` Lateral Lunge | Unresolved; Weight basis empty | The baseline allows Weight where applicable. No canonical definition establishes whether loads are single-held, paired/per-implement, or otherwise configured. Repetitions per side do not establish Weight basis. PF-02 forbids inference from name; consultant equipment descriptions are not authority. |
| `FIT-STR-025` Lunge Hold | Unresolved; Weight basis empty | The baseline permits Duration and Weight where applicable, but does not specify the loaded position/implement convention. Duration or side-specific holding does not determine load basis. No basis can be selected without Tiizi declaration. |
| `FIT-STR-036` Russian Twist | Unresolved; Weight basis empty | The baseline allows Weight where applicable. No canonical Activity definition declares exact supported implement/configuration; name and consultant examples cannot determine if the Weight means one implement, per side, or another basis. PF-02 requires an explicit basis. |
| `WEL-NUT-002` Fruit Intake | Unresolved; consultant semantics remain draft | Repository authority establishes Quantity → servings and explicitly requires authoritative serving guidance before publication; it does not define one serving. Current draft says approximately one medium whole fruit or one cup of berries. Do not treat that consultant example as canonical. Tiizi must approve/revise the operational equivalence and covered forms. |
| `WEL-NUT-003` Vegetable Intake | Unresolved; consultant semantics remain draft | Repository authority establishes Quantity → servings and requires authoritative serving guidance; it does not define one serving. Current draft says approximately one cup raw leafy vegetables or one-half cup cooked vegetables. Do not treat that consultant example as canonical. Tiizi must approve/revise the equivalence and define covered vegetable forms/preparation. |

For both serving Activities, the safe recommendation is to keep `servings` unavailable for ingestion until Tiizi adopts an explicit, measurable serving equivalence and the forms it covers. The present drafts are review proposals only; no serving count target or nutrition recommendation is introduced. The six unresolved items are the only current Founder/Tiizi decisions blocking ingestion readiness.

## Population path recommendation

Do not populate directly from consultant JSON and do not create per-Activity migrations. Prepare a controlled, repeatable import utility that first validates the reviewed candidate in dry-run mode, joins on immutable Activity Code, reconciles current PostgreSQL records, and invokes the existing Knowledge domain write seams. Existing admin routes support draft creation (`POST /v1/admin/knowledge`), versioned content revision (`PATCH /v1/admin/knowledge/:id`), publication (`POST /v1/admin/knowledge/:id/publish`), and retirement. Creation allocates the server UUID, enforces Activity Code uniqueness and creates version 1; revision creates an immutable version-history row. The admin API is sufficient for authorized, record-by-record writes, but it does not provide the batch preview, idempotent reconciliation, and all-or-nothing import behavior needed for 118 records. A bounded import utility should call the same domain/service validation/write functions (or admin API), default to dry-run, require an explicit apply mode, fail closed on code/content/version conflicts, and leave lifecycle at Draft. Publication remains a separate governed action through existing readiness gates. No schema migration is justified by this candidate and no database was queried or written here.

## S6 position

This artifact is a reconciled authored-content candidate only. S6 remains **OUTSTANDING**. Catalogue population, Library/Activity Guide assembly, composer handoff verification, Founder preview, and acceptance remain incomplete. No Activity has been published or marked production-ready by this reconciliation.
