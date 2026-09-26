import { beforeEach, describe, expect, it } from 'vitest';
import { authHeaders, buildTestApp, groupAuthorityUnavailableDb, seedMember, seedMembership, testDb } from './helpers.js';

beforeEach(async () => {
  await testDb().query('TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals');
});

async function subject(db: ReturnType<typeof testDb>, memberId: string) {
  const result = await db.query<{ auth_subject: string }>('SELECT auth_subject FROM members WHERE member_id=$1', [memberId]);
  return result.rows[0].auth_subject;
}

describe('S4b governed member roster', () => {
  it('returns one live-owner Steward and ordinary members without provider or storage identity', async () => {
    const db = testDb();
    const steward = await seedMember(db, 's4b-owner'); const ordinary = await seedMember(db, 's4b-member');
    const ownerUid = await subject(db, steward); const memberUid = await subject(db, ordinary);
    const app = buildTestApp({ owner: ownerUid, member: memberUid });
    const created = (await app.inject({ method: 'POST', url: '/v1/groups', headers: authHeaders('owner'), payload: { name: 'Miles' } })).json() as { id: string };
    await seedMembership(db, created.id, ordinary, { status: 'active', role: 'admin' });
    const response = await app.inject({ method: 'GET', url: `/v1/groups/${created.id}/members`, headers: authHeaders('member') });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { groupId: string; members: Array<Record<string, unknown>> };
    expect(body.members).toHaveLength(2);
    expect(body.members.filter((m) => m.relationship === 'steward')).toHaveLength(1);
    expect(body.members.find((m) => m.memberId === ordinary)?.relationship).toBe('member');
    const encoded = JSON.stringify(body);
    expect(encoded).not.toContain(ownerUid); expect(encoded).not.toContain(memberUid);
    expect(body.groupId).toBe(created.id); expect(encoded).not.toContain('role');
    expect(encoded).not.toMatch(/email|phone|displayName|photo|profile|avatar|participation/i);
  });

  it('denies outsiders, pending applicants, and ended members without leaking private Group existence', async () => {
    const db = testDb();
    const owner = await seedMember(db, 's4b-private-owner'); const outsider = await seedMember(db, 's4b-outsider'); const pending = await seedMember(db, 's4b-pending'); const ended = await seedMember(db, 's4b-ended');
    const app = buildTestApp({ owner: await subject(db, owner), outsider: await subject(db, outsider), pending: await subject(db, pending), ended: await subject(db, ended) });
    const created = (await app.inject({ method: 'POST', url: '/v1/groups', headers: authHeaders('owner'), payload: { name: 'Private', isPrivate: true } })).json() as { id: string };
    await seedMembership(db, created.id, pending, { status: 'pending', role: 'admin' });
    await seedMembership(db, created.id, ended, { status: 'left', role: 'admin' });
    for (const token of ['outsider', 'pending', 'ended']) {
      const response = await app.inject({ method: 'GET', url: `/v1/groups/${created.id}/members`, headers: authHeaders(token) });
      expect(response.statusCode).toBe(404);
      expect(response.body).not.toContain('Private');
    }
    expect((await app.inject({ method: 'GET', url: `/v1/groups/${created.id}/members` })).statusCode).toBe(401);
    const malformed = await app.inject({ method: 'GET', url: '/v1/groups/not-an-id/members', headers: authHeaders('outsider') });
    expect(malformed.statusCode).toBe(400);
  });

  it('PostgreSQL membership authorizes roster access; pending access and database outage fail closed', async () => {
    const db = testDb();
    const owner = await seedMember(db, 's4b-pg-owner');
    const outsider = await seedMember(db, 's4b-shadow-out');
    const ownerUid = await subject(db, owner);
    const outsiderUid = await subject(db, outsider);
    const app = buildTestApp({ owner: ownerUid, outsider: outsiderUid });
    const created = (await app.inject({ method: 'POST', url: '/v1/groups', headers: authHeaders('owner'), payload: { name: 'PG roster' } })).json() as { id: string };
    await seedMembership(db, created.id, outsider, { status: 'active', role: 'member' });
    const authorized = await app.inject({ method: 'GET', url: `/v1/groups/${created.id}/members`, headers: authHeaders('outsider') });
    expect(authorized.statusCode).toBe(200);
    expect((authorized.json() as { members: unknown[] }).members).toHaveLength(2);
    await db.query(`UPDATE group_memberships SET status='pending' WHERE group_id=$1 AND member_id=$2`, [created.id, outsider]);
    expect((await app.inject({ method: 'GET', url: `/v1/groups/${created.id}/members`, headers: authHeaders('outsider') })).statusCode).toBe(404);
    const outageApp = buildTestApp({ owner: ownerUid }, { db: groupAuthorityUnavailableDb(db) });
    expect((await outageApp.inject({ method: 'GET', url: `/v1/groups/${created.id}/members`, headers: authHeaders('owner') })).statusCode).toBe(503);
  });

  it('reuses governed leave: ordinary Member leaves durably while the Steward remains blocked', async () => {
    const db = testDb();
    const steward = await seedMember(db, 's4b-leave-owner'); const member = await seedMember(db, 's4b-leave-member');
    const ownerUid = await subject(db, steward); const memberUid = await subject(db, member);
    const app = buildTestApp({ owner: ownerUid, member: memberUid });
    const created = (await app.inject({ method: 'POST', url: '/v1/groups', headers: authHeaders('owner'), payload: { name: 'Leave test' } })).json() as { id: string };
    await seedMembership(db, created.id, member, { status: 'active', role: 'admin' });
    const blocked = await app.inject({ method: 'POST', url: `/v1/groups/${created.id}/leave`, headers: authHeaders('owner'), payload: {} });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.body).toContain('cannot leave while responsible');
    const left = await app.inject({ method: 'POST', url: `/v1/groups/${created.id}/leave`, headers: authHeaders('member'), payload: {} });
    expect(left.statusCode).toBe(200);
    const persisted = await db.query<{ status: string; left_at: string | null }>(`SELECT status,left_at FROM group_memberships WHERE group_id=$1 AND member_id=$2`, [created.id, member]);
    expect(persisted.rows[0].status).toBe('left');
    expect(persisted.rows[0].left_at).not.toBeNull();
    const roster = await app.inject({ method: 'GET', url: `/v1/groups/${created.id}/members`, headers: authHeaders('member') });
    expect(roster.statusCode).toBe(404);
    const stewardRoster = await app.inject({ method: 'GET', url: `/v1/groups/${created.id}/members`, headers: authHeaders('owner') });
    expect(stewardRoster.statusCode).toBe(200);
  });
});
