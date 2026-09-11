/**
 * Phase C3A CORR-001 establishment atomicity tests.
 *
 * Discriminating tests against the REAL transaction boundary
 * (establishChallengeV2): faults are injected at the tx query layer AFTER
 * earlier establishment writes have executed, proving the whole operation —
 * Challenge, immutable config v1, normalized activity rows, activation,
 * creator participation — commits or rolls back as ONE PostgreSQL
 * transaction. No mocks of domain logic; only fault injection + row counts.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChallengeCreationResolvers } from '../src/challenges.js';
import { establishChallengeV2 } from '../src/challengeEstablishment.js';
import {
  dryRunChallengeCreateV2,
  runChallengeCreateV2,
} from '../src/challengeCreateCli.js';
import { testDb, seedMember, seedGroup, seedMembership } from './helpers.js';
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
  creatorMemberId: string;
  resolvers: ChallengeCreationResolvers & {
    resolveKnowledgePinFor: (kind: string, key: string) => Promise<{ knowledge_id: string; current_version: number } | null>;
  };
}

async function stubWorld(
  keys: Array<{ kind: 'fitness' | 'wellness'; key: string }>,
  memberEligibility: { status: string; eligible: boolean } | null = { status: 'active', eligible: true },
): Promise<StubWorld> {
  const db = testDb();
  const tag = next('est');
  const creatorMemberId = await seedMember(db, `creator-${tag}`);
  const groupId = await seedGroup(db, { name: `Est Group ${tag}` });
  await seedMembership(db, groupId, creatorMemberId, { status: 'active' });
  const pins = new Map<string, { knowledge_id: string; current_version: number }>();
  for (const { kind, key } of keys) {
    const result = await db.query<{ knowledge_id: string; current_version: number }>(
      `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ($1, $2, 'published')
       RETURNING knowledge_id, current_version`,
      [kind, `${key}-${tag}`],
    );
    pins.set(`${kind}::${key}`, {
      knowledge_id: String(result.rows[0].knowledge_id),
      current_version: Number(result.rows[0].current_version),
    });
  }
  return {
    groupId,
    creatorMemberId,
    resolvers: {
      // Key-only resolution for direct-seam callers (test keys are unique).
      resolveKnowledgePin: async (key: string) => {
        for (const [namespaced, pin] of pins) {
          if (namespaced.endsWith(`::${key}`)) return pin;
        }
        return null;
      },
      resolveKnowledgePinFor: async (kind: string, key: string) => pins.get(`${kind}::${key}`) ?? null,
      resolveGroupAuthority: async () => ({ status: 'active' }),
      resolveGroupMembershipAuthority: async () => memberEligibility,
    },
  };
}

/** Establishment-shaped input (internal member id, not Firebase uid). */
function establishmentInput(world: StubWorld) {
  return {
    group_id: world.groupId,
    created_by_member_id: world.creatorMemberId,
    challenge_type: 'collective' as const,
    title: 'Atomic collective',
    start_date: '2026-06-01',
    end_date: '2026-06-30',
    goal_value: 1000,
    goal_unit: 'reps',
    activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' as string }],
    activate: true,
    joinCreator: true,
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

/**
 * Fault injection at the transaction query layer: statements matching
 * failOn throw AFTER all earlier statements in the transaction have
 * executed, so the test discriminates real rollback from never-written.
 */
function faultingDb(db: Db, failOn: RegExp, message: string): Db {
  const wrappedTx = (tx: Db): Db => ({
    query: (async <T>(text: string, params?: unknown[]): Promise<{ rows: T[] }> => {
      if (failOn.test(text)) throw new Error(message);
      return tx.query<T>(text, params);
    }) as Db['query'],
    transaction: (fn) => fn(wrappedTx(tx)),
    close: async () => {},
  });
  return {
    query: (text, params) => db.query(text, params),
    transaction: <T>(fn: (tx: Db) => Promise<T>): Promise<T> =>
      db.transaction((tx) => fn(wrappedTx(tx))),
    close: () => db.close(),
  };
}

describe('A. create failure persists nothing', () => {
  it('invalid collective config rejects before the transaction with zero rows', async () => {
    const world = await stubWorld([
      { kind: 'fitness', key: 'running' },
      { kind: 'fitness', key: 'push-up' },
    ]);
    const before = await rowCounts();
    await expect(
      establishChallengeV2(testDb(), {
        ...establishmentInput(world),
        goal_unit: 'minutes',
        activities: [
          { canonical_key: 'running', metric: 'duration', target_value: 30, unit: 'minutes' },
          { canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'repetitions' },
        ],
      }, world.resolvers),
    ).rejects.toThrow(/must exactly equal goal_unit/);
    expect(await rowCounts()).toEqual(before);
  });

  it('challenge-insert fault rolls back with zero rows anywhere', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    const before = await rowCounts();
    await expect(
      establishChallengeV2(
        faultingDb(testDb(), /INSERT INTO challenges[\s(]/, 'injected challenge-insert failure'),
        establishmentInput(world),
        world.resolvers,
      ),
    ).rejects.toThrow(/injected challenge-insert failure/);
    expect(await rowCounts()).toEqual(before);
  });
});

describe('B. activation failure after create rolls back everything', () => {
  it('zero Challenge, config-version, activity-config and participation rows', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    const before = await rowCounts();
    await expect(
      establishChallengeV2(
        faultingDb(testDb(), /UPDATE challenges SET status/, 'injected activation failure'),
        establishmentInput(world),
        world.resolvers,
      ),
    ).rejects.toThrow(/injected activation failure/);
    // The Challenge row and its v1 config rows were inserted BEFORE the
    // fault fired: all must be gone (single-transaction rollback).
    expect(await rowCounts()).toEqual(before);
  });
});

describe('C. join failure after create + activate rolls back everything', () => {
  it('zero Challenge, config-version, activity-config and participation rows', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    const before = await rowCounts();
    await expect(
      establishChallengeV2(
        faultingDb(testDb(), /INSERT INTO challenge_participations/, 'injected join failure'),
        establishmentInput(world),
        world.resolvers,
      ),
    ).rejects.toThrow(/injected join failure/);
    // Create AND activation both executed before the fault: the rollback
    // must still leave zero rows in all four tables.
    expect(await rowCounts()).toEqual(before);
  });
});

describe('D. success persists create + config + activate + join together', () => {
  it('all rows present, challenge active, participation open', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    const result = await establishChallengeV2(testDb(), establishmentInput(world), world.resolvers);
    expect(result.challenge.status).toBe('active');
    expect(result.activated).toBe(true);
    expect(result.version.version).toBe(1);
    expect(result.activities).toHaveLength(1);
    expect(result.creatorParticipationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await rowCounts()).toMatchObject({
      challenges: 1,
      challenge_config_versions: 1,
      challenge_activity_configs: 1,
      challenge_participations: 1,
    });
  });
});

describe('E. create without activate/join persists as one transaction', () => {
  it('challenge + config present, no participation, establishment status', async () => {
    const world = await stubWorld([{ kind: 'fitness', key: 'push-up' }]);
    const result = await establishChallengeV2(
      testDb(),
      { ...establishmentInput(world), activate: false, joinCreator: false },
      world.resolvers,
    );
    expect(result.challenge.status).toBe('establishment');
    expect(result.activated).toBe(false);
    expect(result.creatorParticipationId).toBeNull();
    expect(await rowCounts()).toMatchObject({
      challenges: 1,
      challenge_config_versions: 1,
      challenge_activity_configs: 1,
      challenge_participations: 0,
    });
  });
});

describe('F. dry-run exercises the same path and persists nothing', () => {
  it('successful full establishment leaves zero rows', async () => {
    const db = testDb();
    const tag = next('dry');
    const creatorUid = `dry-creator-${tag}`;
    const creatorMemberId = await seedMember(db, creatorUid);
    const groupId = await seedGroup(db, { name: `Dry Group ${tag}` });
    await seedMembership(db, groupId, creatorMemberId, { status: 'active' });
    const pin = await db.query<{ knowledge_id: string; current_version: number }>(
      `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', $1, 'published')
       RETURNING knowledge_id, current_version`,
      [`push-up-${tag}`],
    );
    const resolvers: StubWorld['resolvers'] = {
      resolveKnowledgePin: async () => null,
      resolveKnowledgePinFor: async () => ({
        knowledge_id: String(pin.rows[0].knowledge_id),
        current_version: Number(pin.rows[0].current_version),
      }),
      resolveGroupAuthority: async () => ({ status: 'active' }),
      resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
    };
    const before = await rowCounts();
    const result = await dryRunChallengeCreateV2(db, {
      group_id: groupId,
      creator_firebase_uid: creatorUid,
      challenge_type: 'collective',
      title: 'Dry atomic',
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      goal_value: 1000,
      goal_unit: 'reps',
      activities: [{ activity_kind: 'fitness', canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
      activate: true,
      join_creator: true,
    }, resolvers);
    expect(result.dryRun).toBe(true);
    expect(result.status).toBe('active');
    expect(result.creatorParticipationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await rowCounts()).toEqual(before);
    // The real path still works after the dry-run on the same database.
    const real = await runChallengeCreateV2(db, {
      group_id: groupId,
      creator_firebase_uid: creatorUid,
      challenge_type: 'collective',
      title: 'Dry atomic real',
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      goal_value: 1000,
      goal_unit: 'reps',
      activities: [{ activity_kind: 'fitness', canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
      activate: true,
      join_creator: true,
    }, resolvers);
    expect(real.dryRun).toBe(false);
    expect(real.status).toBe('active');
  });
});

describe('G. live authority rejection persists nothing', () => {
  it('stale PG shadow + live removal leaves zero state', async () => {
    const world = await stubWorld(
      [{ kind: 'fitness', key: 'push-up' }],
      { status: 'removed', eligible: false },
    );
    const before = await rowCounts();
    await expect(
      establishChallengeV2(testDb(), establishmentInput(world), world.resolvers),
    ).rejects.toThrow(/no current Group Membership/);
    expect(await rowCounts()).toEqual(before);
  });
});
