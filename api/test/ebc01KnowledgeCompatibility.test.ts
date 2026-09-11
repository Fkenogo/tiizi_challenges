/**
 * EBC-01 Knowledge compatibility tests.
 *
 * Proves the canonical (Activity, Metric, Unit) governance:
 * - governed vocabulary mapping (units belong to exactly one metric);
 * - tuple validation: valid combinations accepted; individually-valid but
 *   mismatched combinations rejected; unsupported metrics/units rejected;
 * - establishment eligibility: published + non-grandfathered (KCS-ready)
 *   only; grandfathered/draft/retired/unknown/ambiguous resolve to null;
 * - historical grandfathered Knowledge stays readable and resolvable
 *   (runtime pins untouched) while barred from NEW establishment;
 * - client raw IDs/strings cannot bypass validation;
 * - historical Challenge configurations stay interpretable after
 *   Knowledge changes and versioning.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { stubVerifier, testDb, seedMember, seedGroup, authHeaders } from './helpers.js';
import {
  GOVERNED_UNITS,
  isCanonicalMetric,
  metricForUnit,
} from '../src/measurementVocabulary.js';
import {
  assertActivityMeasurementCompatible,
  createDbKnowledgeEligibilityResolver,
  type KnowledgeEligibility,
} from '../src/knowledgeEligibility.js';
import { resolveKnowledgePinByName } from '../src/knowledgePins.js';
import { parseGoverningSnapshot } from '../src/challengeConfigs.js';
import { getChallengeConfig } from '../src/challengeConfigs.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events',
  );
});

let seq = 0;

function eligibilityFixture(overrides: Partial<KnowledgeEligibility> = {}): KnowledgeEligibility {
  return {
    knowledgeId: '00000000-0000-4000-8000-000000000001',
    version: 1,
    kind: 'fitness',
    lifecycle: 'published',
    grandfathered: false,
    primaryMetrics: ['repetitions'],
    secondaryMetrics: ['weight'],
    compatibleUnits: ['reps', 'grams', 'kilograms'],
    ...overrides,
  };
}

describe('governed measurement vocabulary', () => {
  it('every governed unit belongs to exactly one canonical metric', () => {
    expect(isCanonicalMetric('repetitions')).toBe(true);
    expect(isCanonicalMetric('reps')).toBe(false);
    expect(metricForUnit('reps')).toBe('repetitions');
    expect(metricForUnit('repetitions')).toBe('repetitions');
    expect(metricForUnit('minutes')).toBe('duration');
    expect(metricForUnit('kilometres')).toBe('distance');
    expect(metricForUnit('kilograms')).toBe('weight');
    expect(metricForUnit('servings')).toBe('quantity');
    expect(metricForUnit('completion')).toBe('completion');
    expect(metricForUnit('ml')).toBeNull();
    expect(metricForUnit('km')).toBeNull();
    expect(metricForUnit('')).toBeNull();
    expect(GOVERNED_UNITS.length).toBeGreaterThan(10);
  });
});

describe('tuple validation', () => {
  it('valid (Activity, Metric, Unit) tuples accepted, including secondary metrics', () => {
    const eligibility = eligibilityFixture();
    expect(() =>
      assertActivityMeasurementCompatible(
        eligibility,
        { canonical_key: 'deadlift', metric: 'repetitions', unit: 'reps' },
        0,
      ),
    ).not.toThrow();
    expect(() =>
      assertActivityMeasurementCompatible(
        eligibility,
        { canonical_key: 'deadlift', metric: 'weight', unit: 'kilograms' },
        0,
      ),
    ).not.toThrow();
  });

  it('valid Metric + valid Unit in an INVALID combination rejected', () => {
    const eligibility = eligibilityFixture({
      primaryMetrics: ['repetitions', 'duration'],
      secondaryMetrics: [],
      compatibleUnits: ['reps', 'minutes'],
    });
    // Both 'repetitions' and 'minutes' are individually governed and both
    // belong to this Activity's contract — but not to EACH OTHER.
    expect(() =>
      assertActivityMeasurementCompatible(
        eligibility,
        { canonical_key: 'push-up', metric: 'repetitions', unit: 'minutes' },
        0,
      ),
    ).toThrow(/not the configured metric|tuple must be governed/);
  });

  it('unsupported metric, unsupported unit, and missing metric rejected', () => {
    const eligibility = eligibilityFixture();
    expect(() =>
      assertActivityMeasurementCompatible(
        eligibility,
        { canonical_key: 'push-up', metric: 'duration', unit: 'minutes' },
        0,
      ),
    ).toThrow(/not permitted for this Activity/);
    expect(() =>
      assertActivityMeasurementCompatible(
        eligibility,
        { canonical_key: 'push-up', metric: 'repetitions', unit: 'minutes' },
        1,
      ),
    ).toThrow(/not compatible with this Activity/);
    expect(() =>
      assertActivityMeasurementCompatible(
        eligibility,
        { canonical_key: 'push-up', metric: null, unit: 'reps' },
        2,
      ),
    ).toThrow(/must be a canonical Metric/);
    expect(() =>
      assertActivityMeasurementCompatible(
        eligibilityFixture({ primaryMetrics: [], secondaryMetrics: [], compatibleUnits: [] }),
        { canonical_key: 'legacy-move', metric: 'repetitions', unit: 'reps' },
        0,
      ),
    ).toThrow(/permitted: none/);
  });
});

describe('establishment eligibility gate', () => {
  async function seedItem(
    name: string,
    overrides: {
      lifecycle?: string;
      grandfathered?: boolean;
      primary?: string[];
      secondary?: string[];
      units?: string[];
      kind?: string;
    } = {},
  ): Promise<void> {
    await testDb().query(
      `INSERT INTO knowledge_items
         (kind, name, lifecycle, grandfathered, primary_metrics, secondary_metrics, compatible_units)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        overrides.kind ?? 'fitness',
        name,
        overrides.lifecycle ?? 'published',
        overrides.grandfathered ?? false,
        overrides.primary ?? ['repetitions'],
        overrides.secondary ?? [],
        overrides.units ?? ['reps'],
      ],
    );
  }

  it('published KCS-ready item with a contract resolves; everything else is null', async () => {
    const db = testDb();
    const tag = `elig${(seq += 1)}`;
    await seedItem(`ok-${tag}`);
    await seedItem(`grandfathered-${tag}`, { grandfathered: true });
    await seedItem(`draft-${tag}`, { lifecycle: 'draft' });
    await seedItem(`retired-${tag}`, { lifecycle: 'retired' });

    const resolve = createDbKnowledgeEligibilityResolver(db, 'fitness');
    const ok = await resolve(`ok-${tag}`);
    expect(ok).toMatchObject({
      kind: 'fitness',
      lifecycle: 'published',
      grandfathered: false,
      primaryMetrics: ['repetitions'],
      compatibleUnits: ['reps'],
    });
    expect(await resolve(`grandfathered-${tag}`)).toBeNull();
    expect(await resolve(`draft-${tag}`)).toBeNull();
    expect(await resolve(`retired-${tag}`)).toBeNull();
    expect(await resolve(`missing-${tag}`)).toBeNull();
  });

  it('ambiguous duplicate names fail closed', async () => {
    const db = testDb();
    const tag = `dup${(seq += 1)}`;
    await seedItem(`same-${tag}`);
    await seedItem(`same-${tag}`);
    expect(await createDbKnowledgeEligibilityResolver(db, 'fitness')(`same-${tag}`)).toBeNull();
  });

  it('historical grandfathered Knowledge stays readable and pin-resolvable', async () => {
    const db = testDb();
    const tag = `hist${(seq += 1)}`;
    await seedItem(`old-move-${tag}`, { grandfathered: true });
    // Runtime pins (C2B + historical reads) still resolve grandfathered items…
    const pin = await resolveKnowledgePinByName(db, 'fitness', `old-move-${tag}`);
    expect(pin).not.toBeNull();
    // …while NEW establishment eligibility denies them.
    expect(await createDbKnowledgeEligibilityResolver(db, 'fitness')(`old-move-${tag}`)).toBeNull();
    // …and the item stays readable through the public API shape.
    const readable = await db.query<{ name: string; lifecycle: string }>(
      `SELECT name, lifecycle FROM knowledge_items WHERE name = $1`,
      [`old-move-${tag}`],
    );
    expect(readable.rows[0]).toMatchObject({ lifecycle: 'published' });
  });
});

describe('compatibility administration', () => {
  async function adminApp(token: string, uid: string) {
    const db = testDb();
    await seedMember(db, uid);
    await db.query(`UPDATE members SET role = 'admin' WHERE auth_subject = $1`, [uid]);
    return buildApp({ db, verifier: stubVerifier({ [token]: uid }) });
  }

  async function seedPublished(name: string): Promise<string> {
    const result = await testDb().query<{ knowledge_id: string }>(
      `INSERT INTO knowledge_items (kind, name, lifecycle, grandfathered)
       VALUES ('fitness', $1, 'published', FALSE) RETURNING knowledge_id`,
      [name],
    );
    return String(result.rows[0].knowledge_id);
  }

  it('admin declares a coherent contract; values normalize deterministically', async () => {
    const tag = `adm${(seq += 1)}`;
    const app = await adminApp(`adm-token-${tag}`, `adm-uid-${tag}`);
    const id = await seedPublished(`contract-${tag}`);

    const response = await app.inject({
      method: 'PUT',
      url: `/v1/admin/knowledge/${id}/compatibility`,
      headers: authHeaders(`adm-token-${tag}`),
      payload: {
        primaryMetrics: ['duration', 'repetitions'],
        secondaryMetrics: ['weight'],
        compatibleUnits: ['minutes', 'reps', 'kilograms'],
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      primaryMetrics: string[]; secondaryMetrics: string[]; compatibleUnits: string[];
    };
    expect(body.primaryMetrics).toEqual(['duration', 'repetitions']);
    expect(body.secondaryMetrics).toEqual(['weight']);
    expect(body.compatibleUnits).toEqual(['kilograms', 'minutes', 'reps']);

    // The public item shape exposes the contract for future creation UI.
    const read = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${id}`,
      headers: authHeaders(`adm-token-${tag}`),
    });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toMatchObject({
      primaryMetrics: ['duration', 'repetitions'],
      compatibleUnits: ['kilograms', 'minutes', 'reps'],
    });
  });

  it('incoherent, overlapping, and ungoverned contracts rejected', async () => {
    const tag = `bad${(seq += 1)}`;
    const app = await adminApp(`adm-token-${tag}`, `adm-uid-${tag}`);
    const id = await seedPublished(`contract-${tag}`);
    const headers = authHeaders(`adm-token-${tag}`);

    // 'reps' expresses repetitions, which is not declared.
    const incoherent = await app.inject({
      method: 'PUT',
      url: `/v1/admin/knowledge/${id}/compatibility`,
      headers,
      payload: { primaryMetrics: ['duration'], compatibleUnits: ['reps'] },
    });
    expect(incoherent.statusCode).toBe(400);

    const overlap = await app.inject({
      method: 'PUT',
      url: `/v1/admin/knowledge/${id}/compatibility`,
      headers,
      payload: { primaryMetrics: ['repetitions'], secondaryMetrics: ['repetitions'] },
    });
    expect(overlap.statusCode).toBe(400);

    const ungoverned = await app.inject({
      method: 'PUT',
      url: `/v1/admin/knowledge/${id}/compatibility`,
      headers,
      payload: { primaryMetrics: ['repetitions'], compatibleUnits: ['smoots'] },
    });
    expect(ungoverned.statusCode).toBe(400);

    const unknownMetric = await app.inject({
      method: 'PUT',
      url: `/v1/admin/knowledge/${id}/compatibility`,
      headers,
      payload: { primaryMetrics: ['cardio'] },
    });
    expect(unknownMetric.statusCode).toBe(400);
  });

  it('non-admin cannot declare contracts; unknown items 404', async () => {
    const tag = `perm${(seq += 1)}`;
    const db = testDb();
    await seedMember(db, `member-${tag}`);
    const app = buildApp({ db, verifier: stubVerifier({ [`token-${tag}`]: `member-${tag}` }) });
    const id = await seedPublished(`contract-${tag}`);

    const forbidden = await app.inject({
      method: 'PUT',
      url: `/v1/admin/knowledge/${id}/compatibility`,
      headers: authHeaders(`token-${tag}`),
      payload: { primaryMetrics: ['repetitions'], compatibleUnits: ['reps'] },
    });
    expect(forbidden.statusCode).toBe(403);

    await db.query(`UPDATE members SET role = 'admin' WHERE auth_subject = $1`, [`member-${tag}`]);
    const missing = await app.inject({
      method: 'PUT',
      url: '/v1/admin/knowledge/00000000-0000-4000-8000-000000000000/compatibility',
      headers: authHeaders(`token-${tag}`),
      payload: { primaryMetrics: ['repetitions'] },
    });
    expect(missing.statusCode).toBe(404);
  });
});

describe('establishment compatibility enforcement (route)', () => {
  interface EstablishmentWorld {
    token: string;
    groupId: string;
  }

  async function establishmentApp(
    w: EstablishmentWorld,
    items: Array<{
      name: string;
      lifecycle?: string;
      grandfathered?: boolean;
      primary?: string[];
      secondary?: string[];
      units?: string[];
    }>,
  ) {
    const db = testDb();
    for (const item of items) {
      await db.query(
        `INSERT INTO knowledge_items
           (kind, name, lifecycle, grandfathered, primary_metrics, secondary_metrics, compatible_units)
         VALUES ('fitness', $1, $2, $3, $4, $5, $6)`,
        [
          item.name,
          item.lifecycle ?? 'published',
          item.grandfathered ?? false,
          item.primary ?? ['repetitions'],
          item.secondary ?? [],
          item.units ?? ['reps'],
        ],
      );
    }
    return buildApp({
      db,
      verifier: stubVerifier({ [w.token]: w.token.replace('token-', '') }),
      challengeCreation: {
        creationAuthority: {
          async resolveChallengeCreationAuthority() {
            return {
              permitted: true as const,
              reason: null,
              groupStatus: 'active',
              allowMemberChallenges: true,
              memberRole: 'member',
              memberStatus: 'active',
            };
          },
        },
        eligibilityFor: async (kind, key) => createDbKnowledgeEligibilityResolver(db, kind)(key),
      },
    });
  }

  async function setup(): Promise<EstablishmentWorld> {
    const db = testDb();
    const tag = `est${(seq += 1)}`;
    const uid = `est-uid-${tag}`;
    await seedMember(db, uid);
    const groupId = await seedGroup(db, { name: `Est ${tag}` });
    return { token: `token-${uid}`, groupId };
  }

  function body(
    w: EstablishmentWorld,
    name: string,
    activity: Record<string, unknown> = {},
  ) {
    return {
      group_id: w.groupId,
      challenge_type: 'competitive',
      title: 'Compatibility probe',
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      activities: [
        {
          activity_kind: 'fitness',
          canonical_key: name,
          metric: 'repetitions',
          target_value: 20,
          unit: 'reps',
          ...activity,
        },
      ],
    };
  }

  async function challengeCount(): Promise<number> {
    const result = await testDb().query<{ count: string }>(`SELECT COUNT(*) AS count FROM challenges`);
    return Number(result.rows[0].count);
  }

  it('mismatched but individually valid tuple rejected with no state', async () => {
    const w = await setup();
    const app = await establishmentApp(w, [
      {
        name: `combo-${w.token}`,
        primary: ['repetitions', 'duration'],
        units: ['reps', 'minutes'],
      },
    ]);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, `combo-${w.token}`, { metric: 'repetitions', unit: 'minutes' }),
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toBeTruthy();
    expect(await challengeCount()).toBe(0);
  });

  it('unsupported unit, grandfathered, draft, and unknown knowledge rejected', async () => {
    const w = await setup();
    const app = await establishmentApp(w, [
      { name: `strict-${w.token}`, primary: ['repetitions'], units: ['reps'] },
      { name: `grand-${w.token}`, grandfathered: true, primary: ['repetitions'], units: ['reps'] },
      { name: `draft-${w.token}`, lifecycle: 'draft', primary: ['repetitions'], units: ['reps'] },
    ]);
    const headers = authHeaders(w.token);

    const unsupportedUnit = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers,
      payload: body(w, `strict-${w.token}`, { unit: 'fortnights' }),
    });
    expect(unsupportedUnit.statusCode).toBe(422);

    const grandfathered = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers,
      payload: body(w, `grand-${w.token}`),
    });
    expect(grandfathered.statusCode).toBe(422);

    const draft = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers,
      payload: body(w, `draft-${w.token}`),
    });
    expect(draft.statusCode).toBe(422);

    const unknown = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers,
      payload: body(w, `no-such-activity-${w.token}`),
    });
    expect(unknown.statusCode).toBe(422);
    expect(await challengeCount()).toBe(0);
  });

  it('raw IDs and ungoverned metrics cannot bypass validation', async () => {
    const w = await setup();
    const app = await establishmentApp(w, [
      { name: `raw-${w.token}`, primary: ['repetitions'], units: ['reps'] },
    ]);
    const headers = authHeaders(w.token);

    const rawIds = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers,
      payload: {
        ...body(w, `raw-${w.token}`),
        knowledge_id: '00000000-0000-4000-8000-000000000000',
      },
    });
    expect(rawIds.statusCode).toBe(400);

    const smuggled = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers,
      payload: {
        ...body(w, `raw-${w.token}`),
        activities: [
          {
            activity_kind: 'fitness',
            canonical_key: `raw-${w.token}`,
            knowledge_id: '00000000-0000-4000-8000-000000000000',
            metric: 'repetitions',
            target_value: 20,
            unit: 'reps',
          },
        ],
      },
    });
    expect(smuggled.statusCode).toBe(400);

    const ungovernedMetric = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers,
      payload: body(w, `raw-${w.token}`, { metric: 'steps_count' }),
    });
    expect(ungovernedMetric.statusCode).toBe(400);
    expect(await challengeCount()).toBe(0);
  });
});

describe('historical configuration interpretability', () => {
  it('pre-EBC-01 snapshots without a metric still parse', () => {
    const parsed = parseGoverningSnapshot({
      challenge_type: 'collective',
      period: { start_date: '2026-06-01', end_date: '2026-06-30' },
      type_params: { goal_value: 100, goal_unit: 'reps', required_consecutive_days: null, reset_on_miss: true },
      activities: [
        {
          canonical_key: 'push-up',
          activity_variant: null,
          knowledge_id: '00000000-0000-4000-8000-000000000001',
          knowledge_version: 1,
          target_value: 20,
          unit: 'reps',
          position: 0,
          conditions: {},
        },
      ],
    });
    expect(parsed.activities[0].metric).toBeNull();
    expect(parsed.activities[0].unit).toBe('reps');
  });

  it('pre-EBC-01 config rows read back with a null metric; pins stay stable across revisions', async () => {
    const db = testDb();
    const tag = `legacy${(seq += 1)}`;
    const memberId = await seedMember(db, `legacy-uid-${tag}`);
    const groupId = await seedGroup(db, { name: `Legacy ${tag}` });
    const knowledge = await db.query<{ knowledge_id: string }>(
      `INSERT INTO knowledge_items (kind, name, lifecycle, grandfathered)
       VALUES ('fitness', $1, 'published', FALSE) RETURNING knowledge_id`,
      [`legacy-move-${tag}`],
    );
    const knowledgeId = String(knowledge.rows[0].knowledge_id);
    // Simulate a pre-EBC-01 persisted configuration (no metric anywhere).
    const challenge = await db.query<{ challenge_id: string }>(
      `INSERT INTO challenges
         (group_id, created_by_member_id, challenge_type, title, start_date, end_date,
          goal_value, goal_unit)
       VALUES ($1, $2, 'collective', 'Legacy', '2026-06-01', '2026-06-30', 100, 'reps')
       RETURNING challenge_id`,
      [groupId, memberId],
    );
    const challengeId = String(challenge.rows[0].challenge_id);
    await db.query(
      `INSERT INTO challenge_config_versions (challenge_id, version, snapshot)
       VALUES ($1, 1, $2)`,
      [challengeId, JSON.stringify({
        challenge_type: 'collective',
        period: { start_date: '2026-06-01', end_date: '2026-06-30' },
        type_params: { goal_value: 100, goal_unit: 'reps', required_consecutive_days: null, reset_on_miss: true },
        activities: [{
          canonical_key: `legacy-move-${tag}`,
          activity_variant: null,
          knowledge_id: knowledgeId,
          knowledge_version: 1,
          target_value: 20,
          unit: 'reps',
          position: 0,
          conditions: {},
        }],
      })],
    );
    await db.query(
      `INSERT INTO challenge_activity_configs
         (challenge_id, version, canonical_key, knowledge_id, knowledge_version,
          target_value, unit, position, conditions)
       VALUES ($1, 1, $2, $3, 1, 20, 'reps', 0, '{}')`,
      [challengeId, `legacy-move-${tag}`, knowledgeId],
    );

    const config = await getChallengeConfig(db, challengeId);
    expect(config.activities[0].metric).toBeNull();
    expect(parseGoverningSnapshot(config.version.snapshot).activities[0].metric).toBeNull();

    // A later Knowledge revision does not move the historical pin.
    await db.query(`UPDATE knowledge_items SET current_version = 2 WHERE knowledge_id = $1`, [knowledgeId]);
    const reread = await getChallengeConfig(db, challengeId);
    expect(reread.activities[0].knowledge_version).toBe(1);
  });
});
