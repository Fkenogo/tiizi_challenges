# TIIZI S6 — Remaining Product Truth Decision Brief

**Evidence baseline:** `109db28caf3254a6c2f6edccc5112d116d12f1`

**Branch:** `impl/tiizi-s6-activity-catalogue-reconciliation-001`
**Scope:** S6 Activity content Product Truth, serving semantics, Fasting, optional Weight bases, Challenge-engine semantics, and readiness-state separation.

## Final candidate closure — reviewed at `3ace96ce8a48b274c27435dac8b823e1658c58d5`

The Founder disposition clarifies existing self-accountability Product Truth. The existing KCS and its cited serving baseline have been narrowly amended: “governed serving guidance” means enough neutral guidance for participant self-reporting; it does not require a universal serving size unless that Activity has an explicit canonical definition. Fruit and Vegetable content now follows this rule. No Activity identity, metric, unit, Challenge engine, or publication state changed.

### Self-accountability finding

The general principle is **already governed**. Stage F Product Definition §§F.3–F.6 and invariant 12, Functional Requirements FR-V2-065–068, CIC §§4.10–4.14, and the Activity Measurement and Reporting Standard §§3.1 and 7 establish that the participant self-reports; Activity Knowledge defines the measurement meaning; the Challenge pins its target/configuration; and Challenge calculation derives the outcome. Tiizi does not certify or independently verify that an Activity occurred. The new Founder direction clarifies this existing boundary; it does not remove engine evaluation.

Stage F Product Definition §§L.3–L.6 governs Streak completion as binary requirement satisfaction, with no extra credit for exceeding the configured requirement. §§J.1–J.4/J.10 govern Collective accumulation of actual contributions, including the full crossing contribution. §§K.2–K.9 govern Competitive target progress and completion-order position. Those type-specific rules remain distinct.

### Final dispositions of the seven review items

| Item | Current disposition | Reason / boundary |
|---|---|---|
| `WEL-NUT-002` Fruit Intake | **RESOLVED WITH GUIDANCE** | Participant determines and consistently applies their own serving interpretation, reports the count, and Tiizi records it without verifying physical quantity. No fixed fruit-size equivalence or intake recommendation is established. |
| `WEL-NUT-003` Vegetable Intake | **RESOLVED WITH GUIDANCE** | Same participant-declared count semantics. No raw/cooked cup equivalence or intake recommendation is established. |
| `FIT-STR-019` Glute Bridge | **RESOLVED WITH GUIDANCE** | Weight is optional. No load basis is required for ingestion or for repetitions configurations. Leave `loadReportingBases` empty; Weight configurations remain rejected/fail-closed unless a governed PF-02 basis is later declared. |
| `FIT-STR-023` Lateral Lunge | **RESOLVED WITH GUIDANCE** | Same: no basis is selected or inferred; non-Weight configurations remain available. |
| `FIT-STR-025` Lunge Hold | **RESOLVED WITH GUIDANCE** | Same: Duration does not imply a Weight setup or reporting basis. |
| `FIT-STR-036` Russian Twist | **RESOLVED WITH GUIDANCE** | Same: no basis is selected or inferred; non-Weight configurations remain available. |
| `WEL-NUT-009` Fasting | **RESOLVED WITH GUIDANCE** for content; no Fasting-only Draft restriction is justified by the current Founder direction | Preserve Duration/Hours and actual elapsed hours; no day conversion, prescribed regimen, or independent verification. Retain proportionate caution. Content can be assessed under ordinary KCS. Publication remains a server/governance lifecycle decision and was not performed. Challenge eligibility remains the normal derived result of published + KCS-ready + valid metric/unit contract; no Fasting-specific policy is established here. |

The candidate removes the former Fasting Draft-only note and replaces the Fruit/Vegetable equivalence proposals with neutral self-report guidance. Publication readiness, lifecycle, Challenge eligibility, and composer selectability remain separate system/governance outcomes. They are not assigned by the content candidate.

### Streak conformance gap confirmed

Product Truth is sufficient; this is an implementation defect, not an unresolved engine rule. `api/src/derivedTruth.ts` (`toChallengeContext`, around lines 145–170) supplies each pinned Activity `target_value` as `targetValue`; its accepted-record fold (around lines 245–260) supplies the participant's actual `record.value` and `record.unit` as `LogEvent`. `api/src/engine/streakEngine.ts` (around lines 59–77) then adds `logEvent.activityId` to `dailyCompletedActivities` without comparing value or unit against the configured requirement. That set determines Streak Done. The same accepted record path stores the actual measurement separately, so the defect is specifically threshold evaluation, not self-report storage.

**Affected scope:** all measurable Streak Activity requirements routed through this engine, including Repetitions, Duration, Distance, Weight, and Quantity. Completion-based requirements still need their governed self-attested completion semantics. Collective and Competitive engines are not implicated by this finding.

**Existing test coverage:** `api/test/challengeActivityApplication.test.ts` “streak: daily Done needs ALL requirements; partial, repeat and gap behave” logs exactly 2,000 ml and 8 hours against those targets. `api/test/challengeEngines.test.ts` streak cases use default event values and assert consecutive-day state. Neither demonstrates below-target behavior. Component-level threshold tests (`api/test/pf02ActivityComponents.test.ts`) prove a separate PF-02 component evaluator compares `report.value >= targetValue`; that helper has no call site in the ordinary Streak fold and does not prove Streak conformance. No existing test directly demonstrates that 40 against 50 is incorrectly counted Done.

**Smallest correction for a later bounded implementation task:** on the Streak accepted-record path, add a requirement to that Activity's daily completion set only when its normalized reported value/unit meets the pinned target (minimum threshold). Preserve the accepted actual report. Keep excess quantity binary for Streak and leave Collective/Competitive calculations unchanged. Add a regression test for 40/50 (and a passing 50/50 case), plus multi-Activity partial completion and replay/recomputation coverage. Do not implement that correction in this evidence pass.

### Readiness boundary and remaining implementation work

The deterministic candidate validator now returns `PASS`, with `readyForIngestion: true`. Content completeness and measurement vocabulary pass. This means only that this reviewed authored-content candidate can proceed through the controlled ingestion path; it does not establish server publication readiness or assign publication lifecycle, Challenge eligibility, or composer selectability. Empty optional Weight bases restrict those Weight configurations only. No Activity is thereby published.

The Streak threshold mismatch is a separate runtime conformance defect and the next bounded engineering task. It does not block Activity-content ingestion. The Streak engine remains unchanged.

## Executive summary

> **Historical analysis:** The sections below record the earlier review at `109db28caf3254a6c2f6edccc5112d116d12f1`. The final candidate-closure section above supersedes earlier unresolved-serving and not-ready conclusions.

The governing Stage F Product Truth separates canonical Activity meaning and measurement guidance from Challenge-specific targets and derived progress. It also settles type-specific behavior: Streak is binary daily requirement completion with no extra credit for exceeding the requirement; Collective accumulates actual qualifying values and preserves the crossing contribution; Competitive accumulates measured progress toward a target and determines position by target-completion order, not excess amount.

One implementation conformance issue is visible: the current API Streak fold marks a configured requirement Done when its Activity identity is logged. It passes the measured value and configured target into the engine context, but `StreakEngine` does not compare them. Stage F's governed example (1 km requirement; 5 km gives no extra credit) is more specific than that behavior. This brief does not alter it.

The canonical baseline establishes that Weight is compatible with the four named strength Activities where applicable, but does not specify their load arrangements. PF-02 supplies the allowed basis vocabulary and forbids inference. No basis can be selected for any of the four from current repository Product Truth.

The baseline and Stage F require an authoritative meaning for `servings` on Fruit Intake and Vegetable Intake but do not define one. The candidate's examples remain consultant proposals. These six measurement decisions continue to block ingestion readiness.

Fasting's actual-measurement intent is coherent: one participant-reported elapsed duration, in hours, with no conversion to days. Content-level caution is present. The repository still has an Activity-specific working finding requiring appropriate safety/caution before publication and says Fasting must not be made Challenge Eligible without explicit Challenge-use rules. The current Knowledge code has separate publication-readiness and Challenge-eligibility outputs, but does not expose a distinct per-Activity Challenge-use restriction: an otherwise published, KCS-ready Activity with a valid Duration/Hours contract would pass the present general eligibility assessment. Founder decision and an explicit eligibility-policy seam are therefore required if Fasting is to be published while excluded from the composer.

## 1. Fasting disposition assessment — WEL-NUT-009

### What is established

- Canonical identity and baseline measurement: **Fasting; Duration; seconds/minutes/hours**. The current candidate deliberately selects the Founder-directed `duration` + `hours` contract.
- The participant reports the actual elapsed duration. `24 hours` stays `24 hours`; `72 hours` stays `72 hours`. No conversion to days is part of the Activity record.
- Activity truth is the reported event and measurement. Challenge configuration supplies a target; the Challenge Calculation Authority derives completion/progress under the selected engine.
- The candidate has description, measurement guidance, unit semantics, setup, execution, protocol steps, session framing, and general safety/caution copy. It does not prescribe a duration, frequency, schedule, intake rule, clinical threshold, or suitability rule.
- Stage F Wellness guidance requires the Activity to define the practice and what period is measured; the Challenge determines the required duration/period. The candidate's basic participant-reporting content can satisfy that general content pattern, subject to normal content review.

### Publication readiness versus Challenge use

The accepted Activity baseline §28.6 says appropriate safety/caution guidance is required before Fasting Runtime publication. The KCS says safety notes must be proportionate and evidence-supported and forbids invented clinical thresholds. The Founder now approves the candidate's proportionate general caution direction. That resolves the prior review concern about whether this type of general caution is acceptable as candidate content; it does not itself establish server-computed `publicationReady`, which is a KCS result after ingestion. Nor does it settle the Activity-specific working finding in `WEL-NUT-009-FASTING.md`, which states “Do not publish yet” pending an appropriate evidence/review basis and identifies open fasting-period and Challenge-configuration semantics.

**Assessment:** the candidate is structurally content-complete for the requested actual-hours reporting direction. Publication readiness is **not established by this offline candidate validation**. The specific safety dependency has candidate wording and Founder approval, but Tiizi must determine whether that is sufficient under KCS/§28.6 after ordinary review, or whether a bounded evidence review is still required. No medical eligibility policy or clinical claims should be added.

The Fasting working exemplar identifies genuine Challenge-use questions: permitted Challenge types; whether an arbitrary creator-configured duration is allowed; how repeat frequency interacts with Challenge pressure; and whether protocol variants require separate governed representation. These are Challenge eligibility/configuration matters, not reasons to misstate or hide the content state as Draft.

**Can publication and eligibility differ?** Product Truth expressly treats them as different concepts. The runtime API also returns separate `publicationReady` and `challengeEligible` assessments. However, the current eligibility formula is `published + KCS-ready + valid governed Metric/Unit contract`; it has no Fasting-specific allow/deny or Challenge-type policy input. Consequently, the current implementation cannot represent “published for the Activity Guide, but specifically ineligible for Challenge use” once Fasting satisfies that general formula. Leaving the lifecycle Draft is not a substitute for deciding and modelling that policy.

**Exact Founder decision needed:**

1. Does the Founder-approved general caution, after normal content review, satisfy the Fasting publication dependency, allowing a published Activity Guide entry before Challenge use is authorized?
2. Define the generic measured interval boundary at the product level: does the participant self-identify the start and end of one continuous period in which they did not eat food, with no canonical rule about beverages? If not, specify only the minimum distinction needed. Do not add an intake regimen.
3. Is Fasting permitted in Streak, Collective, and Competitive Challenges? If any type is restricted, state the allowed-type rule.
4. May a creator set any positive Duration/Hours target, or is a non-clinical product-level configuration constraint needed? The repository currently defines no range; this brief recommends no numeric limits absent Founder/domain evidence.
5. If Fasting is published but restricted from Challenge use, authorize a distinct per-Activity eligibility rule and a server-enforced representation; do not use Draft lifecycle as a proxy.

## 2. Challenge-engine semantics assessment

| Proposition | Product Truth status | Repository evidence and boundary |
|---|---|---|
| **Streak:** compare daily measured requirement to the Challenge-configured requirement; completion is binary; exceeding creates no extra Streak credit. | **ALREADY GOVERNED** | Stage F Product Definition §§L.3–L.6: Streak measures consistency, not performance quantity; requirements are Challenge-configured; 5 km against 1 km creates no additional credit; the day is Complete or not. Product Definition §F.3 / Functional Requirements FR-V2-037 place targets in Challenge configuration. This general principle supports the Founder’s 50 Push-Up and 16-hour examples. |
| **Collective:** qualifying actual contributions accumulate toward the shared objective; the crossing contribution is retained in full. | **ALREADY GOVERNED** | Product Definition §§J.1–J.4 and J.10; Functional Requirements FR-V2-083/084/086. Collective progress is the sum of qualifying Challenge-specific contributions, may exceed 100%, and is not truncated at the target. |
| **Competitive:** actual qualifying progress accumulates toward the participant target; completion order determines position; later excess does not improve position. | **ALREADY GOVERNED** | Product Definition §§K.2–K.9; Stage F Founder Approval Decision FAD-01 §3 for standard competition ranking. The type is race-to-target; the configured target crossing/order governs position; excess performance after reaching target does not improve it. |

### Product Truth and implementation conformance

The Activity/Challenge separation is governed by Product Definition §F.3–F.6, Functional Requirements FR-V2-035–041/082, and CIC §§4.10–4.14: canonical Activity knowledge defines identity, permitted measurement and guidance; the Challenge-specific configuration selects a compatible metric/unit and sets its target; Activity Events and Challenge-specific records are distinct; Derived Truth belongs to calculation authority.

A narrow runtime mismatch remains visible for Streak. `api/src/derivedTruth.ts` builds Challenge context with `targetValue`, `unit`, and records with `value`, then `api/src/engine/streakEngine.ts` adds the Activity identity to the day's completed set without evaluating `logEvent.value` against `context.activities[].targetValue`. Its comment defines Done as all configured Activity IDs logged. The Founder’s quantified examples require threshold evaluation before the daily Done state. This is an implementation conformance item, not a missing Product Truth decision, and is outside this brief’s authorized changes.

## 3. Weight/load-basis decisions

The only canonical Activity-specific evidence for these records is their inventory/baseline identity and measurement compatibility. No separate governed Activity-definition files for these four codes were found. Consultant-authored movement/setup/equipment text is not Product Truth and was not used to choose a basis.

PF-02-CORR-001 / `08-LOAD-REPORTING-CONVENTION.md` permits these basis values: `TOTAL_LOADED_IMPLEMENT`, `PER_IMPLEMENT`, `SINGLE_IMPLEMENT`, `PER_SIDE`, and `MACHINE_DISPLAYED_LOAD`. Each configured Weight value needs one explicit basis. The convention prohibits inferring it from the Activity name; it defines no automatic mapping from exercise mechanics.

| Activity Code | Activity Name | Weight applicability and units | Existing Product Truth | Permitted basis/bases | Missing semantic decision | Resolution |
|---|---|---|---|---|---|---|
| `FIT-STR-019` | Glute Bridge | Repetitions + Weight where applicable; reps, grams, kilograms | Baseline §10.4 classifies it in Strength / Hinge and allows Weight where applicable. No governed definition describes the loaded setup or how the value is reported. | All five PF-02 bases are structurally valid vocabulary; none is established for this Activity. | Define which supported loaded arrangement(s) a Weight configuration represents and the corresponding basis. | **Unresolved; fail closed.** Confidence high that repository evidence is insufficient. |
| `FIT-STR-023` | Lateral Lunge | Repetitions + Weight where applicable; reps, grams, kilograms | Baseline §10.5 classifies it in Strength / Lunge and allows Weight where applicable. No governed definition specifies single-held versus paired/per-side loading. | All five vocabulary values; none established. | Define supported load arrangement(s), and whether the scalar is per implement, single implement, per side, total, or machine displayed. | **Unresolved; fail closed.** Confidence high that repository evidence is insufficient. |
| `FIT-STR-025` | Lunge Hold | Duration + Weight where applicable; seconds, minutes, grams, kilograms | Baseline §10.5 allows Duration and Weight. It does not define where/how external load is carried or how a value is attributed. | All five vocabulary values; none established. | Define whether a loaded hold is supported and, if so, the exact configuration(s) and basis. Duration or side-specific holding does not determine load basis. | **Unresolved; fail closed.** Confidence high that repository evidence is insufficient. |
| `FIT-STR-036` | Russian Twist | Repetitions + Weight where applicable; reps, grams, kilograms | Baseline §10.5 identifies Strength / Core-Trunk and permits Weight. No canonical definition states an implement arrangement or scalar reporting meaning. | All five vocabulary values; none established. | Define supported implement configuration(s) and corresponding basis. The Activity name alone cannot establish single versus paired/per-side loading. | **Unresolved; fail closed.** Confidence high that repository evidence is insufficient. |

**Founder/domain decision:** for each Activity, either declare no Weight configuration, or define the supported loaded setup(s) and the one applicable PF-02 basis per setup. A domain answer should describe the Activity configuration, not merely select a familiar gym convention.

## 4. Fruit/Vegetable serving semantics

The governed baseline §19 and §§28.1–28.2 establish `Quantity → servings` and require authoritative serving guidance before Runtime publication. Stage F KCS §3.6 prohibits publication with `servings` until the serving interpretation is governed. No authoritative Tiizi definition of one serving was found.

| Activity | Governed metric/unit | Current reconciled draft wording | Existing authoritative definition | What must be decided |
|---|---|---|---|---|
| `WEL-NUT-002` Fruit Intake | Quantity / servings | “One serving is approximately one medium whole fruit or one cup of berries.” | None. Baseline says authoritative serving guidance is required; it does not define size, equivalent forms, or exclusions. | Establish one measurable serving equivalence and specify covered forms (for example, whole, cut, berries, dried, canned, or juice) and how partial/mixed portions are counted. No daily target or nutritional recommendation. |
| `WEL-NUT-003` Vegetable Intake | Quantity / servings | “One serving is approximately one cup of raw leafy vegetables or one-half cup cooked vegetables.” | None. Baseline says authoritative serving guidance is required; it does not define included vegetables, cooked/raw equivalence, or preparation coverage. | Establish one measurable serving equivalence and specify covered vegetables/preparations and how partial/mixed portions are counted. No daily target or nutritional recommendation. |

The draft amounts above are consultant proposals, not recommendations derived from Tiizi Product Truth. Do not use them for Activity Guide, logging, Challenge configuration, or measurement validation as canonical semantics until a definition is adopted.

## 5. Content/readiness/lifecycle/eligibility boundary

The concepts are distinct in the Knowledge model, with one important limitation for per-Activity exclusions:

| Concept | Existing Tiizi meaning | Current behavior / assessment |
|---|---|---|
| Content completeness | Applicable KCS fields and Activity-class content are present. | The reconciliation report checks structural and applicable content; it is not the server KCS assessor. The current candidate's prior validator reports required/applicable fields complete. |
| Measurement-contract completeness | Canonical primary/secondary Metrics, compatible Units, and any required PF-02 semantics form a coherent contract. | Canonical metric/unit tuples pass, but four Weight bases and two serving meanings remain unresolved; fail closed for ingestion/use of those unresolved configurations. |
| Publication readiness | Pure content property: current content satisfies applicable KCS minima, independent of lifecycle. | `api/src/knowledge.ts` returns `publicationReady` and `publicationIssues` from server KCS assessment. It has not been computed against these not-yet-ingested candidate records. |
| Publication lifecycle | `draft`, `published`, `retired` controls Runtime Catalogue availability. | Draft is not the same as content completeness. Runtime `GET /v1/knowledge` is published-only. |
| Challenge eligibility | Server-derived eligibility requires Published + KCS-ready + a valid governed Metric/Unit contract. | Separate API field and machine-readable issues exist. No explicit Fasting-specific policy input/allow-list currently exists; eligibility is not an independently configurable per-Activity switch. |
| Composer selectability | Runtime selection predicate filters published Knowledge with Activity Code that is publication-ready and Challenge-eligible. | It is a downstream result, not a content field or consultant decision. A specific Activity exclusion must be reflected in canonical server policy before composer listing. |

Current source references: `api/src/knowledge.ts` (`ApiKnowledgeItem`, `assessChallengeEligibility`, `listPublishedKnowledge`), Stage F Knowledge Content Specification §4, and PF-01. This brief does not call the server assessment or alter its logic.

## 6. Exact remaining Founder decisions

1. **Fasting publication:** Is the Founder-approved general caution, after normal content review, sufficient for the §28.6 publication dependency, or is additional evidence review required?
2. **Fasting interval meaning:** Is the measured interval one continuous self-reported period from participant-identified start to participant-identified end, defined as going without food, without canonical beverage rules? If not, define the minimal event boundary without creating an intake protocol.
3. **Fasting Challenge policy:** Which of Streak, Collective, and Competitive may use generic Fasting? Are positive creator-set Duration/Hours targets unconstrained, or is a product-level configuration restriction required? No numeric recommendation is made here.
4. **Fasting model support:** If Guide publication is allowed but Challenge use is restricted, approve explicit per-Activity eligibility policy/server representation. The current eligibility evaluator has no such field; retaining Draft alone would conflate lifecycle and eligibility.
5. **Four Weight contracts:** For each of the four named Activities, specify whether Weight is supported, the physical loading configuration, and its exact PF-02 basis; otherwise declare no Weight configuration.
6. **Fruit and vegetables:** Adopt or replace the draft examples with authoritative measurable serving definitions, including which forms/equivalences count. Do not specify intake goals.
7. **Streak conformance:** Confirm the governed target-evaluation rule should be enforced before setting a daily requirement Done; current engine behavior logs an Activity ID but does not compare actual value with its configured target. Product Truth already supports the threshold/no-extra-credit meaning; this is a bounded implementation conformance decision.

## 7. Bounded external/domain research questions

These questions are for evidence gathering only. External sources do not amend Tiizi Product Truth by themselves.

- **Fasting safety copy:** What credible, non-promotional public-health sources support the narrow caution “may not be suitable for everyone; seek qualified advice if unsure” without adding diagnoses, treatment claims, thresholds, or suitability rules? Return exact citations, source dates, scope, and limitations; do not recommend fasting or durations.
- **Serving equivalences:** Which authoritative nutrition/food-measurement reference defines reproducible fruit and vegetable serving equivalents across whole/cut/berries and raw/cooked forms? Identify jurisdiction, units, food-form inclusions/exclusions, and a mapping usable by a participant logger. Do not state recommended daily intake or health effects.
- **Strength setup terminology:** Provide neutral exercise-domain descriptions of plausible external-load setups for Glute Bridge, Lateral Lunge, Lunge Hold, and Russian Twist, distinguishing one implement, paired implements, per-side loads, total loaded implement, and machine display where applicable. Cite authoritative exercise references. Do not assign a Tiizi basis; Founder must choose which setups Tiizi supports.
- **Fasting interval semantics:** Identify whether credible general references can clarify the common operational boundary of a participant-reported fasting interval (start/end and food versus beverages) without creating protocol or medical advice. Present alternatives and sources, not a recommended regimen.

## Recommended next action

Founder resolves the seven questions above (the existing six measurement decisions plus the Fasting publication/eligibility/conformance boundary). If external evidence is requested, gather only the bounded evidence listed above and return it for Founder decision. After decisions, update Product Truth or the candidate only as expressly authorized, rerun validation, and separately authorize any controlled population work. This brief does not authorize implementation.

## Hygiene and non-actions

The reviewed branch was clean at start. This pass changes only this decision brief. The reconciled Activity JSON, validator script, and machine validation report remain byte-for-byte unchanged from starting HEAD `109db28caf3254a6a6c2f6edccc5112d116d12f1`.

No database write, ingestion, publication, UI implementation, migration, deployment, or merge was performed. The isolated repository's `origin` points to a local mirror; a direct read-only GitHub check failed with `Could not resolve host: github.com`, so no push was possible during this pass.
