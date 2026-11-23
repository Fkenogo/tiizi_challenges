import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MemberRecentActivityItem } from '../../api/memberRecentActivityApi';

const h = vi.hoisted(() => ({
  activity: {} as {
    data?: MemberRecentActivityItem | null;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    isFetching?: boolean;
    refetch: () => unknown;
  },
  ownShare: { data: null, isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() },
  publish: { mutate: vi.fn(), isPending: false, error: null },
  withdraw: { mutate: vi.fn(), isPending: false, error: null },
}));

vi.mock('../member/recentActivityQuery', () => ({
  useV2LatestChallengeActivity: () => h.activity,
}));
vi.mock('../profile/useV2MemberIdentity', () => ({
  useV2MemberIdentity: () => ({ displayName: 'Amara Test', isLoading: false }),
}));
vi.mock('./challengeFeedQuery', () => ({
  useV2ActivityShareState: () => h.ownShare,
  useV2PublishActivityShare: () => h.publish,
  useV2WithdrawActivityShare: () => h.withdraw,
}));

import { V2LatestChallengeContribution } from './V2LatestChallengeContribution';

const current: MemberRecentActivityItem = {
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

function setActivity(item: MemberRecentActivityItem | null) {
  h.activity = { data: item, isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('V2LatestChallengeContribution', () => {
  it('shows owner-private Activity with separate performed and recorded times', () => {
    setActivity(current);
    render(<V2LatestChallengeContribution challengeId={current.challenge.id} />);

    expect(screen.getByText('Your latest contribution')).toBeTruthy();
    expect(screen.getByText('Push-Up')).toBeTruthy();
    expect(screen.getByText('25 reps')).toBeTruthy();
    expect(screen.getByText('Performed')).toBeTruthy();
    expect(screen.getByText('Recorded')).toBeTruthy();
    expect(screen.getAllByText('America/New_York')).toHaveLength(2);
    expect(screen.getByText('Private to you')).toBeTruthy();
    expect(screen.getByText(/not automatically published to a Feed/i)).toBeTruthy();
  });
  it('opens the same owner-scoped unavailable destination selector from the latest contribution', () => {
    setActivity(current);
    render(<V2LatestChallengeContribution challengeId={current.challenge.id} />);

    fireEvent.click(screen.getByRole('button', { name: 'Share Push-Up activity' }));
    expect(screen.getByRole('region', { name: 'Sharing destinations' })).toBeTruthy();
    expect(screen.getByText('Push-Up · 25 reps')).toBeTruthy();
    expect(screen.getByText('Challenge Feed')).toBeTruthy();
    expect(screen.getByText(/Preview — not shared yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share to Challenge Feed' }).hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Close sharing options' }));
    expect(screen.queryByRole('region', { name: 'Sharing destinations' })).toBeNull();
  });

  it('hides cached Activity until the owner-scoped read has refreshed', () => {
    h.activity = {
      data: current,
      isLoading: false,
      isFetching: true,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    };
    render(<V2LatestChallengeContribution challengeId={current.challenge.id} />);

    expect(screen.getByRole('status').textContent).toContain('Refreshing your latest Activity');
    expect(screen.queryByText('25 reps')).toBeNull();
  });

  it('labels corrected values and keeps reversed history separate from active progress', () => {
    setActivity({ ...current, value: 30, revisionState: 'updated' });
    const { rerender } = render(<V2LatestChallengeContribution challengeId={current.challenge.id} />);
    expect(screen.getByText(/Updated — showing the current effective value/)).toBeTruthy();

    setActivity({ ...current, revisionState: 'reversed' });
    rerender(<V2LatestChallengeContribution challengeId={current.challenge.id} />);
    expect(screen.getByText(/Reversed — kept in your history, but not active toward Challenge progress/)).toBeTruthy();
  });

  it('shows empty, loading and retryable read errors without resubmitting Activity', () => {
    setActivity(null);
    const { rerender } = render(<V2LatestChallengeContribution challengeId={current.challenge.id} />);
    expect(screen.getByText(/No accepted Activity from you/)).toBeTruthy();

    h.activity = { isLoading: true, isError: false, isSuccess: false, refetch: vi.fn() };
    rerender(<V2LatestChallengeContribution challengeId={current.challenge.id} />);
    expect(screen.getByRole('status').textContent).toContain('Loading your latest Activity');

    const refetch = vi.fn();
    h.activity = { isLoading: false, isError: true, isSuccess: false, refetch };
    rerender(<V2LatestChallengeContribution challengeId={current.challenge.id} />);
    expect(screen.getByText('We could not load your latest Activity')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
