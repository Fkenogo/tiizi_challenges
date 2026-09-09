import { beforeEach, describe, expect, it } from 'vitest';
import {
  mapLegacyWellnessLog,
  mapLegacyWorkout,
  runActivityEventImport,
  toDate,
  type LegacyDocSnapshot,
} from '../src/activityEventImport.js';
import { testDb, seedMember } from './helpers.js';

beforeEach(async () => {
  await testDb().query('TRUNCATE activity_events');
});

const MEMBER_UID = 'uid-import-1';

function workoutDoc(id: string, overrides: Record<string, unknown> = {}): LegacyDocSnapshot {
  return {
    id,
    data: {
      userId: MEMBER_UID,
      challengeId: 'challenge-fs-1',
      groupId: 'group-fs-1',
      exerciseId: 'push-up',
      value: 20,
      unit: 'reps',
      points: 80,
      completedAt: '2026-05-01T08:00:00.000Z',
      date: '2026-05-01',
      ...overrides,
    },
  };
}

function wellnessDoc(id: string, overrides: Record<string, unknown> = {}): LegacyDocSnapshot {
  return {
    id,
    data: {
      userId: MEMBER_UID,
      challengeId: 'challenge-fs-1',
      groupId: 'group-fs-1',
      activityId: 'hydration',
      logType: 'hydration',
      value: 500,
      unit: 'ml',
      points: 100,
      loggedAt: '2026-05-02T09:00:00.000Z',
      date: '2026-05-02',
      ...overrides,
    },
  };
}

async function setupIdentity() {
  const db = testDb();
  const memberId = await seedMember(db, MEMBER_UID);
  await db.query(
    `INSERT INTO knowledge_items (knowledge_id, kind, legacy_firestore_id, legacy_collection, lifecycle, current_version, name)
     VALUES ('11111111-1111-4111-8111-111111111111', 'fitness', 'push-up', 'catalogExercises', 'published', 3, 'Push-Up')`,
  );
  return { db, memberId };
}

const resolvers = (memberId: string) => ({
  resolveMemberId: async (_p: string, uid: string) => (uid === MEMBER_UID ? memberId : null),
  resolveKnowledgePin: async (key: string) =>
    key === 'push-up' || key === 'hydration'
      ? { knowledge_id: '11111111-1111-4111-8111-111111111111', current_version: 3 }
      : null,
});

describe('toDate', () => {
  it('normalizes Firestore Timestamps, Dates, ISO strings, and millis', () => {
    expect(toDate(new Date('2026-01-01T00:00:00.000Z'))?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(toDate('2026-01-02T00:00:00.000Z')?.toISOString()).toBe('2026-01-02T00:00:00.000Z');
    expect(toDate({ toDate: () => new Date('2026-01-03T00:00:00.000Z') })?.toISOString()).toBe(
      '2026-01-03T00:00:00.000Z',
    );
    expect(toDate(1767225600000)?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(toDate(null)).toBe(null);
    expect(toDate('not-a-date')).toBe(null);
  });
});

describe('workout mapping', () => {
  it('maps a valid workout with a pinned knowledge version', async () => {
    const { memberId } = await setupIdentity();
    const mapped = mapLegacyWorkout(workoutDoc('w1'), {
      memberId,
      pin: { knowledge_id: '11111111-1111-4111-8111-111111111111', current_version: 3 },
    });
    expect(mapped.malformed).toBeUndefined();
    expect(mapped.event?.knowledge_version).toBe(3);
    expect(mapped.event?.version_source).toBe('import_snapshot');
    expect(mapped.event?.occurred_day).toBe('2026-05-01');
    expect(mapped.event?.client_key).toBe('firestore:workouts:w1');
  });

  it('reports each malformed shape explicitly', async () => {
    const { memberId } = await setupIdentity();
    const pin = { knowledge_id: '11111111-1111-4111-8111-111111111111', current_version: 3 };
    expect(mapLegacyWorkout(workoutDoc('x', { userId: 'ghost' }), { memberId: null, pin }).malformed).toBe(
      'unknown_member',
    );
    expect(mapLegacyWorkout(workoutDoc('x', { exerciseId: '' }), { memberId, pin }).malformed).toBe(
      'missing_exerciseId',
    );
    expect(mapLegacyWorkout(workoutDoc('x', { value: -5 }), { memberId, pin }).malformed).toBe('invalid_value');
    expect(mapLegacyWorkout(workoutDoc('x', { unit: '' }), { memberId, pin }).malformed).toBe('missing_unit');
    expect(mapLegacyWorkout(workoutDoc('x', { points: undefined }), { memberId, pin }).malformed).toBe(
      'legacy_prescoring',
    );
    expect(
      mapLegacyWorkout(workoutDoc('x', { points: undefined, scoringVersion: 'v2' }), { memberId, pin }).malformed,
    ).toBe('missing_points');
    expect(mapLegacyWorkout(workoutDoc('x', { challengeId: '' }), { memberId, pin }).malformed).toBe(
      'missing_challengeId',
    );
    expect(
      mapLegacyWorkout(workoutDoc('x', { completedAt: 'bogus', loggedAt: 'bogus', date: 'bogus' }), { memberId, pin })
        .malformed,
    ).toBe('missing_timestamp');
  });

  it('keeps NULL knowledge pins (reported, never invented)', async () => {
    const { memberId } = await setupIdentity();
    const mapped = mapLegacyWorkout(workoutDoc('w9', { exerciseId: 'custom-thing' }), { memberId, pin: null });
    expect(mapped.malformed).toBeUndefined();
    expect(mapped.event?.knowledge_id).toBe(null);
    expect(mapped.unresolvedKnowledge).toBe(true);
  });
});

describe('wellness mapping', () => {
  it('maps variant tails into structured metadata', async () => {
    const { memberId } = await setupIdentity();
    const mapped = mapLegacyWellnessLog(
      wellnessDoc('s1', { notes: 'evening', metadata: { quality: 4 }, scoringVersion: 'v2' }),
      { memberId, pin: null },
    );
    expect(mapped.malformed).toBeUndefined();
    expect(mapped.event?.log_type).toBe('hydration');
    expect(mapped.event?.metadata).toMatchObject({ notes: 'evening', scoringVersion: 'v2', wellness_quality: 4 });
  });

  it('rejects invalid log types', async () => {
    const { memberId } = await setupIdentity();
    expect(mapLegacyWellnessLog(wellnessDoc('s9', { logType: 'yoga' }), { memberId, pin: null }).malformed).toBe(
      'invalid_logType',
    );
  });
});

describe('import run (dry-run vs apply, idempotency)', () => {
  it('dry-run predicts without writing; apply is idempotent', async () => {
    const { db, memberId } = await setupIdentity();
    const source = {
      workouts: [workoutDoc('w1'), workoutDoc('w2', { exerciseId: 'custom-thing' }), workoutDoc('bad', { value: -1 })],
      wellnessLogs: [wellnessDoc('s1')],
    };
    const dry = await runActivityEventImport(db, source, resolvers(memberId), { dryRun: true });
    expect(dry.dryRun).toBe(true);
    expect(dry.workouts.scanned).toBe(3);
    expect(dry.workouts.imported).toBe(2);
    expect(dry.workouts.malformed).toHaveLength(1);
    expect(dry.unresolvedKnowledgeTotal).toBe(1);
    const stored = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM activity_events`);
    expect(stored.rows[0].n).toBe('0');

    const first = await runActivityEventImport(db, source, resolvers(memberId), { dryRun: false });
    expect(first.workouts.imported).toBe(2);
    expect(first.wellnessLogs.imported).toBe(1);
    const second = await runActivityEventImport(db, source, resolvers(memberId), { dryRun: false });
    expect(second.workouts.imported).toBe(0);
    expect(second.workouts.skipped_existing).toBe(2);
    expect(second.wellnessLogs.skipped_existing).toBe(1);
  });

  it('counts normalized days when legacy date buckets are absent', async () => {
    const { db, memberId } = await setupIdentity();
    const report = await runActivityEventImport(
      db,
      { workouts: [workoutDoc('wnd', { date: undefined })], wellnessLogs: [] },
      resolvers(memberId),
      { dryRun: true },
    );
    // completedAt still present -> occurred_at preserved; day bucket kept from... date missing -> derived
    expect(report.normalizedDays).toBe(1);
    expect(report.workouts.malformed).toHaveLength(0);
  });
});
