import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateChallenge,
  createChallenge,
  endChallenge,
  getChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import {
  addChallengeConfigVersion,
  getChallengeConfig,
  type ActivityConfigInput,
  type ChallengeConfigResolvers,
} from '../src/challengeConfigs.js';
import {
  getActiveParticipation,
  isParticipationActiveAt,
  joinChallenge,
  listParticipations,
  removeParticipation,
  withdrawParticipation,
} from '../src/challengeParticipations.js';
import { appendActivityEvent, listEffectiveEvents } from '../src/activityEvents.js';
import { testDb, seedMember, seedGroup, seedMembership } from './helpers.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, member_activity_events',
  );
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let seq = 0;

async function seedKnowledgePin(
  kind: 'fitness' | 'wellness' = 'fitness',
): Promise<{ knowledge_id: string; current_version: number }> {
  seq += 1;
  const result = await testDb().query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name) VALUES ($1, $2)
     RETURNING knowledge_id, current_version`,
    [kind, `C2A-Activity-${seq}`],
  );
  return {
    knowledge_id: String(result.rows[0].knowledge_id),
    current_version: Number(result.rows[0].current_version),
  };
}

function resolversFor(
  pins: Record<string, { knowledge_id: string; current_version: number }>,
  groupAuthority: { status: string } | null = { status: 'active' },
): ChallengeCreationResolvers {
  return {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveGroupAuthority: async () => groupAuthority,
  };
}

async function setupGroupWithMember(uid: string): Promise<{ groupId: string; memberId: string }> {
  const db = testDb();
  const memberId = await seedMember(db, uid);
  const groupId = await seedGroup(db, { name: `C2A Group ${uid}` });
  await seedMembership(db, groupId, memberId, { status: 'active' });
  return { groupId, memberId };
}

function pushUp(overrides?: Partial<ActivityConfigInput>): ActivityConfigInput {
  return { canonical_key: 'push-up', target_value: 20, unit: 'reps', ...overrides };
}

function waterIntake(overrides?: Partial<ActivityConfigInput>): ActivityConfigInput {
  return { canonical_key: 'water-intake', target_value: 2000, unit: 'ml', ...overrides };
}

function collectiveInput(groupId: string, memberId: string): NewChallengeInput {
  return {
    group_id: groupId,
    created_by_member_id: memberId,
    challenge_type: 'collective',
    title: 'Group 1000 Push-Ups',
    start_date: '2026-06-01',
    end_date: '2026-06-30',
    goal_value: 1000,
    goal_unit: 'reps',
    activities: [pushUp()],
  };
}

describe('valid Challenge creation per family', () => {
  it('creates a collective challenge with version-1 governing config', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-coll-${seq}`);
    const pin = await seedKnowledgePin();
    const { challenge, version, activities } = await createChallenge(
      db,
      collectiveInput(groupId, memberId),
      resolversFor({ 'push-up': pin }),
    );
    expect(challenge.challenge_id).toMatch(UUID_RE);
    expect(challenge.group_id).toBe(groupId);
    expect(challenge.created_by_member_id).toBe(memberId);
    expect(challenge.status).toBe('establishment');
    expect(challenge.current_config_version).toBe(1);
    expect(challenge.goal_value).toBe(1000);
    expect(version.version).toBe(1);
    expect(version.snapshot).toMatchObject({
      challenge_type: 'collective',
      period: { start_date: '2026-06-01', end_date: '2026-06-30' },
    });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      canonical_key: 'push-up',
      knowledge_id: pin.knowledge_id,
      knowledge_version: pin.current_version,
      target_value: 20,
      unit: 'reps',
    });
    expect(activities[0].activity_config_id).toMatch(UUID_RE);
  });

  it('creates competitive and streak challenges with family params', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-fam-${seq}`);
    const fitness = await seedKnowledgePin('fitness');
    const wellness = await seedKnowledgePin('wellness');
    const resolvers = resolversFor({ 'push-up': fitness, 'water-intake': wellness });
    const competitive = await createChallenge(
      db,
      {
        group_id: groupId,
        created_by_member_id: memberId,
        challenge_type: 'competitive',
        title: 'Race to 50',
        start_date: '2026-06-01',
        end_date: '2026-06-30',
        activities: [pushUp({ target_value: 50 }), waterIntake()],
      },
      resolvers,
    );
    expect(competitive.challenge.goal_value).toBeNull();
    expect(competitive.activities).toHaveLength(2);
    const streak = await createChallenge(
      db,
      {
        group_id: groupId,
        created_by_member_id: memberId,
        challenge_type: 'streak',
        title: 'Daily 10',
        start_date: '2026-06-01',
        end_date: '2026-06-07',
        required_consecutive_days: 5,
        activities: [pushUp({ target_value: 10 })],
      },
      resolvers,
    );
    expect(streak.challenge.required_consecutive_days).toBe(5);
    expect(streak.challenge.reset_on_miss).toBe(true);
  });

  it('supports fitness + wellness canonical activities in one challenge', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-mix-${seq}`);
    const fitness = await seedKnowledgePin('fitness');
    const wellness = await seedKnowledgePin('wellness');
    const { activities } = await createChallenge(
      db,
      {
        group_id: groupId,
        created_by_member_id: memberId,
        challenge_type: 'competitive',
        title: 'Mixed week',
        start_date: '2026-06-01',
        end_date: '2026-06-07',
        activities: [pushUp(), waterIntake({ activity_variant: 'morning' })],
      },
      resolversFor({ 'push-up': fitness, 'water-intake': wellness }),
    );
    expect(activities.map((a) => a.canonical_key).sort()).toEqual(['push-up', 'water-intake']);
    expect(activities.find((a) => a.canonical_key === 'water-intake')!.activity_variant).toBe('morning');
    expect(activities.find((a) => a.canonical_key === 'water-intake')!.knowledge_id).toBe(wellness.knowledge_id);
  });
});

describe('invalid Challenge configuration', () => {
  it('rejects unknown canonical activities atomically (no partial challenge)', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-bad-${seq}`);
    const pin = await seedKnowledgePin();
    await expect(
      createChallenge(db, collectiveInput(groupId, memberId), resolversFor({})),
    ).rejects.toThrow(/unknown activity/);
    void pin;
    const count = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM challenges`);
    expect(count.rows[0].n).toBe('0');
  });

  it('rejects cross-family params, bad periods, and non-UUID identity', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-inv-${seq}`);
    const pin = await seedKnowledgePin();
    const resolvers = resolversFor({ 'push-up': pin });
    const base = collectiveInput(groupId, memberId);
    await expect(
      createChallenge(db, { ...base, goal_value: undefined }, resolvers),
    ).rejects.toThrow(/shared goal_value/);
    await expect(
      createChallenge(
        db,
        { ...base, challenge_type: 'competitive', goal_value: 10, goal_unit: 'reps' },
        resolvers,
      ),
    ).rejects.toThrow(/collective challenges only/);
    await expect(
      createChallenge(
        db,
        { ...base, challenge_type: 'streak', goal_value: undefined, goal_unit: undefined },
        resolvers,
      ),
    ).rejects.toThrow(/required_consecutive_days/);
    await expect(
      createChallenge(db, { ...base, start_date: '2026-07-01', end_date: '2026-06-01' }, resolvers),
    ).rejects.toThrow(/end_date/);
    await expect(
      createChallenge(db, { ...base, group_id: 'group-fs-1' }, resolvers),
    ).rejects.toThrow(/Tiizi group UUID/);
    await expect(
      createChallenge(db, { ...base, group_id: '00000000-0000-4000-8000-000000000000' }, resolvers),
    ).rejects.toThrow(/challenge insert rejected/);
  });
});

describe('configuration version immutability + reproducibility', () => {
  it('appends v2 (extension), keeps v1 readable and byte-identical', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-ver-${seq}`);
    const pin = await seedKnowledgePin();
    const resolvers = resolversFor({ 'push-up': pin });
    const { challenge } = await createChallenge(db, collectiveInput(groupId, memberId), resolvers);
    const v1 = await getChallengeConfig(db, challenge.challenge_id, 1);
    const v1Snapshot = JSON.stringify(v1.version.snapshot);
    const changed = await addChallengeConfigVersion(
      db,
      challenge.challenge_id,
      { activities: [pushUp({ target_value: 25 })], end_date: '2026-07-15' },
      resolvers,
    );
    expect(changed.version.version).toBe(2);
    expect(changed.activities[0].target_value).toBe(25);
    const current = await getChallenge(db, challenge.challenge_id);
    expect(current.current_config_version).toBe(2);
    expect(current.end_date).toBe('2026-07-15');
    const v1Again = await getChallengeConfig(db, challenge.challenge_id, 1);
    expect(JSON.stringify(v1Again.version.snapshot)).toBe(v1Snapshot);
    expect(v1Again.activities[0].target_value).toBe(20);
    const v2 = await getChallengeConfig(db, challenge.challenge_id);
    expect(v2.version.version).toBe(2);
  });

  it('rejects silent governing changes and version-row mutation', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-imm-${seq}`);
    const pin = await seedKnowledgePin();
    const resolvers = resolversFor({ 'push-up': pin });
    const { challenge } = await createChallenge(db, collectiveInput(groupId, memberId), resolvers);
    await expect(
      db.query(`UPDATE challenges SET goal_value = 5 WHERE challenge_id = $1`, [challenge.challenge_id]),
    ).rejects.toThrow(/version bump/);
    await expect(
      db.query(`UPDATE challenge_config_versions SET snapshot = '{}' WHERE challenge_id = $1`, [
        challenge.challenge_id,
      ]),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.query(`DELETE FROM challenge_activity_configs WHERE challenge_id = $1`, [challenge.challenge_id]),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.query(`UPDATE challenges SET challenge_type = 'streak' WHERE challenge_id = $1`, [
        challenge.challenge_id,
      ]),
    ).rejects.toThrow(/immutable/);
    await expect(
      db.query(`DELETE FROM challenges WHERE challenge_id = $1`, [challenge.challenge_id]),
    ).rejects.toThrow(/historical records/);
  });
});

describe('challenge lifecycle', () => {
  it('moves establishment -> active -> ended with terminal end', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-life-${seq}`);
    const pin = await seedKnowledgePin();
    const { challenge } = await createChallenge(
      db,
      collectiveInput(groupId, memberId),
      resolversFor({ 'push-up': pin }),
    );
    const active = await activateChallenge(db, challenge.challenge_id);
    expect(active.status).toBe('active');
    expect(active.activated_at).not.toBeNull();
    await expect(activateChallenge(db, challenge.challenge_id)).rejects.toThrow(/already active/);
    const ended = await endChallenge(db, challenge.challenge_id);
    expect(ended.status).toBe('ended');
    expect(ended.ended_at).not.toBeNull();
    await expect(endChallenge(db, challenge.challenge_id)).rejects.toThrow(/already ended/);
    await expect(activateChallenge(db, challenge.challenge_id)).rejects.toThrow(/reopened/);
  });

  it('blocks config change and joining on ended challenges', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-end-${seq}`);
    const pin = await seedKnowledgePin();
    const resolvers = resolversFor({ 'push-up': pin });
    const { challenge } = await createChallenge(db, collectiveInput(groupId, memberId), resolvers);
    await endChallenge(db, challenge.challenge_id);
    await expect(
      addChallengeConfigVersion(db, challenge.challenge_id, { activities: [pushUp()] }, resolvers),
    ).rejects.toThrow(/historically complete/);
    await expect(joinChallenge(db, challenge.challenge_id, memberId)).rejects.toThrow(/ended challenge/);
  });
});

describe('participation', () => {
  it('joins affirmatively with join-time eligibility and uniqueness', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-join-${seq}`);
    const outsider = await seedMember(db, `c2a-outsider-${seq}`);
    const pin = await seedKnowledgePin();
    const { challenge } = await createChallenge(
      db,
      collectiveInput(groupId, memberId),
      resolversFor({ 'push-up': pin }),
    );
    const participation = await joinChallenge(db, challenge.challenge_id, memberId);
    expect(participation.participation_id).toMatch(UUID_RE);
    expect(participation.status).toBe('active');
    expect(participation.joined_config_version).toBe(1);
    await expect(joinChallenge(db, challenge.challenge_id, memberId)).rejects.toThrow(
      /active participation episode already exists/,
    );
    await expect(joinChallenge(db, challenge.challenge_id, outsider)).rejects.toThrow(
      /active membership in the challenge group/,
    );
    await expect(
      joinChallenge(db, '00000000-0000-4000-8000-000000000000', memberId),
    ).rejects.toThrow(/unknown challenge/);
    expect(await getActiveParticipation(db, challenge.challenge_id, outsider)).toBeNull();
    expect(await listParticipations(db, challenge.challenge_id, outsider)).toEqual([]);
  });

  it('distinguishes withdrawal from removal and preserves history', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-exit-${seq}`);
    const second = await seedMember(db, `c2a-second-${seq}`);
    const { memberId: steward } = await setupGroupWithMember(`c2a-steward-${seq}`);
    const pin = await seedKnowledgePin();
    const { challenge } = await createChallenge(
      db,
      collectiveInput(groupId, memberId),
      resolversFor({ 'push-up': pin }),
    );
    const leaving = await joinChallenge(db, challenge.challenge_id, memberId);
    const withdrawn = await withdrawParticipation(db, leaving.participation_id);
    expect(withdrawn.status).toBe('withdrawn');
    expect(withdrawn.exit_reason).toBe('withdrawn');
    expect(withdrawn.exited_at).not.toBeNull();
    expect(withdrawn.exited_by_member_id).toBeNull();
    await expect(withdrawParticipation(db, leaving.participation_id)).rejects.toThrow(/only active/);
    await seedMembership(db, groupId, second, { status: 'active' });
    const removed = await joinChallenge(db, challenge.challenge_id, second).then((p) =>
      removeParticipation(db, p.participation_id, steward),
    );
    expect(removed.status).toBe('removed');
    expect(removed.exit_reason).toBe('removed');
    expect(removed.exited_by_member_id).toBe(steward);
    // History stays attributable after exit.
    const history = await listParticipations(db, challenge.challenge_id, memberId);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ status: 'withdrawn' });
    expect(await getActiveParticipation(db, challenge.challenge_id, memberId)).toBeNull();
    await expect(
      removeParticipation(db, leaving.participation_id, steward),
    ).rejects.toThrow(/only active/);
  });

  it('answers eligibility-at-time for C2B', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-elig-${seq}`);
    const pin = await seedKnowledgePin();
    const { challenge } = await createChallenge(
      db,
      collectiveInput(groupId, memberId),
      resolversFor({ 'push-up': pin }),
    );
    const before = await joinChallenge(db, challenge.challenge_id, memberId);
    const joinedAt = new Date(before.joined_at);
    expect(isParticipationActiveAt(before, new Date(joinedAt.getTime() - 1000))).toBe(false);
    expect(isParticipationActiveAt(before, new Date(joinedAt.getTime() + 1000))).toBe(true);
    // Separate exit from join so the probe below falls strictly inside the episode.
    await new Promise((resolve) => setTimeout(resolve, 25));
    const exited = await withdrawParticipation(db, before.participation_id);
    expect(isParticipationActiveAt(exited, new Date(Date.parse(exited.exited_at!) + 1000))).toBe(false);
    // Withdrawn history stays evaluable: 10ms after joining (exit came ~25ms
    // after joining) the episode was eligible.
    expect(isParticipationActiveAt(exited, new Date(joinedAt.getTime() + 10))).toBe(true);
  });
});

describe('participation episodes', () => {
  it('opens a later episode after exit while keeping history', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-ep-${seq}`);
    const pin = await seedKnowledgePin();
    const resolvers = resolversFor({ 'push-up': pin });
    const { challenge } = await createChallenge(db, collectiveInput(groupId, memberId), resolvers);
    const first = await joinChallenge(db, challenge.challenge_id, memberId);
    await withdrawParticipation(db, first.participation_id);
    const second = await joinChallenge(db, challenge.challenge_id, memberId);
    expect(second.participation_id).not.toBe(first.participation_id);
    expect(second.status).toBe('active');
    expect(second.joined_config_version).toBe(1);
    const episodes = await listParticipations(db, challenge.challenge_id, memberId);
    expect(episodes.map((e) => e.status)).toEqual(['withdrawn', 'active']);
    // Simultaneous active episodes stay impossible.
    await expect(joinChallenge(db, challenge.challenge_id, memberId)).rejects.toThrow(
      /active participation episode already exists/,
    );
    expect(await getActiveParticipation(db, challenge.challenge_id, memberId)).toMatchObject({
      participation_id: second.participation_id,
    });
  });

  it('evaluates each episode independently at event time', () => {
    // Pure-helper evaluation with fixed episode intervals (no clock dependence).
    const base = {
      participation_id: '00000000-0000-4000-8000-000000000001',
      challenge_id: '00000000-0000-4000-8000-000000000002',
      member_id: '00000000-0000-4000-8000-000000000003',
      joined_config_version: 1,
      exited_by_member_id: null,
      created_at: '2026-06-01T08:00:00.000Z',
      updated_at: '2026-06-01T08:00:00.000Z',
    } as const;
    const first = {
      ...base,
      status: 'withdrawn' as const,
      joined_at: '2026-06-01T08:00:00.000Z',
      exited_at: '2026-06-10T08:00:00.000Z',
      exit_reason: 'withdrawn' as const,
    };
    const second = {
      ...base,
      participation_id: '00000000-0000-4000-8000-000000000004',
      status: 'active' as const,
      joined_at: '2026-06-15T08:00:00.000Z',
      exited_at: null,
      exit_reason: null,
    };
    // Gap between episodes: neither episode is eligible.
    const gap = new Date('2026-06-12T08:00:00.000Z');
    expect(isParticipationActiveAt(first, gap)).toBe(false);
    expect(isParticipationActiveAt(second, gap)).toBe(false);
    // Inside each episode: only that episode is eligible.
    const inFirst = new Date('2026-06-05T08:00:00.000Z');
    expect(isParticipationActiveAt(first, inFirst)).toBe(true);
    expect(isParticipationActiveAt(second, inFirst)).toBe(false);
    const inSecond = new Date('2026-06-20T08:00:00.000Z');
    expect(isParticipationActiveAt(first, inSecond)).toBe(false);
    expect(isParticipationActiveAt(second, inSecond)).toBe(true);
    // Before any episode: nothing is eligible.
    expect(isParticipationActiveAt(first, new Date('2026-05-01T08:00:00.000Z'))).toBe(false);
    expect(isParticipationActiveAt(second, new Date('2026-05-01T08:00:00.000Z'))).toBe(false);
  });
});

describe('transitional group authority', () => {
  it('rejects establishment when current authority does not confirm the group', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-grp-${seq}`);
    const pin = await seedKnowledgePin();
    for (const authority of [null, { status: 'disabled' }, { status: 'deleted' }]) {
      await expect(
        createChallenge(
          db,
          collectiveInput(groupId, memberId),
          resolversFor({ 'push-up': pin }, authority),
        ),
      ).rejects.toThrow(/not available for challenge establishment/);
    }
    // A stale shadow row alone grants nothing: zero challenges persisted.
    const count = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM challenges`);
    expect(count.rows[0].n).toBe('0');
  });
});

describe('C2A boundary guards', () => {
  it('uses Tiizi UUIDs everywhere, never Firestore document ids', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-uuid-${seq}`);
    const pin = await seedKnowledgePin();
    const { challenge, activities } = await createChallenge(
      db,
      collectiveInput(groupId, memberId),
      resolversFor({ 'push-up': pin }),
    );
    const participation = await joinChallenge(db, challenge.challenge_id, memberId);
    for (const id of [
      challenge.challenge_id,
      challenge.group_id,
      participation.participation_id,
      activities[0].activity_config_id,
      activities[0].knowledge_id,
    ]) {
      expect(id).toMatch(UUID_RE);
    }
  });

  it('does not mutate C1 Evidence', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember(`c2a-c1-${seq}`);
    const pin = await seedKnowledgePin();
    const resolvers = resolversFor({ 'push-up': pin });
    const evidence = await appendActivityEvent(
      db,
      {
        member_id: memberId,
        activity_kind: 'fitness',
        canonical_key: 'push-up',
        occurred_at: new Date('2026-05-01T08:00:00.000Z'),
        occurred_day: '2026-05-01',
        value: 20,
        unit: 'reps',
        client_key: `v2-client:c2a-${seq}`,
        metadata: {},
      },
      { resolveKnowledgePin: async (key) => resolvers.resolveKnowledgePin(key) },
    );
    const before = JSON.stringify(evidence.row);
    const { challenge } = await createChallenge(db, collectiveInput(groupId, memberId), resolvers);
    await joinChallenge(db, challenge.challenge_id, memberId);
    await addChallengeConfigVersion(db, challenge.challenge_id, { activities: [pushUp()] }, resolvers);
    const after = await listEffectiveEvents(db, { member_id: memberId });
    expect(after).toHaveLength(1);
    expect(after[0]).toEqual(JSON.parse(before));
  });

  it('implements no application, scoring, or Derived Truth storage', async () => {
    const db = testDb();
    const tables = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const names = new Set(tables.rows.map((r) => r.table_name));
    for (const absent of [
      'challenge_activity_records',
      'challenge_derived_truth',
      'derived_truth',
      'leaderboards',
      'challenge_leaderboards',
    ]) {
      expect(names.has(absent)).toBe(false);
    }
    for (const [table, owned] of [
      ['challenges', ['total_points', 'totalpoints', 'current_streak', 'longest_streak', 'cumulative', 'position', 'completion_rate']],
      ['challenge_participations', ['total_points', 'totalpoints', 'streak', 'cumulative', 'points_earned', 'completion_rate']],
    ] as Array<[string, string[]]>) {
      const columns = await db.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [table],
      );
      const cols = new Set(columns.rows.map((r) => r.column_name));
      for (const col of owned) expect(cols.has(col)).toBe(false);
    }
  });

  it('introduces no V1 migration machinery', async () => {
    const db = testDb();
    for (const table of ['challenges', 'challenge_config_versions', 'challenge_activity_configs', 'challenge_participations']) {
      const columns = await db.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [table],
      );
      const cols = new Set(columns.rows.map((r) => r.column_name));
      for (const legacy of ['legacy_collection', 'legacy_id', 'legacy_challenge_id', 'legacy_group_id', 'firestore_id']) {
        expect(cols.has(legacy)).toBe(false);
      }
    }
  });
});
