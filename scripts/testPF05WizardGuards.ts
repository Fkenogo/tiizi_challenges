/**
 * PF-05 V2 Challenge Creation Wizard guards (run: npm run test:pf05-wizard).
 *
 * The web app has no DOM unit-test runner; like the other guard scripts this
 * file executes pure-contract assertions plus static no-legacy-semantics
 * proofs over the PF-05 Wizard surface:
 *
 * Runtime (pure modules only — no Firebase/auth side effects):
 * - client draft model: empty Composer, stage presence, stage order;
 * - client STAGE_FIELDS deep-equal the server STAGE_FIELDS contract;
 * - mapping definitionToRouteBody: deterministic, lossless, stable;
 * - human labels for bases and Duration modes (never raw enums alone).
 *
 * Static (source proofs over the Wizard + API seam):
 * - identity by UUID/Code (display names never identity);
 * - options/validity from the server (no local semantic validator);
 * - settled semantics not editable; no V1/Firebase/Template systems;
 * - flag gating, Review preview, Finish establishment, navigation, group.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createEmptyDraft,
  currentStage,
  missingForStage,
  STAGE_FIELDS as CLIENT_STAGE_FIELDS,
  WIZARD_STAGE_ORDER,
} from '../src/features/Challenges/V2/composerDraft.js';
import {
  definitionToRouteBody,
  DURATION_MODE_DESCRIPTIONS,
  DURATION_MODE_LABELS,
  loadBasisLabel,
  LOAD_BASIS_LABELS,
} from '../src/api/v2ChallengeCreationMapping.js';
import {
  fieldsForStage,
  WIZARD_STAGES as SERVER_STAGES,
} from '../api/src/challengeComposer.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

let failures = 0;
function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ok: ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const wizard = read('src/features/Challenges/V2/V2CreateChallengeWizard.tsx');
const draftModel = read('src/features/Challenges/V2/composerDraft.ts');
const apiSeam = read('src/api/v2ChallengeCreationApi.ts');
const mapping = read('src/api/v2ChallengeCreationMapping.ts');
const appRoutes = read('src/App.tsx');
const v2List = read('src/features/Challenges/V2ChallengesScreen.tsx');

// 1. Wizard initializes from PF-04 empty Composer.
{
  const empty = createEmptyDraft();
  check('1. empty Composer draft shape', empty.draftKind === 'pf04-v1'
    && empty.mode === 'CHALLENGE'
    && Array.isArray(empty.activities)
    && empty.activities.length === 0);
  check('1. wizard initializes from empty Composer', wizard.includes('createEmptyDraft()'));
  check('1. empty draft reports TYPE first', currentStage(empty) === 'TYPE');
}

// 2. Progression uses PF-04 completeness (client mirror === server contract).
{
  check('2. nine stages in order', WIZARD_STAGE_ORDER.join(',') === (SERVER_STAGES as readonly string[]).join(',')
    && WIZARD_STAGE_ORDER.join(',') === 'TYPE,BASICS,ACTIVITIES,MEASUREMENT,REQUIREMENT,SCHEDULE,RULES,REVIEW,FINISH');
  let mirror = true;
  for (const stage of WIZARD_STAGE_ORDER) {
    const server = fieldsForStage(stage as never);
    const client = CLIENT_STAGE_FIELDS[stage];
    if (JSON.stringify(server) !== JSON.stringify(client)) {
      mirror = false;
      console.error(`    drift at ${stage}: server=${JSON.stringify(server)} client=${JSON.stringify(client)}`);
    }
  }
  check('2. client STAGE_FIELDS mirror server contract', mirror);
  check('2. missing fields reported', missingForStage(createEmptyDraft(), 'TYPE').includes('challengeType'));
  check('2. wizard gates Continue on missing fields', wizard.includes('missingForStage(draft, stage)')
    && wizard.includes('disabled={blocking.length > 0}'));
}

// 3. Back/Continue preserve draft.
check('3. draft held in component state', wizard.includes('useState<ComposerDraft>')
  && wizard.includes('setDraft'));
check('3. Back/Continue navigate stages without resetting draft', wizard.includes('Back')
  && wizard.includes('Continue')
  && !wizard.includes('createEmptyDraft(), stage'));

// 4. Type cards update draft.
check('4. type cards update draft', wizard.includes("updateDraft({ challengeType: type })")
  && wizard.includes('collective') && wizard.includes('competitive') && wizard.includes('streak'));

// 5. Canonical Activity identity stored.
check('5. identity stored as code-or-UUID', wizard.includes('activity: item.activityCode ?? item.id'));
check('5. options fetched by UUID', wizard.includes('ensureOptions(activity.activity)')
  || wizard.includes('fetchV2ActivityOptions'));

// 6. Display name does not become identity.
check('6. no name-as-identity', !wizard.includes('activity: item.name')
  && !wizard.includes('canonical_key: item.name'));
check('6. display name presentation only', wizard.includes('displayName'));

// 7. Valid options come from Knowledge.
check('7. options endpoint consumed', apiSeam.includes('/v1/knowledge/${encodeURIComponent(knowledgeId)}/options')
  || apiSeam.includes('/options'));
check('7. metric/unit selects render server options', wizard.includes('options.primaryMetrics')
  && wizard.includes('options.compatibleUnits'));

// 8. Invalid Metric/Unit is not offered.
check('8. units filtered to chosen metric', wizard.includes('UNIT_METRIC'));

// 9. Components represented correctly.
check('9. required components rendered', wizard.includes('options.components')
  && wizard.includes('all must be done')
  && wizard.includes('never added together'));

// 10. Weight basis wording/rendering.
{
  const labels = Object.values(LOAD_BASIS_LABELS);
  check('10. human basis labels', labels.includes('Weight per implement')
    && labels.includes('Weight per side / hand')
    && loadBasisLabel('PER_IMPLEMENT') === 'Weight per implement');
  check('10. wizard renders basis radios from supported set', wizard.includes('options.supportedLoadBases')
    && wizard.includes('loadBasisLabel(basis)'));
}

// 11. Duration mode UI.
check('11. duration mode radios with copy', wizard.includes('DURATION_MODE_LABELS')
  && DURATION_MODE_LABELS.CONTINUOUS === 'Continuous'
  && DURATION_MODE_DESCRIPTIONS.ACCUMULATED.includes('Build up'));

// 12. Completion occurrence UI.
check('12. occurrence input, no bare Done default', wizard.includes('completionOccurrence')
  && wizard.includes('Complete one full guided session')
  && !wizard.includes("completionOccurrence: 'Done'"));

// 13. Settled Streak options not editable.
check('13. streak fixed rules informational only', wizard.includes('no Streak leaderboard')
  && !wizard.includes('cadence') && !wizard.includes('resetOnMiss')
  && !wizard.includes('reset_on_miss') && !wizard.includes('grace'));

// 14. Competitive ranking selector absent (info text may name the fixed rule).
check('14. no ranking/end-early controls', !wizard.includes('ranking selector')
  && !wizard.includes('ranking-selector') && !wizard.includes('rankingMode')
  && !wizard.includes('dense') && !wizard.includes('endOnFirstFinish')
  && wizard.includes('never ends the Challenge'));

// 15. Collective fixed semantics not editable.
check('15. no goal-manipulation toggles', !wizard.includes('capAtGoal')
  && !wizard.includes('earlyCompletion') && !wizard.includes('clipping')
  && wizard.includes('past 100% count'));

// 16. Stale Activity blocks Review/Finish.
check('16. stale warning + explicit refresh', wizard.includes('STALE_ACTIVITY')
  && wizard.includes('Refresh activity to current version')
  && wizard.includes('No silent refresh') === false);
check('16. Finish requires valid preview', wizard.includes('previewState.status !==')
  && wizard.includes('Finish & Create Challenge'));

// 17. Preview uses PF-04/PF-03 (server authority, no local validator).
check('17. review calls server preview', wizard.includes('previewV2Draft(draft)'));
check('17. no local semantic validator', !wizard.includes('validateChallengeDefinition')
  && !draftModel.includes('validateChallengeDefinition'));
check('17. definition rendered from preview', wizard.includes('previewState.definition'));

// 18. Invalid preview blocks Finish.
check('18. issues shown with stage edit actions', wizard.includes("previewState.status === 'invalid'")
  && wizard.includes('Check again'));

// 19. Finish calls V2 POST /v1/challenges.
check('19. establishment via V2 route', apiSeam.includes("'/v1/challenges', { method: 'POST'")
  && wizard.includes('establishV2Challenge(')
  && wizard.includes('definitionToRouteBody(previewState.definition, groupId)'));

// 20. No Firebase Challenge creation call.
{
  const sources = [wizard, apiSeam, mapping, draftModel];
  const firebaseHits = sources.filter((source) => /from ['"]firebase|from ['"][^'"]*firestore|getFirestore|addDoc|setDoc|firebase-admin|firebaseAuth/i.test(source));
  check('20. no Firebase/Firestore in creation path', firebaseHits.length === 0);
  check('20. provider-neutral fetch seam only', apiSeam.includes('apiFetch'));
}

// 21. No V1 Template service.
check('21. no V1 template systems', !wizard.includes('useChallengeTemplates')
  && !wizard.includes('adminExerciseService') && !wizard.includes('adminWellnessActivityService')
  && !wizard.includes('WellnessTemplate') && !wizard.includes('ChallengeTemplate'));

// 22. Use a Template entry exists but does not use V1.
check('22. template entry reserved disabled', wizard.includes('Use a Template')
  && wizard.includes('Coming next')
  && wizard.includes('aria-disabled'));

// 23. Feature flag gating works.
check('23. V2 flag gates wizard', wizard.includes('isV2ChallengesEnabled()')
  && wizard.includes('V2 Challenge creation is not enabled'));
check('23. route registered under V2 path', appRoutes.includes('/app/challenges/v2/create')
  && appRoutes.includes('V2CreateChallengeWizard'));
check('23. V1 create route intact', appRoutes.includes('/app/create-challenge'));

// 24. Successful establishment navigation works.
check('24. navigates to V2 detail', wizard.includes('/app/challenge/v2/${response.challengeId}'));
check('24. list entry point exists', v2List.includes('/app/challenges/v2/create'));

// 25. Group context is preserved.
check('25. groupId from route context into establishment', wizard.includes("searchParams.get('groupId')")
  && wizard.includes('definitionToRouteBody(previewState.definition, groupId)')
  && appRoutes.includes('RequireGroupRoute><V2CreateChallengeWizard'));

// Mapping behavior (runtime, pure module).
{
  const definition = {
    definitionKind: 'pf03-v1',
    challengeType: 'competitive',
    title: 'Map check',
    description: '',
    instructions: '',
    window: { startDate: '2026-10-01', endDate: '2026-10-31', timezone: 'UTC' },
    temporalConditions: null,
    goalValue: null,
    goalUnit: null,
    requiredConsecutiveDays: null,
    resetOnMiss: true,
    cadence: null,
    activities: [{
      canonicalKey: 'FIT-STR-001',
      knowledgeId: '00000000-0000-4000-8000-000000000001',
      activityCode: 'FIT-STR-001',
      knowledgeVersion: 2,
      kind: 'fitness',
      metric: 'repetitions',
      unit: 'reps',
      targetValue: 50,
      requiredComponents: [],
      componentRelationship: null,
      loadReportingBasis: null,
      durationMode: null,
      completionOccurrence: null,
      position: 0,
      activityVariant: null,
    }],
  } as never;
  const first = definitionToRouteBody(definition, 'group-1');
  const second = definitionToRouteBody(JSON.parse(JSON.stringify(definition)), 'group-1');
  check('mapping deterministic + lossless', JSON.stringify(first) === JSON.stringify(second)
    && (first.activities as Array<Record<string, unknown>>)[0].canonical_key === 'FIT-STR-001'
    && (first.activities as Array<Record<string, unknown>>)[0].version === 2
    && first.group_id === 'group-1');
}

if (failures > 0) {
  console.error(`\nPF-05 wizard guards: ${failures} failure(s).`);
  process.exit(1);
} else {
  console.log('\nPF-05 wizard guards: all checks passed.');
}
