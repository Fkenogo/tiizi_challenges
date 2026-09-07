import 'dotenv/config';
import { Pool } from 'pg';

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * Production connection contract (provider-neutral `pg`, standard DATABASE_URL).
 *
 * - TLS is carried by the connection string itself (e.g. `?sslmode=require`
 *   for Cloud SQL); node-postgres honors it, so no driver fork is needed.
 * - The pool is deliberately bounded for Cloud Run: total PostgreSQL
 *   connections ≈ (Cloud Run max instances) × TIIZI_DB_POOL_MAX, so both
 *   factors must be set intentionally against the Cloud SQL tier limit.
 * - No PgBouncer, no Cloud SQL-specific driver assumptions in this code.
 */

/** Conservative default: safe for small Cloud SQL tiers and max-instances > 1. */
export const DEFAULT_DB_POOL_MAX = 5;

/** Hard upper bound: fail fast instead of silently opening unbounded pools. */
export const MAX_DB_POOL_MAX = 50;

export const DB_POOL_MAX_ENV = 'TIIZI_DB_POOL_MAX';

/** Resolve the pool size from the environment, validating bounds safely. */
export function resolveDbPoolMax(raw: string | undefined = process.env[DB_POOL_MAX_ENV]): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_DB_POOL_MAX;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_DB_POOL_MAX) {
    throw new Error(
      `${DB_POOL_MAX_ENV} must be an integer between 1 and ${MAX_DB_POOL_MAX}`,
    );
  }
  return parsed;
}

export function createPool(connectionString: string, options?: { max?: number }): Db {
  const pool = new Pool({
    connectionString,
    max: options?.max ?? resolveDbPoolMax(),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
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
