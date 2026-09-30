import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createPostgresSocialCauseReviewerAuthority } from '../src/socialCauseApprovalAuthority.js';
import { activateChallenge } from '../src/challenges.js';
import type { Db } from '../src/db.js';
import { authHeaders, seedGroup, seedMember, seedMembership, stubVerifier, testDb } from './helpers.js';

let db: Db;
let seq = 0;

async function fixture({ startDate = '2026-09-30' }: { startDate?: string } = {}) {
  const tag = `cause-review-${++seq}`;
  const creator = await seedMember(db, `${tag}-creator`);
  const steward = await seedMember(db, `${tag}-steward`);
  const participant = await seedMember(db, `${tag}-participant`);
  const operator = await seedMember(db, `${tag}-operator`);
  const groupId = await seedGroup(db, { name: `Cause review group ${tag}` });
  await seedMembership(db, groupId, steward, { role: 'owner', status: 'active' });
  await db.query('UPDATE groups SET steward_member_id=$2 WHERE group_id=$1', [groupId, steward]);
  const challenge = await db.query<{ challenge_id: string }>(
    `INSERT INTO challenges (group_id,created_by_member_id,challenge_type,status,title,start_date,end_date,required_consecutive_days)
     VALUES ($1,$2,'streak','establishment',$3,$4,$5,1) RETURNING challenge_id`,
    [groupId, creator, `Pending Cause ${tag}`, startDate, startDate.startsWith('2026-12') ? '2027-01-01' : '2026-10-30'],
  );
  const challengeId = String(challenge.rows[0].challenge_id);
  await db.query(
    `INSERT INTO challenge_social_causes
      (challenge_id,title,description,purpose,beneficiary,payment_destination_reference,destination_owner)
     VALUES ($1,'Community garden','Repair shared garden beds','Buy soil','Community Garden Trust','beneficiary-wallet-reference','beneficiary')`,
    [challengeId],
  );
  await db.query(
    `INSERT INTO platform_operator_cause_reviewers (member_id,grant_reference)
     VALUES ($1,'Founder-authorized local Development Cause review preview')`,
    [operator],
  );
  const tokens = {
    [`${tag}-creator-token`]: `${tag}-creator`,
    [`${tag}-steward-token`]: `${tag}-steward`,
    [`${tag}-participant-token`]: `${tag}-participant`,
    [`${tag}-operator-token`]: `${tag}-operator`,
  };
  const app = buildApp({
    db,
    verifier: stubVerifier(tokens),
    socialCauseApproval: { isPlatformOperator: createPostgresSocialCauseReviewerAuthority(db).isPlatformOperator },
  });
  return {
    app, challengeId, creator, operator, groupId,
    creatorAuth: authHeaders(`${tag}-creator-token`),
    stewardAuth: authHeaders(`${tag}-steward-token`),
    participantAuth: authHeaders(`${tag}-participant-token`),
    operatorAuth: authHeaders(`${tag}-operator-token`),
  };
}

beforeEach(async () => {
  db = testDb();
  await db.query('TRUNCATE platform_operator_cause_reviewers, challenge_social_cause_decisions, challenge_social_causes, challenges CASCADE');
});

describe('Platform Operator Social Cause review boundary', () => {
  it('only an explicitly rostered Operator can list/open pending Causes', async () => {
    const f = await fixture();
    for (const headers of [f.creatorAuth, f.stewardAuth, f.participantAuth]) {
      expect((await f.app.inject({ method: 'GET', url: '/v1/operator/social-causes/pending', headers })).statusCode).toBe(403);
      expect((await f.app.inject({ method: 'GET', url: `/v1/operator/social-causes/${f.challengeId}`, headers })).statusCode).toBe(403);
    }
    const list = await f.app.inject({ method: 'GET', url: '/v1/operator/social-causes/pending', headers: f.operatorAuth });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({ causes: [{ challengeId: f.challengeId, title: 'Community garden', approvalStatus: 'pending_approval' }] });
    const detail = await f.app.inject({ method: 'GET', url: `/v1/operator/social-causes/${f.challengeId}`, headers: f.operatorAuth });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ beneficiary: 'Community Garden Trust', paymentDestinationReference: 'beneficiary-wallet-reference' });
    await db.query(
      `UPDATE platform_operator_cause_reviewers SET revoked_at=now(),revoked_reference='test revocation' WHERE member_id=$1`,
      [f.operator],
    );
    expect((await f.app.inject({ method: 'GET', url: '/v1/operator/social-causes/pending', headers: f.operatorAuth })).statusCode).toBe(403);
  });

  it('prevents participants, Group stewards, and Challenge creators from deciding; Operator approval is persisted and audited', async () => {
    const f = await fixture();
    for (const headers of [f.creatorAuth, f.stewardAuth, f.participantAuth]) {
      expect((await f.app.inject({ method: 'POST', url: `/v1/challenges/${f.challengeId}/social-cause/decision`, headers, payload: { decision: 'approved', reason: 'reviewed' } })).statusCode).toBe(403);
    }
    await expect(db.query("UPDATE challenges SET status='active' WHERE challenge_id=$1", [f.challengeId])).rejects.toThrow(/approved Social Cause/);
    const decision = await f.app.inject({ method: 'POST', url: `/v1/challenges/${f.challengeId}/social-cause/decision`, headers: f.operatorAuth, payload: { decision: 'approved', reason: 'Beneficiary and payment destination reviewed' } });
    expect(decision.statusCode).toBe(200);
    const state = await db.query<{ approval_status: string; approval_authority: string; decision_count: string; status: string }>(
      `SELECT c.approval_status,c.approval_authority,count(d.decision_id)::text AS decision_count,h.status
       FROM challenge_social_causes c JOIN challenges h USING(challenge_id)
       LEFT JOIN challenge_social_cause_decisions d USING(challenge_id)
       WHERE c.challenge_id=$1 GROUP BY c.approval_status,c.approval_authority,h.status`, [f.challengeId]);
    expect(state.rows[0]).toEqual({ approval_status: 'approved', approval_authority: f.operator, decision_count: '1', status: 'establishment' });
    await activateChallenge(db, f.challengeId);
    const activated = await db.query<{ status: string }>('SELECT status FROM challenges WHERE challenge_id=$1', [f.challengeId]);
    expect(activated.rows[0].status).toBe('active');
  });

  it('a creator cannot self-approve even if accidentally present on the Operator roster', async () => {
    const f = await fixture();
    await db.query("INSERT INTO platform_operator_cause_reviewers (member_id,grant_reference) VALUES ($1,'test overlap')", [f.creator]);
    const response = await f.app.inject({ method: 'POST', url: `/v1/challenges/${f.challengeId}/social-cause/decision`, headers: f.creatorAuth, payload: { decision: 'approved', reason: 'self review' } });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'cause_creator_cannot_decide' } });
  });

  it('revision-required remains unable to activate and approval does not auto-activate regardless of schedule', async () => {
    const f = await fixture({ startDate: '2026-08-01' });
    const response = await f.app.inject({ method: 'POST', url: `/v1/challenges/${f.challengeId}/social-cause/decision`, headers: f.operatorAuth, payload: { decision: 'revision_required', reason: 'Confirm destination ownership' } });
    expect(response.statusCode).toBe(200);
    await expect(activateChallenge(db, f.challengeId)).rejects.toThrow(/approved Social Cause/);
    const state = await db.query<{ approval_status: string; status: string }>(
      `SELECT c.approval_status,h.status FROM challenge_social_causes c JOIN challenges h USING(challenge_id) WHERE c.challenge_id=$1`, [f.challengeId]);
    expect(state.rows[0]).toEqual({ approval_status: 'revision_required', status: 'establishment' });
  });

  it('an approved Cause on a future-scheduled Challenge stays in establishment until the existing activation action occurs', async () => {
    const f = await fixture({ startDate: '2026-12-01' });
    const response = await f.app.inject({ method: 'POST', url: `/v1/challenges/${f.challengeId}/social-cause/decision`, headers: f.operatorAuth, payload: { decision: 'approved', reason: 'Verified' } });
    expect(response.statusCode).toBe(200);
    const state = await db.query<{ approval_status: string; status: string }>(
      `SELECT c.approval_status,h.status FROM challenge_social_causes c JOIN challenges h USING(challenge_id) WHERE c.challenge_id=$1`, [f.challengeId]);
    expect(state.rows[0]).toEqual({ approval_status: 'approved', status: 'establishment' });
  });

  it('approval after the scheduled start does not auto-activate; the explicit lifecycle transition succeeds', async () => {
    const f = await fixture({ startDate: '2026-08-01' });
    const response = await f.app.inject({ method: 'POST', url: `/v1/challenges/${f.challengeId}/social-cause/decision`, headers: f.operatorAuth, payload: { decision: 'approved', reason: 'Verified after the scheduled start' } });
    expect(response.statusCode).toBe(200);
    const afterApproval = await db.query<{ approval_status: string; status: string }>(
      `SELECT c.approval_status,h.status FROM challenge_social_causes c JOIN challenges h USING(challenge_id) WHERE c.challenge_id=$1`, [f.challengeId]);
    expect(afterApproval.rows[0]).toEqual({ approval_status: 'approved', status: 'establishment' });
    await activateChallenge(db, f.challengeId);
    const afterExplicitActivation = await db.query<{ status: string }>('SELECT status FROM challenges WHERE challenge_id=$1', [f.challengeId]);
    expect(afterExplicitActivation.rows[0].status).toBe('active');
  });
});
