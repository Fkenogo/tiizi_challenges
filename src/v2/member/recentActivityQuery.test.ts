import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { removeV2RecentActivity, v2RecentActivityKey } from './recentActivityQuery';

describe('Personal Recent Activity cache isolation', () => {
  it('drops only the previous member cache on account switch', async () => {
    const queryClient = new QueryClient();
    const previousKey = v2RecentActivityKey('previous-member', 20);
    const currentKey = v2RecentActivityKey('current-member', 20);
    queryClient.setQueryData(previousKey, { items: ['previous-private-record'] });
    queryClient.setQueryData(currentKey, { items: ['current-private-record'] });

    await removeV2RecentActivity(queryClient, 'previous-member');

    expect(queryClient.getQueryData(previousKey)).toBeUndefined();
    expect(queryClient.getQueryData(currentKey)).toEqual({ items: ['current-private-record'] });
    queryClient.clear();
  });
});
