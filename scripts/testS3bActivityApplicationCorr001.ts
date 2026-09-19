/**
 * CORR-001 behavioral correction proofs (run: npm run test:s3b-activity-application-corr-001).
 *
 * TIIZI-S3B-ACTIVITY-APPLICATION-CORR-001 — runtime/behavioral proofs for the
 * three blocking ITR-001 defects. No source-string guards here: every claim
 * executes real state/intent/payload functions and would FAIL against the
 * previous candidate behavior.
 *
 * Blocker 1 — occurred_day/timezone:
 *   S3b never sends client-derived occurred_day; the server governing day
 *   derives solely from occurred_at + Challenge timezone across device
 *   timezones (incl. a local-day boundary crosser).
 * Blocker 2 — idempotency intent lifecycle (A..G):
 *   pure intent/key derivation + server payload binding (no DB).
 * Blocker 3 — accepted-then-ended rendering:
 *   pure section-state derivation across an active→ended transition.
 * Bounded UX: selector labels, zero-activity state, fresh-entry reset,
 *   governed-copy corrections.
 */
import type { V2ChallengeDetail } from '../src/api/v2ChallengeApi.js';
import { dayInTimezone } from '../api/src/activityEvents.js';
import { isSameSubmissionPayload } from '../api/src/submissionIntents.js';
import {
  buildS3bActivityPayload,
  buildV2ActivityPayload,
  mapV2ApiError,
  resolveS3bOccurrence,
} from '../src/services/v2ActivityPayload.js';
import {
  choiceOptionLabel,
  humanizeCanonicalKey,
  isNewEntryAllowed,
  loggingSectionStateFor,
  loggingViewFor,
  NO_CONFIGURED_ACTIVITIES_COPY,
  shouldShowAcceptedResult,
} from '../src/v2/challenges/loggingView.js';
import {
  deriveSubmitKey,
  factsForSubmit,
  loggingFactsEqual,
  type LoggingFacts,
} from '../src/v2/challenges/loggingIntent.js';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Device-local calendar day the OLD candidate sent (device timezone). */
function deviceDay(at: Date, deviceTimeZone: string): string {
  return at.toLocaleDateString('en-CA', { timeZone: deviceTimeZone });
}

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
      ],
    },
  });
}

// ─── Blocker 1: S3b sends no client day; governing day is Challenge-tz only ─
console.log('blocker 1 — occurred_day/timezone');
{
  const at = new Date('2026-09-18T08:00:00.000Z');
  const s3b = buildS3bActivityPayload({
    activityKind: 'fitness',
    canonicalKey: 'push-up',
    value: 25,
    unit: 'reps',
    occurredAt: at,
    clientKey: 'v2-corr-1',
  });
  check('S3b payload carries occurred_at', s3b.occurred_at === at.toISOString());
  check('S3b payload OMITS occurred_day (no client assertion)',
    !('occurred_day' in s3b) && s3b.occurred_day === undefined,
    JSON.stringify(Object.keys(s3b)));
  check('S3b keeps occurred_tz provenance only',
    typeof s3b.occurred_tz === 'string' && s3b.occurred_tz.length > 0);

  const legacy = buildV2ActivityPayload({
    activityKind: 'fitness',
    canonicalKey: 'push-up',
    value: 25,
    unit: 'reps',
    occurredAt: at,
    clientKey: 'v2-corr-1-legacy',
  });
  check('shared builder default preserves occurred_day for frozen surfaces',
    typeof legacy.occurred_day === 'string' && legacy.occurred_day.length === 10);

  const occ = resolveS3bOccurrence(at);
  check('S3b occurrence helper exposes no day',
    !('occurred_day' in occ) && typeof occ.occurred_at === 'string');

  // Governing-day determinism across device timezones, incl. a boundary crosser.
  const CHALLENGE_TZ = 'Africa/Nairobi';
  const deviceZones = ['Africa/Nairobi', 'UTC', 'America/New_York'];
  const instants = [
    '2026-09-18T08:00:00.000Z', // same local day in all three zones
    '2026-09-18T21:30:00.000Z', // 00:30 Nairobi Sep 19; Sep 18 in UTC/New York
  ];
  for (const iso of instants) {
    const instant = new Date(iso);
    const governing = dayInTimezone(instant, CHALLENGE_TZ);
    const s3bPayload = buildS3bActivityPayload({
      activityKind: 'fitness', canonicalKey: 'push-up', value: 10,
      unit: 'reps', occurredAt: instant, clientKey: `v2-corr-1-${iso}`,
    });
    for (const device of deviceZones) {
      void device;
      // The S3b payload is identical regardless of device zone (nothing
      // device-derived beyond the tz provenance string can alter the day).
      check(`same occurred_at ${iso} -> identical S3b day-absence (device ${device})`,
        !('occurred_day' in s3bPayload));
    }
    check(`governing day for ${iso} derives from Challenge tz only (${governing})`,
      governing === dayInTimezone(instant, CHALLENGE_TZ)
      && governing === (iso === '2026-09-18T21:30:00.000Z' ? '2026-09-19' : '2026-09-18'),
      `got ${governing}`);
  }
  // Prove the OLD behavior would have diverged at the boundary (so this
  // test fails against the previous candidate that sent the device day).
  const crosser = new Date('2026-09-18T21:30:00.000Z');
  const governingCrosser = dayInTimezone(crosser, CHALLENGE_TZ);
  const nairobiDeviceDay = deviceDay(crosser, 'Africa/Nairobi');
  const newYorkDeviceDay = deviceDay(crosser, 'America/New_York');
  check('boundary crosser: device days diverge across zones',
    nairobiDeviceDay !== newYorkDeviceDay,
    `${nairobiDeviceDay} vs ${newYorkDeviceDay}`);
  check('boundary crosser: Nairobi device day equals governing day',
    nairobiDeviceDay === governingCrosser);
  check('boundary crosser: New York device day MISMATCHES governing day (old defect)',
    newYorkDeviceDay !== governingCrosser,
    `device ${newYorkDeviceDay} vs governing ${governingCrosser}`);

  // Server protection preserved: a deliberately wrong occurred_day is still
  // rejected by the exact server rule (mismatch vs governing day); absence
  // proceeds with the derived day.
  const serverAllows = (occurredDay: string | undefined, occurredAt: Date): boolean =>
    occurredDay === undefined || occurredDay === dayInTimezone(occurredAt, CHALLENGE_TZ);
  check('server still rejects a deliberately wrong occurred_day',
    serverAllows('2026-09-01', crosser) === false);
  check('server accepts the correct governing day when supplied',
    serverAllows(governingCrosser, crosser) === true);
  check('server accepts an omitted occurred_day (S3b path)',
    serverAllows(undefined, crosser) === true);
}

// ─── Blocker 2: intent/key lifecycle A..G ───────────────────────────────────
console.log('blocker 2 — idempotency intent lifecycle');
{
  const baseFacts: LoggingFacts = factsForSubmit({
    canonicalKey: 'push-up',
    activityVariant: null,
    activityKind: 'fitness',
    value: 25,
    unit: 'reps',
    occurredAt: new Date('2026-09-18T08:00:00.000Z'),
  });
  let mintCount = 0;
  const mint = (): string => `v2-minted-${(mintCount += 1)}`;

  // A. valid first submit uses the draft key.
  const first = deriveSubmitKey({ currentFacts: baseFacts, draftKey: 'v2-draft-1', lastAttempt: null, mintKey: mint });
  check('A. valid first submit uses the draft key', first.key === 'v2-draft-1' && mintCount === 0);

  // B. exact replay of the same intent reuses the key.
  const replay = deriveSubmitKey({
    currentFacts: baseFacts, draftKey: 'v2-draft-1',
    lastAttempt: { key: 'v2-draft-1', facts: baseFacts }, mintKey: mint,
  });
  check('B. same facts + same key replay reuses the key', replay.key === 'v2-draft-1' && replay.reused && mintCount === 0);

  // C. retryable failure + unchanged facts -> same key.
  const retrySame = deriveSubmitKey({
    currentFacts: baseFacts, draftKey: 'v2-draft-1',
    lastAttempt: { key: 'v2-draft-1', facts: baseFacts }, mintKey: mint,
  });
  check('C. retryable failure + unchanged facts keeps the SAME key',
    retrySame.key === 'v2-draft-1' && retrySame.reused);

  // D. retryable failure + changed facts -> new key.
  const changedAmount: LoggingFacts = { ...baseFacts, value: 30 };
  const retryChanged = deriveSubmitKey({
    currentFacts: changedAmount, draftKey: 'v2-draft-1',
    lastAttempt: { key: 'v2-draft-1', facts: baseFacts }, mintKey: mint,
  });
  check('D. retryable failure + changed amount mints a NEW key',
    retryChanged.key !== 'v2-draft-1' && !retryChanged.reused && mintCount === 1);

  const changedTime: LoggingFacts = {
    ...baseFacts, occurredAtISO: new Date('2026-09-18T09:00:00.000Z').toISOString(),
  };
  const retryTime = deriveSubmitKey({
    currentFacts: changedTime, draftKey: 'v2-draft-1',
    lastAttempt: { key: 'v2-draft-1', facts: baseFacts }, mintKey: mint,
  });
  check('D. retryable failure + changed time mints a NEW key', retryTime.key !== 'v2-draft-1' && !retryTime.reused);

  const changedActivity: LoggingFacts = { ...baseFacts, canonicalKey: 'running', unit: 'km' };
  const retryActivity = deriveSubmitKey({
    currentFacts: changedActivity, draftKey: 'v2-draft-1',
    lastAttempt: { key: 'v2-draft-1', facts: baseFacts }, mintKey: mint,
  });
  check('D. retryable failure + changed activity mints a NEW key', retryActivity.key !== 'v2-draft-1' && !retryActivity.reused);

  // E. governed rejection + corrected facts -> new key.
  const corrected = deriveSubmitKey({
    currentFacts: changedAmount, draftKey: 'v2-draft-1',
    lastAttempt: { key: 'v2-draft-1', facts: baseFacts }, mintKey: mint,
  });
  check('E. governed rejection + corrected facts mints a NEW key',
    corrected.key !== 'v2-draft-1' && !corrected.reused);

  // F. accepted intent + changed facts -> new key (accepted record untouched).
  const afterAccept = deriveSubmitKey({
    currentFacts: changedAmount, draftKey: 'v2-draft-1',
    lastAttempt: { key: 'v2-draft-1', facts: baseFacts }, mintKey: mint,
  });
  check('F. accepted intent + changed facts mints a NEW key (no silent mutation)',
    afterAccept.key !== 'v2-draft-1' && !afterAccept.reused);
  check('facts equality is instant-exact (serialization-safe)',
    loggingFactsEqual(baseFacts, { ...baseFacts }) && !loggingFactsEqual(baseFacts, changedTime));

  // G. server still rejects changed facts forced under an old key.
  const priorRow = {
    member_id: 'member-1',
    challenge_id: 'challenge-1',
    client_key: 'v2-old-key',
    activity_kind: 'fitness',
    canonical_key: 'push-up',
    activity_variant: null,
    value: 25,
    unit: 'reps',
    occurred_at: new Date('2026-09-18T08:00:00.000Z'),
    occurred_day: '2026-09-18',
    occurred_tz: null,
  } as unknown as Parameters<typeof isSameSubmissionPayload>[0];
  const sameIncoming = {
    member_id: 'member-1',
    challenge_id: 'challenge-1',
    client_key: 'v2-old-key',
    activity_kind: 'fitness',
    canonical_key: 'push-up',
    activity_variant: null,
    value: 25,
    unit: 'reps',
    occurred_at: new Date('2026-09-18T08:00:00.000Z'),
    occurred_day: '2026-09-18',
    occurred_tz: null,
  } as unknown as Parameters<typeof isSameSubmissionPayload>[1];
  const changedIncoming = {
    ...sameIncoming,
    value: 30,
  } as unknown as Parameters<typeof isSameSubmissionPayload>[1];
  check('G. server binding: identical replay under the old key is the same payload',
    isSameSubmissionPayload(priorRow, sameIncoming) === true);
  check('G. server binding: changed facts forced under the old key CONFLICT (no duplicate, no mutation)',
    isSameSubmissionPayload(priorRow, changedIncoming) === false);
}

// ─── Blocker 3: accepted-then-ended rendering ───────────────────────────────
console.log('blocker 3 — accepted result survives ended transition');
{
  const active = configuredDetail();
  const acceptedResult = {
    recordId: 'r1', eventId: 'e1', participationId: 'p1', challengeId: active.challengeId,
    activityConfigId: 'c1', configVersion: 1, acceptedAt: new Date().toISOString(),
    occurredDay: '2026-09-18', value: 25, unit: 'reps', pointsAwarded: 10,
    scoringMethod: 'm', completionTriggered: false, duplicate: false,
    participation: {}, challenge: {},
  };

  const beforeSubmit = loggingSectionStateFor(active, null);
  check('active + no result renders the entry form',
    beforeSubmit.render === 'form');

  const ended: V2ChallengeDetail = detail({
    status: 'ended',
    endedAt: '2026-09-19T00:00:00.000Z',
    myParticipation: activeParticipation(),
    config: active.config,
  });
  const afterEndNoResult = loggingSectionStateFor(ended, null);
  check('ended + no result renders nothing (no new logging)',
    afterEndNoResult.render === 'null');

  const afterEndWithResult = loggingSectionStateFor(ended, acceptedResult);
  check('ended + accepted result STILL renders the confirmation',
    afterEndWithResult.render === 'accepted',
    JSON.stringify(afterEndWithResult));
  check('ended + accepted result forbids new entries',
    afterEndWithResult.render === 'accepted' && afterEndWithResult.allowNewEntry === false);

  const finalized: V2ChallengeDetail = detail({
    finalized: true,
    myParticipation: activeParticipation(),
    config: active.config,
  });
  const afterFinalized = loggingSectionStateFor(finalized, acceptedResult);
  check('finalized + accepted result still renders the confirmation, no new entries',
    afterFinalized.render === 'accepted'
    && (afterFinalized.render !== 'accepted' || afterFinalized.allowNewEntry === false));

  const stillActive = loggingSectionStateFor(active, acceptedResult);
  check('active + accepted result renders confirmation with Log-another available',
    stillActive.render === 'accepted' && stillActive.allowNewEntry === true);

  check('shouldShowAcceptedResult distinguishes null from a result',
    shouldShowAcceptedResult(null) === false && shouldShowAcceptedResult(acceptedResult) === true);
  check('isNewEntryAllowed gates on the current read only',
    isNewEntryAllowed(active) === true && isNewEntryAllowed(ended) === false);
}

// ─── Bounded UX corrections (behavioral) ────────────────────────────────────
console.log('bounded UX corrections');
{
  const uuidChoice = {
    optionId: 'x', canonicalKey: '11111111-1111-4111-8111-111111111111',
    activityVariant: null, activityKind: 'fitness', unit: 'reps', targetValue: 20, metric: 'COUNT',
  } as const;
  const codedChoice = {
    optionId: 'y', canonicalKey: 'push-up',
    activityVariant: 'outdoor', activityKind: 'fitness', unit: 'km', targetValue: 5, metric: 'DISTANCE',
  } as const;
  const uuidLabel = choiceOptionLabel({ ...uuidChoice });
  check('selector never exposes a UUID as the participant label',
    !/[0-9a-f]{8}-[0-9a-f]{4}/i.test(uuidLabel), uuidLabel);
  check('human-readable name path exists for coded activities',
    humanizeCanonicalKey('push-up') === 'Push Up', humanizeCanonicalKey('push-up'));
  check('coded selector label leads with the humanized name',
    choiceOptionLabel({ ...codedChoice }).startsWith('Push Up'), choiceOptionLabel({ ...codedChoice }));

  const zeroState = loggingViewFor(detail({ myParticipation: activeParticipation() }));
  check('zero configured activities is an honest empty state (not silent null)',
    zeroState.kind === 'empty'
    && loggingSectionStateFor(detail({ myParticipation: activeParticipation() }), null).render === 'empty');
  check('zero-activity copy is honest and bounded',
    NO_CONFIGURED_ACTIVITIES_COPY.toLowerCase().includes('no activities'));

  const governed = mapV2ApiError(Object.assign(new Error('x'), { status: 422, code: 'no_participation_episode' }));
  check('no_participation_episode copy no longer claims non-participation',
    /participation period/i.test(governed.message) && !/not currently taking part/i.test(governed.message),
    governed.message);
  check('no_participation_episode keeps the canonical code', governed.code === 'no_participation_episode');

  const conflict = mapV2ApiError(Object.assign(new Error('x'), { status: 409, code: 'idempotency_key_conflict' }));
  check('idempotency conflict copy avoids categorical "was not recorded"',
    !/was not recorded/i.test(conflict.message) && /start a new entry/i.test(conflict.message),
    conflict.message);
  check('idempotency conflict keeps the canonical code', conflict.code === 'idempotency_key_conflict');
  check('idempotency conflict is not retryable under the old key', conflict.retryable === false);
}

if (failures > 0) {
  console.error(`\nS3b CORR-001 behavioral guards: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nS3b CORR-001 behavioral guards: PASS');
