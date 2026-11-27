import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import {
  V2_PERSONAL_TIMELINE_PAGE_SIZE,
  invalidateV2PersonalTimeline,
  removeV2PersonalTimeline,
  v2PersonalTimelineKey,
} from './personalTimelineQueryKeys';

describe('Personal Timeline query cache isolation', () => {
  it('cancels and removes only the prior member cache on sign-out or account switch', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');
    const previousKey = v2PersonalTimelineKey('previous-member', V2_PERSONAL_TIMELINE_PAGE_SIZE);
    const currentKey = v2PersonalTimelineKey('current-member', V2_PERSONAL_TIMELINE_PAGE_SIZE);

    queryClient.setQueryData(previousKey, { pages: [{ items: [{ timelineEventId: 'prev' }], nextCursor: null }], pageParams: [null] });
    queryClient.setQueryData(currentKey, { pages: [{ items: [{ timelineEventId: 'curr' }], nextCursor: null }], pageParams: [null] });

    await removeV2PersonalTimeline(queryClient, 'previous-member');

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: ['v2-member-personal-timeline', 'previous-member'] });
    expect(queryClient.getQueryData(previousKey)).toBeUndefined();
    expect(queryClient.getQueryData(currentKey)).toBeDefined();
  });

  it('invalidates only the target member timeline when uid is supplied', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const memberAKey = v2PersonalTimelineKey('member-a', V2_PERSONAL_TIMELINE_PAGE_SIZE);
    const memberBKey = v2PersonalTimelineKey('member-b', V2_PERSONAL_TIMELINE_PAGE_SIZE);

    queryClient.setQueryData(memberAKey, { pages: [], pageParams: [null] });
    queryClient.setQueryData(memberBKey, { pages: [], pageParams: [null] });

    await invalidateV2PersonalTimeline(queryClient, 'member-a');

    expect(queryClient.getQueryState(memberAKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(memberBKey)?.isInvalidated).toBe(false);
  });
});
