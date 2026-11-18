import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { V2TodayProjection } from '../../api/todayApi';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';
import { setLocalChallengeCoverPreview, removeLocalChallengeCoverPreview } from '../challenges/localChallengeCoverPreviews';

const h = vi.hoisted(() => ({ today: {} as any, identity: {} as any, preferences: {} as any, memberships: {} as any, challengeList: {} as any }));
vi.mock('./useV2Today', () => ({ useV2Today: () => h.today }));
vi.mock('../profile/useV2MemberIdentity', () => ({ useV2MemberIdentity: () => h.identity }));
vi.mock('../preferences/usePreferences', () => ({
  useV2Preferences: () => h.preferences,
  useDismissV2PreferenceReminder: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));
vi.mock('../challenges/useChallengeCreation', () => ({
  useChallengeListV2: () => h.challengeList,
  useV2Memberships: () => h.memberships,
  useChallengeDetailV2: vi.fn(),
}));

import { V2TodayScreen } from './V2TodayScreen';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function summary(challengeId: string, title: string, challengeType: V2ChallengeSummary['challengeType'], groupName: string): V2ChallengeSummary {
  return {
    challengeId, title, challengeType, groupId: `group-${challengeId}`, groupName,
    activities: [], description: '', status: 'active', governingToday: '2026-11-08', startDate: '2026-11-01', endDate: '2026-11-30', timezone: 'UTC',
    finalized: false, currentConfigVersion: 1, goalValue: null, goalUnit: null, collectiveTotal: 0, collectiveGoalReached: false,
    completionsCount: 0, myParticipation: null,
  } as V2ChallengeSummary;
}

function setToday() {
  const projection: V2TodayProjection = {
    todayContext: { serverNow: '2026-11-08T10:00:00.000Z', activeChallengeCount: 3, timezoneContexts: [] },
    requiredToday: [{
      challengeId: 'streak-photo', title: 'Morning Momentum', challengeType: 'streak', group: { groupId: 'g1', name: 'Kilimanjaro Group' },
      lifecycleState: 'active', governingToday: '2026-11-08', timezone: 'UTC', detailPath: '/v2/challenges/streak-photo',
      requirements: [{ activity: 'push-up', label: 'Push-Ups', targetValue: 20, unit: 'reps', state: 'pending' }],
      streak: { currentStreak: 3, bestStreak: 6, daysCompleted: 4, lastCompletedDay: null, completionStatus: 'in_progress', dayState: null },
    }],
    joinedChallengeProgress: [
      {
        challengeId: 'together-photo', title: 'Summit Steps Together', challengeType: 'collective', group: { groupId: 'g1', name: 'Kilimanjaro Group' },
        lifecycleState: 'active', governingToday: '2026-11-08', timezone: 'UTC', startDate: '2026-11-01', endDate: '2026-11-30', detailPath: '/v2/challenges/together-photo',
        progress: { groupTotal: 240, target: 1000, unit: 'reps', goalReached: false, memberContribution: 45 },
      },
      {
        challengeId: 'race-no-photo', title: 'Reps Race', challengeType: 'competitive', group: { groupId: 'g1', name: 'Kilimanjaro Group' },
        lifecycleState: 'active', governingToday: '2026-11-08', timezone: 'UTC', startDate: '2026-11-01', endDate: '2026-11-30', detailPath: '/v2/challenges/race-no-photo',
        progress: { completionStatus: 'in_progress', completedAt: null, finalPosition: null, activities: [{ activity: 'run', label: 'Running', memberProgress: 20, targetValue: 100, unit: 'km' }] },
      },
    ],
    groupChallengeOpportunities: [{
      challengeId: 'group-opportunity', title: 'Sunrise Reset', challengeType: 'collective', group: { groupId: 'g1', name: 'Kilimanjaro Group' },
      lifecycleState: 'establishment', startDate: '2026-11-12', endDate: '2026-12-03', timezone: 'UTC', governingToday: '2026-11-08',
      activities: [{ name: 'Walking', domain: 'fitness' }], detailPath: '/v2/challenges/group-opportunity', joinability: 'not_asserted',
    }],
    upcoming: [{ challengeId: 'upcoming-photo', title: 'Fresh Start', kind: 'starts', lifecycleDate: '2026-11-12', timezone: 'UTC', detailPath: '/v2/challenges/upcoming-photo' }],
    finalizedResults: [],
    unsupportedSections: { invitations: { available: false, disposition: 'deferred' }, communityMoments: { available: false, disposition: 'deferred' }, notifications: { available: false, disposition: 'deferred' } },
    projection: { authority: 'existing_challenge_reads', countdown: 'omitted_boundary_equivalence_unproven' },
  };
  h.today = { data: projection, isLoading: false, isError: false, refetch: vi.fn() };
  h.identity = { displayName: 'Member' };
  h.preferences = { data: null };
  h.memberships = { data: { memberId: 'member-1', memberships: [], pendingMemberships: [] } };
  h.challengeList = { data: { challenges: [summary('streak-photo', 'Morning Momentum', 'streak', 'Kilimanjaro Group'), summary('together-photo', 'Summit Steps Together', 'collective', 'Kilimanjaro Group'), summary('race-no-photo', 'Reps Race', 'competitive', 'Kilimanjaro Group'), summary('group-opportunity', 'Sunrise Reset', 'collective', 'Kilimanjaro Group'), summary('upcoming-photo', 'Fresh Start', 'streak', 'Trail Group')] }, isLoading: false, isError: false, isSuccess: true };
}

afterEach(() => {
  cleanup();
  for (const id of ['streak-photo', 'together-photo', 'group-opportunity', 'upcoming-photo']) removeLocalChallengeCoverPreview(id);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Today Challenge cover alignment', () => {
  it('shows ID-matched covers across Today sections without changing progress or actions', async () => {
    setToday();
    for (const id of ['streak-photo', 'together-photo', 'group-opportunity', 'upcoming-photo']) {
      setLocalChallengeCoverPreview(id, new File([id], `${id}.jpg`, { type: 'image/jpeg' }));
    }
    vi.stubGlobal('URL', { createObjectURL: vi.fn((file: File) => `blob:${file.name}`), revokeObjectURL: vi.fn() });

    render(<MemoryRouter><LocationProbe /><V2TodayScreen /></MemoryRouter>);

    for (const title of ['Morning Momentum', 'Summit Steps Together', 'Sunrise Reset', 'Fresh Start']) {
      await waitFor(() => expect(screen.getByRole('img', { name: `${title} cover photo` })).toBeTruthy());
    }
    expect(screen.getByLabelText('Reps Race has no cover photo')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText(/240 reps of 1,000 reps/)).toBeTruthy();
    expect(screen.getByText(/20 km of 100 km/)).toBeTruthy();
    expect(screen.getByText('Push-Ups')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Log activity' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'View Challenge' }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Trail Group/)).toBeTruthy();

    await userEvent.click(screen.getAllByRole('button', { name: 'View Challenge' })[0]);
    expect(screen.getByTestId('location').textContent).toBe('/v2/challenges/streak-photo');
  });
});
