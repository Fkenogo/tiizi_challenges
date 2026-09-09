import { describe, expect, it } from 'vitest';
import { replayChallengeEvents, snapshotToComparable } from '../src/activityReplay.js';
import type { ActivityEventRow } from '../src/activityEvents.js';
import type { ChallengeContext } from '../src/engine/types.js';

let seq = 0;

/** Synthetic V2 fixture row — no Firestore provenance anywhere. */
function row(overrides: Partial<ActivityEventRow>): ActivityEventRow {
  seq += 1;
  return {
    event_id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    member_id: 'member-1',
    activity_kind: 'fitness',
    canonical_key: 'push-up',
    activity_variant: null,
    knowledge_id: '00000000-0000-4000-8000-000000000001',
    knowledge_version: 1,
    occurred_at: '2026-05-01T08:00:00.000Z',
    occurred_day: '2026-05-01',
    occurred_tz: null,
    recorded_at: '2026-06-01T00:00:00.000Z',
    value: 20,
    unit: 'reps',
    client_key: `v2-client:t${seq}`,
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

  it('skips superseded rows: replay is a pure function of the committed ledger', () => {
    const live = row({ occurred_at: '2026-05-01T08:00:00.000Z', occurred_day: '2026-05-01' });
    const dead = row({
      occurred_at: '2026-05-02T08:00:00.000Z',
      occurred_day: '2026-05-02',
      status: 'superseded',
    });
    const result = replayChallengeEvents([live, dead], streakContext());
    expect(result.appliedEvents).toBe(1);
    expect(result.members[0].snapshot.activitiesCompleted).toBe(1);
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
    // Application scoring derives 20/50 -> 40 pts and 30/50 -> 60 pts.
    const events = [
      row({ value: 20 }),
      row({ value: 30 }),
    ];
    const result = replayChallengeEvents(events, singleActivity);
    const snap = result.members[0].snapshot;
    expect(snap.cumulativeLoggedValue).toBe(50);
    expect(snap.cumulativeValues).toEqual({ 'push-up': 50 });
    expect(snap.totalPoints).toBe(100);
    expect(snap.status).toBe('completed');
    expect(snap.completionRate).toBe(100);
  });

  it('accumulates multi-activity days per activity key', () => {
    // Application scoring derives 20/50 -> 40 pts and 2000/2000 -> 100 pts.
    const events = [
      row({
        canonical_key: 'push-up',
        value: 20,
        activity_kind: 'fitness',
        occurred_day: '2026-05-01',
      }),
      row({
        canonical_key: 'water-intake',
        value: 2000,
        unit: 'ml',
        activity_kind: 'wellness',
        occurred_day: '2026-05-01',
      }),
    ];
    const result = replayChallengeEvents(events, competitiveContext());
    const snap = result.members[0].snapshot;
    expect(snap.cumulativeValues).toEqual({ 'push-up': 20, 'water-intake': 2000 });
    expect(snap.totalPoints).toBe(140);
  });
});
