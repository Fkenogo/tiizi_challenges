/**
 * Phase C3A collective-unit integrity tests.
 *
 * Proves the smallest clean-V2 invariant (challenge_type === 'collective'
 *  =>  every activity.unit exactly equals goal_unit; no conversion is
 * inferred) at every enforcement boundary:
 * - new-challenge validation (early, before authority I/O);
 * - initial config insertion (v1);
 * - later config versions;
 * - persisted-snapshot loading (fail closed);
 * - SQL defence (migration 006 trigger);
 * while competitive/streak unit semantics stay untouched.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createChallenge,
  validateNewChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import {
  addChallengeConfigVersion,
  assertCollectiveUnitHomogeneity,
  getGoverningVersion,
  parseGoverningSnapshot,
  type ActivityConfigInput,
} from '../src/challengeConfigs.js';
import { testDb, seedMember, seedGroup, seedMembership, stubEligibility } from './helpers.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

let seq = 0;

async function seedKnowledgePin(key: string): Promise<{ knowledge_id: string; current_version: number }> {
  seq += 1;
  const result = await testDb().query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name) VALUES ('fitness', $1) RETURNING knowledge_id, current_version`,
    [`${key}-${seq}`],
  );
  return {
    knowledge_id: String(result.rows[0].knowledge_id),
    current_version: Number(result.rows[0].current_version),
  };
}

function resolversFor(pins: Record<string, { knowledge_id: string; current_version: number }>): ChallengeCreationResolvers {
  return {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
}

async function setupGroupWithMember(uid: string): Promise<{ groupId: string; memberId: string }> {
  const db = testDb();
  const memberId = await seedMember(db, uid);
  const groupId = await seedGroup(db, { name: `C3A Units ${uid}` });
  await seedMembership(db, groupId, memberId, { status: 'active' });
  return { groupId, memberId };
}

async function pinsFor(keys: string[]): Promise<Record<string, { knowledge_id: string; current_version: number }>> {
  const pins: Record<string, { knowledge_id: string; current_version: number }> = {};
  for (const key of keys) pins[key] = await seedKnowledgePin(key);
  return pins;
}

function collectiveInput(
  groupId: string,
  memberId: string,
  goalUnit: string,
  activities: ActivityConfigInput[],
): NewChallengeInput {
  return {
    group_id: groupId,
    created_by_member_id: memberId,
    challenge_type: 'collective',
    title: 'Collective units',
    start_date: '2026-06-01',
    end_date: '2026-06-30',
    goal_value: 1000,
    goal_unit: goalUnit,
    activities,
  };
}

const reps = (key: string, unit = 'reps', metric = 'repetitions'): ActivityConfigInput => ({
  canonical_key: key,
  metric,
  target_value: 20,
  unit,
});

describe('collective unit homogeneity (domain)', () => {
  it('homogeneous collective units accepted', async () => {
    const { groupId, memberId } = await setupGroupWithMember('c3a-units-ok');
    const pins = await pinsFor(['running', 'cycling']);
    const { challenge } = await createChallenge(
      testDb(),
      collectiveInput(groupId, memberId, 'minutes', [
        { canonical_key: 'running', metric: 'duration', target_value: 30, unit: 'minutes' },
        { canonical_key: 'cycling', metric: 'duration', target_value: 30, unit: 'minutes' },
      ]),
      resolversFor(pins),
    );
    expect(challenge.challenge_type).toBe('collective');
    expect(challenge.goal_unit).toBe('minutes');
  });

  it('activity unit != goal_unit rejected at creation', async () => {
    const { groupId, memberId } = await setupGroupWithMember('c3a-units-goal');
    const input = collectiveInput(groupId, memberId, 'minutes', [
      { canonical_key: 'running', metric: 'duration', target_value: 30, unit: 'minutes' },
      { canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'repetitions' },
    ]);
    // Early validation fails before any authority I/O or write.
    expect(() => validateNewChallenge(input)).toThrow(/must exactly equal goal_unit/);
    await expect(createChallenge(testDb(), input, resolversFor(await pinsFor(['running', 'push-up'])))).rejects.toThrow(
      /must exactly equal goal_unit/,
    );
  });

  it('mixed activity units rejected even when one matches the goal', async () => {
    const { groupId, memberId } = await setupGroupWithMember('c3a-units-mixed');
    await expect(
      createChallenge(
        testDb(),
        collectiveInput(groupId, memberId, 'kilometres', [
          { canonical_key: 'running', metric: 'distance', target_value: 5, unit: 'kilometres' },
          { canonical_key: 'lifting', metric: 'weight', target_value: 50, unit: 'kilograms' },
        ]),
        resolversFor(await pinsFor(['running', 'lifting'])),
      ),
    ).rejects.toThrow(/must exactly equal goal_unit/);
  });

  it('no inferred equivalence: minutes != hours, kilometres != kilograms', () => {
    expect(() =>
      assertCollectiveUnitHomogeneity('collective', 'minutes', [{ unit: 'minutes' }, { unit: 'hours' }]),
    ).toThrow(/must exactly equal goal_unit/);
    expect(() =>
      assertCollectiveUnitHomogeneity('collective', 'kilometres', [{ unit: 'kilometres' }, { unit: 'kilograms' }]),
    ).toThrow(/must exactly equal goal_unit/);
    expect(() =>
      assertCollectiveUnitHomogeneity('collective', 'minutes', [{ unit: 'minutes' }]),
    ).not.toThrow();
    // Non-collective families bypass the predicate entirely.
    expect(() =>
      assertCollectiveUnitHomogeneity('competitive', null, [{ unit: 'reps' }, { unit: 'ml' }]),
    ).not.toThrow();
    expect(() =>
      assertCollectiveUnitHomogeneity('streak', null, [{ unit: 'ml' }, { unit: 'hours' }]),
    ).not.toThrow();
  });

  it('later config version cannot introduce an incompatible unit', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember('c3a-units-v2');
    const pins = await pinsFor(['running', 'cycling']);
    const { challenge } = await createChallenge(
      db,
      collectiveInput(groupId, memberId, 'minutes', [
        { canonical_key: 'running', metric: 'duration', target_value: 30, unit: 'minutes' },
      ]),
      resolversFor(pins),
    );
    // A valid extension (same homogeneous units) succeeds ...
    const extended = await addChallengeConfigVersion(
      db,
      challenge.challenge_id,
      {
        end_date: '2026-07-31',
        activities: [
          { canonical_key: 'running', metric: 'duration', target_value: 30, unit: 'minutes' },
          { canonical_key: 'cycling', metric: 'duration', target_value: 30, unit: 'minutes' },
        ],
      },
      resolversFor(pins),
    );
    expect(extended.version.version).toBe(2);
    // ... but a version introducing repetitions is rejected atomically.
    await expect(
      addChallengeConfigVersion(
        db,
        challenge.challenge_id,
        {
          activities: [
            { canonical_key: 'running', metric: 'duration', target_value: 30, unit: 'minutes' },
            { canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'repetitions' },
          ],
        },
        resolversFor({ ...pins, 'push-up': await seedKnowledgePin('push-up') }),
      ),
    ).rejects.toThrow(/must exactly equal goal_unit/);
    const current = await db.query<{ current_config_version: number }>(
      `SELECT current_config_version FROM challenges WHERE challenge_id = $1`,
      [challenge.challenge_id],
    );
    expect(Number(current.rows[0].current_config_version)).toBe(2);
  });

  it('competitive configs keep per-activity units (unaffected)', async () => {
    const { groupId, memberId } = await setupGroupWithMember('c3a-units-comp');
    const pins = await pinsFor(['push-up', 'water-intake']);
    const { challenge } = await createChallenge(
      testDb(),
      {
        group_id: groupId,
        created_by_member_id: memberId,
        challenge_type: 'competitive',
        title: 'Mixed units race',
        start_date: '2026-06-01',
        end_date: '2026-06-30',
        activities: [reps('push-up'), { canonical_key: 'water-intake', metric: 'quantity', target_value: 2000, unit: 'millilitres' }],
      },
      resolversFor(pins),
    );
    expect(challenge.challenge_type).toBe('competitive');
  });

  it('streak configs keep per-activity units (unaffected)', async () => {
    const { groupId, memberId } = await setupGroupWithMember('c3a-units-streak');
    const pins = await pinsFor(['water-intake', 'sleep-8h']);
    const { challenge } = await createChallenge(
      testDb(),
      {
        group_id: groupId,
        created_by_member_id: memberId,
        challenge_type: 'streak',
        title: 'Mixed daily',
        start_date: '2026-06-01',
        end_date: '2026-06-30',
        required_consecutive_days: 30,
        activities: [
          { canonical_key: 'water-intake', metric: 'quantity', target_value: 2000, unit: 'millilitres' },
          { canonical_key: 'sleep-8h', metric: 'duration', target_value: 8, unit: 'hours' },
        ],
      },
      resolversFor(pins),
    );
    expect(challenge.challenge_type).toBe('streak');
  });
});

describe('malformed persisted snapshots fail closed', () => {
  it('parseGoverningSnapshot rejects collective snapshots with mixed units', () => {
    expect(() =>
      parseGoverningSnapshot({
        challenge_type: 'collective',
        period: { start_date: '2026-06-01', end_date: '2026-06-30' },
        type_params: { goal_value: 100, goal_unit: 'minutes', required_consecutive_days: null, reset_on_miss: true },
        activities: [
          {
            canonical_key: 'running', activity_variant: null, knowledge_id: 'k1',
            knowledge_version: 1, target_value: 30, unit: 'minutes', position: 0, conditions: {},
          },
          {
            canonical_key: 'push-up', activity_variant: null, knowledge_id: 'k2',
            knowledge_version: 1, target_value: 20, unit: 'repetitions', position: 1, conditions: {},
          },
        ],
      }),
    ).toThrow(/must exactly equal goal_unit/);
  });

  it('persisted snapshots cannot be mutated into corrupt state', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember('c3a-units-corrupt');
    const pins = await pinsFor(['running']);
    const { challenge } = await createChallenge(
      db,
      collectiveInput(groupId, memberId, 'minutes', [
        { canonical_key: 'running', metric: 'duration', target_value: 30, unit: 'minutes' },
      ]),
      resolversFor(pins),
    );
    // The versions immutability trigger blocks in-place snapshot tampering,
    // so a corrupt snapshot can never be smuggled past the write gates: the
    // only way to change governing terms is a new version, which passes the
    // C3A predicate (insertConfigVersion) and the 006 row trigger.
    await expect(
      db.query(
        `UPDATE challenge_config_versions SET snapshot = '{}' WHERE challenge_id = $1 AND version = 1`,
        [challenge.challenge_id],
      ),
    ).rejects.toThrow(/append-only/);
    await expect(getGoverningVersion(db, challenge.challenge_id, 1)).resolves.toMatchObject({ version: 1 });
  });
});

describe('migration 006 database defence', () => {
  it('direct SQL insert of a mismatched collective activity row is rejected', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember('c3a-units-sql');
    const pins = await pinsFor(['running']);
    const { challenge } = await createChallenge(
      db,
      collectiveInput(groupId, memberId, 'minutes', [
        { canonical_key: 'running', metric: 'duration', target_value: 30, unit: 'minutes' },
      ]),
      resolversFor(pins),
    );
    await expect(
      db.query(
        `INSERT INTO challenge_activity_configs
           (challenge_id, version, canonical_key, knowledge_id, knowledge_version, target_value, unit, position)
         VALUES ($1, 1, 'push-up', $2, 1, 20, 'repetitions', 1)`,
        [challenge.challenge_id, pins['running'].knowledge_id],
      ),
    ).rejects.toThrow(/must exactly equal goal_unit/);
  });

  it('direct SQL insert of a matching collective row passes the trigger', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember('c3a-units-sql-ok');
    const pins = await pinsFor(['running']);
    const { challenge } = await createChallenge(
      db,
      collectiveInput(groupId, memberId, 'minutes', [
        { canonical_key: 'running', metric: 'duration', target_value: 30, unit: 'minutes' },
      ]),
      resolversFor(pins),
    );
    // A hand-inserted row that honors the invariant passes the DB gate (the
    // snapshot/row cross-check still guards read-time consistency).
    await db.query(
      `INSERT INTO challenge_activity_configs
         (challenge_id, version, canonical_key, knowledge_id, knowledge_version, target_value, unit, position)
       VALUES ($1, 1, 'cycling', $2, 1, 30, 'minutes', 1)`,
      [challenge.challenge_id, pins['running'].knowledge_id],
    );
    const rows = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM challenge_activity_configs WHERE challenge_id = $1 AND version = 1`,
      [challenge.challenge_id],
    );
    expect(Number(rows.rows[0].count)).toBe(2);
  });

  it('trigger ignores competitive rows with mixed units', async () => {
    const db = testDb();
    const { groupId, memberId } = await setupGroupWithMember('c3a-units-sql-comp');
    const pins = await pinsFor(['push-up']);
    const { challenge } = await createChallenge(
      db,
      {
        group_id: groupId,
        created_by_member_id: memberId,
        challenge_type: 'competitive',
        title: 'Race',
        start_date: '2026-06-01',
        end_date: '2026-06-30',
        activities: [reps('push-up')],
      },
      resolversFor(pins),
    );
    await db.query(
      `INSERT INTO challenge_activity_configs
         (challenge_id, version, canonical_key, knowledge_id, knowledge_version, target_value, unit, position)
       VALUES ($1, 1, 'water-intake', $2, 1, 2000, 'ml', 1)`,
      [challenge.challenge_id, pins['push-up'].knowledge_id],
    );
  });
});
