import 'dotenv/config';
import { Pool } from 'pg';
import { resolveVerifiedTls } from './dbSsl.js';

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * Production connection contract (provider-neutral `pg`, standard DATABASE_URL).
 *
 * - TLS is carried by the connection string itself
 *   (`?uselibpqcompat=true&sslmode=verify-ca&sslrootcert=<server-ca.pem>`);
 *   `resolveVerifiedTls` (./dbSsl.ts) enforces CA-verified server
 *   authentication and fails fast on unverified modes (`require`, `prefer`,
 *   `allow`, explicit disables) or a missing CA, so `sslmode=require` can
 *   never silently connect. No driver fork is needed.
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

export interface PoolIdleErrorInfo {
  code?: string;
  message: string;
}

const ALLOWLISTED_POOL_ERRORS: Readonly<Record<string, string>> = {
  ETIMEDOUT: 'Idle PostgreSQL client connection timed out',
  ECONNRESET: 'Idle PostgreSQL client connection reset by peer',
  ECONNREFUSED: 'PostgreSQL connection refused',
  EPIPE: 'Idle PostgreSQL client pipe closed',
  ENOTFOUND: 'PostgreSQL host lookup failed',
  EAI_AGAIN: 'PostgreSQL host lookup temporarily failed',
  EHOSTUNREACH: 'PostgreSQL host unreachable',
  ENETUNREACH: 'PostgreSQL network unreachable',
  ECONNABORTED: 'Idle PostgreSQL client connection aborted',
  ERR_SSL_WRONG_VERSION_NUMBER: 'PostgreSQL TLS handshake failed',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'PostgreSQL TLS certificate verification failed',
  SELF_SIGNED_CERT_IN_CHAIN: 'PostgreSQL TLS certificate chain verification failed',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'PostgreSQL TLS certificate signature verification failed',
  CERT_HAS_EXPIRED: 'PostgreSQL TLS certificate expired',
  ERR_TLS_CERT_ALTNAME_INVALID: 'PostgreSQL TLS certificate hostname mismatch',
  '57P01': 'PostgreSQL server terminated connection (admin shutdown)',
  '57P02': 'PostgreSQL server terminated connection (crash shutdown)',
  '57P03': 'PostgreSQL server cannot connect now',
  '08000': 'PostgreSQL connection exception',
  '08001': 'PostgreSQL client unable to establish connection',
  '08003': 'PostgreSQL connection does not exist',
  '08004': 'PostgreSQL server rejected connection',
  '08006': 'PostgreSQL connection failure',
};

const DEFAULT_POOL_ERROR_INFO: PoolIdleErrorInfo = {
  code: 'UNKNOWN',
  message: 'Idle PostgreSQL client connection failed',
};

/**
 * Map an idle pool error to an allowlisted, credential-safe diagnostic so logs
 * never leak connection strings, standalone secrets, tokens, or raw `pg` objects.
 */
export function sanitizePoolError(error: unknown): PoolIdleErrorInfo {
  if (!error || typeof error !== 'object') {
    return { ...DEFAULT_POOL_ERROR_INFO };
  }

  const errObj = error as { code?: unknown; errno?: unknown };
  for (const rawCode of [errObj.code, errObj.errno]) {
    if (typeof rawCode !== 'string') continue;
    const normalizedCode = rawCode.trim().toUpperCase();
    if (Object.prototype.hasOwnProperty.call(ALLOWLISTED_POOL_ERRORS, normalizedCode)) {
      return {
        code: normalizedCode,
        message: ALLOWLISTED_POOL_ERRORS[normalizedCode],
      };
    }
  }

  return { ...DEFAULT_POOL_ERROR_INFO };
}

/**
 * Attach an `'error'` listener to a `pg.Pool` so idle-client socket failures
 * (e.g., Neon compute scale-to-zero `read ETIMEDOUT`) are logged safely and
 * discarded by `pg-pool` instead of crashing the Node process.
 */
export function attachPoolErrorHandler(
  pool: Pick<Pool, 'on'>,
  onIdleError: (info: PoolIdleErrorInfo) => void = (info) => {
    console.error(
      `[pg-pool] idle client error${info.code ? ` (${info.code})` : ''}: ${info.message}`,
    );
  },
): void {
  pool.on('error', (error: unknown) => {
    onIdleError(sanitizePoolError(error));
  });
}

export function createPool(
  connectionString: string,
  options?: {
    max?: number;
    onIdleError?: (info: PoolIdleErrorInfo) => void;
  },
): Db {
  // Fail closed before pg ever sees the URL: unverified TLS modes and remote
  // plaintext throw here. Every consumer (API, migrate/parity/import CLIs)
  // inherits the verified-TLS contract through this single seam.
  const tls = resolveVerifiedTls(connectionString);
  const pool = new Pool({
    connectionString: tls.connectionString,
    max: options?.max ?? resolveDbPoolMax(),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  attachPoolErrorHandler(pool, options?.onIdleError);
  return {
    async query(text, params) {
      const result = await pool.query(text, params);
      return { rows: result.rows as Record<string, unknown>[] } as { rows: never[] };
    },
    async transaction(fn) {
      const client = await pool.connect();
      let discardClientError: Error | undefined;
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
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          discardClientError =
            rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
        }
        throw error;
      } finally {
        client.release(discardClientError);
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
