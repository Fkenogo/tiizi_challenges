import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import type { V2DiscoverableGroup } from '../../api/groupsApi';
import type { V2TodayProjection } from '../../api/todayApi';

const h = vi.hoisted(() => ({
  today: {} as any,
  identity: {} as any,
  preferences: {} as any,
  memberships: {} as any,
  ownChallenges: {} as any,
  groups: {} as any,
  challenges: {} as any,
}));

vi.mock('./useV2Today', () => ({ useV2Today: () => h.today }));
vi.mock('../profile/useV2MemberIdentity', () => ({ useV2MemberIdentity: () => h.identity }));
vi.mock('../preferences/usePreferences', () => ({
  useV2Preferences: () => h.preferences,
  useDismissV2PreferenceReminder: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));
vi.mock('../challenges/useChallengeCreation', () => ({
  useChallengeListV2: () => h.ownChallenges,
  useV2Memberships: () => h.memberships,
  useChallengeDetailV2: vi.fn(),
}));
vi.mock('../groups/useV2Groups', () => ({
  useV2GroupDiscovery: () => h.groups,
  useJoinGroup: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false, status: 'idle', submittedAt: 0 }),
}));
vi.mock('../challenges/useChallengeDiscovery', () => ({ useV2ChallengeDiscovery: () => h.challenges }));
vi.mock('../member/V2RecentActivityScreen', () => ({ V2RecentActivityPreview: () => null }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'dada-uid' } }) }));

import { V2TodayScreen } from './V2TodayScreen';

function discoverableGroup(id: string, relevance: V2DiscoverableGroup['relevance'] = { interests: [], goals: [] }): V2DiscoverableGroup {
  return {
    id, name: id, description: `${id} description`, tagline: `${id} tagline`, coverId: null, location: 'Nairobi',
    focusTags: ['Running'], goals: ['Consistency'], memberCount: 3,
    admissionMode: 'open', viewerRelationship: 'none', relevance,
  };
}

function discoverableChallenge(id: string, relevance: V2DiscoverableChallenge['relevance'] = { interests: [], goals: [], domains: [] }): V2DiscoverableChallenge {
  return {
    challengeId: id, groupId: `group-${id}`, groupName: `Host ${id}`, activities: [], title: id, description: `${id} description`,
    challengeType: 'collective', status: 'active', startDate: '2026-11-01', endDate: '2026-11-30', timezone: 'UTC',
    governingToday: '2026-11-04', finalized: false, currentConfigVersion: 1, goalValue: 100, goalUnit: 'km',
    collectiveTotal: 25, collectiveGoalReached: false, completionsCount: 0, myParticipation: null,
    host: { groupId: `group-${id}`, groupName: `Host ${id}`, admissionMode: 'open', viewerRelationship: 'none' },
    relevance,
  };
}

function projection(activeChallengeCount: number, joinedChallengeProgress: V2TodayProjection['joinedChallengeProgress'] = []): V2TodayProjection {
  return {
    todayContext: { serverNow: '2026-11-04T12:00:00.000Z', activeChallengeCount, timezoneContexts: [] },
    requiredToday: [], joinedChallengeProgress, groupChallengeOpportunities: [], upcoming: [], finalizedResults: [],
    unsupportedSections: { invitations: { available: false, disposition: 'deferred' }, communityMoments: { available: false, disposition: 'deferred' }, notifications: { available: false, disposition: 'deferred' } },
    projection: { authority: 'existing_challenge_reads', countdown: 'omitted_boundary_equivalence_unproven' },
  };
}

function setScreen(
  activeChallengeCount: number,
  joined: V2TodayProjection['joinedChallengeProgress'] = [],
  groupsList: V2DiscoverableGroup[] = [discoverableGroup('Public walkers')],
  challengesList: V2DiscoverableChallenge[] = [discoverableChallenge('Morning movement')],
) {
  h.today = { data: projection(activeChallengeCount, joined), isLoading: false, isError: false, refetch: vi.fn() };
  h.identity = { displayName: 'Dada' };
  h.preferences = { data: null };
  h.memberships = { data: { memberId: 'dada-member', memberships: [], pendingMemberships: [] } };
  h.ownChallenges = { data: { challenges: joined }, isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() };
  h.groups = { data: { pages: [{ groups: groupsList, ranking: { applied: true } }] }, isLoading: false, isError: false, isSuccess: true };
  h.challenges = { data: { pages: [{ challenges: challengesList, ranking: { applied: true } }] }, isLoading: false, isError: false, isSuccess: true };
}

beforeEach(() => setScreen(0));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Today new-member discovery rendering boundary', () => {
  it('preserves the normal Today layout without a standalone Suggested for you section', () => {
    render(<MemoryRouter><V2TodayScreen /></MemoryRouter>);
    expect(screen.getByText('0 active Challenges')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Suggested for you' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'In your Groups' })).toBeNull();

    const zeroState = screen.getByText('Start with a Group');
    const discoverChallenges = screen.getByRole('heading', { name: 'Discover Challenges' });
    const discoverGroups = screen.getByRole('heading', { name: 'Discover Groups' });
    expect(zeroState.compareDocumentPosition(discoverChallenges) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(discoverChallenges.compareDocumentPosition(discoverGroups) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.getByText('Morning movement')).toBeTruthy();
    expect(screen.getByText('Public walkers')).toBeTruthy();
    expect(screen.queryByText('Suggested for you')).toBeNull();
    expect(screen.queryByText(/Your interests:|Your goals:|Suggested because/)).toBeNull();
  });

  it('caps Today discovery at two Challenges and two Groups and tags only qualifying items', () => {
    setScreen(
      0,
      [],
      [
        discoverableGroup('Matched Group 1', { interests: ['Strength'], goals: [] }),
        discoverableGroup('Matched Group 2', { interests: [], goals: ['Build strength'] }),
        discoverableGroup('Matched Group 3', { interests: ['Strength'], goals: [] }),
      ],
      [
        discoverableChallenge('Matched Challenge 1', { interests: ['Strength'], goals: [], domains: [] }),
        discoverableChallenge('Matched Challenge 2', { interests: [], goals: [], domains: ['fitness'] }),
        discoverableChallenge('Matched Challenge 3', { interests: ['Strength'], goals: [], domains: [] }),
      ],
    );
    render(<MemoryRouter><V2TodayScreen /></MemoryRouter>);

    const challengesList = screen.getByRole('list', { name: 'Discover Challenges' });
    expect(within(challengesList).getAllByRole('listitem')).toHaveLength(2);
    expect(within(challengesList).queryByText('Matched Challenge 3')).toBeNull();

    const groupsList = screen.getByRole('list', { name: 'Discover Groups' });
    expect(within(groupsList).getAllByRole('listitem')).toHaveLength(2);
    expect(within(groupsList).queryByText('Matched Group 3')).toBeNull();

    expect(screen.getAllByText('Suggested for you')).toHaveLength(4);
    expect(screen.queryByText(/Your interests:|Your goals:|Matches your/)).toBeNull();
  });

  it('keeps the existing active-Challenge Today experience and hides discovery', () => {
    const joined = [{
      challengeId: 'joined-one', title: 'My active Challenge', challengeType: 'collective' as const,
      group: { groupId: 'member-group', name: 'My Group' }, lifecycleState: 'active' as const, governingToday: '2026-11-04',
      timezone: 'UTC', startDate: '2026-11-01', endDate: '2026-11-30', detailPath: '/v2/challenges/joined-one',
      progress: { groupTotal: 4, target: 20, unit: 'steps', goalReached: false, memberContribution: 2 },
    }];
    setScreen(1, joined);
    render(<MemoryRouter><V2TodayScreen /></MemoryRouter>);
    expect(screen.getByText('1 active Challenge')).toBeTruthy();
    expect(screen.getByText('My active Challenge')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Discover Challenges' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Discover Groups' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Suggested for you' })).toBeNull();
  });
});
