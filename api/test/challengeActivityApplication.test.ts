import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateChallenge,
  createChallenge,
  endChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import {
  addChallengeConfigVersion,
  type ActivityConfigInput,
} from '../src/challengeConfigs.js';
import { joinChallenge } from '../src/challengeParticipations.js';
import { reviseKnowledgeItem } from '../src/knowledge.js';
import { computeActivityScore } from '../src/engine/scoringConfig.js';
import { appendCorrectionEvent } from '../src/activityEvents.js';
import {
  ApplicationError,
  applyChallengeActivity,
  type ChallengeActivityResolvers,
  type NewChallengeActivityInput,
} from '../src/challengeActivityApplication.js';
import {
  computeFinishingPositions,
  normalizeChallengeDerived,
  normalizeParticipationDerived,
  recomputeChallengeDerived,
} from '../src/derivedTruth.js';
import {
  createFirestoreGroupMembershipAuthority,
  type FirestoreReader,
} from '../src/firestoreGroupAuthority.js';
import { resolveKnowledgePinByName } from '../src/knowledgePins.js';
import {
  authHeaders,
  buildTestApp,
  seedGroup,
  seedMember,
  seedMembership,
  testDb,
  stubEligibility,
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
  lifecycle = 'published',
): Promise<Pin> {
  const result = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ($1, $2, $3)
     RETURNING knowledge_id, current_version`,
    [kind, name, lifecycle],
  );
  return {
    knowledge_id: String(result.rows[0].knowledge_id),
    current_version: Number(result.rows[0].current_version),
  };
}

function resolversFor(
  pins: Record<string, Pin>,
  memberAuthority: { status: string; eligible: boolean } | null = { status: 'active', eligible: true },
  authorityError?: string,
): ChallengeActivityResolvers {
  return {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveGroupMembershipAuthority: async () => {
      if (authorityError) throw new Error(authorityError);
      return memberAuthority;
    },
  };
}

function creationResolvers(
  pins: Record<string, Pin>,
): ChallengeCreationResolvers {
  return {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
}

function pushUp(overrides?: Partial<ActivityConfigInput>): ActivityConfigInput {
  return { canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps', ...overrides };
}

function water(overrides?: Partial<ActivityConfigInput>): ActivityConfigInput {
  return { canonical_key: 'water-intake', metric: 'quantity', target_value: 2000, unit: 'millilitres', ...overrides };
}

interface ChallengeSetup {
  groupId: string;
  memberId: string;
  challengeId: string;
  pins: Record<string, Pin>;
}

async function setupActiveChallenge(
  input: Omit<NewChallengeInput, 'group_id' | 'created_by_member_id' | 'title' | 'start_date' | 'end_date'> & {
    title?: string;
    start_date?: string;
    end_date?: string;
    kinds?: Record<string, 'fitness' | 'wellness'>;
  },
): Promise<ChallengeSetup> {
  const db = testDb();
  const tag = next('c2b');
  const memberId = await seedMember(db, `member-${tag}`);
  const groupId = await seedGroup(db, { name: `C2B Group ${tag}` });
  await seedMembership(db, groupId, memberId, { status: 'active' });
  const pins: Record<string, Pin> = {};
  for (const activity of input.activities) {
    const key = activity.canonical_key;
    if (!pins[key]) {
      pins[key] = await seedKnowledge(db, key, input.kinds?.[key] ?? 'fitness');
    }
  }
  const { challenge } = await createChallenge(
    db,
    {
      group_id: groupId,
      created_by_member_id: memberId,
      title: `C2B ${tag}`,
      start_date: DAY_START,
      end_date: DAY_END,
      ...input,
    } as NewChallengeInput,
    creationResolvers(pins),
  );
  await activateChallenge(db, challenge.challenge_id);
  return { groupId, memberId, challengeId: challenge.challenge_id, pins };
}

async function insertEpisode(
  db: Db,
  options: {
    challengeId: string;
    memberId: string;
    joinedAt: string;
    status?: 'active' | 'withdrawn' | 'removed';
    exitedAt?: string | null;
    exitReason?: 'withdrawn' | 'removed' | null;
  },
): Promise<string> {
  const result = await db.query<{ participation_id: string }>(
    `INSERT INTO challenge_participations
       (challenge_id, member_id, status, joined_at, joined_config_version, exited_at, exit_reason)
     VALUES ($1, $2, $3, $4, 1, $5, $6)
     RETURNING participation_id`,
    [
      options.challengeId,
      options.memberId,
      options.status ?? 'active',
      options.joinedAt,
      options.exitedAt ?? null,
      options.exitReason ?? null,
    ],
  );
  return String(result.rows[0].participation_id);
}

function logInput(overrides?: Partial<NewChallengeActivityInput>): NewChallengeActivityInput {
  return {
    activity_kind: 'fitness',
    canonical_key: 'push-up',
    value: 10,
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

async function tableCounts(): Promise<{ events: number; records: number }> {
  const db = testDb();
  const events = await db.query<{ count: string }>('SELECT COUNT(*) AS count FROM member_activity_events');
  const records = await db.query<{ count: string }>('SELECT COUNT(*) AS count FROM challenge_activity_records');
  return {
    events: Number(events.rows[0].count),
    records: Number(records.rows[0].count),
  };
}

function fakeReader(docs: Record<string, Record<string, unknown> | null>): FirestoreReader {
  return {
    async getDocument(collection: string, docId: string) {
      const data = docs[`${collection}/${docId}`];
      if (data == null) return { exists: false, data: () => undefined };
      return { exists: true, data: () => ({ ...data }) };
    },
  };
}

describe('auth / authority', () => {
  it('rejects route calls for authenticated identities with no linked member', async () => {
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
    // Token maps to a subject never seeded as a member: unknown_member.
    const app = buildTestApp({ 'tok-c2b': `ghost-for-${setup.memberId}` }, {
      challengeActivity: {
        groupMembershipAuthority: {
          resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
        },
      },
    });
    // The stub subject above does not match the seeded member: unknown_member.
    const denied = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${setup.challengeId}/activity`,
      headers: authHeaders('tok-c2b'),
      payload: {
        activity_kind: 'fitness',
        canonical_key: 'push-up',
        value: 10,
        unit: 'reps',
        occurred_at: '2026-06-10T12:00:00Z',
        client_key: 'route-spoof-1',
      },
    });
    expect(denied.statusCode).toBe(401);
  });

  it('accepts the authenticated member end to end and rejects forged member fields', async () => {
    const db = testDb();
    const subject = next('route-user');
    const memberId = await seedMember(db, subject);
    const groupId = await seedGroup(db, { name: `C2B Route ${subject}` });
    await seedMembership(db, groupId, memberId, { status: 'active' });
    const pin = await seedKnowledge(db, 'push-up', 'fitness');
    const { challenge } = await createChallenge(db, {
      group_id: groupId,
      created_by_member_id: memberId,
      challenge_type: 'competitive',
      title: 'Route proof',
      start_date: DAY_START,
      end_date: DAY_END,
      activities: [pushUp()],
    }, creationResolvers({ 'push-up': pin }));
    await activateChallenge(db, challenge.challenge_id);
    await insertEpisode(db, {
      challengeId: challenge.challenge_id,
      memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const app = buildTestApp({ 'tok-ok': subject }, {
      challengeActivity: {
        groupMembershipAuthority: {
          resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
        },
      },
    });
    const ok = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${challenge.challenge_id}/activity`,
      headers: authHeaders('tok-ok'),
      payload: {
        activity_kind: 'fitness',
        canonical_key: 'push-up',
        value: 20,
        unit: 'reps',
        occurred_at: '2026-06-10T12:00:00Z',
        client_key: next('route-key'),
      },
    });
    expect(ok.statusCode).toBe(200);
    const body = ok.json() as { recordId: string; pointsAwarded: number; duplicate: boolean };
    expect(body.recordId).toMatch(UUID_RE);
    expect(body.pointsAwarded).toBe(100);
    expect(body.duplicate).toBe(false);

    for (const forged of [
      { member_id: memberId },
      { points: 100 },
      { participation_id: '00000000-0000-4000-8000-000000000000' },
      { config_version: 1 },
    ]) {
      const rejected = await app.inject({
        method: 'POST',
        url: `/v1/challenges/${challenge.challenge_id}/activity`,
        headers: authHeaders('tok-ok'),
        payload: {
          activity_kind: 'fitness',
          canonical_key: 'push-up',
          value: 20,
          unit: 'reps',
          occurred_at: '2026-06-10T12:00:00Z',
          client_key: next('route-key'),
          ...forged,
        },
      });
      expect(rejected.statusCode).toBe(400);
    }
    expect((await tableCounts()).records).toBe(1);
  });

  it('rejects unauthenticated route calls', async () => {
    const app = buildTestApp({});
    const denied = await app.inject({
      method: 'POST',
      url: '/v1/challenges/00000000-0000-4000-8000-000000000000/activity',
      payload: {
        activity_kind: 'fitness',
        canonical_key: 'push-up',
        value: 10,
        unit: 'reps',
        occurred_at: '2026-06-10T12:00:00Z',
        client_key: 'no-auth',
      },
    });
    expect(denied.statusCode).toBe(401);
  });

  it('fails closed when the membership authority is unreachable', async () => {
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
    const before = await tableCounts();
    const error = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput(),
      resolversFor(setup.pins, null, 'firestore offline'),
    ));
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('group_authority_unavailable');
    expect(await tableCounts()).toEqual(before);
  });

  it('rejects on stale PG shadow membership when live authority reports removal', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    // PG shadow still shows an active membership (seeded by the fixture);
    // the stale row must not authorize — live authority wins.
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const before = await tableCounts();
    const error = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput(),
      resolversFor(setup.pins, null),
    ));
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('no_current_group_membership');
    expect(await tableCounts()).toEqual(before);
  });
});

describe('application', () => {
  it('applies valid Evidence atomically with UUIDs and exactly one record', async () => {
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
    const result = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ value: 20 }),
      resolversFor(setup.pins),
    );
    expect(result.duplicate).toBe(false);
    expect(result.event.event_id).toMatch(UUID_RE);
    expect(result.record.record_id).toMatch(UUID_RE);
    expect(result.record.event_id).toBe(result.event.event_id);
    expect(result.record.participation_id).toBe(participationId);
    expect(result.record.challenge_id).toBe(setup.challengeId);
    expect(result.record.config_version).toBe(1);
    expect(result.record.activity_config_id).toMatch(UUID_RE);
    expect(result.record.points_awarded).toBe(100);
    expect(result.record.scoring_target_value).toBe(20);
    expect(result.record.scoring_method).toBe('proportional_capped');
    expect(result.record.engine_version).toBe('v2');
    expect(result.participation.logsAccepted).toBe(1);
    expect(result.participation.totalPoints).toBe(100);
    const records = await db.query(
      'SELECT COUNT(*) AS count FROM challenge_activity_records WHERE event_id = $1',
      [result.event.event_id],
    );
    expect(Number(records.rows[0].count)).toBe(1);
  });

  it('rejects wrong activity, wrong variant, wrong unit and unknown Knowledge with zero rows', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ activity_variant: 'standard' })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    // 'squat' is canonical Knowledge but not configured in this challenge.
    const squatPin = await seedKnowledge(testDb(), 'squat', 'fitness');
    const resolvers = resolversFor({ ...setup.pins, squat: squatPin });
    const before = await tableCounts();

    const wrongActivity = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ canonical_key: 'squat', client_key: next('key') }), resolvers,
    ));
    expect(wrongActivity.code).toBe('wrong_activity');

    const wrongVariant = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ activity_variant: 'wide', client_key: next('key') }), resolvers,
    ));
    expect(wrongVariant.code).toBe('wrong_variant');

    // Matching variant so the failure lands on the unit gate, not variant matching.
    const wrongUnit = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ activity_variant: 'standard', unit: 'km', client_key: next('key') }), resolvers,
    ));
    expect(wrongUnit.code).toBe('wrong_unit');

    const unknownKnowledge = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ canonical_key: 'ghost-move', client_key: next('key') }), resolvers,
    ));
    expect(unknownKnowledge.code).toBe('unknown_activity');

    expect(await tableCounts()).toEqual(before);
  });

  it('rejects a second application of the same event and cross-challenge key reuse', async () => {
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
    const first = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: 'shared-key' }),
      resolversFor(setup.pins),
    );
    // Direct second application of the same event violates one-application-per-event.
    const clash = await db.query(
      `INSERT INTO challenge_activity_records
         (event_id, participation_id, challenge_id, activity_config_id,
          config_version, value, unit, occurred_day,
          points_awarded, scoring_target_value, scoring_method, scoring_version)
       VALUES ($1, $2, $3, $4, 1, 10, 'reps', '2026-06-10', 50, 20, 'proportional_capped', 'computeActivityScore/v1')`,
      [first.event.event_id, first.record.participation_id, setup.challengeId, first.record.activity_config_id],
    ).then(() => 'inserted').catch((error: Error) => String((error as Error).message));
    expect(clash).toMatch(/duplicate|unique/i);

    // Same client_key aimed at another challenge is a conflict, not a reuse —
    // even when the same member joined both challenges.
    const other = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: other.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const conflict = await applyErr(applyChallengeActivity(
      db, setup.memberId, other.challengeId, logInput({ client_key: 'shared-key' }),
      resolversFor({ ...setup.pins, ...other.pins }),
    ));
    expect(conflict.statusCode).toBe(409);
    expect(conflict.code).toBe('idempotency_key_conflict');
    expect(await tableCounts()).toEqual({ events: 1, records: 1 });
  });

  it('rolls back the Evidence row when record consistency fails mid-transaction', async () => {
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
    const other = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    const otherParticipation = await insertEpisode(db, {
      challengeId: other.challengeId,
      memberId: other.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    expect(otherParticipation).toMatch(UUID_RE);
    const before = await tableCounts();
    await expect(db.transaction(async (tx) => {
      const inserted = await tx.query<{ event_id: string }>(
        `INSERT INTO member_activity_events
           (member_id, activity_kind, canonical_key, knowledge_id, knowledge_version,
            occurred_at, occurred_day, value, unit, client_key)
         VALUES ($1, 'fitness', 'push-up', $2, 1,
            '2026-06-10T12:00:00Z', '2026-06-10', 10, 'reps', $3)
         RETURNING event_id`,
        [setup.memberId, setup.pins['push-up'].knowledge_id, next('atomic-key')],
      );
      const eventId = String(inserted.rows[0].event_id);
      // Participation belongs to another challenge (and the config to
      // neither): the DB consistency trigger must abort the whole
      // transaction, including the event.
      await tx.query(
        `INSERT INTO challenge_activity_records
           (event_id, participation_id, challenge_id, activity_config_id,
            config_version, value, unit, occurred_day,
            points_awarded, scoring_target_value, scoring_method, scoring_version)
         VALUES ($1, $2, $3, $4, 1, 10, 'reps', '2026-06-10', 50, 20, 'proportional_capped', 'computeActivityScore/v1')`,
        [eventId, otherParticipation, setup.challengeId, '00000000-0000-4000-8000-000000000001'],
      );
    })).rejects.toThrow();
    expect(await tableCounts()).toEqual(before);
  });
});

describe('participation episodes', () => {
  it('binds Evidence to the owning episode: before/during/after/gap/second-episode', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    const resolvers = resolversFor(setup.pins);
    // Episode 1: [06-01, 06-10) withdrawn; gap; episode 2: [06-15, ∞) active.
    const ep1 = await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
      status: 'withdrawn',
      exitedAt: '2026-06-10T00:00:00Z',
      exitReason: 'withdrawn',
    });
    const ep2 = await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-15T00:00:00Z',
    });

    const at = (day: string) => T(`${day}T12:00:00Z`);
    const before = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ occurred_at: at('2026-05-20'), client_key: next('key') }), resolvers,
    ));
    expect(before.code).toBe('no_participation_episode');

    const during1 = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ occurred_at: at('2026-06-05'), client_key: next('key') }), resolvers,
    );
    expect(during1.record.participation_id).toBe(ep1);

    // At/after exit belongs to no episode (exit instant is exclusive).
    const atExit = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ occurred_at: T('2026-06-10T00:00:00Z'), client_key: next('key') }), resolvers,
    ));
    expect(atExit.code).toBe('no_participation_episode');

    const gap = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ occurred_at: at('2026-06-12'), client_key: next('key') }), resolvers,
    ));
    expect(gap.code).toBe('no_participation_episode');

    const during2 = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ occurred_at: at('2026-06-20'), client_key: next('key') }), resolvers,
    );
    expect(during2.record.participation_id).toBe(ep2);

    // Episodes evaluated independently: ep1 holds one accepted record.
    const ep1Records = await db.query(
      'SELECT COUNT(*) AS count FROM challenge_activity_records WHERE participation_id = $1',
      [ep1],
    );
    expect(Number(ep1Records.rows[0].count)).toBe(1);
  });

  it('accepts logs on a C2A-joined episode for current time', async () => {
    const db = testDb();
    const day = (offset: number): string =>
      new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      start_date: day(-30),
      end_date: day(30),
      activities: [pushUp()],
    });
    // Join via the C2A seam (joined_at = now) and log with occurred_at = now.
    const episode = await joinChallenge(db, setup.challengeId, setup.memberId, {
      resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
    });
    const result = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ occurred_at: new Date(), client_key: next('key') }),
      resolversFor(setup.pins),
    );
    expect(result.record.participation_id).toBe(episode.participation_id);
  });
});

describe('idempotency', () => {
  it('returns the same application on retry without double effects', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'collective',
      goal_value: 1000,
      goal_unit: 'reps',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const resolvers = resolversFor(setup.pins);
    const first = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 100, client_key: 'retry-key' }), resolvers,
    );
    expect(first.duplicate).toBe(false);
    const second = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 100, client_key: 'retry-key' }), resolvers,
    );
    expect(second.duplicate).toBe(true);
    expect(second.record.record_id).toBe(first.record.record_id);
    expect(second.record.points_awarded).toBe(first.record.points_awarded);
    expect(await tableCounts()).toEqual({ events: 1, records: 1 });
    // No double collective total, points, or logs.
    expect(second.challenge.collectiveTotal).toBe(100);
    expect(second.participation.totalPoints).toBe(first.participation.totalPoints);
    expect(second.participation.logsAccepted).toBe(1);
  });

  it('keeps concurrent duplicate requests single-effect', async () => {
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
    const resolvers = resolversFor(setup.pins);
    const [a, b] = await Promise.all([
      applyChallengeActivity(db, setup.memberId, setup.challengeId, logInput({ client_key: 'race-key' }), resolvers),
      applyChallengeActivity(db, setup.memberId, setup.challengeId, logInput({ client_key: 'race-key' }), resolvers),
    ]);
    const flags = [a.duplicate, b.duplicate].sort();
    expect(flags).toEqual([false, true]);
    expect(a.record.record_id).toBe(b.record.record_id);
    expect(await tableCounts()).toEqual({ events: 1, records: 1 });
    const winner = a.duplicate ? b : a;
    expect(winner.participation.logsAccepted).toBe(1);
  });

  it('keeps streak retries idempotent in Derived Truth', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      required_consecutive_days: 30,
      activities: [water({ canonical_key: 'water-intake' })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const resolvers = resolversFor(setup.pins);
    const input = (): NewChallengeActivityInput => ({
      activity_kind: 'fitness',
      canonical_key: 'water-intake',
      value: 2000,
      unit: 'millilitres',
      occurred_at: T('2026-06-10T12:00:00Z'),
      client_key: 'streak-retry',
    });
    // EBC-03: streak acceptance is same-day in the governing timezone —
    // drive the acceptance clock to the log's own day.
    const atLogDay = { now: T('2026-06-10T12:00:00Z') };
    const first = await applyChallengeActivity(db, setup.memberId, setup.challengeId, input(), resolvers, atLogDay);
    const second = await applyChallengeActivity(db, setup.memberId, setup.challengeId, input(), resolvers, atLogDay);
    expect(second.duplicate).toBe(true);
    expect(first.participation.currentStreak).toBe(1);
    expect(second.participation.currentStreak).toBe(1);
    expect(second.participation.bestStreak).toBe(1);
    expect(second.participation.daysCompleted).toBe(1);
    expect(await tableCounts()).toEqual({ events: 1, records: 1 });
  });
});

describe('scoring', () => {
  it('ignores client points and scores deterministically with attribution', async () => {
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
    const resolvers = resolversFor(setup.pins);
    // Defensive seam rejection of server-derived fields.
    const forged = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      { ...logInput({ client_key: next('key') }), points: 100 } as unknown as NewChallengeActivityInput,
      resolvers,
    ));
    expect(forged.statusCode).toBe(400);

    const half = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ value: 10, client_key: next('key') }), resolvers,
    );
    const full = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ value: 20, client_key: next('key') }), resolvers,
    );
    const over = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ value: 40, client_key: next('key') }), resolvers,
    );
    expect(half.record.points_awarded).toBe(50);
    expect(full.record.points_awarded).toBe(100);
    expect(over.record.points_awarded).toBe(100);
    const again = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ value: 10, client_key: next('key') }), resolvers,
    );
    expect(again.record.points_awarded).toBe(half.record.points_awarded);
    expect(again.record.scoring_version).toBe('computeActivityScore/v1');
  });
});

describe('engines', () => {
  async function collectiveSetup() {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'collective',
      goal_value: 1000,
      goal_unit: 'reps',
      activities: [pushUp()],
    });
    const tag = next('member');
    const memberB = await seedMember(db, `b-${tag}`);
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: memberB,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    return { db, setup, memberB };
  }

  it('collective: actual contributions accumulate, overshoot retained, boundary ends the challenge', async () => {
    const { db, setup, memberB } = await collectiveSetup();
    const resolvers = resolversFor(setup.pins);
    const at = (day: string) => T(`${day}T12:00:00Z`);

    const a = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 600, occurred_at: at('2026-06-10'), client_key: next('key') }), resolvers,
    );
    expect(a.challenge.collectiveTotal).toBe(600);
    expect(a.completionTriggered).toBe(false);
    // Participant truth carries the accepted contribution.
    expect(a.participation.cumulativeTotal).toBe(600);

    const b = await applyChallengeActivity(
      db, memberB, setup.challengeId,
      logInput({ value: 500, occurred_at: at('2026-06-11'), client_key: next('key') }), resolvers,
    );
    // Full crossing contribution retained: 1100, not truncated to 1000.
    expect(b.challenge.collectiveTotal).toBe(1100);
    expect(b.challenge.collectiveGoalReached).toBe(true);
    expect(b.completionTriggered).toBe(true);
    expect(b.record.completion_triggered).toBe(true);
    expect(a.record.completion_triggered).toBe(false);

    // Completion boundary: the challenge ended and every active episode completed.
    const status = await db.query<{ status: string }>(
      'SELECT status FROM challenges WHERE challenge_id = $1', [setup.challengeId],
    );
    expect(status.rows[0].status).toBe('ended');
    const completions = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM challenge_participation_derived
       WHERE challenge_id = $1 AND completion_status = 'completed'`, [setup.challengeId],
    );
    expect(Number(completions.rows[0].count)).toBe(2);

    // Ordinary logging after the boundary is rejected with zero new rows.
    const before = await tableCounts();
    const closed = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 10, occurred_at: at('2026-06-12'), client_key: next('key') }), resolvers,
    ));
    expect(closed.code).toBe('challenge_not_active');
    expect(await tableCounts()).toEqual(before);
  });

  it('competitive: cumulative per-activity progress, server points, all-targets completion', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 }), { canonical_key: 'squat', metric: 'repetitions', target_value: 50, unit: 'reps' }],
    });
    const pinSquat = setup.pins['squat'];
    expect(pinSquat.knowledge_id).toMatch(UUID_RE);
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const resolvers = resolversFor(setup.pins);
    const at = (day: string) => T(`${day}T12:00:00Z`);

    // Partial progress: push-up target met, squat untouched -> in progress.
    const p1 = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 100, occurred_at: at('2026-06-10'), client_key: next('key') }), resolvers,
    );
    expect(p1.participation.completionStatus).toBe('in_progress');
    expect(p1.participation.cumulativeTotal).toBe(100);
    expect(p1.completionTriggered).toBe(false);

    const p2 = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ canonical_key: 'squat', value: 50, occurred_at: at('2026-06-11'), client_key: next('key') }),
      resolvers,
    );
    expect(p2.participation.completionStatus).toBe('completed');
    expect(p2.participation.completedAt).not.toBeNull();
    expect(p2.completionTriggered).toBe(true);

    // Points are server-owned per log (100 + 100 + 10); later logs still
    // accepted (position fixed at first completion) without moving completed_at.
    const firstCompletedAt = p2.participation.completedAt;
    const p3 = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 10, occurred_at: at('2026-06-12'), client_key: next('key') }), resolvers,
    );
    expect(p3.participation.totalPoints).toBe(210);
    expect(p3.participation.completedAt).toBe(firstCompletedAt);
    expect(p3.completionTriggered).toBe(false);
  });

  it('competitive: finishing positions follow completion order with shared ties', () => {
    const positions = computeFinishingPositions(
      [
        { participation_id: 'a', completed_at: '2026-06-10T10:00:00.000Z' },
        { participation_id: 'b', completed_at: '2026-06-10T10:00:00.000Z' },
        { participation_id: 'c', completed_at: '2026-06-11T10:00:00.000Z' },
        { participation_id: 'd', completed_at: null },
      ],
      ['a', 'b', 'c', 'd'],
    );
    // No "Highest Performance" mode: order only, ties share, non-completers unranked.
    expect(positions).toEqual({ a: 1, b: 1, c: 3, d: null });
  });

  it('streak: daily Done needs ALL requirements; partial, repeat and gap behave', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      required_consecutive_days: 30,
      activities: [water({ canonical_key: 'water-intake' }), { canonical_key: 'sleep-8h', metric: 'duration', target_value: 8, unit: 'hours' }],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const resolvers = resolversFor(setup.pins);
    // EBC-03: the acceptance clock advances with the log's own Challenge
    // day (streak logs are same-day in the governing timezone).
    const log = (canonical_key: string, day: string, key?: string) => applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      {
        activity_kind: 'fitness',
        canonical_key,
        value: canonical_key === 'water-intake' ? 2000 : 8,
        unit: canonical_key === 'water-intake' ? 'millilitres' : 'hours',
        occurred_at: T(`${day}T12:00:00Z`),
        client_key: key ?? next('key'),
      },
      resolvers,
      { now: T(`${day}T12:00:00Z`) },
    );

    // Partial multi-activity day does not advance.
    const partial = await log('water-intake', '2026-06-10');
    expect(partial.participation.currentStreak).toBe(0);
    expect(partial.participation.daysCompleted).toBe(0);
    expect(partial.participation.distinctDays).toBe(1);

    // Completing ALL requirements advances exactly once ...
    const done = await log('sleep-8h', '2026-06-10');
    expect(done.participation.currentStreak).toBe(1);
    expect(done.participation.daysCompleted).toBe(1);

    // ... and a repeated same-day log is idempotent in Derived Truth.
    const repeat = await log('water-intake', '2026-06-10');
    expect(repeat.participation.currentStreak).toBe(1);
    expect(repeat.participation.daysCompleted).toBe(1);
    expect(repeat.participation.bestStreak).toBe(1);
    expect(repeat.participation.logsAccepted).toBe(3);

    // Consecutive complete day advances; a gap resets but preserves best.
    await log('water-intake', '2026-06-11');
    const day2 = await log('sleep-8h', '2026-06-11');
    expect(day2.participation.currentStreak).toBe(2);
    await log('water-intake', '2026-06-14');
    const reset = await log('sleep-8h', '2026-06-14');
    expect(reset.participation.currentStreak).toBe(1);
    expect(reset.participation.bestStreak).toBe(2);
    expect(reset.participation.daysCompleted).toBe(3);
  });

  it('streak: completion at required days keeps the challenge open', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      required_consecutive_days: 2,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const resolvers = resolversFor(setup.pins);
    await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }), resolvers,
      { now: T('2026-06-10T12:00:00Z') },
    );
    const done = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ occurred_at: T('2026-06-11T12:00:00Z'), client_key: next('key') }), resolvers,
      { now: T('2026-06-11T12:00:00Z') },
    );
    expect(done.participation.completionStatus).toBe('completed');
    expect(done.completionTriggered).toBe(true);
    const status = await db.query<{ status: string }>(
      'SELECT status FROM challenges WHERE challenge_id = $1', [setup.challengeId],
    );
    expect(status.rows[0].status).toBe('active');
  });
});

describe('derived truth', () => {
  async function storedTruth(challengeId: string) {
    const db = testDb();
    const parts = await db.query('SELECT * FROM challenge_participation_derived');
    const chall = await db.query('SELECT * FROM challenge_derived_state WHERE challenge_id = $1', [challengeId]);
    const states: Record<string, object> = {};
    for (const row of parts.rows as Record<string, unknown>[]) {
      if (String(row.challenge_id) !== challengeId) continue;
      const n = normalizeParticipationDerived(row);
      const { participation_id: _pid, challenge_id: _cid, member_id: _mid, engine_version: _e, scoring_version: _s, updated_at: _u, ...state } = n;
      states[String(row.participation_id)] = state;
    }
    const c = normalizeChallengeDerived(chall.rows[0] as Record<string, unknown>);
    const { challenge_id: _c, challenge_type: _t, engine_version: _e2, scoring_version: _s2, updated_at: _u2, ...challenge } = c;
    return { states, challenge };
  }

  it('recomputes collective truth deterministically from application records', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'collective',
      goal_value: 1000,
      goal_unit: 'reps',
      activities: [pushUp()],
    });
    const memberB = await seedMember(db, next('member-b'));
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: memberB, joinedAt: '2026-06-01T00:00:00Z',
    });
    const resolvers = resolversFor(setup.pins);
    await applyChallengeActivity(db, setup.memberId, setup.challengeId,
      logInput({ value: 600, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }), resolvers);
    await applyChallengeActivity(db, memberB, setup.challengeId,
      logInput({ value: 500, occurred_at: T('2026-06-11T12:00:00Z'), client_key: next('key') }), resolvers);

    const recomputed = await recomputeChallengeDerived(db, setup.challengeId);
    expect(recomputed.recordsReplayed).toBe(2);
    const stored = await storedTruth(setup.challengeId);
    expect(recomputed.participations).toEqual(stored.states);
    expect(recomputed.challenge).toEqual(stored.challenge);
    expect(recomputed.challenge.collectiveTotal).toBe(1100);
    // Derived points equal the accepted records' server-scored points: no
    // direct Evidence-to-engine path exists anywhere in the fold.
    const points = await db.query<{ sum: string }>(
      'SELECT SUM(points_awarded) AS sum FROM challenge_activity_records WHERE challenge_id = $1',
      [setup.challengeId],
    );
    const partPoints = Object.values(recomputed.participations)
      .reduce((sum, p) => sum + p.totalPoints, 0);
    expect(partPoints).toBe(Number(points.rows[0].sum));
  });

  it('recomputes competitive and streak truth deterministically', async () => {
    const db = testDb();
    const comp = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: comp.challengeId, memberId: comp.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const compResolvers = resolversFor(comp.pins);
    await applyChallengeActivity(db, comp.memberId, comp.challengeId,
      logInput({ value: 60, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }), compResolvers);
    await applyChallengeActivity(db, comp.memberId, comp.challengeId,
      logInput({ value: 50, occurred_at: T('2026-06-11T12:00:00Z'), client_key: next('key') }), compResolvers);
    const recomp = await recomputeChallengeDerived(db, comp.challengeId);
    expect(recomp.recordsReplayed).toBe(2);
    const storedComp = await storedTruth(comp.challengeId);
    expect(recomp.participations).toEqual(storedComp.states);
    expect(recomp.challenge).toEqual(storedComp.challenge);

    const streak = await setupActiveChallenge({
      challenge_type: 'streak',
      required_consecutive_days: 30,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: streak.challengeId, memberId: streak.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const streakResolvers = resolversFor(streak.pins);
    // EBC-03: clock advances with each log's own Challenge day.
    await applyChallengeActivity(db, streak.memberId, streak.challengeId,
      logInput({ value: 20, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }), streakResolvers,
      { now: T('2026-06-10T12:00:00Z') });
    await applyChallengeActivity(db, streak.memberId, streak.challengeId,
      logInput({ value: 20, occurred_at: T('2026-06-12T12:00:00Z'), client_key: next('key') }), streakResolvers,
      { now: T('2026-06-12T12:00:00Z') });
    const restreak = await recomputeChallengeDerived(db, streak.challengeId);
    const storedStreak = await storedTruth(streak.challengeId);
    expect(restreak.participations).toEqual(storedStreak.states);
    const onlyPart = Object.values(restreak.participations)[0];
    expect(onlyPart.currentStreak).toBe(1);
    expect(onlyPart.bestStreak).toBe(1);
  });

  it('clients cannot write Derived Truth: the route rejects derived fields', async () => {
    const db = testDb();
    const subject = next('route-derived');
    const memberId = await seedMember(db, subject);
    const groupId = await seedGroup(db, { name: `C2B Derived ${subject}` });
    await seedMembership(db, groupId, memberId, { status: 'active' });
    const pin = await seedKnowledge(db, 'push-up', 'fitness');
    const { challenge } = await createChallenge(db, {
      group_id: groupId,
      created_by_member_id: memberId,
      challenge_type: 'competitive',
      title: 'Derived guard',
      start_date: DAY_START,
      end_date: DAY_END,
      activities: [pushUp()],
    }, creationResolvers({ 'push-up': pin }));
    await activateChallenge(db, challenge.challenge_id);
    await insertEpisode(db, {
      challengeId: challenge.challenge_id, memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const app = buildTestApp({ 'tok-derived': subject }, {
      challengeActivity: {
        groupMembershipAuthority: {
          resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
        },
      },
    });
    for (const forged of [
      { collectiveTotal: 9999 },
      { completion_status: 'completed' },
      { currentStreak: 99 },
      { cumulativeLoggedValue: 5000 },
    ]) {
      const rejected = await app.inject({
        method: 'POST',
        url: `/v1/challenges/${challenge.challenge_id}/activity`,
        headers: authHeaders('tok-derived'),
        payload: {
          activity_kind: 'fitness',
          canonical_key: 'push-up',
          value: 20,
          unit: 'reps',
          occurred_at: '2026-06-10T12:00:00Z',
          client_key: next('route-key'),
          ...forged,
        },
      });
      expect(rejected.statusCode).toBe(400);
    }
    const derived = await db.query('SELECT COUNT(*) AS count FROM challenge_participation_derived');
    expect(Number(derived.rows[0].count)).toBe(0);
  });
});

describe('lifecycle / period', () => {
  it('refuses establishment and ended challenges and out-of-window Evidence', async () => {
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
    const resolvers = resolversFor(setup.pins);

    // Establishment: a non-activated challenge is not yet loggable.
    const est = await createChallenge(db, {
      group_id: setup.groupId,
      created_by_member_id: setup.memberId,
      challenge_type: 'competitive',
      title: 'Not yet active',
      start_date: DAY_START,
      end_date: DAY_END,
      activities: [pushUp()],
    }, creationResolvers(setup.pins));
    await insertEpisode(db, {
      challengeId: est.challenge.challenge_id,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const notActive = await applyErr(applyChallengeActivity(
      db, setup.memberId, est.challenge.challenge_id,
      logInput({ client_key: next('key') }), resolvers,
    ));
    expect(notActive.code).toBe('challenge_not_active');

    // Ended directly: no ordinary logging.
    await endChallenge(db, setup.challengeId);
    const ended = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId, logInput({ client_key: next('key') }), resolvers,
    ));
    expect(ended.code).toBe('challenge_not_active');
  });

  it('rejects Evidence outside the governing period', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-05-01T00:00:00Z',
    });
    const resolvers = resolversFor(setup.pins);
    const early = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ occurred_at: T('2026-05-20T12:00:00Z'), client_key: next('key') }), resolvers,
    ));
    expect(early.code).toBe('outside_challenge_window');
    const late = await applyErr(applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ occurred_at: T('2026-07-05T12:00:00Z'), client_key: next('key') }), resolvers,
    ));
    expect(late.code).toBe('outside_challenge_window');
    expect(await tableCounts()).toEqual({ events: 0, records: 0 });
  });
});

describe('config version at acceptance', () => {
  it('pins the current version and scores under its targets', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    // Mid-challenge config change: target doubles under version 2.
    await addChallengeConfigVersion(db, setup.challengeId, {
      activities: [pushUp({ target_value: 200 })],
    }, creationResolvers(setup.pins));
    const resolvers = resolversFor(setup.pins);
    // Backdated Evidence (before version 2 existed) is still governed by the
    // current version at acceptance — the documented C2B rule.
    const result = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 200, occurred_at: T('2026-06-05T12:00:00Z'), client_key: next('key') }),
      resolvers,
    );
    expect(result.record.config_version).toBe(2);
    expect(result.record.scoring_target_value).toBe(200);
    expect(result.record.points_awarded).toBe(100);
  });
});

describe('correction readiness', () => {
  it('recompute excludes superseded Evidence while history stays immutable', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'collective',
      goal_value: 1000,
      goal_unit: 'reps',
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId,
      memberId: setup.memberId,
      joinedAt: '2026-06-01T00:00:00Z',
    });
    const resolvers = resolversFor(setup.pins);
    const first = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 100, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }),
      resolvers,
    );
    await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 200, occurred_at: T('2026-06-11T12:00:00Z'), client_key: next('key') }),
      resolvers,
    );
    // Governed correction arrives as a NEW event superseding the first; the
    // accepted application row is never mutated (no user/admin correction
    // authority is implemented here — only the recompute seam is proven).
    await appendCorrectionEvent(db, {
      member_id: setup.memberId,
      activity_kind: 'fitness',
      canonical_key: 'push-up',
      occurred_at: T('2026-06-10T12:00:00Z'),
      value: 0,
      unit: 'reps',
      client_key: next('correction-key'),
      supersedes_event_id: first.event.event_id,
      correction_kind: 'correction',
    }, { resolveKnowledgePin: resolvers.resolveKnowledgePin });

    const recomputed = await recomputeChallengeDerived(db, setup.challengeId);
    expect(recomputed.recordsReplayed).toBe(1);
    expect(recomputed.challenge.collectiveTotal).toBe(200);
    // Stored history is untouched: two application rows still exist.
    const records = await db.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM challenge_activity_records WHERE challenge_id = $1',
      [setup.challengeId],
    );
    expect(Number(records.rows[0].count)).toBe(2);
    const stored = await db.query<{ collective_total: number }>(
      'SELECT collective_total FROM challenge_derived_state WHERE challenge_id = $1',
      [setup.challengeId],
    );
    expect(Number(stored.rows[0].collective_total)).toBe(300);
  });
});

describe('boundaries', () => {
  it('leaves the C1 Evidence schema untouched', async () => {
    const columns = await testDb().query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'member_activity_events' ORDER BY column_name`,
    );
    expect(columns.rows.map((r) => r.column_name)).toEqual([
      'activity_kind', 'activity_variant', 'canonical_key', 'client_key',
      'correction_kind', 'event_id', 'knowledge_id', 'knowledge_version',
      'member_id', 'metadata', 'occurred_at', 'occurred_day', 'occurred_tz',
      'recorded_at', 'status', 'supersedes_event_id', 'unit', 'value',
    ]);
  });

  it('keeps Firebase and V1 shapes out of the C2B domain and route modules', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const strip = (content: string): string => content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/.*$/gm, '$1');
    const domain = [
      '../src/challengeActivityApplication.ts',
      '../src/derivedTruth.ts',
      '../src/knowledgePins.ts',
      '../src/challengeActivityRoutes.ts',
    ];
    for (const module of domain) {
      const path = fileURLToPath(new URL(module, import.meta.url));
      const code = strip(readFileSync(path, 'utf8'));
      expect(code, `${module} firebase`).not.toMatch(/from\s+['"]firebase[^'"]*['"]/);
      // Word-boundaried: the legitimate GroupMembershipAuthority domain
      // contract must not trip the V1 groupMembers collection check.
      expect(code, `${module} v1 shape`).not.toMatch(/\bworkouts\b|\bwellnessLogs\b|\bchallengeMembers\b|\bgroupMembers\b|FieldValue/);
    }
    // The Firestore authority adapter is the single permitted exception.
    const adapter = strip(readFileSync(
      fileURLToPath(new URL('../src/firestoreGroupAuthority.ts', import.meta.url)), 'utf8'));
    expect(adapter).toMatch(/firebase-admin\/firestore/);
    expect(adapter).not.toMatch(/\.set\(|\.update\(|\.add\(/);
  });
});

describe('firestore authority adapter', () => {
  async function adapterSetup() {
    const db = testDb();
    const tag = next('authority');
    const memberId = await seedMember(db, `uid-${tag}`);
    const groupId = await seedGroup(db, { legacyId: `legacy-${tag}`, name: `Authority ${tag}` });
    return { db, memberId, groupId, legacyId: `legacy-${tag}`, uid: `uid-${tag}` };
  }

  it('authorizes live membership and reports its status', async () => {
    const { db, memberId, groupId, legacyId, uid } = await adapterSetup();
    const authority = createFirestoreGroupMembershipAuthority(db, fakeReader({
      [`groups/${legacyId}`]: { status: 'active' },
      [`groupMembers/${legacyId}_${uid}`]: { status: 'joined', role: 'member' },
    }));
    const result = await authority.resolveGroupMembershipAuthority(groupId, memberId);
    expect(result).toEqual({ status: 'joined', eligible: true });
  });

  it('fails closed on missing mapping, inactive group and non-eligible status', async () => {
    const { db, memberId, groupId, legacyId, uid } = await adapterSetup();
    // Missing PG mapping (group without legacy id) -> null.
    const unmappedGroup = await seedGroup(db, { name: 'unmapped' });
    const authority = createFirestoreGroupMembershipAuthority(db, fakeReader({}));
    expect(await authority.resolveGroupMembershipAuthority(unmappedGroup, memberId)).toBeNull();

    const groupGone = createFirestoreGroupMembershipAuthority(db, fakeReader({}));
    expect(await groupGone.resolveGroupMembershipAuthority(groupId, memberId))
      .toEqual({ status: 'group_missing', eligible: false });

    const groupInactive = createFirestoreGroupMembershipAuthority(db, fakeReader({
      [`groups/${legacyId}`]: { status: 'archived' },
      [`groupMembers/${legacyId}_${uid}`]: { status: 'active' },
    }));
    expect((await groupInactive.resolveGroupMembershipAuthority(groupId, memberId))?.eligible).toBe(false);

    const removed = createFirestoreGroupMembershipAuthority(db, fakeReader({
      [`groups/${legacyId}`]: { status: 'active' },
      [`groupMembers/${legacyId}_${uid}`]: { status: 'left' },
    }));
    expect(await removed.resolveGroupMembershipAuthority(groupId, memberId))
      .toEqual({ status: 'left', eligible: false });

    const missing = createFirestoreGroupMembershipAuthority(db, fakeReader({
      [`groups/${legacyId}`]: { status: 'active' },
    }));
    expect(await missing.resolveGroupMembershipAuthority(groupId, memberId))
      .toEqual({ status: 'no_membership', eligible: false });
  });

  it('propagates authority outages instead of treating them as non-membership', async () => {
    const { db, memberId, groupId } = await adapterSetup();
    const authority = createFirestoreGroupMembershipAuthority(db, {
      async getDocument() {
        throw new Error('firestore offline');
      },
    });
    await expect(authority.resolveGroupMembershipAuthority(groupId, memberId))
      .rejects.toThrow('firestore offline');
  });
});

describe('knowledge pin resolver', () => {
  it('resolves published names exactly and rejects everything else', async () => {
    const db = testDb();
    const pin = await seedKnowledge(db, 'push-up', 'fitness');
    expect(await resolveKnowledgePinByName(db, 'fitness', 'push-up')).toEqual(pin);
    expect(await resolveKnowledgePinByName(db, 'wellness', 'push-up')).toBeNull();
    expect(await resolveKnowledgePinByName(db, 'fitness', 'Push-Up')).toBeNull();
    await seedKnowledge(db, 'retired-move', 'fitness', 'retired');
    expect(await resolveKnowledgePinByName(db, 'fitness', 'retired-move')).toBeNull();
    await seedKnowledge(db, 'push-up', 'fitness');
    expect(await resolveKnowledgePinByName(db, 'fitness', 'push-up')).toBeNull();
  });
});

describe('config version pinning and replay (CORR-001)', () => {
  async function snapshotTarget(db: Db, challengeId: string, version: number): Promise<number> {
    const row = await db.query<{ snapshot: unknown }>(
      `SELECT snapshot FROM challenge_config_versions WHERE challenge_id = $1 AND version = $2`,
      [challengeId, version],
    );
    const snapshot = row.rows[0].snapshot;
    const parsed = (typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot) as {
      activities: Array<{ target_value: number }>;
      type_params: Record<string, number | null>;
    };
    return Number(parsed.activities[0].target_value);
  }

  async function storedVsRecomputed(challengeId: string) {
    const db = testDb();
    const recomputed = await recomputeChallengeDerived(db, challengeId);
    const parts = await db.query('SELECT * FROM challenge_participation_derived WHERE challenge_id = $1', [challengeId]);
    const chall = await db.query('SELECT * FROM challenge_derived_state WHERE challenge_id = $1', [challengeId]);
    const states: Record<string, object> = {};
    for (const row of parts.rows as Record<string, unknown>[]) {
      const n = normalizeParticipationDerived(row);
      const { participation_id: _p, challenge_id: _c, member_id: _m, engine_version: _e, scoring_version: _s, updated_at: _u, ...state } = n;
      states[String(row.participation_id)] = state;
    }
    const c = normalizeChallengeDerived(chall.rows[0] as Record<string, unknown>);
    const { challenge_id: _cc, challenge_type: _t, engine_version: _e2, scoring_version: _s2, updated_at: _u2, ...challenge } = c;
    expect(recomputed.participations).toEqual(states);
    expect(recomputed.challenge).toEqual(challenge);
    return recomputed;
  }

  it('acceptance pins the current version; backdated logs use current terms; pins are permanent', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const resolvers = resolversFor(setup.pins);
    const r1 = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 60, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }), resolvers,
    );
    expect(r1.record.config_version).toBe(1);
    expect(r1.record.scoring_target_value).toBe(100);
    expect(r1.record.points_awarded).toBe(60);

    await addChallengeConfigVersion(db, setup.challengeId, {
      activities: [pushUp({ target_value: 200 })],
    }, creationResolvers(setup.pins));
    // Backdated Evidence (before v2 existed) is still governed by current v2.
    const r2 = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 50, occurred_at: T('2026-06-05T12:00:00Z'), client_key: next('key') }), resolvers,
    );
    expect(r2.record.config_version).toBe(2);
    expect(r2.record.scoring_target_value).toBe(200);
    expect(r2.record.points_awarded).toBe(25);

    await addChallengeConfigVersion(db, setup.challengeId, {
      activities: [pushUp({ target_value: 300 })],
    }, creationResolvers(setup.pins));
    // Historical pins never move: r1 still carries v1 terms after two bumps.
    const stored1 = await db.query<Record<string, unknown>>(
      `SELECT config_version, scoring_target_value, points_awarded FROM challenge_activity_records WHERE record_id = $1`,
      [r1.record.record_id],
    );
    expect(Number(stored1.rows[0].config_version)).toBe(1);
    expect(Number(stored1.rows[0].scoring_target_value)).toBe(100);
    expect(Number(stored1.rows[0].points_awarded)).toBe(60);
    // The pinned snapshots stay identifiable: v1 terms intact beside v2/v3.
    expect(await snapshotTarget(db, setup.challengeId, 1)).toBe(100);
    expect(await snapshotTarget(db, setup.challengeId, 2)).toBe(200);
    await storedVsRecomputed(setup.challengeId);
  });

  it('concurrent config change cannot produce a mixed-version application', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const resolvers = resolversFor(setup.pins);
    const day = (n: number): Date => T(`2026-06-${String(10 + n).padStart(2, '0')}T12:00:00Z`);
    // Race acceptances against a governing version bump. Either side may win,
    // but no accepted record may mix terms from two versions.
    const [, ...results] = await Promise.all([
      addChallengeConfigVersion(db, setup.challengeId, {
        activities: [pushUp({ target_value: 200 })],
      }, creationResolvers(setup.pins)).catch((error: Error) => error),
      ...[0, 1, 2, 3].map((n) => applyChallengeActivity(
        db, setup.memberId, setup.challengeId,
        logInput({ value: 40, occurred_at: day(n), client_key: `race-${n}` }), resolvers,
      ).catch((error: Error) => error)),
    ]);
    const accepted = results.filter(
      (r): r is Exclude<typeof r, Error> => !(r instanceof Error),
    );
    expect(accepted.length).toBeGreaterThan(0);
    for (const result of accepted) {
      const row = await db.query<Record<string, unknown>>(
        `SELECT r.config_version, r.scoring_target_value, r.points_awarded, r.value,
                c.target_value AS row_target, c.unit AS row_unit,
                r.activity_config_id AS record_config, c.activity_config_id AS row_config
         FROM challenge_activity_records r
         JOIN challenge_activity_configs c ON c.activity_config_id = r.activity_config_id
         WHERE r.record_id = $1`,
        [result.record.record_id],
      );
      const found = row.rows[0];
      // Record, activity row, and scoring attribution all agree on one version.
      expect(Number(found.config_version)).toBe(Number((await db.query<{ version: number }>(
        `SELECT version FROM challenge_activity_configs WHERE activity_config_id = $1`,
        [String(found.record_config)],
      )).rows[0].version));
      expect(Number(found.scoring_target_value)).toBe(Number(found.row_target));
      expect(String(found.record_config)).toBe(String(found.row_config));
      expect(Number(found.points_awarded)).toBe(computeActivityScore({
        value: Number(found.value),
        targetValue: Number(found.row_target),
        challengeType: 'competitive',
      }).pointsEarned);
      // The pinned snapshot for that version exists and carries the same terms.
      expect(await snapshotTarget(db, setup.challengeId, Number(found.config_version)))
        .toBe(Number(found.row_target));
    }
    await storedVsRecomputed(setup.challengeId);
  });

  it('replay uses v1 snapshot for record 1 and v2 for later records', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const resolvers = resolversFor(setup.pins);
    const r1 = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 60, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }), resolvers,
    );
    await addChallengeConfigVersion(db, setup.challengeId, {
      activities: [pushUp({ target_value: 200 })],
    }, creationResolvers(setup.pins));
    const r2 = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 50, occurred_at: T('2026-06-11T12:00:00Z'), client_key: next('key') }), resolvers,
    );
    const r3 = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 100, occurred_at: T('2026-06-12T12:00:00Z'), client_key: next('key') }), resolvers,
    );
    expect([r1.record.config_version, r2.record.config_version, r3.record.config_version])
      .toEqual([1, 2, 2]);
    // Progress carries across versions on stable canonical identity ...
    expect(r3.participation.cumulativeValues['push-up::']).toBe(210);
    // ... and completion is evaluated under each record's own version terms:
    // 110/200 after r2 is not complete; 210/200 after r3 is.
    expect(r2.participation.completionStatus).toBe('in_progress');
    expect(r3.participation.completionStatus).toBe('completed');
    expect(r3.participation.completedAt).toBe(r3.record.accepted_at);
    expect(r3.participation.totalPoints).toBe(60 + 25 + 50);
    const recomputed = await storedVsRecomputed(setup.challengeId);
    expect(recomputed.recordsReplayed).toBe(3);
  });

  it('later current mirrors do not reinterpret historical records', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 100 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const resolvers = resolversFor(setup.pins);
    await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 40, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }), resolvers,
    );
    await addChallengeConfigVersion(db, setup.challengeId, {
      activities: [pushUp({ target_value: 500 })],
    }, creationResolvers(setup.pins));
    await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 40, occurred_at: T('2026-06-11T12:00:00Z'), client_key: next('key') }), resolvers,
    );
    // Absolute version-correct outcomes: 40/100 + 40/500, NOT collapsed onto v3.
    const before = await storedVsRecomputed(setup.challengeId);
    const onlyPart = Object.values(before.participations)[0];
    expect(onlyPart.totalPoints).toBe(48);
    expect(onlyPart.cumulativeValues['push-up::']).toBe(80);

    // Later governing change (new target + extended period) ...
    await addChallengeConfigVersion(db, setup.challengeId, {
      activities: [pushUp({ target_value: 1000 })],
      end_date: '2026-07-31',
    }, creationResolvers(setup.pins));
    // ... plus a non-governing mirror edit (title needs no version bump) ...
    await db.query(`UPDATE challenges SET title = 'Renamed mirrors' WHERE challenge_id = $1`, [setup.challengeId]);
    // ... leave historical replay exactly unchanged.
    const after = await storedVsRecomputed(setup.challengeId);
    expect(after.participations).toEqual(before.participations);
    expect(after.challenge).toEqual(before.challenge);
  });

  it('collective goal transition replays deterministically under each version', async () => {
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
    const resolvers = resolversFor(setup.pins);
    const r1 = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 600, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }), resolvers,
    );
    expect(r1.completionTriggered).toBe(false);
    // Approved goal change: 1000 -> 800. The 600 already banked under v1
    // replays against v1 terms (no completion at 600/1000).
    await addChallengeConfigVersion(db, setup.challengeId, {
      activities: [pushUp()],
      goal_value: 800,
    }, creationResolvers(setup.pins));
    const r2 = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 300, occurred_at: T('2026-06-11T12:00:00Z'), client_key: next('key') }), resolvers,
    );
    // Crossing happens under v2 terms (900 >= 800); under v1 terms for all,
    // 900 < 1000 would have left the challenge active.
    expect(r2.completionTriggered).toBe(true);
    expect(r2.record.completion_triggered).toBe(true);
    expect(r1.record.completion_triggered).toBe(false);
    expect(r2.challenge.collectiveTotal).toBe(900);
    const status = await db.query<{ status: string }>(
      'SELECT status FROM challenges WHERE challenge_id = $1', [setup.challengeId],
    );
    expect(status.rows[0].status).toBe('ended');
    expect(r2.challenge.goalCompletedAt).toBe(r2.record.accepted_at);
    const recomputed = await storedVsRecomputed(setup.challengeId);
    expect(recomputed.recordsReplayed).toBe(2);
    expect(recomputed.challenge.collectiveTotal).toBe(900);
    expect(recomputed.challenge.collectiveGoalReached).toBe(true);
  });

  it('streak requirement transition replays deterministically under each version', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'streak',
      required_consecutive_days: 2,
      activities: [pushUp()],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const resolvers = resolversFor(setup.pins);
    // EBC-03: clock advances with each log's own Challenge day.
    const log = (day: string) => applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 20, occurred_at: T(`${day}T12:00:00Z`), client_key: next('key') }), resolvers,
      { now: T(`${day}T12:00:00Z`) },
    );
    await log('2026-06-10');
    const r2 = await log('2026-06-11');
    // Completed under v1 terms (2 consecutive). Under retroactive v2 terms
    // (required 5) this completion could never have happened.
    expect(r2.participation.completionStatus).toBe('completed');
    expect(r2.participation.currentStreak).toBe(2);
    await addChallengeConfigVersion(db, setup.challengeId, {
      activities: [pushUp()],
      required_consecutive_days: 5,
    }, creationResolvers(setup.pins));
    const r3 = await log('2026-06-12');
    const r4 = await log('2026-06-13');
    expect(r4.participation.currentStreak).toBe(4);
    expect(r4.participation.bestStreak).toBe(4);
    // First completion stands: later versions never move completed_at.
    expect(r4.participation.completedAt).toBe(r2.participation.completedAt);
    expect(r4.participation.completedAt).toBe(r2.record.accepted_at);
    // Streak period/params come from pinned snapshots; current mirrors agree.
    const recomputed = await storedVsRecomputed(setup.challengeId);
    expect(recomputed.recordsReplayed).toBe(4);
    expect(r3.record.config_version).toBe(2);
    expect(r4.record.config_version).toBe(2);
  });

  it('immutable older Knowledge pin survives later canonical revision', async () => {
    const db = testDb();
    const setup = await setupActiveChallenge({
      challenge_type: 'competitive',
      activities: [pushUp({ target_value: 20 })],
    });
    await insertEpisode(db, {
      challengeId: setup.challengeId, memberId: setup.memberId, joinedAt: '2026-06-01T00:00:00Z',
    });
    const knowledgeId = setup.pins['push-up'].knowledge_id;
    // Canonical Knowledge revised v1 -> v2 (same identity, new content).
    // (PKG-2A-CORR: published revisions satisfy the KCS gate.)
    const revised = await reviseKnowledgeItem(db, knowledgeId, {
      name: 'push-up',
      category: 'Upper Body',
      difficulty: 'Beginner',
      metricUnit: 'reps',
      description: 'A pressing movement',
      measurementGuidance: 'Count full-range repetitions',
      safetyNotes: ['Stop on sharp pain'],
    });
    expect(revised.knowledgeVersion).toBe(2);
    // Production resolution now returns the v2 pin for the same identity.
    const livePin = await resolveKnowledgePinByName(db, 'fitness', 'push-up');
    expect(livePin).toEqual({ knowledge_id: knowledgeId, current_version: 2 });
    const result = await applyChallengeActivity(
      db, setup.memberId, setup.challengeId,
      logInput({ value: 20, occurred_at: T('2026-06-10T12:00:00Z'), client_key: next('key') }),
      resolversFor({ 'push-up': livePin as { knowledge_id: string; current_version: number } }),
    );
    // Logging succeeds under the Challenge's pinned v1 terms ...
    expect(result.record.scoring_target_value).toBe(20);
    expect(result.record.points_awarded).toBe(100);
    expect(result.event.knowledge_version).toBe(2);
    // ... and the Challenge pin is never rewritten to v2.
    const config = await db.query<{ knowledge_version: number }>(
      `SELECT knowledge_version FROM challenge_activity_configs WHERE activity_config_id = $1`,
      [result.record.activity_config_id],
    );
    expect(Number(config.rows[0].knowledge_version)).toBe(1);
    await storedVsRecomputed(setup.challengeId);
  });
});
