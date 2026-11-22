import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  publish: {} as { mutate: ReturnType<typeof vi.fn>; isPending: boolean; error: unknown },
  withdraw: {} as { mutate: ReturnType<typeof vi.fn>; isPending: boolean; error: unknown },
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

function resetFeed(shareStateData: unknown = null, shareStateError = false) {
  h.shareState = {
    data: shareStateData,
    isLoading: false,
    isError: shareStateError,
    isSuccess: !shareStateError,
    refetch: vi.fn(),
  };
  h.publish = { mutate: vi.fn(), isPending: false, error: null };
  h.withdraw = { mutate: vi.fn(), isPending: false, error: null };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

    expect(source).toEqual({
      activityId: item.activityId,
      challengeId: item.challenge.id,
      activityName: item.activityName,
      value: 25,
      unit: 'reps',
      revisionState: 'current',
    });
  });

  it('keeps the original history identity and effective correction state for share-later', () => {
    expect(shareSourceFromHistoryItem(item)).toEqual({
      activityId: item.activityId,
      challengeId: item.challenge.id,
      activityName: item.activityName,
      value: item.value,
      unit: item.unit,
      revisionState: 'updated',
    });
  });

  it('previews exactly the CF-01 S1 fields, then publishes a fresh keyed choice on confirm', async () => {
    resetFeed();
    render(
      <V2ActivityShareChoices
        mode="immediate"
        source={shareSourceFromHistoryItem(item)}
        challengeTitle="Strength Challenge"
        onKeepPrivate={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Sharing destinations' })).toBeTruthy();
    expect(screen.getByText(/Preview — not shared yet/)).toBeTruthy();
    // The preview shows exactly the CF-01 S1 allow-list: display name,
    // Activity name, own accepted value and unit — never the Challenge title.
    const region = screen.getByRole('region', { name: 'Sharing destinations' });
    expect(region.textContent).toContain('Amara Test');
    expect(region.textContent).toContain('Push-Up');
    expect(region.textContent).toContain('25 reps');
    expect(screen.getByText(/Challenge title is not published/)).toBeTruthy();
    expect(screen.getByText(/return you to Strength Challenge Details/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'External sharing — unavailable' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: /Group Feed/ })).toBeNull();
    expect(screen.getByText(/Group Feed is not a destination for individual Activity/)).toBeTruthy();
    // Immediate mode takes focus when it replaces the Done button.
    expect(document.activeElement?.getAttribute('aria-labelledby')).toBe('activity-share-choices-title');

    fireEvent.click(screen.getByRole('button', { name: 'Share to Challenge Feed' }));
    await waitFor(() => expect(h.publish.mutate).toHaveBeenCalledTimes(1));
    const call = h.publish.mutate.mock.calls[0][0] as {
      activityEventId: string;
      clientKey: string;
      previewedValue: number;
      previewedUnit: string;
    };
    expect(call.activityEventId).toBe(item.activityId);
    // Every confirm is a FRESH keyed choice (retries converge server-side)…
    expect(call.clientKey).toMatch(/^[A-Za-z0-9-]{16,64}$/);
    // …bound to exactly the value and unit the member previewed.
    expect(call.previewedValue).toBe(25);
    expect(call.previewedUnit).toBe('reps');
  });

  it('shows the withdrawable shared state when the Activity is already shared', () => {
    resetFeed({
      shareId: '00000000-0000-4000-8000-00000000000a',
      challengeId: item.challenge.id,
      activityEventId: item.activityId,
      publishedAt: '2026-06-10T12:10:00.000Z',
      withdrawn: false,
      visible: true,
      hiddenReason: null,
    });
    render(
      <V2ActivityShareChoices
        mode="immediate"
        source={shareSourceFromHistoryItem(item)}
        challengeTitle="Strength Challenge"
        onKeepPrivate={vi.fn()}
      />,
    );

    expect(screen.getByText(/Shared with the Challenge Feed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share to Challenge Feed' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw Share' }));
    expect(h.withdraw.mutate).toHaveBeenCalledWith(item.activityId, expect.anything());
    // The continuation reflects that the private default no longer applies.
    expect(screen.getByRole('button', { name: 'Continue to Strength Challenge' })).toBeTruthy();
  });

  it('states reversal and suppression honestly and offers no Share action for them', () => {
    resetFeed({
      shareId: '00000000-0000-4000-8000-00000000000a',
      challengeId: item.challenge.id,
      activityEventId: item.activityId,
      publishedAt: '2026-06-10T12:10:00.000Z',
      withdrawn: false,
      visible: false,
      hiddenReason: 'reversed',
    });
    render(
      <V2ActivityShareChoices
        mode="later"
        source={shareSourceFromHistoryItem(item)}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/reversed and cannot be shared/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share to Challenge Feed' })).toBeNull();
    cleanup();

    resetFeed({
      shareId: '00000000-0000-4000-8000-00000000000a',
      challengeId: item.challenge.id,
      activityEventId: item.activityId,
      publishedAt: '2026-06-10T12:10:00.000Z',
      withdrawn: false,
      visible: false,
      hiddenReason: 'suppressed',
    });
    render(
      <V2ActivityShareChoices
        mode="later"
        source={shareSourceFromHistoryItem(item)}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/removed and cannot be republished/)).toBeTruthy();
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

    expect(screen.getByText(/couldn.t confirm whether this Activity is shared/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share to Challenge Feed' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(h.shareState.refetch).toHaveBeenCalled();
  });

  it('disables the private path while a Share choice is in flight', () => {
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
    // The Keep-private continuation can never complete a choice the server
    // is still processing — a finished publication is never described private.
    expect(screen.getByRole('button', { name: /Completing your choice/ }).hasAttribute('disabled')).toBe(true);
  });

  it('surfaces honest refusals for withdrawn, reversed and changed sources', () => {
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
  });

  it('uses distinct failure copy for withdrawals', () => {
    resetFeed({
      shareId: '00000000-0000-4000-8000-00000000000a',
      challengeId: item.challenge.id,
      activityEventId: item.activityId,
      publishedAt: '2026-06-10T12:10:00.000Z',
      withdrawn: false,
      visible: true,
      hiddenReason: null,
    });
    h.withdraw.error = new ApiError(503, 'feed_unavailable', 'Share withdrawal is unavailable');
    render(
      <V2ActivityShareChoices
        mode="later"
        source={shareSourceFromHistoryItem(item)}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Withdrawing your Share failed.');
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
      // Challenge Details unmounts the panel during a background refresh
      // and remounts it; the remount must not steal focus.
      cleanup();
      later();
      expect(document.activeElement).toBe(outside);
    } finally {
      outside.remove();
    }
  });
});
