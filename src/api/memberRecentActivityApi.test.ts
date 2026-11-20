import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; bearerToken: string | undefined }>,
}));

vi.mock('./apiClient', () => ({
  apiPath: (path: string) => `/api${path}`,
  apiFetch: async (path: string, init?: { bearerToken?: string }) => {
    h.calls.push({ path, bearerToken: init?.bearerToken });
    return { items: [], nextCursor: null };
  },
}));

import { fetchMemberRecentActivity } from './memberRecentActivityApi';

describe('fetchMemberRecentActivity', () => {
  it('binds the verified session token and never sends a caller-selected owner', async () => {
    await fetchMemberRecentActivity({ limit: 20, cursor: 'opaque-cursor' }, 'signed-in-token');
    expect(h.calls).toEqual([{
      path: '/api/me/activity?limit=20&cursor=opaque-cursor',
      bearerToken: 'signed-in-token',
    }]);
    expect(h.calls[0].path).not.toContain('memberId');
  });
});
