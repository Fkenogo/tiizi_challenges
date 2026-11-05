import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import type { V2DiscoverableGroup } from '../../api/groupsApi';

const mocks = vi.hoisted(() => ({ groups: {} as any, challenges: {} as any }));
vi.mock('../groups/useV2Groups', () => ({ useV2GroupDiscovery: () => mocks.groups }));
vi.mock('../challenges/useChallengeDiscovery', () => ({ useV2ChallengeDiscovery: () => mocks.challenges }));

import { V2TodayDiscoveryRecommendations } from './V2TodayDiscoveryRecommendations';

const group = (id: string, relevance: NonNullable<V2DiscoverableGroup['relevance']> = { interests: [], goals: [] }): V2DiscoverableGroup => ({ id, name: id, description: '', tagline: '', coverId: null, location: '', focusTags: [], goals: [], memberCount: 2, admissionMode: 'approval', viewerRelationship: 'none', relevance });
const challenge = (id: string, status: 'active' | 'establishment' = 'active', relevance: V2DiscoverableChallenge['relevance'] = { interests: [], goals: [], domains: [] }): V2DiscoverableChallenge => ({
  challengeId: id, groupId: 'g', groupName: 'Host Group', activities: [{ name: 'Walk', domain: 'fitness' as const, category: 'Movement', subcategory: '' }], title: id, description: 'A safe summary.', challengeType: 'collective' as const, status, startDate: '2026-11-10', endDate: '2026-11-20', timezone: 'UTC', governingToday: '2026-11-04', finalized: false, currentConfigVersion: 1, goalValue: null, goalUnit: null, collectiveTotal: 0, collectiveGoalReached: false, completionsCount: 0, myParticipation: null,
  host: { groupId: 'g', groupName: 'Host Group', admissionMode: 'approval' as const, viewerRelationship: 'none' as const }, relevance,
});
function setLoaded(groups: any[], challenges: any[], groupState: Record<string, unknown> = {}) {
  const fetchNextPage = vi.fn().mockResolvedValue(undefined);
  mocks.groups = {
    data: { pages: [{ groups, nextCursor: null }], pageParams: [undefined] },
    isLoading: false, isError: false, isSuccess: true, hasNextPage: false,
    isFetchingNextPage: false, isFetchNextPageError: false, fetchNextPage,
    ...groupState,
  };
  mocks.challenges = { data: { pages: [{ challenges }] }, isLoading: false, isError: false, isSuccess: true };
  return fetchNextPage;
}
afterEach(() => cleanup());

describe('Today discovery recommendations', () => {
  it('shows matched results, approval requirements, upcoming status, and safe detail links', () => {
    setLoaded([group('Matched Group', { interests: ['Walking'], goals: [] }), group('Unmatched Group')], [challenge('Matched Challenge', 'establishment', { interests: ['Walking'], goals: [], domains: [] })]);
    render(<MemoryRouter><V2TodayDiscoveryRecommendations /></MemoryRouter>);
    expect(screen.getByText('Matched Group')).toBeTruthy();
    expect(screen.queryByText('Unmatched Group')).toBeNull();
    expect(screen.getByText(/Request to join; the Group must approve/)).toBeTruthy();
    expect(screen.getByText('Upcoming')).toBeTruthy();
    expect(screen.getByText(/approval is required before taking part/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View Challenge' })).toBeTruthy();
  });
  it('falls back to general discovery when there are no exact matches', () => {
    setLoaded([group('General Group')], [challenge('General Challenge')]);
    render(<MemoryRouter><V2TodayDiscoveryRecommendations /></MemoryRouter>);
    expect(screen.getByText('General Group')).toBeTruthy();
    expect(screen.getByText('General Challenge')).toBeTruthy();
    expect(screen.queryByText(/Suggested because/)).toBeNull();
  });
  it('fetches later Group pages until three eligible recommendations are collected', async () => {
    const excluded = Array.from({ length: 12 }, (_, index) => ({
      ...group(`Joined ${index}`),
      viewerRelationship: index % 2 === 0 ? 'member' as const : 'steward' as const,
    }));
    const fetchNextPage = setLoaded(excluded, [], {
      hasNextPage: true,
      data: { pages: [{ groups: excluded, nextCursor: 'cursor-1' }], pageParams: [undefined] },
    });
    const view = render(<MemoryRouter><V2TodayDiscoveryRecommendations /></MemoryRouter>);

    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(1));

    mocks.groups = {
      ...mocks.groups,
      data: {
        pages: [
          { groups: excluded, nextCursor: 'cursor-1' },
          { groups: [group('Eligible one'), group('Eligible two')], nextCursor: 'cursor-2' },
        ],
        pageParams: [undefined, 'cursor-1'],
      },
      hasNextPage: true,
    };
    view.rerender(<MemoryRouter><V2TodayDiscoveryRecommendations /></MemoryRouter>);
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(2));

    mocks.groups = {
      ...mocks.groups,
      data: {
        pages: [
          { groups: excluded, nextCursor: 'cursor-1' },
          { groups: [group('Eligible one'), group('Eligible two')], nextCursor: 'cursor-2' },
          { groups: [group('Eligible three')], nextCursor: 'cursor-3' },
        ],
        pageParams: [undefined, 'cursor-1', 'cursor-2'],
      },
      hasNextPage: true,
    };
    view.rerender(<MemoryRouter><V2TodayDiscoveryRecommendations /></MemoryRouter>);

    expect(screen.getByText('Eligible one')).toBeTruthy();
    expect(screen.getByText('Eligible two')).toBeTruthy();
    expect(screen.getByText('Eligible three')).toBeTruthy();
    expect(fetchNextPage).toHaveBeenCalledTimes(2);
  });
  it('shows an exhausted state without fetching beyond the final Group page', () => {
    const excluded = Array.from({ length: 12 }, (_, index) => ({ ...group(`Joined ${index}`), viewerRelationship: 'member' as const }));
    const fetchNextPage = setLoaded(excluded, []);
    render(<MemoryRouter><V2TodayDiscoveryRecommendations /></MemoryRouter>);
    expect(screen.getByText('No discoverable Groups are available right now. Check back later.')).toBeTruthy();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });
  it('announces automatic later-page loading without starting a duplicate request', () => {
    const excluded = Array.from({ length: 12 }, (_, index) => ({ ...group(`Joined ${index}`), viewerRelationship: 'member' as const }));
    const fetchNextPage = setLoaded(excluded, [], { hasNextPage: true, isFetchingNextPage: true });
    render(<MemoryRouter><V2TodayDiscoveryRecommendations /></MemoryRouter>);
    expect(screen.getByRole('status').textContent).toContain('Finding more Groups');
    expect(fetchNextPage).not.toHaveBeenCalled();
  });
  it('stops a repeated cursor and reports a pagination error', () => {
    const excluded = Array.from({ length: 12 }, (_, index) => ({ ...group(`Joined ${index}`), viewerRelationship: 'member' as const }));
    const fetchNextPage = setLoaded(excluded, [], {
      data: { pages: [{ groups: excluded, nextCursor: 'cursor-1' }, { groups: excluded, nextCursor: 'cursor-1' }], pageParams: [undefined, 'cursor-1'] },
      hasNextPage: true,
    });
    render(<MemoryRouter><V2TodayDiscoveryRecommendations /></MemoryRouter>);
    expect(screen.getByRole('alert').textContent).toContain('continue loading Group suggestions');
    expect(fetchNextPage).not.toHaveBeenCalled();
  });
  it('keeps loaded Group cards and reports a failed later page', () => {
    const excluded = Array.from({ length: 12 }, (_, index) => ({ ...group(`Joined ${index}`), viewerRelationship: 'member' as const }));
    const fetchNextPage = setLoaded([group('Already eligible')], [], {
      hasNextPage: true, isError: true, isFetchNextPageError: true,
      data: { pages: [{ groups: [group('Already eligible')], nextCursor: 'cursor-1' }], pageParams: [undefined] },
    });
    render(<MemoryRouter><V2TodayDiscoveryRecommendations /></MemoryRouter>);
    expect(screen.getByText('Already eligible')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Showing the Groups already available');
    expect(fetchNextPage).not.toHaveBeenCalled();
    expect(excluded).toHaveLength(12);
  });
  it('reports independent loading and service errors', () => {
    mocks.groups = { isLoading: true };
    mocks.challenges = { isLoading: false, isError: true, isSuccess: false };
    render(<MemoryRouter><V2TodayDiscoveryRecommendations /></MemoryRouter>);
    expect(screen.getByText('Finding Groups…')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Challenge suggestions');
  });
});
