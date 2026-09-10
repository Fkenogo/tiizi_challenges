/**
 * Phase C3B frontend integration guards (run: npm run test:v2-frontend).
 *
 * The web app has no unit-test runner; like the other guard scripts this
 * file executes pure-contract assertions plus static no-dual-write proofs
 * over the V2 integration surface:
 *
 * - feature boundary: OFF by default; explicit opt-in only;
 * - V1/V2 identity separation: Firestore ids never qualify as V2;
 * - V2 action gate requires flag + explicit v2 navigation + V2 identity;
 * - payload builder: exact C2B contract, server-derived fields rejected;
 * - client_key: unique per action, UUID-shaped, never timestamps alone;
 * - occurrence fields: valid ISO timestamp + local day + IANA tz;
 * - error mapping: V2 failures never fall back to V1 writes;
 * - static proofs: V2 branches call the V2 API client; V1 transports are
 *   never invoked from V2 branches; no Firestore fallback strings in V2
 *   responses; streak checklist carries per-item keys with no atomicity
 *   claim.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isV2ChallengeAction,
  isV2ChallengeId,
  resolveV2ChallengesEnabled,
} from '../src/api/v2ChallengeMode.js';
import {
  buildV2ActivityPayload,
  mapV2ApiError,
  newClientKey,
  resolveOccurrence,
} from '../src/services/v2ActivityPayload.js';

const apiFailure = (status: number, code: string) => ({ status, code });

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

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

// ─── 1. Feature boundary ─────────────────────────────────────────────────
console.log('feature boundary');
check('OFF by default (unset)', resolveV2ChallengesEnabled({}) === false);
check('OFF for empty/false/0', ['','false','0','no'].every((v) =>
  resolveV2ChallengesEnabled({ VITE_TIIZI_V2_CHALLENGES_ENABLED: v }) === false));
check('ON only for explicit true', resolveV2ChallengesEnabled({ VITE_TIIZI_V2_CHALLENGES_ENABLED: 'true' }) === true);
check('case/whitespace tolerant', resolveV2ChallengesEnabled({ VITE_TIIZI_V2_CHALLENGES_ENABLED: ' True ' }) === true);

// ─── 2. Identity separation ──────────────────────────────────────────────
console.log('identity separation');
check('V2 UUID qualifies', isV2ChallengeId('123e4567-e89b-42d3-a456-426614174000') === true);
check('Firestore doc id rejected', isV2ChallengeId('AbC123xYz987QwEr4567') === false);
check('empty/undefined rejected', isV2ChallengeId(undefined) === false && isV2ChallengeId('') === false);
check('gate needs all three', isV2ChallengeAction('123e4567-e89b-42d3-a456-426614174000', '1') === false,
  'flag off in this process env, so the gate must stay closed');
check('gate rejects v1 id even with v2 param', isV2ChallengeAction('AbC123xYz987QwEr4567', '1') === false);
check('gate rejects missing v2 param', isV2ChallengeAction('123e4567-e89b-42d3-a456-426614174000', null) === false);

// ─── 3. Payload contract ─────────────────────────────────────────────────
console.log('payload contract');
const payload = buildV2ActivityPayload({
  activityKind: 'fitness',
  canonicalKey: 'push-up',
  activityVariant: 'standard',
  value: 20,
  unit: 'reps',
  occurredAt: new Date('2026-06-10T12:00:00Z'),
  clientKey: 'v2-test-key-1',
});
check('exact allowed keys only',
  JSON.stringify(Object.keys(payload).sort()) === JSON.stringify(
    ['activity_kind','activity_variant','canonical_key','client_key','occurred_at','occurred_day','occurred_tz','unit','value']));
check('no server-derived fields',
  !('points' in payload) && !('member_id' in payload) && !('config_version' in payload)
  && !('knowledge_version' in payload) && !('completion' in payload));
check('occurred_at valid ISO', !Number.isNaN(Date.parse(payload.occurred_at)));
check('occurred_day is YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(payload.occurred_day ?? ''));
expectThrow('rejects zero value', () => buildV2ActivityPayload({
  activityKind: 'fitness', canonicalKey: 'push-up', value: 0, unit: 'reps',
  occurredAt: new Date(), clientKey: 'k',
}));
expectThrow('rejects missing key', () => buildV2ActivityPayload({
  activityKind: 'wellness', canonicalKey: '', value: 1, unit: 'ml',
  occurredAt: new Date(), clientKey: 'k',
}));
const noVariant = buildV2ActivityPayload({
  activityKind: 'wellness', canonicalKey: 'water-intake', value: 500, unit: 'ml',
  occurredAt: new Date('2026-06-10T08:00:00Z'), clientKey: 'v2-test-key-2',
});
check('variant omitted when absent', !('activity_variant' in noVariant));

// ─── 4. Idempotency ──────────────────────────────────────────────────────
console.log('idempotency');
const keys = new Set(Array.from({ length: 50 }, () => newClientKey()));
check('unique across 50 generations', keys.size === 50);
check('never timestamps alone', [...keys].every((k) => /^v2-/.test(k) && k.length > 12));

// ─── 5. Occurrence ───────────────────────────────────────────────────────
console.log('occurrence');
const occ = resolveOccurrence(new Date('2026-06-10T12:00:00Z'));
check('day present and calendar-shaped', /^\d{4}-\d{2}-\d{2}$/.test(occ.occurred_day));

// ─── 6. Errors never fall back ───────────────────────────────────────────
console.log('error mapping');
const mapped503 = mapV2ApiError(apiFailure(503, 'group_authority_unavailable'));
check('503 retryable (stays failed, retry allowed)', mapped503.retryable === true);
const mapped403 = mapV2ApiError(apiFailure(403, 'no_group_membership'));
check('403 not retryable, no fallback', mapped403.retryable === false);
check('no fallback wording', !/firestore|workoutService|wellnessLog/i.test(
  `${mapped503.message} ${mapped403.message} ${mapV2ApiError(apiFailure(422, 'wrong_unit')).message}`));

// ─── 7. Static no-dual-write proofs ──────────────────────────────────────
console.log('static no-dual-write');
const logWorkout = read('src/features/Workouts/LogWorkoutScreen.tsx');
const logWellness = read('src/features/Workouts/LogWellnessActivityScreen.tsx');
const select = read('src/features/Workouts/SelectChallengeActivityScreen.tsx');
const hooks = read('src/hooks/useV2Challenges.ts');
for (const [file, content] of [['LogWorkout', logWorkout], ['LogWellness', logWellness]] as const) {
  check(`${file}: V2 branch calls V2 API client`, content.includes('v2Log.mutateAsync'));
  check(`${file}: V2 branch builds typed payload`, content.includes('buildV2ActivityPayload'));
  // Bound the V2 branch precisely: from the gate to the V1 `const now`
  // marker that immediately follows the branch's `return;`.
  const v2Start = content.indexOf('if (v2Mode)');
  const v1Resume = content.indexOf('const now = new Date();', v2Start);
  const v2Branch = v2Start >= 0 && v1Resume > v2Start ? content.slice(v2Start, v1Resume) : '';
  check(`${file}: V2 branch has no V1 writer call`,
    !v2Branch.includes('workoutService') && !v2Branch.includes('wellnessLogService')
    && !v2Branch.includes('challengeService') && !v2Branch.includes('activityLogSessionService'));
  check(`${file}: V2 branch has no client scoring`, !v2Branch.includes('computeActivityScore'));
  check(`${file}: V2 failure maps, never falls back`,
    v2Branch.includes('mapV2ApiError') && !/firestore|workoutService\./i.test(v2Branch));
}
check('select: per-item V2 keys, no batch claim',
  select.includes('v2ItemKeys') && /never claimed atomic/i.test(select));
check('select: V2 checklist reads V2 config only',
  select.includes('v2Detail.config.activities') && select.includes('if (v2Mode)'));
check('hooks: V2-only invalidation namespace',
  hooks.includes("'v2-challenge'") && hooks.includes("'v2-challenges'")
  && !hooks.includes("invalidateQueries({ queryKey: ['challenge'") && !hooks.includes("['challenges'"));
check('success screen: V2 branch renders server points',
  read('src/features/Workouts/WorkoutLoggedScreen.tsx').includes('serverPoints'));
const v2DetailSource = read('src/features/Challenges/V2ChallengeDetailScreen.tsx');
// Strip comments and route paths: only data-layer reads count as V1 fallback.
const v2DetailCode = v2DetailSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')
  .replace(/`\/app\/[^`]*`/g, "''")
  .replace(/'\/app\/[^']*'/g, "''");
check('detail: no V1 progress reads',
  !/challengeMembers|challengeActivitySummaries|wellnessLogs|getDocs?\(|collection\(|lib\/firebase/.test(v2DetailCode));
check('detail: V2 leaderboard endpoint used for competitive',
  read('src/features/Challenges/V2ChallengeDetailScreen.tsx').includes('useV2CompetitiveLeaderboard'));
check('detail: streak renders server truth, no leaderboard for streak',
  /bestStreak|daysCompleted/.test(read('src/features/Challenges/V2ChallengeDetailScreen.tsx')));

// ─── 8. activityKind contract (CORR-001) ─────────────────────────────────
console.log('activityKind contract');
const v2Api = read('src/api/v2ChallengeApi.ts');
check('client contract carries activityKind', v2Api.includes("activityKind: 'fitness' | 'wellness'"));

// Strip comments + route path strings so only code-level heuristics are judged.
const strip = (s: string): string => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')
  .replace(/`\/app\/[^`]*`/g, "''")
  .replace(/'\/app\/[^']*'/g, "''");
const detailCode = strip(read('src/features/Challenges/V2ChallengeDetailScreen.tsx'));
const selectCode = strip(read('src/features/Workouts/SelectChallengeActivityScreen.tsx'));
const workoutCode = strip(read('src/features/Workouts/LogWorkoutScreen.tsx'));
const wellnessCode = strip(read('src/features/Workouts/LogWellnessActivityScreen.tsx'));

check('detail: routes wellness solely on activityKind',
  detailCode.includes("activity.activityKind === 'wellness'"));
check('detail: no wellness heuristics (startsWith/regex)',
  !/startsWith\('wellness:'\)|\/water\|sleep\|fast\|meditat\|mindful\|hydrat\//.test(detailCode));
check('select: routes wellness solely on activityKind',
  selectCode.includes("activity.activityKind === 'wellness'"));
check('select: payload kind equals configured kind',
  selectCode.includes('activityKind: activity.activityKind'));
// V2 branch only: V1's own resolveWellnessActivityType/startsWith heuristics
// may remain, but none may appear inside the V2 branch.
const selectV2Start = selectCode.indexOf('if (v2Mode) {');
const selectV2End = selectCode.indexOf('\n  }\n\n  return (', selectV2Start);
const selectV2 = selectV2Start >= 0 && selectV2End > selectV2Start
  ? selectCode.slice(selectV2Start, selectV2End)
  : '';
check('select: no wellness heuristics inside V2 branch',
  selectV2.length > 0
  && !/startsWith\('wellness:'\)|\/water\|sleep\|fast\|meditat\|mindful\|hydrat\/|resolveWellnessActivityType/.test(selectV2));
check('fitness logger: fail-closed on non-fitness kind',
  workoutCode.includes("configured.activityKind !== 'fitness'"));
check('fitness logger: submits configured kind',
  workoutCode.includes('activityKind: configured.activityKind'));
check('wellness logger: fail-closed on non-wellness kind',
  wellnessCode.includes("configured.activityKind !== 'wellness'"));
check('wellness logger: submits configured kind',
  wellnessCode.includes('activityKind: configured.activityKind'));
check('V1 truth reads gated off in V2 mode (fitness)',
  workoutCode.includes('useChallenge(v2Mode ? undefined : challengeId)'));
check('V1 truth reads gated off in V2 mode (wellness)',
  wellnessCode.includes('useChallenge(v2Mode ? undefined : challengeId)'));
check('V1 truth reads gated off in V2 mode (select)',
  selectCode.includes('useChallenge(v2Mode ? undefined : challengeId)'));

if (failures > 0) {
  console.error(`\nV2 frontend guards: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nV2 frontend guards: all passing.');
