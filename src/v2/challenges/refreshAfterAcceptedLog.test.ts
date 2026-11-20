import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { refreshAfterAcceptedLog } from './refreshAfterAcceptedLog';
import { V2_RECENT_ACTIVITY_SCOPE } from '../member/recentActivityQuery';

afterEach(() => vi.restoreAllMocks());

describe('refreshAfterAcceptedLog', () => {
  it('invalidates the authenticated member Recent Activity cache after acceptance', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

    const result = await refreshAfterAcceptedLog(queryClient, 'member-uid', 'challenge-id');

    expect(result.refreshed).toBe(true);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [V2_RECENT_ACTIVITY_SCOPE, 'member-uid'],
    });
    queryClient.clear();
  });
});
