import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { TokenVerifier } from '../src/auth.js';
import type { Db } from '../src/db.js';
import { ALLOWED_ORIGINS_ENV, parseAllowedOrigins } from '../src/cors.js';

const ENV_KEY = ALLOWED_ORIGINS_ENV;
let envBackup: string | undefined;

function emptyDb(): Db {
  return {
    async query() {
      return { rows: [] };
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      return fn(emptyDb());
    },
    async close() {},
  } as unknown as Db;
}

function denyVerifier(): TokenVerifier {
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

function buildTestApp() {
  return buildApp({ db: emptyDb(), verifier: denyVerifier() });
}

function setOrigins(raw: string | undefined): void {
  if (raw === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = raw;
}

beforeEach(() => {
  envBackup = process.env[ENV_KEY];
});

afterEach(() => {
  if (envBackup === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = envBackup;
});

describe('parseAllowedOrigins', () => {
  it('returns an empty allowlist when unset or blank', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins('')).toEqual([]);
    expect(parseAllowedOrigins('   ')).toEqual([]);
  });

  it('parses comma-separated exact origins, trimming whitespace', () => {
    expect(
      parseAllowedOrigins('https://tiizi.example, https://www.tiizi.example '),
    ).toEqual(['https://tiizi.example', 'https://www.tiizi.example']);
  });

  it('supports explicit localhost development origins', () => {
    expect(parseAllowedOrigins('http://localhost:5173')).toEqual(['http://localhost:5173']);
  });

  it('rejects wildcards, paths, trailing slashes, bad schemes, and bad ports', () => {
    for (const bad of [
      '*',
      'https://*.example.com',
      'https://tiizi.example/',
      'https://tiizi.example/app',
      'https://tiizi.example?x=1',
      'ftp://tiizi.example',
      'tiizi.example',
      'https://tiizi.example:99999',
      'https://tiizi.example:notaport',
    ]) {
      expect(() => parseAllowedOrigins(bad), bad).toThrow();
    }
  });

  it('ignores empty entries between commas', () => {
    expect(parseAllowedOrigins('https://a.example,, https://b.example,')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });
});

describe('production CORS wiring', () => {
  it('echoes a configured allowed origin', async () => {
    setOrigins('https://allowed.example');
    const app = buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://allowed.example' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://allowed.example');
  });

  it('rejects an unlisted origin without echoing it or a wildcard', async () => {
    setOrigins('https://allowed.example');
    const app = buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example' },
    });
    const header = res.headers['access-control-allow-origin'];
    expect(header).not.toBe('https://evil.example');
    expect(header).not.toBe('*');
  });

  it('has no wildcard production fallback when unconfigured', async () => {
    setOrigins(undefined);
    const app = buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://anything.example' },
    });
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('fails fast on invalid configuration', () => {
    setOrigins('https://allowed.example, *');
    expect(() => buildTestApp()).toThrow(/wildcard/i);
  });

  it('does not leak secrets or connection config in error responses', async () => {
    process.env.DATABASE_URL = 'postgresql://secret-user:secret-pass@secret-host/secret-db';
    try {
      setOrigins('https://allowed.example');
      const app = buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/memberships/me',
        headers: { origin: 'https://evil.example' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.body).not.toContain('secret-pass');
      expect(res.body).not.toContain('secret-host');
      expect(res.body).not.toContain('DATABASE_URL');
      expect(res.body).not.toContain('allowed.example');
    } finally {
      delete process.env.DATABASE_URL;
    }
  });
});
