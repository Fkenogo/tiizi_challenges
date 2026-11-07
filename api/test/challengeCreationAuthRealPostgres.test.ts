/**
 * TD-05 deterministic Challenge-creation authority locking proof.
 *
 * Requires an explicitly named, disposable local PostgreSQL database and the
 * repository's marker guard. The suite is skipped unless TIIZI_REAL_PG_URL
 * and TIIZI_REAL_PG_DB are supplied; it never connects to port 5432.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.js';
import { createPool } from '../src/db.js';
import {
  DISPOSABLE_TARGET_ENV,
  disposableTargetSpecFromEnv,
  openGuardedDisposableDb,
} from '../src/disposableDbGuard.js';
import { runMigrations } from '../src/migrate.js';
import { establishChallengeDefinitionV2 } from '../src/challengeEstablishment.js';
import type { ChallengeCreationResolvers } from '../src/challenges.js';
import { validateChallengeDefinition } from '../src/challengeDefinition.js';
import { createKnowledgeItem, setKnowledgeLifecycle, setMeasurementCompatibility } from '../src/knowledge.js';
import { pushUpExemplarInput, PUSH_UP_CONTRACT } from '../src/pf01Exemplars.js';
import {
  createPostgresChallengeCreationAuthority,
  updateGovernedGroupSettings,
} from '../src/postgresGroupAuthority.js';

const url = process.env.TIIZI_REAL_PG_URL;
const target = process.env.TIIZI_REAL_PG_DB;
const LOCK_WAIT_LIMIT_MS = 30_000;

interface Deferred<T = void> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe.skipIf(!url || !target)('TD-05 real PostgreSQL transaction-time authorization', () => {
  let db: Db;
  let authority: ReturnType<typeof createPostgresChallengeCreationAuthority>;
  let definition: Awaited<ReturnType<typeof validateChallengeDefinition>>;
  const resolvers: ChallengeCreationResolvers = {
    resolveKnowledgePin: async () => null,
    resolveKnowledgeEligibility: async () => null,
    resolveGroupMembershipAuthority: async () => null,
    resolveGroupAuthority: async () => null,
  };

  beforeAll(async () => {
    const spec = disposableTargetSpecFromEnv(url);
    if (spec.databaseName !== target) {
      throw new Error(`disposable target refused: ${DISPOSABLE_TARGET_ENV.name} must match TIIZI_REAL_PG_DB`);
    }
    ({ db } = await openGuardedDisposableDb(spec, (connection) => createPool(connection, { max: 12 })));
    await runMigrations(db);
    const knowledge = await createKnowledgeItem(db, {
      ...pushUpExemplarInput(), activityCode: 'FIT-TDS-001', name: 'TD-05 concurrency fixture',
    });
    await setMeasurementCompatibility(db, knowledge.id, PUSH_UP_CONTRACT);
    await setKnowledgeLifecycle(db, knowledge.id, 'published');
    definition = await validateChallengeDefinition(db, {
      challengeType: 'collective', title: 'TD-05 concurrency fixture',
      startDate: '2026-11-07', endDate: '2026-11-30', goalValue: 100, goalUnit: 'reps',
      activities: [{ activity: 'FIT-TDS-001', metric: 'repetitions', unit: 'reps', targetValue: 5 }],
    });
    authority = createPostgresChallengeCreationAuthority(db);
  });

  afterAll(async () => { if (db) await db.close(); });

  async function fixture(options: { stewardIsActor?: boolean; allowMembers?: boolean } = {}) {
    const suffix = randomUUID();
    const actor = await seedMember(`td05-actor-${suffix}`);
    const steward = options.stewardIsActor === false ? await seedMember(`td05-steward-${suffix}`) : actor;
    const nextSteward = await seedMember(`td05-next-steward-${suffix}`);
    const inserted = await db.query<{ group_id: string }>(
      `INSERT INTO groups (name, description, allow_member_challenges)
       VALUES ($1, 'TD-05 disposable concurrency fixture', $2) RETURNING group_id`,
      [`TD-05 ${suffix}`, options.allowMembers ?? true],
    );
    const groupId = String(inserted.rows[0].group_id);
    await db.query(
      `INSERT INTO group_memberships (group_id, member_id, role, status)
       VALUES ($1, $2, 'owner', 'active')`, [groupId, steward],
    );
    await db.query(`UPDATE groups SET steward_member_id=$2 WHERE group_id=$1`, [groupId, steward]);
    if (actor !== steward) await db.query(
      `INSERT INTO group_memberships (group_id, member_id, role, status)
       VALUES ($1, $2, 'member', 'active')`, [groupId, actor],
    );
    await db.query(
      `INSERT INTO group_memberships (group_id, member_id, role, status)
       VALUES ($1, $2, 'member', 'active')`, [groupId, nextSteward],
    );
    return { groupId, actor, steward, nextSteward };
  }

  async function seedMember(subject: string): Promise<string> {
    const result = await db.query<{ member_id: string }>(
      `INSERT INTO members (auth_provider, auth_subject) VALUES ('firebase', $1) RETURNING member_id`,
      [subject],
    );
    return String(result.rows[0].member_id);
  }

  function databaseWithLockHook(afterLocks?: (tx: Db) => Promise<void>): Db {
    return {
      query: <T>(text: string, params?: unknown[]) => db.query<T>(text, params),
      transaction: <T>(fn: (tx: Db) => Promise<T>) => db.transaction(async (baseTx) => {
        let hookRun = false;
        const tx: Db = {
          query: async <R>(text: string, params?: unknown[]) => {
            const result = await baseTx.query<R>(text, params);
            if (!hookRun && /FROM group_memberships/i.test(text) && /FOR SHARE/i.test(text)) {
              hookRun = true;
              await afterLocks?.(baseTx);
            }
            return result;
          },
          transaction: (nested) => nested(tx),
          close: async () => {},
        };
        return fn(tx);
      }),
      close: () => db.close(),
    };
  }

  async function establishChallenge(
    groupId: string,
    actor: string,
    operationId: string,
    afterLocks?: (tx: Db) => Promise<void>,
  ): Promise<void> {
    await establishChallengeDefinitionV2(
      databaseWithLockHook(afterLocks),
      { definition, groupId, creatorMemberId: actor, activate: false, joinCreator: false, idempotencyKey: operationId },
      resolvers,
      { creationAuthority: authority },
    );
  }

  async function holdRevocation(groupId: string, actor: string) {
    const started = deferred<{ pid: number }>();
    const lockAcquired = deferred();
    const release = deferred();
    const finished = db.transaction(async (tx) => {
      const pid = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      started.resolve({ pid: Number(pid.rows[0].pid) });
      await tx.query(`SELECT group_id FROM groups WHERE group_id=$1 FOR UPDATE`, [groupId]);
      await tx.query(`SELECT member_id FROM group_memberships WHERE group_id=$1 AND member_id=$2 FOR UPDATE`, [groupId, actor]);
      await tx.query(`UPDATE group_memberships SET status='left' WHERE group_id=$1 AND member_id=$2`, [groupId, actor]);
      lockAcquired.resolve();
      await release.promise;
    });
    const { pid } = await started.promise;
    return { pid, locked: lockAcquired.promise, commit: () => release.resolve(), finished };
  }

  async function holdPolicyChange(groupId: string) {
    const locked = deferred<{ pid: number }>();
    const release = deferred();
    const finished = db.transaction(async (tx) => {
      await tx.query(`SELECT group_id FROM groups WHERE group_id=$1 FOR UPDATE`, [groupId]);
      await tx.query(`UPDATE groups SET allow_member_challenges=false WHERE group_id=$1`, [groupId]);
      const pid = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      locked.resolve({ pid: Number(pid.rows[0].pid) });
      await release.promise;
    });
    const { pid } = await locked.promise;
    return { pid, commit: () => release.resolve(), finished };
  }

  async function holdStewardTransfer(groupId: string, oldSteward: string, newSteward: string) {
    const locked = deferred<{ pid: number }>();
    const release = deferred();
    const finished = db.transaction(async (tx) => {
      await tx.query(`SELECT group_id FROM groups WHERE group_id=$1 FOR UPDATE`, [groupId]);
      // Match the Group-first, membership-second order required of authority
      // mutations. Transfer is not currently a governed application path;
      // this transaction verifies the row-lock compatibility contract.
      await tx.query(`SELECT member_id FROM group_memberships WHERE group_id=$1 AND member_id=$2 FOR UPDATE`, [groupId, oldSteward]);
      await tx.query(`SELECT member_id FROM group_memberships WHERE group_id=$1 AND member_id=$2 FOR UPDATE`, [groupId, newSteward]);
      await tx.query(`UPDATE group_memberships SET role='member' WHERE group_id=$1 AND member_id=$2`, [groupId, oldSteward]);
      await tx.query(`UPDATE group_memberships SET role='owner' WHERE group_id=$1 AND member_id=$2`, [groupId, newSteward]);
      await tx.query(`UPDATE groups SET steward_member_id=$2 WHERE group_id=$1`, [groupId, newSteward]);
      const pid = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      locked.resolve({ pid: Number(pid.rows[0].pid) });
      await release.promise;
    });
    const { pid } = await locked.promise;
    return { pid, commit: () => release.resolve(), finished };
  }

  async function waitForBlockedBy(blockerPid: number, waitingLock = 'FOR SHARE'): Promise<void> {
    const deadline = Date.now() + LOCK_WAIT_LIMIT_MS;
    for (;;) {
      const waiting = await db.query<{ pid: number }>(
        `SELECT a.pid FROM pg_stat_activity a
          WHERE a.wait_event_type='Lock'
            AND a.query ILIKE $2
            AND $1 = ANY(pg_blocking_pids(a.pid))`, [blockerPid, `%${waitingLock}%`],
      );
      if (waiting.rows.length > 0) return;
      if (Date.now() >= deadline) throw new Error('Challenge authorization query did not wait on the expected authority lock');
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  async function artifactCounts(groupId: string, operationId: string): Promise<Record<string, number>> {
    const queries: Record<string, { sql: string; params: unknown[] }> = {
      challenges: { sql: `SELECT count(*)::int AS n FROM challenges WHERE group_id=$1`, params: [groupId] },
      definitions: { sql: `SELECT count(*)::int AS n FROM challenge_config_versions v JOIN challenges c USING(challenge_id) WHERE c.group_id=$1`, params: [groupId] },
      activities: { sql: `SELECT count(*)::int AS n FROM challenge_activity_configs a JOIN challenges c USING(challenge_id) WHERE c.group_id=$1`, params: [groupId] },
      idempotency: { sql: `SELECT count(*)::int AS n FROM challenge_establishment_keys WHERE idempotency_key=$1`, params: [operationId] },
      participation: { sql: `SELECT count(*)::int AS n FROM challenge_participations p JOIN challenges c USING(challenge_id) WHERE c.group_id=$1`, params: [groupId] },
      publication: { sql: `SELECT count(*)::int AS n FROM group_feed_outbox o JOIN challenges c ON c.challenge_id=o.source_id WHERE c.group_id=$1`, params: [groupId] },
    };
    const counts: Record<string, number> = {};
    for (const [name, query] of Object.entries(queries)) {
      const result = await db.query<{ n: number }>(query.sql, query.params);
      counts[name] = result.rows[0].n;
    }
    return counts;
  }

  it('revocation commits first: waiting creation sees revoked membership and writes nothing', async () => {
    const { groupId, actor } = await fixture({ stewardIsActor: false });
    const held = await holdRevocation(groupId, actor);
    await held.locked;
    const operationId = randomUUID();
    const write = establishChallenge(groupId, actor, operationId).then(() => null, (error: unknown) => error);
    try {
      await waitForBlockedBy(held.pid);
      held.commit();
      await held.finished;
      const error = await write as Error;
      expect(error.message).toContain('(membership_inactive)');
      expect(await artifactCounts(groupId, operationId)).toEqual({ challenges: 0, definitions: 0, activities: 0, idempotency: 0, participation: 0, publication: 0 });
    } finally {
      held.commit();
      await held.finished;
    }
  }, 60_000);

  it('creation locks first: revocation waits until the authorized write commits', async () => {
    const { groupId, actor } = await fixture({ stewardIsActor: false });
    const acquired = deferred<number>();
    const releaseCreation = deferred();
    const operationId = randomUUID();
    const write = establishChallenge(groupId, actor, operationId, async (tx) => {
      const pid = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      acquired.resolve(Number(pid.rows[0].pid));
      await releaseCreation.promise;
    });
    const creationPid = await acquired.promise;
    const held = await holdRevocation(groupId, actor);
    try {
      await waitForBlockedBy(creationPid, 'FOR UPDATE');
      releaseCreation.resolve();
      await write;
      held.commit();
      await held.finished;
      expect(await artifactCounts(groupId, operationId)).toMatchObject({ challenges: 1, definitions: 1, activities: 1, idempotency: 1, participation: 0 });
    } finally {
      releaseCreation.resolve();
      held.commit();
      await held.finished;
    }
  }, 60_000);

  it('revocation held open: creation blocks and then denies after revocation commits', async () => {
    const { groupId, actor } = await fixture({ stewardIsActor: false });
    const held = await holdRevocation(groupId, actor);
    await held.locked;
    const operationId = randomUUID();
    const write = establishChallenge(groupId, actor, operationId).then(() => null, (error: unknown) => error);
    try {
      await waitForBlockedBy(held.pid);
      held.commit();
      await held.finished;
      expect((await write as Error).message).toContain('(membership_inactive)');
      expect(await artifactCounts(groupId, operationId)).toEqual({ challenges: 0, definitions: 0, activities: 0, idempotency: 0, participation: 0, publication: 0 });
    } finally {
      held.commit();
      await held.finished;
    }
  }, 60_000);

  it('Group policy change commits first: creation observes the restricted Charter', async () => {
    const { groupId, actor } = await fixture({ stewardIsActor: false });
    const held = await holdPolicyChange(groupId);
    const operationId = randomUUID();
    const write = establishChallenge(groupId, actor, operationId).then(() => null, (error: unknown) => error);
    try {
      await waitForBlockedBy(held.pid);
      held.commit();
      await held.finished;
      expect((await write as Error).message).toContain('(charter_restricted)');
      expect(await artifactCounts(groupId, operationId)).toEqual({ challenges: 0, definitions: 0, activities: 0, idempotency: 0, participation: 0, publication: 0 });
    } finally {
      held.commit();
      await held.finished;
    }
  }, 60_000);

  it('the existing Group settings mutation waits behind Challenge authorization locks', async () => {
    const { groupId, actor, steward } = await fixture({ stewardIsActor: false });
    const acquired = deferred<number>();
    const releaseCreation = deferred();
    const operationId = randomUUID();
    const write = establishChallenge(groupId, actor, operationId, async (tx) => {
      const pid = await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      acquired.resolve(Number(pid.rows[0].pid));
      await releaseCreation.promise;
    });
    const creationPid = await acquired.promise;
    const policyUpdate = updateGovernedGroupSettings(db, steward, groupId, { allowMemberChallenges: false });
    try {
      await waitForBlockedBy(creationPid, 'FOR UPDATE');
      releaseCreation.resolve();
      await write;
      await policyUpdate;
      expect(await artifactCounts(groupId, operationId)).toMatchObject({ challenges: 1, definitions: 1, activities: 1, idempotency: 1, participation: 0 });
      expect((await db.query<{ allow_member_challenges: boolean }>(
        `SELECT allow_member_challenges FROM groups WHERE group_id=$1`, [groupId],
      )).rows[0].allow_member_challenges).toBe(false);
    } finally {
      releaseCreation.resolve();
      await policyUpdate;
    }
  }, 60_000);

  it('steward transfer commits first: former steward loses restricted creation authority', async () => {
    const { groupId, actor, steward, nextSteward } = await fixture({ stewardIsActor: true, allowMembers: false });
    const held = await holdStewardTransfer(groupId, steward, nextSteward);
    const operationId = randomUUID();
    const write = establishChallenge(groupId, actor, operationId).then(() => null, (error: unknown) => error);
    try {
      await waitForBlockedBy(held.pid);
      held.commit();
      await held.finished;
      expect((await write as Error).message).toContain('(charter_restricted)');
      expect(await artifactCounts(groupId, operationId)).toEqual({ challenges: 0, definitions: 0, activities: 0, idempotency: 0, participation: 0, publication: 0 });
    } finally {
      held.commit();
      await held.finished;
    }
  }, 60_000);

  it('existing eligible creator continues to establish successfully', async () => {
    const { groupId, actor } = await fixture();
    const operationId = randomUUID();
    await establishChallenge(groupId, actor, operationId);
    expect(await artifactCounts(groupId, operationId)).toMatchObject({ challenges: 1, definitions: 1, activities: 1, idempotency: 1, participation: 0 });
  });
});
