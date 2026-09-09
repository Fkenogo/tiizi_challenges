import { beforeEach, describe, expect, it } from 'vitest';
import { runActivityEventImport } from '../src/activityEventImport.js';
import { runActivityEventParity } from '../src/activityEventParity.js';
import { testDb, seedMember } from './helpers.js';

beforeEach(async () => {
  await testDb().query('TRUNCATE activity_events');
});

const UID = 'uid-parity-1';

async function setup() {
  const db = testDb();
  const memberId = await seedMember(db, UID);
  await db.query(
    `INSERT INTO knowledge_items (knowledge_id, kind, legacy_firestore_id, legacy_collection, lifecycle, current_version, name)
     VALUES ('22222222-2222-4222-8222-222222222222', 'fitness', 'push-up', 'catalogExercises', 'published', 2, 'Push-Up')`,
  );
  const resolvers = {
    resolveMemberId: async (_p: string, uid: string) => (uid === UID ? memberId : null),
    resolveKnowledgePin: async (key: string) =>
      key === 'push-up'
        ? { knowledge_id: '22222222-2222-4222-8222-222222222222', current_version: 2 }
        : null,
  };
  const memberMap: Record<string, string> = { [UID]: memberId };
  return { db, memberId, resolvers, memberMap };
}

function workoutDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: {
      userId: UID,
      challengeId: 'challenge-fs-9',
      exerciseId: 'push-up',
      value: 15,
      unit: 'reps',
      points: 60,
      completedAt: '2026-05-04T08:00:00.000Z',
      date: '2026-05-04',
      ...overrides,
    },
  };
}

describe('event parity comparator', () => {
  it('matches a clean import exactly', async () => {
    const { db, resolvers, memberMap } = await setup();
    const source = { workouts: [workoutDoc('w1'), workoutDoc('w2')], wellnessLogs: [] };
    await runActivityEventImport(db, source, resolvers, { dryRun: false });
    const report = await runActivityEventParity(db, source, memberMap, resolvers.resolveKnowledgePin);
    expect(report.match).toBe(true);
    expect(report.differences).toEqual([]);
    expect(report.firestoreCounts).toEqual({ workouts: 2, wellnessLogs: 0 });
    expect(report.pgCounts).toEqual({ workouts: 2, wellnessLogs: 0 });
  });

  it('flags value drift as a material field mismatch', async () => {
    const { db, resolvers, memberMap } = await setup();
    const source = { workouts: [workoutDoc('w1')], wellnessLogs: [] };
    await runActivityEventImport(db, source, resolvers, { dryRun: false });
    const drifted = { workouts: [workoutDoc('w1', { value: 999 })], wellnessLogs: [] };
    const report = await runActivityEventParity(db, drifted, memberMap, resolvers.resolveKnowledgePin);
    expect(report.match).toBe(false);
    expect(report.differences.some((d) => d.kind === 'field_mismatch' && d.field === 'value')).toBe(true);
  });

  it('flags ledger rows without Firestore records as pg orphans', async () => {
    const { db, resolvers, memberMap } = await setup();
    const source = { workouts: [workoutDoc('w1')], wellnessLogs: [] };
    await runActivityEventImport(db, source, resolvers, { dryRun: false });
    const report = await runActivityEventParity(db, { workouts: [], wellnessLogs: [] }, memberMap, resolvers.resolveKnowledgePin);
    expect(report.match).toBe(false);
    expect(report.differences.some((d) => d.kind === 'pg_orphan')).toBe(true);
  });

  it('surfaces unknown-member records as non-blocking orphans', async () => {
    const { db, resolvers, memberMap } = await setup();
    const source = { workouts: [workoutDoc('ghost', { userId: 'no-such-uid' })], wellnessLogs: [] };
    const report = await runActivityEventParity(db, source, memberMap, resolvers.resolveKnowledgePin);
    expect(report.legacyOrphans).toHaveLength(1);
    expect(report.legacyOrphans[0].reason).toBe('unknown_member');
    expect(report.match).toBe(true);
  });

  it('detects knowledge pin drift', async () => {
    const { db, resolvers, memberMap } = await setup();
    const source = { workouts: [workoutDoc('w1')], wellnessLogs: [] };
    await runActivityEventImport(db, source, resolvers, { dryRun: false });
    // Knowledge version moves on after import: parity must notice the pin is now stale.
    await db.query(`UPDATE knowledge_items SET current_version = 5 WHERE knowledge_id = '22222222-2222-4222-8222-222222222222'`);
    const report = await runActivityEventParity(db, source, memberMap, async () => ({
      knowledge_id: '22222222-2222-4222-8222-222222222222',
      current_version: 5,
    }));
    expect(report.match).toBe(false);
    expect(report.differences.some((d) => d.field === 'knowledge_version')).toBe(true);
  });
});
