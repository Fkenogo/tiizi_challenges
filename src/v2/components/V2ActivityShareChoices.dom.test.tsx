import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MemberRecentActivityItem } from '../../api/memberRecentActivityApi';
import { ApiError } from '../../api/apiClient';
import {
  shareSourceFromAcceptedActivity,
  shareSourceFromHistoryItem,
  V2ActivityShareChoices,
} from './V2ActivityShareChoices';

const h = vi.hoisted(() => ({
  identity: { displayName: 'Amara Test', isLoading: false },
  shareState: {} as {
    data: unknown;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
    refetch: ReturnType<typeof vi.fn>;
  },
  publish: {} as {
    error: unknown;
    mutate: ReturnType<typeof vi.fn>;
    isPending: boolean;
  },
  withdraw: {} as {
    error: unknown;
    mutate: ReturnType<typeof vi.fn>;
    isPending: boolean;
  },
}));

vi.mock('../profile/useV2MemberIdentity', () => ({
  useV2MemberIdentity: () => h.identity,
}));
vi.mock('../challenges/challengeFeedQuery', () => ({
  useV2ActivityShareState: () => h.shareState,
  useV2PublishActivityShare: () => h.publish,
  useV2WithdrawActivityShare: () => h.withdraw,
}));

const item: MemberRecentActivityItem = {
  activityId: '00000000-0000-4000-8000-000000000001',
  activityName: 'Push-Up',
  value: 25,
  unit: 'reps',
  occurredAt: '2026-06-10T12:00:00.000Z',
  recordedAt: '2026-06-10T12:05:00.000Z',
  acceptedAt: '2026-06-10T12:05:00.000Z',
  displayTimezone: 'America/New_York',
  revisionState: 'updated',
  challenge: { id: '00000000-0000-4000-8000-000000000002', title: 'Summer Challenge' },
};

function activeState(overrides?: Record<string, unknown>) {
  return {
    shareId: '00000000-0000-4000-8000-00000000000a',
    challengeId: item.challenge.id,
    activityEventId: item.activityId,
    publishedAt: '2026-06-10T12:10:00.000Z',
    withdrawn: false,
    visible: true,
    hiddenReason: null,
    shareGeneration: 1,
    ...overrides,
  };
}

function resetFeed(shareStateData: unknown = null, shareStateError = false) {
  h.shareState = {
    data: shareStateData,
    isLoading: false,
    isError: shareStateError,
    isSuccess: !shareStateError,
    refetch: vi.fn(),
  };
  h.publish = {
    error: null,
    mutate: vi.fn((input: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()),
    isPending: false,
  };
  h.withdraw = {
    error: null,
    mutate: vi.fn((activityEventId: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()),
    isPending: false,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('V2ActivityShareChoices', () => {
  it('uses the accepted event identity, not the database record identity', () => {
    const accepted = {
      recordId: '00000000-0000-4000-8000-000000000009',
      eventId: item.activityId,
      challengeId: item.challenge.id,
      value: 25,
      unit: 'reps',
    };
    const source = shareSourceFromAcceptedActivity(accepted, item.activityName);
    expect(source.activityId).toBe(accepted.eventId);
    expect(source.activityId).not.toBe(accepted.recordId);
  });

  it('keeps the original history identity and effective correction state for share-later', () => {
    expect(shareSourceFromHistoryItem(item)).toMatchObject({
      activityId: item.activityId,
      challengeId: item.challenge.id,
      activityName: item.activityName,
      value: 25,
      unit: 'reps',
      revisionState: 'updated',
    });
  });

  it('previews the exact S1 fields compactly, then publishes a fresh keyed choice', async () => {
    resetFeed();
    vi.useFakeTimers();
    const onKeepPrivate = vi.fn();
    render(
      <V2ActivityShareChoices
        mode="immediate"
        source={shareSourceFromHistoryItem(item)}
        challengeTitle="Strength Challenge"
        onKeepPrivate={onKeepPrivate}
      />,
    );

    expect(screen.getByRole('heading', { name: /Activity Recorded/ })).toBeTruthy();
    expect(screen.getByText('Private')).toBeTruthy();
    expect(screen.getByText(/Challenge Feed preview/)).toBeTruthy();
    expect(screen.getByText('Not shared yet')).toBeTruthy();
    // The preview shows exactly the member's display name and the CF-01 S1
    // allow-list fields — nothing else.
    expect(screen.getByText('Amara Test')).toBeTruthy();
    const panel = document.querySelector('[aria-labelledby="activity-share-title"]');
    expect(panel?.textContent).toContain('Push-Up');
    expect(panel?.textContent).toContain('25 reps');
    // The compact sheet carries no policy essays.
    expect(panel?.textContent).not.toContain('Group Feed');
    expect(panel?.textContent).not.toContain('allow-list');
    // Immediate mode takes focus when it replaces the Done button.
    expect(document.activeElement?.getAttribute('aria-labelledby')).toBe('activity-share-title');

    fireEvent.click(screen.getByRole('button', { name: 'Share to Challenge Feed' }));
    // The mocked mutation acknowledges synchronously.
    expect(h.publish.mutate).toHaveBeenCalledTimes(1);
    const call = h.publish.mutate.mock.calls[0][0] as {
      activityEventId: string;
      clientKey: string;
      previewedValue: number;
      previewedUnit: string;
      expectedGeneration: number;
    };
    expect(call.activityEventId).toBe(item.activityId);
    expect(call.clientKey).toMatch(/^[A-Za-z0-9-]{16,64}$/);
    expect(call.previewedValue).toBe(25);
    expect(call.previewedUnit).toBe('reps');
    expect(call.expectedGeneration).toBe(0);

    // Brief confirmation, then the automatic return to the originating page.
    expect(screen.getByText(/Shared to Challenge Feed!/)).toBeTruthy();
    expect(screen.getByText('Shared to Feed')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1400); });
    expect(onKeepPrivate).toHaveBeenCalledWith({ shared: true });
  });

  it('withdraws from the shared state and closes with a brief confirmation', async () => {
    resetFeed(activeState());
    vi.useFakeTimers();
    const onKeepPrivate = vi.fn();
    render(
      <V2ActivityShareChoices
        mode="immediate"
        source={shareSourceFromHistoryItem(item)}
        challengeTitle="Strength Challenge"
        onKeepPrivate={onKeepPrivate}
      />,
    );

    expect(screen.getByText('Shared')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw Share' }));
    expect(h.withdraw.mutate).toHaveBeenCalledWith(item.activityId, expect.anything());

    // Brief confirmation, then the sheet closes — never a second choice screen.
    expect(screen.getByText(/Share removed!/)).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1400); });
    expect(onKeepPrivate).toHaveBeenCalledWith({ withdrawn: true });
  });

  it('sends the withdrawn shareGeneration on a fresh confirm after withdrawal', async () => {
    resetFeed(activeState({ visible: false, withdrawn: true, hiddenReason: 'withdrawn', shareGeneration: 2 }));
    render(
      <V2ActivityShareChoices
        mode="later"
        source={shareSourceFromHistoryItem(item)}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Share to Challenge Feed' }));
    expect(h.publish.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        activityEventId: item.activityId,
        expectedGeneration: 2,
      }),
      expect.anything(),
    );
  });

  it('share-later publishes and auto-closes in place', async () => {
    resetFeed();
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <V2ActivityShareChoices
        mode="later"
        source={shareSourceFromHistoryItem(item)}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Share to Challenge Feed' }));
    expect(h.publish.mutate).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(1400); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('never offers a Share action for reversed, suppressed or expired sources', () => {
    const later = (source = shareSourceFromHistoryItem(item)) => render(
      <V2ActivityShareChoices mode="later" source={source} onClose={vi.fn()} />,
    );

    resetFeed(activeState({ visible: false, hiddenReason: 'reversed', withdrawn: true }));
    later();
    expect(screen.getByText(/reversed and cannot be shared/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share to Challenge Feed' })).toBeNull();
    cleanup();

    resetFeed(activeState({ visible: false, hiddenReason: 'suppressed' }));
    later();
    expect(screen.getByText(/removed and cannot be republished/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share to Challenge Feed' })).toBeNull();
    cleanup();

    resetFeed(activeState({ visible: false, hiddenReason: 'expired' }));
    later();
    expect(screen.getByText(/Challenge Feed has expired/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share to Challenge Feed' })).toBeNull();
    cleanup();

    // A reversed SOURCE is refused before any server state, too.
    resetFeed();
    later({ ...shareSourceFromHistoryItem(item), revisionState: 'reversed' });
    expect(screen.getByText(/reversed and cannot be shared/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share to Challenge Feed' })).toBeNull();
  });

  it('never guesses an unknown Share state: an outage blocks sharing with a retry', () => {
    resetFeed(null, true);
    render(
      <V2ActivityShareChoices
        mode="immediate"
        source={shareSourceFromHistoryItem(item)}
        challengeTitle="Strength Challenge"
        onKeepPrivate={vi.fn()}
      />,
    );

    expect(screen.getByText(/Couldn.t confirm your Share state/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share to Challenge Feed' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(h.shareState.refetch).toHaveBeenCalled();
  });

  it('shows Checking (never Private) while the state read is pending, with a way out', () => {
    resetFeed(null);
    h.shareState = { ...h.shareState, isLoading: true, isSuccess: false };
    render(
      <V2ActivityShareChoices
        mode="immediate"
        source={shareSourceFromHistoryItem(item)}
        challengeTitle="Strength Challenge"
        onKeepPrivate={vi.fn()}
      />,
    );

    expect(screen.getByText('Checking')).toBeTruthy();
    expect(screen.queryByText('Private')).toBeNull();
    expect(screen.queryByText('Not shared yet')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share to Challenge Feed' })).toBeNull();
    // The member is never trapped: a dismissal path always exists.
    expect(screen.getByRole('button', { name: 'Continue without sharing' })).toBeTruthy();
  });

  it('renders no further actions while the brief confirmation shows', async () => {
    resetFeed();
    vi.useFakeTimers();
    render(
      <V2ActivityShareChoices
        mode="immediate"
        source={shareSourceFromHistoryItem(item)}
        challengeTitle="Strength Challenge"
        onKeepPrivate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Share to Challenge Feed' }));
    expect(screen.getByText(/Shared to Challenge Feed!/)).toBeTruthy();
    // The confirmation pause permits no second mutation and no early exit.
    expect(screen.queryByRole('button', { name: 'Withdraw Share' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Keep private and continue' })).toBeNull();
    act(() => { vi.advanceTimersByTime(1400); });
    expect(h.publish.mutate).toHaveBeenCalledTimes(1);
  });

  it('disables every action while a Share choice is in flight', () => {
    resetFeed();
    h.publish.isPending = true;
    render(
      <V2ActivityShareChoices
        mode="immediate"
        source={shareSourceFromHistoryItem(item)}
        challengeTitle="Strength Challenge"
        onKeepPrivate={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sharing…' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Keep private and continue' }).hasAttribute('disabled')).toBe(true);
  });

  it('surfaces honest refusals with terse copy for withdrawn, state-changed, reversed and changed sources', () => {
    resetFeed();
    h.publish.error = new ApiError(
      409,
      'share_withdrawn',
      'This Share was withdrawn; confirm to share it again',
    );
    render(
      <V2ActivityShareChoices
        mode="later"
        source={shareSourceFromHistoryItem(item)}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent)
      .toContain('This Share was withdrawn. Confirm again to share it.');
    cleanup();

    resetFeed();
    h.publish.error = new ApiError(
      409,
      'share_state_changed',
      'This Share state changed; review the current state and confirm again',
    );
    render(
      <V2ActivityShareChoices
        mode="later"
        source={shareSourceFromHistoryItem(item)}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent)
      .toContain('This Share state changed. Review the current state and confirm again.');
    cleanup();

    resetFeed();
    h.publish.error = new ApiError(
      409,
      'source_reversed',
      'This Activity was reversed and cannot be shared',
    );
    render(
      <V2ActivityShareChoices
        mode="later"
        source={shareSourceFromHistoryItem(item)}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent)
      .toContain('This Activity was reversed and cannot be shared.');
    cleanup();

    resetFeed();
    h.publish.error = new ApiError(
      409,
      'source_changed',
      'This Activity changed since you previewed it; preview the current version and confirm again',
    );
    render(
      <V2ActivityShareChoices
        mode="later"
        source={shareSourceFromHistoryItem(item)}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent)
      .toContain('This Activity changed since you previewed it.');
    expect(screen.getByRole('alert').textContent).not.toContain('CF-01');
    expect(screen.getByRole('alert').textContent).not.toContain('allow-list');
  });

  it('never takes focus in share-later mode, including across refresh remounts', () => {
    resetFeed();
    const outside = document.createElement('button');
    outside.textContent = 'outside control';
    document.body.appendChild(outside);
    outside.focus();
    try {
      const later = () => render(
        <V2ActivityShareChoices
          mode="later"
          source={shareSourceFromHistoryItem(item)}
          onClose={() => {}}
        />,
      );
      later();
      expect(document.activeElement).toBe(outside);
      cleanup();
      later();
      expect(document.activeElement).toBe(outside);
    } finally {
      outside.remove();
    }
  });
});
