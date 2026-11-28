import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { PersonalTimelineItem } from '../../api/memberTimelineApi';
import type { V2TodayProjection } from '../../api/todayApi';

const h = vi.hoisted(() => ({
  today: {} as any,
  timelinePreview: {} as any,
  identity: {} as any,
  preferences: {} as any,
  memberships: {} as any,
  ownChallenges: {} as any,
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
vi.mock('../member/personalTimelineQuery', () => ({
  useV2PersonalTimelinePreview: () => h.timelinePreview,
  V2_PERSONAL_TIMELINE_PREVIEW_SIZE: 3,
}));
vi.mock('./V2TodayDiscoverySections', () => ({ V2TodayDiscoverySections: () => null }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'member-1' } }) }));

import { V2TodayScreen } from './V2TodayScreen';

function baseProjection(): V2TodayProjection {
  return {
    todayContext: {
      serverNow: '2026-11-27T12:00:00.000Z',
      activeChallengeCount: 1,
      timezoneContexts: [],
    },
    requiredToday: [],
    joinedChallengeProgress: [
      {
        challengeId: 'challenge-1',
        title: 'Active Push-Up Streak',
        challengeType: 'streak',
        detailPath: '/v2/challenges/challenge-1',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        governingDay: '2026-11-27',
        timezone: 'UTC',
        group: { id: 'g1', name: 'Sunrise Crew' },
        progress: { currentStreak: 2, bestStreak: 4, daysCompleted: 2 },
      } as never,
    ],
    groupChallengeOpportunities: [],
    upcoming: [],
    finalizedResults: [
      {
        challengeId: 'finalized-challenge-1',
        title: 'November Step Sprint',
        finalized: true,
        detailPath: '/v2/challenges/finalized-challenge-1',
      },
    ],
    unsupportedSections: {
      invitations: { available: false, disposition: 'deferred' },
      communityMoments: { available: false, disposition: 'deferred' },
      notifications: { available: false, disposition: 'deferred' },
    },
    projection: {
      authority: 'existing_challenge_reads',
      countdown: 'omitted_boundary_equivalence_unproven',
    },
  };
}

const timelineItems: PersonalTimelineItem[] = [
  {
    timelineEventId: 'activity_logged:a1',
    eventType: 'activity_logged',
    category: 'activity',
    label: 'Logged activity',
    recordedAt: '2026-11-27T11:00:00.000Z',
    performedAt: '2026-11-27T10:30:00.000Z',
    displayTimezone: 'UTC',
    navigation: { kind: 'challenge', path: '/v2/challenges/challenge-1', accessible: true },
    challenge: { id: 'challenge-1', title: 'Active Push-Up Streak', challengeType: 'streak', accessible: true },
    activity: {
      activityId: 'a1',
      activityName: 'Push-Up',
      value: 25,
      unit: 'reps',
      acceptedAt: '2026-11-27T11:00:00.000Z',
      revisionState: 'current',
    },
  },
  {
    timelineEventId: 'challenge_joined:c1',
    eventType: 'challenge_joined',
    category: 'challenge',
    label: 'Joined Challenge',
    recordedAt: '2026-11-26T10:00:00.000Z',
    performedAt: null,
    displayTimezone: 'UTC',
    navigation: { kind: 'challenge', path: '/v2/challenges/challenge-1', accessible: true },
    challenge: { id: 'challenge-1', title: 'Active Push-Up Streak', challengeType: 'streak', accessible: true },
  },
  {
    timelineEventId: 'group_joined:g1',
    eventType: 'group_joined',
    category: 'group',
    label: 'Joined Group',
    recordedAt: '2026-11-25T10:00:00.000Z',
    performedAt: null,
    displayTimezone: null,
    navigation: { kind: 'group', path: '/v2/groups/g1', accessible: true },
    group: { id: 'g1', name: 'Sunrise Crew', isPrivate: false, accessible: true },
  },
];

beforeEach(() => {
  h.today = { data: baseProjection(), isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
  h.timelinePreview = { data: { items: timelineItems }, isLoading: false, isError: false, refetch: vi.fn() };
  h.identity = { displayName: 'Amara' };
  h.preferences = { data: null };
  h.memberships = { data: { memberships: [] } };
  h.ownChallenges = { data: { challenges: [] } };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('V2TodayScreen unified timeline & Recent results retirement', () => {
  it('retires standalone #today-results while rendering up to 3 unified timeline events and View all activity link', () => {
    render(<MemoryRouter><V2TodayScreen /></MemoryRouter>);

    expect(document.getElementById('today-results')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Recent results' })).toBeNull();
    // Finalized result is NOT forced into the 3-event Today preview when 3 newer events exist
    expect(screen.queryByText(/November Step Sprint/)).toBeNull();

    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeTruthy();
    expect(screen.getByText(/Logged activity · Push-Up · 25 reps/)).toBeTruthy();
    expect(screen.getByText(/Joined Challenge · Active Push-Up Streak/)).toBeTruthy();
    expect(screen.getByText(/Joined Group · Sunrise Crew/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View all activity' }).getAttribute('href')).toBe('/v2/activity');
  });

  it('shows challenge_finalized in Today preview when it is among the latest three events', () => {
    h.timelinePreview = {
      data: {
        items: [
          {
            timelineEventId: 'challenge_finalized:f1',
            eventType: 'challenge_finalized',
            category: 'result',
            label: 'Challenge result recorded',
            recordedAt: '2026-11-27T11:30:00.000Z',
            performedAt: null,
            displayTimezone: 'UTC',
            navigation: { kind: 'challenge', path: '/v2/challenges/finalized-challenge-1', accessible: true },
            challenge: { id: 'finalized-challenge-1', title: 'November Step Sprint', challengeType: 'collective', accessible: true },
            result: {
              participationId: 'f1',
              completed: true,
              completedAt: '2026-11-27T11:30:00.000Z',
              finalPosition: null,
              daysCompleted: null,
              bestStreak: null,
              finalStreak: null,
              collectiveTotal: 150,
              collectiveGoalReached: true,
              goalValue: 120,
              goalUnit: 'km',
            },
          },
          ...timelineItems.slice(0, 2),
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };

    render(<MemoryRouter><V2TodayScreen /></MemoryRouter>);
    expect(screen.getByText(/Challenge result recorded · November Step Sprint/)).toBeTruthy();
    expect(screen.getByText(/Goal reached · 150 km \/ 120 km/)).toBeTruthy();
  });
});
