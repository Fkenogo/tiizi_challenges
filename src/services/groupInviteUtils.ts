export type GroupInviteType = 'one_time' | 'multi_use';
export type GroupInviteStatus = 'active' | 'revoked' | 'expired' | string;

export type GroupInvite = {
  id: string;
  groupId: string;
  createdBy: string;
  createdAt: unknown;
  expiresAt: string;
  revokedAt: unknown;
  status: GroupInviteStatus;
  type: GroupInviteType | string;
  maxUses: number;
  useCount: number;
  lastUsedAt: unknown;
  note: string | null;
};

export type CreateGroupInviteInput = {
  groupId: string;
  type: GroupInviteType;
  expiresAt: string;
  maxUses?: number;
  note?: string;
};

export type GroupInviteAnalytics = {
  activeInvites: number;
  expiredInvites: number;
  revokedInvites: number;
  totalUses: number;
};

type CallableLikeError = {
  code?: unknown;
  message?: unknown;
};

function requireFutureDate(expiresAt: string) {
  const ms = Date.parse(expiresAt);
  if (!Number.isFinite(ms) || ms <= Date.now()) {
    throw new Error('Invite expiration must be a future date.');
  }
}

export function normalizeCreateGroupInviteInput(input: CreateGroupInviteInput) {
  const groupId = input.groupId.trim();
  if (!groupId) throw new Error('Group is required.');
  if (input.type !== 'one_time' && input.type !== 'multi_use') {
    throw new Error('Invite type must be one_time or multi_use.');
  }
  requireFutureDate(input.expiresAt);

  const maxUses = input.type === 'one_time' ? 1 : Number(input.maxUses ?? 0);
  if (!Number.isInteger(maxUses) || maxUses <= 0) {
    throw new Error('Max uses must be greater than 0.');
  }

  const note = input.note?.trim();
  return {
    groupId,
    type: input.type,
    expiresAt: new Date(input.expiresAt).toISOString(),
    maxUses,
    ...(note ? { note: note.slice(0, 500) } : {}),
  };
}

export function normalizeInviteTokenInput(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-_]/g, '');
}

function normalizedErrorCode(error: unknown) {
  const code = String((error as CallableLikeError)?.code ?? '').toLowerCase();
  return code.replace(/^functions\//, '');
}

export function getGroupInviteErrorMessage(error: unknown) {
  const code = normalizedErrorCode(error);
  const message = String((error as CallableLikeError)?.message ?? '').toLowerCase();

  if (code === 'not-found') return 'Invalid invite code.';
  if (code === 'unauthenticated') return 'Please sign in to continue.';
  if (code === 'permission-denied') return 'You do not have permission to manage this group.';
  if (code === 'invalid-argument') return 'Check the invite details and try again.';
  if (message.includes('expired')) return 'Invite has expired.';
  if (message.includes('revoked')) return 'Invite is no longer valid.';
  if (message.includes('remaining uses') || message.includes('no remaining') || message.includes('limit')) {
    return 'Invite usage limit reached.';
  }
  if (message.includes('already') && message.includes('member')) return 'You are already a member.';
  if (message.includes('not pending')) return 'This request has already been reviewed.';

  return 'Something went wrong. Please try again.';
}

export function calculateGroupInviteAnalytics(invites: GroupInvite[], nowMs = Date.now()): GroupInviteAnalytics {
  return invites.reduce<GroupInviteAnalytics>((totals, invite) => {
    const status = String(invite.status ?? '').toLowerCase();
    const expiresMs = Date.parse(invite.expiresAt);
    const isExpired = Number.isFinite(expiresMs) && expiresMs <= nowMs && status !== 'revoked';
    if (status === 'revoked') totals.revokedInvites += 1;
    else if (isExpired || status === 'expired') totals.expiredInvites += 1;
    else if (status === 'active') totals.activeInvites += 1;
    totals.totalUses += Math.max(0, Number(invite.useCount ?? 0));
    return totals;
  }, {
    activeInvites: 0,
    expiredInvites: 0,
    revokedInvites: 0,
    totalUses: 0,
  });
}
