/**
 * Independent-connection PostgreSQL verification for the Option C lifecycle.
 * Runs only against an explicitly allow-listed, marker-verified disposable DB.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import type { Db } from '../src/db.js';
import { openGuardedDisposableDb, disposableTargetSpecFromEnv } from '../src/disposableDbGuard.js';
import { runMigrations } from '../src/migrate.js';
import { createChallenge, activateChallenge, endChallenge } from '../src/challenges.js';
import { applyChallengeActivity } from '../src/challengeActivityApplication.js';
import { finalizeChallenge, getChallengeFinal, processExpiredChallenges } from '../src/challengeFinalization.js';
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

realDescribe('Option C lifecycle on independent PostgreSQL connections', () => {
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

  it('serializes simultaneous crossing Activities, closes logging, and converges concurrent finalizers', async () => {
    const suffix = crypto.randomUUID();
    const member = await db.query<{ member_id: string }>(
      `INSERT INTO members (auth_provider, auth_subject) VALUES ('firebase', $1) RETURNING member_id`, [`outcomes-${suffix}`],
    );
    const memberId = String(member.rows[0].member_id);
    const group = await db.query<{ group_id: string }>(
      `INSERT INTO groups (name, description, is_private) VALUES ($1, '', false) RETURNING group_id`, [`Outcomes ${suffix}`],
    );
    const groupId = String(group.rows[0].group_id);
    await db.query(`INSERT INTO group_memberships (group_id, member_id, role, status) VALUES ($1, $2, 'member', 'active')`, [groupId, memberId]);
    const pin = await db.query<{ knowledge_id: string; current_version: number }>(
      `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', $1, 'published') RETURNING knowledge_id, current_version`, [`Pushups ${suffix}`],
    );
    const knowledgePin = { knowledge_id: String(pin.rows[0].knowledge_id), current_version: Number(pin.rows[0].current_version) };
    const resolvers = {
      resolveKnowledgePin: async () => knowledgePin,
      resolveKnowledgeEligibility: async () => ({ ...fixtureEligibility, knowledgeId: knowledgePin.knowledge_id, activityCode: null, version: knowledgePin.current_version }),
      resolveGroupAuthority: async () => ({ status: 'active' as const }),
      resolveGroupMembershipAuthority: async () => ({ status: 'active' as const, eligible: true }),
    };
    const { challenge } = await createChallenge(db, {
      group_id: groupId,
      created_by_member_id: memberId,
      challenge_type: 'collective',
      title: `Crossing ${suffix}`,
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      goal_value: 100,
      goal_unit: 'reps',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
    }, resolvers);
    await activateChallenge(db, challenge.challenge_id);
    await db.query<{ participation_id: string }>(
      `INSERT INTO challenge_participations (challenge_id, member_id, status, joined_at, joined_config_version)
       VALUES ($1, $2, 'active', $3, 1) RETURNING participation_id`, [challenge.challenge_id, memberId, '2026-06-01T00:00:00Z'],
    );
    const activityResolvers = {
      resolveKnowledgePin: async () => knowledgePin,
      resolveGroupMembershipAuthority: async () => ({ status: 'active' as const, eligible: true }),
    };
    const activity = (key: string) => applyChallengeActivity(db, memberId, challenge.challenge_id, {
      activity_kind: 'fitness', canonical_key: 'push-up', value: 60, unit: 'reps',
      occurred_at: new Date('2026-06-10T12:00:00Z'), client_key: key,
    }, activityResolvers, { now: new Date('2026-06-10T12:00:00Z') });

    const submitted = await Promise.all([activity(`cross-a-${suffix}`), activity(`cross-b-${suffix}`)]);
    expect(submitted.every((item) => item.record.record_id.length > 0)).toBe(true);
    const live = await db.query<{ status: string; collective_total: number; finalized_at: Date | null }>(
      `SELECT c.status, d.collective_total, c.finalized_at FROM challenges c
       JOIN challenge_derived_state d USING (challenge_id) WHERE c.challenge_id = $1`, [challenge.challenge_id],
    );
    expect(live.rows[0]).toMatchObject({ status: 'ended', collective_total: 120, finalized_at: null });
    await expect(activity(`cross-late-${suffix}`)).rejects.toMatchObject({ code: 'challenge_not_active' });

    await endChallenge(db, challenge.challenge_id);
    const [left, right] = await Promise.all([
      finalizeChallenge(db, challenge.challenge_id),
      finalizeChallenge(db, challenge.challenge_id),
    ]);
    expect(Number(left.finalization?.result.collective_total)).toBe(120);
    expect(Number(right.finalization?.result.collective_total)).toBe(120);
    const frozen = await getChallengeFinal(db, challenge.challenge_id);
    await finalizeChallenge(db, challenge.challenge_id);
    expect(await getChallengeFinal(db, challenge.challenge_id)).toEqual(frozen);
    expect((await processExpiredChallenges(db, new Date('2026-06-11T12:00:00Z'))).some((x) => x.challenge_id === challenge.challenge_id)).toBe(false);
  }, 60_000);
});

