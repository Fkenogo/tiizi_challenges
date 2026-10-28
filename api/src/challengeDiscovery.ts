import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import {
  assembleChallengeSummaries,
  type ApiChallengeSummary,
} from './challengeReads.js';
import type { ParticipationRow } from './challengeParticipations.js';
import { GROUP_GOALS, labelsForIds } from './groupVocabulary.js';
import { GROUP_GOAL_WEIGHT, GROUP_INTEREST_WEIGHT, preferenceMatchFor } from './groupDiscovery.js';
import { MEMBER_INTEREST_OPTIONS, getMemberPreferenceIds, type MemberPreferenceIds } from './memberPreferences.js';

/**
 * TIIZI-FER-P2-001 — Challenge discovery across discoverable Groups.
 *
 * Authority: the SAME predicate Group discovery uses (active, non-private
 * Group) and the SAME outsider projection `listVisibleChallengesInGroup`
 * serves (EOG §9: the hosted Challenge with NO participation projection),
 * assembled by the SAME `assembleChallengeSummaries`. It excludes only what the
 * member already has in their own list (their Groups' Challenges and any
 * Challenge they hold a participation episode in). Reading this list creates
 * no membership and no participation; joining is the existing Group join and,
 * separately, the existing Challenge join.
 *
 * Preferences ORDER the result and never filter it. Differentiated signals:
 * Group Interests (3) > Group Goals (2) > Challenge activity domain (1).
 */

export const CHALLENGE_DOMAIN_WEIGHT = 1;
export const CHALLENGE_DISCOVERY_LIMIT = 60;

export interface DiscoverableChallenge extends ApiChallengeSummary {
  host: {
    groupId: string;
    groupName: string | null;
    admissionMode: 'open' | 'approval';
    viewerRelationship: 'steward' | 'member' | 'pending' | 'none';
  };
  relevance: { interests: string[]; goals: string[]; domains: Array<'fitness' | 'wellness'> };
}

export interface DiscoverableChallengeList {
  challenges: DiscoverableChallenge[];
  ranking: { applied: boolean };
}

interface HostRow {
  challenge_id: string;
  group_id: string;
  group_name: string | null;
  focus_tags: unknown;
  goal_ids: unknown;
  require_admin_approval: boolean;
  viewer_status: string | null;
  viewer_is_steward: boolean;
}

function relationship(row: HostRow): DiscoverableChallenge['host']['viewerRelationship'] {
  if (row.viewer_is_steward) return 'steward';
  if (row.viewer_status === 'active' || row.viewer_status === 'joined') return 'member';
  if (row.viewer_status === 'pending') return 'pending';
  return 'none';
}

export async function listDiscoverableChallenges(
  db: Db,
  memberId: string,
  preferences: MemberPreferenceIds | null,
  options: { rank?: string } = {},
): Promise<DiscoverableChallengeList> {
  if (options.rank !== undefined && options.rank !== 'general' && options.rank !== 'relevance') {
    const error = new Error("rank must be 'relevance' or 'general'") as Error & { statusCode: number; code: string };
    error.statusCode = 400;
    error.code = 'invalid_discovery_query';
    throw error;
  }
  const match = options.rank === 'general' ? null : preferenceMatchFor(preferences);

  const hosts = await db.query<HostRow>(
    `SELECT c.challenge_id, g.group_id, g.name AS group_name, g.focus_tags, g.goal_ids,
            g.require_admin_approval, gm.status AS viewer_status,
            (g.steward_member_id = $1) AS viewer_is_steward
     FROM challenges c
     JOIN groups g ON g.group_id = c.group_id
     LEFT JOIN group_memberships gm ON gm.group_id = g.group_id AND gm.member_id = $1
     WHERE g.status = 'active' AND g.is_private = false
       AND g.steward_member_id IS DISTINCT FROM $1
       AND COALESCE(gm.status, '') NOT IN ('active', 'joined')
       AND NOT EXISTS (SELECT 1 FROM challenge_participations p
                       WHERE p.challenge_id = c.challenge_id AND p.member_id = $1)
     ORDER BY c.created_at DESC, c.challenge_id DESC
     LIMIT ${CHALLENGE_DISCOVERY_LIMIT}`,
    [memberId],
  );
  const hostById = new Map(hosts.rows.map((row) => [String(row.challenge_id), row]));
  const ids = [...hostById.keys()];
  const noEpisodes = new Map<string, ParticipationRow[]>(ids.map((id) => [id, []]));
  const summaries = ids.length === 0
    ? []
    : await assembleChallengeSummaries(db, ids, noEpisodes, new Date());

  const preferredDomains = new Set(
    match
      ? MEMBER_INTEREST_OPTIONS
        .filter((o) => match.interestLabels.includes(o.label))
        .map((o) => (o.domain === 'Fitness' ? 'fitness' : 'wellness'))
      : [],
  );

  const scored = summaries.map((summary, index) => {
    const host = hostById.get(summary.challengeId)!;
    const focusTags = Array.isArray(host.focus_tags) ? host.focus_tags.filter((t): t is string => typeof t === 'string') : [];
    const goalLabels = labelsForIds(host.goal_ids, GROUP_GOALS);
    const interests = match ? focusTags.filter((tag) => match.interestLabels.includes(tag)) : [];
    const goals = match ? goalLabels.filter((label) => match.goalLabels.includes(label)) : [];
    const domains = [...new Set(summary.activities.map((a) => a.domain))].filter((d) => preferredDomains.has(d));
    const score = GROUP_INTEREST_WEIGHT * interests.length + GROUP_GOAL_WEIGHT * goals.length
      + (domains.length > 0 ? CHALLENGE_DOMAIN_WEIGHT : 0);
    const challenge: DiscoverableChallenge = {
      ...summary,
      host: {
        groupId: host.group_id,
        groupName: host.group_name,
        admissionMode: host.require_admin_approval ? 'approval' : 'open',
        viewerRelationship: relationship(host),
      },
      relevance: { interests, goals, domains },
    };
    return { challenge, score, index };
  });
  // Stable: ties keep the existing (assembled) order.
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return { challenges: scored.map((entry) => entry.challenge), ranking: { applied: match !== null } };
}

export function registerChallengeDiscoveryRoutes(app: FastifyInstance, db: Db): void {
  app.get('/api/challenges/discover', async (request, reply) => {
    const member = authenticatedMember(request);
    const query = (request.query ?? {}) as { rank?: string };
    const preferences = query.rank === 'general'
      ? null
      : await getMemberPreferenceIds(db, member.memberId).catch(() => null);
    try {
      return await listDiscoverableChallenges(db, member.memberId, preferences, query);
    } catch (error) {
      const e = error as { statusCode?: number; code?: string; message: string };
      if (e.statusCode === 400) return reply.code(400).send({ error: e.code, message: e.message });
      return reply.code(503).send({ error: 'challenge_discovery_unavailable', message: 'Challenge discovery is unavailable' });
    }
  });
}
