/**
 * EBC-05 Founder Preview exposure guards (run: npm run test:ebc05-preview).
 *
 * The web app has no unit-test runner; like the other guard scripts this
 * file executes pure-contract assertions over the establishment payload
 * builder plus static no-bypass proofs over the preview surface:
 *
 * - establishment forms send the exact governed POST /v1/challenges
 *   contract for all three families (activate + join_creator);
 * - unpublished Knowledge and incompatible Metric/Unit tuples are
 *   rejected before send (the server re-validates; its rejection wins);
 * - Group authority failures surface cleanly in the form;
 * - participation stays explicit (no auto-join), withdrawal preserved;
 * - V2 logging uses only the V2 submission path (no fallback/dual write);
 * - accepted submissions refresh derived truth;
 * - type-specific truth displays overshoot, standard ranking, streak
 *   Current/Best/Days, frozen rank, finalStreak, ended/finalized state;
 * - preview seed/reset tooling is deterministic and localhost-only.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCreationPayload,
  validateEstablishForm,
  type EstablishActivityDraft,
  type EstablishFormState,
} from '../src/features/Challenges/v2EstablishPayload.js';
import { permittedMetrics, type V2KnowledgeItem } from '../src/api/v2KnowledgeContract.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');
const strip = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ok: ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function expectThrow(name: string, fn: () => void): void {
  try {
    fn();
    failures += 1;
    console.error(`  FAIL: ${name} — expected throw, returned normally`);
  } catch {
    console.log(`  ok: ${name}`);
  }
}

function knowledgeItem(overrides: Partial<V2KnowledgeItem> = {}): V2KnowledgeItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    kind: 'fitness',
    lifecycle: 'published',
    knowledgeVersion: 1,
    name: 'Preview Push-Up',
    category: 'Upper Body',
    description: 'A governed preview pressing movement',
    metricUnit: 'reps',
    grandfathered: false,
    primaryMetrics: ['repetitions'],
    secondaryMetrics: [],
    compatibleUnits: ['reps'],
    ...overrides,
  };
}

function row(overrides: Partial<EstablishActivityDraft> = {}): EstablishActivityDraft {
  return {
    knowledge: knowledgeItem(),
    activityKind: 'fitness',
    metric: 'repetitions',
    targetValue: '10',
    unit: 'reps',
    ...overrides,
  };
}

function form(overrides: Partial<EstablishFormState> = {}): EstablishFormState {
  return {
    challengeType: 'collective',
    groupId: '22222222-2222-4222-8222-222222222222',
    title: 'Team 10k',
    description: '',
    startDate: '2026-09-14',
    endDate: '2026-09-21',
    timezone: 'Pacific/Auckland',
    goalValue: '100',
    goalUnit: 'reps',
    requiredConsecutiveDays: '5',
    activities: [row()],
    ...overrides,
  };
}

console.log('EBC-05 preview guards — establishment payloads');

// 1. Collective form sends a valid governed creation payload.
{
  const payload = buildCreationPayload(form());
  check('1: collective payload family', payload.challenge_type === 'collective');
  check('1: collective payload goal', payload.goal_value === 100 && payload.goal_unit === 'reps');
  check('1: collective payload activates + joins creator', payload.activate === true && payload.join_creator === true);
  check('1: collective payload activity tuple', payload.activities.length === 1
    && payload.activities[0]?.canonical_key === 'Preview Push-Up'
    && payload.activities[0]?.metric === 'repetitions'
    && payload.activities[0]?.target_value === 10
    && payload.activities[0]?.unit === 'reps');
}

// 2. Competitive form sends a valid governed creation payload (no
// challenge-level goal: members race to the per-activity targets).
{
  const payload = buildCreationPayload(form({ challengeType: 'competitive', title: 'Squat race' }));
  check('2: competitive payload family', payload.challenge_type === 'competitive');
  check('2: competitive payload omits goal fields', payload.goal_value === undefined && payload.goal_unit === undefined);
  check('2: competitive payload races to activity targets',
    payload.activities.length === 1 && payload.activities[0]?.target_value === 10);
}

// 3. Streak form supports multiple daily activities + required days.
{
  const payload = buildCreationPayload(form({
    challengeType: 'streak',
    activities: [
      row(),
      row({
        knowledge: knowledgeItem({
          id: '33333333-3333-4333-8333-333333333333',
          kind: 'wellness',
          name: 'Preview Stillness',
          primaryMetrics: ['duration'],
          compatibleUnits: ['minutes'],
        }),
        activityKind: 'wellness',
        metric: 'duration',
        targetValue: '5',
        unit: 'minutes',
      }),
    ],
  }));
  check('3: streak required days', payload.required_consecutive_days === 5);
  check('3: streak carries every daily activity', payload.activities.length === 2);
  check('3: streak omits goal fields', payload.goal_value === undefined && payload.goal_unit === undefined);
}

// 4. Unpublished Knowledge cannot establish a Challenge.
{
  for (const lifecycle of ['draft', 'retired'] as const) {
    const problem = validateEstablishForm(form({ activities: [row({ knowledge: knowledgeItem({ lifecycle }) })] }));
    check(`4: ${lifecycle} knowledge rejected`, problem !== null);
  }
  expectThrow('4: unpublished knowledge throws on build', () =>
    buildCreationPayload(form({ activities: [row({ knowledge: knowledgeItem({ lifecycle: 'draft' }) })] })));
}

// 5. Incompatible Metric/Unit tuples cannot establish a Challenge.
{
  check('5: unpermitted metric rejected',
    validateEstablishForm(form({ activities: [row({ metric: 'distance' })] })) !== null);
  check('5: incompatible unit rejected',
    validateEstablishForm(form({ activities: [row({ unit: 'minutes' })] })) !== null);
  check('5: unit/metric mismatch rejected',
    validateEstablishForm(form({
      activities: [row({
        knowledge: knowledgeItem({ primaryMetrics: ['repetitions', 'duration'], compatibleUnits: ['reps', 'minutes'] }),
        metric: 'repetitions',
        unit: 'minutes',
      })],
    })) !== null);
  check('5: permitted tuples enumerate from the item contract',
    permittedMetrics(knowledgeItem()).join(',') === 'repetitions');
}

// 6. Group Challenge-creation authority failure surfaces cleanly.
{
  const establishCode = strip(read('src/features/Challenges/V2EstablishScreen.tsx'));
  check('6: server rejection renders in the form',
    establishCode.includes('setFormError(message)') && establishCode.includes('formError &&'));
  check('6: establishment posts only to the governed route',
    establishCode.includes('useV2CreateChallenge()')
    && establishCode.includes('buildCreationPayload(form)')
    && (establishCode.match(/\/v1\/challenges/g) ?? []).length === 0);
  const createApiCode = strip(read('src/api/v2ChallengeApi.ts'));
  check('6: create client targets POST /v1/challenges',
    createApiCode.includes("apiFetch<V2CreateChallengeResponse>('/v1/challenges', {")
    && createApiCode.includes("method: 'POST'"));
  check('6: group required before send',
    validateEstablishForm(form({ groupId: '' })) !== null);
}

console.log('EBC-05 preview guards — participation');

const detailCode = strip(read('src/features/Challenges/V2ChallengeDetailScreen.tsx'));

// 7. Group Member is not automatically a Challenge participant.
check('7: join offered only when there is no participation',
  detailCode.includes('!participation && detail.status'));
check('7: no auto-join effect on mount',
  !/useEffect\(\(\) => \{[^}]*join/m.test(detailCode));

// 8. Eligible member can join via the governed route.
check('8: join calls the V2 join route', detailCode.includes('join.mutateAsync(id)'));

// 9. Non-member/invalid join is a server decision surfaced to the member.
check('9: join failure surfaces mapped error',
  detailCode.includes('mapV2ApiError(error).message'));

// 10. Withdrawal behavior preserved (episode closes, history kept).
check('10: withdraw calls the V2 withdraw route', detailCode.includes('withdraw.mutateAsync(id)'));

console.log('EBC-05 preview guards — submission');

const hooksCode = strip(read('src/hooks/useV2Challenges.ts'));

// 11. UI V2 log uses only the V2 submission path.
check('11: log mutation calls the V2 activity route',
  hooksCode.includes('logChallengeActivityV2(variables.challengeId, variables.payload)'));

// 12. No fallback/dual write on V2 failure.
for (const rel of [
  'src/features/Challenges/V2ChallengeDetailScreen.tsx',
  'src/features/Challenges/V2EstablishScreen.tsx',
  'src/features/Challenges/V2GroupsScreen.tsx',
  'src/hooks/useV2Challenges.ts',
]) {
  const code = strip(read(rel));
  check(`12: no Firestore writes in ${rel.split('/').pop()}`,
    !/addDoc|setDoc|updateDoc|deleteDoc|writeBatch|runTransaction/.test(code));
}
check('12: no V1 fallback strings in V2 responses',
  !/fallback|legacyWrite|dualWrite/i.test(hooksCode));

// 13. Accepted submission refreshes derived truth.
check('13: accepted log invalidates detail truth',
  hooksCode.includes("invalidateQueries({ queryKey: ['v2-challenge', result.challengeId] })"));
check('13: accepted log invalidates list + leaderboard',
  hooksCode.includes("invalidateQueries({ queryKey: ['v2-challenges'] })")
  && hooksCode.includes("invalidateQueries({ queryKey: ['v2-leaderboard', result.challengeId] })"));

console.log('EBC-05 preview guards — display');

// 14. Collective overshoot displays the actual total.
check('14: collective total text keeps the actual value',
  detailCode.includes('detail.collectiveTotal.toLocaleString()'));
check('14: only the bar clamps at 100%',
  detailCode.includes('Math.min(goalPct, 100)'));

// 15. Competitive standard ranking displays server positions.
check('15: leaderboard renders server position',
  detailCode.includes('entry.position'));

// 16. Streak Current/Best/Days Completed display.
check('16: streak live values displayed',
  detailCode.includes('progress.currentStreak')
  && detailCode.includes('progress.bestStreak')
  && detailCode.includes('progress.daysCompleted'));

// 17. Finalized Competitive frozen rank displayed.
check('17: frozen final rank displayed',
  detailCode.includes('progress.finalPosition') && detailCode.includes('final rank #'));

// 18. Finalized Streak finalStreak displayed.
check('18: frozen final streak displayed',
  detailCode.includes('progress.finalStreak') && detailCode.includes('final streak'));

// 19. Ended/finalized state visible.
check('19: ended-awaiting-finalization banner',
  detailCode.includes('awaiting finalization'));
check('19: finalized frozen-history banner',
  detailCode.includes('frozen history'));
check('19: governing timezone displayed',
  detailCode.includes('detail.timezone'));

console.log('EBC-05 preview guards — local preview tooling');

// 20. Bootstrap/reset deterministic and local-only.
{
  const seedCode = strip(read('api/src/previewSeedCli.ts'));
  check('20: seed refuses non-localhost DATABASE_URL',
    seedCode.includes('refusing to run against non-localhost host'));
  check('20: seed dry-runs without --apply',
    seedCode.includes('--apply'));
  check('20: reset never touches schema_migrations',
    !seedCode.includes('schema_migrations'));
  check('20: reset covers finals + derived + records',
    seedCode.includes('challenge_participation_finals')
    && seedCode.includes('challenge_participation_derived')
    && seedCode.includes('challenge_activity_records'));
  check('20: bounded preview knowledge set',
    seedCode.includes('Preview Push-Up') && seedCode.includes('Preview Water'));
}

if (failures > 0) {
  console.error(`\nEBC-05 preview guards: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nEBC-05 preview guards: all passing.');
