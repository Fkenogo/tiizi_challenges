import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import type { TokenVerifier } from '../src/auth.js';
import type { Db } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';

interface PGliteQueryTarget {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/**
 * Tests run against PGlite — real PostgreSQL semantics (constraints,
 * transactions, error codes) compiled to WASM, in-process. No server needed.
 * Production uses the `pg` driver through the same `Db` seam (`src/db.ts`).
 */
function wrapPGlite(pg: PGlite): Db {
  const query = async <T>(target: PGliteQueryTarget, text: string, params?: unknown[]) => {
    const result = await target.query<T>(text, params);
    return { rows: result.rows };
  };
  const txFrom = (target: PGliteQueryTarget): Db => ({
    query: <T>(text: string, params?: unknown[]) => query<T>(target, text, params),
    transaction: (fn) => fn(txFrom(target)),
    close: async () => {},
  });
  return {
    query: <T>(text: string, params?: unknown[]) => query<T>(pg, text, params),
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      return pg.transaction(async (tx) => fn(txFrom(tx as unknown as PGliteQueryTarget)));
    },
    async close() {
      await pg.close();
    },
  };
}

export function stubVerifier(uidByToken: Record<string, string>): TokenVerifier {
  return {
    async verify(bearerToken: string) {
      const uid = uidByToken[bearerToken];
      if (!uid) {
        const error = new Error('Token verification failed') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 401;
        error.code = 'invalid_token';
        throw error;
      }
      return { uid };
    },
  };
}

let db: Db;

export function testDb(): Db {
  if (!db) throw new Error('test db not initialised');
  return db;
}

export function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

export async function seedMember(
  target: Db,
  subject: string,
  provider = 'firebase',
): Promise<string> {
  const result = await target.query<{ member_id: string }>(
    `INSERT INTO members (auth_provider, auth_subject) VALUES ($1, $2) RETURNING member_id`,
    [provider, subject],
  );
  return String(result.rows[0].member_id);
}

export async function seedGroup(
  target: Db,
  options: { legacyId?: string; name?: string; isPrivate?: boolean } = {},
): Promise<string> {
  const result = await target.query<{ group_id: string }>(
    `INSERT INTO groups (legacy_firestore_id, name, description, is_private)
     VALUES ($1, $2, '', $3) RETURNING group_id`,
    [options.legacyId ?? null, options.name ?? 'Test group', options.isPrivate ?? false],
  );
  return String(result.rows[0].group_id);
}

export async function seedMembership(
  target: Db,
  groupId: string,
  memberId: string,
  options: { role?: string; status?: string } = {},
): Promise<void> {
  await target.query(
    `INSERT INTO group_memberships (group_id, member_id, role, status)
     VALUES ($1, $2, $3, $4)`,
    [groupId, memberId, options.role ?? 'member', options.status ?? 'active'],
  );
}

beforeAll(async () => {
  const pg = new PGlite({ extensions: { pgcrypto } });
  db = wrapPGlite(pg);
  await runMigrations(db);
});

beforeEach(async () => {
  await db.query('TRUNCATE group_memberships, groups, members CASCADE');
});

export function buildTestApp(uidByToken: Record<string, string>) {
  return buildApp({ db: testDb(), verifier: stubVerifier(uidByToken) });
}
