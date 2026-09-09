import { describe, expect, it } from 'vitest';
import { computeRequiredLogs } from '../src/engine/challengeCompletion.js';
import { selectEngine } from '../src/engine/index.js';
import type {
  ChallengeContext,
  LogEvent,
  MembershipSnapshot,
} from '../src/engine/types.js';

/**
 * C2 engine foundation tests (no C1 replay seam).
 *
 * These tests invoke the vendored provider-neutral engines DIRECTLY with
 * hand-built Challenge-application inputs (LogEvent + ChallengeContext +
 * MembershipSnapshot) — the same shape the future
 * challenge_activity_records application records will carry into the engine.
 * No Member Activity Event (Evidence) row appears here: C1 has no production
 * path that applies raw Evidence to a Challenge, and these tests prove the
 * engines without creating one. Test-local folding only.
 */

function streakContext(): ChallengeContext {
  return {
    challengeId: 'challenge-1',
    challengeType: 'streak',
    engineVersion: 'v2',
    targetType: 'daily',
    durationDays: 7,
    activities: [{ exerciseId: 'push-up', targetValue: 20, unit: 'reps' }],
    startDate: '2026-05-01',
    endDate: '2026-05-08',
    requiredConsecutiveDays: 3,
    streakResetOnMiss: true,
  };
}

function initialSnapshot(memberId: string, context: ChallengeContext): MembershipSnapshot {
  return {
    userId: memberId,
    challengeId: context.challengeId,
    status: 'active',
    activitiesCompleted: 0,
    totalActivities: computeRequiredLogs(context.durationDays, Math.max(1, context.activities.length)),
    completionRate: 0,
    totalPoints: 0,
  };
}

function logEvent(overrides: Partial<LogEvent> & { date: string }): LogEvent {
  return {
    userId: 'member-1',
    challengeId: 'challenge-1',
    activityId: 'push-up',
    value: 20,
    unit: 'reps',
    loggedAt: new Date(`${overrides.date}T08:00:00.000Z`),
    pointsEarned: 100,
    ...overrides,
  };
}

/** Test-local application fold: ordered LogEvents -> per-member snapshots. */
function fold(
  events: LogEvent[],
  context: ChallengeContext,
): { snapshots: Map<string, MembershipSnapshot>; groupTotal: number; applied: number } {
  const engine = selectEngine({ engineVersion: context.engineVersion, challengeType: context.challengeType });
  const snapshots = new Map<string, MembershipSnapshot>();
  let groupTotal = 0;
  const ordered = [...events].sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());
  for (const event of ordered) {
    let snapshot = snapshots.get(event.userId);
    if (!snapshot) {
      snapshot = initialSnapshot(event.userId, context);
      snapshots.set(event.userId, snapshot);
    }
    const result = engine.computeUpdate(context, snapshot, event, { groupCurrentTotal: groupTotal });
    const next: MembershipSnapshot = { ...snapshot, ...result.membershipUpdate };
    if (result.challengeUpdate) {
      groupTotal += result.challengeUpdate.groupCurrentTotalDelta;
    }
    snapshots.set(event.userId, next);
  }
  return { snapshots, groupTotal, applied: ordered.length };
}

describe('engine determinism', () => {
  it('folds identically regardless of input order', () => {
    const events = [
      logEvent({ date: '2026-05-03' }),
      logEvent({ date: '2026-05-01' }),
      logEvent({ date: '2026-05-02' }),
    ];
    const first = fold(events, streakContext());
    const second = fold([...events].reverse(), streakContext());
    expect(second.snapshots.get('member-1')).toEqual(first.snapshots.get('member-1'));
    expect(first.applied).toBe(3);
  });
});

describe('streak engine', () => {
  it('advances on consecutive completed days and resets after a gap', () => {
    const { snapshots } = fold(
      [
        logEvent({ date: '2026-05-01' }),
        logEvent({ date: '2026-05-02' }),
        // gap: 05-03 missed -> reset to 1 on 05-04
        logEvent({ date: '2026-05-04' }),
      ],
      streakContext(),
    );
    const snap = snapshots.get('member-1')!;
    expect(snap.currentStreak).toBe(1);
    expect(snap.longestStreak).toBe(2);
    expect(snap.activitiesCompleted).toBe(3);
  });

  it('completes at the required consecutive days', () => {
    const { snapshots } = fold(
      [logEvent({ date: '2026-05-01' }), logEvent({ date: '2026-05-02' }), logEvent({ date: '2026-05-03' })],
      streakContext(),
    );
    const snap = snapshots.get('member-1')!;
    expect(snap.status).toBe('completed');
    expect(snap.currentStreak).toBe(3);
  });
});

describe('collective engine', () => {
  function collectiveContext(): ChallengeContext {
    return {
      ...streakContext(),
      challengeType: 'collective',
      activities: [{ exerciseId: 'push-up', targetValue: 0, unit: 'reps' }],
      groupCumulativeTarget: 100,
      autoCompleteOnGroupTarget: true,
    };
  }

  it('accumulates the group total across members via challenge deltas', () => {
    const { groupTotal, snapshots } = fold(
      [
        logEvent({ userId: 'member-1', date: '2026-05-01', value: 40 }),
        logEvent({ userId: 'member-2', date: '2026-05-01', value: 70 }),
      ],
      collectiveContext(),
    );
    expect(groupTotal).toBe(110);
    expect(snapshots.size).toBe(2);
    expect(snapshots.get('member-1')!.cumulativeLoggedValue).toBe(40);
    // Group-target cascade to member completion is service-layer (C2)
    // behavior, not engine output: the engine reports the delta and leaves
    // membership status to the application transaction.
  });

  it('leaves members active below the group target', () => {
    const { groupTotal, snapshots } = fold(
      [logEvent({ date: '2026-05-01', value: 10 })],
      collectiveContext(),
    );
    expect(groupTotal).toBe(10);
    expect(snapshots.get('member-1')!.status).toBe('active');
  });
});

describe('competitive engine', () => {
  function competitiveContext(): ChallengeContext {
    return {
      ...streakContext(),
      challengeType: 'competitive',
      activities: [
        { exerciseId: 'push-up', targetValue: 50, unit: 'reps' },
        { exerciseId: 'water-intake', targetValue: 2000, unit: 'ml' },
      ],
    };
  }

  it('tracks per-activity cumulative values toward completion', () => {
    const singleActivity = {
      ...competitiveContext(),
      activities: [{ exerciseId: 'push-up', targetValue: 50, unit: 'reps' }],
    };
    const { snapshots } = fold(
      [
        logEvent({ date: '2026-05-01', value: 20, pointsEarned: 40 }),
        logEvent({ date: '2026-05-02', value: 30, pointsEarned: 60 }),
      ],
      singleActivity,
    );
    const snap = snapshots.get('member-1')!;
    expect(snap.cumulativeLoggedValue).toBe(50);
    expect(snap.cumulativeValues).toEqual({ 'push-up': 50 });
    expect(snap.totalPoints).toBe(100);
    expect(snap.status).toBe('completed');
    expect(snap.completionRate).toBe(100);
  });

  it('accumulates multi-activity days per activity key', () => {
    const { snapshots } = fold(
      [
        logEvent({ date: '2026-05-01', activityId: 'push-up', value: 20, pointsEarned: 40 }),
        logEvent({
          date: '2026-05-01',
          activityId: 'water-intake',
          value: 2000,
          unit: 'ml',
          pointsEarned: 100,
        }),
      ],
      competitiveContext(),
    );
    const snap = snapshots.get('member-1')!;
    expect(snap.cumulativeValues).toEqual({ 'push-up': 20, 'water-intake': 2000 });
    expect(snap.totalPoints).toBe(140);
  });
});
