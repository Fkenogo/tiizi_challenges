/**
 * TIIZI S4a — governed Group detail read.
 *
 * GET /v1/groups/:groupId — canonical Group truth for Group Home. The ONLY
 * Group detail source; there is no second detail path and no client-derived
 * Group state.
 *
 * Authority order (never inverted):
 * 1. PostgreSQL maps the Tiizi Group UUID to the transitional Firestore
 *    lookup key (`groups.legacy_firestore_id`). The shadow NEVER authorizes
 *    and NEVER supplies governed settings — it is a lookup key only.
 * 2. The live Firestore Group document (through the injected store, the
 *    same seam the governed mutations write through) supplies existence,
 *    liveness (`isGroupDocActive`), governed settings, the member counter,
 *    and the owner attribution. Unknown/inactive groups fail closed as 404
 *    (existence is not leaked); store outages fail closed as 503.
 * 3. The viewer's Firebase UID resolves server-side from the members table
 *    (the same mapping the mutation boundary uses); client identity is
 *    never accepted. The viewer relationship (steward/member/pending/none)
 *    is computed server-side, never declared by the client.
 * 4. The singular Accountable Steward resolves server-side from the live
 *    `ownerId` attribution through the members mapping. An unresolvable or
 *    absent attribution yields a null steward — never a client-supplied or
 *    guessed steward, and never plural stewards.
 *
 * Visibility (EOG-E1-01 §§8/30; FR-V2-016/017/019/020; CIC 4.27): members
 * (active/joined, steward included) receive the full projection; anyone
 * else receives ONLY the authenticated-discoverable subset of a
 * discoverable (non-private) Group; private Groups are invisible to
 * non-active-memberships (404, indistinguishable from unknown). Discovery
 * never creates membership (FR-V2-021).
 *
 * Provider-neutral: pure domain + `Db` + injected store reads. No Firebase
 * here (routes + injected store only).
 */

import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import { isGroupDocActive } from './firestoreGroupAuthority.js';
import {
  groupMutationEmptyValidatorCompiler,
  type GroupMutationRouteDeps,
} from './groupMutationRoutes.js';
import { GroupMutationError, type GroupMutationStore } from './groupMutations.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read-side store surface: the two live reads Group Home needs. The
 * governed `GroupMutationStore` satisfies this structurally, so reads and
 * mutations share the single authority seam — no second store exists.
 */
export type GroupReadStore = Pick<GroupMutationStore, 'getGroup' | 'getMembership'>;

export interface GroupReadRouteDeps {
  store?: GroupReadStore;
}

/**
 * Store outage mapping (same contract as the mutation boundary): any store
 * failure fails closed as 503 "authority unavailable" — never as an
 * authorization, and never with provider internals. Domain errors already
 * carry their own GroupMutationError and pass through untouched.
 */
async function storeCall<T>(action: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof GroupMutationError) throw error;
    throw new GroupMutationError(
      503,
      'group_store_unavailable',
      `Group store unavailable during ${action} (${(error as Error).message})`,
    );
  }
}

function readFail(statusCode: number, code: string, message: string): never {
  throw new GroupMutationError(statusCode, code, message);
}

function missingStore(): GroupReadStore {
  const unavailable = (): never => {
    throw new GroupMutationError(
      503,
      'group_store_unavailable',
      'Group read authority is not configured',
    );
  };
  return { getGroup: unavailable, getMembership: unavailable };
}

export type ViewerRelationship = 'steward' | 'member' | 'pending' | 'none';

export interface ApiGroupSteward {
  memberId: string;
}

export interface ApiViewerMembership {
  status: string;
  role: string;
}

export interface ApiGroupDetail {
  /** Authoritative Tiizi Group UUID. */
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  /**
   * Governed settings. Present on the full (member) projection; null on the
   * discoverable subset, which must not leak group internals.
   */
  requireAdminApproval: boolean | null;
  allowMemberChallenges: boolean | null;
  /** Live-authority member counter; null when the live document carries none. */
  memberCount: number | null;
  /** Singular Accountable Steward, server-resolved; null when unattributable. */
  steward: ApiGroupSteward | null;
  viewerMembership: ApiViewerMembership | null;
  /** Server-derived viewer relationship — never client-declared. */
  viewerRelationship: ViewerRelationship;
  createdAt: string | null;
}

/** Server-side viewer identity (never client-supplied; null when unlinkable). */
async function resolveViewerUid(db: Db, memberId: string): Promise<string | null> {
  const result = await db.query<{ auth_subject: string | null }>(
    `SELECT auth_subject FROM members WHERE member_id = $1 AND auth_provider = 'firebase'`,
    [memberId],
  );
  return result.rows[0]?.auth_subject ?? null;
}

/** Server-side steward attribution (live ownerId → member UUID; null when orphaned). */
async function resolveStewardMemberId(db: Db, ownerUid: string): Promise<string | null> {
  const result = await db.query<{ member_id: string }>(
    `SELECT member_id FROM members WHERE auth_provider = 'firebase' AND auth_subject = $1`,
    [ownerUid],
  );
  const memberId = result.rows[0]?.member_id;
  return memberId === undefined ? null : String(memberId);
}

/**
 * Canonical Group detail. Pure domain over `Db` + the injected live store;
 * the route below only supplies transport.
 */
export async function getGroupDetail(
  db: Db,
  store: GroupReadStore,
  memberId: string,
  groupId: string,
): Promise<ApiGroupDetail> {
  if (!UUID_RE.test(groupId)) {
    readFail(400, 'invalid_group', 'groupId must be a Tiizi group UUID');
  }
  // Lookup key only: the shadow maps identity, never authority or settings.
  const shadow = await db.query<{
    legacy_firestore_id: string | null;
  }>(`SELECT legacy_firestore_id FROM groups WHERE group_id = $1`, [groupId]);
  const legacyId = shadow.rows[0]?.legacy_firestore_id ?? null;
  if (!legacyId) readFail(404, 'unknown_group', 'Group not found');
  // Live authority decides existence and liveness; outages fail closed.
  const group = await storeCall('group read', () => store.getGroup(legacyId));
  if (!group || !isGroupDocActive(group)) {
    readFail(404, 'unknown_group', 'Group not found');
  }
  const live = group!;
  const viewerUid = await resolveViewerUid(db, memberId);
  const membership = viewerUid
    ? await storeCall('membership read', () => store.getMembership(legacyId, viewerUid))
    : null;
  const membershipStatus =
    typeof membership?.status === 'string' ? String(membership.status).toLowerCase() : null;
  const membershipRole =
    typeof membership?.role === 'string' && membership.role ? String(membership.role) : 'member';
  const ownerId = typeof live.ownerId === 'string' ? live.ownerId : null;
  const isSteward = viewerUid !== null && ownerId !== null && viewerUid === ownerId;
  const relationship: ViewerRelationship = isSteward
    ? 'steward'
    : membershipStatus === 'active' || membershipStatus === 'joined'
      ? 'member'
      : membershipStatus === 'pending'
        ? 'pending'
        : 'none';
  const isPrivate = live.isPrivate === true;
  const name = typeof live.name === 'string' ? live.name : '';
  const description = typeof live.description === 'string' ? live.description : '';
  const memberCount = typeof live.memberCount === 'number' && Number.isFinite(live.memberCount)
    ? live.memberCount
    : null;
  if (relationship === 'none' || relationship === 'pending') {
    // Private Groups are invisible outside active membership: 404,
    // indistinguishable from unknown — no existence or state leak.
    if (isPrivate) readFail(404, 'unknown_group', 'Group not found');
    // Authenticated-discoverable subset only (EOG §8; FR-V2-019/020): no
    // governed settings, no steward attribution, no internals.
    return {
      id: groupId,
      name,
      description,
      isPrivate: false,
      requireAdminApproval: null,
      allowMemberChallenges: null,
      memberCount,
      steward: null,
      viewerMembership:
        relationship === 'pending' ? { status: 'pending', role: membershipRole } : null,
      viewerRelationship: relationship,
      createdAt: null,
    };
  }
  // Full member projection. Absent flags fall back to the governed defaults
  // the creation authority applies (open admission, permitted creation).
  const stewardMemberId = ownerId ? await resolveStewardMemberId(db, ownerId) : null;
  return {
    id: groupId,
    name,
    description,
    isPrivate,
    requireAdminApproval: live.requireAdminApproval === true,
    allowMemberChallenges: live.allowMemberChallenges !== false,
    memberCount,
    steward: stewardMemberId ? { memberId: stewardMemberId } : null,
    viewerMembership: { status: membershipStatus ?? 'active', role: membershipRole },
    viewerRelationship: relationship,
    createdAt: typeof live.createdAt === 'string' ? live.createdAt : null,
  };
}

const groupIdParamsSchema = {
  type: 'object',
  required: ['groupId'],
  properties: { groupId: { type: 'string', format: 'uuid' } },
} as const;

const groupDetailResponseSchema = {
  type: 'object',
  required: ['id', 'name', 'isPrivate', 'viewerRelationship'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    description: { type: 'string' },
    isPrivate: { type: 'boolean' },
    requireAdminApproval: { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
    allowMemberChallenges: { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
    memberCount: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    steward: {
      anyOf: [
        {
          type: 'object',
          required: ['memberId'],
          properties: { memberId: { type: 'string', format: 'uuid' } },
        },
        { type: 'null' },
      ],
    },
    viewerMembership: {
      anyOf: [
        {
          type: 'object',
          required: ['status', 'role'],
          properties: { status: { type: 'string' }, role: { type: 'string' } },
        },
        { type: 'null' },
      ],
    },
    viewerRelationship: { type: 'string', enum: ['steward', 'member', 'pending', 'none'] },
    createdAt: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
} as const;

export function registerGroupReadRoutes(
  app: FastifyInstance,
  db: Db,
  deps: GroupReadRouteDeps = {},
): void {
  const store = deps.store ?? missingStore();

  app.get(
    '/v1/groups/:groupId',
    {
      // Same hardened param/body validation as the mutation boundary: the
      // runtime's default validator strips unknown properties instead of
      // rejecting them, so identity smuggling must be rejected explicitly.
      validatorCompiler: groupMutationEmptyValidatorCompiler,
      schema: { params: groupIdParamsSchema, response: { 200: groupDetailResponseSchema } },
    },
    async (request) => {
      const member = authenticatedMember(request);
      const params = request.params as { groupId: string };
      return getGroupDetail(db, store, member.memberId, params.groupId);
    },
  );
}

/** Compatibility: the read routes share the mutation boundary's store seam. */
export function groupReadDepsFromMutations(deps: GroupMutationRouteDeps = {}): GroupReadRouteDeps {
  return { store: deps.store };
}
