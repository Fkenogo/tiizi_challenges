import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';
import { updateOwnDisplayName } from '../src/memberProfileIdentity.js';

const databaseUrl = process.env.TIIZI_TEST_DATABASE_URL;
const postgresDescribe = databaseUrl ? describe : describe.skip;
let pool: Pool;
let db: Db;

function wrapClient(client: PoolClient): Db {
  const tx: Db = {
    async query<T>(text: string, params?: unknown[]) {
      const result = await client.query(text, params);
      return { rows: result.rows as T[] };
    },
    transaction: async (fn) => fn(tx),
    close: async () => {},
  };
  return tx;
}

function createDb(poolInstance: Pool): Db {
  return {
    async query<T>(text: string, params?: unknown[]) {
      const result = await poolInstance.query(text, params);
      return { rows: result.rows as T[] };
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      const client = await poolInstance.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(wrapClient(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: async () => { await poolInstance.end(); },
  };
}

postgresDescribe('display-name row locking on independent PostgreSQL connections', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 2 });
    db = createDb(pool);
    await runMigrations(db);
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('serializes overlapping edits and records each previous value accurately', async () => {
    const inserted = await db.query<{ member_id: string }>(
      `INSERT INTO members (auth_provider, auth_subject)
       VALUES ('firebase', $1) RETURNING member_id`, [`profile-lock-${crypto.randomUUID()}`],
    );
    const memberId = inserted.rows[0].member_id;
    let secondLockQueryStarted!: () => void;
    const secondStarted = new Promise<void>((resolve) => { secondLockQueryStarted = resolve; });
    let releaseUnlockedReads!: () => void;
    const bothUnlockedReads = new Promise<void>((resolve) => { releaseUnlockedReads = resolve; });
    let transactionNumber = 0;
    let lockReads = 0;
    let unlockedReads = 0;
    const overlappingDb: Db = {
      query: (text, params) => db.query(text, params),
      close: db.close,
      async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
        const currentTransaction = ++transactionNumber;
        return db.transaction((baseTx) => fn({
          query: async <R>(text: string, params?: unknown[]) => {
            if (/^SELECT display_name FROM members WHERE member_id = \$1(?:\s+FOR UPDATE)?$/i.test(text.trim())) {
              const usesRowLock = /\bFOR UPDATE\b/i.test(text);
              if (usesRowLock && currentTransaction === 2) secondLockQueryStarted();
              const result = await baseTx.query<R>(text, params);
              lockReads += 1;
              if (usesRowLock && currentTransaction === 1) await secondStarted;
              if (!usesRowLock) {
                unlockedReads += 1;
                if (unlockedReads === 2) releaseUnlockedReads();
                await bothUnlockedReads;
              }
              return result;
            }
            return baseTx.query<R>(text, params);
          },
          transaction: (nested) => nested(baseTx),
          close: async () => {},
        }));
      },
    };

    await Promise.all([
      updateOwnDisplayName(overlappingDb, { memberId }, { displayName: 'First' }),
      updateOwnDisplayName(overlappingDb, { memberId }, { displayName: 'Second' }),
    ]);
    expect(lockReads).toBe(2);
    const events = await db.query<{ old_display_name: string | null; new_display_name: string }>(
      `SELECT old_display_name, new_display_name FROM member_display_name_history
       WHERE member_id = $1 ORDER BY history_id`, [memberId],
    );
    expect(events.rows).toHaveLength(2);
    expect(events.rows[0].old_display_name).toBeNull();
    expect(events.rows[1].old_display_name).toBe(events.rows[0].new_display_name);
    expect(new Set(events.rows.map((row) => row.new_display_name))).toEqual(new Set(['First', 'Second']));
  }, 30000);
});
