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

function row(challengeId: string, participation: string | null = null): V2ChallengeSummary {
  return {
    challengeId, title: challengeId, description: '', challengeType: 'collective', status: 'active',
    startDate: '2026-01-01', endDate: '2026-12-31', timezone: 'UTC', governingToday: '2026-11-03', finalized: false,
    currentConfigVersion: 1, goalValue: 100, goalUnit: 'reps', collectiveTotal: 0, collectiveGoalReached: false,
    completionsCount: 0, groupId: `group-${challengeId}`, groupName: 'Community', activities: [{ name: 'Push-ups', domain: 'fitness', category: 'Strength', subcategory: '' }],
    myParticipation: participation ? { participationId: `part-${challengeId}`, status: participation, joinedAt: '2026-01-01', joinedConfigVersion: 1,
      progress: { logsAccepted: 2, distinctDays: 2, totalPoints: 20, completionRate: 0.2, cumulativeValues: {}, cumulativeTotal: 20, currentStreak: 2, bestStreak: 2, lastCompletedDay: null, dayStates: {}, daysCompleted: 0, completionStatus: 'in_progress', completedAt: null, finalPosition: null }, final: null } as any : null,
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
  it('shows a single Find interface and a suitable empty My Challenges state', () => {
    setData([], [row('remote-one')]);
    render(<MemoryRouter><V2ChallengeListScreen /></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'My Challenges' })).toBeTruthy();
    const find = screen.getByRole('region', { name: 'Find Challenges' });
    expect(within(find).getByPlaceholderText('Search Challenges…')).toBeTruthy();
    expect(within(find).getAllByRole('button', { name: 'All' })).toHaveLength(3);
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
});
