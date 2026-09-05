import 'dotenv/config';
import { Pool } from 'pg';

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function createPool(connectionString: string): Db {
  const pool = new Pool({ connectionString });
  return {
    async query(text, params) {
      const result = await pool.query(text, params);
      return { rows: result.rows as Record<string, unknown>[] } as { rows: never[] };
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx: Db = {
          query: async (text, params) => {
            const result = await client.query(text, params);
            return { rows: result.rows };
          },
          transaction: (nested) => nested(tx),
          close: async () => {},
        };
        const value = await fn(tx);
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured');
  return url;
}
