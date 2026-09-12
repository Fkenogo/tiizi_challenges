/**
 * EBC-01 Knowledge compatibility tests.
 *
 * Proves the canonical (Activity, Metric, Unit) governance:
 * - governed vocabulary mapping (units belong to exactly one metric);
 * - tuple validation: valid combinations accepted; individually-valid but
 *   mismatched combinations rejected; unsupported metrics/units rejected;
 * - establishment eligibility: current-version KCS readiness only
 *   (grandfathered is provenance, never the test); content-thin,
 *   draft/retired/unknown/ambiguous resolve to null;
 * - historical grandfathered Knowledge stays readable and resolvable
 *   (runtime pins untouched); untouched pre-KCS items stay ineligible
 *   while revised-under-gate items become eligible with provenance intact;
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
import {
  addChallengeConfigVersion,
  getChallengeConfig,
  parseGoverningSnapshot,
} from '../src/challengeConfigs.js';
import { createChallenge } from '../src/challenges.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
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
  it('encodes exactly the Founder baseline table (drift guard, CORR-001 §5)', () => {
    // Mechanically grounded in TIIZI-V2-METRIC-AND-UNIT-MODEL-FOUNDER-
    // WORKING-BASELINE §2 (Metrics) + §3 (compatible Units per Metric).
    // Any divergence here is a defect in measurementVocabulary.ts, not an
    // approved catalogue change (the catalogue itself is never carried in
    // code — per-Activity compatibility is canonical Knowledge).
    const table: Record<string, string[]> = {
      completion: ['completion'],
      repetitions: ['reps', 'repetitions'],
      duration: ['seconds', 'minutes', 'hours'],
      distance: ['metres', 'kilometres'],
      weight: ['grams', 'kilograms'],
      quantity: ['steps', 'millilitres', 'litres', 'servings', 'pages', 'acts', 'flights'],
    };
    expect(Object.keys(table).sort()).toEqual([
      'completion',
      'distance',
      'duration',
      'quantity',
      'repetitions',
      'weight',
    ]);
    for (const [metric, units] of Object.entries(table)) {
      for (const unit of units) {
        expect(metricForUnit(unit)).toBe(metric);
      }
    }
    // No other governed units exist: the vocabulary is closed.
    const total = Object.values(table).reduce((sum, units) => sum + units.length, 0);
    expect(GOVERNED_UNITS).toHaveLength(total);
    expect([...GOVERNED_UNITS].sort()).toEqual(
      Object.values(table).flat().sort(),
    );
  });

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
      /** KCS-satisfying content (description, category, metric unit,
       *  measurement guidance, safety notes). Absent = content-thin. */
      readyContent?: boolean;
    } = {},
  ): Promise<void> {
    const ready = overrides.readyContent ?? true;
    await testDb().query(
      `INSERT INTO knowledge_items
         (kind, name, lifecycle, grandfathered, description, category,
          metric_unit, measurement_guidance, safety_notes,
          primary_metrics, secondary_metrics, compatible_units)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        overrides.kind ?? 'fitness',
        name,
        overrides.lifecycle ?? 'published',
        overrides.grandfathered ?? false,
        ready ? 'A governed test movement' : '',
        ready ? 'Upper Body' : '',
        ready ? 'reps' : '',
        ready ? 'Count full-range repetitions' : '',
        ready ? ['Stop on sharp pain'] : [],
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
    await seedItem(`thin-${tag}`, { readyContent: false });
    await seedItem(`grandfathered-${tag}`, { grandfathered: true, readyContent: false });
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
    // Content-thin published items fail readiness — grandfathered or not.
    expect(await resolve(`thin-${tag}`)).toBeNull();
    expect(await resolve(`grandfathered-${tag}`)).toBeNull();
    expect(await resolve(`draft-${tag}`)).toBeNull();
    expect(await resolve(`retired-${tag}`)).toBeNull();
    expect(await resolve(`missing-${tag}`)).toBeNull();
  });

  it('grandfathered item revised under the KCS gate becomes eligible with provenance intact', async () => {
    const db = testDb();
    const tag = `rev${(seq += 1)}`;
    const name = `revised-${tag}`;
    // Untouched pre-KCS grandfathered item: readable, pin-resolvable, ineligible.
    await seedItem(name, { grandfathered: true, readyContent: false });
    expect(await createDbKnowledgeEligibilityResolver(db, 'fitness')(name)).toBeNull();

    // Revise under the current KCS gate through the governed admin path.
    const adminUid = `rev-admin-${tag}`;
    await seedMember(db, adminUid);
    await db.query(`UPDATE members SET role = 'admin' WHERE auth_subject = $1`, [adminUid]);
    const app = buildApp({ db, verifier: stubVerifier({ [`rev-token-${tag}`]: adminUid }) });
    const item = await db.query<{ knowledge_id: string }>(
      `SELECT knowledge_id FROM knowledge_items WHERE name = $1`,
      [name],
    );
    const id = String(item.rows[0].knowledge_id);
    const revised = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/knowledge/${id}`,
      headers: authHeaders(`rev-token-${tag}`),
      payload: {
        name,
        category: 'Upper Body',
        difficulty: 'Beginner',
        metricUnit: 'reps',
        description: 'A revised governed movement',
        measurementGuidance: 'Count full-range repetitions',
        safetyNotes: ['Stop on sharp pain'],
      },
    });
    expect(revised.statusCode).toBe(200);

    // Eligible now — while grandfathered provenance remains TRUE.
    const eligibility = await createDbKnowledgeEligibilityResolver(db, 'fitness')(name);
    expect(eligibility).not.toBeNull();
    expect(eligibility).toMatchObject({ grandfathered: true, version: 2 });
    const check = await db.query<{ grandfathered: boolean; current_version: number }>(
      `SELECT grandfathered, current_version FROM knowledge_items WHERE knowledge_id = $1`,
      [id],
    );
    expect(check.rows[0]).toMatchObject({ grandfathered: true, current_version: 2 });
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
    await seedItem(`old-move-${tag}`, { grandfathered: true, readyContent: false });
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
      readyContent?: boolean;
    }>,
  ) {
    const db = testDb();
    for (const item of items) {
      const ready = item.readyContent ?? true;
      await db.query(
        `INSERT INTO knowledge_items
           (kind, name, lifecycle, grandfathered, description, category,
            metric_unit, measurement_guidance, safety_notes,
            primary_metrics, secondary_metrics, compatible_units)
         VALUES ('fitness', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          item.name,
          item.lifecycle ?? 'published',
          item.grandfathered ?? false,
          ready ? 'A governed test movement' : '',
          ready ? 'Upper Body' : '',
          ready ? 'reps' : '',
          ready ? 'Count full-range repetitions' : '',
          ready ? ['Stop on sharp pain'] : [],
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

  it('unsupported unit, content-thin, draft, and unknown knowledge rejected', async () => {
    const w = await setup();
    const app = await establishmentApp(w, [
      { name: `strict-${w.token}`, primary: ['repetitions'], units: ['reps'] },
      { name: `thin-${w.token}`, readyContent: false, primary: ['repetitions'], units: ['reps'] },
      {
        name: `thin-grand-${w.token}`,
        grandfathered: true,
        readyContent: false,
        primary: ['repetitions'],
        units: ['reps'],
      },
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

    const thin = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers,
      payload: body(w, `thin-${w.token}`),
    });
    expect(thin.statusCode).toBe(422);

    const thinGrandfathered = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers,
      payload: body(w, `thin-grand-${w.token}`),
    });
    expect(thinGrandfathered.statusCode).toBe(422);

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

  it('grandfathered provenance alone never decides: ready content establishes', async () => {
    const w = await setup();
    const app = await establishmentApp(w, [
      {
        name: `grand-ready-${w.token}`,
        grandfathered: true,
        primary: ['repetitions'],
        units: ['reps'],
      },
    ]);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, `grand-ready-${w.token}`),
    });
    // Content satisfies the current KCS gate, so the item establishes even
    // though historical provenance remains grandfathered = TRUE.
    expect(response.statusCode).toBe(201);
    expect(await challengeCount()).toBe(1);
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

describe('later config versions cannot bypass compatibility (domain seam)', () => {
  it('addChallengeConfigVersion rejects an unproven tuple without any HTTP route', async () => {
    const db = testDb();
    const tag = `ver${(seq += 1)}`;
    const memberId = await seedMember(db, `ver-uid-${tag}`);
    const groupId = await seedGroup(db, { name: `Versions ${tag}` });
    await db.query(
      `INSERT INTO group_memberships (group_id, member_id, role, status)
       VALUES ($1, $2, 'member', 'active')`,
      [groupId, memberId],
    );
    const pins: Record<string, { knowledge_id: string; current_version: number }> = {};
    for (const key of [`push-up-${tag}`, `running-${tag}`]) {
      const pin = await db.query<{ knowledge_id: string; current_version: number }>(
        `INSERT INTO knowledge_items (kind, name) VALUES ('fitness', $1)
         RETURNING knowledge_id, current_version`,
        [key],
      );
      pins[key] = {
        knowledge_id: String(pin.rows[0].knowledge_id),
        current_version: Number(pin.rows[0].current_version),
      };
    }
    // Strict per-activity contracts (the same authoritative validator the
    // route uses — no HTTP involved on this path).
    const contracts: Record<string, { primary: string[]; units: string[] }> = {
      [`push-up-${tag}`]: { primary: ['repetitions'], units: ['reps'] },
      [`running-${tag}`]: { primary: ['duration'], units: ['minutes'] },
    };
    const resolvers = {
      resolveKnowledgePin: async (key: string) => pins[key] ?? null,
      resolveKnowledgeEligibility: async (key: string) => {
        const contract = contracts[key];
        if (!contract || !pins[key]) return null;
        return {
          knowledgeId: pins[key].knowledge_id,
          version: pins[key].current_version,
          kind: 'fitness' as const,
          lifecycle: 'published',
          grandfathered: false,
          primaryMetrics: contract.primary,
          secondaryMetrics: [],
          compatibleUnits: contract.units,
        };
      },
      resolveGroupAuthority: async () => ({ status: 'active' }),
      resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
    };
    const created = await createChallenge(
      db,
      {
        group_id: groupId,
        created_by_member_id: memberId,
        challenge_type: 'collective',
        title: 'Versioned',
        start_date: '2026-06-01',
        end_date: '2026-06-30',
        goal_value: 100,
        goal_unit: 'reps',
        activities: [
          {
            canonical_key: `push-up-${tag}`,
            metric: 'repetitions',
            target_value: 20,
            unit: 'reps',
          },
        ],
      },
      resolvers,
    );
    expect(created.version.version).toBe(1);

    // Valid tuple on v2: accepted.
    const second = await addChallengeConfigVersion(
      db,
      created.challenge.challenge_id,
      {
        activities: [
          {
            canonical_key: `push-up-${tag}`,
            metric: 'repetitions',
            target_value: 30,
            unit: 'reps',
          },
        ],
      },
      resolvers,
    );
    expect(second.version.version).toBe(2);

    // Individually valid Metric + Unit in an invalid combination on v3:
    // both 'duration' and 'minutes' are governed, but push-up permits
    // neither — rejected with no v3 state.
    await expect(
      addChallengeConfigVersion(
        db,
        created.challenge.challenge_id,
        {
          activities: [
            {
              canonical_key: `push-up-${tag}`,
              metric: 'duration',
              target_value: 30,
              unit: 'minutes',
            },
          ],
        },
        resolvers,
      ),
    ).rejects.toThrow(/not permitted for this Activity/);
    const current = await db.query<{ current_config_version: number }>(
      `SELECT current_config_version FROM challenges WHERE challenge_id = $1`,
      [created.challenge.challenge_id],
    );
    expect(Number(current.rows[0].current_config_version)).toBe(2);
    const v3 = await db.query(
      `SELECT COUNT(*) AS count FROM challenge_config_versions
       WHERE challenge_id = $1 AND version = 3`,
      [created.challenge.challenge_id],
    );
    expect(Number(v3.rows[0].count)).toBe(0);
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
