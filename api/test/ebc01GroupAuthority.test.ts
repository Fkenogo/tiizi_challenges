/**
 * EBC-01 Group / Membership authority boundary tests.
 *
 * Proves the governed server-side Group mutation boundary (create / join /
 * leave) with an in-memory GroupMutationStore standing in for Firestore:
 * - authenticated valid members can perform authorized governed operations;
 * - the PG shadow can never authorize (unmapped shadow rows fail closed);
 * - missing/inactive groups fail closed; unavailable stores fail closed;
 * - client-supplied actor/member identity is rejected and never used;
 * - creation is atomic (group + owner membership never split);
 * - the PG shadow mirrors live state after each governed mutation.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { stubVerifier, testDb, seedMember, authHeaders } from './helpers.js';
import type { GroupMutationStore } from '../src/groupMutations.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents',
  );
});

interface StoreOp {
  op: string;
  collection?: string;
  docId?: string;
}

/** In-memory GroupMutationStore: deterministic Firestore stand-in + op log. */
function fakeStore(): GroupMutationStore & {
  groups: Map<string, Record<string, unknown>>;
  memberships: Map<string, Record<string, unknown>>;
  log: StoreOp[];
  failWith: Error | null;
} {
  const state = {
    groups: new Map<string, Record<string, unknown>>(),
    memberships: new Map<string, Record<string, unknown>>(),
    log: [] as StoreOp[],
    failWith: null as Error | null,
    seq: 0,
  };
  const maybeFail = () => {
    if (state.failWith) throw state.failWith;
  };
  return {
    groups: state.groups,
    memberships: state.memberships,
    log: state.log,
    get failWith() {
      return state.failWith;
    },
    set failWith(value: Error | null) {
      state.failWith = value;
    },
    async createGroupWithOwner(group, ownerUid, ownerMembership) {
      maybeFail();
      state.seq += 1;
      const id = `group-${state.seq}`;
      state.groups.set(id, { ...group });
      state.memberships.set(`${id}_${ownerUid}`, { ...ownerMembership, groupId: id });
      state.log.push({ op: 'createGroupWithOwner', collection: 'groups', docId: id });
      return id;
    },
    async getGroup(legacyId) {
      maybeFail();
      state.log.push({ op: 'getGroup', collection: 'groups', docId: legacyId });
      return state.groups.get(legacyId) ?? null;
    },
    async updateGroupCounter(legacyId, delta) {
      maybeFail();
      state.log.push({ op: 'updateGroupCounter', collection: 'groups', docId: legacyId });
      const group = state.groups.get(legacyId);
      if (!group) throw new Error('fake-store: missing group for counter update');
      group.memberCount = Number(group.memberCount ?? 0) + delta;
    },
    async getMembership(legacyId, firebaseUid) {
      maybeFail();
      state.log.push({ op: 'getMembership', collection: 'groupMembers', docId: `${legacyId}_${firebaseUid}` });
      return state.memberships.get(`${legacyId}_${firebaseUid}`) ?? null;
    },
    async setMembership(legacyId, firebaseUid, data) {
      maybeFail();
      state.log.push({ op: 'setMembership', collection: 'groupMembers', docId: `${legacyId}_${firebaseUid}` });
      state.memberships.set(`${legacyId}_${firebaseUid}`, { ...data });
    },
    async updateMembership(legacyId, firebaseUid, patch) {
      maybeFail();
      state.log.push({ op: 'updateMembership', collection: 'groupMembers', docId: `${legacyId}_${firebaseUid}` });
      const existing = state.memberships.get(`${legacyId}_${firebaseUid}`);
      if (!existing) throw new Error('fake-store: missing membership for update');
      state.memberships.set(`${legacyId}_${firebaseUid}`, { ...existing, ...patch });
    },
  };
}

async function seedUser(uid: string): Promise<string> {
  return seedMember(testDb(), uid);
}

function appFor(tokens: Record<string, string>, store: GroupMutationStore) {
  return buildApp({ db: testDb(), verifier: stubVerifier(tokens), groupMutation: { store } });
}

describe('governed group creation', () => {
  it('authenticated member creates a group: atomic owner relation + shadow sync', async () => {
    const db = testDb();
    const store = fakeStore();
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

    // Authoritative side: group doc carries server-resolved owner + active lifecycle.
    const groupDoc = store.groups.get(body.legacyId);
    expect(groupDoc?.ownerId).toBe('owner-uid');
    expect(groupDoc?.status).toBe('active');
    expect(groupDoc?.allowMemberChallenges).toBe(true);
    const ownerDoc = store.memberships.get(`${body.legacyId}_owner-uid`);
    expect(ownerDoc).toMatchObject({ role: 'owner', status: 'active', userId: 'owner-uid' });

    // Relational side: PG shadow mirrors live state (never consulted for authority).
    const shadow = await db.query<{ group_id: string; name: string; status: string }>(
      `SELECT group_id, name, status FROM groups WHERE group_id = $1`,
      [body.id],
    );
    expect(shadow.rows[0]).toMatchObject({ name: 'River Runners', status: 'active' });
    const membership = await db.query<{ role: string; status: string }>(
      `SELECT role, status FROM group_memberships
       WHERE group_id = $1 AND member_id = (SELECT member_id FROM members WHERE auth_subject = 'owner-uid')`,
      [body.id],
    );
    expect(membership.rows[0]).toEqual({ role: 'owner', status: 'active' });
  });

  it('client-supplied actor identity is rejected and never used', async () => {
    const store = fakeStore();
    await seedUser('real-uid');
    const app = appFor({ 'real-token': 'real-uid' }, store);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/groups',
      headers: authHeaders('real-token'),
      payload: { name: 'Hijack', ownerId: 'attacker-uid', userId: 'attacker-uid' },
    });
    expect(response.statusCode).toBe(400);
    expect(store.groups.size).toBe(0);
  });

  it('store outage fails closed with no shadow row', async () => {
    const db = testDb();
    const store = fakeStore();
    store.failWith = new Error('firestore unavailable');
    await seedUser('owner-uid');
    const app = appFor({ 'owner-token': 'owner-uid' }, store);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/groups',
      headers: authHeaders('owner-token'),
      payload: { name: 'Unlucky' },
    });
    expect(response.statusCode).toBe(503);
    const shadow = await db.query(`SELECT COUNT(*) AS count FROM groups`);
    expect(Number(shadow.rows[0].count)).toBe(0);
  });

  it('missing store configuration fails closed', async () => {
    await seedUser('owner-uid');
    const app = buildApp({ db: testDb(), verifier: stubVerifier({ 't': 'owner-uid' }) });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/groups',
      headers: authHeaders('t'),
      payload: { name: 'NoStore' },
    });
    expect(response.statusCode).toBe(503);
  });
});

describe('governed membership join / leave', () => {
  async function createdGroup(
    store: ReturnType<typeof fakeStore>,
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

  it('public group join activates membership, bumps counter, syncs shadow', async () => {
    const db = testDb();
    const store = fakeStore();
    await seedUser('owner-uid');
    await seedUser('joiner-uid');
    const app = appFor({ 'owner-token': 'owner-uid', 'join-token': 'joiner-uid' }, store);
    const group = await createdGroup(store, app, 'owner-token');

    const response = await app.inject({
      method: 'POST',
      url: `/v1/groups/${group.id}/join`,
      headers: authHeaders('join-token'),
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: group.id, status: 'joined', role: 'member' });
    expect(store.memberships.get(`${group.legacyId}_joiner-uid`)).toMatchObject({
      status: 'active',
      role: 'member',
    });
    expect(store.groups.get(group.legacyId)?.memberCount).toBe(2);
    const shadow = await db.query<{ status: string }>(
      `SELECT status FROM group_memberships
       WHERE group_id = $1 AND member_id = (SELECT member_id FROM members WHERE auth_subject = 'joiner-uid')`,
      [group.id],
    );
    expect(shadow.rows[0]?.status).toBe('active');
  });

  it('private group join stays pending with no counter bump', async () => {
    const store = fakeStore();
    await seedUser('owner-uid');
    await seedUser('joiner-uid');
    const app = appFor({ 'owner-token': 'owner-uid', 'join-token': 'joiner-uid' }, store);
    const group = await createdGroup(store, app, 'owner-token', { name: 'Private', isPrivate: true });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/groups/${group.id}/join`,
      headers: authHeaders('join-token'),
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'pending' });
    expect(store.memberships.get(`${group.legacyId}_joiner-uid`)).toMatchObject({ status: 'pending' });
    expect(store.groups.get(group.legacyId)?.memberCount).toBe(1);
  });

  it('leave withdraws an active membership and decrements the counter', async () => {
    const db = testDb();
    const store = fakeStore();
    await seedUser('owner-uid');
    await seedUser('joiner-uid');
    const app = appFor({ 'owner-token': 'owner-uid', 'join-token': 'joiner-uid' }, store);
    const group = await createdGroup(store, app, 'owner-token');
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
    expect(store.memberships.get(`${group.legacyId}_joiner-uid`)).toMatchObject({ status: 'left' });
    expect(store.groups.get(group.legacyId)?.memberCount).toBe(1);
    const shadow = await db.query<{ status: string }>(
      `SELECT status FROM group_memberships
       WHERE group_id = $1 AND member_id = (SELECT member_id FROM members WHERE auth_subject = 'joiner-uid')`,
      [group.id],
    );
    expect(shadow.rows[0]?.status).toBe('left');
  });

  it('owner cannot leave; missing membership leave is an idempotent no-op', async () => {
    const store = fakeStore();
    await seedUser('owner-uid');
    await seedUser('stranger-uid');
    const app = appFor({ 'owner-token': 'owner-uid', 'stranger-token': 'stranger-uid' }, store);
    const group = await createdGroup(store, app, 'owner-token');

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

  it('PG shadow without a Firestore mapping cannot authorize join', async () => {
    const db = testDb();
    const store = fakeStore();
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
    expect(response.statusCode).toBe(404);
    expect(store.log.filter((entry) => entry.collection === 'groupMembers')).toHaveLength(0);
  });

  it('inactive group fails closed on join with no membership write', async () => {
    const store = fakeStore();
    await seedUser('owner-uid');
    await seedUser('joiner-uid');
    const app = appFor({ 'owner-token': 'owner-uid', 'join-token': 'joiner-uid' }, store);
    const group = await createdGroup(store, app, 'owner-token');
    store.groups.get(group.legacyId)!.status = 'archived';

    const response = await app.inject({
      method: 'POST',
      url: `/v1/groups/${group.id}/join`,
      headers: authHeaders('join-token'),
      payload: {},
    });
    expect(response.statusCode).toBe(422);
    expect(store.memberships.get(`${group.legacyId}_joiner-uid`)).toBeUndefined();
  });

  it('missing group fails closed on join and leave', async () => {
    const store = fakeStore();
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
    const store = fakeStore();
    await seedUser('owner-uid');
    await seedUser('joiner-uid');
    const app = appFor({ 'owner-token': 'owner-uid', 'join-token': 'joiner-uid' }, store);
    const group = await createdGroup(store, app, 'owner-token');

    const response = await app.inject({
      method: 'POST',
      url: `/v1/groups/${group.id}/join`,
      headers: authHeaders('join-token'),
      payload: { userId: 'owner-uid', memberId: 'whatever' },
    });
    expect(response.statusCode).toBe(400);
    expect(store.memberships.get(`${group.legacyId}_joiner-uid`)).toBeUndefined();
  });
});
