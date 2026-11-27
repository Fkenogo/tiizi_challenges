import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import {
  V2_PERSONAL_TIMELINE_PAGE_SIZE,
  V2_PERSONAL_TIMELINE_PREVIEW_SIZE,
  invalidateV2PersonalTimeline,
  removeV2PersonalTimeline,
  v2PersonalTimelineKey,
} from './personalTimelineQueryKeys';

describe('Personal Timeline query cache isolation', () => {
  it('cancels and removes both preview and history caches only for the prior member on sign-out or account switch', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');
    const previousPreviewKey = v2PersonalTimelineKey('previous-member', V2_PERSONAL_TIMELINE_PREVIEW_SIZE);
    const previousHistoryKey = v2PersonalTimelineKey('previous-member', V2_PERSONAL_TIMELINE_PAGE_SIZE);
    const currentPreviewKey = v2PersonalTimelineKey('current-member', V2_PERSONAL_TIMELINE_PREVIEW_SIZE);
    const currentHistoryKey = v2PersonalTimelineKey('current-member', V2_PERSONAL_TIMELINE_PAGE_SIZE);

    queryClient.setQueryData(previousPreviewKey, { items: [{ timelineEventId: 'prev-preview' }], nextCursor: null });
    queryClient.setQueryData(previousHistoryKey, { pages: [{ items: [{ timelineEventId: 'prev' }], nextCursor: null }], pageParams: [null] });
    queryClient.setQueryData(currentPreviewKey, { items: [{ timelineEventId: 'curr-preview' }], nextCursor: null });
    queryClient.setQueryData(currentHistoryKey, { pages: [{ items: [{ timelineEventId: 'curr' }], nextCursor: null }], pageParams: [null] });

    await removeV2PersonalTimeline(queryClient, 'previous-member');

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: ['v2-member-personal-timeline', 'previous-member'] });
    expect(queryClient.getQueryData(previousPreviewKey)).toBeUndefined();
    expect(queryClient.getQueryData(previousHistoryKey)).toBeUndefined();
    expect(queryClient.getQueryData(currentPreviewKey)).toBeDefined();
    expect(queryClient.getQueryData(currentHistoryKey)).toBeDefined();
  });

  it('invalidates both preview and history caches only for the target member when uid is supplied', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const memberAPreviewKey = v2PersonalTimelineKey('member-a', V2_PERSONAL_TIMELINE_PREVIEW_SIZE);
    const memberAHistoryKey = v2PersonalTimelineKey('member-a', V2_PERSONAL_TIMELINE_PAGE_SIZE);
    const memberBPreviewKey = v2PersonalTimelineKey('member-b', V2_PERSONAL_TIMELINE_PREVIEW_SIZE);
    const memberBHistoryKey = v2PersonalTimelineKey('member-b', V2_PERSONAL_TIMELINE_PAGE_SIZE);

    queryClient.setQueryData(memberAPreviewKey, { items: [], nextCursor: null });
    queryClient.setQueryData(memberAHistoryKey, { pages: [], pageParams: [null] });
    queryClient.setQueryData(memberBPreviewKey, { items: [], nextCursor: null });
    queryClient.setQueryData(memberBHistoryKey, { pages: [], pageParams: [null] });

    await invalidateV2PersonalTimeline(queryClient, 'member-a');

    expect(queryClient.getQueryState(memberAPreviewKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(memberAHistoryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(memberBPreviewKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(memberBHistoryKey)?.isInvalidated).toBe(false);
  });
});
