/**
 * Verified PostgreSQL TLS contract.
 *
 * Single connection-security seam shared by every node-postgres (`pg`)
 * consumer: the Cloud Run API, the migration/parity/import CLIs (all via
 * `createPool`), and the Firebase Functions Knowledge-authority reader.
 * The Functions package carries a byte-identical copy of this file
 * (`functions/src/dbSsl.ts`) because the two deployables cannot share source;
 * `api/test/dbTls.test.ts` fails if the copies diverge.
 *
 * Verified mechanism: CA-verified direct PostgreSQL TLS.
 * `DATABASE_URL` keeps `uselibpqcompat=true` and upgrades
 * `sslmode=require` to `sslmode=verify-ca` with the Cloud SQL server CA
 * supplied as `sslrootcert` (file path) or `TIIZI_DB_SERVER_CA_PEM`
 * (inline PEM, materialized to a 0600 temp file). With libpq-compat parsing,
 * `pg` then verifies the server certificate chain against that CA and skips
 * hostname checking (libpq `verify-ca` semantics). Hostname/`verify-full`
 * checking is not usable for direct private-IP Cloud SQL connections — the
 * server certificate carries no IP SAN — so `verify-ca` over the existing
 * private-IP-only route (dedicated VPC, no public IP) is the narrowest safe
 * approach. The residual risk (no hostname check) is bounded by the private
 * CA: only Google can mint server certificates chaining to it. The Cloud SQL
 * language connector / Auth Proxy would restore hostname verification but
 * couples application code to Google; it is rejected for that reason.
 *
 * Fail-closed rules (no silent fallback to insecure transport):
 * - `sslmode=require|prefer|allow`, `sslmode=disable`, `ssl=no-verify`-style
 *   explicit disables, and unknown `sslmode` values throw.
 * - `verify-ca`/`verify-full` without a server CA throws.
 * - `verify-ca` without `uselibpqcompat=true` throws: without libpq-compat,
 *   `pg` applies hostname verification, which direct private-IP connections
 *   cannot satisfy — the mismatch must surface at config time, not as a
 *   handshake failure.
 * - A remote (non-loopback) host with no `sslmode` at all throws: plaintext
 *   to a remote host is never accidental. Loopback hosts without `sslmode`
 *   stay plaintext for local development, exactly as before.
 * - A CA path that does not exist (or is empty) throws; inline PEM without a
 *   certificate block throws; configuring both a path and inline PEM throws
 *   (ambiguous trust anchor).
 *
 * This module never logs or returns secrets: errors name hosts, parameter
 * names, and modes only — never passwords or certificate material.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Env var carrying the server CA as inline PEM (Functions secret path). */
export const DB_SERVER_CA_PEM_ENV = 'TIIZI_DB_SERVER_CA_PEM';

export type PgTlsMode = 'plaintext-local' | 'verify-ca' | 'verify-full';

export type PgCaSource = 'url-sslrootcert' | 'env-pem' | 'none';

export interface VerifiedTlsConfig {
  /** Effective connection string to hand to `pg` (CA path resolved). */
  connectionString: string;
  /** True only when server-certificate verification is enforced. */
  verified: boolean;
  mode: PgTlsMode;
  caSource: PgCaSource;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function fail(message: string): never {
  throw new Error(`PostgreSQL TLS: ${message}`);
}

/** Materialize inline CA PEM to a content-addressed 0600 file. Idempotent. */
export function materializeServerCaPem(pem: string): string {
  const normalized = pem.trim();
  if (!normalized.includes('-----BEGIN CERTIFICATE-----')) {
    fail(
      `${DB_SERVER_CA_PEM_ENV} does not contain a PEM certificate block; refusing to configure trust.`,
    );
  }
  const digest = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  const dir = join(tmpdir(), 'tiizi-db-ca');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `server-ca-${digest}.pem`);
  if (!existsSync(path)) {
    writeFileSync(path, normalized.endsWith('\n') ? normalized : `${normalized}\n`, {
      mode: 0o600,
    });
  }
  return path;
}

function requireCaFile(path: string): void {
  let ok = false;
  try {
    ok = statSync(path).isFile() && statSync(path).size > 0;
  } catch {
    ok = false;
  }
  if (!ok) {
    fail(
      `sslrootcert "${path}" is missing or empty; verify-ca/verify-full requires the server CA file.`,
    );
  }
}

export function resolveVerifiedTls(
  rawConnectionString: string,
  env: Record<string, string | undefined> = process.env,
): VerifiedTlsConfig {
  const raw = (rawConnectionString ?? '').trim();
  if (!raw) fail('DATABASE_URL is not configured.');

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail('DATABASE_URL is not a valid URL.');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    fail(`unsupported protocol "${url.protocol}"; expected postgresql://.`);
  }

  // WHATWG URL keeps IPv6 brackets on hostname ("[::1]"); strip them so the
  // loopback check sees the plain address.
  const host = url.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  const loopback = LOOPBACK_HOSTS.has(host);
  const params = url.searchParams;
  const sslmode = (params.get('sslmode') ?? '').trim().toLowerCase();
  const sslParam = (params.get('ssl') ?? '').trim().toLowerCase();
  const compat = (params.get('uselibpqcompat') ?? '').trim().toLowerCase() === 'true';
  const rootcertParam = params.get('sslrootcert');
  const inlinePem = (env[DB_SERVER_CA_PEM_ENV] ?? '').trim();

  if (
    sslmode === 'disable' ||
    sslParam === '0' ||
    sslParam === 'false' ||
    sslParam === 'no-verify'
  ) {
    fail(
      `TLS is explicitly disabled for host "${host}"; refusing insecure transport. ` +
        'Remove the disable flag (loopback stays plaintext) or use sslmode=verify-ca.',
    );
  }

  if (!sslmode) {
    if (rootcertParam || inlinePem) {
      fail(
        'a server CA is configured without sslmode=verify-ca; refusing ambiguous trust. ' +
          'Set sslmode=verify-ca (with uselibpqcompat=true).',
      );
    }
    if (loopback) {
      return { connectionString: raw, verified: false, mode: 'plaintext-local', caSource: 'none' };
    }
    fail(
      `host "${host}" is not loopback and sslmode is absent; refusing plaintext to a remote host. ` +
        'Use sslmode=verify-ca with the server CA.',
    );
  }

  if (sslmode === 'require' || sslmode === 'prefer' || sslmode === 'allow') {
    fail(
      `sslmode=${sslmode} for host "${host}" encrypts without verifying the server certificate; ` +
        'refusing unverified TLS. Use sslmode=verify-ca with the server CA.',
    );
  }
  if (sslmode !== 'verify-ca' && sslmode !== 'verify-full') {
    fail(
      `unknown sslmode="${sslmode}" for host "${host}"; expected verify-ca or verify-full.`,
    );
  }
  if (sslmode === 'verify-ca' && !compat) {
    fail(
      'sslmode=verify-ca requires uselibpqcompat=true so pg applies libpq verify-ca ' +
        '(chain-only) semantics; without it pg enforces hostname checks that direct ' +
        'private-IP connections cannot satisfy.',
    );
  }

  if (inlinePem && rootcertParam) {
    fail(
      `ambiguous trust anchor: both sslrootcert and ${DB_SERVER_CA_PEM_ENV} are set; configure exactly one.`,
    );
  }
  if (inlinePem) {
    const path = materializeServerCaPem(inlinePem);
    const effective = new URL(raw);
    effective.searchParams.set('sslrootcert', path);
    return {
      connectionString: effective.toString(),
      verified: true,
      mode: sslmode,
      caSource: 'env-pem',
    };
  }
  if (!rootcertParam) {
    fail(
      `sslmode=${sslmode} requires a server CA; provide sslrootcert=<server-ca.pem path> ` +
        `or ${DB_SERVER_CA_PEM_ENV}.`,
    );
  }
  requireCaFile(rootcertParam);
  return {
    connectionString: raw,
    verified: true,
    mode: sslmode,
    caSource: 'url-sslrootcert',
  };
}
