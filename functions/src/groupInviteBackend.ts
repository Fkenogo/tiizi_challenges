import { createHash, randomBytes } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

type InviteType = 'one_time' | 'multi_use';
type JoinRequestSource = 'request' | 'invite';

type CoreDb = {
  collection: (path: string) => any;
  runTransaction?: <T>(callback: (transaction: any) => Promise<T>) => Promise<T>;
};

type CreateGroupInviteInput = {
  actorUid: string;
  groupId: string;
  type: InviteType;
  maxUses: number;
  expiresAt: string;
  note?: string;
};

type RevokeGroupInviteInput = {
  actorUid: string;
  inviteId: string;
};

type RedeemGroupInviteInput = {
  actorUid: string;
  token: string;
  nowMs?: number;
};

type ListGroupInvitesInput = {
  actorUid: string;
  groupId: string;
};

type RequestGroupJoinInput = {
  actorUid: string;
  groupId: string;
  source: JoinRequestSource;
  inviteId?: string;
};

type ReviewGroupJoinRequestInput = {
  actorUid: string;
  requestId: string;
  rejectionReason?: string;
};

type GroupRecord = {
  ownerId?: string;
  status?: string;
};

type MembershipRecord = {
  role?: string;
  status?: string;
};

type InviteRecord = {
  groupId?: string;
  status?: string;
  type?: string;
  maxUses?: number;
  useCount?: number;
  createdBy?: string;
  createdAt?: unknown;
  expiresAt?: string;
  revokedAt?: unknown;
  lastUsedAt?: unknown;
  note?: string;
  tokenHash?: string;
};

type JoinRequestRecord = {
  groupId?: string;
  userId?: string;
  status?: string;
  inviteId?: string;
};

const ACTIVE_MEMBER_STATUSES = new Set(['active', 'joined']);
const GROUP_MANAGER_ROLES = new Set(['owner', 'admin', 'moderator']);
const GLOBAL_GROUP_MANAGER_ROLES = new Set(['super_admin', 'admin', 'moderator']);
const ACTIVE_GROUP_STATUSES = new Set(['active']);

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalStringValue(value: unknown): string | undefined {
  const text = stringValue(value);
  return text || undefined;
}

function optionalNoteValue(value: unknown): string | null {
  const text = stringValue(value);
  if (!text) return null;
  return text.slice(0, 500);
}

function requireString(value: unknown, field: string): string {
  const text = stringValue(value);
  if (!text) {
    throw new HttpsError('invalid-argument', `${field} is required`);
  }
  return text;
}

function requireInviteType(value: unknown): InviteType {
  if (value === 'one_time' || value === 'multi_use') return value;
  throw new HttpsError('invalid-argument', 'type must be one_time or multi_use');
}

function requireJoinRequestSource(value: unknown): JoinRequestSource {
  if (value === 'request' || value === 'invite') return value;
  throw new HttpsError('invalid-argument', 'source must be request or invite');
}

function requirePositiveInteger(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 10000) {
    throw new HttpsError('invalid-argument', `${field} must be a positive integer up to 10000`);
  }
  return parsed;
}

function requireFutureIso(value: unknown, field: string): string {
  const text = requireString(value, field);
  const ms = Date.parse(text);
  if (!Number.isFinite(ms) || ms <= Date.now()) {
    throw new HttpsError('invalid-argument', `${field} must be a future ISO timestamp`);
  }
  return new Date(ms).toISOString();
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newInviteToken(): string {
  return randomBytes(24).toString('base64url');
}

async function getDocData<T extends Record<string, unknown>>(db: CoreDb, collectionName: string, docId: string) {
  const snap = await db.collection(collectionName).doc(docId).get();
  return snap.exists ? (snap.data() as T) : null;
}

function serializeTimestamp(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value ?? null;
  const candidate = value as { toDate?: () => Date; seconds?: number };
  if (typeof candidate.toDate === 'function') return candidate.toDate().toISOString();
  if (typeof candidate.seconds === 'number') return new Date(candidate.seconds * 1000).toISOString();
  return value;
}

function sanitizeInvite(inviteId: string, data: InviteRecord) {
  return {
    id: inviteId,
    groupId: stringValue(data.groupId),
    createdBy: stringValue(data.createdBy),
    createdAt: serializeTimestamp(data.createdAt),
    expiresAt: stringValue(data.expiresAt),
    revokedAt: serializeTimestamp(data.revokedAt),
    status: stringValue(data.status),
    type: stringValue(data.type),
    maxUses: Number(data.maxUses ?? 0),
    useCount: Number(data.useCount ?? 0),
    lastUsedAt: serializeTimestamp(data.lastUsedAt),
    note: data.note ? stringValue(data.note) : null,
  };
}

async function requireGroup(db: CoreDb, groupId: string): Promise<GroupRecord> {
  const group = await getDocData<GroupRecord>(db, 'groups', groupId);
  if (!group) {
    throw new HttpsError('not-found', 'Group not found');
  }
  if (!ACTIVE_GROUP_STATUSES.has(String(group.status ?? '').toLowerCase())) {
    throw new HttpsError('failed-precondition', 'Group is not active');
  }
  return group;
}

async function isGlobalGroupManager(db: CoreDb, uid: string): Promise<boolean> {
  const admin = await getDocData<{ role?: string }>(db, 'admins', uid);
  return GLOBAL_GROUP_MANAGER_ROLES.has(String(admin?.role ?? '').toLowerCase());
}

async function canManageGroup(db: CoreDb, uid: string, groupId: string): Promise<boolean> {
  const group = await requireGroup(db, groupId);
  if (group.ownerId === uid) return true;
  if (await isGlobalGroupManager(db, uid)) return true;

  const membership = await getDocData<MembershipRecord>(db, 'groupMembers', `${groupId}_${uid}`);
  const status = String(membership?.status ?? '').toLowerCase();
  const role = String(membership?.role ?? '').toLowerCase();
  return ACTIVE_MEMBER_STATUSES.has(status) && GROUP_MANAGER_ROLES.has(role);
}

async function requireGroupManager(db: CoreDb, uid: string, groupId: string) {
  if (!(await canManageGroup(db, uid, groupId))) {
    throw new HttpsError('permission-denied', 'You do not have permission to manage this group');
  }
}

export async function writeGroupAuditLog(
  db: CoreDb,
  input: {
    groupId: string;
    actorUid: string;
    targetUid?: string;
    action: 'invite_created' | 'invite_revoked' | 'invite_redeemed' | 'join_requested' | 'join_approved' | 'join_rejected';
    metadata?: Record<string, unknown>;
  },
) {
  await db.collection('groupAuditLogs').doc().set({
    groupId: input.groupId,
    actorUid: input.actorUid,
    targetUid: input.targetUid ?? null,
    action: input.action,
    metadata: input.metadata ?? {},
    createdAt: FieldValue.serverTimestamp(),
  });
}

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

function numberValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validateRedeemableInvite(invite: InviteRecord, nowMs: number) {
  if (String(invite.status ?? '').toLowerCase() !== 'active') {
    throw new HttpsError('failed-precondition', 'Invite is not active');
  }
  if (isPresent(invite.revokedAt)) {
    throw new HttpsError('failed-precondition', 'Invite has been revoked');
  }
  const expiresMs = Date.parse(stringValue(invite.expiresAt));
  if (!Number.isFinite(expiresMs) || expiresMs < nowMs) {
    throw new HttpsError('failed-precondition', 'Invite has expired');
  }
  const maxUses = String(invite.type ?? '') === 'one_time' ? 1 : numberValue(invite.maxUses);
  const useCount = numberValue(invite.useCount);
  if (maxUses <= 0 || useCount >= maxUses) {
    throw new HttpsError('failed-precondition', 'Invite has no remaining uses');
  }
}

export async function createGroupInviteCore(db: CoreDb, input: CreateGroupInviteInput) {
  const actorUid = requireString(input.actorUid, 'actorUid');
  const groupId = requireString(input.groupId, 'groupId');
  const type = requireInviteType(input.type);
  const maxUses = type === 'one_time' ? 1 : requirePositiveInteger(input.maxUses, 'maxUses');
  const expiresAt = requireFutureIso(input.expiresAt, 'expiresAt');
  const note = optionalNoteValue(input.note);

  await requireGroupManager(db, actorUid, groupId);

  const token = newInviteToken();
  const inviteRef = db.collection('groupInvites').doc();
  await inviteRef.set({
    groupId,
    createdBy: actorUid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    revokedAt: null,
    status: 'active',
    type,
    maxUses,
    useCount: 0,
    tokenHash: tokenHash(token),
    lastUsedAt: null,
    note,
  });

  await writeGroupAuditLog(db, {
    groupId,
    actorUid,
    action: 'invite_created',
    metadata: { inviteId: inviteRef.id, type, maxUses, expiresAt, hasNote: !!note },
  });

  return { inviteId: inviteRef.id, token };
}

export async function listGroupInvitesCore(db: CoreDb, input: ListGroupInvitesInput) {
  const actorUid = requireString(input.actorUid, 'actorUid');
  const groupId = requireString(input.groupId, 'groupId');

  await requireGroupManager(db, actorUid, groupId);

  const snap = await db.collection('groupInvites')
    .where('groupId', '==', groupId)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  const invites = snap.docs.map((doc: { id: string; data: () => Record<string, unknown> }) =>
    sanitizeInvite(doc.id, doc.data() as InviteRecord),
  );

  return { invites };
}

export async function revokeGroupInviteCore(db: CoreDb, input: RevokeGroupInviteInput) {
  const actorUid = requireString(input.actorUid, 'actorUid');
  const inviteId = requireString(input.inviteId, 'inviteId');
  const invite = await getDocData<InviteRecord>(db, 'groupInvites', inviteId);
  if (!invite?.groupId) {
    throw new HttpsError('not-found', 'Invite not found');
  }

  await requireGroupManager(db, actorUid, invite.groupId);
  await db.collection('groupInvites').doc(inviteId).set({
    status: 'revoked',
    revokedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await writeGroupAuditLog(db, {
    groupId: invite.groupId,
    actorUid,
    action: 'invite_revoked',
    metadata: { inviteId },
  });

  return { inviteId, status: 'revoked' };
}

export async function redeemGroupInviteCore(db: CoreDb, input: RedeemGroupInviteInput) {
  const actorUid = requireString(input.actorUid, 'actorUid');
  const token = requireString(input.token, 'token');
  const hashedToken = tokenHash(token);
  const nowMs = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now();
  let redeemedInviteId = '';
  let redeemedGroupId = '';

  if (!db.runTransaction) {
    throw new HttpsError('internal', 'Transactional invite redemption is unavailable');
  }

  await db.runTransaction(async (transaction) => {
    const inviteQuery = db.collection('groupInvites')
      .where('tokenHash', '==', hashedToken)
      .limit(1);
    const inviteSnap = await transaction.get(inviteQuery) as { docs: Array<{ id: string; ref: unknown; data: () => Record<string, unknown> }> };
    const inviteDoc = inviteSnap.docs[0];
    if (!inviteDoc) {
      throw new HttpsError('not-found', 'Invite not found');
    }

    const invite = inviteDoc.data() as InviteRecord;
    if (invite.tokenHash !== hashedToken) {
      throw new HttpsError('not-found', 'Invite not found');
    }
    if (!invite.groupId) {
      throw new HttpsError('failed-precondition', 'Invite is missing group context');
    }

    const groupRef = db.collection('groups').doc(invite.groupId);
    const groupSnap = await transaction.get(groupRef) as { exists: boolean; data: () => Record<string, unknown> | undefined };
    const group = groupSnap.exists ? groupSnap.data() as GroupRecord : null;
    if (!group) {
      throw new HttpsError('failed-precondition', 'Invite group is missing');
    }
    if (!ACTIVE_GROUP_STATUSES.has(String(group.status ?? '').toLowerCase())) {
      throw new HttpsError('failed-precondition', 'Group is not active');
    }

    const memberRef = db.collection('groupMembers').doc(`${invite.groupId}_${actorUid}`);
    const memberSnap = await transaction.get(memberRef) as { exists: boolean; data: () => Record<string, unknown> | undefined };
    const existingMember = memberSnap.exists ? memberSnap.data() as MembershipRecord : null;
    if (ACTIVE_MEMBER_STATUSES.has(String(existingMember?.status ?? '').toLowerCase())) {
      throw new HttpsError('failed-precondition', 'User is already an active group member');
    }

    validateRedeemableInvite(invite, nowMs);

    transaction.set(inviteDoc.ref, {
      useCount: FieldValue.increment(1),
      lastUsedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(memberRef, {
      groupId: invite.groupId,
      userId: actorUid,
      role: 'member',
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      approvedBy: 'invite',
      approvedAt: FieldValue.serverTimestamp(),
      inviteId: inviteDoc.id,
    }, { merge: true });

    const auditRef = db.collection('groupAuditLogs').doc();
    transaction.set(auditRef, {
      groupId: invite.groupId,
      actorUid,
      targetUid: actorUid,
      action: 'invite_redeemed',
      metadata: { inviteId: inviteDoc.id },
      createdAt: FieldValue.serverTimestamp(),
    });

    redeemedInviteId = inviteDoc.id;
    redeemedGroupId = invite.groupId;
  });

  return { inviteId: redeemedInviteId, groupId: redeemedGroupId, status: 'joined' };
}

export async function requestGroupJoinCore(db: CoreDb, input: RequestGroupJoinInput) {
  const actorUid = requireString(input.actorUid, 'actorUid');
  const groupId = requireString(input.groupId, 'groupId');
  const source = requireJoinRequestSource(input.source);
  const inviteId = optionalStringValue(input.inviteId);

  await requireGroup(db, groupId);

  const requestId = `${groupId}_${actorUid}`;
  await db.collection('groupJoinRequests').doc(requestId).set({
    groupId,
    userId: actorUid,
    status: 'pending',
    requestedAt: FieldValue.serverTimestamp(),
    source,
    inviteId: inviteId ?? null,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
  }, { merge: true });

  await writeGroupAuditLog(db, {
    groupId,
    actorUid,
    targetUid: actorUid,
    action: 'join_requested',
    metadata: { requestId, source, inviteId: inviteId ?? null },
  });

  return { requestId, status: 'pending' };
}

export async function approveGroupJoinRequestCore(db: CoreDb, input: ReviewGroupJoinRequestInput) {
  const actorUid = requireString(input.actorUid, 'actorUid');
  const requestId = requireString(input.requestId, 'requestId');
  const request = await getDocData<JoinRequestRecord>(db, 'groupJoinRequests', requestId);
  if (!request?.groupId || !request.userId) {
    throw new HttpsError('not-found', 'Join request not found');
  }
  if (request.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'Join request is not pending');
  }

  await requireGroupManager(db, actorUid, request.groupId);
  await db.collection('groupJoinRequests').doc(requestId).set({
    status: 'approved',
    approvedBy: actorUid,
    approvedAt: FieldValue.serverTimestamp(),
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
  }, { merge: true });

  await db.collection('groupMembers').doc(`${request.groupId}_${request.userId}`).set({
    groupId: request.groupId,
    userId: request.userId,
    role: 'member',
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    approvedBy: actorUid,
    approvedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await writeGroupAuditLog(db, {
    groupId: request.groupId,
    actorUid,
    targetUid: request.userId,
    action: 'join_approved',
    metadata: { requestId, inviteId: request.inviteId ?? null },
  });

  return { requestId, status: 'approved' };
}

export async function rejectGroupJoinRequestCore(db: CoreDb, input: ReviewGroupJoinRequestInput) {
  const actorUid = requireString(input.actorUid, 'actorUid');
  const requestId = requireString(input.requestId, 'requestId');
  const rejectionReason = stringValue(input.rejectionReason).slice(0, 500);
  const request = await getDocData<JoinRequestRecord>(db, 'groupJoinRequests', requestId);
  if (!request?.groupId || !request.userId) {
    throw new HttpsError('not-found', 'Join request not found');
  }
  if (request.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'Join request is not pending');
  }

  await requireGroupManager(db, actorUid, request.groupId);
  await db.collection('groupJoinRequests').doc(requestId).set({
    status: 'rejected',
    approvedBy: null,
    approvedAt: null,
    rejectedBy: actorUid,
    rejectedAt: FieldValue.serverTimestamp(),
    rejectionReason: rejectionReason || null,
  }, { merge: true });

  await writeGroupAuditLog(db, {
    groupId: request.groupId,
    actorUid,
    targetUid: request.userId,
    action: 'join_rejected',
    metadata: { requestId, inviteId: request.inviteId ?? null },
  });

  return { requestId, status: 'rejected' };
}

function uidFromRequest(request: CallableRequest<unknown>): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
  return uid;
}

export function createGroupInviteCallable(db: Firestore) {
  return onCall({ region: 'us-central1' }, async (request) => {
    const data = (request.data ?? {}) as Record<string, unknown>;
    return createGroupInviteCore(db, {
      actorUid: uidFromRequest(request),
      groupId: requireString(data.groupId, 'groupId'),
      type: requireInviteType(data.type),
      maxUses: data.type === 'one_time' ? 1 : requirePositiveInteger(data.maxUses, 'maxUses'),
      expiresAt: requireFutureIso(data.expiresAt, 'expiresAt'),
      note: optionalStringValue(data.note),
    });
  });
}

export function listGroupInvitesCallable(db: Firestore) {
  return onCall({ region: 'us-central1' }, async (request) => {
    const data = (request.data ?? {}) as Record<string, unknown>;
    return listGroupInvitesCore(db, {
      actorUid: uidFromRequest(request),
      groupId: requireString(data.groupId, 'groupId'),
    });
  });
}

export function revokeGroupInviteCallable(db: Firestore) {
  return onCall({ region: 'us-central1' }, async (request) => {
    const data = (request.data ?? {}) as Record<string, unknown>;
    return revokeGroupInviteCore(db, {
      actorUid: uidFromRequest(request),
      inviteId: requireString(data.inviteId, 'inviteId'),
    });
  });
}

export function redeemGroupInviteCallable(db: Firestore) {
  return onCall({ region: 'us-central1' }, async (request) => {
    const data = (request.data ?? {}) as Record<string, unknown>;
    return redeemGroupInviteCore(db, {
      actorUid: uidFromRequest(request),
      token: requireString(data.token ?? data.code, 'token'),
    });
  });
}

export function requestGroupJoinCallable(db: Firestore) {
  return onCall({ region: 'us-central1' }, async (request) => {
    const data = (request.data ?? {}) as Record<string, unknown>;
    return requestGroupJoinCore(db, {
      actorUid: uidFromRequest(request),
      groupId: requireString(data.groupId, 'groupId'),
      source: requireJoinRequestSource(data.source ?? 'request'),
      inviteId: optionalStringValue(data.inviteId),
    });
  });
}

export function approveGroupJoinRequestCallable(db: Firestore) {
  return onCall({ region: 'us-central1' }, async (request) => {
    const data = (request.data ?? {}) as Record<string, unknown>;
    return approveGroupJoinRequestCore(db, {
      actorUid: uidFromRequest(request),
      requestId: requireString(data.requestId, 'requestId'),
    });
  });
}

export function rejectGroupJoinRequestCallable(db: Firestore) {
  return onCall({ region: 'us-central1' }, async (request) => {
    const data = (request.data ?? {}) as Record<string, unknown>;
    return rejectGroupJoinRequestCore(db, {
      actorUid: uidFromRequest(request),
      requestId: requireString(data.requestId, 'requestId'),
      rejectionReason: optionalStringValue(data.rejectionReason),
    });
  });
}
