import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import { apiPath } from './apiPrefix.js';
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
/** Page size ceiling AND default: the response window is never larger than this. */
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
  /** Opaque keyset cursor for the next window; null when this window is the last. */
  nextCursor: string | null;
  ranking: { applied: boolean };
}

/**
 * Keyset position of the last row served, in the SAME total order the query
 * uses: (relevance_score DESC, created_at DESC, challenge_id DESC). `createdAt`
 * carries the database's full microsecond precision as text so a page boundary
 * can never skip or repeat rows whose timestamps differ below a millisecond.
 */
interface DiscoveryCursor { score: number; createdAt: string; challengeId: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

function discoveryError(message: string, code = 'invalid_discovery_query'): never {
  const error = new Error(message) as Error & { statusCode: number; code: string };
  error.statusCode = 400;
  error.code = code;
  throw error;
}

function decodeCursor(cursor: string | undefined): DiscoveryCursor | null {
  if (cursor === undefined || cursor === '') return null;
  if (cursor.length > 512) discoveryError('cursor is invalid');
  let parsed: Partial<DiscoveryCursor>;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<DiscoveryCursor>;
  } catch {
    return discoveryError('cursor is invalid');
  }
  if (!parsed || typeof parsed !== 'object'
    || !Number.isInteger(parsed.score) || (parsed.score as number) < 0 || (parsed.score as number) > 1000
    || typeof parsed.createdAt !== 'string' || !CURSOR_TIMESTAMP.test(parsed.createdAt)
    || typeof parsed.challengeId !== 'string' || !UUID.test(parsed.challengeId)) {
    return discoveryError('cursor is invalid');
  }
  return { score: parsed.score as number, createdAt: parsed.createdAt, challengeId: parsed.challengeId };
}

function encodeCursor(row: HostRow): string {
  const cursor: DiscoveryCursor = { score: Number(row.relevance_score), createdAt: row.created_at_key, challengeId: row.challenge_id };
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
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
  relevance_score: number | string;
  /** created_at as UTC text at full microsecond precision (cursor key). */
  created_at_key: string;
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
  options: { rank?: string; limit?: string; cursor?: string } = {},
): Promise<DiscoverableChallengeList> {
  if (options.rank !== undefined && options.rank !== 'general' && options.rank !== 'relevance') {
    discoveryError("rank must be 'relevance' or 'general'");
  }
  const limit = options.limit === undefined ? CHALLENGE_DISCOVERY_LIMIT : Number(options.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > CHALLENGE_DISCOVERY_LIMIT) {
    discoveryError(`limit must be an integer from 1 to ${CHALLENGE_DISCOVERY_LIMIT}`);
  }
  const cursor = decodeCursor(options.cursor);
  const match = options.rank === 'general' ? null : preferenceMatchFor(preferences);

  // The relevance score is computed in SQL and orders BEFORE the window is cut,
  // so a strongly relevant Challenge is never hidden by recency. With no
  // preference every score is 0 and the order is plain newest-first. The window
  // after `cursor` is the keyset continuation of that same total order, so
  // walking every page yields the whole authorized set once, in order.
  const preferredDomains = new Set(
    match
      ? MEMBER_INTEREST_OPTIONS
        .filter((o) => match.interestLabels.includes(o.label))
        .map((o) => (o.domain === 'Fitness' ? 'fitness' : 'wellness'))
      : [],
  );
  const hosts = await db.query<HostRow>(
    `SELECT * FROM (
       SELECT c.challenge_id, c.created_at,
              to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at_key,
              g.group_id, g.name AS group_name, g.focus_tags, g.goal_ids,
              g.require_admin_approval, gm.status AS viewer_status,
              (g.steward_member_id = $1) AS viewer_is_steward,
              (${GROUP_INTEREST_WEIGHT} * (SELECT count(*) FROM unnest(COALESCE(g.focus_tags, ARRAY[]::text[])) tag WHERE tag = ANY($2::text[]))
               + ${GROUP_GOAL_WEIGHT} * (SELECT count(*) FROM unnest(COALESCE(g.goal_ids, ARRAY[]::text[])) gid WHERE gid = ANY($3::text[]))
               + CASE WHEN EXISTS (
                   SELECT 1 FROM challenge_activity_configs ac
                   JOIN knowledge_items ki ON ki.knowledge_id = ac.knowledge_id
                   WHERE ac.challenge_id = c.challenge_id AND ac.version = c.current_config_version
                     AND ki.kind = ANY($4::text[])) THEN ${CHALLENGE_DOMAIN_WEIGHT} ELSE 0 END)::int AS relevance_score
       FROM challenges c
       JOIN groups g ON g.group_id = c.group_id
       LEFT JOIN group_memberships gm ON gm.group_id = g.group_id AND gm.member_id = $1
       WHERE g.status = 'active' AND g.is_private = false
         AND g.steward_member_id IS DISTINCT FROM $1
         AND COALESCE(gm.status, '') NOT IN ('active', 'joined')
         AND NOT EXISTS (SELECT 1 FROM challenge_participations p
                         WHERE p.challenge_id = c.challenge_id AND p.member_id = $1)
     ) discoverable
     WHERE ($5::timestamptz IS NULL
            OR (relevance_score, created_at, challenge_id) < ($7::int, $5::timestamptz, $6::uuid))
     ORDER BY relevance_score DESC, created_at DESC, challenge_id DESC
     LIMIT $8`,
    [
      memberId, match?.interestLabels ?? [], match?.goalIds ?? [], [...preferredDomains],
      cursor?.createdAt ?? null, cursor?.challengeId ?? null, cursor?.score ?? 0, limit + 1,
    ],
  );
  const hasMore = hosts.rows.length > limit;
  const pageRows = hosts.rows.slice(0, limit);
  const hostById = new Map(pageRows.map((row) => [String(row.challenge_id), row]));
  const ids = pageRows.map((row) => String(row.challenge_id));
  const noEpisodes = new Map<string, ParticipationRow[]>(ids.map((id) => [id, []]));
  const summaries = ids.length === 0
    ? []
    : await assembleChallengeSummaries(db, ids, noEpisodes, new Date());


  // The SQL order IS the response order (and the cursor's order); the summaries
  // are only re-attached to it. Re-sorting here would desynchronise pages.
  const summaryById = new Map(summaries.map((summary) => [summary.challengeId, summary]));
  const challenges: DiscoverableChallenge[] = [];
  for (const id of ids) {
    const summary = summaryById.get(id);
    if (!summary) continue;
    const host = hostById.get(id)!;
    const focusTags = Array.isArray(host.focus_tags) ? host.focus_tags.filter((t): t is string => typeof t === 'string') : [];
    const goalLabels = labelsForIds(host.goal_ids, GROUP_GOALS);
    const interests = match ? focusTags.filter((tag) => match.interestLabels.includes(tag)) : [];
    const goals = match ? goalLabels.filter((label) => match.goalLabels.includes(label)) : [];
    const domains = [...new Set(summary.activities.map((a) => a.domain))].filter((d) => preferredDomains.has(d));
    challenges.push({
      ...summary,
      host: {
        groupId: host.group_id,
        groupName: host.group_name,
        admissionMode: host.require_admin_approval ? 'approval' : 'open',
        viewerRelationship: relationship(host),
      },
      relevance: { interests, goals, domains },
    });
  }
  return {
    challenges,
    nextCursor: hasMore && pageRows.length > 0 ? encodeCursor(pageRows[pageRows.length - 1]) : null,
    ranking: { applied: match !== null },
  };
}

export function registerChallengeDiscoveryRoutes(app: FastifyInstance, db: Db): void {
  app.get(apiPath('/challenges/discover'), async (request, reply) => {
    const member = authenticatedMember(request);
    const query = (request.query ?? {}) as { rank?: string; limit?: string; cursor?: string };
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
