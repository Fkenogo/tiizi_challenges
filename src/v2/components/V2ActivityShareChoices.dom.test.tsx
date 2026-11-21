import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MemberRecentActivityItem } from '../../api/memberRecentActivityApi';
import {
  shareSourceFromAcceptedActivity,
  shareSourceFromHistoryItem,
  V2ActivityShareChoices,
} from './V2ActivityShareChoices';

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

  it('shows unavailable destinations immediately with the Keep-private default path', () => {
    const onKeepPrivate = vi.fn();
    render(
      <V2ActivityShareChoices
        mode="immediate"
        source={shareSourceFromHistoryItem(item)}
        challengeTitle="Strength Challenge"
        onKeepPrivate={onKeepPrivate}
      />,
    );

    expect(screen.getByRole('region', { name: 'Sharing destinations' })).toBeTruthy();
    expect(screen.getByText('Push-Up · 25 reps')).toBeTruthy();
    expect(screen.getByText(/return you to Strength Challenge Details/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Challenge Feed — unavailable' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'External sharing — unavailable' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: /Group Feed/ })).toBeNull();
    expect(screen.getByText(/Group Feed is not a destination for individual Activity/)).toBeTruthy();
    // The panel takes focus itself: it replaces the focused Done button
    // inside an already-open sheet whose initial-focus effect will not re-run.
    expect(document.activeElement?.getAttribute('aria-labelledby')).toBe('activity-share-choices-title');

    fireEvent.click(screen.getByRole('button', { name: 'Keep private and continue' }));
    expect(onKeepPrivate).toHaveBeenCalledTimes(1);
  });
});
