/**
 * Returns true when the group is operational.
 *
 * Checks:
 *   - status === 'active' (or missing for legacy docs written before 18I-6D)
 *   - moderationStatus !== 'deactivated'
 *
 * After 18I-6D all new groups explicitly write status: 'active', so the
 * missing-status fallback only applies to legacy documents.
 */
export function isGroupActive(
  group: { status?: string; moderationStatus?: string } | null | undefined,
): boolean {
  if (!group) return false;
  const s = String(group.status ?? 'active').toLowerCase();
  if (s !== 'active') return false;
  // Belt-and-suspenders: if admin set moderationStatus to 'deactivated' the
  // group is blocked even if status was not updated atomically.
  const m = String(group.moderationStatus ?? 'active').toLowerCase();
  return m !== 'deactivated';
}

export interface GroupDefaultsInput {
  name: string;
  description: string;
  ownerId: string;
  coverImageUrl?: string;
  isPrivate?: boolean;
  requireAdminApproval?: boolean;
  allowMemberChallenges?: boolean;
  inviteCode: string;
}

/**
 * Returns the canonical field set for a newly created group.
 * Every group document written by the app must include these fields so that
 * lifecycle gates (isGroupActive, Cloud Function status checks) work correctly
 * without relying on undefined-field defaults.
 */
export function buildGroupDefaults(input: GroupDefaultsInput): {
  name: string;
  description: string;
  ownerId: string;
  coverImageUrl?: string;
  isPrivate: boolean;
  requireAdminApproval: boolean;
  allowMemberChallenges: boolean;
  inviteCode: string;
  memberCount: number;
  activeChallenges: number;
  createdAt: string;
  status: 'active';
  moderationStatus: 'active';
  visibility: 'public' | 'private';
  isFeatured: boolean;
  isVerified: boolean;
  reviewStatus: 'pending';
} {
  const isPrivate = !!input.isPrivate;
  return {
    name: input.name,
    description: input.description,
    ownerId: input.ownerId,
    // Firestore's addDoc() rejects any field explicitly set to `undefined`
    // (distinct from the key being absent) — omit the key entirely rather
    // than assigning `coverImageUrl: undefined` when no cover was provided.
    ...(input.coverImageUrl !== undefined && { coverImageUrl: input.coverImageUrl }),
    isPrivate,
    requireAdminApproval: !!input.requireAdminApproval,
    allowMemberChallenges: input.allowMemberChallenges ?? true,
    inviteCode: input.inviteCode,
    memberCount: 1,
    activeChallenges: 0,
    createdAt: new Date().toISOString(),
    status: 'active',
    moderationStatus: 'active',
    visibility: isPrivate ? 'private' : 'public',
    isFeatured: false,
    isVerified: false,
    reviewStatus: 'pending',
  };
}
