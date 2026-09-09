import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { createPool } from '../src/db.js';
import {
  DB_SERVER_CA_PEM_ENV,
  materializeServerCaPem,
  resolveVerifiedTls,
} from '../src/dbSsl.js';

const PASSWORD = 's3cr3t-pw';
const LOCAL_URL = `postgresql://tiizi:tiizi@localhost:5432/tiizi`;
const REMOTE_HOST = '10.30.0.3';
const REMOTE_URL = (params: string) =>
  `postgresql://tiizi_app:${PASSWORD}@${REMOTE_HOST}:5432/tiizi?${params}`;

// Well-formed PEM framing with a non-signing body: good enough for config
// resolution and driver loading (no handshake is performed in these tests).
const FAKE_CA_PEM = [
  '-----BEGIN CERTIFICATE-----',
  'TUlJRFhUQ0NBazJHQXdJQkFnSVVULzN2K1JmY2t3PT0K',
  '-----END CERTIFICATE-----',
  '',
].join('\n');

let scratch: string[] = [];

afterEach(() => {
  for (const file of scratch) {
    try {
      rmSync(file, { force: true });
    } catch {
      /* best effort */
    }
  }
  scratch = [];
});

function writeCaFile(contents: string = FAKE_CA_PEM): string {
  const dir = mkdtempSync(join(tmpdir(), 'tiizi-tls-test-'));
  const path = join(dir, 'server-ca.pem');
  writeFileSync(path, contents);
  scratch.push(path);
  return path;
}

describe('resolveVerifiedTls', () => {
  it('keeps loopback development URLs plaintext and byte-identical', () => {
    for (const url of [
      LOCAL_URL,
      'postgresql://tiizi:tiizi@127.0.0.1:5432/tiizi',
      'postgresql://tiizi:tiizi@[::1]:5432/tiizi',
    ]) {
      const tls = resolveVerifiedTls(url, {});
      expect(tls.verified).toBe(false);
      expect(tls.mode).toBe('plaintext-local');
      expect(tls.caSource).toBe('none');
      expect(tls.connectionString).toBe(url);
    }
  });

  it('refuses plaintext to a non-loopback host', () => {
    expect(() =>
      resolveVerifiedTls(`postgresql://tiizi_app:${PASSWORD}@${REMOTE_HOST}:5432/tiizi`, {}),
    ).toThrow(/not loopback.*refusing plaintext|refusing plaintext.*remote/i);
  });

  it.each(['require', 'prefer', 'allow'])(
    'rejects sslmode=%s without silently connecting',
    (mode) => {
      let message = '';
      try {
        resolveVerifiedTls(REMOTE_URL(`uselibpqcompat=true&sslmode=${mode}`), {});
      } catch (error) {
        message = String((error as Error).message);
      }
      expect(message).toMatch(/without verifying|unverified/i);
      expect(message).toContain('verify-ca');
      expect(message).not.toContain(PASSWORD);
    },
  );

  it('rejects explicit TLS disables', () => {
    expect(() => resolveVerifiedTls(REMOTE_URL('sslmode=disable'), {})).toThrow(/refusing insecure/i);
    expect(() => resolveVerifiedTls(REMOTE_URL('sslmode=require&ssl=false'), {})).toThrow();
    expect(() => resolveVerifiedTls(LOCAL_URL, {})).not.toThrow();
  });

  it('rejects unknown sslmode values', () => {
    expect(() => resolveVerifiedTls(REMOTE_URL('sslmode=bogus'), {})).toThrow(/unknown sslmode/i);
  });

  it('requires a server CA for verify-ca', () => {
    expect(() =>
      resolveVerifiedTls(REMOTE_URL('uselibpqcompat=true&sslmode=verify-ca'), {}),
    ).toThrow(/requires a server CA/i);
  });

  it('rejects a missing sslrootcert file', () => {
    expect(() =>
      resolveVerifiedTls(
        REMOTE_URL('uselibpqcompat=true&sslmode=verify-ca&sslrootcert=/nonexistent/ca.pem'),
        {},
      ),
    ).toThrow(/missing or empty/i);
  });

  it('rejects verify-ca without libpq-compat (wrong pg semantics)', () => {
    const ca = writeCaFile();
    expect(() =>
      resolveVerifiedTls(REMOTE_URL(`sslmode=verify-ca&sslrootcert=${ca}`), {}),
    ).toThrow(/uselibpqcompat/i);
  });

  it('accepts a valid file-based trust path and preserves credentials', () => {
    const ca = writeCaFile();
    const tls = resolveVerifiedTls(
      REMOTE_URL(`uselibpqcompat=true&sslmode=verify-ca&sslrootcert=${ca}`),
      {},
    );
    expect(tls.verified).toBe(true);
    expect(tls.mode).toBe('verify-ca');
    expect(tls.caSource).toBe('url-sslrootcert');
    expect(new URL(tls.connectionString).password).toBe(PASSWORD);
  });

  it('materializes inline CA PEM idempotently and points pg at it', () => {
    const env = { [DB_SERVER_CA_PEM_ENV]: FAKE_CA_PEM };
    const first = resolveVerifiedTls(REMOTE_URL('uselibpqcompat=true&sslmode=verify-ca'), env);
    const second = resolveVerifiedTls(REMOTE_URL('uselibpqcompat=true&sslmode=verify-ca'), env);
    expect(first.verified).toBe(true);
    expect(first.caSource).toBe('env-pem');
    const path = new URL(first.connectionString).searchParams.get('sslrootcert');
    expect(path).toBeTruthy();
    expect(existsSync(path!)).toBe(true);
    expect(new URL(second.connectionString).searchParams.get('sslrootcert')).toBe(path);
    expect(new URL(first.connectionString).password).toBe(PASSWORD);
    expect(readFileSync(path!, 'utf8')).toContain('-----BEGIN CERTIFICATE-----');
  });

  it('rejects inline PEM without a certificate block', () => {
    expect(() =>
      resolveVerifiedTls(REMOTE_URL('uselibpqcompat=true&sslmode=verify-ca'), {
        [DB_SERVER_CA_PEM_ENV]: 'not-a-certificate',
      }),
    ).toThrow(/does not contain a PEM certificate block/i);
  });

  it('rejects an ambiguous trust anchor (both path and inline PEM)', () => {
    const ca = writeCaFile();
    expect(() =>
      resolveVerifiedTls(REMOTE_URL(`uselibpqcompat=true&sslmode=verify-ca&sslrootcert=${ca}`), {
        [DB_SERVER_CA_PEM_ENV]: FAKE_CA_PEM,
      }),
    ).toThrow(/ambiguous trust anchor/i);
  });

  it('rejects a CA configured without verify mode', () => {
    const ca = writeCaFile();
    expect(() =>
      resolveVerifiedTls(REMOTE_URL(`sslrootcert=${ca}`), {}),
    ).toThrow(/without sslmode=verify-ca/i);
  });

  it('allows verify-full through with a configured CA', () => {
    const ca = writeCaFile();
    const tls = resolveVerifiedTls(
      REMOTE_URL(`uselibpqcompat=true&sslmode=verify-full&sslrootcert=${ca}`),
      {},
    );
    expect(tls.verified).toBe(true);
    expect(tls.mode).toBe('verify-full');
  });

  it('never leaks secrets in error messages', () => {
    const cases: Array<[string, Record<string, string>]> = [
      [REMOTE_URL('uselibpqcompat=true&sslmode=require'), {}],
      [REMOTE_URL('uselibpqcompat=true&sslmode=verify-ca'), {}],
      [
        REMOTE_URL('uselibpqcompat=true&sslmode=verify-ca'),
        { [DB_SERVER_CA_PEM_ENV]: 'garbage-no-cert' },
      ],
    ];
    for (const [url, env] of cases) {
      let message = '';
      try {
        resolveVerifiedTls(url, env);
      } catch (error) {
        message = String((error as Error).message);
      }
      expect(message, url).not.toContain(PASSWORD);
      expect(message, url).not.toContain('garbage-no-cert');
    }
  });
});

describe('pg driver truth (no connection opened)', () => {
  it('loads the CA and disables hostname-only trust for the verified path', () => {
    const ca = writeCaFile();
    const tls = resolveVerifiedTls(
      REMOTE_URL(`uselibpqcompat=true&sslmode=verify-ca&sslrootcert=${ca}`),
      {},
    );
    const client = new Client(tls.connectionString);
    const params = client as unknown as {
      connectionParameters: { ssl: Record<string, unknown> };
    };
    const ssl = params.connectionParameters.ssl;
    expect(ssl).toMatchObject({ ca: expect.stringContaining('BEGIN CERTIFICATE') });
    expect(typeof ssl.checkServerIdentity).toBe('function');
    expect(ssl.rejectUnauthorized).not.toBe(false);
  });

  it('documents why sslmode=require is rejected: pg would not verify', () => {
    const client = new Client(REMOTE_URL('uselibpqcompat=true&sslmode=require'));
    const params = client as unknown as {
      connectionParameters: { ssl: Record<string, unknown> };
    };
    expect(params.connectionParameters.ssl.rejectUnauthorized).toBe(false);
  });

  it('pg itself refuses verify-ca without a CA (defense in depth)', () => {
    expect(
      () => new Client(REMOTE_URL('uselibpqcompat=true&sslmode=verify-ca')),
    ).toThrow(/verify-ca requires|SECURITY WARNING/i);
  });
});

describe('createPool seam', () => {
  it('fails fast on unverified TLS instead of constructing a pool', () => {
    expect(() =>
      createPool(REMOTE_URL('uselibpqcompat=true&sslmode=require')),
    ).toThrow(/without verifying/i);
  });

  it('still constructs and closes a bounded loopback pool', async () => {
    const db = createPool(LOCAL_URL);
    await db.close();
  });
});

describe('dbSsl mirror (API and Functions share one contract)', () => {
  it('functions/src/dbSsl.ts is byte-identical to api/src/dbSsl.ts', () => {
    const apiPath = fileURLToPath(new URL('../src/dbSsl.ts', import.meta.url));
    const functionsPath = fileURLToPath(
      new URL('../../functions/src/dbSsl.ts', import.meta.url),
    );
    expect(existsSync(functionsPath)).toBe(true);
    expect(readFileSync(functionsPath, 'utf8')).toBe(readFileSync(apiPath, 'utf8'));
  });

  it('materializeServerCaPem is stable for identical input', () => {
    expect(materializeServerCaPem(FAKE_CA_PEM)).toBe(materializeServerCaPem(FAKE_CA_PEM));
  });
});
