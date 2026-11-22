import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveLoggingOccurredAt } from './V2LoggingSection';
import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { V2LogActivityDialog, V2LogActivityForm } from './V2LoggingSection';
import { useLogActivityV2 } from './useChallengeCreation';

const authState = vi.hoisted(() => ({ user: { uid: 'owner-1' } as { uid: string } | null }));
vi.mock('./useChallengeCreation', () => ({
  useLogActivityV2: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState,
}));
const feed = vi.hoisted(() => ({
  shareState: { data: null, isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() },
  publish: { mutate: vi.fn(), isPending: false, error: null },
  withdraw: { mutate: vi.fn(), isPending: false, error: null },
}));
vi.mock('../profile/useV2MemberIdentity', () => ({
  useV2MemberIdentity: () => ({ displayName: 'Amara Test', isLoading: false }),
}));
vi.mock('./challengeFeedQuery', () => ({
  useV2ActivityShareState: () => feed.shareState,
  useV2PublishActivityShare: () => feed.publish,
  useV2WithdrawActivityShare: () => feed.withdraw,
}));

vi.mock('./activityNames', () => ({
  useActivityDisplayNames: () => new Map([['FIT-STR-001', 'Push-Up']]),
  resolveActivityDisplayName: (canonicalKey: string, names: Map<string, string>) => names.get(canonicalKey) ?? 'Push-Up',
  resolvedChoiceOptionLabel: () => 'Push-Up (reps)',
  V2ActivityName: ({ canonicalKey }: { canonicalKey: string }) => <span>{canonicalKey}</span>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  authState.user = { uid: 'owner-1' };
});

describe('V2LoggingSection — timestamp resolution', () => {
  it('immediate logging: unmodified form uses actual current instant with seconds and milliseconds', () => {
    const joinedAt = new Date('2026-11-10T15:22:45.321Z');
    const submitInstant = new Date('2026-11-10T15:22:46.850Z');

    // Default datetime-local input string truncated to minute 15:22
    const inputWhen = '2026-11-10T15:22';

    // The old naive parsing stripped seconds/ms, falling before joinedAt
    const oldFlawedTime = new Date(inputWhen);
    expect(oldFlawedTime.getTime()).toBeLessThan(joinedAt.getTime());

    // The corrected resolution provides the full current instant
    const resolved = resolveLoggingOccurredAt({
      when: inputWhen,
      whenModified: false,
      now: submitInstant,
    });

    expect(resolved.getTime()).toBe(submitInstant.getTime());
    expect(resolved.getTime()).toBeGreaterThan(joinedAt.getTime());
  });

  it('retrying: preserves exact previous attempt instant so idempotency keys converge', () => {
    const initialInstantISO = '2026-11-10T15:22:46.850Z';
    const laterNow = new Date('2026-11-10T15:23:10.000Z');

    const resolved = resolveLoggingOccurredAt({
      when: '2026-11-10T15:22',
      whenModified: false,
      lastAttemptOccurredAtISO: initialInstantISO,
      now: laterNow,
    });

    expect(resolved.toISOString()).toBe(initialInstantISO);
  });

  it('historical logging: honors manual datetime modification', () => {
    const manualDate = '2026-11-09T14:30';
    const resolved = resolveLoggingOccurredAt({
      when: manualDate,
      whenModified: true,
      now: new Date('2026-11-10T15:22:46.850Z'),
    });

    expect(resolved.getTime()).toBe(new Date(manualDate).getTime());
  });

  it('invalid manual date: returns invalid Date so client validation rejects it', () => {
    const resolved = resolveLoggingOccurredAt({
      when: 'invalid-date-string',
      whenModified: true,
    });

    expect(Number.isNaN(resolved.getTime())).toBe(true);
  });
});

describe('V2LoggingSection — member-friendly error display', () => {
  const detail: V2ChallengeDetail = {
    challengeId: 'ch-test',
    title: 'Strength Challenge',
    description: '',
    challengeType: 'collective',
    status: 'active',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    timezone: 'UTC',
    governingToday: '2026-11-10',
    finalized: false,
    currentConfigVersion: 1,
    goalValue: 1000,
    goalUnit: 'reps',
    collectiveTotal: 100,
    collectiveGoalReached: false,
    completionsCount: 0,
    groupId: 'grp-1',
    groupName: 'Test Group',
    instructions: 'Test instructions',
    activatedAt: '2026-11-01T00:00:00Z',
    endedAt: null,
    finalizedAt: null,
    finalResult: null,
    serverNow: '2026-11-10T15:22:45.321Z',
    myParticipation: {
      participationId: 'part-1',
      status: 'active',
      joinedAt: '2026-11-10T15:22:45.321Z',
      joinedConfigVersion: 1,
      progress: {
        logsAccepted: 0,
        distinctDays: 0,
        totalPoints: 0,
        completionRate: 0,
        cumulativeValues: {},
        cumulativeTotal: 0,
        currentStreak: 0,
        bestStreak: 0,
        lastCompletedDay: null,
        dayStates: {},
        daysCompleted: 0,
        completionStatus: 'in_progress',
        completedAt: null,
        finalPosition: null,
      },
      final: null,
    },
    activities: [],
    config: {
      version: 1,
      period: { startDate: '2026-11-01', endDate: '2026-11-30' },
      requiredConsecutiveDays: null,
      activities: [
        {
          canonicalKey: 'FIT-STR-001',
          activityVariant: null,
          activityKind: 'fitness',
          activityCode: 'FIT-STR-001',
          metric: 'repetitions',
          unit: 'reps',
          targetValue: 50,
          position: 1,
        },
      ],
    },
  };

  it('renders friendly error message and NEVER renders raw internal API error codes', async () => {
    const mutateAsyncMock = vi.fn().mockRejectedValue({
      status: 422,
      code: 'no_participation_episode',
      message: 'no participation episode owns the Evidence time',
    });
    vi.mocked(useLogActivityV2).mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as any);

    render(<V2LogActivityForm detail={detail} />);

    // Fill in amount
    const amountInput = screen.getByPlaceholderText('e.g. 50');
    expect(amountInput).toBeTruthy();

    fireEvent.change(amountInput, { target: { value: '25' } });

    // Click submit
    const submitBtn = screen.getByRole('button', { name: 'Log activity' });
    fireEvent.click(submitBtn);

    // Verify friendly denial message is shown
    const alert = await screen.findByRole('alert');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('This entry falls outside your current participation period, so it cannot be recorded.');

    // Verify raw internal code is NOT displayed anywhere in the alert or DOM
    expect(alert.textContent).not.toContain('Code:');
    expect(alert.textContent).not.toContain('no_participation_episode');
    expect(screen.queryByText(/Code:/i)).toBeNull();
    expect(screen.queryByText(/no_participation_episode/i)).toBeNull();
  });

  it('shows sharing destinations immediately after Done and keeps the private continuation functional', async () => {
    const mutateAsyncMock = vi.fn().mockResolvedValue({
      recordId: 'record-0001',
      eventId: 'event-0001',
      challengeId: detail.challengeId,
      value: 25,
      unit: 'reps',
      pointsAwarded: 5,
      occurredDay: '2026-11-10',
      duplicate: false,
    });
    const onClose = vi.fn();
    const onKeepPrivate = vi.fn();
    vi.mocked(useLogActivityV2).mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as any);

    // StrictMode double-invokes effects in the real app shell; the mounted
    // guard must not swallow the accepted result after that simulated
    // remount.
    render(
      <React.StrictMode>
        <V2LogActivityDialog detail={detail} open onClose={onClose} onKeepPrivate={onKeepPrivate} />
      </React.StrictMode>,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. 50'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log activity' }));
    await screen.findByText('Recorded.');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    // Founder direction: sharing options appear immediately after logging.
    // Done opens the destination list directly — no intermediate screen and
    // no extra click is required to see the destinations.
    expect(await screen.findByRole('dialog', { name: 'Activity sharing options' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Sharing destinations' })).toBeTruthy();
    expect(screen.getByText('Push-Up · 25 reps')).toBeTruthy();
    expect(screen.getByText(/return you to Strength Challenge Details/)).toBeTruthy();
    expect(screen.getByText('Challenge Feed')).toBeTruthy();
    expect(screen.getByText(/Preview — not shared yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share to Challenge Feed' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'External sharing — unavailable' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Share activity' })).toBeNull();
    // The panel replaces the focused Done button inside the open sheet, so
    // it must take focus itself instead of dropping it to the body.
    expect(document.activeElement?.getAttribute('aria-labelledby')).toBe('activity-share-choices-title');

    fireEvent.click(screen.getByRole('button', { name: 'Keep private and continue' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onKeepPrivate).toHaveBeenCalledTimes(1);
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('a late response from a closed sheet cannot overwrite the reopened Activity share source', async () => {
    let resolveFirst!: (value: unknown) => void;
    const firstSubmission = new Promise<unknown>((resolve) => { resolveFirst = resolve; });
    const mutateAsyncMock = vi.fn()
      .mockImplementationOnce(() => firstSubmission)
      .mockResolvedValueOnce({
        recordId: 'record-0002',
        eventId: 'event-0002',
        challengeId: detail.challengeId,
        value: 25,
        unit: 'reps',
        pointsAwarded: 5,
        occurredDay: '2026-11-10',
        duplicate: false,
      });
    vi.mocked(useLogActivityV2).mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as any);

    const view = render(<V2LogActivityDialog detail={detail} open onClose={vi.fn()} />);
    // First submission stays pending; the member closes the sheet mid-flight.
    fireEvent.change(screen.getByPlaceholderText('e.g. 50'), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log activity' }));
    view.rerender(<V2LogActivityDialog detail={detail} open={false} onClose={vi.fn()} />);
    // Reopen: a fresh form mounts (closing unmounts the previous one).
    view.rerender(<V2LogActivityDialog detail={detail} open onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. 50'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log activity' }));
    await screen.findByText('Recorded.');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('region', { name: 'Sharing destinations' })).toBeTruthy();
    expect(screen.getByText('Push-Up · 25 reps')).toBeTruthy();

    // The stale first response arrives after its form was unmounted; it
    // must not replace the confirmed share source of the open Activity.
    resolveFirst({
      recordId: 'record-0001',
      eventId: 'event-0001',
      challengeId: detail.challengeId,
      value: 11,
      unit: 'reps',
      pointsAwarded: 2,
      occurredDay: '2026-11-10',
      duplicate: false,
    });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('Push-Up · 25 reps')).toBeTruthy();
    expect(screen.queryByText('Push-Up · 11 reps')).toBeNull();
  });

  it('clears accepted Activity and sharing choices when the authenticated owner changes', async () => {
    const mutateAsyncMock = vi.fn().mockResolvedValue({
      recordId: 'record-owner-1',
      eventId: 'event-owner-1',
      challengeId: detail.challengeId,
      value: 25,
      unit: 'reps',
      pointsAwarded: 5,
      occurredDay: '2026-11-10',
      duplicate: false,
    });
    vi.mocked(useLogActivityV2).mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as any);

    const view = render(<V2LogActivityDialog detail={detail} open onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. 50'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log activity' }));
    await screen.findByText('Recorded.');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('region', { name: 'Sharing destinations' })).toBeTruthy();
    expect(screen.getByText('Push-Up · 25 reps')).toBeTruthy();

    authState.user = { uid: 'owner-2' };
    view.rerender(<V2LogActivityDialog detail={detail} open onClose={vi.fn()} />);

    expect(screen.queryByRole('region', { name: 'Sharing destinations' })).toBeNull();
    expect(screen.queryByText('Push-Up · 25 reps')).toBeNull();
    expect(screen.queryByText('Recorded.')).toBeNull();
  });

  it('keeps Log another as a separate deliberate Activity intent', async () => {
    const mutateAsyncMock = vi.fn().mockResolvedValue({
      value: 25,
      unit: 'reps',
      pointsAwarded: 5,
      occurredDay: '2026-11-10',
      duplicate: false,
    });
    vi.mocked(useLogActivityV2).mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as any);

    render(<V2LogActivityDialog detail={detail} open onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. 50'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log activity' }));
    await screen.findByText('Recorded.');

    fireEvent.click(screen.getByRole('button', { name: 'Log another' }));
    expect(screen.queryByLabelText('Activity privacy choice')).toBeNull();
    const amountInput = screen.getByPlaceholderText('e.g. 50');
    expect((amountInput as HTMLInputElement).value).toBe('');
    fireEvent.change(amountInput, { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log activity' }));
    await screen.findAllByText('Recorded.');

    expect(mutateAsyncMock).toHaveBeenCalledTimes(2);
    const firstKey = mutateAsyncMock.mock.calls[0][0].payload.client_key;
    const secondKey = mutateAsyncMock.mock.calls[1][0].payload.client_key;
    expect(secondKey).not.toBe(firstKey);
  });
});
