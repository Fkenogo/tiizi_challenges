import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';

export interface ApiMembershipGroup {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  /** S4a CORR-001 richer identity (shadow mirror of live truth, read-model only). */
  coverId: string | null;
  tagline: string;
  location: string;
  focusTags: string[];
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
}

interface MembershipRow {
  group_id: string;
  role: string;
  status: string;
  joined_at: string;
  group_name: string;
  group_description: string;
  group_is_private: boolean;
  group_cover_id: string | null;
  group_tagline: string | null;
  group_location: string | null;
  group_focus_tags: unknown;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((t): t is string => typeof t === 'string') : [];
}

export async function listMembershipsForMember(db: Db, memberId: string): Promise<ApiMembership[]> {
  const result = await db.query<MembershipRow>(
    `SELECT m.group_id, m.role, m.status, m.joined_at,
            g.name AS group_name, g.description AS group_description,
            g.is_private AS group_is_private,
            g.cover_id AS group_cover_id, g.tagline AS group_tagline,
            g.location AS group_location, g.focus_tags AS group_focus_tags
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
      coverId: typeof row.group_cover_id === 'string' ? row.group_cover_id : null,
      tagline: typeof row.group_tagline === 'string' ? row.group_tagline : '',
      location: typeof row.group_location === 'string' ? row.group_location : '',
      focusTags: toStringArray(row.group_focus_tags),
    },
  }));
}

export function registerMembershipRoutes(app: FastifyInstance, db: Db): void {
  app.get(
    '/v1/memberships/me',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            required: ['memberId', 'memberships'],
            properties: {
              memberId: { type: 'string', format: 'uuid' },
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
                        coverId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                        tagline: { type: 'string' },
                        location: { type: 'string' },
                        focusTags: { type: 'array', items: { type: 'string' } },
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
      return {
        memberId: member.memberId,
        memberships: await listMembershipsForMember(db, member.memberId),
      };
    },
  );
}
