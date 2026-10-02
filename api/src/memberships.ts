import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import { GROUP_GOALS, labelsForIds } from './groupVocabulary.js';

export interface ApiMembershipGroup {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  allowMemberChallenges: boolean;
  /** Governed Group presentation fields read from authoritative PostgreSQL. */
  coverId: string | null;
  tagline: string;
  location: string;
  focusTags: string[];
  goals: string[];
}

export interface ApiMembership {
  groupId: string;
  role: string;
  status: string;
  joinedAt: string;
  group: ApiMembershipGroup;
}

export interface MyMembershipsResponse {
  memberId: string;
  memberships: ApiMembership[];
  pendingMemberships?: ApiPendingMembership[];
}

export interface ApiPendingMembership {
  groupId: string;
  requestedAt: string;
  group: ApiMembershipGroup;
}

interface MembershipRow {
  group_id: string;
  role: string;
  status: string;
  joined_at: string;
  group_name: string;
  group_description: string;
  group_is_private: boolean;
  group_allow_member_challenges: boolean;
  group_cover_id: string | null;
  group_tagline: string | null;
  group_location: string | null;
  group_focus_tags: unknown;
  group_goal_ids: unknown;
  group_custom_goal: string | null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((t): t is string => typeof t === 'string') : [];
}

export async function listMembershipsForMember(db: Db, memberId: string): Promise<ApiMembership[]> {
  const result = await db.query<MembershipRow>(
    `SELECT m.group_id, m.role, m.status, m.joined_at,
            g.name AS group_name, g.description AS group_description,
            g.is_private AS group_is_private,
            g.allow_member_challenges AS group_allow_member_challenges,
            g.cover_id AS group_cover_id, g.tagline AS group_tagline,
            g.location AS group_location, g.focus_tags AS group_focus_tags,
            g.goal_ids AS group_goal_ids, g.custom_goal AS group_custom_goal
     FROM group_memberships m
     JOIN groups g ON g.group_id = m.group_id
     WHERE m.member_id = $1
       AND m.status IN ('joined', 'active')
     ORDER BY g.name ASC`,
    [memberId],
  );
  return result.rows.map((row) => ({
    groupId: String(row.group_id),
    role: row.role,
    status: row.status,
    joinedAt: new Date(row.joined_at).toISOString(),
    group: {
      id: String(row.group_id),
      name: row.group_name,
      description: row.group_description ?? '',
      isPrivate: Boolean(row.group_is_private),
      allowMemberChallenges: row.group_allow_member_challenges !== false,
      coverId: typeof row.group_cover_id === 'string' ? row.group_cover_id : null,
      tagline: typeof row.group_tagline === 'string' ? row.group_tagline : '',
      location: typeof row.group_location === 'string' ? row.group_location : '',
      focusTags: toStringArray(row.group_focus_tags),
      goals: [...labelsForIds(row.group_goal_ids, GROUP_GOALS), ...(typeof row.group_custom_goal === 'string' && row.group_custom_goal ? [row.group_custom_goal] : [])],
    },
  }));
}

export async function listPendingMembershipsForMember(db: Db, memberId: string): Promise<ApiPendingMembership[]> {
  const result = await db.query<{
    group_id: string; requested_at: string | Date | null; created_at: string | Date;
    group_name: string; group_description: string; group_is_private: boolean;
    group_allow_member_challenges: boolean;
    group_cover_id: string | null; group_tagline: string | null;
    group_location: string | null; group_focus_tags: unknown;
    group_goal_ids: unknown; group_custom_goal: string | null;
  }>(
    `SELECT gm.group_id, gm.requested_at, gm.created_at,
       g.name AS group_name, g.description AS group_description, g.is_private AS group_is_private,
       g.allow_member_challenges AS group_allow_member_challenges,
       g.cover_id AS group_cover_id, g.tagline AS group_tagline,
       g.location AS group_location, g.focus_tags AS group_focus_tags,
       g.goal_ids AS group_goal_ids, g.custom_goal AS group_custom_goal
     FROM group_memberships gm JOIN groups g ON g.group_id=gm.group_id
     WHERE gm.member_id=$1 AND gm.status='pending' AND g.status='active'
     ORDER BY COALESCE(gm.requested_at,gm.created_at) DESC, g.group_id ASC`, [memberId],
  );
  return result.rows.map((row) => ({
    groupId: String(row.group_id),
    requestedAt: new Date(row.requested_at ?? row.created_at).toISOString(),
    group: {
      id: String(row.group_id), name: row.group_name, description: row.group_description ?? '',
      isPrivate: Boolean(row.group_is_private),
      allowMemberChallenges: row.group_allow_member_challenges !== false,
      coverId: typeof row.group_cover_id === 'string' ? row.group_cover_id : null,
      tagline: typeof row.group_tagline === 'string' ? row.group_tagline : '',
      location: typeof row.group_location === 'string' ? row.group_location : '',
      focusTags: toStringArray(row.group_focus_tags),
      goals: [...labelsForIds(row.group_goal_ids, GROUP_GOALS), ...(typeof row.group_custom_goal === 'string' && row.group_custom_goal ? [row.group_custom_goal] : [])],
    },
  }));
}

export function registerMembershipRoutes(app: FastifyInstance, db: Db): void {
  app.get(
    '/api/memberships/me',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            required: ['memberId', 'memberships'],
    properties: {
      memberId: { type: 'string', format: 'uuid' },
      pendingMemberships: { type: 'array', items: { type: 'object', required: ['groupId', 'requestedAt', 'group'], properties: {
        groupId: { type: 'string', format: 'uuid' }, requestedAt: { type: 'string' }, group: { type: 'object', required: ['id', 'name', 'description', 'isPrivate'], properties: {
          id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, description: { type: 'string' }, isPrivate: { type: 'boolean' },
          allowMemberChallenges: { type: 'boolean' }, coverId: { anyOf: [{ type: 'string' }, { type: 'null' }] }, tagline: { type: 'string' }, location: { type: 'string' }, focusTags: { type: 'array', items: { type: 'string' } }, goals: { type: 'array', items: { type: 'string' } },
        } },
      } } },
              memberships: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['groupId', 'role', 'status', 'joinedAt', 'group'],
                  properties: {
                    groupId: { type: 'string', format: 'uuid' },
                    role: { type: 'string' },
                    status: { type: 'string' },
                    joinedAt: { type: 'string' },
                    group: {
                      type: 'object',
                      required: ['id', 'name', 'description', 'isPrivate'],
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        isPrivate: { type: 'boolean' },
                        allowMemberChallenges: { type: 'boolean' },
                        coverId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                        tagline: { type: 'string' },
                        location: { type: 'string' },
                        focusTags: { type: 'array', items: { type: 'string' } },
                        goals: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request): Promise<MyMembershipsResponse> => {
      const member = authenticatedMember(request);
      const pendingMemberships = await listPendingMembershipsForMember(db, member.memberId);
      return {
        memberId: member.memberId,
        memberships: await listMembershipsForMember(db, member.memberId),
        ...(pendingMemberships.length > 0 ? { pendingMemberships } : {}),
      };
    },
  );
}
