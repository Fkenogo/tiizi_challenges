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

  it('requires authoritative confirmation for --apply while allowing unverified dry-run preflight', async () => {
    const dry = await verifyAuthoritativeNeonTarget(parts, 'dry-run', { env: {} });
    expect(dry).toEqual({ verified: false, method: 'unverified_dry_run_only' });

    await expect(
      verifyAuthoritativeNeonTarget(parts, 'apply', { env: {} }),
    ).rejects.toThrow(/authoritative Neon project\/branch confirmation is required for --apply/);
  });

  it('accepts a valid bound provisioning receipt and rejects mismatched or tampered receipts', async () => {
    const baseReceipt = {
      provider: 'neon' as const,
      source: 'neonctl' as const,
      project: 'tiizi-v2',
      branch: 'main',
      database: 'tiizi',
      endpointHost: VALID_HOST,
      issuedAt: '2026-11-23T12:00:00Z',
    };
    const validPath = writeReceiptFile({
      ...baseReceipt,
      receiptSha256: computeProvisioningReceiptSha256(baseReceipt),
    });
    const verified = await verifyAuthoritativeNeonTarget(parts, 'apply', {
      receiptPath: validPath,
      env: {},
    });
    expect(verified).toEqual({
      verified: true,
      method: 'provisioning-receipt',
      issuedAt: '2026-11-23T12:00:00Z',
    });

    const wrongBranchPath = writeReceiptFile({ ...baseReceipt, branch: 'staging' });
    await expect(
      verifyAuthoritativeNeonTarget(parts, 'apply', { receiptPath: wrongBranchPath, env: {} }),
    ).rejects.toThrow(/provisioning receipt branch 'staging' does not match 'main'/);

    const tamperedShaPath = writeReceiptFile({ ...baseReceipt, receiptSha256: '0'.repeat(64) });
    await expect(
      verifyAuthoritativeNeonTarget(parts, 'apply', { receiptPath: tamperedShaPath, env: {} }),
    ).rejects.toThrow(/SHA-256 digest mismatch/);
  });

  it('verifies against authenticated Neon API metadata when NEON_API_KEY is supplied', async () => {
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/projects')) {
        return new Response(JSON.stringify({ projects: [{ id: 'proj-1', name: 'tiizi-v2' }] }), { status: 200 });
      }
      if (url.endsWith('/branches')) {
        return new Response(JSON.stringify({ branches: [{ id: 'br-1', name: 'main' }] }), { status: 200 });
      }
      if (url.endsWith('/endpoints')) {
        return new Response(
          JSON.stringify({ endpoints: [{ branch_id: 'br-1', host: VALID_HOST, type: 'read_write' }] }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    };

    const res = await verifyAuthoritativeNeonTarget(parts, 'apply', {
      env: { NEON_API_KEY: 'neon-test-key' },
      fetchFn: mockFetch,
    });
    expect(res).toEqual({ verified: true, method: 'neon-api' });

    const wrongEpFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/projects')) {
        return new Response(JSON.stringify({ projects: [{ id: 'proj-1', name: 'tiizi-v2' }] }), { status: 200 });
      }
      if (url.endsWith('/branches')) {
        return new Response(JSON.stringify({ branches: [{ id: 'br-1', name: 'main' }] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ endpoints: [{ branch_id: 'br-1', host: 'ep-other.eu-central-1.aws.neon.tech', type: 'read_write' }] }),
        { status: 200 },
      );
    };
    await expect(
      verifyAuthoritativeNeonTarget(parts, 'apply', {
        env: { NEON_API_KEY: 'neon-test-key' },
        fetchFn: wrongEpFetch,
      }),
    ).rejects.toThrow(/not an active read_write endpoint/);
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
  const verifiedAuth = { verified: true as const, method: 'provisioning-receipt' as const, issuedAt: '2026-11-23T12:00:00Z' };

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
    ).rejects.toThrow(/authoritative Neon project\/branch verification is required/);

    // Authoritatively verified initial apply
    const verifiedTarget = await verifyRemoteNeonBaseline(db, parts, verifiedAuth, codes);
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
