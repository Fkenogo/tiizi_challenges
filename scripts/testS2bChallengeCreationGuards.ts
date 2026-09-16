/**
 * S2b — V2 Group context + Challenge Creation vertical assembly guards
 * (run: npm run test:s2b-challenge-creation).
 *
 * Proves the S2b slice against the governing formula
 * (Product Truth + Adopted Experience Reference = Product Assembly):
 *
 * - the visible six-step structure maps onto the governed PF-04 draft;
 * - host Group selection uses the member's ACTUAL memberships (no hardcoded
 *   list, no standalone/personal Challenge);
 * - only composer-selectable canonical Activities enter the catalogue;
 * - options binding, components, load basis and duration/completion controls
 *   appear only where the governed Activity requires them;
 * - creator participation is explicit and never automatic;
 * - preview and establishment go through the server authorities
 *   (POST /v1/challenge-definitions/preview, POST /v1/challenges) — no
 *   semantic rules are duplicated client-side and no direct Challenge write
 *   exists in the V2 experience;
 * - governed denials map to clear member-facing copy;
 * - the created-Challenge context is bound to the persisted read.
 *
 * Pure-contract assertions run the React-free draft module; the rest are
 * static source assertions over the S2b experience files.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VISIBLE_STEPS,
  allowsMultipleActivities,
  assessVisibleStep,
  challengeTypeLabel,
  createInitialWizardState,
  creationErrorMessage,
  deriveEndDate,
  firstIncompleteStep,
  formatDay,
  isWizardComplete,
  mapPreviewIssues,
  requiredComponentIds,
  summarize,
  toComposerDraft,
  toEstablishmentBody,
  type WizardActivity,
  type WizardState,
} from '../src/v2/challenges/challengeCreationDraft.js';
import type { ActivityOptionsResponse } from '../src/api/challengeCreationApi.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const GROUP_ID = '22222222-2222-4222-8222-222222222222';

function options(overrides: Partial<ActivityOptionsResponse> = {}): ActivityOptionsResponse {
  return {
    knowledgeId: '11111111-1111-4111-8111-111111111111',
    activityCode: 'FIT-STR-001',
    kind: 'fitness',
    currentVersion: 3,
    primaryMetrics: ['repetitions'],
    secondaryMetrics: [],
    compatibleUnits: ['reps', 'repetitions'],
    components: [],
    supportedLoadBases: [],
    unitsByMetric: { repetitions: ['reps', 'repetitions'] },
    ...overrides,
  };
}

function activity(overrides: Partial<WizardActivity> = {}): WizardActivity {
  return {
    activity: options().knowledgeId,
    name: 'Push-Up',
    kind: 'fitness',
    observedVersion: 3,
    options: options(),
    metric: 'repetitions',
    unit: 'reps',
    targetValue: '100',
    durationMode: '',
    completionOccurrence: '',
    loadBasis: '',
    ...overrides,
  };
}

function baseState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    ...createInitialWizardState(new Date(2026, 5, 1)),
    challengeType: 'competitive',
    groupId: GROUP_ID,
    groupName: 'Nairobi Morning Movers',
    title: 'June Race',
    activities: [activity()],
    startDate: '2026-06-01',
    durationDays: 14,
    timezone: 'Africa/Nairobi',
    ...overrides,
  };
}

// ─── Visible six steps → governed draft ─────────────────────────────────────
console.log('visible six-step structure');
check('six visible steps in the adopted order', VISIBLE_STEPS.length === 6
  && VISIBLE_STEPS[0] === 'HOW_IT_WORKS'
  && VISIBLE_STEPS[2] === 'WHAT_ARE_WE_DOING'
  && VISIBLE_STEPS[5] === 'REVIEW_AND_CREATE');
check('type terminology is human-facing', challengeTypeLabel('collective') === 'Together'
  && challengeTypeLabel('competitive') === 'Race'
  && challengeTypeLabel('streak') === 'Streak');
check('internal values are never the label', challengeTypeLabel('collective') !== 'collective');

console.log('six steps map to the governed PF-04 draft');
const draft = toComposerDraft(baseState());
check('draft kind/mode are the governed contract', draft.draftKind === 'pf04-v1' && draft.mode === 'CHALLENGE');
check('type + basics + window present', draft.challengeType === 'competitive'
  && draft.title === 'June Race' && draft.startDate === '2026-06-01' && draft.endDate === '2026-06-14');
check('activity identity is the canonical id + observed version', draft.activities[0].activity === options().knowledgeId
  && draft.activities[0].observedVersion === 3);
check('metric/unit/target carried', draft.activities[0].metric === 'repetitions'
  && draft.activities[0].unit === 'reps' && draft.activities[0].targetValue === 100);
check('timezone carried', draft.timezone === 'Africa/Nairobi');

// ─── Host Group context — actual memberships, no standalone Challenge ────────
console.log('Group context');
const noGroup = baseState({ groupId: null, groupName: null });
check('host step is incomplete without a Group', assessVisibleStep(noGroup, 'WHO_IS_HOSTING').complete === false
  && assessVisibleStep(noGroup, 'WHO_IS_HOSTING').missing.includes('group'));
check('with a Group + title the host step completes', assessVisibleStep(baseState(), 'WHO_IS_HOSTING').complete === true);
let threw = false;
try {
  toEstablishmentBody(noGroup, { activate: true, joinCreator: false });
} catch {
  threw = true;
}
check('no standalone Challenge: establishment requires a host Group', threw === true);

const wizardSource = read('src/v2/challenges/V2ChallengeCreationWizard.tsx');
check('host picker binds the member real memberships', wizardSource.includes('useV2Memberships'));
check('no hardcoded Group list in the wizard', !/Nairobi Morning Movers|INITIAL_GROUPS|mockGroups/.test(wizardSource));
const membershipsApi = read('src/api/membershipsApi.ts');
check('memberships come from GET /v1/memberships/me', membershipsApi.includes('/v1/memberships/me'));

// ─── Composer-selectable catalogue only ─────────────────────────────────────
console.log('catalogue boundary');
const apiSource = read('src/api/challengeCreationApi.ts');
check('catalogue requests composerSelectable=true', apiSource.includes("composerSelectable: 'true'"));
check('catalogue calls GET /v1/knowledge', apiSource.includes('/v1/knowledge?'));
check('wizard uses the composer catalogue hook', wizardSource.includes('useComposerCatalogue'));

// ─── Options binding + progressive disclosure ───────────────────────────────
console.log('options binding and progressive disclosure');
check('options bound through GET /options', apiSource.includes('/options') && apiSource.includes('fetchActivityOptions'));
check('wizard fetches options before adding an Activity', wizardSource.includes('fetchActivityOptions'));
check('component ids are the declared ALL_REQUIRED set', requiredComponentIds(options({
  components: [
    { componentId: 'LEFT', displayName: 'Left side', relationship: 'ALL_REQUIRED' },
    { componentId: 'RIGHT', displayName: 'Right side', relationship: 'ALL_REQUIRED' },
  ],
})).join(',') === 'LEFT,RIGHT');
const componentActivity = activity({
  options: options({
    primaryMetrics: ['duration'],
    compatibleUnits: ['seconds'],
    unitsByMetric: { duration: ['seconds'] },
    components: [
      { componentId: 'LEFT', displayName: 'Left side', relationship: 'ALL_REQUIRED' },
      { componentId: 'RIGHT', displayName: 'Right side', relationship: 'ALL_REQUIRED' },
    ],
  }),
  metric: 'duration',
  unit: 'seconds',
  targetValue: '30',
  durationMode: 'CONTINUOUS',
});
const componentDraft = toComposerDraft(baseState({ activities: [componentActivity] }));
check('components pinned on the draft when declared', JSON.stringify(componentDraft.activities[0].componentIds) === '["LEFT","RIGHT"]');
check('duration mode carried', componentDraft.activities[0].durationMode === 'CONTINUOUS');
check('duration step gates on explicit mode', assessVisibleStep(
  baseState({ activities: [activity({ metric: 'duration', unit: 'seconds', targetValue: '30', durationMode: '' })] }),
  'WHAT_COUNTS',
).complete === false);
const weightDraft = toComposerDraft(baseState({
  activities: [activity({
    options: options({ primaryMetrics: ['weight'], compatibleUnits: ['kilograms'], unitsByMetric: { weight: ['kilograms'] }, supportedLoadBases: ['PER_IMPLEMENT'] }),
    metric: 'weight',
    unit: 'kilograms',
    targetValue: '40',
    loadBasis: 'PER_IMPLEMENT',
  })],
}));
check('load basis carried for Weight', weightDraft.activities[0].loadBasis === 'PER_IMPLEMENT');
check('load basis step gates when Weight has none', assessVisibleStep(
  baseState({ activities: [activity({ metric: 'weight', unit: 'kilograms', targetValue: '40', loadBasis: '' })] }),
  'WHAT_COUNTS',
).complete === false);
check('completion occurrence carried + gated', toComposerDraft(baseState({
  activities: [activity({ metric: 'completion', unit: 'completion', targetValue: '1', completionOccurrence: 'one full session' })],
})).activities[0].completionOccurrence === 'one full session');
check('completion step gates without an occurrence', assessVisibleStep(
  baseState({ activities: [activity({ metric: 'completion', unit: 'completion', targetValue: '1', completionOccurrence: '' })] }),
  'WHAT_COUNTS',
).complete === false);
check('weight select renders natural labels', wizardSource.includes('loadBasisLabel'));
check('client never invents compatibility (no metricForUnit client-side)', !wizardSource.includes('metricForUnit')
  && !read('src/v2/challenges/challengeCreationDraft.ts').includes('metricForUnit'));

// ─── Creator participation ──────────────────────────────────────────────────
console.log('creator participation');
const initial = createInitialWizardState(new Date(2026, 5, 1));
check('creator participation defaults to NOT joining', initial.creatorJoins === false);
const joinBody = toEstablishmentBody(baseState({ creatorJoins: true }), { activate: true, joinCreator: true });
const noJoinBody = toEstablishmentBody(baseState({ creatorJoins: false }), { activate: true, joinCreator: false });
check('join_creator reflects the explicit choice', joinBody.join_creator === true && noJoinBody.join_creator === false);
check('wizard copystates the explicit choice', wizardSource.includes('Will you take part in this Challenge?')
  && !/auto[- ]?enrol|autojoin/i.test(wizardSource));

// ─── Server preview / no duplicated semantics ───────────────────────────────
console.log('server preview + single semantic authority');
check('wizard uses the S2a preview seam', wizardSource.includes('previewChallengeDefinition'));
check('preview endpoint is the governed seam', apiSource.includes('/v1/challenge-definitions/preview'));
const draftModule = read('src/v2/challenges/challengeCreationDraft.ts');
check('no PF-03 rule duplication (no governed metric vocabulary table client-side)',
  !/CANONICAL_METRICS|isCanonicalMetric|unit_metric_mismatch|missing_required_components/.test(draftModule));
check('preview issues map to visible steps', (() => {
  const mapped = mapPreviewIssues([
    { code: 'MISSING_FIELD', stage: 'SCHEDULE', message: 'composer: stage SCHEDULE is missing timezone' },
    { code: 'PF03_SEMANTIC', message: 'challenge-definition: [activities[0]_missing_occurrence] Completion requires an intelligible occurrence' },
  ]);
  return mapped[0].step === 'WHEN_DOES_IT_RUN' && mapped[1].step === 'WHAT_COUNTS';
})());
check('member-facing preview copy strips internal tokens', (() => {
  const mapped = mapPreviewIssues([{ code: 'PF03_SEMANTIC', message: 'challenge-definition: [invalid_title] title is required' }]);
  return !/challenge-definition|invalid_title/.test(mapped[0].friendly);
})());

// ─── Establishment path ─────────────────────────────────────────────────────
console.log('establishment');
check('establishment posts to /v1/challenges', apiSource.includes("'/v1/challenges'"));
check('establishment body carries the governed fields', (() => {
  const body = toEstablishmentBody(baseState({ challengeType: 'streak', durationDays: 7 }), { activate: false, joinCreator: false, idempotencyKey: 'k' });
  return body.group_id === GROUP_ID && body.challenge_type === 'streak'
    && body.required_consecutive_days === 7 && body.activate === false
    && body.activities[0].canonical_key === options().knowledgeId
    && body.activities[0].target_value === 100 && body.idempotency_key === 'k';
})());
check('collective derives a shared goal unit from the activity', (() => {
  const body = toEstablishmentBody(baseState({ challengeType: 'collective' }), { activate: true, joinCreator: false });
  return body.goal_value === 100 && body.goal_unit === 'reps';
})());
check('no Firestore establishment in the V2 experience',
  !/\baddDoc\(|\bsetDoc\(|\bupdateDoc\(|\bdeleteDoc\(|from ['"]firebase\/firestore['"]/.test(apiSource));

// ─── Governed denials mapped ────────────────────────────────────────────────
console.log('governed denial mapping');
check('charter restriction maps to clear copy', /stewards/.test(creationErrorMessage('challenge_creation_forbidden')));
check('no membership maps to clear copy', /active member/.test(creationErrorMessage('no_group_membership')));
check('unknown codes fall back safely', /try again/i.test(creationErrorMessage('something_else'))
  && !/challenge_creation_forbidden|no_group_membership/.test(creationErrorMessage('something_else')));

// ─── Created-Challenge context + list binding ──────────────────────────────
console.log('created context + list binding');
const createdSource = read('src/v2/challenges/V2CreatedChallengeScreen.tsx');
check('created screen reads persisted detail', createdSource.includes('useChallengeDetailV2'));
check('created screen shows participation state', /myParticipation/.test(createdSource));
check('created screen shows measurement summary', /MeasurementSummary/.test(createdSource));
const hooksSource = read('src/v2/challenges/useChallengeCreation.ts');
check('detail hook uses GET /v1/challenges/:id client', hooksSource.includes('getChallengeV2'));
check('list hook uses GET /v1/challenges client', hooksSource.includes('listChallengesV2'));
check('list invalidated after creation', hooksSource.includes("['v2-challenge-list']"));
const listSource = read('src/v2/challenges/V2ChallengeListScreen.tsx');
check('list screen renders create action + states', listSource.includes('Create Challenge')
  && listSource.includes('V2EmptyState') && listSource.includes('V2LoadingState'));

// ─── Schedule / timezone behaviour ─────────────────────────────────────────
console.log('schedule + timezone');
check('window is inclusive of the duration', deriveEndDate('2026-06-01', 14) === '2026-06-14');
check('single-day window', deriveEndDate('2026-06-01', 1) === '2026-06-01');
check('friendly day label', formatDay('2026-06-14') === '14 Jun 2026');
check('streak requires the governed timezone', assessVisibleStep(
  baseState({ challengeType: 'streak', timezone: '' }), 'WHEN_DOES_IT_RUN',
).complete === false);
check('timezone labels are friendly, not raw IANA', (() => {
  const summary = summarize(baseState({ timezone: 'Africa/Nairobi' }));
  return summary.includes('Nairobi time') && !summary.includes('Africa/Nairobi');
})());
check('only Streak allows multiple activities', allowsMultipleActivities('streak')
  && !allowsMultipleActivities('collective') && !allowsMultipleActivities('competitive'));

// ─── Summary copy per type ─────────────────────────────────────────────────
console.log('live summary');
check('together summary', /shared goal/.test(summarize(baseState({ challengeType: 'collective' }))));
check('race summary mentions finishing order', /ranked in order/.test(summarize(baseState({ challengeType: 'competitive' }))));
check('streak summary mentions each Challenge day', /each Challenge day/.test(summarize(baseState({ challengeType: 'streak' }))));

// ─── V1 boundary ───────────────────────────────────────────────────────────
console.log('V1 boundary');
check('no V1 experience imports in the S2b experience', !/features\/Challenges|BottomNav|RequireGroupRoute/.test(
  [wizardSource, createdSource, listSource, hooksSource, apiSource, draftModule].join('\n'),
));
check('no /app/ routes emitted from the S2b experience', !/["'`]\/app\//.test(
  [wizardSource, createdSource, listSource].join('\n'),
));
check('routes are V2-only', read('src/v2/routes.tsx').includes('path="challenges/new"')
  && read('src/v2/routes.tsx').includes('path="challenges/:challengeId"'));

// ─── UX gating ─────────────────────────────────────────────────────────────
console.log('client draft gating');
check('empty wizard reports the first step as incomplete', firstIncompleteStep(createInitialWizardState(new Date(2026, 5, 1))) === 'HOW_IT_WORKS');
check('complete wizard gates open at review', isWizardComplete(baseState()) === true
  && firstIncompleteStep(baseState()) === 'REVIEW_AND_CREATE');

if (failures > 0) {
  console.error(`\nS2b challenge creation guards: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nS2b challenge creation guards: all passing.');
