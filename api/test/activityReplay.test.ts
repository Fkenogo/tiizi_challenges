import { describe, expect, it } from 'vitest';
import { replayChallengeEvents, snapshotToComparable } from '../src/activityReplay.js';
import { compareReplayToFirestore } from '../src/activityShadow.js';
import type { ActivityEventRow } from '../src/activityEvents.js';
import type { ChallengeContext } from '../src/engine/types.js';

let seq = 0;

function row(overrides: Partial<ActivityEventRow>): ActivityEventRow {
  seq += 1;
  return {
    event_id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    event_type: 'workout',
    member_id: 'member-1',
    legacy_challenge_id: 'challenge-1',
    legacy_group_id: null,
    canonical_key: 'push-up',
    knowledge_id: null,
    knowledge_version: null,
    version_source: null,
    occurred_at: '2026-05-01T08:00:00.000Z',
    occurred_day: '2026-05-01',
    recorded_at: '2026-06-01T00:00:00.000Z',
    value: 20,
    unit: 'reps',
    points: 80,
    client_key: `firestore:workouts:t${seq}`,
    legacy_collection: 'workouts',
    legacy_id: `t${seq}`,
    log_type: null,
    supersedes_event_id: null,
    correction_kind: null,
    status: 'committed',
    metadata: {},
    ...overrides,
  };
}

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

describe('replay determinism', () => {
  it('replays identically on repeated runs regardless of input order', () => {
    const events = [
      row({ occurred_at: '2026-05-03T08:00:00.000Z', occurred_day: '2026-05-03' }),
      row({ occurred_at: '2026-05-01T08:00:00.000Z', occurred_day: '2026-05-01' }),
      row({ occurred_at: '2026-05-02T08:00:00.000Z', occurred_day: '2026-05-02' }),
    ];
    const first = replayChallengeEvents(events, streakContext());
    const second = replayChallengeEvents([...events].reverse(), streakContext());
    expect(snapshotToComparable(first.members[0].snapshot)).toEqual(
      snapshotToComparable(second.members[0].snapshot),
    );
    expect(first.appliedEvents).toBe(3);
  });
});

describe('streak replay', () => {
  it('advances on consecutive completed days and resets after a gap', () => {
    const events = [
      row({ occurred_at: '2026-05-01T08:00:00.000Z', occurred_day: '2026-05-01' }),
      row({ occurred_at: '2026-05-02T08:00:00.000Z', occurred_day: '2026-05-02' }),
      // gap: 05-03 missed -> reset to 1 on 05-04
      row({ occurred_at: '2026-05-04T08:00:00.000Z', occurred_day: '2026-05-04' }),
    ];
    const result = replayChallengeEvents(events, streakContext());
    const snap = result.members[0].snapshot;
    expect(snap.currentStreak).toBe(1);
    expect(snap.longestStreak).toBe(2);
    expect(snap.activitiesCompleted).toBe(3);
    expect(result.members[0].appliedEvents).toBe(3);
  });

  it('completes at the required consecutive days', () => {
    const events = [1, 2, 3].map((day) =>
      row({ occurred_at: `2026-05-0${day}T08:00:00.000Z`, occurred_day: `2026-05-0${day}` }),
    );
    const result = replayChallengeEvents(events, streakContext());
    expect(result.members[0].snapshot.status).toBe('completed');
    expect(result.members[0].snapshot.currentStreak).toBe(3);
  });
});

describe('collective replay', () => {
  function collectiveContext(): ChallengeContext {
    return {
      ...streakContext(),
      challengeType: 'collective',
      activities: [{ exerciseId: 'push-up', targetValue: 0, unit: 'reps' }],
      groupCumulativeTarget: 100,
      autoCompleteOnGroupTarget: true,
    };
  }

  it('accumulates the group total across members and cascades completion', () => {
    const events = [
      row({ member_id: 'member-1', value: 40 }),
      row({ member_id: 'member-2', value: 70 }),
    ];
    const result = replayChallengeEvents(events, collectiveContext());
    expect(result.groupTotal).toBe(110);
    expect(result.members).toHaveLength(2);
    // Cascade: every logging member completes once the group target is met.
    for (const m of result.members) expect(m.snapshot.status).toBe('completed');
    expect(result.members[0].snapshot.cumulativeLoggedValue).toBe(40);
  });

  it('leaves members active below the group target', () => {
    const result = replayChallengeEvents([row({ value: 10 })], collectiveContext());
    expect(result.groupTotal).toBe(10);
    expect(result.members[0].snapshot.status).toBe('active');
  });
});

describe('competitive replay', () => {
  function competitiveContext(): ChallengeContext {
    return {
      ...streakContext(),
      challengeType: 'competitive',
      activities: [{ exerciseId: 'push-up', targetValue: 50, unit: 'reps' }],
    };
  }

  it('tracks per-activity cumulative values toward completion', () => {
    const events = [
      row({ value: 20, points: 40 }),
      row({ value: 30, points: 60 }),
    ];
    const result = replayChallengeEvents(events, competitiveContext());
    const snap = result.members[0].snapshot;
    expect(snap.cumulativeLoggedValue).toBe(50);
    expect(snap.cumulativeValues).toEqual({ 'push-up': 50 });
    expect(snap.totalPoints).toBe(100);
    expect(snap.status).toBe('completed');
    expect(snap.completionRate).toBe(100);
  });
});

describe('shadow classification', () => {
  it('classifies exact parity as A', () => {
    const events = [1, 2, 3].map((day) =>
      row({ occurred_at: `2026-05-0${day}T08:00:00.000Z`, occurred_day: `2026-05-0${day}` }),
    );
    const replay = replayChallengeEvents(events, streakContext());
    const snap = snapshotToComparable(replay.members[0].snapshot);
    const report = compareReplayToFirestore(replay, [
      {
        memberId: 'member-1',
        status: snap.status as string,
        activitiesCompleted: snap.activitiesCompleted as number,
        completionRate: snap.completionRate as number,
        totalPoints: snap.totalPoints as number,
        currentStreak: snap.currentStreak as number,
        longestStreak: snap.longestStreak as number,
        lastActivityAt: (snap.lastActivityAt as string) ?? null,
      },
    ]);
    expect(report.counts).toEqual({ A: 1, B: 0, C: 0 });
  });

  it('classifies behind-counters with older timestamps as explainable-stale B', () => {
    const events = [1, 2].map((day) =>
      row({ occurred_at: `2026-05-0${day}T08:00:00.000Z`, occurred_day: `2026-05-0${day}` }),
    );
    const replay = replayChallengeEvents(events, streakContext());
    const report = compareReplayToFirestore(replay, [
      {
        memberId: 'member-1',
        status: 'active',
        activitiesCompleted: 1,
        completionRate: 14,
        totalPoints: 80,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityAt: '2026-05-01T08:00:00.000Z',
      },
    ]);
    expect(report.members[0].classification).toBe('B');
  });

  it('classifies status divergence as material C', () => {
    const events = [row({})];
    const replay = replayChallengeEvents(events, streakContext());
    const report = compareReplayToFirestore(replay, [
      { memberId: 'member-1', status: 'completed', lastActivityAt: '2026-05-01T08:00:00.000Z' },
    ]);
    expect(report.members[0].classification).toBe('C');
    expect(report.counts.C).toBe(1);
  });
});
