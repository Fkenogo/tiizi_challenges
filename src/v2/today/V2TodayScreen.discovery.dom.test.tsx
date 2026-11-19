import { cleanup, render, screen } from '@testing-library/react';
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
vi.mock('../groups/useV2Groups', () => ({ useV2GroupDiscovery: () => h.groups }));
vi.mock('../challenges/useChallengeDiscovery', () => ({ useV2ChallengeDiscovery: () => h.challenges }));

import { V2TodayScreen } from './V2TodayScreen';

function discoverableGroup(id: string): V2DiscoverableGroup {
  return { id, name: id, description: '', tagline: '', coverId: null, location: '', focusTags: [], goals: [], memberCount: 3,
    admissionMode: 'open', viewerRelationship: 'none', relevance: { interests: [], goals: [] } };
}

function discoverableChallenge(id: string): V2DiscoverableChallenge {
  return { challengeId: id, groupId: `group-${id}`, groupName: `Host ${id}`, activities: [], title: id, description: '',
    challengeType: 'collective', status: 'active', startDate: '2026-11-01', endDate: '2026-11-30', timezone: 'UTC',
    governingToday: '2026-11-04', finalized: false, currentConfigVersion: 1, goalValue: null, goalUnit: null,
    collectiveTotal: 0, collectiveGoalReached: false, completionsCount: 0, myParticipation: null,
    host: { groupId: `group-${id}`, groupName: `Host ${id}`, admissionMode: 'open', viewerRelationship: 'none' },
    relevance: { interests: [], goals: [], domains: [] } };
}

function projection(activeChallengeCount: number, joinedChallengeProgress: V2TodayProjection['joinedChallengeProgress'] = []): V2TodayProjection {
  return { todayContext: { serverNow: '2026-11-04T12:00:00.000Z', activeChallengeCount, timezoneContexts: [] },
    requiredToday: [], joinedChallengeProgress, groupChallengeOpportunities: [], upcoming: [], finalizedResults: [],
    unsupportedSections: { invitations: { available: false, disposition: 'deferred' }, communityMoments: { available: false, disposition: 'deferred' }, notifications: { available: false, disposition: 'deferred' } },
    projection: { authority: 'existing_challenge_reads', countdown: 'omitted_boundary_equivalence_unproven' } };
}

function setScreen(activeChallengeCount: number, joined: V2TodayProjection['joinedChallengeProgress'] = []) {
  h.today = { data: projection(activeChallengeCount, joined), isLoading: false, isError: false, refetch: vi.fn() };
  h.identity = { displayName: 'Dada' };
  h.preferences = { data: null };
  h.memberships = { data: { memberId: 'dada-member', memberships: [], pendingMemberships: [] } };
  h.ownChallenges = { data: { challenges: joined }, isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() };
  h.groups = { data: { pages: [{ groups: [discoverableGroup('Public walkers')] }] }, isLoading: false, isError: false, isSuccess: true };
  h.challenges = { data: { pages: [{ challenges: [discoverableChallenge('Morning movement')] }] }, isLoading: false, isError: false, isSuccess: true };
}

beforeEach(() => setScreen(0));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Today new-member discovery rendering boundary', () => {
  it('renders authorized fallback cards for a new zero-active member with no preference matches', () => {
    render(<MemoryRouter><V2TodayScreen /></MemoryRouter>);
    expect(screen.getByText('0 active Challenges')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Discover what fits you' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Groups to explore' })).toBeTruthy();
    expect(screen.getByText('Public walkers')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Challenges to explore' })).toBeTruthy();
    expect(screen.getByText('Morning movement')).toBeTruthy();
    expect(screen.queryByText(/Suggested because/)).toBeNull();
    const discovery = screen.getByRole('heading', { name: 'Discover what fits you' });
    const zeroState = screen.getByText('Start with a Group');
    expect(discovery.compareDocumentPosition(zeroState) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the existing active-Challenge Today experience and hides discovery', () => {
    const joined = [{ challengeId: 'joined-one', title: 'My active Challenge', challengeType: 'collective' as const,
      group: { groupId: 'member-group', name: 'My Group' }, lifecycleState: 'active' as const, governingToday: '2026-11-04',
      timezone: 'UTC', startDate: '2026-11-01', endDate: '2026-11-30', detailPath: '/v2/challenges/joined-one',
      progress: { groupTotal: 4, target: 20, unit: 'steps', goalReached: false, memberContribution: 2 } }];
    setScreen(1, joined);
    render(<MemoryRouter><V2TodayScreen /></MemoryRouter>);
    expect(screen.getByText('1 active Challenge')).toBeTruthy();
    expect(screen.getByText('My active Challenge')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Discover what fits you' })).toBeNull();
  });
});
