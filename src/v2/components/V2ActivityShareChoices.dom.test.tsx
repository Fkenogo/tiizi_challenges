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
  ownShare: {} as { data: unknown; isLoading: boolean },
  publish: {} as { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean; error: unknown },
  withdraw: {} as { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean; error: unknown },
}));

vi.mock('../profile/useV2MemberIdentity', () => ({
  useV2MemberIdentity: () => h.identity,
}));
vi.mock('../challenges/challengeFeedQuery', () => ({
  useV2OwnActivityShare: () => h.ownShare,
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

function resetFeed(ownShareData: unknown = null) {
  h.ownShare = { data: ownShareData, isLoading: false };
  h.publish = { mutateAsync: vi.fn(async () => ({ withdrawn: false })), isPending: false, error: null };
  h.withdraw = { mutateAsync: vi.fn(async () => ({ withdrawn: true })), isPending: false, error: null };
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

  it('previews exactly the CF-01 S1 fields, then publishes on the explicit confirm', async () => {
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
    await waitFor(() => expect(h.publish.mutateAsync).toHaveBeenCalledWith(item.activityId));
    expect(screen.getByRole('button', { name: 'Keep private and continue' })).toBeTruthy();
  });

  it('shows the withdrawable shared state when the Activity is already shared', async () => {
    resetFeed({
      feedItemId: '00000000-0000-4000-8000-00000000000a',
      kind: 'activity_share',
      activityEventId: item.activityId,
      sharerDisplayName: 'Amara Test',
      activityName: 'Push-Up',
      value: 25,
      unit: 'reps',
      publishedAt: '2026-06-10T12:10:00.000Z',
      ownShare: true,
    });
    const onKeepPrivate = vi.fn();
    render(
      <V2ActivityShareChoices
        mode="immediate"
        source={shareSourceFromHistoryItem(item)}
        challengeTitle="Strength Challenge"
        onKeepPrivate={onKeepPrivate}
      />,
    );

    expect(screen.getByText(/Shared with the Challenge Feed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share to Challenge Feed' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw Share' }));
    await waitFor(() => expect(h.withdraw.mutateAsync).toHaveBeenCalledWith(item.activityId));
    // The continuation reflects that the private default no longer applies.
    expect(screen.getByRole('button', { name: 'Continue to Strength Challenge' })).toBeTruthy();
  });

  it('surfaces an honest refusal when the server rejects a superseded source', () => {
    resetFeed();
    h.publish.error = new ApiError(
      409,
      'source_not_current',
      'This Activity was corrected or reversed; share the current version instead',
    );
    render(
      <V2ActivityShareChoices
        mode="later"
        source={shareSourceFromHistoryItem(item)}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent)
      .toContain('This Activity was corrected or reversed. Share the current version instead.');
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
