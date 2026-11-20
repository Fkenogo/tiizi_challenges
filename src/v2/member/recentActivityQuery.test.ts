import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  V2_RECENT_ACTIVITY_PAGE_SIZE,
  V2_RECENT_ACTIVITY_PREVIEW_SIZE,
} from './recentActivityQueryKeys';
import { removeV2RecentActivity, v2RecentActivityKey } from './recentActivityQuery';

describe('Personal Recent Activity cache isolation', () => {
  it('drops only the previous member preview and history caches on account switch', async () => {
    const queryClient = new QueryClient();
    const previousPreviewKey = v2RecentActivityKey('previous-member', V2_RECENT_ACTIVITY_PREVIEW_SIZE);
    const previousHistoryKey = v2RecentActivityKey('previous-member', V2_RECENT_ACTIVITY_PAGE_SIZE);
    const currentPreviewKey = v2RecentActivityKey('current-member', V2_RECENT_ACTIVITY_PREVIEW_SIZE);
    const currentHistoryKey = v2RecentActivityKey('current-member', V2_RECENT_ACTIVITY_PAGE_SIZE);
    queryClient.setQueryData(previousPreviewKey, { items: ['previous-private-preview'] });
    queryClient.setQueryData(previousHistoryKey, { items: ['previous-private-record'] });
    queryClient.setQueryData(currentPreviewKey, { items: ['current-private-preview'] });
    queryClient.setQueryData(currentHistoryKey, { items: ['current-private-record'] });

    await removeV2RecentActivity(queryClient, 'previous-member');

    expect(queryClient.getQueryData(previousPreviewKey)).toBeUndefined();
    expect(queryClient.getQueryData(previousHistoryKey)).toBeUndefined();
    expect(queryClient.getQueryData(currentPreviewKey)).toEqual({ items: ['current-private-preview'] });
    expect(queryClient.getQueryData(currentHistoryKey)).toEqual({ items: ['current-private-record'] });
    queryClient.clear();
  });
});
