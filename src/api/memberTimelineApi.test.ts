import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { fetchMemberTimeline } from './memberTimelineApi';

beforeEach(() => {
  h.calls.length = 0;
});

describe('fetchMemberTimeline', () => {
  it('binds the verified session token and composes /api/me/timeline without caller-selected owner', async () => {
    await fetchMemberTimeline(
      {
        limit: 20,
        cursor: 'opaque-cursor',
        types: ['group_created', 'activity_logged'],
        challengeId: '00000000-0000-4000-8000-000000000001',
      },
      'signed-in-token',
    );
    expect(h.calls).toEqual([{
      path: '/api/me/timeline?limit=20&cursor=opaque-cursor&types=group_created%2Cactivity_logged&challengeId=00000000-0000-4000-8000-000000000001',
      bearerToken: 'signed-in-token',
    }]);
    expect(h.calls[0].path).not.toContain('memberId');
  });

  it('omits optional parameters when not provided', async () => {
    await fetchMemberTimeline({ limit: 20 }, 'signed-in-token');
    expect(h.calls).toEqual([{
      path: '/api/me/timeline?limit=20',
      bearerToken: 'signed-in-token',
    }]);
  });
});
