import { Buffer } from 'node:buffer';
import type { Db } from './db.js';
import { GroupMutationError } from './groupErrors.js';
import { normalizeGroupInviteCode } from './postgresGroupAuthority.js';
import { GROUP_GOALS, labelsForIds } from './groupVocabulary.js';
import { MEMBER_GOAL_OPTIONS, MEMBER_INTEREST_OPTIONS, type MemberPreferenceIds } from './memberPreferences.js';

/**
 * P2 relevance weights. Group Interests (focus tags) outweigh Group Goals;
 * Challenge domain relevance (see challengeDiscovery) is the weakest signal.
 * Ranking ONLY orders the already-authorized discoverable set.
 */
export const GROUP_INTEREST_WEIGHT = 3;
export const GROUP_GOAL_WEIGHT = 2;

export const DISCOVERY_DEFAULT_LIMIT = 12;
export const DISCOVERY_MAX_LIMIT = 30;

export interface DiscoverableGroup {
  id: string;
  name: string;
  description: string;
  tagline: string;
  coverId: string | null;
  location: string;
  focusTags: string[];
  goals: string[];
  memberCount: number;
  admissionMode: 'open' | 'approval';
  viewerRelationship: 'steward' | 'member' | 'pending' | 'none';
  /** The member's saved Interests / Goals this Group matches (labels). Empty when none or unranked. */
  relevance: { interests: string[]; goals: string[] };
}

export interface GroupDiscoveryRanking {
  /** True only when the member has saved preferences and ordering by them was requested. */
  applied: boolean;
}

interface DiscoveryCursor { createdAt: string; groupId: string; score: number }
interface DiscoverRow {
  group_id: string;
  name: string;
  description: string | null;
  tagline: string | null;
  cover_id: string | null;
  location: string | null;
  focus_tags: unknown;
  goal_ids?: unknown;
  custom_goal?: string | null;
  relevance_score?: number | string;
  member_count: number | string;
  require_admin_approval: boolean;
  viewer_status: string | null;
  viewer_is_steward: boolean;
  created_at: string | Date;
}

function inputError(message: string): never {
  throw new GroupMutationError(400, 'invalid_discovery_query', message);
}

function escapeLike(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function decodeCursor(cursor: string | undefined): DiscoveryCursor | null {
  if (cursor === undefined || cursor === '') return null;
  if (cursor.length > 512) inputError('cursor is invalid');
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<DiscoveryCursor>;
    const score = parsed.score === undefined ? 0 : parsed.score;
    if (!Number.isInteger(score) || score < 0 || score > 1000) inputError('cursor is invalid');
    if (typeof parsed.createdAt !== 'string' || !Number.isFinite(Date.parse(parsed.createdAt)) ||
      typeof parsed.groupId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.groupId)) {
      inputError('cursor is invalid');
    }
    return { createdAt: new Date(parsed.createdAt).toISOString(), groupId: parsed.groupId, score };
  } catch {
    return inputError('cursor is invalid');
  }
}

function encodeCursor(row: DiscoverRow): string {
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString();
  return Buffer.from(JSON.stringify({ createdAt, groupId: row.group_id, score: Number(row.relevance_score ?? 0) }), 'utf8').toString('base64url');
}

function relationship(row: DiscoverRow): DiscoverableGroup['viewerRelationship'] {
  if (row.viewer_is_steward) return 'steward';
  if (row.viewer_status === 'active' || row.viewer_status === 'joined') return 'member';
  if (row.viewer_status === 'pending') return 'pending';
  return 'none';
}

function toGroup(row: DiscoverRow, prefs: PreferenceMatch | null = null): DiscoverableGroup {
  const focusTags = Array.isArray(row.focus_tags) ? row.focus_tags.filter((item): item is string => typeof item === 'string') : [];
  const goalLabels = labelsForIds(row.goal_ids, GROUP_GOALS);
  return {
    id: row.group_id,
    name: row.name,
    description: row.description ?? '',
    tagline: row.tagline ?? '',
    coverId: row.cover_id,
    location: row.location ?? '',
    focusTags,
    goals: [...goalLabels, ...(row.custom_goal ? [row.custom_goal] : [])],
    memberCount: Number(row.member_count),
    admissionMode: row.require_admin_approval ? 'approval' : 'open',
    viewerRelationship: relationship(row),
    relevance: prefs
      ? {
        interests: focusTags.filter((tag) => prefs.interestLabels.includes(tag)),
        goals: goalLabels.filter((label) => prefs.goalLabels.includes(label)),
      }
      : { interests: [], goals: [] },
  };
}

interface PreferenceMatch { interestLabels: string[]; goalLabels: string[]; goalIds: string[] }

/** Saved preference IDs -> the stored vocabulary the ranking compares against. */
export function preferenceMatchFor(prefs: MemberPreferenceIds | null | undefined): PreferenceMatch | null {
  if (!prefs || (prefs.interestIds.length === 0 && prefs.goalIds.length === 0)) return null;
  const interestLabels = MEMBER_INTEREST_OPTIONS.filter((o) => prefs.interestIds.includes(o.id)).map((o) => o.label);
  const goals = MEMBER_GOAL_OPTIONS.filter((o) => prefs.goalIds.includes(o.id));
  return { interestLabels, goalLabels: goals.map((o) => o.label), goalIds: goals.map((o) => o.id) };
}

export async function listDiscoverableGroups(
  db: Db,
  viewerMemberId: string,
  options: { q?: string; limit?: string; cursor?: string; rank?: string },
  preferences: MemberPreferenceIds | null = null,
): Promise<{ groups: DiscoverableGroup[]; nextCursor: string | null; ranking: GroupDiscoveryRanking }> {
  if (options.rank !== undefined && options.rank !== 'general' && options.rank !== 'relevance') inputError("rank must be 'relevance' or 'general'");
  const match_ = options.rank === 'general' ? null : preferenceMatchFor(preferences);
  const rawLimit = options.limit === undefined ? DISCOVERY_DEFAULT_LIMIT : Number(options.limit);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > DISCOVERY_MAX_LIMIT) inputError(`limit must be an integer from 1 to ${DISCOVERY_MAX_LIMIT}`);
  const q = options.q?.trim() ?? '';
  if (q.length > 100) inputError('q must be at most 100 characters');
  const cursor = decodeCursor(options.cursor);
  const match = q.length > 0 ? `%${escapeLike(q)}%` : null;
  // The authorized set (status/privacy/search predicates) is the inner query
  // and is identical with or without ranking. `relevance_score` is only an
  // ordering key: it is 0 for every row when no preference is applied, which
  // reduces the ordering and cursor to the original (created_at, group_id).
  const result = await db.query<DiscoverRow>(
    `SELECT * FROM (
       SELECT g.group_id, g.name, g.description, g.tagline, g.cover_id, g.location,
         g.focus_tags, g.goal_ids, g.custom_goal, g.require_admin_approval, g.created_at,
         gm.status AS viewer_status, (g.steward_member_id=$1) AS viewer_is_steward,
         (SELECT count(*)::int FROM group_memberships active_members
          WHERE active_members.group_id=g.group_id AND active_members.status IN ('active','joined')) AS member_count,
         (${GROUP_INTEREST_WEIGHT} * (SELECT count(*) FROM unnest(COALESCE(g.focus_tags, ARRAY[]::text[])) tag WHERE tag = ANY($7::text[]))
          + ${GROUP_GOAL_WEIGHT} * (SELECT count(*) FROM unnest(COALESCE(g.goal_ids, ARRAY[]::text[])) gid WHERE gid = ANY($8::text[])))::int AS relevance_score
       FROM groups g
       LEFT JOIN group_memberships gm ON gm.group_id=g.group_id AND gm.member_id=$1
       WHERE g.status='active' AND g.is_private=false
         AND ($2::text IS NULL OR g.name ILIKE $2 ESCAPE E'\\\\'
           OR COALESCE(g.description,'') ILIKE $2 ESCAPE E'\\\\'
           OR COALESCE(g.tagline,'') ILIKE $2 ESCAPE E'\\\\'
           OR EXISTS (SELECT 1 FROM unnest(COALESCE(g.focus_tags, ARRAY[]::text[])) tag WHERE tag ILIKE $2 ESCAPE E'\\\\')
           OR COALESCE(g.custom_goal,'') ILIKE $2 ESCAPE E'\\\\'
           OR EXISTS (SELECT 1 FROM unnest(COALESCE(g.goal_ids, ARRAY[]::text[])) goal_id WHERE goal_id=ANY($6::text[])))
     ) ranked
     WHERE ($3::timestamptz IS NULL OR (ranked.relevance_score,ranked.created_at,ranked.group_id)<($9::int,$3::timestamptz,$4::uuid))
     ORDER BY ranked.relevance_score DESC, ranked.created_at DESC, ranked.group_id DESC
     LIMIT $5`,
    [
      viewerMemberId, match, cursor?.createdAt ?? null, cursor?.groupId ?? null, rawLimit + 1,
      GROUP_GOALS.filter((goal) => goal.label.toLocaleLowerCase().includes(q.toLocaleLowerCase())).map((goal) => goal.id),
      match_?.interestLabels ?? [], match_?.goalIds ?? [], cursor?.score ?? 0,
    ],
  );
  const hasMore = result.rows.length > rawLimit;
  const pageRows = result.rows.slice(0, rawLimit);
  return {
    groups: pageRows.map((row) => toGroup(row, match_)),
    nextCursor: hasMore && pageRows.length ? encodeCursor(pageRows[pageRows.length - 1]) : null,
    ranking: { applied: match_ !== null },
  };
}

export async function resolveGroupInvite(db: Db, viewerMemberId: string, rawCode: string) {
  const code = normalizeGroupInviteCode(rawCode);
  if (!code) throw new GroupMutationError(404, 'invite_not_found', 'Invite code not found');
  const result = await db.query<DiscoverRow & { is_private: boolean }>(
    `SELECT g.group_id, g.name, g.description, g.tagline, g.cover_id, g.location,
       g.focus_tags, g.goal_ids, g.custom_goal, g.require_admin_approval, g.is_private, g.created_at,
       gm.status AS viewer_status, (g.steward_member_id=$2) AS viewer_is_steward,
       (SELECT count(*)::int FROM group_memberships active_members
        WHERE active_members.group_id=g.group_id AND active_members.status IN ('active','joined')) AS member_count
     FROM groups g
     LEFT JOIN group_memberships gm ON gm.group_id=g.group_id AND gm.member_id=$2
     WHERE g.status='active' AND g.invite_code=$1`, [code, viewerMemberId],
  );
  const row = result.rows[0];
  if (!row) throw new GroupMutationError(404, 'invite_not_found', 'Invite code not found');
  return { ...toGroup(row), admissionMode: row.is_private || row.require_admin_approval ? 'approval' as const : 'open' as const, isPrivate: row.is_private };
}
