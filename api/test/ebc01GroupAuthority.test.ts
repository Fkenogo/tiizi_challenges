/**
 * EBC-01 Group / Membership authority boundary tests.
 *
 * Proves the governed server-side Group mutation boundary (create / join /
 * leave) against the PostgreSQL test database:
 * - authenticated valid members can perform authorized governed operations;
 * - PostgreSQL rows authorize eligible members; missing/inactive Groups fail closed;
 * - client-supplied actor/member identity is rejected and never used;
 * - creation is atomic (group + owner membership never split);
 * - PostgreSQL transaction state is durable and no Firestore Group store is called.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { stubVerifier, testDb, seedMember, authHeaders, groupAuthorityUnavailableDb, forbiddenFirestoreGroupStore } from './helpers.js';
import type { GroupMutationStore } from '../src/groupMutations.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

async function seedUser(uid: string): Promise<string> {
  return seedMember(testDb(), uid);
}

function appFor(tokens: Record<string, string>, store: GroupMutationStore, db = testDb()) {
  return buildApp({ db, verifier: stubVerifier(tokens), groupMutation: { store } });
}

describe('governed group creation', () => {
  it('authenticated member creates PostgreSQL Group and Steward membership atomically', async () => {
    const db = testDb();
    const store = forbiddenFirestoreGroupStore();
    await seedUser('owner-uid');
    const app = appFor({ 'owner-token': 'owner-uid' }, store);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/groups',
      headers: authHeaders('owner-token'),
      payload: { name: 'River Runners', description: 'dawn patrol' },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      id: string; legacyId: string; name: string; isPrivate: boolean; role: string; status: string;
    };
    expect(body.name).toBe('River Runners');
    expect(body.isPrivate).toBe(false);
    expect(body.role).toBe('owner');
    expect(body.status).toBe('active');

    const member = await db.query<{ member_id: string }>(`SELECT member_id FROM members WHERE auth_subject='owner-uid'`);
    const group = await db.query<{ group_id: string; name: string; status: string; allow_member_challenges: boolean; steward_member_id: string }>(
      `SELECT group_id, name, status, allow_member_challenges, steward_member_id FROM groups WHERE group_id = $1`,
      [body.id],
    );
    const membership = await db.query<{ role: string; status: string }>(
      `SELECT role, status FROM group_memberships
       WHERE group_id = $1 AND member_id = (SELECT member_id FROM members WHERE auth_subject = 'owner-uid')`,
      [body.id],
    );
    expect(group.rows[0]).toMatchObject({ group_id: body.id, name: 'River Runners', status: 'active', allow_member_challenges: true, steward_member_id: member.rows[0].member_id });
    expect(membership.rows[0]).toEqual({ role: 'owner', status: 'active' });
    expect(store.calls).toEqual([]);
  });

  it('client-supplied actor identity is rejected and never used', async () => {
    const store = forbiddenFirestoreGroupStore();
    await seedUser('real-uid');
    const app = appFor({ 'real-token': 'real-uid' }, store);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/groups',
      headers: authHeaders('real-token'),
      payload: { name: 'Hijack', ownerId: 'attacker-uid', userId: 'attacker-uid' },
    });
    expect(response.statusCode).toBe(400);
    expect((await testDb().query(`SELECT 1 FROM groups WHERE name='Hijack'`)).rows).toHaveLength(0);
    expect(store.calls).toEqual([]);
  });

  it('PostgreSQL outage fails closed and never falls back to Firestore', async () => {
    const db = testDb();
    const store = forbiddenFirestoreGroupStore();
    await seedUser('owner-uid');
    const app = appFor({ 'owner-token': 'owner-uid' }, store, groupAuthorityUnavailableDb(db));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/groups',
      headers: authHeaders('owner-token'),
      payload: { name: 'Unlucky' },
    });
    expect(response.statusCode).toBe(503);
    expect(store.calls).toEqual([]);
    const persisted = await db.query(`SELECT COUNT(*) AS count FROM groups`);
    expect(Number(persisted.rows[0].count)).toBe(0);
  });

  it('V2 creation does not require a configured Firestore Group store', async () => {
    await seedUser('owner-uid');
    const app = buildApp({ db: testDb(), verifier: stubVerifier({ 't': 'owner-uid' }) });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/groups',
      headers: authHeaders('t'),
      payload: { name: 'NoStore' },
    });
    expect(response.statusCode).toBe(201);
    expect((await testDb().query(`SELECT 1 FROM groups WHERE name='NoStore'`)).rows).toHaveLength(1);
  });
});

describe('governed membership join / leave', () => {
  async function createdGroup(
    app: ReturnType<typeof appFor>,
    token: string,
    payload: Record<string, unknown> = { name: 'Joinable' },
  ) {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/groups',
      headers: authHeaders(token),
      payload,
    });
    expect(response.statusCode).toBe(201);
    return response.json() as { id: string; legacyId: string };
  }

  it('public group join activates PostgreSQL membership and derived count', async () => {
    const db = testDb();
    const store = forbiddenFirestoreGroupStore();
    await seedUser('owner-uid');
    await seedUser('joiner-uid');
    const app = appFor({ 'owner-token': 'owner-uid', 'join-token': 'joiner-uid' }, store);
    const group = await createdGroup(app, 'owner-token');

    const response = await app.inject({
      method: 'POST',
      url: `/v1/groups/${group.id}/join`,
      headers: authHeaders('join-token'),
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: group.id, status: 'joined', role: 'member' });
    const row = await db.query<{ status: string; role: string }>(
      `SELECT status, role FROM group_memberships
       WHERE group_id = $1 AND member_id = (SELECT member_id FROM members WHERE auth_subject = 'joiner-uid')`,
      [group.id],
    );
    expect(row.rows[0]).toEqual({ status: 'active', role: 'member' });
    const count = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM group_memberships WHERE group_id=$1 AND status IN ('active','joined')`, [group.id]);
    expect(count.rows[0].n).toBe(2);
    expect(store.calls).toEqual([]);
  });

  it('private group join stays pending with no counter bump', async () => {
    const store = forbiddenFirestoreGroupStore();
    await seedUser('owner-uid');
    await seedUser('joiner-uid');
    const app = appFor({ 'owner-token': 'owner-uid', 'join-token': 'joiner-uid' }, store);
    const group = await createdGroup(app, 'owner-token', { name: 'Private', isPrivate: true });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/groups/${group.id}/join`,
      headers: authHeaders('join-token'),
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'pending' });
    const db = testDb();
    const row = await db.query<{ status: string }>(`SELECT status FROM group_memberships WHERE group_id=$1 AND member_id=(SELECT member_id FROM members WHERE auth_subject='joiner-uid')`, [group.id]);
    expect(row.rows[0]?.status).toBe('pending');
    const count = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM group_memberships WHERE group_id=$1 AND status IN ('active','joined')`, [group.id]);
    expect(count.rows[0].n).toBe(1);
    expect(store.calls).toEqual([]);
  });

  it('leave withdraws an active membership and decrements the counter', async () => {
    const db = testDb();
    const store = forbiddenFirestoreGroupStore();
    await seedUser('owner-uid');
    await seedUser('joiner-uid');
    const app = appFor({ 'owner-token': 'owner-uid', 'join-token': 'joiner-uid' }, store);
    const group = await createdGroup(app, 'owner-token');
    await app.inject({
      method: 'POST',
      url: `/v1/groups/${group.id}/join`,
      headers: authHeaders('join-token'),
      payload: {},
    });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/groups/${group.id}/leave`,
      headers: authHeaders('join-token'),
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'left' });
    const row = await db.query<{ status: string; left_at: string | null }>(
      `SELECT status, left_at FROM group_memberships
       WHERE group_id = $1 AND member_id = (SELECT member_id FROM members WHERE auth_subject = 'joiner-uid')`,
      [group.id],
    );
    expect(row.rows[0]?.status).toBe('left');
    expect(row.rows[0]?.left_at).not.toBeNull();
    const count = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM group_memberships WHERE group_id=$1 AND status IN ('active','joined')`, [group.id]);
    expect(count.rows[0].n).toBe(1);
  });

  it('owner cannot leave; missing membership leave is an idempotent no-op', async () => {
    const store = forbiddenFirestoreGroupStore();
    await seedUser('owner-uid');
    await seedUser('stranger-uid');
    const app = appFor({ 'owner-token': 'owner-uid', 'stranger-token': 'stranger-uid' }, store);
    const group = await createdGroup(app, 'owner-token');

    const ownerLeave = await app.inject({
      method: 'POST',
      url: `/v1/groups/${group.id}/leave`,
      headers: authHeaders('owner-token'),
      payload: {},
    });
    expect(ownerLeave.statusCode).toBe(403);

    const strangerLeave = await app.inject({
      method: 'POST',
      url: `/v1/groups/${group.id}/leave`,
      headers: authHeaders('stranger-token'),
      payload: {},
    });
    expect(strangerLeave.statusCode).toBe(200);
    expect(strangerLeave.json()).toMatchObject({ status: 'none' });
  });

  it('PostgreSQL Group UUID is sufficient for governed join without a Firestore mapping', async () => {
    const db = testDb();
    const store = forbiddenFirestoreGroupStore();
    await seedUser('joiner-uid');
    // Shadow-only row: no legacy Firestore identity behind it.
    const shadow = await db.query<{ group_id: string }>(
      `INSERT INTO groups (legacy_firestore_id, name) VALUES (NULL, 'Shadow only') RETURNING group_id`,
      [],
    );
    // legacy_firestore_id is UNIQUE — NULL inserts are allowed and unmapped.
    const groupId = String(shadow.rows[0].group_id);
    const app = appFor({ 'join-token': 'joiner-uid' }, store);

    const response = await app.inject({
      method: 'POST',
      url: `/v1/groups/${groupId}/join`,
      headers: authHeaders('join-token'),
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: groupId, status: 'joined', role: 'member' });
    const membership = await db.query(`SELECT 1 FROM group_memberships WHERE group_id=$1 AND member_id=(SELECT member_id FROM members WHERE auth_subject='joiner-uid')`, [groupId]);
    expect(membership.rows).toHaveLength(1);
    expect(store.calls).toEqual([]);
  });

  it('inactive group fails closed on join with no membership write', async () => {
    const store = forbiddenFirestoreGroupStore();
    await seedUser('owner-uid');
    await seedUser('joiner-uid');
    const app = appFor({ 'owner-token': 'owner-uid', 'join-token': 'joiner-uid' }, store);
    const group = await createdGroup(app, 'owner-token');
    await testDb().query(`UPDATE groups SET status='suspended' WHERE group_id=$1`, [group.id]);

    const response = await app.inject({
      method: 'POST',
      url: `/v1/groups/${group.id}/join`,
      headers: authHeaders('join-token'),
      payload: {},
    });
    expect(response.statusCode).toBe(422);
    const membership = await testDb().query(`SELECT 1 FROM group_memberships WHERE group_id=$1 AND member_id=(SELECT member_id FROM members WHERE auth_subject='joiner-uid')`, [group.id]);
    expect(membership.rows).toHaveLength(0);
  });

  it('missing group fails closed on join and leave', async () => {
    const store = forbiddenFirestoreGroupStore();
    await seedUser('joiner-uid');
    const app = appFor({ 'join-token': 'joiner-uid' }, store);
    const missing = '11111111-1111-4111-8111-111111111111';

    for (const action of ['join', 'leave'] as const) {
      const response = await app.inject({
        method: 'POST',
        url: `/v1/groups/${missing}/${action}`,
        headers: authHeaders('join-token'),
        payload: {},
      });
      expect(response.statusCode).toBe(404);
    }
  });

  it('join body cannot smuggle member identity', async () => {
    const store = forbiddenFirestoreGroupStore();
    await seedUser('owner-uid');
    await seedUser('joiner-uid');
    const app = appFor({ 'owner-token': 'owner-uid', 'join-token': 'joiner-uid' }, store);
    const group = await createdGroup(app, 'owner-token');

    const response = await app.inject({
      method: 'POST',
      url: `/v1/groups/${group.id}/join`,
      headers: authHeaders('join-token'),
      payload: { userId: 'owner-uid', memberId: 'whatever' },
    });
    expect(response.statusCode).toBe(400);
    expect((await testDb().query(`SELECT 1 FROM group_memberships WHERE group_id=$1 AND member_id=(SELECT member_id FROM members WHERE auth_subject='joiner-uid')`, [group.id])).rows).toHaveLength(0);
    expect(store.calls).toEqual([]);
  });
});
