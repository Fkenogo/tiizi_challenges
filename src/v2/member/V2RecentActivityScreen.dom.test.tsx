import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { MemberRecentActivityItem } from '../../api/memberRecentActivityApi';
import type { PersonalTimelineItem } from '../../api/memberTimelineApi';

interface MockHistoryState {
  data?: { pages: Array<{ items: PersonalTimelineItem[]; nextCursor: string | null }> };
  isLoading: boolean;
  isError: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isFetchNextPageError?: boolean;
  fetchNextPage: () => unknown;
  refetch: () => unknown;
}

interface MockPreviewState {
  data?: { items: MemberRecentActivityItem[] };
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}

const h = vi.hoisted(() => ({
  history: {} as MockHistoryState,
  preview: {} as MockPreviewState,
  ownShare: { data: null, isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() },
  publish: { mutate: vi.fn(), isPending: false, error: null },
  withdraw: { mutate: vi.fn(), isPending: false, error: null },
}));

vi.mock('./personalTimelineQuery', () => ({
  useV2PersonalTimelineHistory: () => h.history,
}));
vi.mock('./recentActivityQuery', () => ({
  useV2RecentActivityPreview: () => h.preview,
}));
vi.mock('../profile/useV2MemberIdentity', () => ({
  useV2MemberIdentity: () => ({ displayName: 'Amara Test', isLoading: false }),
}));
vi.mock('../challenges/challengeFeedQuery', () => ({
  useV2ActivityShareState: () => h.ownShare,
  useV2PublishActivityShare: () => h.publish,
  useV2WithdrawActivityShare: () => h.withdraw,
}));

import { V2RecentActivityPreview, V2RecentActivityScreen } from './V2RecentActivityScreen';

const previewCurrent: MemberRecentActivityItem = {
  activityId: '00000000-0000-4000-8000-000000000001',
  activityName: 'Push-Up',
  value: 25,
  unit: 'reps',
  occurredAt: '2026-06-10T12:00:00.000Z',
  recordedAt: '2026-06-10T12:05:00.000Z',
  acceptedAt: '2026-06-10T12:05:00.000Z',
  displayTimezone: 'America/New_York',
  revisionState: 'current',
  challenge: { id: '00000000-0000-4000-8000-000000000002', title: 'Summer Challenge' },
};

const previewSecond: MemberRecentActivityItem = {
  ...previewCurrent,
  activityId: '00000000-0000-4000-8000-000000000004',
  activityName: 'Walk',
  value: 2,
  unit: 'km',
  occurredAt: '2026-06-09T12:00:00.000Z',
  recordedAt: '2026-06-09T12:05:00.000Z',
  acceptedAt: '2026-06-09T12:05:00.000Z',
};

const previewThird: MemberRecentActivityItem = {
  ...previewCurrent,
  activityId: '00000000-0000-4000-8000-000000000005',
  activityName: 'Plank',
  value: 60,
  unit: 'seconds',
  occurredAt: '2026-06-08T12:00:00.000Z',
  recordedAt: '2026-06-08T12:05:00.000Z',
  acceptedAt: '2026-06-08T12:05:00.000Z',
};

const activityLoggedCurrent: PersonalTimelineItem = {
  timelineEventId: 'activity_logged:00000000-0000-4000-8000-000000000001',
  eventType: 'activity_logged',
  category: 'activity',
  label: 'Logged activity',
  recordedAt: '2026-06-10T12:05:00.000Z',
  performedAt: '2026-06-10T12:00:00.000Z',
  displayTimezone: 'America/New_York',
  navigation: {
    kind: 'challenge',
    path: '/v2/challenges/00000000-0000-4000-8000-000000000002',
    accessible: true,
  },
  challenge: {
    id: '00000000-0000-4000-8000-000000000002',
    title: 'Summer Challenge',
    challengeType: 'collective',
    accessible: true,
  },
  activity: {
    activityId: '00000000-0000-4000-8000-000000000001',
    activityName: 'Push-Up',
    value: 25,
    unit: 'reps',
    acceptedAt: '2026-06-10T12:05:00.000Z',
    revisionState: 'current',
  },
};

const activityLoggedUpdated: PersonalTimelineItem = {
  ...activityLoggedCurrent,
  timelineEventId: 'activity_logged:00000000-0000-4000-8000-000000000006',
  recordedAt: '2026-06-10T13:05:00.000Z',
  activity: {
    ...activityLoggedCurrent.activity!,
    activityId: '00000000-0000-4000-8000-000000000006',
    activityName: 'Walk',
    value: 5,
    unit: 'km',
    revisionState: 'updated',
  },
};

const activityLoggedReversed: PersonalTimelineItem = {
  ...activityLoggedCurrent,
  timelineEventId: 'activity_logged:00000000-0000-4000-8000-000000000003',
  activity: {
    ...activityLoggedCurrent.activity!,
    activityId: '00000000-0000-4000-8000-000000000003',
    revisionState: 'reversed',
  },
};

const groupCreatedEvent: PersonalTimelineItem = {
  timelineEventId: 'group_created:00000000-0000-4000-8000-000000000011',
  eventType: 'group_created',
  category: 'group',
  label: 'Created Group',
  recordedAt: '2026-06-09T10:00:00.000Z',
  performedAt: null,
  displayTimezone: null,
  navigation: {
    kind: 'group',
    path: '/v2/groups/00000000-0000-4000-8000-000000000011',
    accessible: true,
  },
  group: {
    id: '00000000-0000-4000-8000-000000000011',
    name: 'Sunrise Crew',
    isPrivate: false,
    accessible: true,
  },
};

const groupJoinedEvent: PersonalTimelineItem = {
  timelineEventId: 'group_joined:00000000-0000-4000-8000-000000000012',
  eventType: 'group_joined',
  category: 'group',
  label: 'Joined Group',
  recordedAt: '2026-06-08T10:00:00.000Z',
  performedAt: null,
  displayTimezone: null,
  navigation: {
    kind: 'group',
    path: '/v2/groups/00000000-0000-4000-8000-000000000012',
    accessible: true,
  },
  group: {
    id: '00000000-0000-4000-8000-000000000012',
    name: 'Evening Walkers',
    isPrivate: false,
    accessible: true,
  },
};

const groupLeftEvent: PersonalTimelineItem = {
  timelineEventId: 'group_left:00000000-0000-4000-8000-000000000013',
  eventType: 'group_left',
  category: 'group',
  label: 'Left Group',
  recordedAt: '2026-06-07T10:00:00.000Z',
  performedAt: null,
  displayTimezone: null,
  navigation: {
    kind: 'group',
    path: '/v2/groups/00000000-0000-4000-8000-000000000013',
    accessible: true,
  },
  group: {
    id: '00000000-0000-4000-8000-000000000013',
    name: 'Trail Club',
    isPrivate: false,
    accessible: true,
  },
};

const challengeCreatedEvent: PersonalTimelineItem = {
  timelineEventId: 'challenge_created:00000000-0000-4000-8000-000000000021',
  eventType: 'challenge_created',
  category: 'challenge',
  label: 'Created Challenge',
  recordedAt: '2026-06-06T10:00:00.000Z',
  performedAt: null,
  displayTimezone: 'UTC',
  navigation: {
    kind: 'challenge',
    path: '/v2/challenges/00000000-0000-4000-8000-000000000021',
    accessible: true,
  },
  challenge: {
    id: '00000000-0000-4000-8000-000000000021',
    title: 'June Plank Sprint',
    challengeType: 'streak',
    accessible: true,
  },
};

const challengeJoinedEvent: PersonalTimelineItem = {
  timelineEventId: 'challenge_joined:00000000-0000-4000-8000-000000000022',
  eventType: 'challenge_joined',
  category: 'challenge',
  label: 'Joined Challenge',
  recordedAt: '2026-06-05T10:00:00.000Z',
  performedAt: null,
  displayTimezone: 'UTC',
  navigation: {
    kind: 'challenge',
    path: '/v2/challenges/00000000-0000-4000-8000-000000000022',
    accessible: true,
  },
  challenge: {
    id: '00000000-0000-4000-8000-000000000022',
    title: 'Daily Steps',
    challengeType: 'competitive',
    accessible: true,
  },
};

const challengeExitedEvent: PersonalTimelineItem = {
  timelineEventId: 'challenge_exited:00000000-0000-4000-8000-000000000023',
  eventType: 'challenge_exited',
  category: 'challenge',
  label: 'Withdrew from Challenge',
  recordedAt: '2026-06-04T10:00:00.000Z',
  performedAt: null,
  displayTimezone: 'UTC',
  navigation: {
    kind: 'challenge',
    path: '/v2/challenges/00000000-0000-4000-8000-000000000023',
    accessible: true,
  },
  challenge: {
    id: '00000000-0000-4000-8000-000000000023',
    title: 'Spring Run',
    challengeType: 'collective',
    accessible: true,
  },
  exit: {
    participationId: '00000000-0000-4000-8000-000000000023',
    exitReason: 'withdrawn',
  },
};

const challengeFinalizedEvent: PersonalTimelineItem = {
  timelineEventId: 'challenge_finalized:00000000-0000-4000-8000-000000000024',
  eventType: 'challenge_finalized',
  category: 'result',
  label: 'Challenge result recorded',
  recordedAt: '2026-06-03T10:00:00.000Z',
  performedAt: null,
  displayTimezone: 'America/New_York',
  navigation: {
    kind: 'challenge',
    path: '/v2/challenges/00000000-0000-4000-8000-000000000024',
    accessible: true,
  },
  challenge: {
    id: '00000000-0000-4000-8000-000000000024',
    title: 'May Marathon',
    challengeType: 'collective',
    accessible: true,
  },
  result: {
    participationId: '00000000-0000-4000-8000-000000000024',
    completed: true,
    completedAt: '2026-06-03T10:00:00.000Z',
    finalPosition: null,
    daysCompleted: null,
    bestStreak: null,
    finalStreak: null,
    collectiveTotal: 120,
    collectiveGoalReached: true,
    goalValue: 100,
    goalUnit: 'km',
  },
};

const inaccessiblePrivateGroupEvent: PersonalTimelineItem = {
  timelineEventId: 'redacted:group_joined:opaque-hash-1',
  eventType: 'group_joined',
  category: 'group',
  label: 'Joined a Group',
  recordedAt: '2026-06-02T10:00:00.000Z',
  performedAt: null,
  displayTimezone: null,
  navigation: { kind: 'none', path: null, accessible: false },
};

const inaccessiblePrivateActivityEvent: PersonalTimelineItem = {
  timelineEventId: 'redacted:activity_logged:opaque-hash-2',
  eventType: 'activity_logged',
  category: 'activity',
  label: 'Logged an activity',
  recordedAt: '2026-06-01T10:00:00.000Z',
  performedAt: null,
  displayTimezone: null,
  navigation: { kind: 'none', path: null, accessible: false },
};

function setHistory(items: PersonalTimelineItem[] = [activityLoggedCurrent]) {
  h.history = {
    data: { pages: [{ items, nextCursor: items.length ? 'next-cursor' : null }] },
    isLoading: false,
    isError: false,
    hasNextPage: items.length > 0,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  };
  h.preview = { data: { items: [previewCurrent] }, isLoading: false, isError: false, refetch: vi.fn() };
}

beforeEach(() => setHistory([activityLoggedCurrent, activityLoggedReversed]));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Personal Activity History (/v2/activity) and Today preview', () => {
  it('renders all eight supported event types in server-provided chronological order', () => {
    const allEight = [
      activityLoggedCurrent,
      groupCreatedEvent,
      groupJoinedEvent,
      groupLeftEvent,
      challengeCreatedEvent,
      challengeJoinedEvent,
      challengeExitedEvent,
      challengeFinalizedEvent,
    ];
    setHistory(allEight);

    const { container } = render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);

    const rows = Array.from(container.querySelectorAll('ol > li'));
    expect(rows).toHaveLength(8);
    expect(rows[0].textContent).toContain('Logged activity · Push-Up · 25 reps');
    expect(rows[1].textContent).toContain('Created Group · Sunrise Crew');
    expect(rows[2].textContent).toContain('Joined Group · Evening Walkers');
    expect(rows[3].textContent).toContain('Left Group · Trail Club');
    expect(rows[4].textContent).toContain('Created Challenge · June Plank Sprint');
    expect(rows[5].textContent).toContain('Joined Challenge · Daily Steps');
    expect(rows[6].textContent).toContain('Withdrew from Challenge · Spring Run');
    expect(rows[7].textContent).toContain('Challenge result recorded · May Marathon');
    expect(rows[7].textContent).toContain('Goal reached · 120 km / 100 km');

    expect(screen.getByRole('link', { name: 'View Group details: Sunrise Crew' }).getAttribute('href'))
      .toBe('/v2/groups/00000000-0000-4000-8000-000000000011');
    expect(screen.getByRole('link', { name: 'View Challenge details: May Marathon' }).getAttribute('href'))
      .toBe('/v2/challenges/00000000-0000-4000-8000-000000000024');
  });

  it('shows performed and recorded times, timezone, updated/reversed states, and enforces Share eligibility', () => {
    setHistory([activityLoggedCurrent, activityLoggedUpdated, activityLoggedReversed]);
    render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeTruthy();
    expect(screen.getAllByText('Performed')).toHaveLength(3);
    expect(screen.getAllByText('Recorded')).toHaveLength(3);
    expect(screen.getAllByText('Times shown in America/New_York')).toHaveLength(3);
    expect(screen.getByText('Updated')).toBeTruthy();
    expect(screen.getByText('Reversed')).toBeTruthy();

    // Share is offered for current & updated activities, but NOT for reversed activity
    expect(screen.getByRole('button', { name: 'Share Push-Up activity' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share Walk activity' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Share .* activity$/ })).toHaveLength(2);
    expect(h.publish.mutate).not.toHaveBeenCalled();
  });

  it('renders only generic label and permitted date for inaccessible private entities with no links or Share', () => {
    setHistory([inaccessiblePrivateGroupEvent, inaccessiblePrivateActivityEvent]);
    render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);

    expect(screen.getByText('Joined a Group')).toBeTruthy();
    expect(screen.getByText('Logged an activity')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /View Group|View Challenge/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Share / })).toBeNull();
    expect(screen.queryByText('Performed')).toBeNull();
  });

  it('opens the same share-later selector from an eligible owner Activity History entry without auto-publishing', () => {
    setHistory([activityLoggedCurrent]);
    render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);

    expect(h.publish.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Share Push-Up activity' }));
    expect(screen.getByRole('region', { name: /Activity Recorded/ })).toBeTruthy();
    const panel = document.querySelector('[aria-labelledby="activity-share-title"]');
    expect(panel?.textContent).toContain('25 reps');
    expect(screen.getByText(/Challenge Feed preview/)).toBeTruthy();
    expect(screen.getByText('Not shared yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share to Challenge Feed' }).hasAttribute('disabled')).toBe(false);
    expect(h.publish.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Close sharing options|Close/ }));
    expect(screen.queryByRole('region', { name: /Activity Recorded/ })).toBeNull();
  });

  it('requests the next page on Load more and supports retry when next-page fetch fails', () => {
    render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(h.history.fetchNextPage).toHaveBeenCalledTimes(1);

    cleanup();
    h.history = {
      ...h.history,
      isFetchNextPageError: true,
      fetchNextPage: vi.fn(),
    };
    render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: "We couldn't load more history" })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(h.history.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('preserves Today preview (Activity-only) with link to full History', () => {
    h.preview = { ...h.preview, data: { items: [previewCurrent, previewSecond, previewThird] } };
    const today = render(
      <MemoryRouter initialEntries={['/v2/today']}>
        <Routes>
          <Route path="/v2/today" element={<V2RecentActivityPreview />} />
          <Route path="/v2/activity" element={<V2RecentActivityScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const previewRows = today.container.querySelectorAll('ol > li');
    expect(previewRows).toHaveLength(2);
    expect(previewRows[0].textContent).toContain('Push-Up');
    expect(previewRows[1].textContent).toContain('Walk');
    expect(screen.queryByText(/Plank/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share Push-Up activity' })).toBeNull();

    fireEvent.click(screen.getByRole('link', { name: 'View all activity' }));
    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy();
  });

  it('renders honest empty, refresh-error, loading, and initial error states', () => {
    setHistory([]);
    const emptyView = render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'No history yet' })).toBeTruthy();
    emptyView.unmount();

    const refetch = vi.fn();
    h.history = {
      data: { pages: [{ items: [], nextCursor: null }] },
      isLoading: false,
      isError: true,
      hasNextPage: false,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      fetchNextPage: vi.fn(),
      refetch,
    };
    const refreshErrorView = render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: "We couldn't refresh your Personal History" })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    refreshErrorView.unmount();

    h.history = { data: undefined, isLoading: true, isError: false, fetchNextPage: vi.fn(), refetch: vi.fn() };
    const loading = render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);
    expect(screen.getByRole('status', { name: 'Loading your Personal History…' })).toBeTruthy();
    loading.unmount();

    h.history = { data: undefined, isLoading: false, isError: true, fetchNextPage: vi.fn(), refetch: vi.fn() };
    render(<MemoryRouter><V2RecentActivityScreen /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: "We couldn't load your Personal History" })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(h.history.refetch).toHaveBeenCalledTimes(1);
  });
});
