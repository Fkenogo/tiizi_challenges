import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateChallenge,
  createChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import { joinChallenge } from '../src/challengeParticipations.js';
import { appendActivityEvent } from '../src/activityEvents.js';
import {
  ApplicationError,
  applyChallengeActivity,
  SubmissionRejectedError,
  type ChallengeActivityResolvers,
  type NewChallengeActivityInput,
} from '../src/challengeActivityApplication.js';
import {
  ELIGIBILITY_REASON,
  ACCEPTANCE_AUTHORITY,
  type SubmissionIntentRow,
} from '../src/submissionIntents.js';
import {
  authHeaders,
  buildTestApp,
  seedGroup,
  seedMember,
  seedMembership,
  stubEligibility,
  testDb,
} from './helpers.js';
import type { Db } from '../src/db.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents',
  );
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const T = (iso: string): Date => new Date(iso);
const DAY_START = '2026-06-01';
const DAY_END = '2026-06-30';

let seq = 0;
const next = (prefix: string): string => `${prefix}-${(seq += 1)}`;

interface Pin {
  knowledge_id: string;
  current_version: number;
}

async function seedKnowledge(
  db: Db,
  name: string,
  kind: 'fitness' | 'wellness' = 'fitness',
): Promise<Pin> {
  const result = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ($1, $2, 'published')
     RETURNING knowledge_id, current_version`,
    [kind, name],
  );
  return {
    knowledge_id: String(result.rows[0].knowledge_id),
    current_version: Number(result.rows[0].current_version),
  };
}

function resolversFor(
  pins: Record<string, Pin>,
  memberAuthority: { status: string; eligible: boolean } | null = { status: 'active', eligible: true },
): ChallengeActivityResolvers {
  return {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveGroupMembershipAuthority: async () => memberAuthority,
  };
}

function creationResolvers(pins: Record<string, Pin>): ChallengeCreationResolvers {
  return {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
}

interface ChallengeSetup {
  groupId: string;
  memberId: string;
  /** Firebase auth subject mapped to the member (for route-level auth). */
  subject: string;
  challengeId: string;
  pins: Record<string, Pin>;
}

async function setupActiveChallenge(
  input: Omit<NewChallengeInput, 'group_id' | 'created_by_member_id' | 'title' | 'start_date' | 'end_date'> & {
    title?: string;
    start_date?: string;
    end_date?: string;
  },
): Promise<ChallengeSetup> {
  const db = testDb();
  const tag = next('ebc02');
  const subject = `member-${tag}`;
  const memberId = await seedMember(db, subject);
  const groupId = await seedGroup(db, { name: `EBC02 Group ${tag}` });
  await seedMembership(db, groupId, memberId, { status: 'active' });
  const pins: Record<string, Pin> = {};
  for (const activity of input.activities) {
    const key = activity.canonical_key;
    if (!pins[key]) pins[key] = await seedKnowledge(db, key, 'fitness');
  }
  const { challenge } = await createChallenge(
    db,
    {
      group_id: groupId,
      created_by_member_id: memberId,
      title: `EBC02 ${tag}`,
      start_date: DAY_START,
      end_date: DAY_END,
      ...input,
    } as NewChallengeInput,
    creationResolvers(pins),
  );
  await activateChallenge(db, challenge.challenge_id);
  return { groupId, memberId, subject, challengeId: challenge.challenge_id, pins };
}

async function insertEpisode(
  db: Db,
  options: { challengeId: string; memberId: string; joinedAt: string },
): Promise<string> {
  const result = await db.query<{ participation_id: string }>(
    `INSERT INTO challenge_participations
       (challenge_id, member_id, status, joined_at, joined_config_version)
     VALUES ($1, $2, 'active', $3, 1)
     RETURNING participation_id`,
    [options.challengeId, options.memberId, options.joinedAt],
  );
  return String(result.rows[0].participation_id);
}

function logInput(overrides?: Partial<NewChallengeActivityInput>): NewChallengeActivityInput {
  return {
    activity_kind: 'fitness',
    canonical_key: 'push-up',
    value: 20,
    unit: 'reps',
    occurred_at: T('2026-06-10T12:00:00Z'),
    client_key: next('key'),
    ...overrides,
  };
}

async function applyErr(promise: Promise<unknown>): Promise<ApplicationError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApplicationError);
    return error as ApplicationError;
  }
  throw new Error('expected applyChallengeActivity to reject');
}

async function intents(): Promise<SubmissionIntentRow[]> {
  const db = testDb();
  const result = await db.query('SELECT * FROM activity_submission_intents ORDER BY submitted_at, submission_id');
  return result.rows as unknown as SubmissionIntentRow[];
}

async function counts() {
  const db = testDb();
  const events = await db.query<{ count: string }>('SELECT COUNT(*) AS count FROM member_activity_events');
  const records = await db.query<{ count: string }>('SELECT COUNT(*) AS count FROM challenge_activity_records');
  const derived = await db.query<{ count: string }>('SELECT COUNT(*) AS count FROM challenge_participation_derived');
  const challengeDerived = await db.query<{ count: string }>('SELECT COUNT(*) AS count FROM challenge_derived_state');
  return {
    events: Number(events.rows[0].count),
    records: Number(records.rows[0].count),
    derived: Number(derived.rows[0].count),
    challengeDerived: Number(challengeDerived.rows[0].count),
  };
}

function pushUp(overrides?: Record<string, unknown>) {
  return { canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps', ...overrides };
}

describe('EBC-02 accepted path', () => {
  async function acceptedSetup() {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    const participationId = await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    return { db, setup, participationId };
  }

  it('1: eligible participant submission creates one attributable Submission Intent', async () => {
    const { setup } = await acceptedSetup();
    const result = await applyChallengeActivity(
      testDb(), setup.memberId, setup.challengeId, logInput({ client_key: 's1' }),
      resolversFor(setup.pins),
    );
    expect(result.submission).not.toBeNull();
    expect(result.submission!.submission_id).toMatch(UUID_RE);
    expect(result.submission!.member_id).toBe(setup.memberId);
    expect(result.submission!.challenge_id).toBe(setup.challengeId);
    expect(result.submission!.client_key).toBe('s1');
    expect(result.submission!.canonical_key).toBe('push-up');
    expect(result.submission!.value).toBe(20);
    expect((await intents())).toHaveLength(1);
  });

  it('2: eligibility outcome is recorded as eligible', async () => {
    const { setup } = await acceptedSetup();
    const result = await applyChallengeActivity(
      testDb(), setup.memberId, setup.challengeId, logInput({ client_key: 's2' }),
      resolversFor(setup.pins),
    );
    expect(result.submission!.eligibility_status).toBe('eligible');
    expect(result.submission!.eligibility_reason).toBeNull();
  });

  it('3: acceptance outcome records the automatic-system authority', async () => {
    const { setup } = await acceptedSetup();
    const result = await applyChallengeActivity(
      testDb(), setup.memberId, setup.challengeId, logInput({ client_key: 's3' }),
      resolversFor(setup.pins),
    );
    expect(result.submission!.acceptance_status).toBe('accepted');
    expect(result.submission!.acceptance_authority).toBe(ACCEPTANCE_AUTHORITY);
    expect(result.submission!.acceptance_authority).toBe('automatic_system');
    expect(result.submission!.decided_at).not.toBeNull();
  });

  it('4: accepted Evidence/Event is created once', async () => {
    const { setup } = await acceptedSetup();
    const result = await applyChallengeActivity(
      testDb(), setup.memberId, setup.challengeId, logInput({ client_key: 's4' }),
      resolversFor(setup.pins),
    );
    expect(result.event.event_id).toMatch(UUID_RE);
    expect(result.submission!.event_id).toBe(result.event.event_id);
    const { events } = await counts();
    expect(events).toBe(1);
  });

  it('5: exactly one Challenge application references that Evidence/Event', async () => {
    const { setup } = await acceptedSetup();
    const result = await applyChallengeActivity(
      testDb(), setup.memberId, setup.challengeId, logInput({ client_key: 's5' }),
      resolversFor(setup.pins),
    );
    expect(result.record.event_id).toBe(result.event.event_id);
    expect(result.submission!.record_id).toBe(result.record.record_id);
    const { records } = await counts();
    expect(records).toBe(1);
  });

  it('6: calculation runs only after the accepted application is recorded', async () => {
    const { setup } = await acceptedSetup();
    const before = await counts();
    expect(before.derived).toBe(0);
    expect(before.challengeDerived).toBe(0);
    const result = await applyChallengeActivity(
      testDb(), setup.memberId, setup.challengeId, logInput({ client_key: 's6' }),
      resolversFor(setup.pins),
    );
    expect(result.record.record_id).toMatch(UUID_RE);
    const after = await counts();
    expect(after.derived).toBe(1);
    expect(after.challengeDerived).toBe(1);
  });

  it('7: Derived Truth updates correctly from the accepted application', async () => {
    const { setup } = await acceptedSetup();
    const result = await applyChallengeActivity(
      testDb(), setup.memberId, setup.challengeId, logInput({ client_key: 's7', value: 20 }),
      resolversFor(setup.pins),
    );
    expect(result.participation.logsAccepted).toBe(1);
    expect(result.participation.totalPoints).toBe(100);
    expect(result.participation.cumulativeTotal).toBe(20);
    expect(result.challenge.completionsCount).toBe(1);
  });

  it('8: same idempotency key retries without duplicate Evidence/Application/calculation', async () => {
    const { setup } = await acceptedSetup();
    const first = await applyChallengeActivity(
      testDb(), setup.memberId, setup.challengeId, logInput({ client_key: 's8' }),
      resolversFor(setup.pins),
    );
    expect(first.duplicate).toBe(false);
    const second = await applyChallengeActivity(
      testDb(), setup.memberId, setup.challengeId, logInput({ client_key: 's8' }),
      resolversFor(setup.pins),
    );
    expect(second.duplicate).toBe(true);
    expect(second.record.record_id).toBe(first.record.record_id);
    expect(second.submission!.submission_id).toBe(first.submission!.submission_id);
    const state = await counts();
    expect(state.events).toBe(1);
    expect(state.records).toBe(1);
    expect((await intents())).toHaveLength(1);
    expect(second.participation.logsAccepted).toBe(1);
  });
});

describe('EBC-02 rejected path', () => {
  it('9: domain-valid but ineligible submission records a rejected intent/decision', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    // Wrong unit: domain-valid submission that fails eligibility.
    const error = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'r9', unit: 'km' }),
      resolversFor(setup.pins),
    ));
    expect(error).toBeInstanceOf(SubmissionRejectedError);
    expect(error.code).toBe('wrong_unit');
    const stored = await intents();
    expect(stored).toHaveLength(1);
    expect(stored[0].client_key).toBe('r9');
    expect(stored[0].eligibility_status).toBe('ineligible');
    expect(stored[0].acceptance_status).toBe('rejected');
    expect(stored[0].eligibility_reason).toBe(ELIGIBILITY_REASON.MEASUREMENT_NOT_COMPATIBLE);
  });

  it('10: rejected submission creates no accepted Evidence', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'r10', unit: 'km' }),
      resolversFor(setup.pins),
    ));
    const state = await counts();
    expect(state.events).toBe(0);
    expect(state.records).toBe(0);
    expect((await intents())[0].event_id).toBeNull();
  });

  it('11: rejected submission creates no Challenge application', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'r11', unit: 'km' }),
      resolversFor(setup.pins),
    ));
    expect((await counts()).records).toBe(0);
    expect((await intents())[0].record_id).toBeNull();
  });

  it('12: rejected submission creates no Derived Truth change', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'r12', unit: 'km' }),
      resolversFor(setup.pins),
    ));
    const state = await counts();
    expect(state.derived).toBe(0);
    expect(state.challengeDerived).toBe(0);
  });

  it('13: rejection reason is deterministic and machine-readable', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    // Exercise several distinct governed reasons and assert their codes.
    const reasons: Array<[Partial<NewChallengeActivityInput>, string]> = [
      [{ unit: 'km' }, ELIGIBILITY_REASON.MEASUREMENT_NOT_COMPATIBLE],
      [{ canonical_key: 'squat' }, ELIGIBILITY_REASON.ACTIVITY_NOT_CONFIGURED],
      [{ occurred_at: T('2026-05-20T12:00:00Z') }, ELIGIBILITY_REASON.PARTICIPATION_NOT_ELIGIBLE],
    ];
    const squatPin = await seedKnowledge(db, 'squat', 'fitness');
    const pins = { ...setup.pins, squat: squatPin };
    for (const [override, reason] of reasons) {
      const key = next('reason-key');
      await applyErr(applyChallengeActivity(
        db, setup.memberId, setup.challengeId, logInput({ client_key: key, ...override }),
        resolversFor(pins),
      ));
      const intent = (await intents()).find((i) => i.client_key === key)!;
      expect(intent.eligibility_reason).toBe(reason);
      expect(intent.eligibility_status).toBe('ineligible');
    }
    // The reason vocabulary is bounded and canonical (no free-form prose).
    const all = await intents();
    for (const intent of all) {
      expect(Object.values(ELIGIBILITY_REASON)).toContain(intent.eligibility_reason);
    }
  });

  it('14: retry of a rejected intent is deterministic', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const first = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'r14', unit: 'km' }),
      resolversFor(setup.pins),
    ));
    const retry = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'r14', unit: 'km' }),
      resolversFor(setup.pins),
    ));
    expect(retry.code).toBe(first.code);
    expect(retry).toBeInstanceOf(SubmissionRejectedError);
    expect((retry as SubmissionRejectedError).eligibilityReason).toBe(ELIGIBILITY_REASON.MEASUREMENT_NOT_COMPATIBLE);
    // Still exactly one persisted rejected intent; no new submission, event, or record.
    expect((await intents())).toHaveLength(1);
    const state = await counts();
    expect(state.events).toBe(0);
    expect(state.records).toBe(0);
  });

  it('14b: the rejected route response exposes a stable machine-readable reason', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const app = buildTestApp({ 'tok': setup.subject }, {
      challengeActivity: {
        groupMembershipAuthority: {
          resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
        },
      },
    });
    const denied = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${setup.challengeId}/activity`,
      headers: authHeaders('tok'),
      payload: {
        activity_kind: 'fitness',
        canonical_key: 'push-up',
        value: 20,
        unit: 'km',
        occurred_at: '2026-06-10T12:00:00Z',
        client_key: 'route-reject-reason',
      },
    });
    expect(denied.statusCode).toBe(422);
    const body = denied.json() as { error: { code: string; reason: string } };
    expect(body.error.code).toBe('wrong_unit');
    expect(body.error.reason).toBe(ELIGIBILITY_REASON.MEASUREMENT_NOT_COMPATIBLE);
  });
});

describe('EBC-02 boundary / security', () => {
  it('15: client cannot supply authoritative Member identity', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const app = buildTestApp({ 'tok': setup.subject }, {
      challengeActivity: {
        groupMembershipAuthority: {
          resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
        },
      },
    });
    const denied = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${setup.challengeId}/activity`,
      headers: authHeaders('tok'),
      payload: {
        activity_kind: 'fitness',
        canonical_key: 'push-up',
        value: 20,
        unit: 'reps',
        occurred_at: '2026-06-10T12:00:00Z',
        client_key: 'spoof-member',
        member_id: setup.memberId,
      },
    });
    expect(denied.statusCode).toBe(400);
  });

  it('16: client cannot mark itself accepted', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const app = buildTestApp({ 'tok': setup.subject }, {
      challengeActivity: {
        groupMembershipAuthority: {
          resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
        },
      },
    });
    for (const forged of [
      { acceptance_status: 'accepted' },
      { eligibility_status: 'eligible' },
      { accepted: true },
    ]) {
      const denied = await app.inject({
        method: 'POST',
        url: `/v1/challenges/${setup.challengeId}/activity`,
        headers: authHeaders('tok'),
        payload: {
          activity_kind: 'fitness',
          canonical_key: 'push-up',
          value: 20,
          unit: 'reps',
          occurred_at: '2026-06-10T12:00:00Z',
          client_key: next('accept-spoof'),
          ...forged,
        },
      });
      expect(denied.statusCode).toBe(400);
    }
  });

  it('17: client cannot supply acceptance authority', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const app = buildTestApp({ 'tok': setup.subject }, {
      challengeActivity: {
        groupMembershipAuthority: {
          resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
        },
      },
    });
    const denied = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${setup.challengeId}/activity`,
      headers: authHeaders('tok'),
      payload: {
        activity_kind: 'fitness',
        canonical_key: 'push-up',
        value: 20,
        unit: 'reps',
        occurred_at: '2026-06-10T12:00:00Z',
        client_key: 'spoof-authority',
        acceptance_authority: 'admin',
      },
    });
    expect(denied.statusCode).toBe(400);
  });

  it('18: raw Evidence cannot directly invoke calculation', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    // A raw Evidence row, appended without the acceptance seam.
    await appendActivityEvent(db, {
      member_id: setup.memberId,
      activity_kind: 'fitness',
      canonical_key: 'push-up',
      occurred_at: T('2026-06-10T12:00:00Z'),
      value: 20,
      unit: 'reps',
      client_key: next('raw-event'),
    }, { resolveKnowledgePin: resolversFor(setup.pins).resolveKnowledgePin });
    const state = await counts();
    expect(state.events).toBe(1);
    expect(state.records).toBe(0);
    expect(state.derived).toBe(0);
    expect(state.challengeDerived).toBe(0);
    expect(await intents()).toHaveLength(0);
  });

  it('19: an unaccepted application cannot update Derived Truth', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    const participationId = await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    // Raw event + raw record inserted OUTSIDE the acceptance seam.
    const event = await db.query<{ event_id: string }>(
      `INSERT INTO member_activity_events
         (member_id, activity_kind, canonical_key, knowledge_id, knowledge_version,
          occurred_at, occurred_day, value, unit, client_key)
       VALUES ($1, 'fitness', 'push-up', $2, 1, '2026-06-10T12:00:00Z', '2026-06-10', 20, 'reps', $3)
       RETURNING event_id`,
      [setup.memberId, setup.pins['push-up'].knowledge_id, next('raw-key')],
    );
    const config = await db.query<{ activity_config_id: string }>(
      `SELECT activity_config_id FROM challenge_activity_configs
       WHERE challenge_id = $1 AND version = 1 LIMIT 1`,
      [setup.challengeId],
    );
    await db.query(
      `INSERT INTO challenge_activity_records
         (event_id, participation_id, challenge_id, activity_config_id, config_version,
          value, unit, occurred_day, points_awarded, scoring_target_value,
          scoring_method, scoring_version)
       VALUES ($1, $2, $3, $4, 1, 20, 'reps', '2026-06-10', 100, 20, 'proportional_capped', 'computeActivityScore/v1')`,
      [event.rows[0].event_id, participationId, setup.challengeId, config.rows[0].activity_config_id],
    );
    // The application row exists, but no calculation seam ran -> no Derived Truth.
    const state = await counts();
    expect(state.records).toBe(1);
    expect(state.derived).toBe(0);
    expect(state.challengeDerived).toBe(0);
  });

  it('20: one Evidence/Application is not automatically reused into another Challenge', async () => {
    const db = testDb();
    // One member, one canonical Knowledge item, two Challenges: the same
    // activity identity must be loggable into both WITHOUT automatic reuse.
    const subject = next('cross-user');
    const memberId = await seedMember(db, subject);
    const pin = await seedKnowledge(db, 'push-up', 'fitness');
    const pins = { 'push-up': pin };
    const makeChallenge = async () => {
      const groupId = await seedGroup(db, { name: `Cross ${next('g')}` });
      await seedMembership(db, groupId, memberId, { status: 'active' });
      const { challenge } = await createChallenge(db, {
        group_id: groupId,
        created_by_member_id: memberId,
        challenge_type: 'competitive',
        title: `Cross ${next('c')}`,
        start_date: DAY_START,
        end_date: DAY_END,
        activities: [pushUp()],
      } as NewChallengeInput, creationResolvers(pins));
      await activateChallenge(db, challenge.challenge_id);
      return challenge.challenge_id;
    };
    const challengeA = await makeChallenge();
    const challengeB = await makeChallenge();
    await insertEpisode(db, { challengeId: challengeA, memberId, joinedAt: '2026-06-01T00:00:00Z' });
    await insertEpisode(db, { challengeId: challengeB, memberId, joinedAt: '2026-06-01T00:00:00Z' });

    const first = await applyChallengeActivity(
      db, memberId, challengeA, logInput({ client_key: 'cross-1' }),
      resolversFor(pins),
    );
    // Same key aimed at another challenge is a conflict, not reuse.
    const conflict = await applyErr(applyChallengeActivity(
      db, memberId, challengeB, logInput({ client_key: 'cross-1' }),
      resolversFor(pins),
    ));
    expect(conflict.statusCode).toBe(409);
    // No record in B references A's event.
    const recordsB = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM challenge_activity_records WHERE challenge_id = $1`,
      [challengeB],
    );
    expect(Number(recordsB.rows[0].count)).toBe(0);
    expect(first.record.challenge_id).toBe(challengeA);
  });
});

describe('EBC-02 regression', () => {
  it('21: collective accepted calculation still works', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'collective',
      goal_value: 1000,
      goal_unit: 'reps',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const result = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'coll-1', value: 600 }),
      resolversFor(setup.pins),
    );
    expect(result.challenge.collectiveTotal).toBe(600);
    expect(result.completionTriggered).toBe(false);
    expect(result.submission!.acceptance_authority).toBe('automatic_system');
  });

  it('22: competitive accepted calculation still works', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const result = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'comp-1', value: 100 }),
      resolversFor(setup.pins),
    );
    expect(result.participation.completionStatus).toBe('completed');
    expect(result.participation.totalPoints).toBe(100);
  });

  it('23: streak accepted calculation still works', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    // EBC-03: streak acceptance is same-day in the governing timezone —
    // the clock is driven to the log's own Challenge day. Calculation
    // assertions below are unchanged.
    const result = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'streak-1' }),
      resolversFor(setup.pins),
      { now: T('2026-06-10T12:00:00Z') },
    );
    expect(result.participation.currentStreak).toBe(1);
    expect(result.participation.daysCompleted).toBe(1);
  });

  it('24: existing deterministic replay remains correct', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'replay-1', value: 20 }),
      resolversFor(setup.pins),
    );
    await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'replay-2', value: 20 }),
      resolversFor(setup.pins),
    );
    const { recomputeChallengeDerived } = await import('../src/derivedTruth.js');
    const recomputed = await recomputeChallengeDerived(db, setup.challengeId);
    expect(recomputed.recordsReplayed).toBe(2);
    expect(recomputed.challenge.completionsCount).toBe(1);
    const stored = await db.query<{ total_points: number }>(
      `SELECT total_points FROM challenge_participation_derived WHERE challenge_id = $1`,
      [setup.challengeId],
    );
    expect(Number(stored.rows[0].total_points)).toBe(200);
  });
});

describe('EBC-02 join-path integration', () => {
  it('records an intent for a C2A-joined episode', async () => {
    const db = testDb();
    const day = (offset: number): string =>
      new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      start_date: day(-30),
      end_date: day(30),
      activities: [pushUp()],
    });
    const episode = await joinChallenge(db, setup.challengeId, setup.memberId, {
      resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
    });
    const result = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ occurred_at: new Date(), client_key: next('join-key') }),
      resolversFor(setup.pins),
    );
    expect(result.record.participation_id).toBe(episode.participation_id);
    expect(result.submission!.participation_id).toBe(episode.participation_id);
    expect(result.submission!.acceptance_status).toBe('accepted');
  });
});

describe('EBC-02 CORR-001 idempotency payload binding', () => {
  async function corrSetup() {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    return { db, setup };
  }

  async function conflictErr(promise: Promise<unknown>): Promise<ApplicationError> {
    const error = await applyErr(promise);
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('idempotency_key_conflict');
    return error;
  }

  it('C1: accepted intent + identical retry replays the prior acceptance', async () => {
    const { db, setup } = await corrSetup();
    const first = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'corr-c1' }),
      resolversFor(setup.pins),
    );
    expect(first.duplicate).toBe(false);
    const second = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'corr-c1' }),
      resolversFor(setup.pins),
    );
    expect(second.duplicate).toBe(true);
    expect(second.record.record_id).toBe(first.record.record_id);
    expect(second.submission!.submission_id).toBe(first.submission!.submission_id);
    expect((await intents())).toHaveLength(1);
  });

  it('C2: accepted intent + same key + different value conflicts', async () => {
    const { db, setup } = await corrSetup();
    await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'corr-c2', value: 20 }),
      resolversFor(setup.pins),
    );
    await conflictErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'corr-c2', value: 25 }),
      resolversFor(setup.pins),
    ));
    expect((await intents())).toHaveLength(1);
    const state = await counts();
    expect(state.events).toBe(1);
    expect(state.records).toBe(1);
  });

  it('C3: accepted intent + same key + different unit conflicts', async () => {
    const { db, setup } = await corrSetup();
    await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'corr-c3', unit: 'reps' }),
      resolversFor(setup.pins),
    );
    // A bare unit change alone would be MEASUREMENT_NOT_COMPATIBLE; the
    // payload-binding check fires first as a 409 key conflict.
    await conflictErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'corr-c3', unit: 'km' }),
      resolversFor(setup.pins),
    ));
    expect((await intents())).toHaveLength(1);
  });

  it('C4: accepted intent + same key + different activity conflicts', async () => {
    const { db, setup } = await corrSetup();
    await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'corr-c4', canonical_key: 'push-up' }),
      resolversFor(setup.pins),
    );
    await conflictErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'corr-c4', canonical_key: 'squat' }),
      resolversFor(setup.pins),
    ));
    expect((await intents())).toHaveLength(1);
  });

  it('C5: accepted intent + same key + different occurrence timestamp conflicts', async () => {
    const { db, setup } = await corrSetup();
    await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ client_key: 'corr-c5', occurred_at: T('2026-06-10T12:00:00Z') }),
      resolversFor(setup.pins),
    );
    await conflictErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ client_key: 'corr-c5', occurred_at: T('2026-06-10T13:00:00Z') }),
      resolversFor(setup.pins),
    ));
    const stored = (await intents()).find((i) => i.client_key === 'corr-c5')!;
    expect(new Date(stored.occurred_at).toISOString()).toBe('2026-06-10T12:00:00.000Z');
  });

  it('C6: rejected intent + identical retry replays the same rejection', async () => {
    const { db, setup } = await corrSetup();
    const first = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'corr-c6', unit: 'km' }),
      resolversFor(setup.pins),
    ));
    expect(first).toBeInstanceOf(SubmissionRejectedError);
    const retry = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'corr-c6', unit: 'km' }),
      resolversFor(setup.pins),
    ));
    expect(retry).toBeInstanceOf(SubmissionRejectedError);
    expect(retry.code).toBe(first.code);
    expect((retry as SubmissionRejectedError).eligibilityReason)
      .toBe(ELIGIBILITY_REASON.MEASUREMENT_NOT_COMPATIBLE);
    expect((await intents())).toHaveLength(1);
    const state = await counts();
    expect(state.events).toBe(0);
    expect(state.records).toBe(0);
  });

  it('C7: rejected intent + same key + changed payload conflicts (no reuse for a valid log)', async () => {
    const { db, setup } = await corrSetup();
    await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'corr-c7', unit: 'km' }),
      resolversFor(setup.pins),
    ));
    // The changed payload would be eligible on a fresh key; on the rejected
    // key it must conflict instead of being accepted.
    await conflictErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'corr-c7', unit: 'reps' }),
      resolversFor(setup.pins),
    ));
    expect((await intents())).toHaveLength(1);
    const state = await counts();
    expect(state.events).toBe(0);
    expect(state.records).toBe(0);
  });

  it('C8: null/absent equivalent variant does not false-conflict', async () => {
    const { db, setup } = await corrSetup();
    const first = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'corr-c8a' }),
      resolversFor(setup.pins),
    );
    const explicitNull = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ client_key: 'corr-c8a', activity_variant: null }),
      resolversFor(setup.pins),
    );
    expect(explicitNull.duplicate).toBe(true);
    expect(explicitNull.submission!.submission_id).toBe(first.submission!.submission_id);
    const second = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ client_key: 'corr-c8b', activity_variant: null }),
      resolversFor(setup.pins),
    );
    const omitted = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'corr-c8b' }),
      resolversFor(setup.pins),
    );
    expect(omitted.duplicate).toBe(true);
    expect(omitted.submission!.submission_id).toBe(second.submission!.submission_id);
    expect((await intents())).toHaveLength(2);
  });

  it('C9: same member/challenge alone is NOT sufficient for replay', async () => {
    const { db, setup } = await corrSetup();
    await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ client_key: 'corr-c9', occurred_at: T('2026-06-10T12:00:00Z') }),
      resolversFor(setup.pins),
    );
    // Same member, same challenge, same key — but a different occurred day.
    await conflictErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ client_key: 'corr-c9', occurred_at: T('2026-06-11T12:00:00Z') }),
      resolversFor(setup.pins),
    ));
    expect((await intents())).toHaveLength(1);
  });
});
