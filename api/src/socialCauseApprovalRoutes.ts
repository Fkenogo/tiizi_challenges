import type { FastifyInstance, FastifyReply } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';

export interface SocialCauseApprovalDeps {
  /** Platform authority is intentionally injected and fail-closed. */
  isPlatformOperator?: (memberId: string) => Promise<boolean>;
}

interface CauseReviewRow extends Record<string, unknown> {
  challengeId: string;
  challengeTitle: string;
  challengeType: string;
  challengeStatus: string;
  supportTiiziEnabled: boolean;
  groupName: string;
  startDate: string | Date;
  endDate: string | Date;
  title: string;
  description: string;
  purpose: string;
  beneficiary: string;
  paymentDestinationReference: string;
  destinationOwner: string;
  approvalStatus: string;
  approvalAuthority: string | null;
  createdAt: string | Date;
  decisionAt: string | Date | null;
  decisionReason: string | null;
}

const REVIEW_SELECT = `SELECT h.challenge_id AS "challengeId",h.title AS "challengeTitle",h.challenge_type AS "challengeType",
  h.status AS "challengeStatus",h.support_tiizi_enabled AS "supportTiiziEnabled",g.name AS "groupName",
  h.start_date AS "startDate",h.end_date AS "endDate",c.title,c.description,c.purpose,c.beneficiary,
  c.payment_destination_reference AS "paymentDestinationReference",c.destination_owner AS "destinationOwner",
  c.approval_status AS "approvalStatus",c.approval_authority AS "approvalAuthority",
  c.created_at AS "createdAt",c.decision_at AS "decisionAt",
  c.decision_reason AS "decisionReason"
  FROM challenge_social_causes c JOIN challenges h USING(challenge_id) JOIN groups g USING(group_id)`;

/** Operator decision boundary. No payment execution or contribution ledger lives here. */
export function registerSocialCauseApprovalRoutes(app: FastifyInstance, db: Db, deps: SocialCauseApprovalDeps = {}): void {
  async function requireOperator(memberId: string, reply: FastifyReply): Promise<boolean> {
    if (!deps.isPlatformOperator) {
      reply.code(503).send({ error: { code: 'operator_authority_unavailable', message: 'Platform Operator authority is not configured' } });
      return false;
    }
    if (!await deps.isPlatformOperator(memberId)) {
      reply.code(403).send({ error: { code: 'operator_required', message: 'Platform Operator authority is required' } });
      return false;
    }
    return true;
  }

  app.get('/api/operator/social-causes/pending', async (request, reply) => {
    const actor = authenticatedMember(request);
    if (!await requireOperator(actor.memberId, reply)) return;
    const result = await db.query<CauseReviewRow>(
      `${REVIEW_SELECT} WHERE c.approval_status='pending_approval' ORDER BY c.created_at ASC,h.challenge_id ASC`,
    );
    return reply.code(200).send({ causes: result.rows });
  });

  app.get('/api/operator/social-causes/:challengeId', async (request, reply) => {
    const actor = authenticatedMember(request);
    if (!await requireOperator(actor.memberId, reply)) return;
    const { challengeId } = request.params as { challengeId: string };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(challengeId)) return reply.code(400).send({ error: { code: 'invalid_challenge', message: 'Challenge id must be a UUID' } });
    const result = await db.query<CauseReviewRow>(`${REVIEW_SELECT} WHERE c.challenge_id=$1`, [challengeId]);
    if (!result.rows.length) return reply.code(404).send({ error: { code: 'cause_not_found', message: 'Social Cause not found' } });
    const decisions = await db.query<{ decision: string; authorityMemberId: string; reason: string; decidedAt: string | Date }>(
      `SELECT decision,authority_member_id AS "authorityMemberId",reason,decided_at AS "decidedAt"
       FROM challenge_social_cause_decisions WHERE challenge_id=$1 ORDER BY decided_at ASC,decision_id ASC`,
      [challengeId],
    );
    return reply.code(200).send({ ...result.rows[0], currentOperatorMemberId: actor.memberId, decisions: decisions.rows });
  });

  app.delete('/api/challenges/:challengeId/social-cause', async (request, reply) => {
    const actor = authenticatedMember(request);
    const { challengeId } = request.params as { challengeId: string };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(challengeId)) return reply.code(400).send({ error: { code: 'invalid_challenge', message: 'Challenge id must be a UUID' } });
    const result = await db.query(
      `UPDATE challenge_social_causes c SET approval_status='removed',approval_authority=NULL,decision_at=NULL,decision_reason=NULL,updated_at=now()
       FROM challenges h WHERE c.challenge_id=$1 AND h.challenge_id=c.challenge_id AND h.created_by_member_id=$2
         AND h.status='establishment' AND c.approval_status='revision_required' RETURNING c.challenge_id`,
      [challengeId, actor.memberId],
    );
    if (!result.rows.length) return reply.code(404).send({ error: { code: 'cause_removal_unavailable', message: 'Only a revision-required Cause on your establishing Challenge can be removed' } });
    return reply.code(200).send({ challengeId, approvalStatus: 'removed' });
  });

  app.put('/api/challenges/:challengeId/social-cause', async (request, reply) => {
    const actor = authenticatedMember(request);
    const { challengeId } = request.params as { challengeId: string };
    const body = request.body as Record<string, unknown>;
    const fields = ['title','description','purpose','beneficiary','payment_destination_reference'] as const;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(challengeId)
      || !body || Object.keys(body).some((key) => !fields.includes(key as typeof fields[number]))
      || fields.some((key) => typeof body[key] !== 'string' || !(body[key] as string).trim())
      || (typeof body.title === 'string' && body.title.length > 120)
      || (typeof body.description === 'string' && body.description.length > 2000)
      || (typeof body.purpose === 'string' && body.purpose.length > 500)
      || (typeof body.beneficiary === 'string' && body.beneficiary.length > 200)
      || (typeof body.payment_destination_reference === 'string' && body.payment_destination_reference.length > 300)) {
      return reply.code(400).send({ error: { code: 'invalid_cause_revision', message: 'Cause configuration fields are required' } });
    }
    const result = await db.query(
      `UPDATE challenge_social_causes c SET title=$3,description=$4,purpose=$5,beneficiary=$6,payment_destination_reference=$7,
         approval_status='pending_approval',approval_authority=NULL,decision_at=NULL,decision_reason=NULL,updated_at=now()
       FROM challenges h WHERE c.challenge_id=$1 AND h.challenge_id=c.challenge_id AND h.created_by_member_id=$2
         AND h.status='establishment' AND c.approval_status IN ('revision_required','approved') RETURNING c.challenge_id`,
      [challengeId, actor.memberId, body.title, body.description, body.purpose, body.beneficiary, body.payment_destination_reference],
    );
    if (!result.rows.length) return reply.code(404).send({ error: { code: 'cause_revision_unavailable', message: 'Cause is not awaiting creator revision' } });
    return reply.code(200).send({ challengeId, approvalStatus: 'pending_approval' });
  });

  app.post('/api/challenges/:challengeId/social-cause/decision', async (request, reply) => {
    const actor = authenticatedMember(request);
    if (!await requireOperator(actor.memberId, reply)) return;
    const { challengeId } = request.params as { challengeId: string };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(challengeId)) return reply.code(400).send({ error: { code: 'invalid_challenge', message: 'Challenge id must be a UUID' } });
    const body = request.body as Record<string, unknown>;
    const decision = body?.decision;
    const reason = body?.reason;
    if (!body || Object.keys(body).some((key) => !['decision','reason'].includes(key))
      || (decision !== 'approved' && decision !== 'revision_required')
      || typeof reason !== 'string' || !reason.trim() || reason.length > 1000) {
      return reply.code(400).send({ error: { code: 'invalid_decision', message: 'decision and reason are required' } });
    }
    const creator = await db.query<{ created_by_member_id: string }>(
      `SELECT h.created_by_member_id FROM challenges h JOIN challenge_social_causes c USING(challenge_id)
       WHERE h.challenge_id=$1 AND c.approval_status='pending_approval'`, [challengeId]);
    if (!creator.rows.length) return reply.code(404).send({ error: { code: 'cause_not_found', message: 'Challenge has no Social Cause awaiting decision' } });
    if (creator.rows[0].created_by_member_id === actor.memberId) return reply.code(403).send({ error: { code: 'cause_creator_cannot_decide', message: 'Challenge creators cannot decide their own Cause' } });
    const result = await db.transaction(async (tx) => {
      const cause = await tx.query<{ challenge_id: string }>(`SELECT challenge_id FROM challenge_social_causes WHERE challenge_id=$1 AND approval_status='pending_approval' FOR UPDATE`, [challengeId]);
      if (!cause.rows.length) return false;
      await tx.query(`UPDATE challenge_social_causes SET approval_status=$2, approval_authority=$3, decision_at=now(), decision_reason=$4, updated_at=now() WHERE challenge_id=$1`, [challengeId, decision, actor.memberId, reason.trim()]);
      await tx.query(`INSERT INTO challenge_social_cause_decisions(challenge_id,decision,authority_member_id,reason) VALUES($1,$2,$3,$4)`, [challengeId, decision, actor.memberId, reason.trim()]);
      return true;
    });
    if (!result) return reply.code(404).send({ error: { code: 'cause_not_found', message: 'Challenge has no Social Cause awaiting decision' } });
    return reply.code(200).send({ challengeId, decision });
  });
}
