/**
 * Phase C3A controlled establishment CLI tests.
 *
 * Proves clean-V2 creation through the existing domain seams with trusted
 * stub authorities (no Firestore, no network):
 * - valid collective / competitive / streak creation (incl. mixed
 *   fitness+wellness where allowed);
 * - fail-closed authority handling (inactive group, non-member creator,
 *   stale PG shadow + live removal, unknown/unpublished Knowledge,
 *   invalid collective units);
 * - atomicity (no partial rows on failure; config v1 immutable);
 * - activation semantics; dry-run persistence-free;
 * - PG-only writes (no V1 collections exist in this database at all).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChallengeCreationResolvers } from '../src/challenges.js';
import { getChallenge } from '../src/challenges.js';
import {
  dryRunChallengeCreateV2,
  parseChallengeCreateV2Input,
  runChallengeCreateV2,
  type ChallengeCreateV2Input,
} from '../src/challengeCreateCli.js';
import { testDb, seedMember, seedGroup, seedMembership, stubEligibility } from './helpers.js';
import type { Db } from '../src/db.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events',
  );
});

let seq = 0;
const next = (prefix: string): string => `${prefix}-${(seq += 1)}`;

interface StubWorld {
  groupId: string;
  creatorUid: string;
  creatorMemberId: string;
  pins: Record<string, { kind: string; knowledge_id: string; current_version: number }>;
  groupStatus: { status: string } | null;
  memberEligibility: { status: string; eligible: boolean } | null;
  resolvers: ChallengeCreationResolvers & {
    resolveKnowledgePinFor: (kind: string, key: string) => Promise<{ knowledge_id: string; current_version: number } | null>;
  };
}

async function seedKnowledge(
  db: Db,
  kind: 'fitness' | 'wellness',
  key: string,
): Promise<{ knowledge_id: string; current_version: number }> {
  const result = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ($1, $2, 'published')
     RETURNING knowledge_id, current_version`,
    [kind, `${key}-${seq}`],
  );
  return {
    knowledge_id: String(result.rows[0].knowledge_id),
    current_version: Number(result.rows[0].current_version),
  };
}

async function stubWorld(
  keys: Array<{ kind: 'fitness' | 'wellness'; key: string }>,
  options: {
    groupStatus?: { status: string } | null;
    memberEligibility?: { status: string; eligible: boolean } | null;
  } = {},
): Promise<StubWorld> {
  const db = testDb();
  const tag = next('cli');
  const creatorUid = `creator-${tag}`;
  const creatorMemberId = await seedMember(db, creatorUid);
  const groupId = await seedGroup(db, { name: `CLI Group ${tag}` });
  await seedMembership(db, groupId, creatorMemberId, { status: 'active' });
  const pins: StubWorld['pins'] = {};
  for (const { kind, key } of keys) {
    pins[`${kind}::${key}`] = { kind, ...(await seedKnowledge(db, kind, key)) };
  }
  const world: StubWorld = {
    groupId,
    creatorUid,
    creatorMemberId,
    pins,
    groupStatus: options.groupStatus !== undefined ? options.groupStatus : { status: 'active' },
    memberEligibility: options.memberEligibility !== undefined
      ? options.memberEligibility
      : { status: 'active', eligible: true },
    resolvers: null as never,
  };
  world.resolvers = {
    resolveKnowledgePin: async () => null,
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveKnowledgePinFor: async (kind: string, key: string) =>
      world.pins[`${kind}::${key}`] != null
        ? {
          knowledge_id: world.pins[`${kind}::${key}`].knowledge_id,
          current_version: world.pins[`${kind}::${key}`].current_version,
        }
        : null,
    resolveGroupAuthority: async () => world.groupStatus,
    resolveGroupMembershipAuthority: async () => world.memberEligibility,
  };
  return world;
}

function baseInput(world: StubWorld): ChallengeCreateV2Input {
  return {
    group_id: world.groupId,
    creator_firebase_uid: world.creatorUid,
    challenge_type: 'collective',
    title: 'CLI Collective',
    start_date: '2026-06-01',
    end_date: '2026-06-30',
    goal_value: 1000,
    goal_unit: 'reps',
    activities: [{ activity_kind: 'fitness', canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
  };
}

async function rowCounts(): Promise<Record<string, number>> {
  const db = testDb();
  const out: Record<string, number> = {};
  for (const table of ['challenges', 'challenge_config_versions', 'challenge_activity_configs', 'challenge_participations']) {
    const result = await db.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${table}`);
    out[table] = Number(result.rows[0].count);
  }
  return out;
}

describe('valid establishment', () => {
  it('creates a collective challenge with immutable v1 config', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    const result = await runChallengeCreateV2(testDb(), baseInput(world), world.resolvers);
    expect(result.dryRun).toBe(false);
    expect(result.status).toBe('establishment');
    expect(result.configVersion).toBe(1);
    expect(result.activated).toBe(false);
    expect(result.creatorParticipationId).toBeNull();
    const challenge = await getChallenge(testDb(), result.challengeId);
    expect(challenge.goal_unit).toBe('reps');
    const counts = await rowCounts();
    expect(counts).toMatchObject({
      challenges: 1,
      challenge_config_versions: 1,
      challenge_activity_configs: 1,
      challenge_participations: 0,
    });
  });

  it('creates competitive and streak challenges', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    const competitive = await runChallengeCreateV2(
      testDb(),
      {
        ...baseInput(world),
        challenge_type: 'competitive',
        title: 'CLI Race',
        goal_value: undefined,
        goal_unit: undefined,
      },
      world.resolvers,
    );
    expect((await getChallenge(testDb(), competitive.challengeId)).challenge_type).toBe('competitive');
    const streak = await runChallengeCreateV2(
      testDb(),
      {
        ...baseInput(world),
        challenge_type: 'streak',
        title: 'CLI Streak',
        goal_value: undefined,
        goal_unit: undefined,
        required_consecutive_days: 30,
      },
      world.resolvers,
    );
    expect((await getChallenge(testDb(), streak.challengeId)).challenge_type).toBe('streak');
  });

  it('supports mixed fitness/wellness activities', async () => {
    const world = await stubWorld([
      { kind: 'fitness', key: 'push-up' },
      { kind: 'wellness', key: 'water-intake' },
    ]);
    const result = await runChallengeCreateV2(
      testDb(),
      {
        ...baseInput(world),
        challenge_type: 'competitive',
        title: 'CLI Mixed',
        goal_value: undefined,
        goal_unit: undefined,
        activities: [
          { activity_kind: 'fitness', canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' },
          { activity_kind: 'wellness', canonical_key: 'water-intake', metric: 'quantity', target_value: 2000, unit: 'millilitres' },
        ],
      },
      world.resolvers,
    );
    const counts = await rowCounts();
    expect(counts.challenge_activity_configs).toBe(2);
    expect(result.challengeId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('activation and creator join work when requested', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    const result = await runChallengeCreateV2(
      testDb(),
      { ...baseInput(world), activate: true, join_creator: true },
      world.resolvers,
    );
    expect(result.status).toBe('active');
    expect(result.activated).toBe(true);
    expect(result.creatorParticipationId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe('fail-closed authority handling', () => {
  it('rejects inactive groups', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }], { groupStatus: null });
    await expect(runChallengeCreateV2(testDb(), baseInput(world), world.resolvers)).rejects.toThrow(
      /not available for challenge establishment/,
    );
  });

  it('rejects non-member creators', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }], {
      memberEligibility: { status: 'no_membership', eligible: false },
    });
    await expect(runChallengeCreateV2(testDb(), baseInput(world), world.resolvers)).rejects.toThrow(
      /no current Group Membership/,
    );
  });

  it('rejects stale PG membership when live authority removed the member', async () => {
    const db = testDb();
    // The PG shadow still shows an active membership (stale between imports),
    // but live authority reports removal: establishment must refuse.
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }], {
      memberEligibility: { status: 'removed', eligible: false },
    });
    const shadow = await db.query<{ status: string }>(
      `SELECT status FROM group_memberships WHERE group_id = $1 AND member_id = $2`,
      [world.groupId, world.creatorMemberId],
    );
    expect(shadow.rows[0].status).toBe('active');
    await expect(runChallengeCreateV2(db, baseInput(world), world.resolvers)).rejects.toThrow(
      /no current Group Membership/,
    );
  });

  it('rejects unknown creators with no member row', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    await expect(
      runChallengeCreateV2(testDb(), { ...baseInput(world), creator_firebase_uid: 'ghost-uid' }, world.resolvers),
    ).rejects.toThrow(/unknown member/);
  });

  it('rejects unknown or unpublished Knowledge', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    await expect(
      runChallengeCreateV2(
        testDb(),
        {
          ...baseInput(world),
          activities: [{ activity_kind: 'fitness', canonical_key: 'draft-move', metric: 'repetitions', target_value: 1, unit: 'reps' }],
        },
        world.resolvers,
      ),
    ).rejects.toThrow(/unknown or unpublished Knowledge/);
  });

  it('rejects invalid collective units before any write', async () => {
    const world = await stubWorld([
      { kind: 'fitness', key: 'running' },
      { kind: 'fitness', key: 'push-up' },
    ]);
    const before = await rowCounts();
    await expect(
      runChallengeCreateV2(
        testDb(),
        {
          ...baseInput(world),
          goal_unit: 'minutes',
          activities: [
            { activity_kind: 'fitness', canonical_key: 'running', metric: 'duration', target_value: 30, unit: 'minutes' },
            { activity_kind: 'fitness', canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'repetitions' },
          ],
        },
        world.resolvers,
      ),
    ).rejects.toThrow(/must exactly equal goal_unit/);
    expect(await rowCounts()).toEqual(before);
  });
});

describe('atomicity and lifecycle', () => {
  it('proves live membership once per request and performs no authority I/O in-tx', async () => {
    // CORR-001: the live membership proof happens ONCE outside the
    // transaction and is carried in; the join inside the transaction performs
    // no second authority round-trip (so a mid-request authority flap cannot
    // strand a partially established Challenge — any in-tx failure rolls the
    // whole establishment back; see challengeEstablishment.test.ts B/C).
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    let authorityCalls = 0;
    const counting = {
      ...world.resolvers,
      resolveGroupMembershipAuthority: async () => {
        authorityCalls += 1;
        return { status: 'active', eligible: true };
      },
    };
    const before = await rowCounts();
    const result = await runChallengeCreateV2(
      testDb(),
      { ...baseInput(world), activate: true, join_creator: true },
      counting,
    );
    expect(authorityCalls).toBe(1);
    expect(result.status).toBe('active');
    expect(result.creatorParticipationId).toMatch(/^[0-9a-f-]{36}$/i);
    const after = await rowCounts();
    expect(after.challenges).toBe(before.challenges + 1);
    expect(after.challenge_participations).toBe(before.challenge_participations + 1);
  });

  it('config v1 is immutable after establishment', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    const result = await runChallengeCreateV2(testDb(), baseInput(world), world.resolvers);
    const db = testDb();
    await expect(
      db.query(`UPDATE challenge_config_versions SET snapshot = '{}' WHERE challenge_id = $1`, [result.challengeId]),
    ).rejects.toThrow();
    await expect(
      db.query(`DELETE FROM challenge_activity_configs WHERE challenge_id = $1`, [result.challengeId]),
    ).rejects.toThrow();
  });

  it('activation semantics: establishment default, single activation', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    const plain = await runChallengeCreateV2(testDb(), baseInput(world), world.resolvers);
    expect(plain.status).toBe('establishment');
    const active = await runChallengeCreateV2(
      testDb(),
      { ...baseInput(world), title: 'CLI Active', activate: true },
      world.resolvers,
    );
    expect(active.status).toBe('active');
    const { activateChallenge } = await import('../src/challenges.js');
    await expect(activateChallenge(testDb(), active.challengeId)).rejects.toThrow(/already active/);
  });

  it('dry-run persists nothing', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    const before = await rowCounts();
    const result = await dryRunChallengeCreateV2(
      testDb(),
      { ...baseInput(world), activate: true, join_creator: true },
      world.resolvers,
    );
    expect(result.dryRun).toBe(true);
    expect(result.status).toBe('active');
    expect(result.creatorParticipationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await rowCounts()).toEqual(before);
  });

  it('writes PG V2 rows only (no V1 collections exist here)', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    const result = await runChallengeCreateV2(
      testDb(),
      { ...baseInput(world), activate: true, join_creator: true },
      world.resolvers,
    );
    // The CLI core runs with stub resolvers and no Firestore reader: nothing
    // in this path can address workouts/wellnessLogs/challengeMembers (those
    // collections do not exist in this database at all).
    const tables = await testDb().query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    const names = tables.rows.map((r) => r.tablename);
    expect(names).not.toContain('workouts');
    expect(names).not.toContain('wellnessLogs');
    expect(names).not.toContain('challengeMembers');
    expect(result.challengeId).toBeTruthy();
  });
});

describe('input contract', () => {
  it('parses a valid file-shaped payload and rejects governing overreach', () => {
    const world = { groupId: '00000000-0000-4000-8000-000000000001' } as StubWorld;
    const parsed = parseChallengeCreateV2Input({
      group_id: world.groupId,
      creator_firebase_uid: 'uid-1',
      challenge_type: 'collective',
      title: 'File challenge',
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      goal_value: 100,
      goal_unit: 'reps',
      activities: [{ activity_kind: 'fitness', canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
      activate: true,
    });
    expect(parsed.activate).toBe(true);
    expect(parsed.join_creator).toBe(false);
    expect(() => parseChallengeCreateV2Input({ ...parsed, group_id: 'firestore-doc-id' })).toThrow(/UUID/);
    expect(() => parseChallengeCreateV2Input({})).toThrow();
  });
});
