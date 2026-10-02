import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import { createPostgresOperatorConsoleReaderAuthority } from './operatorConsoleAuthority.js';

const PAGE_SIZE = 100;
const SEARCH_SIZE = 180;

function queryValue(request: FastifyRequest, key: string): string {
  const value = (request.query as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function pageSize(request: FastifyRequest): number {
  const parsed = Number.parseInt(queryValue(request, 'limit'), 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(PAGE_SIZE, parsed)) : PAGE_SIZE;
}

function pageOffset(request: FastifyRequest): number {
  const parsed = Number.parseInt(queryValue(request, 'offset'), 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100_000, parsed)) : 0;
}

function searchTerm(request: FastifyRequest): string {
  return queryValue(request, 'q').slice(0, SEARCH_SIZE);
}

export function registerOperatorConsoleRoutes(app: FastifyInstance, db: Db): void {
  const authority = createPostgresOperatorConsoleReaderAuthority(db);
  const authorize = async (request: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
    const member = authenticatedMember(request);
    if (await authority.canReadOperatorConsole(member.memberId)) return true;
    reply.code(403).send({ error: { code: 'operator_console_access_required', message: 'Platform Operator Console access required' } });
    return false;
  };

  app.get('/v1/operator/console/overview', async (request, reply) => {
    if (!await authorize(request, reply)) return;
    const [counts, activity, decisions] = await Promise.all([
      db.query<Record<string, number>>(
        `SELECT
          (SELECT count(*)::int FROM members) AS members,
          (SELECT count(*)::int FROM groups) AS groups,
          (SELECT count(*)::int FROM challenges) AS challenges,
          (SELECT count(*)::int FROM challenge_participations) AS participations,
          (SELECT count(*)::int FROM challenge_activity_records) AS accepted_activities,
          (SELECT count(*)::int FROM challenge_social_causes WHERE approval_status='pending_approval') AS pending_causes,
          (SELECT count(*)::int FROM challenges WHERE support_tiizi_enabled) AS support_enabled,
          (SELECT count(*)::int FROM challenges WHERE NOT support_tiizi_enabled) AS support_disabled`),
      db.query(
        `SELECT r.record_id AS "recordId", r.accepted_at AS "acceptedAt", r.value, r.unit,
                k.name AS "activityName", h.challenge_id AS "challengeId", h.title AS "challengeTitle",
                g.name AS "groupName"
         FROM challenge_activity_records r
         JOIN challenges h USING(challenge_id)
         JOIN groups g USING(group_id)
         JOIN challenge_activity_configs c USING(activity_config_id)
         LEFT JOIN knowledge_items k ON k.knowledge_id=c.knowledge_id
         ORDER BY r.accepted_at DESC, r.record_id DESC LIMIT 6`),
      db.query(
        `SELECT d.decision_id AS "decisionId", d.decision, d.reason, d.decided_at AS "decidedAt",
                c.title AS "causeTitle", h.title AS "challengeTitle"
         FROM challenge_social_cause_decisions d
         JOIN challenge_social_causes c USING(challenge_id)
         JOIN challenges h USING(challenge_id)
         ORDER BY d.decided_at DESC, d.decision_id DESC LIMIT 6`),
    ]);
    const lifecycle = await db.query(
      `SELECT status, count(*)::int AS count FROM challenges GROUP BY status ORDER BY status`);
    const causeStates = await db.query(
      `SELECT approval_status AS status, count(*)::int AS count
       FROM challenge_social_causes GROUP BY approval_status ORDER BY approval_status`);
    const finalizations = await db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM challenges WHERE finalized_at IS NOT NULL`);
    const support = await db.query(
      `SELECT count(*) FILTER (WHERE support_tiizi_enabled)::int AS enabled,
              count(*) FILTER (WHERE NOT support_tiizi_enabled)::int AS disabled,
              count(*) FILTER (WHERE c.challenge_id IS NOT NULL)::int AS with_social_cause
       FROM challenges h LEFT JOIN challenge_social_causes c USING(challenge_id)`);
    return {
      counts: counts.rows[0],
      lifecycle: lifecycle.rows,
      finalizedChallenges: finalizations.rows[0]?.count ?? 0,
      causes: causeStates.rows,
      support: support.rows[0],
      recentAcceptedActivities: activity.rows,
      recentCauseDecisions: decisions.rows,
      currentOperatorMemberId: authenticatedMember(request).memberId,
    };
  });

  app.get('/v1/operator/console/members', async (request, reply) => {
    if (!await authorize(request, reply)) return;
    const q = `%${searchTerm(request)}%`;
    const result = await db.query(
      `SELECT m.member_id AS "memberId", m.role AS "memberRole", m.created_at AS "createdAt",
              count(DISTINCT gm.group_id) FILTER (WHERE gm.status IN ('active','joined'))::int AS "activeGroups",
              count(DISTINCT p.challenge_id) FILTER (WHERE p.status='active')::int AS "activeChallenges",
              count(DISTINCT p.challenge_id)::int AS "challengeEpisodes",
              count(DISTINCT r.record_id)::int AS "acceptedChallengeActivities"
       FROM members m
       LEFT JOIN group_memberships gm USING(member_id)
       LEFT JOIN challenge_participations p USING(member_id)
       LEFT JOIN challenge_activity_records r USING(participation_id)
       WHERE ($1='' OR m.member_id::text ILIKE $2 OR m.role ILIKE $2)
       GROUP BY m.member_id,m.role,m.created_at
       ORDER BY m.created_at DESC,m.member_id LIMIT $3 OFFSET $4`,
      [searchTerm(request), q, pageSize(request), pageOffset(request)],
    );
    return { members: result.rows, limit: pageSize(request), offset: pageOffset(request), identityNote: 'Profile names and account-state fields are not present in the current authoritative member model; member UUIDs are shown as identity references.' };
  });

  app.get('/v1/operator/console/members/:memberId', async (request, reply) => {
    if (!await authorize(request, reply)) return;
    const { memberId } = request.params as { memberId: string };
    const result = await db.query(
      `SELECT m.member_id AS "memberId", m.role AS "memberRole", m.created_at AS "createdAt",
              m.updated_at AS "updatedAt",
              count(DISTINCT gm.group_id) FILTER (WHERE gm.status IN ('active','joined'))::int AS "activeGroups",
              count(DISTINCT p.challenge_id) FILTER (WHERE p.status='active')::int AS "activeChallenges",
              count(DISTINCT p.participation_id)::int AS "challengeEpisodes",
              count(DISTINCT r.record_id)::int AS "acceptedChallengeActivities"
       FROM members m
       LEFT JOIN group_memberships gm USING(member_id)
       LEFT JOIN challenge_participations p USING(member_id)
       LEFT JOIN challenge_activity_records r USING(participation_id)
       WHERE m.member_id=$1::uuid GROUP BY m.member_id,m.role,m.created_at,m.updated_at`, [memberId],
    );
    if (!result.rows[0]) return reply.code(404).send({ error: { code: 'operator_member_not_found', message: 'Member not found' } });
    const groups = await db.query(
      `SELECT g.group_id AS "groupId",g.name AS "groupName",gm.role,gm.status,gm.joined_at AS "joinedAt"
       FROM group_memberships gm JOIN groups g USING(group_id)
       WHERE gm.member_id=$1::uuid ORDER BY gm.joined_at DESC,g.name`, [memberId]);
    const challenges = await db.query(
      `SELECT h.challenge_id AS "challengeId",h.title,h.challenge_type AS type,h.status,p.status AS "participationStatus",
              p.joined_at AS "joinedAt"
       FROM challenge_participations p JOIN challenges h USING(challenge_id)
       WHERE p.member_id=$1::uuid ORDER BY p.joined_at DESC,h.title`, [memberId]);
    return { ...result.rows[0], groups: groups.rows, challenges: challenges.rows };
  });

  app.get('/v1/operator/console/groups', async (request, reply) => {
    if (!await authorize(request, reply)) return;
    const q = `%${searchTerm(request)}%`;
    const status = queryValue(request, 'status');
    const visibility = queryValue(request, 'visibility');
    const result = await db.query(
      `SELECT g.group_id AS "groupId",g.name,g.status,g.is_private AS "isPrivate",g.created_at AS "createdAt",
              g.require_admin_approval AS "requireAdminApproval",g.allow_member_challenges AS "allowMemberChallenges",
              g.steward_member_id AS "stewardMemberId",
              count(DISTINCT gm.member_id) FILTER (WHERE gm.status IN ('active','joined'))::int AS "memberCount",
              count(DISTINCT h.challenge_id)::int AS "challengeCount"
       FROM groups g LEFT JOIN group_memberships gm USING(group_id) LEFT JOIN challenges h USING(group_id)
       WHERE ($1='' OR g.name ILIKE $2 OR g.group_id::text ILIKE $2)
         AND ($3='' OR g.status=$3) AND ($4='' OR ($4='private' AND g.is_private) OR ($4='public' AND NOT g.is_private))
       GROUP BY g.group_id ORDER BY g.created_at DESC,g.group_id LIMIT $5 OFFSET $6`,
      [searchTerm(request), q, status, visibility, pageSize(request), pageOffset(request)],
    );
    return { groups: result.rows, limit: pageSize(request), offset: pageOffset(request) };
  });

  app.get('/v1/operator/console/groups/:groupId', async (request, reply) => {
    if (!await authorize(request, reply)) return;
    const { groupId } = request.params as { groupId: string };
    const group = await db.query(
      `SELECT g.group_id AS "groupId",g.name,g.description,g.status,g.is_private AS "isPrivate",
              g.created_at AS "createdAt",g.updated_at AS "updatedAt",g.require_admin_approval AS "requireAdminApproval",
              g.allow_member_challenges AS "allowMemberChallenges",g.steward_member_id AS "stewardMemberId",
              count(DISTINCT gm.member_id) FILTER (WHERE gm.status IN ('active','joined'))::int AS "memberCount",
              count(DISTINCT h.challenge_id)::int AS "challengeCount"
       FROM groups g LEFT JOIN group_memberships gm USING(group_id) LEFT JOIN challenges h USING(group_id)
       WHERE g.group_id=$1::uuid GROUP BY g.group_id`, [groupId]);
    if (!group.rows[0]) return reply.code(404).send({ error: { code: 'operator_group_not_found', message: 'Group not found' } });
    const memberships = await db.query(
      `SELECT member_id AS "memberId",role,status,joined_at AS "joinedAt" FROM group_memberships
       WHERE group_id=$1::uuid ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,joined_at`, [groupId]);
    const challenges = await db.query(
      `SELECT challenge_id AS "challengeId",title,challenge_type AS type,status,start_date AS "startDate",end_date AS "endDate"
       FROM challenges WHERE group_id=$1::uuid ORDER BY created_at DESC`, [groupId]);
    return { ...group.rows[0], memberships: memberships.rows, challenges: challenges.rows };
  });

  app.get('/v1/operator/console/activities', async (request, reply) => {
    if (!await authorize(request, reply)) return;
    const q = `%${searchTerm(request)}%`;
    const kind = queryValue(request, 'kind');
    const lifecycle = queryValue(request, 'lifecycle');
    const items = await db.query(
      `SELECT knowledge_id AS id,activity_code AS "activityCode",kind,lifecycle,name,category,subcategory,difficulty,
              description,metric_unit AS "metricUnit",target_value AS "targetValue",target_type AS "targetType",
              current_version AS "currentVersion",default_locale AS "defaultLocale",grandfathered,created_at AS "createdAt"
       FROM knowledge_items
       WHERE ($1='' OR name ILIKE $2 OR coalesce(activity_code,'') ILIKE $2 OR category ILIKE $2)
         AND ($3='' OR kind=$3) AND ($4='' OR lifecycle=$4)
       ORDER BY name,knowledge_id LIMIT $5 OFFSET $6`,
      [searchTerm(request), q, kind, lifecycle, pageSize(request), pageOffset(request)],
    );
    const recent = await db.query(
      `SELECT r.record_id AS "recordId",r.accepted_at AS "acceptedAt",r.value,r.unit,r.occurred_day AS "occurredDay",
              k.name AS "activityName",k.activity_code AS "activityCode",h.challenge_id AS "challengeId",
              h.title AS "challengeTitle",g.name AS "groupName",r.participation_id AS "participationId"
       FROM challenge_activity_records r JOIN challenge_activity_configs c USING(activity_config_id)
       JOIN knowledge_items k ON k.knowledge_id=c.knowledge_id JOIN challenges h ON h.challenge_id=r.challenge_id JOIN groups g ON g.group_id=h.group_id
       WHERE ($1='' OR k.name ILIKE $2 OR h.title ILIKE $2 OR g.name ILIKE $2)
       ORDER BY r.accepted_at DESC,r.record_id DESC LIMIT $3 OFFSET $4`,
      [searchTerm(request), q, pageSize(request), pageOffset(request)],
    );
    return { items: items.rows, recentAcceptedRecords: recent.rows, limit: pageSize(request), offset: pageOffset(request) };
  });

  app.get('/v1/operator/console/challenges', async (request, reply) => {
    if (!await authorize(request, reply)) return;
    const q = `%${searchTerm(request)}%`;
    const status = queryValue(request, 'status');
    const type = queryValue(request, 'type');
    const supportTiizi = queryValue(request, 'supportTiizi');
    const causeStatus = queryValue(request, 'causeStatus');
    const result = await db.query(
      `SELECT h.challenge_id AS "challengeId",h.title,h.challenge_type AS type,h.status,h.start_date AS "startDate",
              h.end_date AS "endDate",h.created_at AS "createdAt",h.goal_value AS "goalValue",h.goal_unit AS "goalUnit",
              h.required_consecutive_days AS "requiredConsecutiveDays",h.support_tiizi_enabled AS "supportTiiziEnabled",
              g.group_id AS "groupId",g.name AS "groupName",g.is_private AS "groupIsPrivate",
              count(DISTINCT p.participation_id)::int AS "participationCount",
              count(DISTINCT p.participation_id) FILTER (WHERE p.status='active')::int AS "activeParticipationCount",
              c.approval_status AS "causeStatus",c.title AS "causeTitle"
       FROM challenges h JOIN groups g USING(group_id) LEFT JOIN challenge_participations p USING(challenge_id)
       LEFT JOIN challenge_social_causes c USING(challenge_id)
       WHERE ($1='' OR h.title ILIKE $2 OR g.name ILIKE $2 OR h.challenge_id::text ILIKE $2)
         AND ($3='' OR h.status=$3) AND ($4='' OR h.challenge_type=$4)
         AND ($5='' OR h.support_tiizi_enabled=($5='enabled')) AND ($6='' OR c.approval_status=$6)
       GROUP BY h.challenge_id,g.group_id,c.approval_status,c.title
       ORDER BY h.created_at DESC,h.challenge_id LIMIT $7 OFFSET $8`,
      [searchTerm(request), q, status, type, supportTiizi, causeStatus, pageSize(request), pageOffset(request)],
    );
    return { challenges: result.rows, limit: pageSize(request), offset: pageOffset(request) };
  });

  app.get('/v1/operator/console/challenges/:challengeId', async (request, reply) => {
    if (!await authorize(request, reply)) return;
    const { challengeId } = request.params as { challengeId: string };
    const result = await db.query(
      `SELECT h.challenge_id AS "challengeId",h.title,h.description,h.instructions,h.challenge_type AS type,h.status,
              h.start_date AS "startDate",h.end_date AS "endDate",h.created_at AS "createdAt",h.updated_at AS "updatedAt",
              h.activated_at AS "activatedAt",h.ended_at AS "endedAt",h.finalized_at AS "finalizedAt",
              h.current_config_version AS "configVersion",h.goal_value AS "goalValue",h.goal_unit AS "goalUnit",
              h.required_consecutive_days AS "requiredConsecutiveDays",h.reset_on_miss AS "resetOnMiss",
              h.support_tiizi_enabled AS "supportTiiziEnabled",h.created_by_member_id AS "creatorMemberId",
              g.group_id AS "groupId",g.name AS "groupName",g.status AS "groupStatus",g.is_private AS "groupIsPrivate",
              g.steward_member_id AS "stewardMemberId",c.title AS "causeTitle",c.description AS "causeDescription",
              c.purpose AS "causePurpose",c.beneficiary,c.destination_owner AS "destinationOwner",
              c.payment_destination_reference AS "paymentDestinationReference",c.approval_status AS "causeStatus",
              c.approval_authority AS "causeApprovalAuthority",c.decision_at AS "causeDecisionAt",c.decision_reason AS "causeDecisionReason",
              count(DISTINCT p.participation_id)::int AS "participationCount",
              count(DISTINCT p.participation_id) FILTER (WHERE p.status='active')::int AS "activeParticipationCount"
       FROM challenges h JOIN groups g USING(group_id) LEFT JOIN challenge_social_causes c USING(challenge_id)
       LEFT JOIN challenge_participations p USING(challenge_id)
       WHERE h.challenge_id=$1::uuid GROUP BY h.challenge_id,g.group_id,c.challenge_id`, [challengeId]);
    if (!result.rows[0]) return reply.code(404).send({ error: { code: 'operator_challenge_not_found', message: 'Challenge not found' } });
    const decisions = await db.query(
      `SELECT decision,authority_member_id AS "authorityMemberId",reason,decided_at AS "decidedAt"
       FROM challenge_social_cause_decisions WHERE challenge_id=$1::uuid ORDER BY decided_at,decision_id`, [challengeId]);
    const activities = await db.query(
      `SELECT r.record_id AS "recordId",r.accepted_at AS "acceptedAt",r.value,r.unit,r.occurred_day AS "occurredDay",
              k.name AS "activityName",k.activity_code AS "activityCode",r.participation_id AS "participationId"
       FROM challenge_activity_records r JOIN challenge_activity_configs c USING(activity_config_id)
       LEFT JOIN knowledge_items k ON k.knowledge_id=c.knowledge_id
       WHERE r.challenge_id=$1::uuid ORDER BY r.accepted_at DESC,r.record_id DESC LIMIT 50`, [challengeId]);
    return { ...result.rows[0], causeDecisions: decisions.rows, recentAcceptedActivities: activities.rows };
  });

  app.get('/v1/operator/console/support', async (request, reply) => {
    if (!await authorize(request, reply)) return;
    const q = `%${searchTerm(request)}%`;
    const result = await db.query(
      `SELECT h.challenge_id AS "challengeId",h.title AS "challengeTitle",h.challenge_type AS "challengeType",
              h.status AS "challengeStatus",h.start_date AS "startDate",h.end_date AS "endDate",
              h.support_tiizi_enabled AS "supportTiiziEnabled",g.name AS "groupName",g.is_private AS "groupIsPrivate",
              c.title AS "causeTitle",c.beneficiary,c.destination_owner AS "destinationOwner",
              c.payment_destination_reference AS "paymentDestinationReference",c.approval_status AS "causeStatus"
       FROM challenges h JOIN groups g USING(group_id) LEFT JOIN challenge_social_causes c USING(challenge_id)
       WHERE (h.support_tiizi_enabled OR c.challenge_id IS NOT NULL)
         AND ($1='' OR h.title ILIKE $2 OR g.name ILIKE $2 OR coalesce(c.beneficiary,'') ILIKE $2)
       ORDER BY h.created_at DESC,h.challenge_id LIMIT $3 OFFSET $4`,
      [searchTerm(request), q, pageSize(request), pageOffset(request)],
    );
    return { configurations: result.rows, limit: pageSize(request), offset: pageOffset(request), financialScope: 'Configuration only; no contribution or payment records are represented.' };
  });

  app.get('/v1/operator/console/localisation', async (request, reply) => {
    if (!await authorize(request, reply)) return;
    const q = `%${searchTerm(request)}%`;
    const result = await db.query(
      `SELECT k.knowledge_id AS "knowledgeId",k.activity_code AS "activityCode",k.name AS "itemName",
              k.default_locale AS "defaultLocale",t.locale,t.field,t.value,t.updated_at AS "updatedAt"
       FROM knowledge_item_texts t JOIN knowledge_items k ON k.knowledge_id=t.item_id
       WHERE ($1='' OR k.name ILIKE $2 OR coalesce(k.activity_code,'') ILIKE $2 OR t.locale ILIKE $2 OR t.field ILIKE $2 OR t.value ILIKE $2)
       ORDER BY k.name,t.locale,t.field LIMIT $3 OFFSET $4`,
      [searchTerm(request), q, pageSize(request), pageOffset(request)]);
    const coverage = await db.query(
      `SELECT t.locale,count(DISTINCT t.item_id)::int AS "itemsWithText",count(*)::int AS "translatedFields"
       FROM knowledge_item_texts t GROUP BY t.locale ORDER BY t.locale`);
    const defaults = await db.query(
      `SELECT default_locale AS locale,count(*)::int AS "catalogueItems"
       FROM knowledge_items GROUP BY default_locale ORDER BY default_locale`);
    return { localisedFields: result.rows, coverage: coverage.rows, defaultLocales: defaults.rows, limit: pageSize(request), offset: pageOffset(request), editable: false };
  });

  app.get('/v1/operator/console/access', async (request, reply) => {
    if (!await authorize(request, reply)) return;
    const readers = await db.query(
      `SELECT r.member_id AS "memberId",r.grant_reference AS "grantReference",r.granted_at AS "grantedAt",
              r.revoked_at AS "revokedAt",r.revoked_reference AS "revokedReference"
       FROM platform_operator_console_readers r ORDER BY r.granted_at,r.member_id`);
    const causeReviewers = await db.query(
      `SELECT r.member_id AS "memberId",r.grant_reference AS "grantReference",r.granted_at AS "grantedAt",
              r.revoked_at AS "revokedAt",r.revoked_reference AS "revokedReference"
       FROM platform_operator_cause_reviewers r ORDER BY r.granted_at,r.member_id`);
    return { currentOperatorMemberId: authenticatedMember(request).memberId, consoleReaders: readers.rows, socialCauseReviewers: causeReviewers.rows, canManageAccess: false };
  });

  app.get('/v1/operator/console/audit', async (request, reply) => {
    if (!await authorize(request, reply)) return;
    const q = `%${searchTerm(request)}%`;
    const status = queryValue(request, 'decision');
    const result = await db.query(
      `SELECT d.decision_id AS "decisionId",d.decision,d.reason,d.decided_at AS "decidedAt",
              d.authority_member_id AS "authorityMemberId",c.challenge_id AS "challengeId",c.title AS "causeTitle",
              c.approval_status AS "currentCauseStatus",h.title AS "challengeTitle",g.name AS "groupName"
       FROM challenge_social_cause_decisions d JOIN challenge_social_causes c USING(challenge_id)
       JOIN challenges h USING(challenge_id) JOIN groups g USING(group_id)
       WHERE ($1='' OR c.title ILIKE $2 OR h.title ILIKE $2 OR g.name ILIKE $2 OR d.reason ILIKE $2 OR d.authority_member_id::text ILIKE $2)
         AND ($3='' OR d.decision=$3)
       ORDER BY d.decided_at DESC,d.decision_id DESC LIMIT $4 OFFSET $5`,
      [searchTerm(request), q, status, pageSize(request), pageOffset(request)]);
    return { decisions: result.rows, scope: 'Social Cause decisions only', limit: pageSize(request), offset: pageOffset(request) };
  });

  app.get('/v1/operator/console/health', async (request, reply) => {
    if (!await authorize(request, reply)) return;
    await db.query('SELECT 1');
    return { api: 'healthy', database: 'healthy', checkedAt: new Date().toISOString(), scope: 'API process and database connectivity only' };
  });
}
