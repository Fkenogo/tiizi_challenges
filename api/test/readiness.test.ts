import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { TokenVerifier } from '../src/auth.js';
import type { Db } from '../src/db.js';

function stubVerifier(): TokenVerifier {
  return {
    async verify() {
      const error = new Error('Token verification failed') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 401;
      error.code = 'invalid_token';
      throw error;
    },
  };
}

function healthyDb(): Db {
  return {
    async query() {
      return { rows: [{ '?column?': 1 }] };
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      return fn(healthyDb());
    },
    async close() {},
  } as unknown as Db;
}

function failingDb(): Db {
  return {
    async query(): Promise<never> {
      throw new Error('connect ECONNREFUSED 10.0.0.1:5432');
    },
    async transaction(): Promise<never> {
      throw new Error('database unavailable');
    },
    async close() {},
  } as unknown as Db;
}

describe('liveness (/health)', () => {
  it('returns 200 without authentication', async () => {
    const app = buildApp({ db: healthyDb(), verifier: stubVerifier() });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', service: 'tiizi-api' });
  });

  it('has no database dependency', async () => {
    const app = buildApp({ db: failingDb(), verifier: stubVerifier() });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});

describe('readiness (/ready)', () => {
  it('returns 200 when PostgreSQL is reachable, without authentication', async () => {
    const app = buildApp({ db: healthyDb(), verifier: stubVerifier() });
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', service: 'tiizi-api' });
  });

  it('returns 503 (not 401) when the database is unavailable, with no auth header', async () => {
    const app = buildApp({ db: failingDb(), verifier: stubVerifier() });
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({
      error: { code: 'not_ready', message: 'Database unavailable' },
    });
  });

  it('does not leak connection details in the 503 response', async () => {
    const app = buildApp({ db: failingDb(), verifier: stubVerifier() });
    const res = await app.inject({ method: 'GET', url: '/ready' });
    const body = res.body;
    expect(body).not.toContain('ECONNREFUSED');
    expect(body).not.toContain('10.0.0.1');
    expect(body).not.toContain('5432');
    expect(body).not.toContain('DATABASE_URL');
    expect(body).not.toContain('stack');
  });
});
