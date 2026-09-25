import { beforeEach, describe, expect, it } from 'vitest';
import type { GroupMutationStore } from '../src/groupMutations.js';
import { authHeaders, buildTestApp, seedMember, testDb } from './helpers.js';

beforeEach(async () => {
  await testDb().query('TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals');
});

function storeFixture() {
  const groups = new Map<string, Record<string, unknown>>();
  const memberships = new Map<string, Record<string, unknown>>();
  let next = 0;
  const store: GroupMutationStore = {
    async createGroupWithOwner(group, uid, membership) { const id = `s4b-${++next}`; groups.set(id, { ...group }); memberships.set(`${id}_${uid}`, { ...membership, userId: uid, groupId: id }); return id; },
    async getGroup(id) { return groups.get(id) ?? null; },
    async updateGroupCounter() {},
    async getMembership(id, uid) { return memberships.get(`${id}_${uid}`) ?? null; },
    async listMemberships(id) { return [...memberships.values()].filter((row) => row.groupId === id); },
    async setMembership(id, uid, row) { memberships.set(`${id}_${uid}`, { ...row, userId: uid, groupId: id }); },
    async updateMembership(id, uid, patch) { const key = `${id}_${uid}`; memberships.set(key, { ...memberships.get(key), ...patch }); },
  };
  return { store, groups, memberships };
}
async function subject(db: ReturnType<typeof testDb>, memberId: string) {
  const result = await db.query<{ auth_subject: string }>('SELECT auth_subject FROM members WHERE member_id=$1', [memberId]);
  return result.rows[0].auth_subject;
}

describe('S4b governed member roster', () => {
  it('returns one live-owner Steward and ordinary members without provider or storage identity', async () => {
    const db = testDb(); const fixture = storeFixture();
    const steward = await seedMember(db, 's4b-owner'); const ordinary = await seedMember(db, 's4b-member');
    const ownerUid = await subject(db, steward); const memberUid = await subject(db, ordinary);
    const app = buildTestApp({ owner: ownerUid, member: memberUid }, { groupMutation: { store: fixture.store } });
    const created = (await app.inject({ method: 'POST', url: '/v1/groups', headers: authHeaders('owner'), payload: { name: 'Miles' } })).json() as { id: string; legacyId: string };
    fixture.memberships.set(`${created.legacyId}_${memberUid}`, { groupId: created.legacyId, userId: memberUid, status: 'active', role: 'admin', createdAt: '2026-01-01T00:00:00.000Z' });
    const response = await app.inject({ method: 'GET', url: `/v1/groups/${created.id}/members`, headers: authHeaders('member') });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { members: Array<Record<string, unknown>> };
    expect(body.members).toHaveLength(2);
    expect(body.members.filter((m) => m.relationship === 'steward')).toHaveLength(1);
    expect(body.members.find((m) => m.memberId === ordinary)?.relationship).toBe('member');
    const encoded = JSON.stringify(body);
    expect(encoded).not.toContain(ownerUid); expect(encoded).not.toContain(memberUid);
    expect(encoded).not.toContain(created.legacyId); expect(encoded).not.toContain('role');
    expect(encoded).not.toMatch(/email|phone|displayName|photo|profile|avatar|participation/i);
  });

  it('denies outsiders, pending applicants, and ended members without leaking private Group existence', async () => {
    const db = testDb(); const fixture = storeFixture();
    const owner = await seedMember(db, 's4b-private-owner'); const outsider = await seedMember(db, 's4b-outsider'); const pending = await seedMember(db, 's4b-pending'); const ended = await seedMember(db, 's4b-ended');
    const app = buildTestApp({ owner: await subject(db, owner), outsider: await subject(db, outsider), pending: await subject(db, pending), ended: await subject(db, ended) }, { groupMutation: { store: fixture.store } });
    const created = (await app.inject({ method: 'POST', url: '/v1/groups', headers: authHeaders('owner'), payload: { name: 'Private', isPrivate: true } })).json() as { id: string; legacyId: string };
    fixture.memberships.set(`${created.legacyId}_${await subject(db, pending)}`, { groupId: created.legacyId, userId: await subject(db, pending), status: 'pending', role: 'admin' });
    fixture.memberships.set(`${created.legacyId}_${await subject(db, ended)}`, { groupId: created.legacyId, userId: await subject(db, ended), status: 'ended', role: 'admin' });
    for (const token of ['outsider', 'pending', 'ended']) {
      const response = await app.inject({ method: 'GET', url: `/v1/groups/${created.id}/members`, headers: authHeaders(token) });
      expect(response.statusCode).toBe(404);
      expect(response.body).not.toContain('Private');
    }
    expect((await app.inject({ method: 'GET', url: `/v1/groups/${created.id}/members` })).statusCode).toBe(401);
    const malformed = await app.inject({ method: 'GET', url: '/v1/groups/not-an-id/members', headers: authHeaders('outsider') });
    expect(malformed.statusCode).toBe(400);
  });

  it('rejects shadow-only access and fails closed when steward attribution cannot map', async () => {
    const db = testDb(); const fixture = storeFixture();
    const outsider = await seedMember(db, 's4b-shadow-out'); const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await db.query(`INSERT INTO groups (group_id, name, description, is_private, status, legacy_firestore_id) VALUES ($1,'Shadow','',false,'active','orphan-live')`, [id]);
    const outsiderUid = await subject(db, outsider);
    const app = buildTestApp({ outsider: outsiderUid }, { groupMutation: { store: fixture.store } });
    fixture.groups.set('orphan-live', { name: 'Live', ownerId: 'orphan-uid', status: 'active', isPrivate: false });
    // A PostgreSQL shadow membership alone must not grant the live Group read.
    await db.query(`INSERT INTO group_memberships (group_id, member_id, role, status) VALUES ($1,$2,'member','active')`, [id, outsider]);
    expect((await app.inject({ method: 'GET', url: `/v1/groups/${id}/members`, headers: authHeaders('outsider') })).statusCode).toBe(404);
    fixture.memberships.set(`orphan-live_${outsiderUid}`, { groupId: 'orphan-live', userId: outsiderUid, status: 'active', role: 'member' });
    expect((await app.inject({ method: 'GET', url: `/v1/groups/${id}/members`, headers: authHeaders('outsider') })).statusCode).toBe(503);
    const malformed = await app.inject({ method: 'GET', url: '/v1/groups/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/members', headers: authHeaders('outsider') });
    expect(malformed.statusCode).toBe(404);
  });

  it('reuses governed leave: ordinary Member leaves durably while the Steward remains blocked', async () => {
    const db = testDb(); const fixture = storeFixture();
    const steward = await seedMember(db, 's4b-leave-owner'); const member = await seedMember(db, 's4b-leave-member');
    const ownerUid = await subject(db, steward); const memberUid = await subject(db, member);
    const app = buildTestApp({ owner: ownerUid, member: memberUid }, { groupMutation: { store: fixture.store } });
    const created = (await app.inject({ method: 'POST', url: '/v1/groups', headers: authHeaders('owner'), payload: { name: 'Leave test' } })).json() as { id: string; legacyId: string };
    fixture.memberships.set(`${created.legacyId}_${memberUid}`, { groupId: created.legacyId, userId: memberUid, status: 'active', role: 'admin', createdAt: '2026-01-01T00:00:00.000Z' });
    const blocked = await app.inject({ method: 'POST', url: `/v1/groups/${created.id}/leave`, headers: authHeaders('owner'), payload: {} });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.body).toContain('cannot leave while responsible');
    const left = await app.inject({ method: 'POST', url: `/v1/groups/${created.id}/leave`, headers: authHeaders('member'), payload: {} });
    expect(left.statusCode).toBe(200);
    expect(fixture.memberships.get(`${created.legacyId}_${memberUid}`)?.status).toBe('left');
    const roster = await app.inject({ method: 'GET', url: `/v1/groups/${created.id}/members`, headers: authHeaders('member') });
    expect(roster.statusCode).toBe(404);
    const stewardRoster = await app.inject({ method: 'GET', url: `/v1/groups/${created.id}/members`, headers: authHeaders('owner') });
    expect(stewardRoster.statusCode).toBe(200);
  });
});
