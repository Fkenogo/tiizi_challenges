import { describe, expect, it } from 'vitest';
import { authHeaders, buildTestApp, seedMember, testDb } from './helpers.js';
import { createPostgresChallengeCreationAuthority } from '../src/postgresGroupAuthority.js';

describe('S4d governed Group settings', () => {
  it('lets only the singular Steward edit the allowlist and preserves Group and membership identity', async () => {
    const db = testDb();
    const stewardId = await seedMember(db, 's4d-steward');
    const memberId = await seedMember(db, 's4d-member');
    await seedMember(db, 's4d-pending');
    await seedMember(db, 's4d-outsider');
    const newMemberId = await seedMember(db, 's4d-new-member');
    const app = buildTestApp({ steward: 's4d-steward', member: 's4d-member', pending: 's4d-pending', outsider: 's4d-outsider', newMember: 's4d-new-member' });
    const created = await app.inject({ method: 'POST', url: '/v1/groups', headers: authHeaders('steward'), payload: { name: 'Before' } });
    const id = created.json().id as string;
    const code = (await db.query<{ invite_code: string }>('SELECT invite_code FROM groups WHERE group_id=$1', [id])).rows[0].invite_code;
    await app.inject({ method: 'POST', url: `/v1/groups/${id}/join`, headers: authHeaders('member'), payload: {} });
    expect((await app.inject({method:'PATCH',url:`/v1/groups/${id}`,headers:authHeaders('member'),payload:{name:'Denied'}})).statusCode).toBe(403);
    await db.query(`INSERT INTO group_memberships(group_id,member_id,role,status,requested_at) VALUES($1,$2,'member','pending',now())`, [id, (await db.query<{member_id:string}>(`SELECT member_id FROM members WHERE auth_subject='s4d-pending'`)).rows[0].member_id]);
    await db.query(`UPDATE group_memberships SET role='admin' WHERE group_id=$1 AND member_id=$2`, [id, memberId]);
    const challenge = await db.query<{challenge_id:string}>(`INSERT INTO challenges(group_id,created_by_member_id,challenge_type,title,start_date,end_date) VALUES($1,$2,'competitive','Keep me',current_date,current_date + 7) RETURNING challenge_id`, [id, stewardId]);
    const beforeRows = await db.query<{member_id:string;status:string;role:string}>(`SELECT member_id,status,role FROM group_memberships WHERE group_id=$1 ORDER BY member_id`, [id]);
    const patch = { name: '  After  ', description: 'purpose', tagline: 'Together', location: 'Kigali', focusTags: ['walking','wellbeing'], coverId: 'cover-7', isPrivate: true, requireAdminApproval: true, allowMemberChallenges: false };
    const changed = await app.inject({ method: 'PATCH', url: `/v1/groups/${id}`, headers: authHeaders('steward'), payload: patch });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({ id, name: 'After', description: 'purpose', tagline: 'Together', location: 'Kigali', focusTags: ['walking','wellbeing'], coverId: 'cover-7', isPrivate: true, requireAdminApproval: true, allowMemberChallenges: false, stewardMemberId: stewardId, inviteCode: code });
    const challengeAuthority = createPostgresChallengeCreationAuthority(db);
    expect(await challengeAuthority.resolveChallengeCreationAuthority(id, memberId)).toMatchObject({permitted:false,reason:'charter_restricted'});
    expect(await challengeAuthority.resolveChallengeCreationAuthority(id, stewardId)).toMatchObject({permitted:true});
    for (const token of ['member','outsider']) expect((await app.inject({method:'PATCH',url:`/v1/groups/${id}`,headers:authHeaders(token),payload:{name:'Denied'}})).statusCode).toBe(403);
    expect((await app.inject({method:'PATCH',url:`/v1/groups/${id}`,headers:authHeaders('member'),payload:{name:'Denied'}})).statusCode).toBe(403);
    for (const payload of [{}, {rules:['forged']}, {stewardMemberId:'bad'}, {legacyId:'bad'}, {status:'ended'}, {memberCount:0}, {coverImageUrl:'https://bad'}, {coverId:'cover-9'}, {name:'   '}, {description:'x'.repeat(2001)}, {tagline:'x'.repeat(141)}, {location:'x'.repeat(121)}, {focusTags:Array(9).fill('x')}, {focusTags:['x'.repeat(31)]}, {isPrivate:'yes'}]) {
      expect((await app.inject({method:'PATCH',url:`/v1/groups/${id}`,headers:authHeaders('steward'),payload})).statusCode).toBe(400);
    }
    const afterRows = await db.query<{member_id:string;status:string;role:string}>(`SELECT member_id,status,role FROM group_memberships WHERE group_id=$1 ORDER BY member_id`, [id]);
    expect(afterRows.rows).toEqual(beforeRows.rows);
    expect((await db.query<{challenge_id:string;title:string}>(`SELECT challenge_id,title FROM challenges WHERE group_id=$1`,[id])).rows).toEqual([{challenge_id:challenge.rows[0].challenge_id,title:'Keep me'}]);
    const identity = await db.query<{group_id:string;invite_code:string;steward_member_id:string;status:string}>(`SELECT group_id,invite_code,steward_member_id,status FROM groups WHERE group_id=$1`,[id]);
    expect(identity.rows[0]).toEqual({group_id:id,invite_code:code,steward_member_id:stewardId,status:'active'});
    expect((await app.inject({method:'GET',url:'/v1/groups/discover?q=Together',headers:authHeaders('outsider')})).json().groups).toEqual([]);
    expect((await app.inject({method:'GET',url:'/v1/groups/discover?q=Kigali',headers:authHeaders('outsider')})).json().groups).toEqual([]);
    expect((await app.inject({method:'GET',url:`/v1/groups/${id}`,headers:authHeaders('outsider')})).statusCode).toBe(404);
    expect((await app.inject({method:'POST',url:'/v1/groups/resolve-invite',headers:authHeaders('outsider'),payload:{code}})).statusCode).toBe(200);
    const memberDetail = await app.inject({method:'GET',url:`/v1/groups/${id}`,headers:authHeaders('member')});
    expect(memberDetail.json()).toMatchObject({ id, inviteCode: code, viewerRelationship: 'member' });
    await app.inject({method:'PATCH',url:`/v1/groups/${id}`,headers:authHeaders('steward'),payload:{isPrivate:false,requireAdminApproval:false}});
    expect((await db.query<{status:string}>(`SELECT status FROM group_memberships WHERE group_id=$1 AND member_id=(SELECT member_id FROM members WHERE auth_subject='s4d-pending')`,[id])).rows[0].status).toBe('pending');
    expect((await app.inject({method:'POST',url:`/v1/groups/${id}/join`,headers:authHeaders('newMember'),payload:{}})).json().status).toBe('joined');
    expect(await challengeAuthority.resolveChallengeCreationAuthority(id, newMemberId)).toMatchObject({permitted:false,reason:'charter_restricted'});
    const discoverable = await app.inject({method:'GET',url:'/v1/groups/discover?q=Together',headers:authHeaders('outsider')});
    expect(discoverable.json().groups).toEqual([expect.objectContaining({id,name:'After',tagline:'Together',focusTags:['walking','wellbeing']})]);
    expect(discoverable.json().groups[0]).not.toHaveProperty('inviteCode');
    for (const term of ['After','purpose','walking']) {
      const search = await app.inject({method:'GET',url:`/v1/groups/discover?q=${term}`,headers:authHeaders('outsider')});
      expect(search.json().groups.map((group: {id:string}) => group.id)).toContain(id);
    }
    expect((await app.inject({method:'GET',url:'/v1/groups/discover?q=Kigali',headers:authHeaders('outsider')})).json().groups).toEqual([]);
    expect((await app.inject({method:'GET',url:`/v1/groups/${id}`,headers:authHeaders('outsider')})).json()).not.toHaveProperty('inviteCode');
    expect((await app.inject({method:'PATCH',url:`/v1/groups/${id}`,headers:authHeaders('newMember'),payload:{name:'No'}})).statusCode).toBe(403);
    await app.inject({method:'PATCH',url:`/v1/groups/${id}`,headers:authHeaders('steward'),payload:{allowMemberChallenges:true}});
    expect(await challengeAuthority.resolveChallengeCreationAuthority(id, newMemberId)).toMatchObject({permitted:true});
    expect(newMemberId).toBeTruthy();
    await app.close();
  });

  it('fails closed on PostgreSQL settings failure', async () => {
    const db = testDb(); const steward = await seedMember(db, 's4d-failure');
    const app = buildTestApp({ steward: 's4d-failure' });
    const created = await app.inject({method:'POST',url:'/v1/groups',headers:authHeaders('steward'),payload:{name:'Failure'}});
    const id = created.json().id as string;
    const broken = { ...db, async transaction<T>(_fn: (tx: typeof db) => Promise<T>): Promise<T> { throw new Error('database unavailable'); } };
    const other = buildTestApp({ steward: 's4d-failure' }, { db: broken });
    expect((await other.inject({method:'PATCH',url:`/v1/groups/${id}`,headers:authHeaders('steward'),payload:{name:'No'}})).statusCode).toBe(503);
    expect(steward).toBeTruthy();
    await other.close(); await app.close();
  });
});
