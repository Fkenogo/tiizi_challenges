import assert from 'node:assert/strict';
import {
  deriveExerciseFilterOptions,
  deriveExerciseStats,
  exerciseFilterOptionsSource,
  exerciseStatsSource,
} from '../src/api/knowledgeAggregates.js';
import type { CatalogExercise } from '../src/types/index.js';

/**
 * Phase B runtime authority leak guard
 * (run: npm run test:knowledge-aggregates).
 *
 * - derived filters/stats preserve the legacy helper result shapes;
 * - firestore mode uses the legacy (Firestore) helper source;
 * - transition/postgres modes derive from the API canonical list;
 * - postgres mode never invokes the Firestore helper, and API errors
 *   propagate instead of falling back.
 */

const ex = (overrides: Partial<CatalogExercise>): CatalogExercise =>
  ({
    id: 'x',
    name: 'X',
    tier_1: 'Core',
    tier_2: 'Strength',
    difficulty: 'Beginner',
    equipment: [],
    ...overrides,
  }) as CatalogExercise;

const FIXTURES = [
  ex({ id: 'a', name: 'Push-Ups', tier_1: 'Upper Body', difficulty: 'Beginner', equipment: ['none'] }),
  ex({ id: 'b', name: 'Squats', tier_1: 'Lower Body', difficulty: 'Intermediate', equipment: ['barbell', 'rack'] }),
  ex({ id: 'c', name: 'Plank', tier_1: 'Core', difficulty: 'Beginner', equipment: ['none'] }),
];

async function run() {
  // Shape parity with the legacy helpers.
  assert.deepEqual(deriveExerciseStats(FIXTURES), {
    total: 3,
    byTier1: { 'Upper Body': 1, 'Lower Body': 1, Core: 1 },
    byTier2: { Strength: 3 },
    byDifficulty: { Beginner: 2, Intermediate: 1 },
    byEquipment: { none: 2, barbell: 1, rack: 1 },
  });
  assert.deepEqual(deriveExerciseFilterOptions(FIXTURES), {
    tier1: ['Core', 'Lower Body', 'Upper Body'],
    tier2: ['Strength'],
    difficulty: ['Beginner', 'Intermediate', 'Advanced'],
    equipment: ['barbell', 'none', 'rack'],
  });
  assert.deepEqual(deriveExerciseStats([]), {
    total: 0,
    byTier1: {},
    byTier2: {},
    byDifficulty: {},
    byEquipment: {},
  });

  // Source selection per mode.
  for (const check of [exerciseStatsSource, exerciseFilterOptionsSource] as const) {
    let legacyCalls = 0;
    let apiCalls = 0;
    const sources = {
      fetchApiExercises: async () => {
        apiCalls += 1;
        return FIXTURES;
      },
      fetchLegacy: async () => {
        legacyCalls += 1;
        return 'legacy' as never;
      },
    };

    const firestoreResult = await check('firestore', sources);
    assert.equal(firestoreResult, 'legacy', 'firestore mode must use the legacy helper');
    assert.equal(legacyCalls, 1);
    assert.equal(apiCalls, 0);

    legacyCalls = 0;
    const transitionResult = await check('transition', sources);
    assert.notEqual(transitionResult, 'legacy', 'transition mode must use the API source');
    assert.equal(legacyCalls, 0);
    assert.equal(apiCalls, 1);

    legacyCalls = 0;
    apiCalls = 0;
    const postgresResult = await check('postgres', sources);
    assert.notEqual(postgresResult, 'legacy', 'postgres mode must use the API source');
    assert.equal(legacyCalls, 0);
    assert.equal(apiCalls, 1);
  }

  // Postgres mode: API failure propagates; the Firestore helper is never
  // invoked as a substitute.
  {
    let legacyCalls = 0;
    const failing = {
      fetchApiExercises: async (): Promise<CatalogExercise[]> => {
        throw new Error('api 503');
      },
      fetchLegacy: async (): Promise<never> => {
        legacyCalls += 1;
        throw new Error('must not be called');
      },
    };
    await assert.rejects(exerciseStatsSource('postgres', failing), /api 503/);
    await assert.rejects(exerciseFilterOptionsSource('postgres', failing), /api 503/);
    assert.equal(legacyCalls, 0, 'postgres mode must never invoke the Firestore helper');
  }

  console.log('knowledge aggregates (runtime authority): 12 assertions passed');
}

await run();
