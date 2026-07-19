# Phase 3A-4 Fitness Source Register

Audit date: 2026-07-18

This register records **51 source locations**: 45 repository files inspected and 6 logical Firestore/runtime locations traced from code. No Firestore collection was queried live. A count of `unknown live` means the schema/path is evidenced, but its deployed document population was not inspected.

## Record-defining repository sources

| # | Source | Source type | Current role | Records represented | Runtime evidence | Overlap | Confidence / unresolved question |
|---:|---|---|---|---:|---|---|---|
| 1 | `catalogExercises_CLEAN.json` | Static JSON catalogue | Intended seed/import content for `catalogExercises` | 154 exercises | Imported by three seed/load paths; no direct application import | Firestore catalogue, content input, test fixtures, wellness movement | High for local content; live parity unknown |
| 2 | `docs/input/ISOMETRIC-EXERCISES-CONTENT-DETAIL.md` | Content input/reference | Detailed legacy isometric authoring source | 31 numbered concepts | No runtime import found | Many concepts were expanded into left/right JSON records | High that it is reference-only; provenance relationship is inferred |
| 3 | `scripts/seedAppData.ts` | Seed/generator | Empty-catalog load, six-item fallback pool, activity interests, challenge presets/templates/workouts | 15 interests, 6 fallback exercises, 3 template entities, 4 template activities, 3 challenge presets; dynamic generated challenges/workouts | Write-capable only when invoked; not run | JSON, profile/group interests, template collection | High; generated challenge runtime compatibility remains legacy |
| 4 | `scripts/seedBaselineData.ts` | Baseline seed | Empty-catalog load and exercise-interest documents | 154 referenced catalogue rows; 15 interest options | Write-capable only with apply; not run | `seedAppData`, hard-coded profile interests | High |
| 5 | `src/features/Profile/ProfileInterestsScreen.tsx` | Active hard-coded UI data | Member profile activity selection | 19 fitness-interest options | `exerciseOptions.map` persists IDs to profile setup | Edit Profile, group options, seed interests | High |
| 6 | `src/features/Profile/EditProfileScreen.tsx` | Active hard-coded UI data | Profile activity editing | 19 fitness-interest options | `exerciseOptions` hydrates and persists selections | Profile setup list, group options | High |
| 7 | `src/features/Groups/groupOptions.ts` | Active shared hard-coded UI data | Group activity-interest selection | 23 options | Imported by create/edit group screens | Profile lists and seeded `exerciseInterests` | High |
| 8 | `src/data/wellnessActivitiesCatalog.ts` | Static runtime fallback | Wellness activity catalogue, including physical movement | 67 total; 8 movement records extracted here | Used by `wellnessActivityService` on empty/failed Firestore read | Running, walking, cycling, stretching, mobility, yoga and steps cross the fitness boundary | High |
| 9 | `src/features/Challenges/components/ChallengeActivitySection.tsx` | Active hard-coded UI constraint | Fitness activity unit selector | 5 units | Values are editable and copied into challenge activities | Catalogue metric units and admin metric types | High |
| 10 | `src/services/catalogMetadata.ts` | Shared constants | Admin/filter taxonomy for exercise and wellness metadata | 16 fitness-relevant options extracted | Imported by admin/catalogue paths | Exercise form and admin validator taxonomies | High |
| 11 | `src/features/Admin/Exercises/exerciseFormUtils.ts` | Active admin form constants | Exercise category, difficulty and metric dropdowns | 16 options | Used by add/edit exercise forms | `catalogMetadata` and `adminExerciseService` | High |
| 12 | `src/services/adminExerciseService.ts` | Active admin validation constants | Validates create/update/import exercise categories/difficulty | 12 options | Enforced before Firestore admin writes | Does not match several JSON `tier_2` labels | High |
| 13 | `src/features/Exercises/ExerciseLibraryScreen.tsx` | Active UI option set | Isometric/isotonic filter | 2 relevant type options | Filters fetched Firestore exercises by `movementType` or tags | JSON movement type fields | High |
| 14 | `scripts/testScoringGuards.ts` | Test fixture | Engine/scoring source guards | 4 unique fitness fixture identities extracted | Test-only | Pushups/squats/run overlap production concepts | High |
| 15 | `scripts/testChallengeCreation6Combinations.ts` | Test fixture | Fitness/wellness/type creation matrix | 1 fitness fixture | Test-only | Push-up variants | High |
| 16 | `scripts/testActivitySessionRules.mjs` | Rules test fixture | Activity session rule scenarios | 2 fitness fixtures | Test-only/emulator | Modified Push-Up and Bear Crawl Hold may match catalogue variants | High |
| 17 | `scripts/auditChallengeCreationPayloads.ts` | Static audit fixture | Wizard payload validation | 1 fitness fixture | Test-only | Push-up variants | High |
| 18 | `scripts/testChallengeCreationBackend.ts` | Backend test fixture | Callable creation validation | 1 fitness fixture | Test-only | Push-up variants | High |
| 19 | `scripts/testServerTimestampSentinels.mjs` | Test fixture | Timestamp payload guard | 1 fitness fixture | Test-only | Squats | High |
| 20 | `scripts/testOnboardingPersistenceRuntime.ts` | Test fixture | Profile-patch persistence | 3 meaningful fitness-interest fixture values | Test-only | Active profile interest lists | High; placeholder `a/b/c` deliberately excluded |
| 21 | `scripts/testUserProfilePatchEmulator.ts` | Emulator test fixture | Profile patch behavior | 5 meaningful fitness-interest fixture values | Test-only/emulator; not run | Active profile interest lists | High |

## Runtime, transform, schema and validation repository sources

| # | Source | Source type | Role / evidence | Record count | Overlap / unresolved question | Confidence |
|---:|---|---|---|---:|---|---|
| 22 | `scripts/loadExercises.ts` | Write-capable loader | Imports all JSON `documents` and `batch.set`s `catalogExercises/{id}`; `--dry-run` is local-only | References 154 | Default invocation writes despite script name; live parity unknown | High |
| 23 | `scripts/backfillCatalogTemplateFields.ts` | Read/dry-run and optional write backfill | Audits lifecycle/search fields for four collections; apply path can modify them | Dynamic live count | Not safe/necessary for this audit; not run | High |
| 24 | `scripts/testExerciseLibraryIsometricGuards.ts` | Static guard | Loads JSON and asserts movement/hold/metric invariants and `>=154` | References 154 | Validates local file only | High |
| 25 | `src/types/index.ts` | Type schema | `CatalogExercise`, `Challenge.activities`, and `Workout` shapes | Type-only | Runtime documents contain fields not fully enforced by types/rules | High |
| 26 | `src/services/exerciseService.ts` | Active runtime service | Reads and validates Firestore `catalogExercises`; search/filter/stats | Unknown live | No JSON fallback; invalid Firestore documents are filtered | High |
| 27 | `src/hooks/useExercises.ts` | Active query adapter | React Query access to `exerciseService` | Dynamic | Comments still mention 113 | High |
| 28 | `src/features/Exercises/ExerciseDetailScreen.tsx` | Active UI | Displays a Firestore exercise and links to logging/challenge creation | Dynamic | Content fallbacks can mask empty fields | High |
| 29 | `src/services/wellnessActivityService.ts` | Active runtime service | Firestore-first `wellnessActivities`, local fallback on empty/read failure | Unknown live or 67 fallback | Live Firestore completely replaces rather than merges local fallback | High |
| 30 | `src/hooks/useWellnessActivities.ts` | Active query adapter | Filters/searches wellness source for UI and wizard | Dynamic | Fitness/wellness boundary is category-based | High |
| 31 | `src/features/Challenges/CreateChallengeWizard.tsx` | Active transform/UI | Resolves exercise IDs/names, lets units/targets change, snapshots selected activities | Dynamic | Fitness snapshot is much thinner than full catalogue; no activity version | High |
| 32 | `src/services/challengeTemplateService.ts` | Active runtime service | Reads/writes Firestore fitness `challengeTemplates`; legacy defaults | Unknown live | Template activities can lack catalogue IDs | High |
| 33 | `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Active admin template UI | Creates fitness/wellness templates, not live challenges | Dynamic | Reuses wizard options; fitness activities resolve from Firestore | High |
| 34 | `src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx` | Active admin template UI | Edits fitness template activity snapshots | Dynamic | Name/unit defaults can diverge from catalogue | High |
| 35 | `src/services/workoutService.ts` | Active logging service | Writes workout records and challenge-member progress | Dynamic logs | Does not establish a new catalogue record; trusts submitted activity/unit too broadly | High |
| 36 | `src/features/Workouts/LogWorkoutScreen.tsx` | Active logging UI | Loads exercise by ID and submits value/unit | Dynamic | Has a `Pushups` display fallback when lookup/name is absent | High |
| 37 | `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Active selector | Joins challenge activity snapshots to fetched exercises | Dynamic | Snapshot IDs may no longer resolve in current Firestore | High |
| 38 | `src/services/challengeActivityFlow.ts` | Active selector helper | Determines current/next challenge activities | Dynamic | Treats exercise/activity IDs as interchangeable in places | High |
| 39 | `firestore.rules` | Security/routing definition | Rules for catalogue, challenge templates, challenges, workouts, wellness activities and interests | Collection-level | Does not prove deployed rules or live counts | High for working tree |
| 40 | `firestore.indexes.json` | Query configuration | Contains `catalogExercises` query index | 1 relevant index group | Deployment state unknown | High for working tree |
| 41 | `docs/ANTIGRAVITY_BUILD_PROMPT.md` | Historical specification | Claims a 113-exercise catalogue and describes import/runtime intent | Count claim: 113 | Contradicted by current 154-row JSON | High that claim is stale |
| 42 | `docs/CLEAN_BUILD_SPEC.md` | Historical specification | Calls catalogue single source of truth and claims 113 records | Count claim: 113 | Does not reflect admin mutation/runtime divergence | High that claim is historical |
| 43 | `docs/TIIZI_TECHNICAL_SPECIFICATION_CLEAN_BUILD.md` | Historical specification | Describes `catalogExercises` and 113 exercises | Count claim: 113 | Stale count | High |
| 44 | `docs/reports/fitness-activity-content-audit.md` | Prior audit | Reports 154 local JSON records and Firestore runtime behavior | Count claim: 154 local | Evidence was rechecked in this phase | High |
| 45 | `docs/reports/WELLNESS_ACTIVITY_CONTENT_AUDIT.md` | Prior audit | Reports 67 wellness records and source mechanics | Count claim: 67 local | Eight movement rows overlap this phase | High |

## Logical Firestore and persisted-record locations traced (not read live)

| # | Logical location | Source type | Current role | Live count | Runtime evidence | Confidence / limitation |
|---:|---|---|---|---|---|---|
| 46 | `catalogExercises/{exerciseId}` | Firestore catalogue | Actual member/admin fitness catalogue at runtime | Unknown live | `exerciseService`, `adminExerciseService`, rules, index | High path confidence; contents not inspected |
| 47 | `challengeTemplates/{templateId}` | Firestore templates | Fitness template source | Unknown live | `challengeTemplateService` and admin/template UI | High path confidence; contents not inspected |
| 48 | `challenges/{challengeId}.activities[]` | Persisted snapshots | Launched challenge activity source | Unknown live | Wizard payload, detail/selector/logging paths | High path confidence; historical snapshots can outlive catalogue rows |
| 49 | `workouts/{workoutId}` | Persisted activity logs | Exercise usage/progress evidence | Unknown live | `workoutService`, analytics, rules | High path confidence; logs are not catalogue definitions |
| 50 | `exerciseInterests/{interestId}` | Firestore metadata | Admin-manageable seeded interest vocabulary | Unknown live | seeds and `adminContentService`; member option screens remain hard-coded | High path confidence; member runtime authority is split |
| 51 | `wellnessActivities/{activityId}` | Firestore wellness catalogue | Firestore-first wellness source, including movement | Unknown live | `wellnessActivityService`, admin service, rules | High path confidence; may diverge from 67-row fallback |

## Source-of-truth assessment

- **Runtime exercise authority:** Firestore `catalogExercises`, read by `exerciseService`. It has no local fallback.
- **Likely intended local seed authority:** `catalogExercises_CLEAN.json` with 154 records.
- **Mutation authority:** `adminExerciseService` can create, update, delete, and bulk import Firestore records, so runtime can diverge from the JSON.
- **Persisted historical authority:** launched `challenges.activities[]` and `workouts.exerciseId/unit` can retain identities or metrics after catalogue changes.
- **Parallel vocabularies:** hard-coded profile/group interests, Firestore `exerciseInterests`, wellness movement activities, and fitness templates are separate sources rather than views of one catalogue.
- **No safe live reconciliation:** no purpose-built, clearly read-only exercise-catalogue comparison script was found. The optional backfill script is credentialed and write-capable when flags are supplied, so it was not used.
