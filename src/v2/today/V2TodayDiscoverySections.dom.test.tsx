import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import type { V2DiscoverableGroup } from '../../api/groupsApi';

const h = vi.hoisted(() => ({
  groups: {} as any,
  challenges: {} as any,
  challengeCalls: [] as Array<{ ordering: unknown; includeMedia: unknown }>,
  navigate: vi.fn(),
  fetchNextGroups: vi.fn(),
  fetchNextChallenges: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => h.navigate };
});
vi.mock('../groups/useV2Groups', () => ({
  useV2GroupDiscovery: () => h.groups,
  useJoinGroup: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false, status: 'idle', submittedAt: 0 }),
}));
vi.mock('../challenges/useChallengeDiscovery', () => ({
  useV2ChallengeDiscovery: (ordering: unknown, includeMedia: unknown) => {
    h.challengeCalls.push({ ordering, includeMedia });
    return h.challenges;
  },
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'test-uid' } }) }));

import { V2TodayDiscoverySections } from './V2TodayDiscoverySections';

function group(id: string, overrides: Partial<V2DiscoverableGroup> = {}): V2DiscoverableGroup {
  return {
    id, name: id, description: `${id} description`, tagline: `${id} tagline`, coverId: null, location: 'Nairobi',
    focusTags: ['Strength'], goals: ['Build strength'], memberCount: 3,
    admissionMode: 'open', viewerRelationship: 'none', relevance: { interests: [], goals: [] },
    ...overrides,
  };
}

function challenge(id: string, overrides: Partial<V2DiscoverableChallenge> = {}): V2DiscoverableChallenge {
  return {
    challengeId: id, groupId: `group-${id}`, groupName: `Host ${id}`, activities: [], title: id, description: `${id} description`,
    challengeType: 'collective', status: 'active', startDate: '2026-11-01', endDate: '2026-11-30', timezone: 'UTC',
    governingToday: '2026-11-04', finalized: false, currentConfigVersion: 1, goalValue: 50, goalUnit: 'km',
    collectiveTotal: 10, collectiveGoalReached: false, completionsCount: 0, myParticipation: null,
    host: { groupId: `group-${id}`, groupName: `Host ${id}`, admissionMode: 'open', viewerRelationship: 'none' },
    relevance: { interests: [], goals: [], domains: [] },
    ...overrides,
  };
}

beforeEach(() => {
  h.challengeCalls = [];
  h.groups = {
    data: { pages: [{ groups: [group('Walk Nairobi')], ranking: { applied: false }, nextCursor: null }], pageParams: [undefined] },
    isLoading: false, isError: false, isSuccess: true,
    hasNextPage: false, isFetchingNextPage: false, isFetchNextPageError: false,
    fetchNextPage: h.fetchNextGroups,
  };
  h.challenges = {
    data: { pages: [{ challenges: [challenge('Morning Walk')], ranking: { applied: false }, nextCursor: null }], pageParams: [undefined] },
    isLoading: false, isError: false, isSuccess: true,
    hasNextPage: false, isFetchingNextPage: false, isFetchNextPageError: false,
    fetchNextPage: h.fetchNextChallenges,
  };
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('V2TodayDiscoverySections', () => {
  it('requests Challenge discovery with media projection and renders canonical Challenge & Group cards', () => {
    render(<MemoryRouter><V2TodayDiscoverySections /></MemoryRouter>);
    expect(h.challengeCalls.some((call) => call.ordering === 'relevance' && call.includeMedia === true)).toBe(true);
    expect(screen.getByRole('heading', { name: 'Discover Challenges' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Discover Groups' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Suggested for you' })).toBeNull();
    expect(screen.queryByText('Suggested for you')).toBeNull();

    expect(screen.getByText('Morning Walk')).toBeTruthy();
    expect(screen.getByText('Walk Nairobi')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Browse Challenges' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Browse Groups' })).toBeTruthy();
  });

  it('shows Suggested for you tag ONLY on qualifying relevant cards without interest/goal justification lists', () => {
    h.challenges.data.pages = [{
      challenges: [
        challenge('Relevant Challenge', { relevance: { interests: ['Strength'], goals: ['Build strength'], domains: [] } }),
        challenge('Unmatched Challenge', { relevance: { interests: [], goals: [], domains: [] } }),
      ],
      ranking: { applied: true },
      nextCursor: null,
    }];
    h.groups.data.pages = [{
      groups: [
        group('Relevant Group', { relevance: { interests: ['Wellness'], goals: [] } }),
        group('Unmatched Group', { relevance: { interests: [], goals: [] } }),
      ],
      ranking: { applied: true },
      nextCursor: null,
    }];

    render(<MemoryRouter><V2TodayDiscoverySections /></MemoryRouter>);

    const challengesList = screen.getByRole('list', { name: 'Discover Challenges' });
    expect(within(challengesList).getAllByRole('listitem')).toHaveLength(1);
    expect(within(challengesList).getByText('Relevant Challenge')).toBeTruthy();
    expect(within(challengesList).getByText('Suggested for you')).toBeTruthy();

    const groupsList = screen.getByRole('list', { name: 'Discover Groups' });
    expect(within(groupsList).getAllByRole('listitem')).toHaveLength(1);
    expect(within(groupsList).getByText('Relevant Group')).toBeTruthy();
    expect(within(groupsList).getByText('Suggested for you')).toBeTruthy();

    expect(screen.queryByText(/Your interests:|Your goals:|Matches your/)).toBeNull();
  });

  it('renders persisted cover images when provided and never invents substitute photography', () => {
    h.challenges.data.pages = [{
      challenges: [
        challenge('Covered Challenge', {
          coverImage: { status: 'ready', assetId: 'asset-c', contentType: 'image/jpeg', url: 'https://media.example.com/challenge-cover.jpg', width: 800, height: 400 },
        }),
      ],
      ranking: { applied: false },
      nextCursor: null,
    }];
    h.groups.data.pages = [{
      groups: [
        group('Covered Group', {
          coverImage: { status: 'ready', assetId: 'asset-g', contentType: 'image/jpeg', url: 'https://media.example.com/group-cover.jpg', width: 800, height: 400 },
        }),
      ],
      ranking: { applied: false },
      nextCursor: null,
    }];

    const { container } = render(<MemoryRouter><V2TodayDiscoverySections /></MemoryRouter>);
    const imgs = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));
    expect(imgs).toContain('https://media.example.com/challenge-cover.jpg');
    expect(imgs).toContain('https://media.example.com/group-cover.jpg');
  });

  it('navigates to Challenges and Groups discovery destinations', () => {
    render(<MemoryRouter><V2TodayDiscoverySections /></MemoryRouter>);
    screen.getByRole('button', { name: 'Browse Challenges' }).click();
    expect(h.navigate).toHaveBeenCalledWith('/v2/challenges');
    screen.getByRole('button', { name: 'Browse Groups' }).click();
    expect(h.navigate).toHaveBeenCalledWith('/v2/groups?tab=discover');
  });
});
