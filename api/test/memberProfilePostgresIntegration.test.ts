import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { TokenVerifier } from '../src/auth.js';
import type { Db } from '../src/db.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
import { listMigrationFiles, runMigrations, splitStatements } from '../src/migrate.js';
import { ensurePostgresExtension } from './postgresTestSupport.js';

const databaseUrl = process.env.TIIZI_TEST_DATABASE_URL;
const adminDatabaseUrl = process.env.TIIZI_TEST_ADMIN_DATABASE_URL ?? databaseUrl;

// Each suite migrates a disposable database, because migrations 007 and 008
// inspect pg_constraint by conname without a schema filter: sharing one
// database would let a second suite skip constraints the first already created.
// The suite runs only when the admin URL's role can create databases, so an
// ordinary application URL never silently gains that requirement.
let canCreateDatabase = false;
if (adminDatabaseUrl) {
  const probe = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
  try {
    const { rows } = await probe.query<{ can_create: boolean }>(
      'SELECT rolcreatedb OR rolsuper AS can_create FROM pg_roles WHERE rolname = current_user',
    );
    canCreateDatabase = rows[0]?.can_create === true;
  } catch {
    canCreateDatabase = false;
  } finally {
    await probe.end();
  }
}
if (databaseUrl && !canCreateDatabase) {
  console.warn(
    'MC-2B-4 PostgreSQL integration suite skipped: the TIIZI_TEST_DATABASE_URL role cannot create databases. ' +
      'Set TIIZI_TEST_ADMIN_DATABASE_URL to a role with CREATEDB to run it.',
  );
}
const postgresDescribe = canCreateDatabase ? describe : describe.skip;
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

interface SchemaHarness {
  databaseName: string;
  admin: Pool;
  pool: Pool;
  db: Db;
}

interface ProfileBody {
  memberId: string;
  displayName: string | null;
  profileImage: { status: string };
  groups: {
    count: number;
    items: Array<{
      groupId: string;
      name: string;
      role: string;
      status: string;
      joinedAt: string;
    }>;
    nextCursor: string | null;
  };
  challenges: {
    activeCount: number;
    historyCount: number;
    totalCount: number;
    items: Array<{
      challengeId: string;
      participationId: string;
      title: string;
      status: string;
      bucket: string;
      joinedAt: string;
      exitedAt: string | null;
    }>;
    nextCursor: string | null;
  };
}

function quoteIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error('invalid test schema identifier');
  return `"${value}"`;
}

function wrapPool(pool: Pool): Db {
  const run = async <T>(client: PoolClient, text: string, params?: unknown[]) => {
    const result = await client.query(text, params);
    return { rows: result.rows as T[] };
  };
  return {
    async query<T>(text: string, params?: unknown[]) {
      const client = await pool.connect();
      try {
        return await run<T>(client, text, params);
      } finally {
        client.release();
      }
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx: Db = {
          query: <R>(text: string, params?: unknown[]) => run<R>(client, text, params),
          transaction: (nested) => nested(tx),
          close: async () => {},
        };
        const value = await fn(tx);
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

async function createHarness(): Promise<SchemaHarness> {
  const databaseName = `mc2b4_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: adminDatabaseUrl!, max: 1 });
  await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  const url = new URL(adminDatabaseUrl!);
  url.pathname = `/${databaseName}`;
  const pool = new Pool({ connectionString: url.toString(), max: 6 });
  return { databaseName, admin, pool, db: wrapPool(pool) };
}

async function destroyHarness(harness: SchemaHarness): Promise<void> {
  await harness.pool.end();
  await harness.admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(harness.databaseName)}`);
  await harness.admin.end();
}

function stubVerifier(uidByToken: Record<string, string>): TokenVerifier {
  return {
    async verify(bearerToken: string) {
      const uid = uidByToken[bearerToken];
      if (!uid) {
        const error = new Error('Token verification failed') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 401;
        error.code = 'invalid_token';
        throw error;
      }
      return { uid };
    },
  };
}

function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

function eligibleAuthority(): GroupMembershipAuthority {
  return {
    async resolveGroupMembershipAuthority() {
      return { status: 'active', eligible: true };
    },
  };
}

function appFor(db: Db, token: string, uid: string) {
  return buildApp({
    db,
    verifier: stubVerifier({ [token]: uid }),
    challengeActivity: { groupMembershipAuthority: eligibleAuthority() },
  });
}

async function seedMember(
  db: Db,
  subject: string,
  displayName: string | null = null,
): Promise<string> {
  const result = await db.query<{ member_id: string }>(
    `INSERT INTO members (auth_provider, auth_subject, display_name)
     VALUES ('firebase', $1, $2) RETURNING member_id`,
    [subject, displayName],
  );
  return String(result.rows[0].member_id);
}

async function seedGroup(
  db: Db,
  name: string,
  isPrivate = false,
): Promise<string> {
  const result = await db.query<{ group_id: string }>(
    `INSERT INTO groups (name, description, is_private)
     VALUES ($1, '', $2) RETURNING group_id`,
    [name, isPrivate],
  );
  return String(result.rows[0].group_id);
}

async function seedMembership(
  db: Db,
  groupId: string,
  memberId: string,
  options: { role?: string; status?: string; joinedAt?: string } = {},
): Promise<void> {
  await db.query(
    `INSERT INTO group_memberships (group_id, member_id, role, status, joined_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      groupId,
      memberId,
      options.role ?? 'member',
      options.status ?? 'active',
      options.joinedAt ?? '2026-05-01T09:00:00.000000Z',
    ],
  );
}

async function seedChallenge(
  db: Db,
  options: {
    groupId: string;
    creatorId: string;
    title: string;
    status?: 'establishment' | 'active' | 'ended';
    finalizedAt?: string | null;
  },
): Promise<string> {
  const result = await db.query<{ challenge_id: string }>(
    `INSERT INTO challenges
       (group_id, created_by_member_id, challenge_type, status, title,
        start_date, end_date, finalized_at)
     VALUES ($1, $2, 'competitive', $3, $4, '2026-01-01', '2026-12-31', $5)
     RETURNING challenge_id`,
    [
      options.groupId,
      options.creatorId,
      options.status ?? 'active',
      options.title,
      options.finalizedAt ?? null,
    ],
  );
  return String(result.rows[0].challenge_id);
}

async function seedParticipation(
  db: Db,
  options: {
    challengeId: string;
    memberId: string;
    status?: 'active' | 'withdrawn' | 'removed';
    joinedAt: string;
    exitedAt?: string | null;
  },
): Promise<string> {
  const status = options.status ?? 'active';
  const exitedAt = status === 'active' ? null : options.exitedAt ?? null;
  const result = await db.query<{ participation_id: string }>(
    `INSERT INTO challenge_participations
       (challenge_id, member_id, status, joined_at, joined_config_version,
        exited_at, exit_reason)
     VALUES ($1, $2, $3, $4, 1, $5, $6)
     RETURNING participation_id`,
    [
      options.challengeId,
      options.memberId,
      status,
      options.joinedAt,
      exitedAt,
      status === 'active' ? null : status,
    ],
  );
  return String(result.rows[0].participation_id);
}

async function seedChallengeConfig(db: Db, challengeId: string): Promise<void> {
  const knowledge = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle)
     VALUES ('fitness', $1, 'published')
     RETURNING knowledge_id, current_version`,
    [`MC-2B-4 Activity ${randomUUID()}`],
  );
  const knowledgeId = String(knowledge.rows[0].knowledge_id);
  const knowledgeVersion = Number(knowledge.rows[0].current_version);
  const snapshot = {
    challenge_type: 'competitive',
    period: { start_date: '2026-01-01', end_date: '2026-12-31' },
    type_params: {
      goal_value: null,
      goal_unit: null,
      required_consecutive_days: null,
      reset_on_miss: true,
    },
    timezone: 'UTC',
    activities: [{
      canonical_key: 'mc2b4-integration-activity',
      activity_variant: null,
      knowledge_id: knowledgeId,
      knowledge_version: knowledgeVersion,
      metric: 'completion',
      target_value: 1,
      unit: 'completion',
      position: 0,
      conditions: {},
      activity_code: null,
      required_components: [],
      component_relationship: null,
      load_reporting_basis: null,
      duration_mode: null,
      completion_occurrence: null,
    }],
    definition_kind: null,
    temporal_conditions: null,
  };
  await db.query(
    `INSERT INTO challenge_config_versions (challenge_id, version, snapshot)
     VALUES ($1, 1, $2::jsonb)`,
    [challengeId, JSON.stringify(snapshot)],
  );
  await db.query(
    `INSERT INTO challenge_activity_configs
       (challenge_id, version, canonical_key, activity_variant, knowledge_id,
        knowledge_version, metric, target_value, unit, position, conditions)
     VALUES ($1, 1, 'mc2b4-integration-activity', NULL, $2, $3, 'completion', 1, 'completion', 0, '{}'::jsonb)`,
    [challengeId, knowledgeId, knowledgeVersion],
  );
}

function summaryUnavailableDb(target: Db): Db {
  const wrap = (inner: Db): Db => ({
    async query<T>(text: string, params?: unknown[]) {
      if (/\b(group_memberships|challenge_participations)\b/i.test(text)) {
        throw new Error('test: Profile summaries unavailable');
      }
      return inner.query<T>(text, params);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      return inner.transaction((tx) => fn(wrap(tx)));
    },
    close: () => inner.close(),
  });
  return wrap(target);
}

async function patchProfile(
  app: ReturnType<typeof buildApp>,
  token: string,
  payload: unknown,
) {
  return app.inject({
    method: 'PATCH',
    url: '/api/me',
    headers: { ...authHeaders(token), 'content-type': 'application/json' },
    payload: payload as Record<string, unknown>,
  });
}

async function historyRows(db: Db, memberId: string) {
  const result = await db.query<{
    old_display_name: string | null;
    new_display_name: string;
  }>(
    `SELECT old_display_name, new_display_name
     FROM member_display_name_history
     WHERE member_id = $1 ORDER BY history_id`,
    [memberId],
  );
  return result.rows;
}

async function applyMigrationsThrough(db: Db, lastFile: string): Promise<void> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  );
  const files = (await listMigrationFiles()).filter((file) => file <= lastFile);
  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await db.transaction(async (tx) => {
      for (const statement of splitStatements(sql)) {
        await tx.query(statement);
      }
      await tx.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    });
  }
}

postgresDescribe('MC-2B-4 real PostgreSQL integration', () => {
  let harness: SchemaHarness;

  beforeAll(async () => {
    harness = await createHarness();
    await ensurePostgresExtension(harness.pool);
    await runMigrations(harness.db);
  }, 60000);

  afterAll(async () => {
    if (harness) await destroyHarness(harness);
  });

  it('composes the complete Profile from real persisted Group and Challenge truth', async () => {
    const db = harness.db;
    const subject = `mc2b4-profile-${randomUUID()}`;
    const token = `token-${randomUUID()}`;
    const memberId = await seedMember(db, subject, 'Ada Lovelace');
    const otherMemberId = await seedMember(db, `mc2b4-other-${randomUUID()}`);

    const privateGroup = await seedGroup(db, 'Private Group', true);
    const publicGroup = await seedGroup(db, 'Public Group');
    const pendingGroup = await seedGroup(db, 'Pending Group');
    const otherGroup = await seedGroup(db, 'Other Group');
    await seedMembership(db, privateGroup, memberId, {
      role: 'owner',
      status: 'active',
      joinedAt: '2026-05-03T09:00:00.000000Z',
    });
    await seedMembership(db, publicGroup, memberId, {
      status: 'joined',
      joinedAt: '2026-05-02T09:00:00.000000Z',
    });
    await seedMembership(db, pendingGroup, memberId, {
      status: 'pending',
      joinedAt: '2026-05-01T09:00:00.000000Z',
    });
    await seedMembership(db, otherGroup, otherMemberId, { status: 'active' });

    const activeChallenge = await seedChallenge(db, {
      groupId: privateGroup, creatorId: otherMemberId, title: 'Active challenge',
    });
    const activeParticipation = await seedParticipation(db, {
      challengeId: activeChallenge,
      memberId,
      joinedAt: '2026-05-05T09:00:00.123456Z',
    });
    const endedChallenge = await seedChallenge(db, {
      groupId: privateGroup,
      creatorId: otherMemberId,
      title: 'Ended but unfinalized',
      status: 'ended',
    });
    const endedParticipation = await seedParticipation(db, {
      challengeId: endedChallenge,
      memberId,
      joinedAt: '2026-05-04T09:00:00.000000Z',
    });
    const finalizedChallenge = await seedChallenge(db, {
      groupId: privateGroup,
      creatorId: otherMemberId,
      title: 'Finalized challenge',
      status: 'ended',
      finalizedAt: '2026-06-01T09:00:00.000000Z',
    });
    const finalizedParticipation = await seedParticipation(db, {
      challengeId: finalizedChallenge,
      memberId,
      joinedAt: '2026-05-03T09:00:00.000000Z',
    });
    const rejoinChallenge = await seedChallenge(db, {
      groupId: publicGroup, creatorId: otherMemberId, title: 'Rejoin challenge',
    });
    const withdrawnParticipation = await seedParticipation(db, {
      challengeId: rejoinChallenge,
      memberId,
      status: 'withdrawn',
      joinedAt: '2026-05-02T09:00:00.000000Z',
      exitedAt: '2026-05-02T10:00:00.000000Z',
    });
    const rejoinedParticipation = await seedParticipation(db, {
      challengeId: rejoinChallenge,
      memberId,
      joinedAt: '2026-05-02T11:00:00.000000Z',
    });
    const visibleOnly = await seedChallenge(db, {
      groupId: publicGroup,
      creatorId: otherMemberId,
      title: 'Visible but unjoined',
    });
    const otherChallenge = await seedChallenge(db, {
      groupId: otherGroup,
      creatorId: otherMemberId,
      title: 'Other member challenge',
    });
    await seedParticipation(db, {
      challengeId: otherChallenge,
      memberId: otherMemberId,
      joinedAt: '2026-05-01T09:00:00.000000Z',
    });

    for (const challengeId of [
      activeChallenge,
      endedChallenge,
      finalizedChallenge,
      rejoinChallenge,
      visibleOnly,
    ]) {
      await seedChallengeConfig(db, challengeId);
    }

    const app = appFor(db, token, subject);
    const response = await app.inject({
      method: 'GET', url: '/api/me', headers: authHeaders(token),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as ProfileBody;
    expect(body.memberId).toBe(memberId);
    expect(body.displayName).toBe('Ada Lovelace');
    expect(body.profileImage).toEqual({ status: 'not_configured' });
    expect(body.groups.count).toBe(2);
    expect(body.groups.items.map((item) => item.groupId).sort())
      .toEqual([privateGroup, publicGroup].sort());
    expect(body.groups.items.find((item) => item.groupId === privateGroup)).toMatchObject({
      name: 'Private Group', role: 'owner', status: 'active',
    });
    expect(body.challenges).toMatchObject({
      activeCount: 3,
      historyCount: 2,
      totalCount: 5,
      nextCursor: null,
    });
    const byParticipation = new Map(body.challenges.items.map((item) => [item.participationId, item]));
    expect(byParticipation.get(activeParticipation)).toMatchObject({
      challengeId: activeChallenge, status: 'active', bucket: 'active',
    });
    expect(byParticipation.get(endedParticipation)).toMatchObject({
      challengeId: endedChallenge, bucket: 'active',
    });
    expect(byParticipation.get(finalizedParticipation)).toMatchObject({
      challengeId: finalizedChallenge, status: 'active', bucket: 'history',
    });
    expect(byParticipation.get(withdrawnParticipation)).toMatchObject({
      challengeId: rejoinChallenge, status: 'withdrawn', bucket: 'history',
    });
    expect(byParticipation.get(rejoinedParticipation)).toMatchObject({
      challengeId: rejoinChallenge, status: 'active', bucket: 'active',
    });
    expect(body.challenges.items.map((item) => item.challengeId))
      .not.toContain(visibleOnly);
    expect(body.challenges.items.map((item) => item.challengeId))
      .not.toContain(otherChallenge);

    const visible = await app.inject({
      method: 'GET', url: '/api/challenges', headers: authHeaders(token),
    });
    expect(visible.statusCode).toBe(200);
    expect((visible.json() as { challenges: Array<{ challengeId: string }> }).challenges
      .map((challenge) => challenge.challengeId)).toContain(visibleOnly);
  });

  it('paginates Challenge summaries without skipping microseconds and counts the full set', async () => {
    const db = harness.db;
    const subject = `mc2b4-pages-${randomUUID()}`;
    const token = `token-${randomUUID()}`;
    const memberId = await seedMember(db, subject);
    const groupId = await seedGroup(db, 'Paged Group');
    await seedMembership(db, groupId, memberId);

    const joinedAt = [
      '2026-05-01T09:00:00.000001Z',
      '2026-05-01T09:00:00.000002Z',
      '2026-05-01T09:00:00.000003Z',
      '2026-05-01T09:00:00.000004Z',
    ];
    const participationIds: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const challengeId = await seedChallenge(db, {
        groupId,
        creatorId: memberId,
        title: `Paged challenge ${index}`,
      });
      participationIds.push(await seedParticipation(db, {
        challengeId,
        memberId,
        status: index === 3 ? 'withdrawn' : 'active',
        joinedAt: joinedAt[index],
        exitedAt: index === 3 ? '2026-05-01T10:00:00.000000Z' : null,
      }));
    }

    const app = appFor(db, token, subject);
    const first = await app.inject({
      method: 'GET',
      url: '/api/me?challengesLimit=2',
      headers: authHeaders(token),
    });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as ProfileBody;
    expect(firstBody.challenges).toMatchObject({
      activeCount: 3,
      historyCount: 1,
      totalCount: 4,
    });
    expect(firstBody.challenges.items).toHaveLength(2);
    expect(firstBody.challenges.nextCursor).toEqual(expect.any(String));

    const second = await app.inject({
      method: 'GET',
      url: `/api/me?challengesLimit=2&challengesCursor=${encodeURIComponent(firstBody.challenges.nextCursor!)}`,
      headers: authHeaders(token),
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json() as ProfileBody;
    expect(secondBody.challenges).toMatchObject({
      activeCount: 3,
      historyCount: 1,
      totalCount: 4,
    });
    expect(secondBody.challenges.items).toHaveLength(2);
    expect(secondBody.challenges.nextCursor).toBeNull();
    expect(new Set([
      ...firstBody.challenges.items,
      ...secondBody.challenges.items,
    ].map((item) => item.participationId))).toEqual(new Set(participationIds));
  });

  it('commits PATCH display name and history atomically, with a safe same-name retry', async () => {
    const db = harness.db;
    const subject = `mc2b4-patch-${randomUUID()}`;
    const token = `token-${randomUUID()}`;
    const memberId = await seedMember(db, subject);
    const groupId = await seedGroup(db, 'Patch Group');
    await seedMembership(db, groupId, memberId, { role: 'owner' });
    const creatorId = await seedMember(db, `mc2b4-patch-creator-${randomUUID()}`);
    const challengeId = await seedChallenge(db, {
      groupId, creatorId, title: 'Patch challenge',
    });
    await seedParticipation(db, {
      challengeId,
      memberId,
      joinedAt: '2026-05-01T09:00:00.000000Z',
    });

    const app = appFor(db, token, subject);
    const response = await patchProfile(app, token, { displayName: '  Cafe\u0301  ' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as ProfileBody;
    expect(body.displayName).toBe('Café');
    expect(body.groups.count).toBe(1);
    expect(body.challenges).toMatchObject({
      activeCount: 1, historyCount: 0, totalCount: 1,
    });

    const stored = await db.query<{ display_name: string; updated_at: Date }>(
      'SELECT display_name, updated_at FROM members WHERE member_id = $1',
      [memberId],
    );
    expect(stored.rows[0].display_name).toBe('Café');
    expect(await historyRows(db, memberId)).toEqual([{
      old_display_name: null,
      new_display_name: 'Café',
    }]);

    const retry = await patchProfile(app, token, { displayName: 'Café' });
    expect(retry.statusCode).toBe(200);
    const afterRetry = await db.query<{ updated_at: Date }>(
      'SELECT updated_at FROM members WHERE member_id = $1',
      [memberId],
    );
    expect(new Date(afterRetry.rows[0].updated_at).getTime())
      .toBe(new Date(stored.rows[0].updated_at).getTime());
    expect(await historyRows(db, memberId)).toHaveLength(1);
  });

  it('does not report success when a post-commit summary read fails on PostgreSQL', async () => {
    const db = harness.db;
    const subject = `mc2b4-failure-${randomUUID()}`;
    const token = `token-${randomUUID()}`;
    const memberId = await seedMember(db, subject);
    const failingApp = buildApp({
      db: summaryUnavailableDb(db),
      verifier: stubVerifier({ [token]: subject }),
    });

    const failed = await patchProfile(failingApp, token, { displayName: 'Committed Name' });
    expect(failed.statusCode).toBe(500);
    expect(failed.json()).toEqual({
      error: { code: 'internal_error', message: 'Internal server error' },
    });
    const stored = await db.query<{ display_name: string; updated_at: Date }>(
      'SELECT display_name, updated_at FROM members WHERE member_id = $1',
      [memberId],
    );
    expect(stored.rows[0].display_name).toBe('Committed Name');
    expect(await historyRows(db, memberId)).toHaveLength(1);

    const healthyApp = appFor(db, token, subject);
    const retry = await patchProfile(healthyApp, token, { displayName: 'Committed Name' });
    expect(retry.statusCode).toBe(200);
    expect((retry.json() as ProfileBody).displayName).toBe('Committed Name');
    const afterRetry = await db.query<{ updated_at: Date }>(
      'SELECT updated_at FROM members WHERE member_id = $1',
      [memberId],
    );
    expect(new Date(afterRetry.rows[0].updated_at).getTime())
      .toBe(new Date(stored.rows[0].updated_at).getTime());
    expect(await historyRows(db, memberId)).toHaveLength(1);
  });

  it('serializes concurrent PATCH requests over independent PostgreSQL connections', async () => {
    const db = harness.db;
    const subject = `mc2b4-concurrent-${randomUUID()}`;
    const token = `token-${randomUUID()}`;
    const memberId = await seedMember(db, subject);
    const app = appFor(db, token, subject);

    const responses = await Promise.all([
      patchProfile(app, token, { displayName: 'First' }),
      patchProfile(app, token, { displayName: 'Second' }),
    ]);
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    const history = await historyRows(db, memberId);
    expect(history).toHaveLength(2);
    expect(history[0].old_display_name).toBeNull();
    expect(history[1].old_display_name).toBe(history[0].new_display_name);
    expect(new Set(history.map((row) => row.new_display_name)))
      .toEqual(new Set(['First', 'Second']));
    const stored = await db.query<{ display_name: string }>(
      'SELECT display_name FROM members WHERE member_id = $1',
      [memberId],
    );
    expect(stored.rows[0].display_name).toBe(history[1].new_display_name);
  });
});

postgresDescribe('MC-2B-4 migration 027 acceptance', () => {
  let harness: SchemaHarness;

  beforeAll(async () => {
    harness = await createHarness();
    await ensurePostgresExtension(harness.pool);
    await applyMigrationsThrough(harness.db, '026_member_canonical_display_name.sql');
  }, 60000);

  afterAll(async () => {
    if (harness) await destroyHarness(harness);
  });

  it('applies 027 as an upgrade and keeps history append-only', async () => {
    const db = harness.db;
    const subject = `mc2b4-upgrade-${randomUUID()}`;
    const token = `token-${randomUUID()}`;
    const memberId = await seedMember(db, subject, 'Existing Name');

    const before = await db.query<{ history_table: string | null }>(
      `SELECT to_regclass('member_display_name_history')::text AS history_table`,
    );
    expect(before.rows[0].history_table).toBeNull();

    const app = appFor(db, token, subject);
    const failed = await patchProfile(app, token, { displayName: 'New Name' });
    expect(failed.statusCode).toBe(500);
    expect(failed.json().error.message).toBe('Internal server error');
    const unchanged = await db.query<{ display_name: string }>(
      'SELECT display_name FROM members WHERE member_id = $1',
      [memberId],
    );
    expect(unchanged.rows[0].display_name).toBe('Existing Name');

    const pending = await runMigrations(db);
    expect(pending).toContain('027_member_display_name_history.sql');
    expect(pending.filter((file) => file < '027_')).toEqual([]);

    const after = await db.query<{
      history_table: string | null;
      trigger_name: string | null;
    }>(
      `SELECT to_regclass('member_display_name_history')::text AS history_table,
              (SELECT tgname FROM pg_trigger
               WHERE tgname = 'member_display_name_history_append_only'
                 AND tgrelid = to_regclass('member_display_name_history')) AS trigger_name`,
    );
    expect(after.rows[0].history_table).not.toBeNull();
    expect(after.rows[0].trigger_name).toBe('member_display_name_history_append_only');

    const migrated = await patchProfile(app, token, { displayName: 'New Name' });
    expect(migrated.statusCode).toBe(200);
    expect((migrated.json() as ProfileBody).displayName).toBe('New Name');
    expect(await historyRows(db, memberId)).toEqual([{
      old_display_name: 'Existing Name',
      new_display_name: 'New Name',
    }]);

    await expect(db.query(
      `UPDATE member_display_name_history SET new_display_name = 'Changed'
       WHERE member_id = $1`,
      [memberId],
    )).rejects.toMatchObject({ code: '55000' });
    await expect(db.query(
      'DELETE FROM member_display_name_history WHERE member_id = $1',
      [memberId],
    )).rejects.toMatchObject({ code: '55000' });
  }, 60000);
});
