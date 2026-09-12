/**
 * EBC-01 governed Group mutation routes — the trusted server-side boundary
 * for V2 Group mutations.
 *
 * - POST /v1/groups — governed Group creation;
 * - POST /v1/groups/:groupId/join — governed membership join/add;
 * - POST /v1/groups/:groupId/leave — governed membership leave/withdraw.
 *
 * Identity discipline (fail closed): the global /v1/ auth hook resolves the
 * Bearer token to an internal Member UUID server-side; these routes resolve
 * the Firebase UID from the members table (same mapping the read authority
 * uses) and NEVER accept actor/member identity from the client — request
 * bodies carry governing terms only (additionalProperties:false rejects
 * smuggled ownerId/userId/member fields with 400). Without a configured
 * store, every route fails closed (503) rather than authorizing.
 *
 * No Firebase imports here (routes + injected store only).
 */

import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import {
  createGovernedGroup,
  joinGovernedGroup,
  leaveGovernedGroup,
  GroupMutationError,
  type CreateGroupTerms,
  type GroupMutationActor,
  type GroupMutationStore,
} from './groupMutations.js';

export interface GroupMutationRouteDeps {
  store?: GroupMutationStore;
}

/**
 * Route-local body validators (same pattern as challengeActivityRoutes:
 * the runtime's default validator strips unknown JSON properties instead
 * of rejecting them, which would silently absorb forged identity fields).
 * These reject unknown/server-derived fields with a 400 before the handler
 * runs; the JSON schemas remain the documented contract. In particular,
 * actor/member identity can never be smuggled in — identity resolves
 * server-side from the Bearer token only.
 */
const ALLOWED_CREATE_FIELDS = new Set([
  'name',
  'description',
  'coverImageUrl',
  'isPrivate',
  'requireAdminApproval',
  'allowMemberChallenges',
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ValidatorResult = boolean | { error: Error };

/**
 * Fastify honors a custom validator's failure only through a thrown-free
 * `{ error }` result (a bare `false` without `.errors` passes silently —
 * verified against the installed Fastify). Every custom check below goes
 * through this wrapper so rejections always surface as 400s.
 */
function toValidator(check: (data: unknown) => string | null): (data: unknown) => ValidatorResult {
  return (data: unknown) => {
    const reason = check(data);
    return reason === null ? true : { error: new Error(reason) };
  };
}

function checkCreateBody(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return 'request body must be an object';
  const body = data as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!ALLOWED_CREATE_FIELDS.has(key)) {
      return `field '${key}' is server-derived and must not be supplied by the client`;
    }
  }
  if (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 200) {
    return 'name is required (1..200 chars)';
  }
  if (body.description !== undefined
    && (typeof body.description !== 'string' || body.description.length > 2000)) {
    return 'description must be a string up to 2000 chars when present';
  }
  if (body.coverImageUrl !== undefined
    && (typeof body.coverImageUrl !== 'string'
      || body.coverImageUrl.length < 1 || body.coverImageUrl.length > 2000)) {
    return 'coverImageUrl must be 1..2000 chars when present';
  }
  for (const field of ['isPrivate', 'requireAdminApproval', 'allowMemberChallenges'] as const) {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      return `${field} must be boolean when present`;
    }
  }
  return null;
}

function checkEmptyBody(data: unknown): string | null {
  if (data === undefined) return null;
  if (typeof data !== 'object' || data === null) return 'request body must be an object';
  return Object.keys(data as Record<string, unknown>).length === 0
    ? null
    : 'request body must be empty (identity resolves server-side)';
}

function checkGroupParams(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return 'route params are required';
  return UUID_RE.test(String((data as Record<string, unknown>).groupId ?? ''))
    ? null
    : 'groupId must be a Tiizi group UUID';
}

export function groupMutationCreateValidatorCompiler({ httpPart }: { httpPart?: string }) {
  // The create route carries no params; only the body is custom-validated.
  if (httpPart === 'body') return toValidator(checkCreateBody);
  return () => true;
}

export function groupMutationEmptyValidatorCompiler({ httpPart }: { httpPart?: string }) {
  if (httpPart === 'body') return toValidator(checkEmptyBody);
  if (httpPart === 'params') return toValidator(checkGroupParams);
  return () => true;
}

function missingStore(): GroupMutationStore {
  const unavailable = (): never => {
    throw new GroupMutationError(
      503,
      'group_store_unavailable',
      'Group mutation authority is not configured',
    );
  };
  return {
    createGroupWithOwner: unavailable,
    getGroup: unavailable,
    updateGroupCounter: unavailable,
    getMembership: unavailable,
    setMembership: unavailable,
    updateMembership: unavailable,
  };
}

/**
 * Resolve the actor's Firebase UID server-side from the authenticated
 * member UUID. Fails closed when the member has no Firebase link (the
 * mapping the authority reads would be missing too).
 */
async function resolveActor(db: Db, memberId: string): Promise<GroupMutationActor> {
  const result = await db.query<{ auth_subject: string | null }>(
    `SELECT auth_subject FROM members WHERE member_id = $1 AND auth_provider = 'firebase'`,
    [memberId],
  );
  const firebaseUid = result.rows[0]?.auth_subject ?? null;
  if (!firebaseUid) {
    throw new GroupMutationError(
      401,
      'unknown_member',
      'Authenticated identity is not linked to a Firebase subject',
    );
  }
  return { memberId, firebaseUid };
}

const groupIdParamsSchema = {
  type: 'object',
  required: ['groupId'],
  properties: { groupId: { type: 'string', format: 'uuid' } },
} as const;

const createGroupBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 2000 },
    coverImageUrl: { type: 'string', minLength: 1, maxLength: 2000 },
    isPrivate: { type: 'boolean' },
    requireAdminApproval: { type: 'boolean' },
    allowMemberChallenges: { type: 'boolean' },
  },
} as const;

const emptyBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
} as const;

export function registerGroupMutationRoutes(
  app: FastifyInstance,
  db: Db,
  deps: GroupMutationRouteDeps = {},
): void {
  const store = deps.store ?? missingStore();

  app.post(
    '/v1/groups',
    {
      validatorCompiler: groupMutationCreateValidatorCompiler,
      schema: {
        body: createGroupBodySchema,
        response: {
          201: {
            type: 'object',
            required: ['id', 'legacyId', 'name', 'isPrivate', 'role', 'status'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              legacyId: { type: 'string' },
              name: { type: 'string' },
              isPrivate: { type: 'boolean' },
              role: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const member = authenticatedMember(request);
      const actor = await resolveActor(db, member.memberId);
      const result = await createGovernedGroup(
        db,
        store,
        actor,
        (request.body ?? {}) as CreateGroupTerms,
      );
      return reply.status(201).send(result);
    },
  );

  app.post(
    '/v1/groups/:groupId/join',
    {
      validatorCompiler: groupMutationEmptyValidatorCompiler,
      schema: {
        params: groupIdParamsSchema,
        body: emptyBodySchema,
        response: {
          200: {
            type: 'object',
            required: ['id', 'legacyId', 'status', 'role'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              legacyId: { type: 'string' },
              status: { type: 'string', enum: ['joined', 'pending'] },
              role: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      const member = authenticatedMember(request);
      const actor = await resolveActor(db, member.memberId);
      const params = request.params as { groupId: string };
      return joinGovernedGroup(db, store, actor, params.groupId);
    },
  );

  app.post(
    '/v1/groups/:groupId/leave',
    {
      validatorCompiler: groupMutationEmptyValidatorCompiler,
      schema: {
        params: groupIdParamsSchema,
        body: emptyBodySchema,
        response: {
          200: {
            type: 'object',
            required: ['id', 'legacyId', 'status'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              legacyId: { type: 'string' },
              status: { type: 'string', enum: ['left', 'none'] },
            },
          },
        },
      },
    },
    async (request) => {
      const member = authenticatedMember(request);
      const actor = await resolveActor(db, member.memberId);
      const params = request.params as { groupId: string };
      return leaveGovernedGroup(db, store, actor, params.groupId);
    },
  );
}
