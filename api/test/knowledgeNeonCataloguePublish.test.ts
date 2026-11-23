import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Db } from '../src/db.js';
import type { S6Candidate, S6Inventory } from '../src/knowledgeCatalogueImport.js';
import { listKnowledgeForAdmin } from '../src/knowledge.js';
import {
  executeRemoteNeonCataloguePublish,
  validateRemoteNeonTarget,
  verifyRemoteNeonBaseline,
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

describe('remote Neon catalogue publication — target & allowlist safety', () => {
  it('accepts a valid direct Neon target with matching confirmation and allowlist', () => {
    expect(validateRemoteNeonTarget(VALID_URL, VALID_CONFIRM, VALID_ALLOWLIST)).toEqual({
      host: VALID_HOST,
      port: '5432',
      database: 'tiizi',
      provider: 'neon',
      project: 'tiizi-v2',
      branch: 'main',
    });
  });

  it('rejects missing/mismatched confirmation, allowlist, pooler host, unverified TLS, and overrides without leaking secrets', () => {
    const cases: Array<[string | undefined, RemoteNeonTargetConfirmation, RemoteNeonAllowlist, RegExp]> = [
      [undefined, VALID_CONFIRM, VALID_ALLOWLIST, /DATABASE_URL is unset/],
      [VALID_URL, { ...VALID_CONFIRM, provider: 'cloudsql' }, VALID_ALLOWLIST, /--target-provider must be 'neon'/],
      [VALID_URL, { ...VALID_CONFIRM, confirmTarget: 'neon:tiizi-v2:other:tiizi' }, VALID_ALLOWLIST, /--confirm-target/],
      [VALID_URL, VALID_CONFIRM, { ...VALID_ALLOWLIST, allowedHost: undefined }, /TIIZI_REMOTE_DB_HOST is unset/],
      [VALID_URL, VALID_CONFIRM, { ...VALID_ALLOWLIST, allowedProject: 'other-proj' }, /does not match TIIZI_REMOTE_DB_PROJECT/],
      [VALID_URL, VALID_CONFIRM, { ...VALID_ALLOWLIST, allowedBranch: 'preview' }, /does not match TIIZI_REMOTE_DB_BRANCH/],
      [VALID_URL, VALID_CONFIRM, { ...VALID_ALLOWLIST, allowedDatabase: 'other_db' }, /does not match TIIZI_REMOTE_DB_NAME/],
      [
        `postgresql://tiizi_owner:${SECRET_PW}@ep-cool-brook-123456-pooler.eu-central-1.aws.neon.tech:5432/tiizi?sslmode=verify-full`,
        VALID_CONFIRM,
        { ...VALID_ALLOWLIST, allowedHost: 'ep-cool-brook-123456-pooler.eu-central-1.aws.neon.tech' },
        /pooled \(-pooler\) endpoint/,
      ],
      [
        `postgresql://tiizi_owner:${SECRET_PW}@${VALID_HOST}:5432/tiizi?sslmode=require`,
        VALID_CONFIRM,
        VALID_ALLOWLIST,
        /requires sslmode=verify-full/,
      ],
      [
        `postgresql://tiizi_owner:${SECRET_PW}@${VALID_HOST}:5432/tiizi?sslmode=verify-ca`,
        VALID_CONFIRM,
        VALID_ALLOWLIST,
        /requires sslmode=verify-full/,
      ],
      [
        `postgresql://tiizi_owner:${SECRET_PW}@${VALID_HOST}:5432/other_db?sslmode=verify-full`,
        VALID_CONFIRM,
        VALID_ALLOWLIST,
        /does not equal --target-db/,
      ],
      [
        `postgresql://tiizi_owner:${SECRET_PW}@${VALID_HOST}:5432/tiizi?sslmode=verify-full&host=evil.example.com`,
        VALID_CONFIRM,
        VALID_ALLOWLIST,
        /connection override 'host'/,
      ],
    ];

    for (const [url, confirm, allowlist, pattern] of cases) {
      let msg = '';
      try {
        validateRemoteNeonTarget(url, confirm, allowlist);
      } catch (err) {
        msg = err instanceof Error ? err.message : String(err);
      }
      expect(msg, `expected throw for ${url}`).toMatch(pattern);
      expect(msg).not.toContain(SECRET_PW);
    }
  });
});

describe('remote Neon catalogue publication — empty baseline & governed execution', () => {
  it('accepts a clean empty 34-migration baseline and refuses existing members, groups, or challenges', async () => {
    const db = testDb();
    const localUrl = 'postgresql://tiizi@127.0.0.1:55439/postgres';
    const localConfirm: RemoteNeonTargetConfirmation = {
      provider: 'neon',
      project: 'tiizi-v2',
      branch: 'main',
      database: 'postgres',
      confirmTarget: 'neon:tiizi-v2:main:postgres',
    };
    const localAllowlist: RemoteNeonAllowlist = {
      allowedHost: '127.0.0.1',
      allowedProject: 'tiizi-v2',
      allowedBranch: 'main',
      allowedDatabase: 'postgres',
    };

    const identity = await verifyRemoteNeonBaseline(db, localUrl, localConfirm, localAllowlist);
    expect(identity.connectedDatabase).toBe('postgres');
    expect(identity.migrationsCount).toBeGreaterThanOrEqual(34);
    expect(identity.memberCount).toBe(0);
    expect(identity.groupCount).toBe(0);
    expect(identity.challengeCount).toBe(0);

    await db.query(
      `INSERT INTO members (member_id, auth_provider, auth_subject, display_name)
       VALUES ('11111111-1111-4111-8111-111111111111', 'firebase', 'uid-1', 'Existing User')`,
    );
    await expect(
      verifyRemoteNeonBaseline(db, localUrl, localConfirm, localAllowlist),
    ).rejects.toThrow(/not an empty baseline \(members=1, groups=0, challenges=0\)/);
  });

  it('refuses mismatched connected database or insufficient migrations', async () => {
    const fake = (migCount: number, dbName = 'tiizi'): Db =>
      ({
        query: async (sql: string) => {
          if (sql.includes('current_database()')) return { rows: [{ db: dbName, usr: 'tiizi_owner' }] };
          if (sql.includes('schema_migrations')) return { rows: [{ cnt: migCount }] };
          return { rows: [{ members_cnt: 0, groups_cnt: 0, challenges_cnt: 0 }] };
        },
      }) as unknown as Db;

    await expect(
      verifyRemoteNeonBaseline(fake(34, 'wrong_db'), VALID_URL, VALID_CONFIRM, VALID_ALLOWLIST),
    ).rejects.toThrow(/does not equal 'tiizi'/);

    await expect(
      verifyRemoteNeonBaseline(fake(33, 'tiizi'), VALID_URL, VALID_CONFIRM, VALID_ALLOWLIST),
    ).rejects.toThrow(/at least 34 applied migrations/);
  });

  it('rejects incomplete catalogues, respects dry-run default, publishes 118 activities cleanly, and is idempotent', async () => {
    const db = testDb();
    const [candidate, inventory] = await Promise.all([
      readJson<S6Candidate>(`${base}tiizi-118-activity-reconciled-content.json`),
      readJson<S6Inventory>(`${base}activity-master-inventory.json`),
    ]);

    const localUrl = 'postgresql://tiizi@127.0.0.1:55439/postgres';
    const localConfirm: RemoteNeonTargetConfirmation = {
      provider: 'neon',
      project: 'tiizi-v2',
      branch: 'main',
      database: 'postgres',
      confirmTarget: 'neon:tiizi-v2:main:postgres',
    };
    const localAllowlist: RemoteNeonAllowlist = {
      allowedHost: '127.0.0.1',
      allowedProject: 'tiizi-v2',
      allowedBranch: 'main',
      allowedDatabase: 'postgres',
    };
    const target = await verifyRemoteNeonBaseline(db, localUrl, localConfirm, localAllowlist);

    // Incomplete candidate rejected without mutating
    const shortCandidate: S6Candidate = { ...candidate, records: candidate.records.slice(0, 10) };
    await expect(
      executeRemoteNeonCataloguePublish(db, target, shortCandidate, inventory, 'apply'),
    ).rejects.toThrow(/expected 118 canonical activity codes/);

    // Dry-run does not publish drafts
    const beforePublished = (await listKnowledgeForAdmin(db, {})).filter((i) => i.lifecycle === 'published').length;
    const dry = await executeRemoteNeonCataloguePublish(db, target, candidate, inventory, 'dry-run');
    expect(dry.import).toMatchObject({ mode: 'dry-run', readyForIngestion: true, applied: 0 });
    expect((await listKnowledgeForAdmin(db, {})).filter((i) => i.lifecycle === 'published').length).toBe(beforePublished);

    // Apply imports and publishes all 118 (84 Fitness, 34 Wellness)
    const applied = await executeRemoteNeonCataloguePublish(db, target, candidate, inventory, 'apply');
    expect(applied.import).toMatchObject({ mode: 'apply', readyForIngestion: true, conflicts: 0 });
    expect(applied.publication).toMatchObject({
      mode: 'apply',
      expected: 118,
      found: 118,
      published: 118 - beforePublished,
      errors: [],
      verification: {
        total: 118,
        published: 118,
        byKind: { fitness: 84, wellness: 34 },
        composerSelectable: 118,
        duplicateCodes: 0,
      },
    });

    // Idempotent re-run
    const rerun = await executeRemoteNeonCataloguePublish(db, target, candidate, inventory, 'apply');
    expect(rerun.import).toMatchObject({ created: 0, updated: 0, unchanged: 118, applied: 0 });
    expect(rerun.publication).toMatchObject({
      alreadyPublished: 118,
      toPublish: 0,
      published: 0,
      errors: [],
    });
  });
});
