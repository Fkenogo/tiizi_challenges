import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('../../api/memberRecentActivityApi', () => ({
  fetchMemberRecentActivity: h.fetch,
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'owner-uid', getIdToken: async () => 'owner-token' } }),
}));

import { useV2LatestChallengeActivity } from './recentActivityQuery';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('useV2LatestChallengeActivity', () => {
  it('requests one authenticated owner record filtered to the current Challenge', async () => {
    h.fetch.mockResolvedValue({ items: [], nextCursor: null });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, unmount } = renderHook(
      () => useV2LatestChallengeActivity('challenge-current'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(h.fetch).toHaveBeenCalledWith(
      { limit: 1, challengeId: 'challenge-current' },
      'owner-token',
    ));
    await waitFor(() => expect(result.current.data).toBeNull());

    unmount();
    queryClient.clear();
  });
});
