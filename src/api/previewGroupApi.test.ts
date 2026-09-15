import { describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from './apiClient';
import { createPreviewGovernedGroup } from './previewGroupApi';

const mockApiFetch = vi.mocked(apiFetch);

describe('emulator-preview governed Group client', () => {
  it('uses only the governed route terms and returns the Firestore authority id', async () => {
    mockApiFetch.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      legacyId: 'live-firestore-group-id',
      name: 'Preview founders',
      isPrivate: false,
      role: 'owner',
      status: 'active',
    });

    const group = await createPreviewGovernedGroup({
      name: 'Preview founders',
      description: 'A local-only preview group',
      ownerId: 'preview-founder-01',
      allowMemberChallenges: true,
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/v1/groups', {
      method: 'POST',
      body: {
        name: 'Preview founders',
        description: 'A local-only preview group',
        isPrivate: false,
        requireAdminApproval: false,
        allowMemberChallenges: true,
      },
    });
    expect(group.id).toBe('live-firestore-group-id');
    expect(group.ownerId).toBe('preview-founder-01');
    expect(group.memberCount).toBe(1);
  });
});
