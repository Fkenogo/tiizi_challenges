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

type ChallengePage = { challenges: V2DiscoverableChallenge[]; nextCursor: string | null; ranking?: { applied: boolean } };
const challengePage = (challenges: V2DiscoverableChallenge[], nextCursor: string | null = null): ChallengePage => ({
  challenges, nextCursor, ranking: { applied: true },
});
const closedChallenge = (id: string): V2DiscoverableChallenge => ({
  ...challenge(id), status: 'ended', governingToday: '2026-11-21', finalized: true,
});

function setChallengePages(pages: ChallengePage[], state: Record<string, unknown> = {}) {
  const fetchNextPage = vi.fn().mockResolvedValue(undefined);
  mocks.challenges = {
    data: { pages: pages.map((page) => ({ ranking: { applied: true }, ...page })), pageParams: [undefined] },
    isLoading: false, isError: false, isSuccess: true, hasNextPage: false,
    isFetchingNextPage: false, isFetchNextPageError: false, fetchNextPage,
    ...state,
  };
  return fetchNextPage;
}

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

/** The one unified suggestion list. */
function suggestionList(container: HTMLElement): HTMLElement {
  const section = container.querySelector('#today-suggested')?.closest('section');
  const list = section?.querySelector('ul');
  if (!list) throw new Error('the unified suggestion list is not rendered');
  return list as HTMLElement;
}

afterEach(() => {
  cleanup();
  // Each case sets up its own discovery state; a leftover mock would leak the
  // previous case's pagination flags into the next one.
  mocks.groups = {};
  mocks.challenges = {};
});

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
    expect(screen.getByRole('button', { name: 'View Group' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View Challenge' })).toBeTruthy();
  });

  it('shows the entity type and concise context on every card', () => {
    setLoaded([group('Context Group')], [challenge('Context Challenge')]);
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByText('Group')).toBeTruthy();
    expect(screen.getByText('Challenge')).toBeTruthy();
    expect(screen.getByText('Context Group tagline')).toBeTruthy();
    // The hosting Group stays reachable from the context line.
    expect(screen.getByRole('button', { name: 'Host Group' })).toBeTruthy();
  });

  it('explains the matching basis once for the section, not once per card', () => {
    setLoaded(
      [group('Matched Group', { interests: ['Walking'], goals: [] })],
      [challenge('Matched Challenge', 'active', { interests: [], goals: ['Build strength'], domains: [] })],
    );
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getAllByText(/ranked by your interests and goals/).length).toBe(1);
    expect(screen.queryByText(/Suggested because/)).toBeNull();
    // Cards carry label-level chips only.
    expect(screen.getByText('Walking')).toBeTruthy();
    expect(screen.getByText('Build strength')).toBeTruthy();
  });

  it('keeps Group admission and Challenge participation rules visible', () => {
    setLoaded([group('Approval Group')], [challenge('Approval Challenge')]);
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByText(/Request to join; the Group must approve/)).toBeTruthy();
    expect(screen.getByText(/approval is required before taking part/)).toBeTruthy();
  });

  it('never offers a Challenge join on the Today surface', () => {
    setLoaded([], [challenge('No join here')]);
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.queryByRole('button', { name: /Join Challenge/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Join Group/ })).toBeNull();
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

  it('makes no matching claim while the suggestions are still loading', () => {
    mocks.groups = { isLoading: true };
    mocks.challenges = { isLoading: true };
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByRole('status').textContent).toContain('Finding suggestions');
    expect(screen.queryByText(/match your interests/)).toBeNull();
    expect(screen.queryByText(/None of these suggestions/)).toBeNull();
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

  it('announces automatic later-page loading without starting a duplicate request', () => {
    const excluded = Array.from({ length: 12 }, (_, index) => ({ ...group(`Joined ${index}`), viewerRelationship: 'member' as const }));
    const fetchNextPage = setLoaded(excluded, [], { hasNextPage: true, isFetchingNextPage: true });
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByRole('status').textContent).toContain('Finding more suggestions');
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('stops a repeated cursor and reports a pagination error', () => {
    const excluded = Array.from({ length: 12 }, (_, index) => ({ ...group(`Joined ${index}`), viewerRelationship: 'member' as const }));
    const fetchNextPage = setLoaded(excluded, [], {
      data: { pages: [{ groups: excluded, nextCursor: 'cursor-1' }, { groups: excluded, nextCursor: 'cursor-1' }], pageParams: [undefined, 'cursor-1'] },
      hasNextPage: true,
    });
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByRole('alert').textContent).toContain('continue loading suggestions');
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('keeps loaded cards and reports a failed later page', () => {
    const excluded = Array.from({ length: 12 }, (_, index) => ({ ...group(`Joined ${index}`), viewerRelationship: 'member' as const }));
    const fetchNextPage = setLoaded([group('Already eligible')], [], {
      hasNextPage: true, isError: true, isFetchNextPageError: true,
      data: { pages: [{ groups: [group('Already eligible')], nextCursor: 'cursor-1' }], pageParams: [undefined] },
    });
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByText('Already eligible')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Showing what is available now');
    expect(fetchNextPage).not.toHaveBeenCalled();
    expect(excluded).toHaveLength(12);
  });

  it('reports a service error without claiming anything about matches', () => {
    mocks.groups = { isLoading: true };
    mocks.challenges = { isLoading: false, isError: true, isSuccess: false };
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByRole('alert').textContent).toContain('couldn’t load all suggestions');
    expect(screen.queryByText(/None of these suggestions/)).toBeNull();
  });

  it('continues from an entirely closed first page to recommend an eligible second-page Challenge', async () => {
    const firstPage = challengePage([closedChallenge('Closed first page')], 'cursor-1');
    const fetchNextPage = setChallengePages([firstPage], { hasNextPage: true });
    const view = render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(1));
    const secondPage = challengePage([challenge('Eligible second page')]);
    mocks.challenges = {
      ...mocks.challenges,
      data: { pages: [firstPage, secondPage], pageParams: [undefined, 'cursor-1'] },
      hasNextPage: false,
    };
    view.rerender(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(await screen.findByText('Eligible second page')).toBeTruthy();
    expect(screen.queryByText('Closed first page')).toBeNull();
  });

  it('keeps paging past several closed pages until the API returns an eligible Challenge', async () => {
    const first = challengePage([closedChallenge('Closed one')], 'cursor-1');
    const fetchNextPage = setChallengePages([first], { hasNextPage: true });
    const view = render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(1));

    const second = challengePage([closedChallenge('Closed two')], 'cursor-2');
    mocks.challenges = { ...mocks.challenges, data: { pages: [first, second], pageParams: [undefined, 'cursor-1'] }, hasNextPage: true };
    view.rerender(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(2));

    const third = challengePage([closedChallenge('Closed three')], 'cursor-3');
    mocks.challenges = { ...mocks.challenges, data: { pages: [first, second, third], pageParams: [undefined, 'cursor-1', 'cursor-2'] }, hasNextPage: true };
    view.rerender(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(3));

    const fourth = challengePage([challenge('Eligible fourth page')]);
    mocks.challenges = { ...mocks.challenges, data: { pages: [first, second, third, fourth], pageParams: [undefined, 'cursor-1', 'cursor-2', 'cursor-3'] }, hasNextPage: false };
    view.rerender(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(await screen.findByText('Eligible fourth page')).toBeTruthy();
  });

  it('ranks matched results across pages and keeps the unmatched fallback out once matches exist', async () => {
    const unmatched = challenge('Unmatched early result');
    const matchedOne = challenge('Matched first', 'active', { interests: ['Walking'], goals: [], domains: [] });
    const first = challengePage([unmatched], 'cursor-1');
    const fetchNextPage = setChallengePages([first], { hasNextPage: true });
    const view = render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(1));

    const second = challengePage([matchedOne, challenge('Matched second', 'active', { interests: ['Cycling'], goals: [], domains: [] })], 'cursor-2');
    mocks.challenges = { ...mocks.challenges, data: { pages: [first, second], pageParams: [undefined, 'cursor-1'] }, hasNextPage: true };
    view.rerender(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(2));

    const third = challengePage([challenge('Matched third', 'active', { interests: ['Yoga'], goals: [], domains: [] })]);
    mocks.challenges = { ...mocks.challenges, data: { pages: [first, second, third], pageParams: [undefined, 'cursor-1', 'cursor-2'] }, hasNextPage: false };
    view.rerender(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    const list = suggestionList(view.container);
    expect(list.textContent).toContain('Matched first');
    expect(list.textContent).toContain('Matched second');
    expect(list.textContent).toContain('Matched third');
    expect(list.textContent).not.toContain('Unmatched early result');
    expect(list.textContent?.indexOf('Matched first')).toBeLessThan(list.textContent?.indexOf('Matched second') ?? -1);
    expect(list.textContent).not.toContain('Suggested because');
  });

  it('keeps the eligible unmatched fallback across pages and stops after three recommendations', async () => {
    const first = challengePage([closedChallenge('Closed first page')], 'cursor-1');
    const fetchNextPage = setChallengePages([first], { hasNextPage: true });
    const view = render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(1));

    const second = challengePage([challenge('Unmatched first'), challenge('Unmatched second')], 'cursor-2');
    mocks.challenges = { ...mocks.challenges, data: { pages: [first, second], pageParams: [undefined, 'cursor-1'] }, hasNextPage: true };
    view.rerender(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(2));

    const third = challengePage([challenge('Unmatched third')], 'cursor-3');
    mocks.challenges = { ...mocks.challenges, data: { pages: [first, second, third], pageParams: [undefined, 'cursor-1', 'cursor-2'] }, hasNextPage: true };
    view.rerender(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    const list = suggestionList(view.container);
    expect(list.querySelectorAll('li')).toHaveLength(3);
    expect(list.textContent).toContain('Unmatched first');
    expect(list.textContent).toContain('Unmatched second');
    expect(list.textContent).toContain('Unmatched third');
    expect(fetchNextPage).toHaveBeenCalledTimes(2);
  });

  it('deduplicates Challenge IDs across pages and keeps first-seen server order', async () => {
    const first = challengePage([challenge('Duplicate original')], 'cursor-1');
    const duplicateWithLaterTitle = { ...challenge('Duplicate later'), challengeId: 'Duplicate original' };
    const fetchNextPage = setChallengePages([first], { hasNextPage: true });
    const view = render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(1));

    const second = challengePage([duplicateWithLaterTitle, challenge('Second page result')], 'cursor-2');
    mocks.challenges = { ...mocks.challenges, data: { pages: [first, second], pageParams: [undefined, 'cursor-1'] }, hasNextPage: true };
    view.rerender(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(2));

    const third = challengePage([challenge('Third page result')]);
    mocks.challenges = { ...mocks.challenges, data: { pages: [first, second, third], pageParams: [undefined, 'cursor-1', 'cursor-2'] }, hasNextPage: false };
    view.rerender(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    const list = suggestionList(view.container);
    expect(list.textContent).toContain('Duplicate original');
    expect(list.textContent).not.toContain('Duplicate later');
    expect(list.textContent).toContain('Third page result');
    expect(list.querySelectorAll('li')).toHaveLength(3);
  });

  it('stops repeated Challenge cursors and reports that pagination stalled', async () => {
    const first = challengePage([closedChallenge('Closed before repeat')], 'cursor-1');
    const fetchNextPage = setChallengePages([first], { hasNextPage: true });
    const view = render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(1));

    const second = challengePage([closedChallenge('Closed repeat page')], 'cursor-1');
    mocks.challenges = { ...mocks.challenges, data: { pages: [first, second], pageParams: [undefined, 'cursor-1'] }, hasNextPage: true };
    view.rerender(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByRole('alert').textContent).toContain('continue loading suggestions');
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/no Groups or Challenges to suggest yet/)).toBeNull();
  });

  it('announces Challenge page loading without issuing a duplicate request', () => {
    const first = challengePage([closedChallenge('Closed first page')], 'cursor-1');
    const fetchNextPage = setChallengePages([first], { hasNextPage: true, isFetchingNextPage: true });
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByRole('status').textContent).toContain('Finding more suggestions');
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('shows an empty state only after Challenge discovery is exhausted', () => {
    const fetchNextPage = setChallengePages([challengePage([closedChallenge('No eligible result')])]);
    setLoaded([], []);
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByText(/no Groups or Challenges to suggest yet/)).toBeTruthy();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('preserves earlier eligible Challenge cards when a later page fails', () => {
    const first = challengePage([challenge('Already available')], 'cursor-1');
    const fetchNextPage = setChallengePages([first], { hasNextPage: true, isError: true, isFetchNextPageError: true });
    render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(screen.getByText('Already available')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Showing what is available now');
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('keeps pending Group membership restrictions visible on paged Challenge recommendations', async () => {
    const pendingChallenge = {
      ...challenge('Pending host Group'),
      host: { groupId: 'g', groupName: 'Host Group', admissionMode: 'approval' as const, viewerRelationship: 'pending' as const },
    };
    const first = challengePage([closedChallenge('Closed first page')], 'cursor-1');
    const fetchNextPage = setChallengePages([first], { hasNextPage: true });
    const view = render(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(1));

    const second = challengePage([pendingChallenge]);
    mocks.challenges = { ...mocks.challenges, data: { pages: [first, second], pageParams: [undefined, 'cursor-1'] }, hasNextPage: false };
    view.rerender(<MemoryRouter><V2TodaySuggestedForYou /></MemoryRouter>);

    expect(await screen.findByText('Pending host Group')).toBeTruthy();
    expect(screen.getByText(/Group request is awaiting approval/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View Challenge' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Join Challenge/ })).toBeNull();
  });
});
