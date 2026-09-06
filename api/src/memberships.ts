import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';

export interface ApiMembershipGroup {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
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
}

export async function listMembershipsForMember(db: Db, memberId: string): Promise<ApiMembership[]> {
  const result = await db.query<MembershipRow>(
    `SELECT m.group_id, m.role, m.status, m.joined_at,
            g.name AS group_name, g.description AS group_description,
            g.is_private AS group_is_private
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
