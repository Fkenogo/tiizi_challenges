/**
 * Independent-connection PostgreSQL verification for CF-2 S1 replay-safety and
 * concurrent publication / withdrawal races.
 * Runs only against an explicitly allow-listed, marker-verified disposable DB.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import type { Db } from '../src/db.js';
import { openGuardedDisposableDb, disposableTargetSpecFromEnv } from '../src/disposableDbGuard.js';
import { runMigrations } from '../src/migrate.js';
import { createChallenge, activateChallenge } from '../src/challenges.js';
import { applyChallengeActivity } from '../src/challengeActivityApplication.js';
import {
  publishActivityShare,
  readActivityShareState,
  withdrawActivityShare,
  ChallengeFeedError,
} from '../src/challengeFeedShares.js';
import { withMigrationLock, ensurePostgresExtension } from './postgresTestSupport.js';

const url = process.env.TIIZI_REAL_PG_URL;
const databaseName = process.env.TIIZI_REAL_PG_DB;
const realDescribe = url && databaseName ? describe : describe.skip;
let pool: Pool;
let db: Db;

function wrapClient(client: PoolClient): Db {
  const tx: Db = {
    async query<T>(text: string, params?: unknown[]) {
      const result = await client.query(text, params);
      return { rows: result.rows as T[] };
    },
    transaction: async (fn) => fn(tx),
    close: async () => {},
  };
  return tx;
}

function createTestDb(poolRef: Pool): Db {
  return {
    async query<T>(text: string, params?: unknown[]) {
      const result = await poolRef.query(text, params);
      return { rows: result.rows as T[] };
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      const client = await poolRef.connect();
      try {
        await client.query('BEGIN');
        const value = await fn(wrapClient(client));
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: async () => { await poolRef.end(); },
  };
}

const fixtureEligibility = {
  kind: 'fitness' as const,
  lifecycle: 'published' as const,
  grandfathered: false,
  primaryMetrics: ['repetitions'],
  secondaryMetrics: [],
  compatibleUnits: ['reps', 'repetitions'],
};

const activeAuthority = {
  resolveGroupMembershipAuthority: async () => ({ status: 'active' as const, eligible: true }),
};

async function seedShareSource() {
  const suffix = crypto.randomUUID();
  const member = await db.query<{ member_id: string }>(
    `INSERT INTO members (auth_provider, auth_subject, display_name)
     VALUES ('firebase', $1, 'Concurrency Member') RETURNING member_id`,
    [`cf-race-${suffix}`],
  );
  const memberId = String(member.rows[0].member_id);
  const group = await db.query<{ group_id: string }>(
    `INSERT INTO groups (name, description, is_private) VALUES ($1, '', false) RETURNING group_id`,
    [`CF Race ${suffix}`],
  );
  const groupId = String(group.rows[0].group_id);
  await db.query(
    `INSERT INTO group_memberships (group_id, member_id, role, status) VALUES ($1, $2, 'member', 'active')`,
    [groupId, memberId],
  );
  const pin = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', $1, 'published') RETURNING knowledge_id, current_version`,
    [`Pushups ${suffix}`],
  );
  const knowledgePin = {
    knowledge_id: String(pin.rows[0].knowledge_id),
    current_version: Number(pin.rows[0].current_version),
  };
  const resolvers = {
    resolveKnowledgePin: async () => knowledgePin,
    resolveKnowledgeEligibility: async () => ({
      ...fixtureEligibility,
      knowledgeId: knowledgePin.knowledge_id,
      activityCode: null,
      version: knowledgePin.current_version,
    }),
    resolveGroupAuthority: async () => ({ status: 'active' as const }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active' as const, eligible: true }),
  };
  const { challenge } = await createChallenge(db, {
    group_id: groupId,
    created_by_member_id: memberId,
    challenge_type: 'collective',
    title: `CF Race ${suffix}`,
    start_date: '2026-06-01',
    end_date: '2026-06-30',
    goal_value: 100,
    goal_unit: 'reps',
    activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
  }, resolvers);
  await activateChallenge(db, challenge.challenge_id);
  await db.query(
    `INSERT INTO challenge_participations (challenge_id, member_id, status, joined_at, joined_config_version)
     VALUES ($1, $2, 'active', '2026-06-01T00:00:00Z', 1)`,
    [challenge.challenge_id, memberId],
  );
  const applied = await applyChallengeActivity(
    db,
    memberId,
    challenge.challenge_id,
    {
      activity_kind: 'fitness',
      canonical_key: 'push-up',
      value: 25,
      unit: 'reps',
      occurred_at: new Date('2026-06-10T12:00:00Z'),
      client_key: `cf-act-${suffix}`,
    },
    {
      resolveKnowledgePin: async () => knowledgePin,
      resolveGroupMembershipAuthority: async () => ({ status: 'active' as const, eligible: true }),
    },
    { now: new Date('2026-06-10T12:00:00Z') },
  );
  return { memberId, challengeId: challenge.challenge_id, eventId: applied.record.event_id };
}

realDescribe('CF-2 S1 replay safety on independent PostgreSQL connections', () => {
  beforeAll(async () => {
    const spec = { ...disposableTargetSpecFromEnv(url), databaseName };
    ({ db } = await openGuardedDisposableDb(spec, (connectionString) => {
      pool = new Pool({ connectionString, max: 8 });
      return createTestDb(pool);
    }));
    await withMigrationLock(pool, async () => {
      await ensurePostgresExtension(pool);
      await runMigrations(db);
    });
  });

  afterAll(async () => { if (pool) await pool.end(); });

  it('converges concurrent first publications and serializes publish/withdraw races safely across pruning', async () => {
    const { memberId, challengeId, eventId } = await seedShareSource();
    const keyA1 = `race-a1-${crypto.randomUUID()}`;
    const keyA2 = `race-a2-${crypto.randomUUID()}`;

    // 1. Concurrent initial publish on separate pool connections -> one row, generation 1.
    const [firstA, firstB] = await Promise.all([
      publishActivityShare(db, activeAuthority, memberId, challengeId, eventId, {
        clientKey: keyA1,
        previewedValue: 25,
        previewedUnit: 'reps',
        expectedGeneration: 0,
      }),
      publishActivityShare(db, activeAuthority, memberId, challengeId, eventId, {
        clientKey: keyA2,
        previewedValue: 25,
        previewedUnit: 'reps',
        expectedGeneration: 0,
      }),
    ]);
    expect(firstA.shareId).toBe(firstB.shareId);
    expect(firstA.shareGeneration).toBe(1);
    expect(firstB.shareGeneration).toBe(1);

    // 2. Withdraw -> generation 2, then race a stale generation-0 replay against a fresh generation-2 publish.
    const w1 = await withdrawActivityShare(db, activeAuthority, memberId, challengeId, eventId);
    expect(w1.shareGeneration).toBe(2);

    // Age keys beyond 24h before racing fresh confirmation + stale replay.
    await db.query(
      `UPDATE challenge_feed_share_choices SET acknowledged_at = now() - interval '25 hours' WHERE share_id = $1`,
      [firstA.shareId],
    );

    const keyB = `race-b-${crypto.randomUUID()}`;
    const [staleRace, freshRace] = await Promise.allSettled([
      publishActivityShare(db, activeAuthority, memberId, challengeId, eventId, {
        clientKey: keyA1,
        previewedValue: 25,
        previewedUnit: 'reps',
        expectedGeneration: 0,
      }),
      publishActivityShare(db, activeAuthority, memberId, challengeId, eventId, {
        clientKey: keyB,
        previewedValue: 25,
        previewedUnit: 'reps',
        expectedGeneration: 2,
      }),
    ]);
    expect(staleRace.status).toBe('rejected');
    expect((staleRace as PromiseRejectedResult).reason).toBeInstanceOf(ChallengeFeedError);
    expect(((staleRace as PromiseRejectedResult).reason as ChallengeFeedError).code).toBe('share_withdrawn');
    expect(freshRace.status).toBe('fulfilled');
    expect((freshRace as PromiseFulfilledResult<typeof firstA>).value.shareGeneration).toBe(3);

    // 3. Withdraw generation 3 -> generation 4, then race two fresh generation-4 revivals vs a concurrent withdrawal.
    const w2 = await withdrawActivityShare(db, activeAuthority, memberId, challengeId, eventId);
    expect(w2.shareGeneration).toBe(4);

    const keyC1 = `race-c1-${crypto.randomUUID()}`;
    const keyC2 = `race-c2-${crypto.randomUUID()}`;
    const raceResults = await Promise.allSettled([
      publishActivityShare(db, activeAuthority, memberId, challengeId, eventId, {
        clientKey: keyC1,
        previewedValue: 25,
        previewedUnit: 'reps',
        expectedGeneration: 4,
      }),
      publishActivityShare(db, activeAuthority, memberId, challengeId, eventId, {
        clientKey: keyC2,
        previewedValue: 25,
        previewedUnit: 'reps',
        expectedGeneration: 4,
      }),
      withdrawActivityShare(db, activeAuthority, memberId, challengeId, eventId),
    ]);
    // Assert every outcome is consistent with serialization (never a SQL error or 503).
    expect(raceResults[2].status).toBe('fulfilled');
    const pubOutcomes = [raceResults[0], raceResults[1]];
    let fulfilledCount = 0;
    let rejectedCount = 0;
    for (const outcome of pubOutcomes) {
      if (outcome.status === 'fulfilled') {
        fulfilledCount += 1;
        expect(outcome.value.withdrawn).toBe(false);
        expect(outcome.value.shareGeneration).toBe(5);
      } else {
        rejectedCount += 1;
        expect(outcome.reason).toBeInstanceOf(ChallengeFeedError);
        expect((outcome.reason as ChallengeFeedError).statusCode).toBe(409);
        expect((outcome.reason as ChallengeFeedError).code).toBe('share_withdrawn');
      }
    }
    // Starting from withdrawn gen 4, even if withdraw runs first it leaves gen at 4,
    // so at least one fresh gen-4 revival must succeed at gen 5.
    expect(fulfilledCount).toBeGreaterThanOrEqual(1);

    const afterRaceState = await readActivityShareState(db, activeAuthority, memberId, challengeId, eventId);
    if (rejectedCount > 0) {
      expect(afterRaceState.withdrawn).toBe(true);
      expect(afterRaceState.shareGeneration).toBe(6);
    } else if (afterRaceState.withdrawn) {
      expect(afterRaceState.shareGeneration).toBe(6);
    } else {
      expect(afterRaceState.shareGeneration).toBe(5);
    }

    // Concurrent double-withdraw on separate pool connections must advance generation exactly once.
    if (afterRaceState.withdrawn) {
      const revived = await publishActivityShare(db, activeAuthority, memberId, challengeId, eventId, {
        clientKey: `race-reconfirm-${crypto.randomUUID()}`,
        previewedValue: 25,
        previewedUnit: 'reps',
        expectedGeneration: afterRaceState.shareGeneration,
      });
      expect(revived.shareGeneration).toBe(afterRaceState.shareGeneration + 1);
    }
    const activeBeforeDoubleWithdraw = await readActivityShareState(db, activeAuthority, memberId, challengeId, eventId);
    expect(activeBeforeDoubleWithdraw.withdrawn).toBe(false);
    const expectedWithdrawnGen = activeBeforeDoubleWithdraw.shareGeneration + 1;

    const [dw1, dw2] = await Promise.all([
      withdrawActivityShare(db, activeAuthority, memberId, challengeId, eventId),
      withdrawActivityShare(db, activeAuthority, memberId, challengeId, eventId),
    ]);
    expect(dw1.withdrawn).toBe(true);
    expect(dw2.withdrawn).toBe(true);
    expect(dw1.shareGeneration).toBe(expectedWithdrawnGen);
    expect(dw2.shareGeneration).toBe(expectedWithdrawnGen);

    // Ensure stale keys A1, B, C1/C2 at old generations cannot revive after double-withdraw.
    for (const [oldKey, oldGen] of [[keyA1, 0], [keyB, 2], [keyC1, 4], [keyC2, 4]] as const) {
      await expect(
        publishActivityShare(db, activeAuthority, memberId, challengeId, eventId, {
          clientKey: oldKey,
          previewedValue: 25,
          previewedUnit: 'reps',
          expectedGeneration: oldGen,
        }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'share_withdrawn' });
    }

    const finalState = await readActivityShareState(db, activeAuthority, memberId, challengeId, eventId);
    expect(finalState.withdrawn).toBe(true);
    expect(finalState.visible).toBe(false);
    expect(finalState.shareGeneration).toBe(expectedWithdrawnGen);
  }, 60_000);
});
