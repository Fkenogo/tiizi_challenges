import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveLoggingOccurredAt } from './V2LoggingSection';
import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { V2LogActivityForm } from './V2LoggingSection';

vi.mock('./useChallengeCreation', () => ({
  useLogActivityV2: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('./activityNames', () => ({
  useActivityDisplayNames: () => new Map([['FIT-STR-001', 'Push-Up']]),
  resolvedChoiceOptionLabel: () => 'Push-Up (reps)',
  V2ActivityName: ({ canonicalKey }: { canonicalKey: string }) => <span>{canonicalKey}</span>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
    const { useLogActivityV2 } = await import('./useChallengeCreation');
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

    const { fireEvent } = await import('@testing-library/react');
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
});
