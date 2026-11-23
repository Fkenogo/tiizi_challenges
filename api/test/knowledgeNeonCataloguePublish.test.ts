import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.js';
import type { S6Candidate, S6Inventory } from '../src/knowledgeCatalogueImport.js';
import { listMigrationFiles, splitStatements } from '../src/migrate.js';
import { createKnowledgeItem, listKnowledgeForAdmin } from '../src/knowledge.js';
import {
  computeProvisioningReceiptSha256,
  executeRemoteNeonCataloguePublish,
  validateRemoteNeonTarget,
  verifyAuthoritativeNeonTarget,
  verifyRemoteNeonBaseline,
  type NeonProvisioningReceipt,
  type RemoteNeonAllowlist,
  type RemoteNeonTargetConfirmation,
} from '../src/knowledgeNeonCataloguePublish.js';
import { testDb } from './helpers.js';

const base = '../docs/programme/working/s6-content/';
const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(resolve(process.cwd(), path), 'utf8')) as T;

const SECRET_PW = 'super-secret-neon-pw-999';
const VALID_HOST = 'ep-cool-brook-123456.eu-central-1.aws.neon.tech';
const VALID_URL = `postgresql://tiizi_owner:${SECRET_PW}@${VALID_HOST}:5432/tiizi?uselibpqcompat=true&sslmode=verify-full&sslrootcert=/tmp/ca.pem`;

const VALID_CONFIRM: RemoteNeonTargetConfirmation = {
  provider: 'neon',
  project: 'tiizi-v2',
  branch: 'main',
  database: 'tiizi',
  confirmTarget: 'neon:tiizi-v2:main:tiizi',
};

const VALID_ALLOWLIST: RemoteNeonAllowlist = {
  allowedHost: VALID_HOST,
  allowedProject: 'tiizi-v2',
  allowedBranch: 'main',
  allowedDatabase: 'tiizi',
};

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeReceiptFile(receipt: NeonProvisioningReceipt): string {
  const dir = mkdtempSync(join(tmpdir(), 'tiizi-neon-receipt-'));
  tempDirs.push(dir);
  const path = join(dir, 'receipt.json');
  writeFileSync(path, JSON.stringify(receipt, null, 2));
  return path;
}

async function seedMigration014Exemplars(db: Db): Promise<void> {
  const sql = await readFile(resolve(process.cwd(), 'migrations/014_pf01_exemplar_activities.sql'), 'utf8');
  for (const stmt of splitStatements(sql)) {
    await db.query(stmt);
  }
}

describe('remote Neon catalogue publication — endpoint & TLS safety', () => {
  it('accepts a valid Neon direct endpoint with verify-full and single CA', () => {
    expect(validateRemoteNeonTarget(VALID_URL, VALID_CONFIRM, VALID_ALLOWLIST, {})).toEqual({
      host: VALID_HOST,
      port: '5432',
      database: 'tiizi',
      provider: 'neon',
      project: 'tiizi-v2',
      branch: 'main',
    });
  });

  it('rejects non-Neon hostnames, pooled endpoints, bad ports, duplicate/conflicting TLS params, and overrides without leaking secrets', () => {
    const cases: Array<[string | undefined, RemoteNeonTargetConfirmation, RemoteNeonAllowlist, Record<string, string>, RegExp]> = [
      [undefined, VALID_CONFIRM, VALID_ALLOWLIST, {}, /DATABASE_URL is unset/],
      [VALID_URL, { ...VALID_CONFIRM, provider: 'cloudsql' }, VALID_ALLOWLIST, {}, /--target-provider must be 'neon'/],
      [VALID_URL, { ...VALID_CONFIRM, confirmTarget: 'neon:tiizi-v2:other:tiizi' }, VALID_ALLOWLIST, {}, /--confirm-target/],
      [VALID_URL, VALID_CONFIRM, { ...VALID_ALLOWLIST, allowedHost: undefined }, {}, /TIIZI_REMOTE_DB_HOST is unset/],
      [VALID_URL, VALID_CONFIRM, { ...VALID_ALLOWLIST, allowedProject: 'other-proj' }, {}, /does not match TIIZI_REMOTE_DB_PROJECT/],
      [VALID_URL, VALID_CONFIRM, { ...VALID_ALLOWLIST, allowedBranch: 'preview' }, {}, /does not match TIIZI_REMOTE_DB_BRANCH/],
      [VALID_URL, VALID_CONFIRM, { ...VALID_ALLOWLIST, allowedDatabase: 'other_db' }, {}, /does not match TIIZI_REMOTE_DB_NAME/],
      // Non-Neon hostnames rejected
      [
        `postgresql://tiizi_owner:${SECRET_PW}@db.example.com:5432/tiizi?sslmode=verify-full&sslrootcert=/tmp/ca.pem`,
        VALID_CONFIRM,
        { ...VALID_ALLOWLIST, allowedHost: 'db.example.com' },
        {},
        /not a valid Neon direct-endpoint hostname/,
      ],
      [
        `postgresql://tiizi_owner:${SECRET_PW}@127.0.0.1:5432/tiizi?sslmode=verify-full&sslrootcert=/tmp/ca.pem`,
        VALID_CONFIRM,
        { ...VALID_ALLOWLIST, allowedHost: '127.0.0.1' },
        {},
        /not a valid Neon direct-endpoint hostname/,
      ],
      // Pooled endpoint rejected
      [
        `postgresql://tiizi_owner:${SECRET_PW}@ep-cool-brook-123456-pooler.eu-central-1.aws.neon.tech:5432/tiizi?sslmode=verify-full&sslrootcert=/tmp/ca.pem`,
        VALID_CONFIRM,
        { ...VALID_ALLOWLIST, allowedHost: 'ep-cool-brook-123456-pooler.eu-central-1.aws.neon.tech' },
        {},
        /pooled \(-pooler\) endpoint/,
      ],
      // Unexpected port rejected
      [
        `postgresql://tiizi_owner:${SECRET_PW}@${VALID_HOST}:6432/tiizi?sslmode=verify-full&sslrootcert=/tmp/ca.pem`,
        VALID_CONFIRM,
        VALID_ALLOWLIST,
        {},
        /unexpected port '6432'/,
      ],
      // Duplicate / conflicting TLS parameters rejected
      [
        `postgresql://tiizi_owner:${SECRET_PW}@${VALID_HOST}:5432/tiizi?sslmode=verify-full&sslmode=require&sslrootcert=/tmp/ca.pem`,
        VALID_CONFIRM,
        VALID_ALLOWLIST,
        {},
        /duplicate query parameter 'sslmode'/,
      ],
      [
        `postgresql://tiizi_owner:${SECRET_PW}@${VALID_HOST}:5432/tiizi?ssl=true&sslmode=verify-full&sslrootcert=/tmp/ca.pem`,
        VALID_CONFIRM,
        VALID_ALLOWLIST,
        {},
        /conflicting TLS parameter 'ssl'/,
      ],
      [
        `postgresql://tiizi_owner:${SECRET_PW}@${VALID_HOST}:5432/tiizi?sslmode=verify-ca&sslrootcert=/tmp/ca.pem`,
        VALID_CONFIRM,
        VALID_ALLOWLIST,
        {},
        /requires sslmode=verify-full/,
      ],
      [
        `postgresql://tiizi_owner:${SECRET_PW}@${VALID_HOST}:5432/tiizi?sslmode=verify-full&sslrootcert=/tmp/ca.pem`,
        VALID_CONFIRM,
        VALID_ALLOWLIST,
        { TIIZI_DB_SERVER_CA_PEM: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----' },
        /conflicting trust anchor/,
      ],
      [
        `postgresql://tiizi_owner:${SECRET_PW}@${VALID_HOST}:5432/tiizi?sslmode=verify-full`,
        VALID_CONFIRM,
        VALID_ALLOWLIST,
        {},
        /requires a trusted CA/,
      ],
      // Connection override rejected
      [
        `postgresql://tiizi_owner:${SECRET_PW}@${VALID_HOST}:5432/tiizi?sslmode=verify-full&sslrootcert=/tmp/ca.pem&host=evil.example.com`,
        VALID_CONFIRM,
        VALID_ALLOWLIST,
        {},
        /connection override 'host'/,
      ],
    ];

    for (const [url, confirm, allowlist, env, pattern] of cases) {
      let msg = '';
      try {
        validateRemoteNeonTarget(url, confirm, allowlist, env);
      } catch (err) {
        msg = err instanceof Error ? err.message : String(err);
      }
      expect(msg, `expected throw for ${url}`).toMatch(pattern);
      expect(msg).not.toContain(SECRET_PW);
    }
  });
});

describe('remote Neon catalogue publication — authoritative project & branch verification', () => {
  const parts = validateRemoteNeonTarget(VALID_URL, VALID_CONFIRM, VALID_ALLOWLIST, {});
  const TEST_API_KEY = 'neon-secret-api-key-999';

  it('allows unverified dry-run preflight without NEON_API_KEY and rejects --apply without NEON_API_KEY', async () => {
    const dry = await verifyAuthoritativeNeonTarget(parts, 'dry-run', { env: {} });
    expect(dry).toEqual({ verified: false, method: 'unverified_dry_run_only' });

    await expect(
      verifyAuthoritativeNeonTarget(parts, 'apply', { env: {} }),
    ).rejects.toThrow(/authenticated Neon API verification \(NEON_API_KEY\) is required for --apply/);
  });

  it('never allows a forged or checksum-valid provisioning receipt to authorize --apply, retaining it as audit evidence only', async () => {
    const baseReceipt = {
      provider: 'neon' as const,
      source: 'neonctl' as const,
      project: 'tiizi-v2',
      branch: 'main',
      database: 'tiizi',
      endpointHost: VALID_HOST,
      issuedAt: '2026-11-23T12:00:00Z',
    };
    const checksumValidReceiptPath = writeReceiptFile({
      ...baseReceipt,
      receiptSha256: computeProvisioningReceiptSha256(baseReceipt),
    });

    // Even with a valid SHA-256 receipt, --apply MUST fail without NEON_API_KEY
    await expect(
      verifyAuthoritativeNeonTarget(parts, 'apply', {
        receiptPath: checksumValidReceiptPath,
        env: {},
      }),
    ).rejects.toThrow(/authenticated Neon API verification \(NEON_API_KEY\) is required for --apply/);

    // Dry-run may attach the receipt as audit-only evidence (authorizesApply: false)
    const dryWithAudit = await verifyAuthoritativeNeonTarget(parts, 'dry-run', {
      receiptPath: checksumValidReceiptPath,
      env: {},
    });
    expect(dryWithAudit).toEqual({
      verified: false,
      method: 'unverified_dry_run_only',
      auditReceipt: {
        present: true,
        source: 'neonctl',
        issuedAt: '2026-11-23T12:00:00Z',
        authorizesApply: false,
      },
    });

    // Mismatched or tampered audit receipts are still rejected
    const wrongBranchPath = writeReceiptFile({ ...baseReceipt, branch: 'staging' });
    await expect(
      verifyAuthoritativeNeonTarget(parts, 'dry-run', { receiptPath: wrongBranchPath, env: {} }),
    ).rejects.toThrow(/provisioning receipt branch 'staging' does not match 'main'/);

    const tamperedShaPath = writeReceiptFile({ ...baseReceipt, receiptSha256: '0'.repeat(64) });
    await expect(
      verifyAuthoritativeNeonTarget(parts, 'dry-run', { receiptPath: tamperedShaPath, env: {} }),
    ).rejects.toThrow(/SHA-256 digest mismatch/);
  });

  it('verifies paginated Neon API metadata when NEON_API_KEY is supplied and fails closed on API errors or mismatches', async () => {
    const paginatedFetch: typeof fetch = async (input) => {
      const url = new URL(String(input));
      const cursor = url.searchParams.get('cursor');
      if (url.pathname.endsWith('/projects')) {
        if (!cursor) {
          return new Response(
            JSON.stringify({
              projects: [{ id: 'proj-0', name: 'other-project' }],
              pagination: { cursor: 'p2' },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            projects: [{ id: 'proj-1', name: 'tiizi-v2' }],
          }),
          { status: 200 },
        );
      }
      if (url.pathname.endsWith('/branches')) {
        if (!cursor) {
          return new Response(
            JSON.stringify({
              branches: [{ id: 'br-0', name: 'staging' }],
              pagination: { cursor: 'b2' },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            branches: [{ id: 'br-1', name: 'main' }],
          }),
          { status: 200 },
        );
      }
      if (url.pathname.endsWith('/databases')) {
        return new Response(
          JSON.stringify({
            databases: [{ id: 1, name: 'tiizi', owner_name: 'neondb_owner' }],
          }),
          { status: 200 },
        );
      }
      if (url.pathname.endsWith('/endpoints')) {
        if (!cursor) {
          return new Response(
            JSON.stringify({
              endpoints: [{ branch_id: 'br-1', host: 'ep-ro.eu-central-1.aws.neon.tech', type: 'read_only' }],
              pagination: { cursor: 'e2' },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            endpoints: [{ branch_id: 'br-1', host: VALID_HOST, type: 'read_write' }],
          }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    };

    const res = await verifyAuthoritativeNeonTarget(parts, 'apply', {
      env: { NEON_API_KEY: TEST_API_KEY },
      fetchFn: paginatedFetch,
    });
    expect(res).toEqual({
      verified: true,
      method: 'neon-api',
      projectId: 'proj-1',
      branchId: 'br-1',
      endpointHost: VALID_HOST,
    });

    // Wrong endpoint / read-only endpoint rejected
    const wrongEpFetch: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/projects')) {
        return new Response(JSON.stringify({ projects: [{ id: 'proj-1', name: 'tiizi-v2' }] }), { status: 200 });
      }
      if (url.pathname.endsWith('/branches')) {
        return new Response(JSON.stringify({ branches: [{ id: 'br-1', name: 'main' }] }), { status: 200 });
      }
      if (url.pathname.endsWith('/databases')) {
        return new Response(JSON.stringify({ databases: [{ id: 1, name: 'tiizi' }] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ endpoints: [{ branch_id: 'br-1', host: 'ep-other.eu-central-1.aws.neon.tech', type: 'read_write' }] }),
        { status: 200 },
      );
    };
    await expect(
      verifyAuthoritativeNeonTarget(parts, 'apply', {
        env: { NEON_API_KEY: TEST_API_KEY },
        fetchFn: wrongEpFetch,
      }),
    ).rejects.toThrow(/is not an active read_write direct endpoint/);

    // Wrong branch rejected
    const wrongBranchFetch: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/projects')) {
        return new Response(JSON.stringify({ projects: [{ id: 'proj-1', name: 'tiizi-v2' }] }), { status: 200 });
      }
      if (url.pathname.endsWith('/branches')) {
        return new Response(JSON.stringify({ branches: [{ id: 'br-9', name: 'staging' }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ endpoints: [] }), { status: 200 });
    };
    await expect(
      verifyAuthoritativeNeonTarget(parts, 'apply', {
        env: { NEON_API_KEY: TEST_API_KEY },
        fetchFn: wrongBranchFetch,
      }),
    ).rejects.toThrow(/branch 'main' not found/);

    // API HTTP failure fails closed without leaking NEON_API_KEY
    const unauthorizedFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    let errMsg = '';
    try {
      await verifyAuthoritativeNeonTarget(parts, 'apply', {
        env: { NEON_API_KEY: TEST_API_KEY },
        fetchFn: unauthorizedFetch,
      });
    } catch (err) {
      errMsg = err instanceof Error ? err.message : String(err);
    }
    expect(errMsg).toMatch(/failed with status 401/);
    expect(errMsg).not.toContain(TEST_API_KEY);

    // Network transport failure fails closed
    const networkFailFetch: typeof fetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    await expect(
      verifyAuthoritativeNeonTarget(parts, 'apply', {
        env: { NEON_API_KEY: TEST_API_KEY },
        fetchFn: networkFailFetch,
      }),
    ).rejects.toThrow(/Neon API projects request failed/);
  });

  it('supports project-scoped NEON_API_KEY via TIIZI_REMOTE_DB_PROJECT_ID and fails closed on mismatches, missing metadata, and auth errors', async () => {
    const projectScopedFetch: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/v2/projects') {
        return new Response(
          JSON.stringify({ message: 'not allowed to perform actions outside the project this key is scoped to' }),
          { status: 404 },
        );
      }
      if (url.pathname === '/api/v2/projects/proj-scoped-1') {
        return new Response(
          JSON.stringify({ project: { id: 'proj-scoped-1', name: 'tiizi-v2' } }),
          { status: 200 },
        );
      }
      if (url.pathname === '/api/v2/projects/proj-scoped-1/branches') {
        return new Response(
          JSON.stringify({ branches: [{ id: 'br-scoped-1', name: 'main' }] }),
          { status: 200 },
        );
      }
      if (url.pathname === '/api/v2/projects/proj-scoped-1/branches/br-scoped-1/databases') {
        return new Response(
          JSON.stringify({ databases: [{ id: 1, name: 'tiizi' }] }),
          { status: 200 },
        );
      }
      if (url.pathname === '/api/v2/projects/proj-scoped-1/endpoints') {
        return new Response(
          JSON.stringify({ endpoints: [{ branch_id: 'br-scoped-1', host: VALID_HOST, type: 'read_write' }] }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    };

    const ok = await verifyAuthoritativeNeonTarget(parts, 'apply', {
      env: { NEON_API_KEY: TEST_API_KEY, TIIZI_REMOTE_DB_PROJECT_ID: 'proj-scoped-1' },
      fetchFn: projectScopedFetch,
    });
    expect(ok).toEqual({
      verified: true,
      method: 'neon-api',
      projectId: 'proj-scoped-1',
      branchId: 'br-scoped-1',
      endpointHost: VALID_HOST,
    });

    // Wrong project ID returned by API -> FAIL
    await expect(
      verifyAuthoritativeNeonTarget(parts, 'apply', {
        projectId: 'proj-scoped-1',
        env: { NEON_API_KEY: TEST_API_KEY },
        fetchFn: async () =>
          new Response(JSON.stringify({ project: { id: 'proj-other-999', name: 'tiizi-v2' } }), { status: 200 }),
      }),
    ).rejects.toThrow(/Neon project ID mismatch/);

    // Missing project metadata -> FAIL
    await expect(
      verifyAuthoritativeNeonTarget(parts, 'apply', {
        projectId: 'proj-scoped-1',
        env: { NEON_API_KEY: TEST_API_KEY },
        fetchFn: async () => new Response(JSON.stringify({ project: {} }), { status: 200 }),
      }),
    ).rejects.toThrow(/missing project metadata/);

    // Missing database on branch -> FAIL
    await expect(
      verifyAuthoritativeNeonTarget(parts, 'apply', {
        projectId: 'proj-scoped-1',
        env: { NEON_API_KEY: TEST_API_KEY },
        fetchFn: async (input) => {
          const url = new URL(String(input));
          if (url.pathname.endsWith('/proj-scoped-1')) {
            return new Response(JSON.stringify({ project: { id: 'proj-scoped-1', name: 'tiizi-v2' } }), { status: 200 });
          }
          if (url.pathname.endsWith('/branches')) {
            return new Response(JSON.stringify({ branches: [{ id: 'br-scoped-1', name: 'main' }] }), { status: 200 });
          }
          if (url.pathname.endsWith('/databases')) {
            return new Response(JSON.stringify({ databases: [{ id: 1, name: 'other_db' }] }), { status: 200 });
          }
          return new Response(
            JSON.stringify({ endpoints: [{ branch_id: 'br-scoped-1', host: VALID_HOST, type: 'read_write' }] }),
            { status: 200 },
          );
        },
      }),
    ).rejects.toThrow(/Neon database 'tiizi' not found/);

    // API authentication failure on project endpoint -> FAIL without leaking key
    let authErr = '';
    try {
      await verifyAuthoritativeNeonTarget(parts, 'apply', {
        projectId: 'proj-scoped-1',
        env: { NEON_API_KEY: TEST_API_KEY },
        fetchFn: async () => new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
      });
    } catch (err) {
      authErr = err instanceof Error ? err.message : String(err);
    }
    expect(authErr).toMatch(/Neon API project verification failed with status 401/);
    expect(authErr).not.toContain(TEST_API_KEY);
  });
});

describe('remote Neon catalogue publication — migration, catalogue baseline & idempotent execution', () => {
  const parts = {
    host: VALID_HOST,
    port: '5432',
    database: 'postgres',
    provider: 'neon' as const,
    project: 'tiizi-v2',
    branch: 'main',
  };
  const verifiedAuth = {
    verified: true as const,
    method: 'neon-api' as const,
    projectId: 'proj-1',
    branchId: 'br-1',
    endpointHost: VALID_HOST,
  };

  it('rejects migration mismatch even when schema_migrations count equals 34', async () => {
    const migrations = await listMigrationFiles();
    expect(migrations.length).toBeGreaterThanOrEqual(34);
    const tamperedMigrations = [...migrations.slice(0, -1), '034_unexpected_migration.sql'];
    expect(tamperedMigrations.length).toBe(migrations.length);

    const fakeDb = {
      query: async (sql: string) => {
        if (sql.includes('current_database()')) return { rows: [{ db: 'postgres', usr: 'tiizi_owner' }] };
        if (sql.includes('FROM schema_migrations')) {
          return { rows: tamperedMigrations.map((filename) => ({ filename })) };
        }
        return { rows: [{ members_cnt: 0, groups_cnt: 0, challenges_cnt: 0 }] };
      },
    } as unknown as Db;

    await expect(
      verifyRemoteNeonBaseline(fakeDb, parts, verifiedAuth, new Set(['FIT-STR-001']), migrations),
    ).rejects.toThrow(/schema_migrations mismatch/);
  });

  it('rejects unexpected catalogue content and existing domain rows before writing', async () => {
    const db = testDb();
    const candidate = await readJson<S6Candidate>(`${base}tiizi-118-activity-reconciled-content.json`);
    const codes = new Set<string>(candidate.records.map((r) => r.activityCode));

    // 0 rows in knowledge_items (missing migration-014 exemplars) -> rejected
    await expect(
      verifyRemoteNeonBaseline(db, parts, verifiedAuth, codes),
    ).rejects.toThrow(/unexpected knowledge_items baseline \(count=0\)/);

    // Seed valid migration-014 exemplars + an unexpected custom item -> rejected
    await seedMigration014Exemplars(db);
    await createKnowledgeItem(db, {
      kind: 'fitness',
      activityCode: 'FIT-UNK-999',
      name: 'Rogue Activity',
      category: 'Strength',
      description: 'Unexpected activity',
      metricUnit: 'reps',
      primaryMetrics: ['repetitions'],
      compatibleUnits: ['reps'],
    });
    await expect(
      verifyRemoteNeonBaseline(db, parts, verifiedAuth, codes),
    ).rejects.toThrow(/unexpected knowledge_items baseline \(count=3\)/);
  });

  it('publishes all 118 activities from migration-014 baseline and supports idempotent reruns', async () => {
    const db = testDb();
    await seedMigration014Exemplars(db);
    const [candidate, inventory] = await Promise.all([
      readJson<S6Candidate>(`${base}tiizi-118-activity-reconciled-content.json`),
      readJson<S6Inventory>(`${base}activity-master-inventory.json`),
    ]);
    const codes = new Set<string>(candidate.records.map((r) => r.activityCode));

    // Unverified dry-run is allowed, unverified apply is refused
    const unverifiedTarget = await verifyRemoteNeonBaseline(
      db,
      parts,
      { verified: false, method: 'unverified_dry_run_only' },
      codes,
    );
    expect(unverifiedTarget.catalogueBaseline).toBe('initial-migration-seeded');
    const dry = await executeRemoteNeonCataloguePublish(db, unverifiedTarget, candidate, inventory, 'dry-run');
    expect(dry.import).toMatchObject({ mode: 'dry-run', readyForIngestion: true, applied: 0 });
    await expect(
      executeRemoteNeonCataloguePublish(db, unverifiedTarget, candidate, inventory, 'apply'),
    ).rejects.toThrow(/authenticated Neon API verification is required before --apply/);
    expect((await listKnowledgeForAdmin(db, {})).length).toBe(2);

    // Authoritatively verified initial apply
    const verifiedTarget = await verifyRemoteNeonBaseline(db, parts, verifiedAuth, codes);
    expect(verifiedTarget.migrationIntegrity).toMatchObject({
      mode: 'filename_set_equality',
      checksumsVerified: false,
    });
    expect(verifiedTarget.migrationIntegrity.limitation).toMatch(/SQL content checksums are not recorded/);
    const applied = await executeRemoteNeonCataloguePublish(db, verifiedTarget, candidate, inventory, 'apply');
    expect(applied.publication).toMatchObject({
      mode: 'apply',
      expected: 118,
      found: 118,
      alreadyPublished: 2,
      toPublish: 116,
      published: 116,
      errors: [],
      verification: {
        total: 118,
        published: 118,
        byKind: { fitness: 84, wellness: 34 },
        composerSelectable: 118,
        duplicateCodes: 0,
      },
    });

    // Re-verify baseline as 'published-s6-baseline' and confirm idempotent rerun
    const rerunTarget = await verifyRemoteNeonBaseline(db, parts, verifiedAuth, codes);
    expect(rerunTarget.catalogueBaseline).toBe('published-s6-baseline');
    const rerun = await executeRemoteNeonCataloguePublish(db, rerunTarget, candidate, inventory, 'apply');
    expect(rerun.import).toMatchObject({ created: 0, updated: 0, unchanged: 118, applied: 0 });
    expect(rerun.publication).toMatchObject({
      alreadyPublished: 118,
      toPublish: 0,
      published: 0,
      errors: [],
    });
    expect((await listKnowledgeForAdmin(db, {})).filter((i) => i.lifecycle === 'published').length).toBe(118);
  });
});
