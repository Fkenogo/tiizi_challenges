import type { Group } from '../types';
import { apiFetch } from './apiClient';

export interface PreviewGovernedGroupInput {
  name: string;
  description: string;
  ownerId: string;
  coverImageUrl?: string;
  isPrivate?: boolean;
  requireAdminApproval?: boolean;
  allowMemberChallenges?: boolean;
}

interface GovernedGroupResponse {
  id: string;
  legacyId: string;
  name: string;
  isPrivate: boolean;
  role: string;
  status: string;
}

/**
 * Local preview adapter for the existing governed API route. The API writes
 * live Firestore Group + owner Membership truth first, then its PG shadow;
 * the returned legacy id remains the app's Firestore-facing group id.
 */
export async function createPreviewGovernedGroup(input: PreviewGovernedGroupInput): Promise<Group> {
  const response = await apiFetch<GovernedGroupResponse>('/v1/groups', {
    method: 'POST',
    body: {
      name: input.name,
      description: input.description,
      ...(input.coverImageUrl ? { coverImageUrl: input.coverImageUrl } : {}),
      isPrivate: !!input.isPrivate,
      requireAdminApproval: !!input.requireAdminApproval,
      allowMemberChallenges: input.allowMemberChallenges ?? true,
    },
  });
  return {
    id: response.legacyId,
    name: response.name,
    description: input.description,
    ownerId: input.ownerId,
    memberCount: 1,
    createdAt: new Date().toISOString(),
    ...(input.coverImageUrl ? { coverImageUrl: input.coverImageUrl } : {}),
    isPrivate: response.isPrivate,
    requireAdminApproval: !!input.requireAdminApproval,
    allowMemberChallenges: input.allowMemberChallenges ?? true,
    activeChallenges: 0,
    status: 'active',
    moderationStatus: 'active',
    visibility: response.isPrivate ? 'private' : 'public',
  };
}
