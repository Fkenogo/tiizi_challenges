import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityShareState } from '../../api/challengeFeedApi';
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
  ownShare: {} as {
    data?: ActivityShareState | null;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    refetch: () => unknown;
  },
  shareStateCalls: [] as Array<{ challengeId: string; activityId: string }>,
  publish: { mutate: vi.fn(), isPending: false, error: null },
  withdraw: { mutate: vi.fn(), isPending: false, error: null },
}));

vi.mock('../member/recentActivityQuery', () => ({
  useV2LatestChallengeActivity: () => h.activity,
}));
vi.mock('../profile/useV2MemberIdentity', () => ({
  useV2MemberIdentity: () => ({ displayName: 'Amara Test', isLoading: false }),
}));
vi.mock('./challengeFeedQuery', async () => {
  const actual = await vi.importActual<typeof import('./challengeFeedQuery')>('./challengeFeedQuery');
  return {
    ...actual,
    useV2ActivityShareState: (challengeId: string, activityId: string) => {
      h.shareStateCalls.push({ challengeId, activityId });
      return h.ownShare;
    },
    useV2PublishActivityShare: () => h.publish,
    useV2WithdrawActivityShare: () => h.withdraw,
  };
});

import {
  classifyContributionShareStatus,
  V2LatestChallengeContribution,
} from './V2LatestChallengeContribution';
import { v2ActivityShareStateKey } from './challengeFeedQuery';

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

function shareRecord(overrides: Partial<ActivityShareState> = {}): ActivityShareState {
  return {
    shareId: '00000000-0000-4000-8000-000000000099',
    challengeId: current.challenge.id,
    activityEventId: current.activityId,
    publishedAt: '2026-06-10T12:06:00.000Z',
    withdrawn: false,
    visible: true,
    hiddenReason: null,
    shareGeneration: 1,
    ...overrides,
  };
}

function setActivity(item: MemberRecentActivityItem | null) {
  h.activity = { data: item, isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() };
}

function setShareState(data: ActivityShareState | null, overrides: Partial<typeof h.ownShare> = {}) {
  h.ownShare = { data, isLoading: false, isError: false, isSuccess: true, refetch: vi.fn(), ...overrides };
}

beforeEach(() => {
  h.shareStateCalls = [];
  setActivity(current);
  setShareState(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('V2LatestChallengeContribution', () => {
  it('shows never-shared activity as Private to you with compact accessible share icon and no repetitive privacy blurb', () => {
    render(<V2LatestChallengeContribution challengeId={current.challenge.id} />);

    expect(screen.getByText('Your latest contribution')).toBeTruthy();
    expect(screen.queryByText(/not automatically published to a Feed/i)).toBeNull();
    expect(screen.getByText('Push-Up')).toBeTruthy();
    expect(screen.getByText('25 reps')).toBeTruthy();
    expect(screen.getByText('Performed')).toBeTruthy();
    expect(screen.getByText('Recorded')).toBeTruthy();
    expect(screen.getAllByText('America/New_York')).toHaveLength(2);
    expect(screen.getByText('Private to you')).toBeTruthy();

    const shareButton = screen.getByRole('button', { name: 'Share Push-Up to Challenge Feed' });
    expect(shareButton.getAttribute('title')).toBe('Share to Challenge Feed');
    expect(shareButton.className).toContain('min-h-11');
    expect(shareButton.className).toContain('min-w-11');

    expect(h.shareStateCalls).toContainEqual({
      challengeId: current.challenge.id,
      activityId: current.activityId,
    });
  });

  it('opens the existing explicit Share confirmation from the compact share icon', () => {
    render(<V2LatestChallengeContribution challengeId={current.challenge.id} />);

    fireEvent.click(screen.getByRole('button', { name: 'Share Push-Up to Challenge Feed' }));
    expect(screen.getByRole('region', { name: /Activity Recorded/ })).toBeTruthy();
    expect(screen.getByText(/Challenge Feed preview/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share to Challenge Feed' }).hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /Close sharing options|Close/ }));
    expect(screen.queryByRole('region', { name: /Activity Recorded/ })).toBeNull();
  });

  it('shows already-shared visible activity as Shared to Feed without a duplicate Share button', () => {
    setShareState(shareRecord({ visible: true, hiddenReason: null }));
    render(<V2LatestChallengeContribution challengeId={current.challenge.id} />);

    expect(screen.getByText('Shared to Feed')).toBeTruthy();
    expect(screen.queryByText('Private to you')).toBeNull();
    expect(screen.queryByRole('button', { name: /Share Push-Up/i })).toBeNull();
  });

  it('transitions from Private to Shared on publish and to No longer shared on withdrawal', () => {
    const { rerender } = render(<V2LatestChallengeContribution challengeId={current.challenge.id} />);
    expect(screen.getByText('Private to you')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share Push-Up to Challenge Feed' })).toBeTruthy();

    setShareState(shareRecord({ visible: true, shareGeneration: 1 }));
    rerender(<V2LatestChallengeContribution challengeId={current.challenge.id} />);
    expect(screen.getByText('Shared to Feed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Share Push-Up/i })).toBeNull();

    setShareState(shareRecord({ visible: false, withdrawn: true, hiddenReason: 'withdrawn', shareGeneration: 2 }));
    rerender(<V2LatestChallengeContribution challengeId={current.challenge.id} />);
    expect(screen.getByText('No longer shared')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share Push-Up to Challenge Feed' })).toBeTruthy();
  });

  it('does not expose Share action for suppressed, reversed, or expired states', () => {
    setShareState(shareRecord({ visible: false, hiddenReason: 'suppressed' }));
    const { rerender } = render(<V2LatestChallengeContribution challengeId={current.challenge.id} />);
    expect(screen.getByText('Removed from Feed')).toBeTruthy();
    expect(screen.getByText(/cannot be republished/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Share Push-Up/i })).toBeNull();

    setShareState(shareRecord({ visible: false, hiddenReason: 'expired' }));
    rerender(<V2LatestChallengeContribution challengeId={current.challenge.id} />);
    expect(screen.getByText('Feed expired')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Share Push-Up/i })).toBeNull();

    setActivity({ ...current, revisionState: 'reversed' });
    setShareState(null);
    rerender(<V2LatestChallengeContribution challengeId={current.challenge.id} />);
    expect(screen.getByText('Reversed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Share Push-Up/i })).toBeNull();
  });

  it('never assumes private and offers Retry when Share-state is loading or errored', () => {
    setShareState(undefined as unknown as null, { isLoading: true, isSuccess: false });
    const { rerender } = render(<V2LatestChallengeContribution challengeId={current.challenge.id} />);
    expect(screen.getByText('Checking status…')).toBeTruthy();
    expect(screen.queryByText('Private to you')).toBeNull();
    expect(screen.queryByRole('button', { name: /Share Push-Up/i })).toBeNull();

    const refetchShare = vi.fn();
    setShareState(undefined as unknown as null, { isLoading: false, isError: true, isSuccess: false, refetch: refetchShare });
    rerender(<V2LatestChallengeContribution challengeId={current.challenge.id} />);
    expect(screen.getByText('Share status unavailable')).toBeTruthy();
    expect(screen.queryByText('Private to you')).toBeNull();
    expect(screen.queryByRole('button', { name: /Share Push-Up/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetchShare).toHaveBeenCalledTimes(1);
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

  it('shows empty, loading and retryable Activity read errors without resubmitting Activity', () => {
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

  it('isolates Share-state query keys by member uid, challengeId, and activityEventId', () => {
    expect(v2ActivityShareStateKey('uid-a', 'c1', 'a1')).not.toEqual(
      v2ActivityShareStateKey('uid-b', 'c1', 'a1'),
    );
    expect(v2ActivityShareStateKey('uid-a', 'c1', 'a1')).not.toEqual(
      v2ActivityShareStateKey('uid-a', 'c1', 'a2'),
    );
    expect(classifyContributionShareStatus(current, { isLoading: false, isError: false, isSuccess: true, data: null })).toBe('private');
  });
});
