/**
 * S3a participation/access experience guards
 * (run: npm run test:s3a-participation-experience).
 *
 * TIIZI-S3A-PARTICIPATION-ACCESS-001: the V2 Challenge list/detail binds
 * the EXISTING governed participation seams — no new engine, no new API,
 * no client-derived participation state. Proves:
 *
 *   A. participation view derives ONLY from the authoritative read
 *      (`myParticipation.status`, `status`, `finalized`) via the pure
 *      `participationViewFor` (joined / not-joined / read-only);
 *   B. rejoin uses the SAME join seam (no special rejoin semantics);
 *   C. withdraw is bounded behind an explicit confirmation;
 *   D. every governed denial maps to human-readable copy with the server
 *      code preserved for diagnostics;
 *   E. list + detail bind `myParticipation` directly (never inferred);
 *   F. no S3b/S3c/S3d leakage (logging, leaderboard, progress/streak
 *      dashboards, results, Run Again) in the S3a touch-points;
 *   G. V2 boundary holds for the new S3a modules.
 */
import { readFileSync } from 'node:fs';
import { participationViewFor } from '../src/v2/challenges/participationView.js';
import { mapV2ApiError } from '../src/services/v2ActivityPayload.js';
import type { V2ChallengeDetail } from '../src/api/v2ChallengeApi.js';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function detail(overrides: Partial<V2ChallengeDetail>): V2ChallengeDetail {
  return {
    challengeId: '11111111-1111-4111-8111-111111111111',
    groupId: '22222222-2222-4222-8222-222222222222',
    title: 'Test Challenge',
    description: '',
    challengeType: 'collective',
    status: 'active',
    startDate: '2026-09-17',
    endDate: '2026-09-30',
    timezone: 'Africa/Nairobi',
    finalized: false,
    currentConfigVersion: 1,
    goalValue: null,
    goalUnit: null,
    collectiveTotal: 0,
    collectiveGoalReached: false,
    completionsCount: 0,
    myParticipation: null,
    instructions: '',
    activatedAt: null,
    endedAt: null,
    config: {
      version: 1,
      period: { startDate: '2026-09-17', endDate: '2026-09-30' },
      requiredConsecutiveDays: null,
      activities: [],
    },
    ...overrides,
  } as V2ChallengeDetail;
}

function activeParticipation(): V2ChallengeDetail['myParticipation'] {
  return {
    participationId: '33333333-3333-4333-8333-333333333333',
    status: 'active',
    joinedAt: '2026-09-18T00:00:00.000Z',
    joinedConfigVersion: 1,
    progress: {},
  } as V2ChallengeDetail['myParticipation'];
}

// ─── A. authoritative view derivation ────────────────────────────────────
console.log('participation view derivation');
check('active episode -> joined',
  participationViewFor(detail({ myParticipation: activeParticipation() })).kind === 'joined');
check('no episode -> not-joined (fresh)',
  JSON.stringify(participationViewFor(detail({ myParticipation: null })))
    === JSON.stringify({ kind: 'not-joined', previouslyEnded: false }));
const withdrawn = activeParticipation();
if (withdrawn) withdrawn.status = 'withdrawn';
check('withdrawn episode -> not-joined (previously ended)',
  JSON.stringify(participationViewFor(detail({ myParticipation: withdrawn })))
    === JSON.stringify({ kind: 'not-joined', previouslyEnded: true }));
const removed = activeParticipation();
if (removed) removed.status = 'removed';
check('removed episode -> not-joined (previously ended)',
  participationViewFor(detail({ myParticipation: removed })).kind === 'not-joined');
check('ended challenge -> read-only even with active episode',
  JSON.stringify(participationViewFor(detail({ status: 'ended', myParticipation: activeParticipation() })))
    === JSON.stringify({ kind: 'read-only', reason: 'ended' }));
check('finalized challenge -> read-only',
  participationViewFor(detail({ finalized: true })).kind === 'read-only');

// ─── D. governed denial mapping ──────────────────────────────────────────
console.log('denial mapping');
const denialCases: Array<[string, number, RegExp, boolean]> = [
  ['no_group_membership', 403, /hosting group/i, false],
  ['challenge_ended', 422, /ended.*closed|closed.*ended/i, false],
  ['participation_exists', 409, /already taking part/i, false],
  ['no_active_participation', 404, /not currently taking part/i, false],
  ['participation_closed', 409, /already closed/i, false],
  ['group_authority_unavailable', 503, /retry/i, true],
  ['unknown_challenge', 404, /no longer available/i, false],
];
for (const [code, status, messageRe, retryable] of denialCases) {
  // ApiError shape ({ status, code }) without importing the Firebase-bound
  // transport — asApiFailure only reads these two fields.
  const mapped = mapV2ApiError(Object.assign(new Error('server message'), { status, code }));
  check(`${code} is human-readable`, messageRe.test(mapped.message), mapped.message);
  check(`${code} preserves code for diagnostics`, mapped.code === code);
  check(`${code} retryable=${retryable}`, mapped.retryable === retryable);
  check(`${code} leaks no provider terminology`,
    !/firestore|postgres|PG\b|provider|constraint|episode|seam/i.test(mapped.message), mapped.message);
}

// ─── B/C/E/F/G. static binding proofs ────────────────────────────────────
console.log('static binding');
const section = read('src/v2/challenges/V2ParticipationSection.tsx');
check('join binds the governed seam', section.includes('useJoinChallengeV2'));
check('withdraw binds the governed seam', section.includes('useWithdrawChallengeV2'));
check('rejoin is the same join seam (Join again, no rejoin endpoint)',
  section.includes('Join again') && !/rejoinChallenge|POST.*rejoin|\/rejoin/i.test(section));
check('withdraw is bounded behind confirmation',
  section.includes('Leave this Challenge?') && section.includes('V2Sheet'));
check('state derives only from the authoritative read',
  section.includes('detail.myParticipation') && !/useState<[^>]*Participation|setParticipation/i.test(section));
check('denials map with codes preserved', section.includes('mapV2ApiError') && section.includes('notice.code'));
check('no S3b logging seam', !/logChallengeActivityV2|useV2LogActivity|\/activity/.test(section));
check('no S3c/S3d seams', !/leaderboard|Leaderboard|progress\.|streak|Streak|finalResult|Run Again|runAgain/i.test(section));
check('no V1 experience imports', !/from '\.\.\/\.\.\/features\//.test(section));

const list = read('src/v2/challenges/V2ChallengeListScreen.tsx');
check('list binds myParticipation directly', list.includes('myParticipation'));
check('list never invents participation', !/useState<[^>]*articipat/i.test(list));

const createdScreen = read('src/v2/challenges/V2CreatedChallengeScreen.tsx');
check('detail embeds the S3a participation section', createdScreen.includes('V2ParticipationSection'));
check('detail states host group + participation truth',
  createdScreen.includes('participationSentence')
    && (createdScreen.includes('Hosted by')
      || (createdScreen.includes('<V2ChallengeHero')
        && read('src/v2/challenges/V2ChallengeHero.tsx').includes('Hosted by'))));

if (failures > 0) {
  console.error(`\nS3a participation experience guards: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nS3a participation experience guards: PASS');
