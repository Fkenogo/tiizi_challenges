/**
 * TIIZI S2-G — minimum V2 Group establishment acceptance tests.
 *
 * Proves the member-facing Group establishment chain end to end over the
 * REAL routes, with an in-memory GroupMutationStore standing in for
 * Firestore:
 *
 * - an authenticated member establishes a Group through `POST /v1/groups`;
 * - the creator becomes owner/active (Accountable Steward) through the
 *   governed authority — never client-supplied;
 * - the Firestore Group + owner membership are written through the single
 *   atomic store call, and the PostgreSQL shadow is synchronized after;
 * - `GET /v1/memberships/me` (the SAME contract the Challenge creation
 *   journey consumes) immediately exposes the newly created Group;
 * - the response never leaks the Firebase UID or the transitional Firestore id;
 * - client-supplied actor identity is rejected and never used;
 * - store failure fails closed with no shadow row and no Group;
 * - the PostgreSQL shadow written by S2-G NEVER authorizes Challenge
 *   creation (the live Group authority remains the only authority).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { stubVerifier, testDb, seedMember, seedGroup, seedMembership, authHeaders } from './helpers.js';
import type { GroupMutationStore } from '../src/groupMutations.js';
import { createFirestoreGroupMembershipAuthority } from '../src/firestoreGroupAuthority.js';
import { createFirestoreChallengeCreationAuthority } from '../src/firestoreChallengeCreationAuthority.js';
import type { FirestoreReader } from '../src/firestoreGroupAuthority.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

interface StoreOp {
  op: string;
  collection: string;
  docId: string;
}

/**
 * In-memory GroupMutationStore: deterministic Firestore stand-in. Creation
 * records ONE operation (the atomic group + owner membership batch) so the
 * test can prove the owner relation is never split.
 */
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
      // One atomic write: both documents land together or not at all.
      state.groups.set(id, { ...group });
      state.memberships.set(`${id}_${ownerUid}`, { ...ownerMembership, groupId: id });
      state.log.push({ op: 'createGroupWithOwner', collection: 'groups', docId: id });
      return id;
    },
    async getGroup(legacyId) {
      maybeFail();
      return state.groups.get(legacyId) ?? null;
    },
    async updateGroupCounter(legacyId, delta) {
      maybeFail();
      const group = state.groups.get(legacyId);
      if (!group) throw new Error('fake-store: missing group');
      group.memberCount = Number(group.memberCount ?? 0) + delta;
    },
    async getMembership(legacyId, firebaseUid) {
      maybeFail();
      return state.memberships.get(`${legacyId}_${firebaseUid}`) ?? null;
    },
    async setMembership(legacyId, firebaseUid, data) {
      maybeFail();
      state.memberships.set(`${legacyId}_${firebaseUid}`, { ...data });
    },
    async updateMembership(legacyId, firebaseUid, patch) {
      maybeFail();
      const existing = state.memberships.get(`${legacyId}_${firebaseUid}`);
      if (!existing) throw new Error('fake-store: missing membership');
      state.memberships.set(`${legacyId}_${firebaseUid}`, { ...existing, ...patch });
    },
  };
}

function appFor(tokens: Record<string, string>, store: GroupMutationStore) {
  return buildApp({ db: testDb(), verifier: stubVerifier(tokens), groupMutation: { store } });
}

interface EstablishmentBody {
  id: string;
  legacyId: string;
  name: string;
  isPrivate: boolean;
  role: string;
  status: string;
}

async function establish(
  app: ReturnType<typeof appFor>,
  token: string,
  payload: Record<string, unknown>,
) {
  return app.inject({
    method: 'POST',
    url: '/v1/groups',
    headers: authHeaders(token),
    payload,
  });
}

describe('S2-G governed Group establishment', () => {
  it('creator becomes owner through the governed authority and the Group is immediately readable', async () => {
    const db = testDb();
    const store = fakeStore();
    const memberId = await seedMember(db, 'founder-uid');
    const app = appFor({ 'founder-token': 'founder-uid' }, store);

    const created = await establish(app, 'founder-token', {
      name: '  Karura Sunrise Runners  ',
      description: 'Early mornings, easy pace.',
    });
    expect(created.statusCode).toBe(201);
    const body = created.json() as EstablishmentBody;
    expect(body.name).toBe('Karura Sunrise Runners');
    expect(body.role).toBe('owner');
    expect(body.status).toBe('active');
    expect(body.isPrivate).toBe(false);

    // The read contract the Challenge creation journey consumes exposes it.
    const mine = await app.inject({
      method: 'GET',
      url: '/v1/memberships/me',
      headers: authHeaders('founder-token'),
    });
    expect(mine.statusCode).toBe(200);
    const payload = mine.json() as {
      memberId: string;
      memberships: Array<{ groupId: string; role: string; status: string; group: { id: string; name: string; description: string } }>;
    };
    expect(payload.memberId).toBe(memberId);
    expect(payload.memberships).toHaveLength(1);
    expect(payload.memberships[0]).toMatchObject({
      groupId: body.id,
      role: 'owner',
      status: 'active',
      group: { id: body.id, name: 'Karura Sunrise Runners', description: 'Early mornings, easy pace.' },
    });
  });

  it('establishes Firestore Truth and the PostgreSQL shadow in one governed operation', async () => {
    const db = testDb();
    const store = fakeStore();
    await seedMember(db, 'founder-uid');
    const app = appFor({ 'founder-token': 'founder-uid' }, store);

    const created = await establish(app, 'founder-token', { name: 'Atomic Group' });
    expect(created.statusCode).toBe(201);
    const body = created.json() as EstablishmentBody;

    // Firestore truth: atomic group + owner membership (one batched call).
    expect(store.log.filter((entry) => entry.op === 'createGroupWithOwner')).toHaveLength(1);
    expect(store.groups.get(body.legacyId)).toMatchObject({
      name: 'Atomic Group',
      ownerId: 'founder-uid',
      status: 'active',
      allowMemberChallenges: true,
      memberCount: 1,
    });
    expect(store.memberships.get(`${body.legacyId}_founder-uid`)).toMatchObject({
      role: 'owner',
      status: 'active',
      userId: 'founder-uid',
    });

    // PostgreSQL shadow mirrors live state (never an authority).
    const shadowGroup = await db.query<{ name: string; description: string; status: string }>(
      `SELECT name, description, status FROM groups WHERE group_id = $1`,
      [body.id],
    );
    expect(shadowGroup.rows[0]).toMatchObject({ name: 'Atomic Group', description: '', status: 'active' });
    const shadowMembership = await db.query<{ role: string; status: string }>(
      `SELECT role, status FROM group_memberships
       WHERE group_id = $1 AND member_id = (SELECT member_id FROM members WHERE auth_subject = 'founder-uid')`,
      [body.id],
    );
    expect(shadowMembership.rows[0]).toEqual({ role: 'owner', status: 'active' });
  });

  it('description is optional and defaults to empty', async () => {
    const db = testDb();
    const store = fakeStore();
    await seedMember(db, 'founder-uid');
    const app = appFor({ 'founder-token': 'founder-uid' }, store);

    const created = await establish(app, 'founder-token', { name: 'No Description' });
    expect(created.statusCode).toBe(201);
    const body = created.json() as EstablishmentBody;
    expect(store.groups.get(body.legacyId)?.description).toBe('');
  });

  it('never leaks the Firebase UID or the transitional Firestore id', async () => {
    const db = testDb();
    const store = fakeStore();
    await seedMember(db, 'secret-uid-xyz');
    const app = appFor({ 'founder-token': 'secret-uid-xyz' }, store);

    const created = await establish(app, 'founder-token', { name: 'Quiet Group' });
    expect(created.statusCode).toBe(201);
    const body = created.json() as EstablishmentBody;
    expect(created.body).not.toContain('secret-uid-xyz');

    const mine = await app.inject({
      method: 'GET',
      url: '/v1/memberships/me',
      headers: authHeaders('founder-token'),
    });
    expect(mine.body).not.toContain('secret-uid-xyz');
    // The transitional Firestore id is a lookup key, not a domain identity.
    expect(mine.body).not.toContain(body.legacyId);
  });

  it('rejects client-supplied actor identity and establishes nothing', async () => {
    const store = fakeStore();
    await seedMember(testDb(), 'real-uid');
    const app = appFor({ 'real-token': 'real-uid' }, store);

    const response = await establish(app, 'real-token', {
      name: 'Hijack',
      ownerId: 'attacker-uid',
      userId: 'attacker-uid',
      role: 'owner',
    });
    expect(response.statusCode).toBe(400);
    expect(store.groups.size).toBe(0);
    const shadow = await testDb().query(`SELECT COUNT(*) AS count FROM groups`);
    expect(Number(shadow.rows[0].count)).toBe(0);
  });

  it('fails closed on store failure with no shadow row', async () => {
    const db = testDb();
    const store = fakeStore();
    store.failWith = new Error('firestore unavailable');
    await seedMember(db, 'founder-uid');
    const app = appFor({ 'founder-token': 'founder-uid' }, store);

    const response = await establish(app, 'founder-token', { name: 'Unlucky Group' });
    expect(response.statusCode).toBe(503);
    const shadow = await db.query(`SELECT COUNT(*) AS count FROM groups`);
    expect(Number(shadow.rows[0].count)).toBe(0);
  });

  it('fails closed when no governed store is configured', async () => {
    await seedMember(testDb(), 'founder-uid');
    const app = buildApp({ db: testDb(), verifier: stubVerifier({ t: 'founder-uid' }) });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/groups',
      headers: authHeaders('t'),
      payload: { name: 'No Store' },
    });
    expect(response.statusCode).toBe(503);
  });
});

/** Deterministic in-memory Firestore reader keyed by `collection/docId`. */
function fakeReader(docs: Map<string, Record<string, unknown>>): FirestoreReader {
  return {
    async getDocument(collection, docId) {
      const data = docs.get(`${collection}/${docId}`);
      return { exists: data !== undefined, data: () => data };
    },
  };
}

describe('S2-G does not weaken the Challenge Group-membership invariant', () => {
  it('the PostgreSQL shadow written by Group creation never authorizes Challenge creation', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'founder-uid');
    const groupId = await seedGroup(db, { legacyId: 'fs-group-shadow', name: 'Shadow Group' });
    // The shadow row S2-G creates (owner/active): it must NOT authorize.
    await seedMembership(db, groupId, memberId, { role: 'owner', status: 'active' });

    // Live Group authority: the Group exists and is active, but the member
    // has no live Firestore membership.
    const authority = createFirestoreChallengeCreationAuthority(
      db,
      fakeReader(new Map([
        ['groups/fs-group-shadow', { status: 'active', allowMemberChallenges: true }],
      ])),
    );
    const decision = await authority.resolveChallengeCreationAuthority(groupId, memberId);
    expect(decision).toMatchObject({ permitted: false, reason: 'no_membership' });
  });

  it('a live eligible membership is still permitted (invariant intact, not weakened)', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'founder-uid');
    const groupId = await seedGroup(db, { legacyId: 'fs-group-live', name: 'Live Group' });

    const authority = createFirestoreChallengeCreationAuthority(
      db,
      fakeReader(new Map([
        ['groups/fs-group-live', { status: 'active', allowMemberChallenges: true }],
        ['groupMembers/fs-group-live_founder-uid', { status: 'active', role: 'owner' }],
      ])),
    );
    const decision = await authority.resolveChallengeCreationAuthority(groupId, memberId);
    expect(decision).toMatchObject({ permitted: true, memberRole: 'owner' });
  });

  it('the read contract S2-G uses is the same membership read authority the Challenge journey gates on', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'founder-uid');
    const groupId = await seedGroup(db, { legacyId: 'fs-group-shared', name: 'Shared Group' });

    // Group membership read authority (used by the Challenge activity path).
    const membershipAuthority = createFirestoreGroupMembershipAuthority(
      db,
      fakeReader(new Map([
        ['groups/fs-group-shared', { status: 'active' }],
        ['groupMembers/fs-group-shared_founder-uid', { status: 'active', role: 'member' }],
      ])),
    );
    expect(await membershipAuthority.resolveGroupMembershipAuthority(groupId, memberId)).toMatchObject({
      eligible: true,
    });

    // No live membership -> no eligibility, even though a shadow could exist.
    const noMembership = createFirestoreGroupMembershipAuthority(
      db,
      fakeReader(new Map([['groups/fs-group-shared', { status: 'active' }]])),
    );
    expect(await noMembership.resolveGroupMembershipAuthority(groupId, memberId)).toMatchObject({
      eligible: false,
    });
  });
});
