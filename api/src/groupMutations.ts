/**
 * EBC-01 governed Group / Membership mutation boundary (domain).
 *
 * The approved authority model keeps Firestore authoritative for Group
 * existence, lifecycle, and live Membership eligibility. The only ordinary
 * mutation path was direct client Firestore writes (non-atomic
 * create+owner-membership, permissive self-update rules) — a material
 * cross-boundary engine leak. This module is the trusted server-side
 * boundary for the V2 Group mutations required by the current product
 * foundation:
 *
 * - Group creation (group document + atomic owner membership);
 * - membership join/add where currently product-authorized
 *   (public → active, private/approval → pending, existing-doc transitions);
 * - membership leave/withdraw where currently product-authorized
 *   (non-owner active membership → left; owner cannot leave).
 *
 * Semantics mirror the existing product behavior exactly
 * (src/services/groupService.ts + buildGroupDefaults): no new roles, no new
 * governance, no invitation semantics, no discovery/stewardship/Charter
 * behavior. Invite approval flows stay in the existing server callables;
 * group edits are out of scope (not needed by the V2 Challenge flow).
 *
 * Requirements honored:
 * - the authenticated actor (internal Member UUID + Firebase UID) is
 *   resolved server-side by the route and passed in; client-supplied
 *   identity is never accepted (no actor fields exist on this seam);
 * - Firestore remains the authoritative Group/membership source: every
 *   mutation writes Firestore FIRST through the injected GroupMutationStore;
 * - the PG shadow (groups / group_memberships) is synchronized only as the
 *   relational anchor these operations need (FK targets, discovery
 *   read-model). It is written AFTER the authoritative Firestore write and
 *   is never read for authorization here;
 * - ordering rationale: if the PG sync fails after the Firestore commit,
 *   live authority still answers correctly (reads never consult the
 *   shadow) and the existing shadow importer backfills. No operation is
 *   ever falsely authorized: a missing/inactive group or a failed store
 *   rejects before anything persists;
 * - behavior is deterministic and testable: transition decisions are pure
 *   functions; the store is injected (Admin SDK in production, fake in
 *   tests). No distributed transaction is attempted.
 *
 * Provider-neutral: pure domain + `Db` + injected store. No Firebase here.
 */

import type { Db } from './db.js';
import { isGroupDocActive } from './firestoreGroupAuthority.js';

export class GroupMutationError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function fail(statusCode: number, code: string, message: string): never {
  throw new GroupMutationError(statusCode, code, message);
}

/**
 * Store outage mapping: any GroupMutationStore failure (Firestore
 * unreachable, permission denied, transient error) fails closed as 503
 * "authority unavailable" — never as an authorization, and never with
 * provider internals. Domain validation errors already carry their own
 * GroupMutationError and pass through untouched.
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

/** Authenticated actor, resolved server-side (never client-supplied). */
export interface GroupMutationActor {
  memberId: string;
  firebaseUid: string;
}

/**
 * Provider seam for governed Group writes. Production uses the Firebase
 * Admin SDK (firestoreGroupMutationStore.ts); tests inject a fake. Only
 * the governed transitions below may write through it.
 */
export interface GroupMutationStore {
  /**
   * Atomically create a group document WITH its owner membership document
   * (one batched write — the owner relation can never split). Returns the
   * new Firestore group document id.
   */
  createGroupWithOwner(
    group: Record<string, unknown>,
    ownerUid: string,
    ownerMembership: Record<string, unknown>,
  ): Promise<string>;
  /** Read a group document; null when missing. */
  getGroup(legacyId: string): Promise<Record<string, unknown> | null>;
  /** Adjust the denormalized member counter by delta. */
  updateGroupCounter(legacyId: string, delta: number): Promise<void>;
  /** Read a membership document; null when missing. */
  getMembership(legacyId: string, firebaseUid: string): Promise<Record<string, unknown> | null>;
  /** Full-overwrite a membership document (creates). */
  setMembership(legacyId: string, firebaseUid: string, data: Record<string, unknown>): Promise<void>;
  /** Partial-update a membership document (must exist). */
  updateMembership(legacyId: string, firebaseUid: string, patch: Record<string, unknown>): Promise<void>;
}

export interface CreateGroupTerms {
  name: unknown;
  description?: unknown;
  coverImageUrl?: unknown;
  isPrivate?: unknown;
  requireAdminApproval?: unknown;
  allowMemberChallenges?: unknown;
}

export interface GovernedGroupResult {
  /** Authoritative Tiizi group UUID (`groups.group_id`). */
  id: string;
  /** Transitional Firestore document id (lookup key only). */
  legacyId: string;
  name: string;
  isPrivate: boolean;
  role: string;
  status: string;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeInviteCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 12);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function validateCreateTerms(terms: CreateGroupTerms): {
  name: string;
  description: string;
  coverImageUrl: string | undefined;
  isPrivate: boolean;
  requireAdminApproval: boolean;
  allowMemberChallenges: boolean;
} {
  if (typeof terms.name !== 'string' || terms.name.trim().length < 1 || terms.name.length > 200) {
    fail(400, 'invalid_group', 'name is required (1..200 chars)');
  }
  if (terms.description !== undefined
    && (typeof terms.description !== 'string' || terms.description.length > 2000)) {
    fail(400, 'invalid_group', 'description must be a string up to 2000 chars when present');
  }
  if (terms.coverImageUrl !== undefined
    && (typeof terms.coverImageUrl !== 'string'
      || terms.coverImageUrl.length === 0 || terms.coverImageUrl.length > 2000)) {
    fail(400, 'invalid_group', 'coverImageUrl must be 1..2000 chars when present');
  }
  for (const field of ['isPrivate', 'requireAdminApproval', 'allowMemberChallenges'] as const) {
    if (terms[field] !== undefined && typeof terms[field] !== 'boolean') {
      fail(400, 'invalid_group', `${field} must be boolean when present`);
    }
  }
  return {
    name: terms.name.trim(),
    description: typeof terms.description === 'string' ? terms.description : '',
    coverImageUrl: typeof terms.coverImageUrl === 'string' ? terms.coverImageUrl : undefined,
    isPrivate: asBoolean(terms.isPrivate),
    requireAdminApproval: asBoolean(terms.requireAdminApproval),
    allowMemberChallenges: terms.allowMemberChallenges === undefined
      ? true
      : asBoolean(terms.allowMemberChallenges),
  };
}

/**
 * Canonical governed group document — the same field set the product
 * writes today (buildGroupDefaults), produced server-side. The actor's
 * Firebase UID is the owner; nothing about identity comes from the client.
 */
export function buildGovernedGroupDocument(
  terms: ReturnType<typeof validateCreateTerms>,
  ownerUid: string,
): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    name: terms.name,
    description: terms.description,
    ownerId: ownerUid,
    ...(terms.coverImageUrl !== undefined && { coverImageUrl: terms.coverImageUrl }),
    isPrivate: terms.isPrivate,
    requireAdminApproval: terms.requireAdminApproval,
    allowMemberChallenges: terms.allowMemberChallenges,
    inviteCode: `${normalizeInviteCode(terms.name) || 'GROUP'}-${randomSuffix()}`,
    memberCount: 1,
    activeChallenges: 0,
    createdAt: now,
    status: 'active',
    moderationStatus: 'active',
    visibility: terms.isPrivate ? 'private' : 'public',
    isFeatured: false,
    isVerified: false,
    reviewStatus: 'pending',
  };
}

/** Relational anchor sync: upsert the PG shadow row for a legacy group. */
async function upsertGroupShadow(
  db: Db,
  legacyId: string,
  fields: { name: string; description: string; isPrivate: boolean; active: boolean },
): Promise<string> {
  const result = await db.query<{ group_id: string }>(
    `INSERT INTO groups (legacy_firestore_id, name, description, is_private, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (legacy_firestore_id)
     DO UPDATE SET name = EXCLUDED.name,
                   description = EXCLUDED.description,
                   is_private = EXCLUDED.is_private,
                   status = EXCLUDED.status,
                   updated_at = now()
     RETURNING group_id`,
    [legacyId, fields.name, fields.description, fields.isPrivate, fields.active ? 'active' : 'inactive'],
  );
  const row = result.rows[0];
  if (!row) fail(500, 'shadow_sync_failed', 'Group shadow synchronization failed');
  return String(row.group_id);
}

/** Relational anchor sync: mirror the LIVE membership row into the shadow. */
async function upsertMembershipShadow(
  db: Db,
  groupId: string,
  memberId: string,
  live: { role: string; status: string },
): Promise<void> {
  const role = live.role === 'owner' || live.role === 'admin' ? live.role : 'member';
  const status = live.status;
  if (!['joined', 'active', 'pending', 'rejected', 'left'].includes(status)) {
    fail(500, 'shadow_sync_failed', `Membership shadow synchronization failed (status '${status}')`);
  }
  await db.query(
    `INSERT INTO group_memberships (group_id, member_id, role, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (group_id, member_id)
     DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, updated_at = now()`,
    [groupId, memberId, role, status],
  );
}

/**
 * Governed Group creation: one server-side operation atomically writes the
 * group document WITH the owner membership (single batched store call —
 * the owner relation can never split), then anchors the PG shadow. Any
 * store failure rejects with nothing persisted and no shadow row.
 */
export async function createGovernedGroup(
  db: Db,
  store: GroupMutationStore,
  actor: GroupMutationActor,
  terms: CreateGroupTerms,
): Promise<GovernedGroupResult> {
  const valid = validateCreateTerms(terms);
  const now = new Date().toISOString();
  const legacyId = await storeCall('group creation', () => store.createGroupWithOwner(
    buildGovernedGroupDocument(valid, actor.firebaseUid),
    actor.firebaseUid,
    {
      // groupId is stamped by the store once the document id is known.
      userId: actor.firebaseUid,
      role: 'owner',
      status: 'active',
      createdAt: now,
      approvedAt: now,
    },
  ));
  const id = await upsertGroupShadow(db, legacyId, {
    name: valid.name,
    description: valid.description,
    isPrivate: valid.isPrivate,
    active: true,
  });
  await upsertMembershipShadow(db, id, actor.memberId, { role: 'owner', status: 'active' });
  return { id, legacyId, name: valid.name, isPrivate: valid.isPrivate, role: 'owner', status: 'active' };
}

export type JoinOutcomeStatus = 'joined' | 'pending';

export interface GovernedJoinResult {
  id: string;
  legacyId: string;
  status: JoinOutcomeStatus;
  role: string;
}

function needsApproval(group: Record<string, unknown>): boolean {
  return group.isPrivate === true || group.requireAdminApproval === true;
}

/**
 * Governed membership join/add, mirroring current product authorization:
 * active groups only; public groups join active, private/approval groups
 * join pending; existing documents transition (joined→active idempotent
 * activation, pending stays pending, left/rejected rejoin under current
 * rules). Inactive/missing groups fail closed.
 */
export async function joinGovernedGroup(
  db: Db,
  store: GroupMutationStore,
  actor: GroupMutationActor,
  groupId: string,
): Promise<GovernedJoinResult> {
  const shadow = await db.query<{ group_id: string; legacy_firestore_id: string | null }>(
    `SELECT group_id, legacy_firestore_id FROM groups WHERE group_id = $1`,
    [groupId],
  );
  const legacyId = shadow.rows[0]?.legacy_firestore_id ?? null;
  if (!legacyId) fail(404, 'unknown_group', 'Group not found under current Group authority');
  const group = await storeCall('group read', () => store.getGroup(legacyId!));
  if (!group) fail(404, 'unknown_group', 'Group not found under current Group authority');
  if (!isGroupDocActive(group!)) {
    fail(422, 'group_inactive', 'This group is no longer active and cannot be joined');
  }
  const now = new Date().toISOString();
  const existing = await storeCall('membership read', () => store.getMembership(legacyId!, actor.firebaseUid));
  const existingStatus = typeof existing?.status === 'string' ? String(existing.status).toLowerCase() : null;

  let outcome: JoinOutcomeStatus;
  let role = typeof existing?.role === 'string' && existing.role ? String(existing.role) : 'member';
  if (existingStatus === 'active') {
    outcome = 'joined';
  } else if (existingStatus === 'joined') {
    await storeCall(
      'membership activation',
      () => store.updateMembership(legacyId!, actor.firebaseUid, { status: 'active', approvedAt: now }),
    );
    outcome = 'joined';
  } else if (existingStatus === 'pending') {
    outcome = 'pending';
  } else {
    const status = needsApproval(group!) ? 'pending' : 'active';
    await storeCall('membership write', () => store.setMembership(legacyId!, actor.firebaseUid, {
      groupId: legacyId!,
      userId: actor.firebaseUid,
      role: 'member',
      status,
      createdAt: now,
      ...(status === 'active' ? { approvedAt: now } : {}),
    }));
    role = 'member';
    if (status === 'active') {
      await storeCall('member counter update', () => store.updateGroupCounter(legacyId!, 1));
    }
    outcome = status === 'active' ? 'joined' : 'pending';
  }

  await upsertGroupShadow(db, legacyId!, {
    name: typeof group!.name === 'string' ? group!.name : '',
    description: typeof group!.description === 'string' ? group!.description : '',
    isPrivate: group!.isPrivate === true,
    active: true,
  });
  await upsertMembershipShadow(db, groupId, actor.memberId, {
    role,
    status: outcome === 'joined' ? 'active' : 'pending',
  });
  return { id: groupId, legacyId: legacyId!, status: outcome, role };
}

export interface GovernedLeaveResult {
  id: string;
  legacyId: string;
  status: 'left' | 'none';
}

/**
 * Governed membership leave/withdraw, mirroring current product
 * authorization: the owner cannot leave (ownership transfer first); an
 * active/joined membership moves to left with the counter decremented;
 * missing or non-active memberships are idempotent no-ops.
 */
export async function leaveGovernedGroup(
  db: Db,
  store: GroupMutationStore,
  actor: GroupMutationActor,
  groupId: string,
): Promise<GovernedLeaveResult> {
  const shadow = await db.query<{ group_id: string; legacy_firestore_id: string | null }>(
    `SELECT group_id, legacy_firestore_id FROM groups WHERE group_id = $1`,
    [groupId],
  );
  const legacyId = shadow.rows[0]?.legacy_firestore_id ?? null;
  if (!legacyId) fail(404, 'unknown_group', 'Group not found under current Group authority');
  const group = await storeCall('group read', () => store.getGroup(legacyId!));
  if (!group) fail(404, 'unknown_group', 'Group not found under current Group authority');
  if (group!.ownerId === actor.firebaseUid) {
    fail(403, 'owner_cannot_leave', 'Group owner cannot leave. Transfer ownership first.');
  }
  const existing = await storeCall('membership read', () => store.getMembership(legacyId!, actor.firebaseUid));
  const existingStatus = typeof existing?.status === 'string' ? String(existing.status).toLowerCase() : null;
  if (existingStatus !== 'active' && existingStatus !== 'joined') {
    return { id: groupId, legacyId: legacyId!, status: 'none' };
  }
  await storeCall(
    'membership withdrawal',
    () => store.updateMembership(legacyId!, actor.firebaseUid, {
      status: 'left',
      leftAt: new Date().toISOString(),
    }),
  );
  await storeCall('member counter update', () => store.updateGroupCounter(legacyId!, -1));
  const role = typeof existing?.role === 'string' && existing.role ? String(existing.role) : 'member';
  await upsertMembershipShadow(db, groupId, actor.memberId, { role, status: 'left' });
  return { id: groupId, legacyId: legacyId!, status: 'left' };
}
