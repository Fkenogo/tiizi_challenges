import { beforeEach, describe, expect, it } from 'vitest';
import { createPostgresGroupMembershipAuthority } from '../src/postgresGroupAuthority.js';
import { authHeaders, buildTestApp, groupAuthorityUnavailableDb, seedMember, testDb } from './helpers.js';

beforeEach(async () => {
  await testDb().query('TRUNCATE challenge_social_cause_decisions, challenge_social_causes, challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals');
});

async function createGroup(app: ReturnType<typeof buildTestApp>, token: string, payload: Record<string, unknown>) {
  const response = await app.inject({ method: 'POST', url: '/api/groups', headers: authHeaders(token), payload });
  expect(response.statusCode).toBe(201);
  return response.json() as { id: string };
}

describe('S4c PostgreSQL discovery and admission', () => {
  it('lists only active discoverable Groups, narrows governed text, and paginates deterministically', async () => {
    const db = testDb();
    for (const uid of ['discover-owner', 'discover-member']) await seedMember(db, uid);
    const app = buildTestApp({ owner: 'discover-owner', member: 'discover-member' });
    const first = await createGroup(app, 'owner', { name: 'Dawn Runners', description: 'Quiet miles', focusTags: ['running'], goalIds: ['build_consistency'] });
    const second = await createGroup(app, 'owner', { name: 'Evening Walkers', tagline: 'Walk together', location: 'Karura' });
    const privateGroup = await createGroup(app, 'owner', { name: 'Hidden Circle', isPrivate: true });
    const ended = await createGroup(app, 'owner', { name: 'Old Runners' });
    await db.query(`UPDATE groups SET created_at=created_at + interval '1 second' WHERE group_id=$1`, [second.id]);
    await db.query(`UPDATE groups SET status='ended' WHERE group_id=$1`, [ended.id]);

    const page = await app.inject({ method: 'GET', url: '/api/groups/discover?limit=1', headers: authHeaders('member') });
    expect(page.statusCode).toBe(200);
    expect(page.json().groups).toHaveLength(1);
    expect(page.json().groups[0]).toMatchObject({ id: second.id, name: 'Evening Walkers', location: 'Karura', admissionMode: 'open', viewerRelationship: 'none' });
    expect(page.json().nextCursor).toEqual(expect.any(String));
    const next = await app.inject({ method: 'GET', url: `/api/groups/discover?limit=1&cursor=${encodeURIComponent(page.json().nextCursor)}`, headers: authHeaders('member') });
    expect(next.json().groups[0].id).toBe(first.id);
    const searched = await app.inject({ method: 'GET', url: '/api/groups/discover?q=RUNN&limit=10', headers: authHeaders('member') });
    expect(searched.json().groups.map((group: { id: string }) => group.id)).toEqual([first.id]);
    const goalSearch = await app.inject({ method: 'GET', url: '/api/groups/discover?q=consistency&limit=10', headers: authHeaders('member') });
    expect(goalSearch.json().groups.map((group: { id: string }) => group.id)).toEqual([first.id]);
    expect(goalSearch.json().groups[0].goals).toContain('Build consistency with healthy habits');
    expect(JSON.stringify(searched.json())).not.toMatch(/Hidden Circle|Old Runners|Karura|inviteCode|steward|rules|legacyId|firebase/i);
    expect([privateGroup.id, ended.id]).not.toContain(searched.json().groups[0].id);
    await app.close();
  });

  it('keeps discovery/search bounded, rejects invalid cursors, and fails closed on PostgreSQL outage', async () => {
    const db = testDb(); await seedMember(db, 's4c-searcher');
    const app = buildTestApp({ searcher: 's4c-searcher' });
    expect((await app.inject({ method: 'GET', url: '/api/groups/discover?limit=31', headers: authHeaders('searcher') })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/groups/discover?cursor=not-a-cursor', headers: authHeaders('searcher') })).statusCode).toBe(400);
    const outage = buildTestApp({ searcher: 's4c-searcher' }, { db: groupAuthorityUnavailableDb(db) });
    expect((await outage.inject({ method: 'GET', url: '/api/groups/discover', headers: authHeaders('searcher') })).statusCode).toBe(503);
    expect((await outage.inject({ method: 'POST', url: '/api/groups/resolve-invite', headers: authHeaders('searcher'), payload: { code: 'TIZI-ABCD-EFGH-JKMP' } })).statusCode).toBe(503);
    await app.close(); await outage.close();
  });

  it('resolves a stored private invite code without joining and applies normal pending admission on explicit join', async () => {
    const db = testDb();
    const steward = await seedMember(db, 'invite-steward');
    await seedMember(db, 'invite-applicant');
    const app = buildTestApp({ steward: 'invite-steward', applicant: 'invite-applicant' });
    const group = await createGroup(app, 'steward', { name: 'Private Walkers', isPrivate: true });
    const detail = await app.inject({ method: 'GET', url: `/api/groups/${group.id}`, headers: authHeaders('steward') });
    const code = detail.json().inviteCode as string;
    expect(code).toMatch(/^TIZI-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    const resolved = await app.inject({ method: 'POST', url: '/api/groups/resolve-invite', headers: authHeaders('applicant'), payload: { code: ` ${code.toLowerCase().replaceAll('-', ' ')} ` } });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json()).toMatchObject({ id: group.id, name: 'Private Walkers', isPrivate: true, viewerRelationship: 'none', admissionMode: 'approval' });
    expect(resolved.body).not.toContain('inviteCode');
    const before = await db.query(`SELECT count(*)::int AS n FROM group_memberships WHERE group_id=$1`, [group.id]);
    expect(before.rows[0].n).toBe(1);
    const joined = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/join`, headers: authHeaders('applicant'), payload: {} });
    expect(joined.statusCode).toBe(200); expect(joined.json().status).toBe('pending');
    expect((await app.inject({ method: 'GET', url: `/api/groups/${group.id}`, headers: authHeaders('applicant') })).json().viewerRelationship).toBe('pending');
    expect((await app.inject({ method: 'GET', url: `/api/groups/${group.id}/members`, headers: authHeaders('applicant') })).statusCode).toBe(404);
    const groupMembership = await createPostgresGroupMembershipAuthority(db).resolveGroupMembershipAuthority(group.id, (await db.query<{ member_id:string }>(`SELECT member_id FROM members WHERE auth_subject='invite-applicant'`)).rows[0].member_id);
    expect(groupMembership).toMatchObject({ status: 'pending', eligible: false });
    expect((await app.inject({ method: 'GET', url: '/api/groups/discover', headers: authHeaders('applicant') })).json().groups).toHaveLength(0);
    expect(await db.query(`SELECT member_id FROM group_memberships WHERE group_id=$1 AND role='owner'`, [group.id])).toMatchObject({ rows: [{ member_id: steward }] });
    await app.close();
  });

  it('returns generic invalid-code failure, leaves private identity undisclosed, and excludes invite codes from discovery', async () => {
    await seedMember(testDb(), 'invite-outsider');
    const app = buildTestApp({ outsider: 'invite-outsider' });
    const invalid = await app.inject({ method: 'POST', url: '/api/groups/resolve-invite', headers: authHeaders('outsider'), payload: { code: 'TIZI-XXXX-XXXX-XXXX' } });
    expect(invalid.statusCode).toBe(404);
    expect(invalid.json()).toEqual({ error: { code: 'invite_not_found', message: 'Invite code not found' } });
    const smuggled = await app.inject({ method: 'POST', url: '/api/groups/resolve-invite', headers: authHeaders('outsider'), payload: { code: 'TIZI-XXXX-XXXX-XXXX', memberId: 'forged' } });
    expect(smuggled.statusCode).toBe(400);
    await app.close();
  });

  it('exposes invite code only to active Group members', async () => {
    await seedMember(testDb(), 'invite-detail-owner'); await seedMember(testDb(), 'invite-detail-outsider');
    const app = buildTestApp({ owner: 'invite-detail-owner', outsider: 'invite-detail-outsider' });
    const group = await createGroup(app, 'owner', { name: 'Invite visibility' });
    const owner = await app.inject({ method: 'GET', url: `/api/groups/${group.id}`, headers: authHeaders('owner') });
    const outsider = await app.inject({ method: 'GET', url: `/api/groups/${group.id}`, headers: authHeaders('outsider') });
    const discover = await app.inject({ method: 'GET', url: '/api/groups/discover', headers: authHeaders('outsider') });
    expect(owner.json().inviteCode).toEqual(expect.any(String));
    expect(outsider.statusCode).toBe(200); expect(outsider.body).not.toContain('inviteCode');
    expect(JSON.stringify(discover.json())).not.toContain(owner.json().inviteCode);
    await app.close();
  });
});

describe('S4c steward admission review', () => {
  it('lists only pending applicants to the singular Steward and approve atomically attributes active admission', async () => {
    const db = testDb();
    const steward = await seedMember(db, 'review-steward');
    const member = await seedMember(db, 'review-member');
    const applicant = await seedMember(db, 'review-applicant');
    const admin = await seedMember(db, 'review-legacy-admin');
    const app = buildTestApp({ steward: 'review-steward', member: 'review-member', applicant: 'review-applicant', admin: 'review-legacy-admin' });
    const group = await createGroup(app, 'steward', { name: 'Review crew', requireAdminApproval: true });
    await db.query(`INSERT INTO group_memberships(group_id,member_id,role,status,requested_at) VALUES($1,$2,'admin','active',now())`, [group.id, admin]);
    expect((await app.inject({ method: 'POST', url: `/api/groups/${group.id}/join`, headers: authHeaders('applicant'), payload: {} })).json().status).toBe('pending');
    const pendingForSteward = await app.inject({ method: 'GET', url: `/api/groups/${group.id}/members/pending`, headers: authHeaders('steward') });
    expect(pendingForSteward.statusCode).toBe(200);
    expect(pendingForSteward.json().applicants).toEqual([{ memberId: applicant, requestedAt: expect.any(String) }]);
    for (const token of ['member', 'applicant', 'admin']) {
      expect((await app.inject({ method: 'GET', url: `/api/groups/${group.id}/members/pending`, headers: authHeaders(token) })).statusCode).toBe(403);
      expect((await app.inject({ method: 'POST', url: `/api/groups/${group.id}/applications/${applicant}/approve`, headers: authHeaders(token), payload: {} })).statusCode).toBe(403);
    }
    const approved = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/applications/${applicant}/approve`, headers: authHeaders('steward'), payload: {} });
    expect(approved.statusCode).toBe(200); expect(approved.json()).toMatchObject({ status: 'active', memberId: applicant });
    const membership = await db.query<{ status: string; approved_by_member_id: string; approved_at: string; rejected_at: string | null }>(`SELECT status,approved_by_member_id,approved_at,rejected_at FROM group_memberships WHERE group_id=$1 AND member_id=$2`, [group.id, applicant]);
    expect(membership.rows[0]).toMatchObject({ status: 'active', approved_by_member_id: steward, rejected_at: null });
    expect(membership.rows[0].approved_at).toBeTruthy();
    const list = await app.inject({ method: 'GET', url: '/api/memberships/me', headers: authHeaders('applicant') });
    expect(list.json().memberships.map((row: { groupId: string }) => row.groupId)).toContain(group.id);
    expect(list.json().pendingMemberships ?? []).toEqual([]);
    expect((await app.inject({ method: 'GET', url: `/api/groups/${group.id}/members`, headers: authHeaders('steward') })).json().members).toHaveLength(3);
    expect((await app.inject({ method: 'GET', url: `/api/groups/${group.id}/members/pending`, headers: authHeaders('steward') })).json().applicants).toEqual([]);
    expect((await app.inject({ method: 'POST', url: `/api/groups/${group.id}/applications/${applicant}/approve`, headers: authHeaders('steward'), payload: {} })).json().status).toBe('active');
    expect(member).not.toBe(steward);
    await app.close();
  });

  it('rejects pending with rejection attribution, keeps active count, and rejoin follows current policy', async () => {
    const db = testDb(); await seedMember(db, 'reject-steward'); const applicant = await seedMember(db, 'reject-applicant');
    const app = buildTestApp({ steward: 'reject-steward', applicant: 'reject-applicant' });
    const group = await createGroup(app, 'steward', { name: 'Reject crew', requireAdminApproval: true });
    await app.inject({ method: 'POST', url: `/api/groups/${group.id}/join`, headers: authHeaders('applicant'), payload: {} });
    const pending = await app.inject({ method: 'GET', url: '/api/memberships/me', headers: authHeaders('applicant') });
    expect(pending.json().memberships).toEqual([]);
    expect(pending.json().pendingMemberships).toHaveLength(1);
    const rejected = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/applications/${applicant}/reject`, headers: authHeaders('steward'), payload: {} });
    expect(rejected.statusCode).toBe(200); expect(rejected.json().status).toBe('rejected');
    const afterReject = await db.query<{ status: string; approved_at: string | null; approved_by_member_id: string | null; rejected_at: string; rejected_by_member_id: string; n: number }>(`SELECT gm.status,gm.approved_at,gm.approved_by_member_id,gm.rejected_at,gm.rejected_by_member_id,(SELECT count(*)::int FROM group_memberships WHERE group_id=gm.group_id AND status IN ('active','joined')) n FROM group_memberships gm WHERE group_id=$1 AND member_id=$2`, [group.id, applicant]);
    expect(afterReject.rows[0]).toMatchObject({ status: 'rejected', approved_at: null, approved_by_member_id: null, rejected_by_member_id: (await db.query<{ member_id:string }>(`SELECT member_id FROM members WHERE auth_subject='reject-steward'`)).rows[0].member_id, n: 1 });
    expect(afterReject.rows[0].rejected_at).toBeTruthy();
    expect((await app.inject({ method: 'POST', url: `/api/groups/${group.id}/applications/${applicant}/reject`, headers: authHeaders('steward'), payload: {} })).json().status).toBe('rejected');
    expect((await app.inject({ method: 'POST', url: `/api/groups/${group.id}/join`, headers: authHeaders('applicant'), payload: {} })).json().status).toBe('pending');
    const final = await db.query<{ status: string; rejected_at: string | null; requested_at: string | null }>(`SELECT status,rejected_at,requested_at FROM group_memberships WHERE group_id=$1 AND member_id=$2`, [group.id, applicant]);
    expect(final.rows[0]).toMatchObject({ status: 'pending', rejected_at: null }); expect(final.rows[0].requested_at).toBeTruthy();
    expect((await app.inject({ method: 'GET', url: `/api/groups/${group.id}/members`, headers: authHeaders('steward') })).json().members).toHaveLength(1);
    await app.close();
  });

  it('does not accept actor identity in approval request bodies and fails closed on database outage', async () => {
    const db = testDb(); await seedMember(db, 'review-outage-steward'); const applicant = await seedMember(db, 'review-outage-applicant');
    const app = buildTestApp({ steward: 'review-outage-steward', applicant: 'review-outage-applicant' });
    const group = await createGroup(app, 'steward', { name: 'Outage review', requireAdminApproval: true });
    await app.inject({ method: 'POST', url: `/api/groups/${group.id}/join`, headers: authHeaders('applicant'), payload: {} });
    const smuggle = await app.inject({ method: 'POST', url: `/api/groups/${group.id}/applications/${applicant}/approve`, headers: authHeaders('steward'), payload: { stewardMemberId: applicant } });
    expect(smuggle.statusCode).toBe(400);
    const outage = buildTestApp({ steward: 'review-outage-steward' }, { db: groupAuthorityUnavailableDb(db) });
    expect((await outage.inject({ method: 'POST', url: `/api/groups/${group.id}/applications/${applicant}/approve`, headers: authHeaders('steward'), payload: {} })).statusCode).toBe(503);
    await app.close(); await outage.close();
  });
});
