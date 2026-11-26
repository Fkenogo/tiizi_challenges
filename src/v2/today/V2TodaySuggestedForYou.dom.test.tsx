import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import type { V2DiscoverableGroup } from '../../api/groupsApi';

const mocks = vi.hoisted(() => ({ groups: {} as any, challenges: {} as any }));
vi.mock('../groups/useV2Groups', () => ({ useV2GroupDiscovery: () => mocks.groups }));
vi.mock('../challenges/useChallengeDiscovery', () => ({ useV2ChallengeDiscovery: () => mocks.challenges }));

import { V2TodaySuggestedForYou } from './V2TodaySuggestedForYou';

const group = (id: string, relevance: NonNullable<V2DiscoverableGroup['relevance']> = { interests: [], goals: [] }): V2DiscoverableGroup => ({
  id, name: id, description: '', tagline: `${id} tagline`, coverId: null, coverImage: undefined, location: '', focusTags: [], goals: [],
  memberCount: 2, admissionMode: 'approval', viewerRelationship: 'none', relevance,
});
const challenge = (
  id: string,
  status: 'active' | 'establishment' = 'active',
  relevance: V2DiscoverableChallenge['relevance'] = { interests: [], goals: [], domains: [] },
): V2DiscoverableChallenge => ({
  challengeId: id, groupId: 'g', groupName: 'Host Group', activities: [{ name: 'Walk', domain: 'fitness' as const, category: 'Movement', subcategory: '' }],
  title: id, description: 'A safe summary.', challengeType: 'collective' as const, status, startDate: '2026-11-10', endDate: '2026-11-20',
  timezone: 'UTC', governingToday: '2026-11-04', finalized: false, currentConfigVersion: 1, goalValue: null, goalUnit: null,
  collectiveTotal: 0, collectiveGoalReached: false, completionsCount: 0, myParticipation: null,
  host: { groupId: 'g', groupName: 'Host Group', admissionMode: 'approval' as const, viewerRelationship: 'none' as const }, relevance,
});

function setLoaded(groups: any[], challenges: any[], groupState: Record<string, unknown> = {}) {
  const fetchNextPage = vi.fn().mockResolvedValue(undefined);
  mocks.groups = {
    data: { pages: [{ groups, nextCursor: null, ranking: { applied: true } }], pageParams: [undefined] },
    isLoading: false, isError: false, isSuccess: true, hasNextPage: false,
    isFetchingNextPage: false, isFetchNextPageError: false, fetchNextPage,
    ...groupState,
  };
  mocks.challenges = {
    data: { pages: [{ challenges, ranking: { applied: true } }] },
    isLoading: false, isError: false, isSuccess: true, hasNextPage: false,
    isFetchingNextPage: false, isFetchNextPageError: false,
    fetchNextPage: vi.fn().mockResolvedValue(undefined),
  };
  return fetchNextPage;
}

afterEach(() => cleanup());

describe('Today suggested for you', () => {
  it('presents Groups and Challenges in one list with a clear next action each', () => {
    setLoaded(
      [group('Matched Group', { interests: ['Walking'], goals: [] })],
      [challenge('Matched Challenge', 'establishment', { interests: [], goals: ['Build strength'], domains: [] })],
    );
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Suggested for you' })).toBeTruthy();
    expect(screen.getByText('Matched Group')).toBeTruthy();
    expect(screen.getByText('Matched Challenge')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'View Group' }).length).toBe(2);
    expect(screen.getByRole('button', { name: 'View Challenge' })).toBeTruthy();
  });

  it('shows the entity type and concise context on every card', () => {
    setLoaded([group('Context Group')], [challenge('Context Challenge')]);
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByText('Group')).toBeTruthy();
    expect(screen.getByText('Challenge')).toBeTruthy();
    expect(screen.getByText('Context Group tagline')).toBeTruthy();
    expect(screen.getByText(/Hosted by Host Group/)).toBeTruthy();
  });

  it('explains the matching basis once for the section, not once per card', () => {
    setLoaded(
      [group('Matched Group', { interests: ['Walking'], goals: [] })],
      [challenge('Matched Challenge', 'active', { interests: [], goals: ['Build strength'], domains: [] })],
    );
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getAllByText(/Ordered by your interests and goals/).length).toBe(1);
    expect(screen.queryByText(/Suggested because/)).toBeNull();
  });

  it('keeps Group admission and Challenge participation rules visible', () => {
    setLoaded([group('Approval Group')], [challenge('Approval Challenge')]);
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByText(/Request to join; the Group must approve/)).toBeTruthy();
    expect(screen.getByText(/approval is required before taking part/)).toBeTruthy();
  });

  it('preserves access to full Group and Challenge Discovery', () => {
    setLoaded([], []);
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'Browse Groups' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Browse Challenges' })).toBeTruthy();
  });

  it('shows an empty state when nothing can be suggested', () => {
    setLoaded([], []);
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByText('Nothing to suggest right now')).toBeTruthy();
  });

  it('fetches later Group pages until three eligible suggestions are collected', async () => {
    const excluded = Array.from({ length: 12 }, (_, index) => ({
      ...group(`Joined ${index}`),
      viewerRelationship: index % 2 === 0 ? 'member' as const : 'steward' as const,
    }));
    const fetchNextPage = setLoaded(excluded, [], {
      hasNextPage: true,
      data: { pages: [{ groups: excluded, nextCursor: 'cursor-1' }], pageParams: [undefined] },
    });
    const view = render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

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
    view.rerender(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(2));

    expect(screen.getByText('Eligible one')).toBeTruthy();
    expect(screen.getByText('Eligible two')).toBeTruthy();
  });

  it('shows an exhausted state without fetching beyond the final Group page', () => {
    const excluded = Array.from({ length: 12 }, (_, index) => ({ ...group(`Joined ${index}`), viewerRelationship: 'member' as const }));
    const fetchNextPage = setLoaded(excluded, []);
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByText(/no Groups or Challenges to suggest yet/)).toBeTruthy();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});
