# Existing Documentation Inventory

## Method

All 334 Markdown files under `docs/` were enumerated. The full path-level inventory is in `evidence/documentation-inventory.tsv`. Documents were treated as claims until reconciled with runtime code.

## Documentation families

| Family | Apparent purpose | State | Main concern |
|---|---|---|---|
| `docs/reports/knowledge-catalogue/` | V2 knowledge governance, taxonomy, model, lifecycle, authoring, compatibility and reference assets | Predominantly future/governance; four current-state discovery artefacts | Rich fitness/wellness governance is not an implemented platform model |
| Wellness/fitness catalogue audits | Current catalogue source, metadata and duplication evidence | Current-state audit snapshots | Firestore contents remain environment-dependent |
| Challenge runtime audit | Creation, progress, completion, ranking, templates and points classification | Current-state audit | Strong evidence, but not a binding lifecycle specification |
| Pre-pilot/pre-beta reports | Implementation/change reports for onboarding, donations and UI | Historical or current-working-tree evidence | Deployment state and ownership are not established |
| Root/readme documentation | Setup and operational notes | Mixed | No single current platform architecture or product constitution |
| Mockup/design documentation | Visual intent and screen layouts | Intended/prototype | May be reachable only through dev routes |
| Script comments and guard descriptions | Structural/runtime regression intent | Engineering evidence | Many guards inspect source text rather than behavior |

## Knowledge catalogue review

The 28 entries include: the unified fitness/wellness/challenge model, challenge behavior and compatibility frameworks, knowledge governance, ownership boundaries, controlled dictionaries, exercise-family and authoring standards, knowledge graph and AI decision frameworks, lifecycle standards, a reference push-up asset, production programme, wellness rationalisation, and Phase 3A-4 legacy discovery files.

Observed contradiction: these documents specify versioned, governed knowledge objects, compatibility contracts, lifecycle gates and provenance, while current runtime continues to use `catalogExercises`, `wellnessActivities`, `challengeTemplates`, local JSON/TypeScript assets, and activity snapshots without catalogue/template versions. Therefore the documents are future-state governance, not proof of implementation.

## Coverage conclusion

Documentation is deepest in fitness/wellness knowledge and challenges. It is materially incomplete for identity/account lifecycle, group governance, moderation policy, feed content lifecycle, notification delivery, donation/payment semantics, analytics definitions, operational monitoring, data retention/deletion, privacy, and admin responsibilities.

No authoritative document was found that reconciles all product domains into a current-state platform contract. Documents frequently name concepts such as verification, AI recommendation, knowledge lifecycle, scoring, moderation and payment confirmation more completely than runtime implements them.

## Obsolescence and conflict signals

- “Individual challenge” appears in some conceptual language but is not a first-class active runtime challenge type.
- Current challenge points must not be described as a reward system; point-like normalized score fields exist, but no user-facing XP/reward loop is traced.
- The assumed 154 exercises describes one local JSON asset, not the complete legacy inventory or Firestore runtime population.
- Knowledge object lifecycle states and versions are not represented in active catalogue collections.
- Donation documents mix intent, self-reported sending, admin verification and legacy `confirmed` meanings.
- Group roles use owner/admin/member in storage while some UI presents “Coach”.
