import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db.js';
import { authHeaders, seedGroup, seedMember, seedMembership, stubVerifier, testDb } from './helpers.js';

let db: Db; let sequence = 0;

async function fixture() {
  const n = ++sequence;
  const operator = await seedMember(db, `operator-console-${n}`);
  const member = await seedMember(db, `ordinary-member-${n}`);
  const steward = await seedMember(db, `group-steward-${n}`);
  const groupId = await seedGroup(db, { name: `Operator Read Group ${n}`, isPrivate: true });
  await seedMembership(db, groupId, operator, { role: 'owner' });
  const stewardGroupId = await seedGroup(db, { name: `Steward-only Group ${n}`, isPrivate: false });
  await seedMembership(db, stewardGroupId, steward, { role: 'owner' });
  await db.query('UPDATE groups SET steward_member_id=$2 WHERE group_id=$1', [groupId, operator]);
  const challenge = await db.query<{ challenge_id: string }>(
    `INSERT INTO challenges (group_id,created_by_member_id,challenge_type,status,title,description,instructions,
       start_date,end_date,goal_value,goal_unit,support_tiizi_enabled)
     VALUES ($1,$2,'collective','establishment',$3,'Read-model fixture description','Fixture instructions',
       '2026-10-10','2026-10-20',10,'kilometres',TRUE) RETURNING challenge_id`,
    [groupId, member, `Operator Read Challenge ${n}`],
  );
  const challengeId = String(challenge.rows[0].challenge_id);
  await db.query(
    `INSERT INTO challenge_social_causes (challenge_id,title,description,purpose,beneficiary,payment_destination_reference,destination_owner)
     VALUES ($1,'Garden Cause','Cause description','Cause purpose','Garden Trust','beneficiary-local-reference','beneficiary')`, [challengeId]);
  const knowledge = await db.query<{ knowledge_id: string }>(
    `INSERT INTO knowledge_items (kind,lifecycle,name,category,description,metric_unit)
     VALUES ('fitness','published','Walking','Mobility','A canonical Activity definition','kilometres') RETURNING knowledge_id`);
  await db.query(
    `INSERT INTO knowledge_item_texts (item_id,locale,field,value) VALUES ($1,'sw','name','Kutembea')`, [knowledge.rows[0].knowledge_id]);
  await db.query(
    `INSERT INTO platform_operator_console_readers (member_id,grant_reference) VALUES ($1,'test read-only Console grant')`, [operator]);
  await db.query(
    `INSERT INTO platform_operator_cause_reviewers (member_id,grant_reference) VALUES ($1,'test Cause review grant')`, [operator]);
  const app = buildApp({ verifier: stubVerifier({ [`operator-token-${n}`]: `operator-console-${n}`, [`member-token-${n}`]: `ordinary-member-${n}`, [`steward-token-${n}`]: `group-steward-${n}` }), db });
  return {
    app, operator, member, steward, groupId, stewardGroupId, challengeId,
    operatorAuth: authHeaders(`operator-token-${n}`), memberAuth: authHeaders(`member-token-${n}`), stewardAuth: authHeaders(`steward-token-${n}`),
  };
}

beforeEach(() => { db = testDb(); });

describe('Platform Operator Console read boundary', () => {
  it('requires the explicit active read grant and denies ordinary members', async () => {
    const f = await fixture();
    // Group ownership/stewardship is not Platform Operator authority.
    for (const url of ['/api/operator/console/overview', '/api/operator/console/members', '/api/operator/console/groups', '/api/operator/console/challenges', '/api/operator/console/support', '/api/operator/console/access']) {
      expect((await f.app.inject({ method: 'GET', url, headers: f.memberAuth })).statusCode).toBe(403);
      expect((await f.app.inject({ method: 'GET', url, headers: f.stewardAuth })).statusCode).toBe(403);
      expect((await f.app.inject({ method: 'GET', url })).statusCode).toBe(401);
    }
    const authorized = await f.app.inject({ method: 'GET', url: '/api/operator/console/groups', headers: f.operatorAuth });
    expect(authorized.statusCode).toBe(200);
    await db.query("UPDATE platform_operator_console_readers SET revoked_at=now(),revoked_reference='test revoke' WHERE member_id=$1", [f.operator]);
    expect((await f.app.inject({ method: 'GET', url: '/api/operator/console/groups', headers: f.operatorAuth })).statusCode).toBe(403);
    // Revoking read access does not alter the separate Cause decision grant.
    expect((await f.app.inject({ method: 'GET', url: '/api/operator/social-causes/pending', headers: f.operatorAuth })).statusCode).toBe(503);
  });

  it('returns authoritative Overview, directory, Group, Challenge, Activity, Support, localisation, access, health, and audit data', async () => {
    const f = await fixture();
    const overview = await f.app.inject({ method: 'GET', url: '/api/operator/console/overview', headers: f.operatorAuth });
    expect(overview.statusCode).toBe(200);
    expect(overview.json()).toMatchObject({ counts: { members: 3, groups: 2, challenges: 1, pending_causes: 1, support_enabled: 1 }, lifecycle: [{ status: 'establishment', count: 1 }] });

    const members = await f.app.inject({ method: 'GET', url: `/api/operator/console/members?q=${f.member.slice(0, 8)}`, headers: f.operatorAuth });
    expect(members.json().members).toHaveLength(1);
    expect(members.json().members[0]).toMatchObject({ memberId: f.member, activeGroups: 0, activeChallenges: 0 });
    expect((await f.app.inject({ method: 'GET', url: `/api/operator/console/members/${f.member}`, headers: f.operatorAuth })).statusCode).toBe(200);

    const groups = await f.app.inject({ method: 'GET', url: '/api/operator/console/groups?visibility=private', headers: f.operatorAuth });
    expect(groups.json().groups[0]).toMatchObject({ groupId: f.groupId, memberCount: 1, challengeCount: 1, isPrivate: true });
    expect((await f.app.inject({ method: 'GET', url: `/api/operator/console/groups/${f.groupId}`, headers: f.operatorAuth })).json().challenges).toHaveLength(1);

    const challenges = await f.app.inject({ method: 'GET', url: '/api/operator/console/challenges?type=collective&supportTiizi=enabled', headers: f.operatorAuth });
    expect(challenges.json().challenges[0]).toMatchObject({ challengeId: f.challengeId, causeStatus: 'pending_approval', supportTiiziEnabled: true });
    expect((await f.app.inject({ method: 'GET', url: `/api/operator/console/challenges/${f.challengeId}`, headers: f.operatorAuth })).json()).toMatchObject({ beneficiary: 'Garden Trust', paymentDestinationReference: 'beneficiary-local-reference' });

    const activities = await f.app.inject({ method: 'GET', url: '/api/operator/console/activities?kind=fitness&lifecycle=published', headers: f.operatorAuth });
    expect(activities.json().items[0]).toMatchObject({ name: 'Walking', kind: 'fitness', lifecycle: 'published' });
    const support = await f.app.inject({ method: 'GET', url: '/api/operator/console/support?q=Garden', headers: f.operatorAuth });
    expect(support.json().configurations[0]).toMatchObject({ causeTitle: 'Garden Cause', supportTiiziEnabled: true });
    const localisation = await f.app.inject({ method: 'GET', url: '/api/operator/console/localisation?q=sw', headers: f.operatorAuth });
    expect(localisation.json().localisedFields[0]).toMatchObject({ locale: 'sw', field: 'name', value: 'Kutembea' });
    expect((await f.app.inject({ method: 'GET', url: '/api/operator/console/access', headers: f.operatorAuth })).json()).toMatchObject({ currentOperatorMemberId: f.operator, canManageAccess: false });
    expect((await f.app.inject({ method: 'GET', url: '/api/operator/console/health', headers: f.operatorAuth })).json()).toMatchObject({ api: 'healthy', database: 'healthy' });
    expect((await f.app.inject({ method: 'GET', url: '/api/operator/console/audit', headers: f.operatorAuth })).json()).toMatchObject({ decisions: [], scope: 'Social Cause decisions only' });
  });
});
