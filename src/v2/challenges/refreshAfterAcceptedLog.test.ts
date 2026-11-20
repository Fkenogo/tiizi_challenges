import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { refreshAfterAcceptedLog } from './refreshAfterAcceptedLog';
import {
  V2_RECENT_ACTIVITY_PAGE_SIZE,
  V2_RECENT_ACTIVITY_PREVIEW_SIZE,
  v2RecentActivityKey,
} from '../member/recentActivityQueryKeys';

describe('refreshAfterAcceptedLog', () => {
  it('invalidates the owner preview and history caches after acceptance, not another member', async () => {
    const queryClient = new QueryClient();
    const previewKey = v2RecentActivityKey('member-uid', V2_RECENT_ACTIVITY_PREVIEW_SIZE);
    const historyKey = v2RecentActivityKey('member-uid', V2_RECENT_ACTIVITY_PAGE_SIZE);
    const otherMemberKey = v2RecentActivityKey('other-member', V2_RECENT_ACTIVITY_PREVIEW_SIZE);
    queryClient.setQueryData(previewKey, { items: [] });
    queryClient.setQueryData(historyKey, { pages: [] });
    queryClient.setQueryData(otherMemberKey, { items: [] });

    const result = await refreshAfterAcceptedLog(queryClient, 'member-uid', 'challenge-id');

    expect(result.refreshed).toBe(true);
    expect(queryClient.getQueryState(previewKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(historyKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherMemberKey)?.isInvalidated).toBe(false);
    queryClient.clear();
  });
});
