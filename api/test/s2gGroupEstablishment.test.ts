/**
 * TIIZI S2-G — minimum V2 Group establishment acceptance tests.
 *
 * Proves the member-facing Group establishment chain end to end over the
 * real API routes and PostgreSQL test database:
 *
 * - an authenticated member establishes a Group through `POST /v1/groups`;
 * - the creator becomes owner/active (Accountable Steward) through the
 *   governed authority — never client-supplied;
 * - Group + Accountable Steward membership commit atomically in PostgreSQL;
 * - `GET /v1/memberships/me` (the SAME contract the Challenge creation
 *   journey consumes) immediately exposes the newly created Group;
 * - the response never leaks the Firebase UID;
 * - client-supplied actor identity is rejected and never used;
 * - PostgreSQL failure fails closed with no Group and no Firestore fallback;
 * - Group Challenge authorization uses PostgreSQL membership truth.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { stubVerifier, testDb, seedMember, seedGroup, seedMembership, authHeaders, groupAuthorityUnavailableDb } from './helpers.js';
import { createPostgresGroupMembershipAuthority, createPostgresChallengeCreationAuthority } from '../src/postgresGroupAuthority.js';
import { forbiddenFirestoreGroupStore } from './helpers.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

function appFor(tokens: Record<string, string>, store: ReturnType<typeof forbiddenFirestoreGroupStore>, db = testDb()) {
  return buildApp({ db, verifier: stubVerifier(tokens), groupMutation: { store } });
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
    const store = forbiddenFirestoreGroupStore();
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

  it('establishes PostgreSQL Group and Steward membership in one transaction', async () => {
    const db = testDb();
    const store = forbiddenFirestoreGroupStore();
    await seedMember(db, 'founder-uid');
    const app = appFor({ 'founder-token': 'founder-uid' }, store);

    const created = await establish(app, 'founder-token', { name: 'Atomic Group' });
    expect(created.statusCode).toBe(201);
    const body = created.json() as EstablishmentBody;

    const group = await db.query<{ name: string; description: string; status: string; steward_member_id: string }>(
      `SELECT name, description, status, steward_member_id FROM groups WHERE group_id = $1`,
      [body.id],
    );
    expect(group.rows[0]).toMatchObject({ name: 'Atomic Group', description: '', status: 'active' });
    const membership = await db.query<{ role: string; status: string; member_id: string }>(
      `SELECT role, status, member_id FROM group_memberships
       WHERE group_id = $1 AND member_id = (SELECT member_id FROM members WHERE auth_subject = 'founder-uid')`,
      [body.id],
    );
    expect(membership.rows[0]).toMatchObject({ role: 'owner', status: 'active', member_id: group.rows[0].steward_member_id });
    expect(store.calls).toEqual([]);
  });

  it('description is optional and defaults to empty', async () => {
    const db = testDb();
    const store = forbiddenFirestoreGroupStore();
    await seedMember(db, 'founder-uid');
    const app = appFor({ 'founder-token': 'founder-uid' }, store);

    const created = await establish(app, 'founder-token', { name: 'No Description' });
    expect(created.statusCode).toBe(201);
    const body = created.json() as EstablishmentBody;
    const group = await db.query<{ description: string }>(`SELECT description FROM groups WHERE group_id=$1`, [body.id]);
    expect(group.rows[0]?.description).toBe('');
    expect(store.calls).toEqual([]);
  });

  it('never leaks the Firebase UID and returns the canonical Group UUID', async () => {
    const db = testDb();
    const store = forbiddenFirestoreGroupStore();
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
    const membership = (mine.json() as { memberships: Array<{ groupId: string }> }).memberships[0];
    expect(membership.groupId).toBe(body.id);
  });

  it('rejects client-supplied actor identity and establishes nothing', async () => {
    const store = forbiddenFirestoreGroupStore();
    await seedMember(testDb(), 'real-uid');
    const app = appFor({ 'real-token': 'real-uid' }, store);

    const response = await establish(app, 'real-token', {
      name: 'Hijack',
      ownerId: 'attacker-uid',
      userId: 'attacker-uid',
      role: 'owner',
    });
    expect(response.statusCode).toBe(400);
    expect(store.calls).toEqual([]);
    const persisted = await testDb().query(`SELECT COUNT(*) AS count FROM groups`);
    expect(Number(persisted.rows[0].count)).toBe(0);
  });

  it('fails closed on PostgreSQL failure without falling back to Firestore', async () => {
    const db = testDb();
    const store = forbiddenFirestoreGroupStore();
    await seedMember(db, 'founder-uid');
    const app = appFor({ 'founder-token': 'founder-uid' }, store, groupAuthorityUnavailableDb(db));

    const response = await establish(app, 'founder-token', { name: 'Unlucky Group' });
    expect(response.statusCode).toBe(503);
    expect(store.calls).toEqual([]);
    const persisted = await db.query(`SELECT COUNT(*) AS count FROM groups`);
    expect(Number(persisted.rows[0].count)).toBe(0);
  });

  it('creates through PostgreSQL when no legacy Firestore store is configured', async () => {
    await seedMember(testDb(), 'founder-uid');
    const app = buildApp({ db: testDb(), verifier: stubVerifier({ t: 'founder-uid' }) });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/groups',
      headers: authHeaders('t'),
      payload: { name: 'No Store' },
    });
    expect(response.statusCode).toBe(201);
    expect((await testDb().query(`SELECT 1 FROM groups WHERE name='No Store'`)).rows).toHaveLength(1);
  });
});

describe('S2-G does not weaken the Challenge Group-membership invariant', () => {
  it('a Group without an eligible PostgreSQL membership cannot authorize Challenge creation', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'founder-uid');
    const groupId = await seedGroup(db, { name: 'PG Group' });
    const authority = createPostgresChallengeCreationAuthority(db);
    const decision = await authority.resolveChallengeCreationAuthority(groupId, memberId);
    expect(decision).toMatchObject({ permitted: false, reason: 'no_membership' });
  });

  it('a live eligible membership is still permitted (invariant intact, not weakened)', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'founder-uid');
    const groupId = await seedGroup(db, { name: 'PG Group' });
    await db.query(`UPDATE groups SET allow_member_challenges=true WHERE group_id=$1`, [groupId]);
    await seedMembership(db, groupId, memberId, { role: 'owner', status: 'active' });
    const authority = createPostgresChallengeCreationAuthority(db);
    const decision = await authority.resolveChallengeCreationAuthority(groupId, memberId);
    expect(decision).toMatchObject({ permitted: true, memberRole: 'owner' });
  });

  it('the read contract S2-G uses is the same membership read authority the Challenge journey gates on', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'founder-uid');
    const groupId = await seedGroup(db, { name: 'PG Shared Group' });
    await seedMembership(db, groupId, memberId, { role: 'member', status: 'active' });
    const membershipAuthority = createPostgresGroupMembershipAuthority(db);
    expect(await membershipAuthority.resolveGroupMembershipAuthority(groupId, memberId)).toMatchObject({
      eligible: true,
    });

    await db.query(`UPDATE group_memberships SET status='left',left_at=now() WHERE group_id=$1 AND member_id=$2`, [groupId, memberId]);
    const noMembership = createPostgresGroupMembershipAuthority(db);
    expect(await noMembership.resolveGroupMembershipAuthority(groupId, memberId)).toMatchObject({
      eligible: false,
    });
  });
});
