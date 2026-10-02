/**
 * EBC-01 governed Group mutation routes — the trusted server-side boundary
 * for V2 Group mutations.
 *
 * - POST /api/groups — governed Group creation;
 * - POST /api/groups/:groupId/join — governed membership join/add;
 * - POST /api/groups/:groupId/leave — governed membership leave/withdraw.
 *
 * Identity discipline (fail closed): the global /api/ auth hook resolves the
 * Bearer token to an internal Member UUID server-side; these routes resolve
 * the Firebase subject through `members` and NEVER accept actor/member
 * identity from the client. Request bodies carry governing terms only
 * (`additionalProperties:false` rejects smuggled identity fields). Writes
 * go directly to the PostgreSQL authority transaction functions below.
 *
 * No Firestore or Firebase imports here.
 */

import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import {
  type CreateGroupTerms,
  type GroupMutationActor,
  type GroupMutationStore,
} from './groupMutations.js';
import { GroupMutationError } from './groupErrors.js';
import { resolveGroupInvite } from './groupDiscovery.js';
import { createGovernedGroup, joinGovernedGroup, leaveGovernedGroup, reviewPendingMembership, updateGovernedGroupSettings } from './postgresGroupAuthority.js';
import { GROUP_COMMUNITY_NORMS, GROUP_FOCUS_AREAS, GROUP_GOALS } from './groupVocabulary.js';

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
  // S4a CORR-001 richer identity (presentation-level; validated fail-closed).
  'coverId',
  'tagline',
  'location',
  'focusTags',
  'rules',
  'goalIds', 'customGoal', 'communityNormIds', 'customCommunityNorm',
]);

const ALLOWED_SETTINGS_FIELDS = new Set(['name','description','tagline','location','focusTags','coverId','isPrivate','requireAdminApproval','allowMemberChallenges']);

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
  if (body.coverId !== undefined && typeof body.coverId !== 'string') {
    return 'coverId must be a catalogue key when present';
  }
  for (const field of ['tagline', 'location'] as const) {
    if (body[field] !== undefined && typeof body[field] !== 'string') {
      return `${field} must be a string when present`;
    }
  }
  for (const field of ['focusTags', 'rules', 'goalIds', 'communityNormIds'] as const) {
    if (body[field] !== undefined && !Array.isArray(body[field])) {
      return `${field} must be an array of strings when present`;
    }
  }
  for (const field of ['customGoal', 'customCommunityNorm'] as const) {
    if (body[field] !== undefined && typeof body[field] !== 'string') return `${field} must be a string when present`;
  }
  if (body.focusTags !== undefined && Array.isArray(body.focusTags)) {
    const standard = new Set<string>(GROUP_FOCUS_AREAS.map((entry) => entry.label));
    const tags = body.focusTags as unknown[];
    if (tags.some((tag) => typeof tag !== 'string' || tag.length > 30)) return 'focusTags must be labels of at most 30 characters';
    if (tags.filter((tag) => standard.has(tag as string)).length !== new Set(tags.filter((tag) => standard.has(tag as string))).size) return 'focusTags must not contain duplicates';
    if (tags.filter((tag) => !standard.has(tag as string)).length > 1) return 'only one custom focus area is allowed';
  }
  for (const [field, catalogue] of [['goalIds', GROUP_GOALS], ['communityNormIds', GROUP_COMMUNITY_NORMS]] as const) {
    if (body[field] !== undefined && Array.isArray(body[field])) {
      const allowed = new Set<string>(catalogue.map((entry) => entry.id));
      const ids = body[field] as unknown[];
      if (ids.some((id) => typeof id !== 'string' || !allowed.has(id))) return `${field} contains an unknown catalogue ID`;
      if (new Set(ids).size !== ids.length) return `${field} must not contain duplicates`;
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

function checkApplicationParams(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return 'route params are required';
  const params = data as Record<string, unknown>;
  return UUID_RE.test(String(params.groupId ?? '')) && UUID_RE.test(String(params.memberId ?? ''))
    ? null
    : 'groupId and memberId must be Tiizi UUIDs';
}

function checkInviteBody(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return 'request body must be an object';
  const body = data as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== 'code')) return 'request body may contain only code';
  if (typeof body.code !== 'string' || body.code.length < 1 || body.code.length > 64) return 'code is required';
  return null;
}

export function groupMutationCreateValidatorCompiler({ httpPart }: { httpPart?: string }) {
  // The create route carries no params; only the body is custom-validated.
  if (httpPart === 'body') return toValidator(checkCreateBody);
  return () => true;
}

function checkSettingsBody(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'request body must be an object';
  const body = data as Record<string, unknown>;
  const keys = Object.keys(body);
  if (!keys.length) return 'settings patch must not be empty';
  for (const key of keys) if (!ALLOWED_SETTINGS_FIELDS.has(key)) return `field '${key}' is not editable`;
  return null;
}

export function groupMutationSettingsValidatorCompiler({ httpPart }: { httpPart?: string }) {
  if (httpPart === 'body') return toValidator(checkSettingsBody);
  if (httpPart === 'params') return toValidator(checkGroupParams);
  return () => true;
}

export function groupMutationEmptyValidatorCompiler({ httpPart }: { httpPart?: string }) {
  if (httpPart === 'body') return toValidator(checkEmptyBody);
  if (httpPart === 'params') return toValidator(checkGroupParams);
  return () => true;
}

export function groupInviteBodyValidatorCompiler({ httpPart }: { httpPart?: string }) {
  if (httpPart === 'body') return toValidator(checkInviteBody);
  return () => true;
}

export function groupApplicationValidatorCompiler({ httpPart }: { httpPart?: string }) {
  if (httpPart === 'body') return toValidator(checkEmptyBody);
  if (httpPart === 'params') return toValidator(checkApplicationParams);
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
    listMemberships: unavailable,
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
    coverId: { type: 'string', minLength: 1, maxLength: 32 },
    tagline: { type: 'string', maxLength: 140 },
    location: { type: 'string', maxLength: 120 },
    focusTags: { type: 'array', maxItems: 13, items: { type: 'string', maxLength: 30 } },
    rules: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 200 } },
    goalIds: { type: 'array', maxItems: 9, items: { type: 'string', maxLength: 40 } },
    customGoal: { type: 'string', maxLength: 80 },
    communityNormIds: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 40 } },
    customCommunityNorm: { type: 'string', maxLength: 200 },
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
  void deps;

  app.patch('/api/groups/:groupId', {
    validatorCompiler: groupMutationSettingsValidatorCompiler,
    schema: { params: groupIdParamsSchema, body: { type: 'object', additionalProperties: false } },
  }, async (request) => {
    const member = authenticatedMember(request);
    const { groupId } = request.params as { groupId: string };
    return updateGovernedGroupSettings(db, member.memberId, groupId, request.body as Record<string, unknown>);
  });

  app.post('/api/groups/resolve-invite', {
    validatorCompiler: groupInviteBodyValidatorCompiler,
    schema: {
      body: { type: 'object', additionalProperties: false, required: ['code'], properties: { code: { type: 'string', minLength: 1, maxLength: 64 } } },
    },
  }, async (request) => {
    const member = authenticatedMember(request);
    try {
      return await resolveGroupInvite(db, member.memberId, (request.body as { code: string }).code);
    } catch (error) {
      if (error instanceof GroupMutationError) throw error;
      throw new GroupMutationError(503, 'group_store_unavailable', 'PostgreSQL invite lookup unavailable');
    }
  });

  for (const decision of ['approve', 'reject'] as const) {
    app.post(`/api/groups/:groupId/applications/:memberId/${decision}`, {
      validatorCompiler: groupApplicationValidatorCompiler,
      schema: {
        params: { type: 'object', required: ['groupId', 'memberId'], properties: { groupId: { type: 'string', format: 'uuid' }, memberId: { type: 'string', format: 'uuid' } } },
        body: emptyBodySchema,
      },
    }, async (request) => {
      const actor = authenticatedMember(request);
      const params = request.params as { groupId: string; memberId: string };
      return reviewPendingMembership(db, actor.memberId, params.groupId, params.memberId, decision);
    });
  }

  app.post(
    '/api/groups',
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
        actor,
        (request.body ?? {}) as CreateGroupTerms,
      );
      return reply.status(201).send(result);
    },
  );

  app.post(
    '/api/groups/:groupId/join',
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
      return joinGovernedGroup(db, actor, params.groupId);
    },
  );

  app.post(
    '/api/groups/:groupId/leave',
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
      return leaveGovernedGroup(db, actor, params.groupId);
    },
  );
}
