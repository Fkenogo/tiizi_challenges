import assert from 'node:assert/strict';
import {
  createKnowledgeAuthorityFromEnv,
  knowledgeAuthorityModeFromEnv,
  PgKnowledgeAuthorityReader,
  resolveAuthorityPoolMax,
  setKnowledgeAuthorityForTests,
  type KnowledgeAuthorityReader,
  type KnowledgeAuthorityRecord,
} from '../functions/src/knowledgeAuthority.js';
import { createChallengeWithCreatorMembershipCore } from '../functions/src/challengeCreationBackend.js';
import {
  KNOWLEDGE_DATABASE_URL_SECRET_NAME,
  knowledgeCallableOptions,
} from '../functions/src/knowledgeRuntime.js';

/**
 * Phase B Functions PostgreSQL authority bridge guard
 * (run: npm run test:functions-pg-authority-bridge).
 *
 * Proves, without any database, emulator, or deployment:
 * - A. DATABASE_URL reaches the authority reader;
 * - B. only the two challenge-creation callables bind the secret;
 * - C. postgres mode stays fail-closed;
 * - D. missing DATABASE_URL + postgres mode → unavailable, never Firestore;
 * - E. invalid authority mode fails loudly;
 * - F. the Functions pg pool is bounded;
 * - G. unrelated Functions receive no DATABASE_URL;
 * - H. networking options exist on the two callable definitions.
 *
 * Env for the deployed-shape import below must be set before the dynamic
 * import (module-scope param resolution).
 */
process.env.DATABASE_URL = 'postgresql://bridge-test@localhost:5432/tiizi';
process.env.TIIZI_KNOWLEDGE_AUTHORITY_MODE = 'postgres';
process.env.TIIZI_FUNCTIONS_VPC_CONNECTOR = 'projects/tiizi-challenges/locations/us-central1/connectors/tiizi-fn-conn';

const functionsIndex = await import('../functions/src/index.js');

function publishedRecord(id: string, kind: 'fitness' | 'wellness'): KnowledgeAuthorityRecord {
  return {
    knowledgeId: id,
    kind,
    legacyId: null,
    lifecycle: 'published',
    knowledgeVersion: 2,
  };
}

function stubAuthority(records: Record<string, KnowledgeAuthorityRecord>): KnowledgeAuthorityReader {
  return {
    async findCanonical(canonicalId: string) {
      return records[canonicalId] ?? null;
    },
  };
}

function throwingAuthority(): KnowledgeAuthorityReader {
  return {
    async findCanonical() {
      throw new Error('pg unavailable');
    },
  };
}

/** Firestore must never be consulted in postgres mode: any access throws. */
const firestoreDenyDb = {
  collection() {
    throw new Error('Firestore consulted in postgres mode');
  },
  async runTransaction() {
    throw new Error('Firestore consulted in postgres mode');
  },
};

function fitnessInput(exerciseId: string) {
  return {
    actorUid: 'creator_uid',
    groupId: 'group_1',
    name: 'Bridge Proof',
    description: 'fail-closed check',
    category: 'fitness',
    challengeType: 'collective',
    startDate: '2026-06-14T00:00:00.000Z',
    durationDays: 7,
    activities: [
      {
        exerciseId,
        exerciseName: 'Push-Ups',
        targetValue: 10,
        unit: 'reps',
        knowledgeVersion: 1,
      },
    ],
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return String((error as { code?: unknown })?.code ?? error);
  }
  return 'no-throw';
}

async function run() {
  // A. DATABASE_URL reaches the authority reader (lazy: no connection made).
  setKnowledgeAuthorityForTests(undefined);
  assert.ok(
    createKnowledgeAuthorityFromEnv() instanceof PgKnowledgeAuthorityReader,
    'DATABASE_URL set must yield a PG authority reader',
  );
  setKnowledgeAuthorityForTests(undefined);
  delete process.env.DATABASE_URL;
  assert.equal(createKnowledgeAuthorityFromEnv(), null, 'DATABASE_URL unset must yield a null reader');
  process.env.DATABASE_URL = 'postgresql://bridge-test@localhost:5432/tiizi';

  // F. Pool ceiling is bounded (default 3, clamped to 1..5).
  assert.equal(resolveAuthorityPoolMax(), 3);
  assert.equal(resolveAuthorityPoolMax(undefined), 3);
  assert.equal(resolveAuthorityPoolMax(2), 2);
  assert.equal(resolveAuthorityPoolMax(5), 5);
  assert.equal(resolveAuthorityPoolMax(0), 1);
  assert.equal(resolveAuthorityPoolMax(-4), 1);
  assert.equal(resolveAuthorityPoolMax(99), 5);
  assert.equal(resolveAuthorityPoolMax(Number.NaN), 3);
  assert.equal(resolveAuthorityPoolMax('bogus'), 3);
  assert.equal(resolveAuthorityPoolMax(2.9), 2);
  assert.equal(new PgKnowledgeAuthorityReader('postgresql://x', undefined).maxConnections, 3);
  assert.equal(new PgKnowledgeAuthorityReader('postgresql://x', 99).maxConnections, 5);

  // E. Invalid authority mode fails loudly; valid modes resolve.
  assert.equal(knowledgeAuthorityModeFromEnv({ TIIZI_KNOWLEDGE_AUTHORITY_MODE: 'postgres' }), 'postgres');
  assert.equal(knowledgeAuthorityModeFromEnv({ TIIZI_KNOWLEDGE_AUTHORITY_MODE: '  ' }), 'transition');
  assert.throws(
    () => knowledgeAuthorityModeFromEnv({ TIIZI_KNOWLEDGE_AUTHORITY_MODE: 'bogus' }),
    /Invalid TIIZI_KNOWLEDGE_AUTHORITY_MODE/,
  );

  // C + D. postgres mode is fail-closed and never touches Firestore.
  const missCode = await codeOf(
    createChallengeWithCreatorMembershipCore(
      firestoreDenyDb,
      fitnessInput('missing-canonical-id'),
      stubAuthority({}),
      'postgres',
    ),
  );
  assert.equal(missCode, 'invalid-argument', 'PG miss in postgres mode must reject the ID');

  const downCode = await codeOf(
    createChallengeWithCreatorMembershipCore(
      firestoreDenyDb,
      fitnessInput('any-id'),
      throwingAuthority(),
      'postgres',
    ),
  );
  assert.equal(downCode, 'unavailable', 'PG outage in postgres mode must fail closed');

  const nullCode = await codeOf(
    createChallengeWithCreatorMembershipCore(firestoreDenyDb, fitnessInput('any-id'), null, 'postgres'),
  );
  assert.equal(nullCode, 'unavailable', 'missing DATABASE_URL + postgres mode must fail closed, never Firestore');

  // Hit path still authoritative (version pinned from PG) — with a
  // Firestore-backed db this would equally succeed, so use the deny db to
  // prove PG alone decided. The core writes via transaction after resolution,
  // so expect the Firestore-deny error only AFTER a successful PG hit.
  const hitCode = await codeOf(
    createChallengeWithCreatorMembershipCore(
      firestoreDenyDb,
      fitnessInput('known-id'),
      stubAuthority({ 'known-id': publishedRecord('known-id', 'fitness') }),
      'postgres',
    ),
  );
  assert.match(
    hitCode,
    /Firestore consulted in postgres mode/,
    'PG hit must resolve without Firestore; later writes use the provided db',
  );

  // B + H. Both challenge-creation callables bind the secret and carry VPC config.
  for (const name of ['createChallengeWithCreatorMembership', 'createChallengeFromAdmin'] as const) {
    const endpoint = (
      functionsIndex[name] as unknown as {
        __endpoint: {
          region?: string[];
          secretEnvironmentVariables?: Array<{ key: string }>;
          vpc?: { connector?: string; egressSettings?: string } | null;
        };
      }
    ).__endpoint;
    assert.deepEqual(endpoint.region, ['us-central1'], `${name} must stay in us-central1`);
    assert.ok(
      (endpoint.secretEnvironmentVariables ?? []).some(
        (entry) => entry.key === KNOWLEDGE_DATABASE_URL_SECRET_NAME,
      ),
      `${name} must bind the DATABASE_URL secret`,
    );
    assert.equal(
      endpoint.vpc?.connector,
      'projects/tiizi-challenges/locations/us-central1/connectors/tiizi-fn-conn',
      `${name} must carry the VPC connector`,
    );
    assert.equal(endpoint.vpc?.egressSettings, 'PRIVATE_RANGES_ONLY', `${name} must egress private ranges only`);
  }

  // Shared options omit the connector when unconfigured (deployable without VPC).
  delete process.env.TIIZI_FUNCTIONS_VPC_CONNECTOR;
  const bare = knowledgeCallableOptions();
  assert.equal(bare.region, 'us-central1');
  assert.equal(bare.secrets.length, 1);
  assert.ok(!('vpcConnector' in bare), 'connector option must be absent when unconfigured');

  // G. Unrelated Functions receive no DATABASE_URL and no VPC attachment.
  for (const name of ['createGroupInvite', 'listGroupInvites', 'revokeGroupInvite'] as const) {
    const endpoint = (
      functionsIndex[name] as unknown as {
        __endpoint: {
          secretEnvironmentVariables?: Array<{ key: string }>;
          vpc?: unknown;
        };
      }
    ).__endpoint;
    assert.deepEqual(
      endpoint.secretEnvironmentVariables ?? [],
      [],
      `${name} must not bind any secret`,
    );
    // Note: the SDK fills unset options with ResetValue sentinels (they
    // serialise as null), so absence is structural: no connector attached.
    const vpc = endpoint.vpc as unknown;
    const attached =
      typeof vpc === 'object' &&
      vpc !== null &&
      ('connector' in vpc || 'networkInterfaces' in vpc);
    assert.ok(!attached, `${name} must not carry VPC configuration`);
  }

  console.log('test:functions-pg-authority-bridge PASS');
}

await run();
