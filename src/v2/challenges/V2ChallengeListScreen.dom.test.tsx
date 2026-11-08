import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';

const h = vi.hoisted(() => ({ own: null as any, discovery: null as any }));
vi.mock('./useChallengeCreation', () => ({ useChallengeListV2: () => h.own }));
vi.mock('./useChallengeDiscovery', () => ({ useV2ChallengeDiscovery: () => h.discovery }));
vi.mock('./V2ChallengeIntentBanner', () => ({ V2ChallengeIntentBanner: () => null }));
vi.mock('./V2DiscoverChallengeRow', () => ({ V2DiscoverChallengeRow: ({ challenge }: { challenge: V2ChallengeSummary }) => <li data-testid={`remote-${challenge.challengeId}`}>{challenge.title}</li> }));

import { V2ChallengeListScreen } from './V2ChallengeListScreen';

function row(challengeId: string, participation: string | null = null, overrides: Partial<V2ChallengeSummary> = {}): V2ChallengeSummary {
  return {
    challengeId, title: challengeId, description: '', challengeType: 'collective', status: 'active',
    startDate: '2026-01-01', endDate: '2026-12-31', timezone: 'UTC', governingToday: '2026-11-03', finalized: false,
    currentConfigVersion: 1, goalValue: 100, goalUnit: 'reps', collectiveTotal: 0, collectiveGoalReached: false,
    completionsCount: 0, groupId: `group-${challengeId}`, groupName: 'Community', activities: [{ name: 'Push-ups', domain: 'fitness', category: 'Strength', subcategory: '' }],
    myParticipation: participation ? { participationId: `part-${challengeId}`, status: participation, joinedAt: '2026-01-01', joinedConfigVersion: 1,
      progress: { logsAccepted: 2, distinctDays: 2, totalPoints: 20, completionRate: 0.2, cumulativeValues: {}, cumulativeTotal: 20, currentStreak: 2, bestStreak: 2, lastCompletedDay: null, dayStates: {}, daysCompleted: 0, completionStatus: 'in_progress', completedAt: null, finalPosition: null }, final: null } as any : null,
    ...overrides,
  };
}

function setData(groupVisible: V2ChallengeSummary[], discoverable: V2ChallengeSummary[] = []) {
  h.own = { data: { challenges: groupVisible }, isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() };
  h.discovery = {
    data: { pages: [{ challenges: discoverable, ranking: { applied: true }, nextCursor: null }] },
    dataUpdatedAt: 1, isFetchingNextPage: false, isLoading: false, isError: false, isFetchNextPageError: false,
    isSuccess: true, hasNextPage: false, refetch: vi.fn(), fetchNextPage: vi.fn(),
  };
}

function RouteStateProbe() {
  const location = useLocation();
  return <output data-testid="route-state">{location.pathname}|{JSON.stringify(location.state)}</output>;
}

beforeEach(() => setData([]));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('V2 Challenges page sections', () => {
  it('opens the approved Challenge start choice from the Create Challenge action', async () => {
    render(<MemoryRouter><RouteStateProbe /><V2ChallengeListScreen /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'Create Challenge' }));
    expect(screen.getByTestId('route-state').textContent).toBe('/v2/challenges/start|null');
  });

  it('shows a single Find interface and a suitable empty My Challenges state', () => {
    setData([], [row('remote-one')]);
    render(<MemoryRouter><V2ChallengeListScreen /></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'My Challenges' })).toBeTruthy();
    const controls = screen.getByRole('region', { name: 'Challenge search and filters' });
    const find = screen.getByRole('region', { name: 'Find Challenges' });
    expect(within(controls).getByPlaceholderText('Search Challenges…')).toBeTruthy();
    expect(within(controls).getAllByRole('button', { name: /^(Status|Type|Domain): / })).toHaveLength(3);
    expect(within(controls).queryByRole('button', { name: /Filters/ })).toBeNull();
    expect(within(find).getByText('1 found')).toBeTruthy();
    expect(screen.getByText('You have not joined a Challenge yet')).toBeTruthy();
    expect(screen.queryByText('Relevant to me')).toBeNull();
    expect(screen.queryByText('Browse all')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Explore Challenges' })).toBeNull();
  }, 15_000);

  it('does not present Group hosted rows as joined for a Steward', () => {
    setData([row('hosted-one'), row('hosted-two')]);
    render(<MemoryRouter><V2ChallengeListScreen /></MemoryRouter>);
    const mine = screen.getByRole('region', { name: 'My Challenges' });
    expect(within(mine).queryByText('hosted-one')).toBeNull();
    expect(within(mine).queryByText('hosted-two')).toBeNull();
    expect(screen.getByRole('region', { name: 'Find Challenges' }).querySelectorAll('[data-find-challenge]')).toHaveLength(2);
  });

  it('shows joined Challenges and leaves Group-visible unjoined rows in Find', async () => {
    setData([row('joined-one', 'active'), row('hosted-two')]);
    render(<MemoryRouter><RouteStateProbe /><V2ChallengeListScreen /></MemoryRouter>);
    const mine = screen.getByRole('region', { name: 'My Challenges' });
    expect(within(mine).getByText('joined-one')).toBeTruthy();
    expect(within(mine).queryByText('hosted-two')).toBeNull();
    expect(within(mine).getByRole('button', { name: 'Log Activity' })).toBeTruthy();
    expect(within(mine).getByRole('button', { name: 'View Challenge' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Find Challenges' }).querySelector('[data-find-challenge="hosted-two"]')).toBeTruthy();
    await userEvent.click(within(mine).getByRole('button', { name: 'Log Activity' }));
    expect(screen.getByTestId('route-state').textContent).toBe('/v2/challenges/joined-one|{"openLogActivity":true}');
  });

  it('uses a neutral no-photo cover while keeping type-specific progress and actions', async () => {
    setData([
      row('together', 'active', { collectiveTotal: 40, goalValue: 100, goalUnit: 'reps' }),
      row('race', 'active', { challengeType: 'competitive' }),
      row('streak', 'active', { challengeType: 'streak' }),
    ]);
    render(<MemoryRouter><V2ChallengeListScreen /></MemoryRouter>);

    const mine = screen.getByRole('region', { name: 'My Challenges' });
    await userEvent.click(within(mine).getByRole('button', { name: 'View More (1)' }));
    expect(mine.querySelectorAll('[data-my-challenge]')).toHaveLength(3);
    expect(within(mine).getAllByText('No cover photo')).toHaveLength(3);
    expect(within(mine).getByText('40 / 100 reps')).toBeTruthy();
    expect(within(mine).getByText(/2 activities logged/)).toBeTruthy();
    expect(within(mine).getByText(/2-day streak/)).toBeTruthy();
    expect(within(mine).getAllByRole('button', { name: 'View Challenge' })).toHaveLength(3);
    expect(within(mine).getAllByRole('button', { name: 'Log Activity' })).toHaveLength(3);
    expect(within(mine).queryByText(/Background [1-8]/)).toBeNull();
  });

  it('places search and three dropdown filters before My Challenges and combines selections', async () => {
    setData([row('my-joined', 'active'), row('fit-together', null, { title: 'Morning Steps' }), row('wellness-streak', null, {
      title: 'Rest Well', challengeType: 'streak', status: 'establishment', activities: [{ name: 'Sleep', domain: 'wellness', category: 'Rest', subcategory: '' }],
    }), row('wellness-race', null, { title: 'Mindful Run', challengeType: 'competitive', activities: [{ name: 'Breathing', domain: 'wellness', category: 'Mindfulness', subcategory: '' }] })]);
    render(<MemoryRouter><V2ChallengeListScreen /></MemoryRouter>);
    const controls = screen.getByRole('region', { name: 'Challenge search and filters' });
    const mine = screen.getByRole('region', { name: 'My Challenges' });
    const found = () => screen.getByRole('region', { name: 'Find Challenges' }).querySelectorAll('[data-find-challenge]').length;
    expect(controls.compareDocumentPosition(mine) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(controls).getAllByRole('searchbox')).toHaveLength(1);
    const status = within(controls).getByRole('button', { name: 'Status: All Statuses' });
    const type = within(controls).getByRole('button', { name: 'Type: All Types' });
    const domain = within(controls).getByRole('button', { name: 'Domain: All Domains' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByText('Filters active')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();

    const user = userEvent.setup();
    await user.tab(); await user.tab(); await user.tab(); await user.tab();
    expect(document.activeElement).toBe(status);
    await user.keyboard('{Enter}');
    expect(screen.getAllByRole('listbox')).toHaveLength(1);
    expect(within(screen.getByRole('listbox', { name: 'Status' })).getAllByRole('option').map((o) => o.textContent)).toEqual(['All Statuses✓', 'Active', 'Upcoming', 'Complete']);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(status);
    expect(within(controls).getByRole('button', { name: 'Status: Active' })).toBe(status);
    expect(found()).toBe(2);
    expect(screen.getByText('Filters active')).toBeTruthy();

    await user.click(type);
    await user.click(domain);
    expect(screen.getAllByRole('listbox')).toHaveLength(1);
    expect(screen.getByRole('listbox', { name: 'Domain' })).toBeTruthy();
    await user.click(within(screen.getByRole('listbox', { name: 'Domain' })).getByRole('option', { name: 'Wellness' }));
    expect(found()).toBe(1);
    await user.click(type);
    await user.click(within(screen.getByRole('listbox', { name: 'Type' })).getByRole('option', { name: 'Streak' }));
    expect(found()).toBe(0);
    await user.click(type);
    await user.click(within(screen.getByRole('listbox', { name: 'Type' })).getByRole('option', { name: 'Race' }));
    expect(found()).toBe(1);
    expect(within(mine).getByText('my-joined')).toBeTruthy();

    await user.click(type);
    expect(screen.getByRole('listbox', { name: 'Type' })).toBeTruthy();
    await user.click(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    await user.click(status);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(status);

    await user.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(within(controls).getByRole('button', { name: 'Status: All Statuses' })).toBeTruthy();
    expect(within(controls).getByRole('button', { name: 'Type: All Types' })).toBeTruthy();
    expect(within(controls).getByRole('button', { name: 'Domain: All Domains' })).toBeTruthy();
    expect(screen.queryByText('Filters active')).toBeNull();
    expect(found()).toBe(3);
    expect(controls.querySelector('[aria-label^="Remove"]')).toBeNull();
  });

  it('searches only Find, clears the query, and offers a reset from no-results', async () => {
    setData([row('joined', 'active')], [row('matching-result', null, { title: 'Morning Walk' })]);
    render(<MemoryRouter><V2ChallengeListScreen /></MemoryRouter>);
    const search = screen.getByPlaceholderText('Search Challenges…');
    await userEvent.type(search, 'morning');
    expect(screen.getByText('Morning Walk')).toBeTruthy();
    expect(screen.getByText('joined')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    await userEvent.type(search, 'no such challenge');
    expect(screen.getByText('joined')).toBeTruthy();
    expect(screen.queryByText('matching-result')).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear search and filters' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('joined')).toBeTruthy();
    expect(screen.getByText('Morning Walk')).toBeTruthy();
  });

  it('caps My Challenges at two and keeps expansion state when Find filters change', async () => {
    setData([row('joined-1', 'active'), row('joined-2', 'active'), row('joined-3', 'active'), row('joined-4', 'active')]);
    render(<MemoryRouter><V2ChallengeListScreen /></MemoryRouter>);
    const mine = screen.getByRole('region', { name: 'My Challenges' });
    expect(mine.querySelectorAll('[data-my-challenge]')).toHaveLength(2);
    await userEvent.click(within(mine).getByRole('button', { name: 'View More (2)' }));
    expect(mine.querySelectorAll('[data-my-challenge]')).toHaveLength(4);
    await userEvent.click(screen.getByRole('button', { name: 'Type: All Types' }));
    await userEvent.click(screen.getByRole('option', { name: 'Together' }));
    expect(mine.querySelectorAll('[data-my-challenge]')).toHaveLength(4);
    expect(within(mine).getByRole('button', { name: 'Show Less' })).toBeTruthy();
    await userEvent.click(within(mine).getByRole('button', { name: 'Show Less' }));
    expect(mine.querySelectorAll('[data-my-challenge]')).toHaveLength(2);
  });

  it('shows both joined Challenges without a View More control when there are exactly two', () => {
    setData([row('joined-1', 'active'), row('joined-2', 'active')]);
    render(<MemoryRouter><V2ChallengeListScreen /></MemoryRouter>);
    const mine = screen.getByRole('region', { name: 'My Challenges' });
    expect(mine.querySelectorAll('[data-my-challenge]')).toHaveLength(2);
    expect(within(mine).queryByRole('button', { name: /View More/ })).toBeNull();
  });
});
