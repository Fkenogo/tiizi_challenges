import { describe, expect, it } from 'vitest';
import { authHeaders, buildTestApp, testDb, seedMember, seedGroup } from './helpers.js';
import { createPostgresGroupMembershipAuthority, createPostgresChallengeCreationAuthority } from '../src/postgresGroupAuthority.js';

describe('PostgreSQL Group authority schema', () => {
  it('persists governed Group and membership lifecycle truth', async () => {
    const db = testDb();
    const groupId = await seedGroup(db, { name: 'Authority Group', legacyId: 'legacy-authority' });
    await seedMember(db, 'owner-uid');
    const owner = await db.query<{ member_id: string }>(
      `SELECT member_id FROM members WHERE auth_subject = 'owner-uid'`,
    );
    const memberId = owner.rows[0].member_id;
    await db.query(
      `INSERT INTO group_memberships(group_id, member_id, role, status, requested_at)
       VALUES ($1,$2,'owner','active',now())`, [groupId, memberId],
    );
    await db.query(
      `UPDATE groups SET steward_member_id=$2, require_admin_approval=true,
       allow_member_challenges=false, invite_code='AUTHORITY-AB12' WHERE group_id=$1`,
      [groupId, memberId],
    );
    const rows = await db.query<{ invite_code: string; require_admin_approval: boolean; allow_member_challenges: boolean }>(
      `SELECT invite_code, require_admin_approval, allow_member_challenges FROM groups WHERE group_id=$1`, [groupId],
    );
    expect(rows.rows[0]).toEqual({ invite_code: 'AUTHORITY-AB12', require_admin_approval: true, allow_member_challenges: false });
  });

  it('rejects duplicate active owner memberships for a Group', async () => {
    const db = testDb();
    const groupId = await seedGroup(db, { name: 'Owner invariant' });
    await seedMember(db, 'owner-one');
    await seedMember(db, 'owner-two');
    const members = await db.query<{ member_id: string }>(`SELECT member_id FROM members ORDER BY auth_subject`);
    await db.query(`INSERT INTO group_memberships(group_id,member_id,role,status) VALUES ($1,$2,'owner','active')`, [groupId, members.rows[0].member_id]);
    await expect(db.query(`INSERT INTO group_memberships(group_id,member_id,role,status) VALUES ($1,$2,'owner','active')`, [groupId, members.rows[1].member_id])).rejects.toThrow();
  });

  it('creates a Group and Steward atomically, then joins and leaves through PostgreSQL', async () => {
    const db=testDb();
    const owner=await seedMember(db,'pg-owner');
    const member=await seedMember(db,'pg-member');
    const app=buildTestApp({'owner-token':'pg-owner','member-token':'pg-member'});
    const created=await app.inject({method:'POST',url:'/v1/groups',headers:authHeaders('owner-token'),payload:{name:'Postgres governed',isPrivate:false,allowMemberChallenges:false,coverId:'cover-2',tagline:'A purpose',focusTags:['walking']}});
    expect(created.statusCode).toBe(201);
    const groupId=created.json().id as string;
    const steward=await db.query<{steward_member_id:string;allow_member_challenges:boolean;cover_id:string;tagline:string}>(`SELECT steward_member_id,allow_member_challenges,cover_id,tagline FROM groups WHERE group_id=$1`,[groupId]);
    expect(steward.rows[0]).toMatchObject({steward_member_id:owner,allow_member_challenges:false,cover_id:'cover-2',tagline:'A purpose'});
    const joined=await app.inject({method:'POST',url:`/v1/groups/${groupId}/join`,headers:authHeaders('member-token'),payload:{}});
    expect(joined.statusCode).toBe(200); expect(joined.json().status).toBe('joined');
    const roster=await app.inject({method:'GET',url:`/v1/groups/${groupId}/members`,headers:authHeaders('owner-token')});
    expect(roster.json().members).toHaveLength(2);
    const detail=await app.inject({method:'GET',url:`/v1/groups/${groupId}`,headers:authHeaders('owner-token')});
    expect(detail.json()).toMatchObject({id:groupId,allowMemberChallenges:false,memberCount:2,steward:{memberId:owner}});
    const leave=await app.inject({method:'POST',url:`/v1/groups/${groupId}/leave`,headers:authHeaders('member-token'),payload:{}});
    expect(leave.statusCode).toBe(200); expect(leave.json().status).toBe('left');
    expect((await db.query<{status:string;left_at:string}>(`SELECT status,left_at FROM group_memberships WHERE group_id=$1 AND member_id=$2`,[groupId,member])).rows[0].status).toBe('left');
    const blocked=await app.inject({method:'POST',url:`/v1/groups/${groupId}/leave`,headers:authHeaders('owner-token'),payload:{}});
    expect(blocked.statusCode).toBe(403);
    expect(await createPostgresGroupMembershipAuthority(db).resolveGroupMembershipAuthority(groupId,member)).toMatchObject({eligible:false,status:'left'});
    expect(await createPostgresChallengeCreationAuthority(db).resolveChallengeCreationAuthority(groupId,member)).toMatchObject({permitted:false,reason:'membership_inactive'});
    await app.close();
  });

  it('pending membership is persisted without authorizing detail access as a member', async () => {
    const db=testDb(); await seedMember(db,'pending-owner'); await seedMember(db,'pending-user');
    const app=buildTestApp({'owner':'pending-owner','user':'pending-user'});
    const created=await app.inject({method:'POST',url:'/v1/groups',headers:authHeaders('owner'),payload:{name:'Approval required',requireAdminApproval:true}});
    const groupId=created.json().id as string;
    const joined=await app.inject({method:'POST',url:`/v1/groups/${groupId}/join`,headers:authHeaders('user'),payload:{}});
    expect(joined.json().status).toBe('pending');
    expect(await createPostgresGroupMembershipAuthority(db).resolveGroupMembershipAuthority(groupId,(await db.query<{member_id:string}>(`SELECT member_id FROM members WHERE auth_subject='pending-user'`)).rows[0].member_id)).toMatchObject({eligible:false,status:'pending'});
    await app.close();
  });

  it('serializes retry joins into one eligible membership and preserves the Steward invariant', async () => {
    const db=testDb();await seedMember(db,'race-owner');const member=await seedMember(db,'race-joiner');
    const app=buildTestApp({'owner':'race-owner','joiner':'race-joiner'});
    const created=await app.inject({method:'POST',url:'/v1/groups',headers:authHeaders('owner'),payload:{name:'Concurrent join'}});const id=created.json().id as string;
    const requests=await Promise.all([1,2].map(()=>app.inject({method:'POST',url:`/v1/groups/${id}/join`,headers:authHeaders('joiner'),payload:{}})));
    expect(requests.map(r=>r.statusCode)).toEqual([200,200]);
    const count=await db.query<{n:number}>(`SELECT count(*)::int n FROM group_memberships WHERE group_id=$1 AND member_id=$2 AND status IN ('active','joined')`,[id,member]);
    expect(count.rows[0].n).toBe(1);
    await expect(db.query(`UPDATE group_memberships SET role='member' WHERE group_id=$1 AND member_id=(SELECT steward_member_id FROM groups WHERE group_id=$1)`,[id])).rejects.toThrow();
    await app.close();
  });

  it('does not call a configured Firestore-shaped store when V2 creates a Group', async () => {
    const db=testDb();await seedMember(db,'no-dual-owner');let writes=0;
    const store={async createGroupWithOwner(){writes++;throw new Error('Firestore must not be called');},async getGroup(){throw new Error('unexpected read');},async updateGroupCounter(){writes++;},async getMembership(){return null;},async setMembership(){writes++;},async updateMembership(){writes++;}};
    const app=buildTestApp({token:'no-dual-owner'},{groupMutation:{store}});
    const response=await app.inject({method:'POST',url:'/v1/groups',headers:authHeaders('token'),payload:{name:'No dual write'}});
    expect(response.statusCode).toBe(201);expect(writes).toBe(0);
    await app.close();
  });
});
