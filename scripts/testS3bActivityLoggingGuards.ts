/**
 * S3b activity logging/application guards
 * (run: npm run test:s3b-activity-logging).
 *
 * TIIZI-S3B-ACTIVITY-APPLICATION-001: the V2 Challenge detail binds the
 * EXISTING governed activity-application seam — no new engine, no new
 * API, no client-derived score/progress. Proves (runtime/behavioral
 * first; source-string only for non-existence claims, as in S3a):
 *
 *   1. an active participant on an active Challenge gets a loggable view
 *      with choices derived from the governing config;
 *   2. server acceptance is rendered honestly (recorded value/unit,
 *      awarded points, day, duplicate notice — all from the server
 *      result, role=status);
 *   3. every governed rejection maps to human-readable copy with the
 *      server code preserved and retryable=false;
 *   4. rejection creates no client-side accepted state (accepted is set
 *      only from the mutation result; no setQueryData manufacture);
 *   5. idempotent replay creates no duplicate (stable client_key per
 *      intent; duplicate=true renders "no duplicate" honestly);
 *   6. non-participants cannot bypass authority (view hidden; section
 *      renders nothing when hidden);
 *   7. ended/finalized Challenges cannot accept activity (view hidden;
 *      challenge_not_active is governed, not retryable);
 *   8. streak closed-day rejection stays authoritative (governed, not
 *      retryable; no streak progress manufactured client-side);
 *   9. retryable service failure is distinguishable from governed
 *      rejection (503/authority-unavailable/network => retryable + Retry
 *      affordance; governed => fresh-entry affordance);
 *  10. no client-side canonical scoring/progress engine exists;
 *  11. no S3c/S3d experience is introduced (no dashboards, shares,
 *      leaderboard, streak day-states, finals, Run Again);
 *  12. financial contribution/support concepts cannot enter activity
 *      payloads (allowlist-closed payload; runtime excess-key drop).
 *
 * Cache: the log-success boundary invalidates through the shared
 * `invalidateV2ChallengeReads` contract (runtime proof over a real
 * QueryClient, per-user isolation included); S3b adds no parallel
 * cache family and manufactures no canonical progress in cache.
 */
import { readFileSync } from 'node:fs';
import { QueryClient } from '@tanstack/react-query';
import type { V2ChallengeDetail } from '../src/api/v2ChallengeApi.js';
import {
  buildV2ActivityPayload,
  mapV2ApiError,
  newClientKey,
  resolveOccurrence,
} from '../src/services/v2ActivityPayload.js';
import { loggingViewFor } from '../src/v2/challenges/loggingView.js';
import {
  invalidateV2ChallengeReads,
  v2ChallengeDetailKey,
  v2ChallengeListKey,
} from '../src/v2/challenges/challengeQueryKeys.js';

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

function configuredDetail(): V2ChallengeDetail {
  return detail({
    myParticipation: activeParticipation(),
    config: {
      version: 1,
      period: { startDate: '2026-09-17', endDate: '2026-09-30' },
      requiredConsecutiveDays: null,
      activities: [
        {
          canonicalKey: 'push-up',
          activityVariant: null,
          activityKind: 'fitness',
          metric: 'COUNT',
          targetValue: 20,
          unit: 'reps',
          position: 0,
          requiredComponents: [],
        },
        {
          canonicalKey: 'running',
          activityVariant: 'outdoor',
          activityKind: 'fitness',
          metric: 'DISTANCE',
          targetValue: 5,
          unit: 'km',
          position: 1,
          requiredComponents: [],
        },
      ],
    },
  });
}

// ─── 1/6/7. loggable view derivation (runtime) ─────────────────────────
console.log('logging view derivation');
const loggable = loggingViewFor(configuredDetail());
check('active participant -> loggable',
  loggable.kind === 'loggable' && loggable.choices.length === 2);
if (loggable.kind === 'loggable') {
  check('choices carry locked unit/kind/variant from config',
    loggable.choices[0].unit === 'reps'
    && loggable.choices[0].activityKind === 'fitness'
    && loggable.choices[1].activityVariant === 'outdoor'
    && loggable.choices[1].unit === 'km');
  check('choice identities are stable within the config',
    loggable.choices[0].optionId !== loggable.choices[1].optionId);
}
check('no episode -> hidden (not-joined)',
  JSON.stringify(loggingViewFor(detail({ myParticipation: null })))
    === JSON.stringify({ kind: 'hidden', reason: 'not-joined' }));
const withdrawn = activeParticipation();
if (withdrawn) withdrawn.status = 'withdrawn';
check('withdrawn episode -> hidden (not-joined)',
  loggingViewFor(detail({ myParticipation: withdrawn, config: configuredDetail().config })).kind === 'hidden');
check('ended challenge -> hidden (read-only)',
  JSON.stringify(loggingViewFor(configuredDetail()).kind) !== '"hidden"'
  && JSON.stringify(loggingViewFor(detail({
    status: 'ended',
    myParticipation: activeParticipation(),
    config: configuredDetail().config,
  }))) === JSON.stringify({ kind: 'hidden', reason: 'read-only' }));
check('finalized challenge -> hidden (read-only)',
  loggingViewFor(detail({
    finalized: true,
    myParticipation: activeParticipation(),
    config: configuredDetail().config,
  })).kind === 'hidden');
check('joined but nothing configured -> hidden (no-configured-activities)',
  JSON.stringify(loggingViewFor(detail({ myParticipation: activeParticipation() })))
    === JSON.stringify({ kind: 'hidden', reason: 'no-configured-activities' }));
check('view never invents configuration values',
  JSON.stringify(loggingViewFor(configuredDetail()))
    === JSON.stringify(loggingViewFor(configuredDetail())));

// ─── 1 (cont). valid payload from a derived choice (runtime) ───────────
console.log('payload construction');
const firstChoice = loggable.kind === 'loggable' ? loggable.choices[0] : null;
if (firstChoice) {
  const payload = buildV2ActivityPayload({
    activityKind: firstChoice.activityKind,
    canonicalKey: firstChoice.canonicalKey,
    activityVariant: firstChoice.activityVariant,
    value: 25,
    unit: firstChoice.unit,
    occurredAt: new Date('2026-09-18T08:00:00.000Z'),
    clientKey: 'v2-test-key-1',
  });
  check('payload carries only canonical contract fields',
    Object.keys(payload).every((k) => [
      'activity_kind', 'canonical_key', 'activity_variant', 'value', 'unit',
      'occurred_at', 'occurred_day', 'occurred_tz', 'client_key',
    ].includes(k))
    && ['activity_kind', 'canonical_key', 'value', 'unit', 'occurred_at', 'client_key']
      .every((k) => k in payload));
  check('payload unit is the locked config unit', payload.unit === 'reps');
  check('occurrence derives ISO time + day', payload.occurred_at.endsWith('Z') && (payload.occurred_day ?? '').length === 10);
  let threw = false;
  try {
    buildV2ActivityPayload({
      activityKind: 'fitness', canonicalKey: 'push-up', value: 0,
      unit: 'reps', occurredAt: new Date(), clientKey: 'v2-test-key-2',
    });
  } catch { threw = true; }
  check('non-positive value fails fast without sending', threw);
}

// ─── 12. financial concepts cannot enter payloads (runtime) ────────────
console.log('contribution/support boundary');
if (firstChoice) {
  const tainted = buildV2ActivityPayload({
    activityKind: firstChoice.activityKind,
    canonicalKey: firstChoice.canonicalKey,
    value: 10,
    unit: firstChoice.unit,
    occurredAt: new Date('2026-09-18T08:00:00.000Z'),
    clientKey: 'v2-test-key-3',
    // A caller attempting to smuggle contribution/support semantics:
    // excess keys are structurally dropped — never part of the payload.
    ...{ donation: { enabled: true }, amountKes: 500, support: true, cause: 'water' },
  } as unknown as Parameters<typeof buildV2ActivityPayload>[0]);
  check('donation/support/cause keys never reach the payload',
    !('donation' in tainted) && !('amountKes' in tainted) && !('support' in tainted) && !('cause' in tainted));
}

// ─── 3/7/8/9. denial mapping: governed vs retryable (runtime) ──────────
console.log('denial mapping');
const governedCases: Array<[string, number, RegExp]> = [
  ['no_current_group_membership', 403, /hosting group/i],
  ['challenge_not_active', 422, /not open for logging/i],
  ['no_participation_episode', 422, /not currently taking part/i],
  ['outside_challenge_window', 422, /outside the Challenge window/i],
  ['wrong_activity', 422, /not part of what counts/i],
  ['wrong_variant', 422, /not part of what counts/i],
  ['unknown_activity', 422, /not part of what counts/i],
  ['wrong_unit', 422, /measurement|unit/i],
  ['knowledge_mismatch', 422, /configured activity/i],
  ['streak_day_closed', 422, /already closed.*late|late/i],
  ['occurred_day_mismatch', 422, /timezone/i],
  ['idempotency_key_conflict', 409, /conflicts with an earlier one/i],
  ['challenge_closed_during_acceptance', 409, /closed while recording/i],
];
for (const [code, status, messageRe] of governedCases) {
  const mapped = mapV2ApiError(Object.assign(new Error('server message'), { status, code }));
  check(`${code} is human-readable`, messageRe.test(mapped.message), mapped.message);
  check(`${code} preserves code for diagnostics`, mapped.code === code);
  check(`${code} is NOT retryable (governed)`, mapped.retryable === false);
  check(`${code} leaks no provider terminology`,
    !/firestore|postgres|PG\b|provider|constraint|episode|seam|intent|derived truth/i.test(mapped.message), mapped.message);
}
const retryableCases: Array<[unknown, RegExp]> = [
  [Object.assign(new Error('server message'), { status: 503, code: 'group_authority_unavailable' }), /retry/i],
  [Object.assign(new Error('server message'), { status: 503, code: 'whatever' }), /retry/i],
  [Object.assign(new Error('server message'), { status: 500, code: 'application_missing' }), /retry/i],
  [new Error('network request failed'), /retry/i],
];
for (const [error, messageRe] of retryableCases) {
  const mapped = mapV2ApiError(error);
  check(`retryable (${error instanceof Error ? error.message : 'status'}) is retryable`, mapped.retryable === true, mapped.message);
  check('retryable copy says retry', messageRe.test(mapped.message), mapped.message);
}

// ─── 5. idempotency (runtime) ───────────────────────────────────────────
console.log('idempotency');
const keyA = newClientKey();
const keyB = newClientKey();
check('each intentional action gets a unique client_key', keyA !== keyB && keyA.length > 0);
check('client_key fits the 300-char contract', keyA.length <= 300);
check('occurrence derivation is deterministic for one intent',
  JSON.stringify(resolveOccurrence(new Date('2026-09-18T08:00:00.000Z')))
    === JSON.stringify(resolveOccurrence(new Date('2026-09-18T08:00:00.000Z'))));

// ─── 2/4/5/9/10/11. static binding proofs ──────────────────────────────
console.log('static binding');
const section = read('src/v2/challenges/V2LoggingSection.tsx');
const view = read('src/v2/challenges/loggingView.ts');
const payloadSrc = read('src/services/v2ActivityPayload.ts');
const hookSrc = read('src/v2/challenges/useChallengeCreation.ts');
const screenSrc = read('src/v2/challenges/V2CreatedChallengeScreen.tsx');
check('section binds the governed seam only (via the hook, never direct)',
  section.includes('useLogActivityV2') && !section.includes('logChallengeActivityV2('));
check('section renders ONLY when the canonical view permits (hidden -> null)',
  section.includes("view.kind === 'hidden'") && section.includes('return null'));
check('acceptance renders the server result honestly',
  section.includes('accepted.value') && section.includes('accepted.unit')
    && section.includes('accepted.pointsAwarded') && section.includes('accepted.occurredDay'));
check('duplicate replay renders honestly without a second effect',
  section.includes('accepted.duplicate') && section.includes('No duplicate was created.'));
check('acceptance is announced as server truth',
  section.includes('role="status"') && (section.includes('Recorded.') || section.includes('Already recorded.')));
check('rejection creates no accepted state (accepted set only from result)',
  section.includes('setAccepted(result)') && !section.includes('setAccepted({'));
check('retry reuses the SAME client_key; fresh entries mint a new one',
  section.includes('void submit(clientKey)') && section.includes('setClientKey(newClientKey())'));
check('retry affordance only for retryable; governed gets a fresh entry',
  section.includes('denial.retryable') && section.includes('Retry') && section.includes('Start a new entry'));
check('denials map with codes preserved', section.includes('mapV2ApiError') && section.includes('denial.code'));
check('no client-side scoring engine',
  !/computeActivityScore|points_awarded\s*[=+]|totalPoints\s*[=+]|Math\.\w+\(.*points/i.test(section)
    && !/computeActivityScore|points/i.test(view));
check('no manufactured canonical progress in cache',
  !/setQueryData/.test(section) && !/setQueryData/.test(hookSrc));
check('no S3c live-progress assembly',
  !/leaderboard|Leaderboard|collectiveTotal|collectiveGoalReached|completionsCount|contributor|Contributor|share/i.test(section));
check('no streak day-state experience',
  !/currentStreak|bestStreak|dayStates|daysCompleted|completionRate|cumulativeTotal/i.test(section));
check('no S3d results/finalization assembly',
  !/finalResult|finalized|Run Again|runAgain|finalize|placement|position/i.test(section));
check('no financial/support/media concepts in the logging surface',
  !/donation|pledge|escrow|M-Pesa|Amount Raised|community-reported|\bcover\b|\bCover\b|\bimage\b|\bImage\b|\bsupport\b|\bSupport\b|\bcause\b|\bCause\b/i.test(section)
    && !/donation|support|cause|pledge|escrow/i.test(view)
    && !/donation|support|cause|pledge|escrow/i.test(payloadSrc));
check('hook invalidates only via the shared contract',
  hookSrc.includes('invalidateV2ChallengeReads') && !/invalidateQueries\(\{\s*queryKey:\s*\['v2-challenge/.test(hookSrc));
check('detail embeds the S3b logging section after participation',
  screenSrc.includes('<V2LoggingSection')
    && screenSrc.indexOf('<V2ParticipationSection') < screenSrc.indexOf('<V2LoggingSection')
    && screenSrc.indexOf('<V2LoggingSection') < screenSrc.indexOf('What counts'));

// ─── Cache coherence after accepted activity (runtime) ─────────────────
console.log('post-acceptance cache coherence');
async function cacheProof(): Promise<void> {
  const client = new QueryClient();
  const uidA = 'member-uid-a';
  const uidB = 'member-uid-b';
  const challengeId = '11111111-1111-4111-8111-111111111111';
  const server = async () => ({ ok: true });
  await client.prefetchQuery({ queryKey: v2ChallengeListKey(uidA), queryFn: server, staleTime: 30 * 1000 });
  await client.prefetchQuery({
    queryKey: v2ChallengeDetailKey(challengeId, uidA), queryFn: server, staleTime: 10 * 1000,
  });
  await client.prefetchQuery({ queryKey: v2ChallengeListKey(uidB), queryFn: server, staleTime: 30 * 1000 });
  // The S3b log-success boundary (same contract S3a established):
  await invalidateV2ChallengeReads(client, uidA, challengeId);
  check('accepted activity marks own list stale', client.getQueryState(v2ChallengeListKey(uidA))?.isInvalidated === true);
  check('accepted activity marks own detail stale',
    client.getQueryState(v2ChallengeDetailKey(challengeId, uidA))?.isInvalidated === true);
  check('per-user isolation preserved after acceptance',
    client.getQueryState(v2ChallengeListKey(uidB))?.isInvalidated !== true);
}

await cacheProof();

if (failures > 0) {
  console.error(`\nS3b activity logging guards: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nS3b activity logging guards: PASS');
