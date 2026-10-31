import type { Db } from './db.js';
import {
  DISPOSABLE_DB_MARKER_PREFIX,
  validateDisposableTargetUrl,
  type TargetIdentity,
  type TargetUrlParts,
} from './knowledgeDevCataloguePublish.js';

/**
 * Guard for DISPOSABLE test and cleanup operations (real-PostgreSQL suites,
 * browser-integration rebuilds, dev seeding).
 *
 * The caller must name the exact target three times, independently of the
 * connection URL: allowed host, allowed port, disposable database name. The
 * URL must agree with all three. Everything is decided before a connection is
 * opened, then the live database must report the same identity and carry the
 * `tiizi-disposable-preview:*` marker before any mutation. Any mismatch or
 * unset value fails closed.
 *
 * This module does not touch production tooling (`createPool`/`databaseUrl`
 * in `db.ts` are unchanged); it is opted into by disposable-only callers.
 */

export const DISPOSABLE_TARGET_ENV = {
  host: 'TIIZI_DISPOSABLE_DB_HOST',
  port: 'TIIZI_DISPOSABLE_DB_PORT',
  name: 'TIIZI_DISPOSABLE_DB_NAME',
} as const;

/** The persistent/default PostgreSQL port is never an acceptable disposable target. */
export const PERSISTENT_DEFAULT_PORT = '5432';

export interface DisposableTargetSpec {
  url: string | undefined;
  allowedHost: string | undefined;
  allowedPort: string | undefined;
  databaseName: string | undefined;
}

/** Read the explicit allow-list from the environment; the URL is supplied by the caller. */
export function disposableTargetSpecFromEnv(
  url: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): DisposableTargetSpec {
  return {
    url,
    allowedHost: env[DISPOSABLE_TARGET_ENV.host],
    allowedPort: env[DISPOSABLE_TARGET_ENV.port],
    databaseName: env[DISPOSABLE_TARGET_ENV.name],
  };
}

const refuse = (reason: string): never => {
  throw new Error(`disposable target refused: ${reason}`);
};

/** Pure, pre-connection validation. Returns the vetted target or throws. */
export function assertDisposableTargetSpec(spec: DisposableTargetSpec): TargetUrlParts {
  if (!spec.url) refuse('the connection URL is unset');
  if (!spec.allowedHost) refuse(`${DISPOSABLE_TARGET_ENV.host} is unset`);
  if (!spec.allowedPort) refuse(`${DISPOSABLE_TARGET_ENV.port} is unset`);
  if (!spec.databaseName) refuse(`${DISPOSABLE_TARGET_ENV.name} is unset`);
  const allowedHost = spec.allowedHost!.toLowerCase();
  const allowedPort = spec.allowedPort!;
  if (!/^[0-9]{1,5}$/.test(allowedPort) || Number(allowedPort) < 1024 || Number(allowedPort) > 65535) {
    refuse(`allowed port '${allowedPort}' is not an unprivileged TCP port`);
  }
  if (allowedPort === PERSISTENT_DEFAULT_PORT) refuse(`port ${PERSISTENT_DEFAULT_PORT} is the persistent default and is never disposable`);

  let parts: TargetUrlParts;
  try {
    parts = validateDisposableTargetUrl(spec.url!, spec.databaseName!);
  } catch (error) {
    throw new Error(`disposable target refused: ${error instanceof Error ? error.message.replace(/^target refused: /, '') : 'invalid target'}`);
  }
  if (parts.port === PERSISTENT_DEFAULT_PORT) refuse(`URL port ${PERSISTENT_DEFAULT_PORT} is the persistent default`);
  if (parts.host !== allowedHost) refuse(`URL host '${parts.host}' is not the allowed host '${allowedHost}'`);
  if (parts.port !== allowedPort) refuse(`URL port '${parts.port}' is not the allowed port '${allowedPort}'`);
  return parts;
}

/** Live check: identity matches the allow-list and the disposable marker is present. */
export async function verifyDisposableMarker(db: Db, spec: DisposableTargetSpec): Promise<TargetIdentity> {
  const parts = assertDisposableTargetSpec(spec);
  const res = await db.query<{ db: string; usr: string; port: string; marker: string | null }>(
    `SELECT current_database() AS db, current_user AS usr, current_setting('port') AS port,
            shobj_description((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_database') AS marker`,
  );
  const row = res.rows[0];
  if (!row || row.db !== spec.databaseName) refuse(`connected database '${row?.db ?? 'unknown'}' is not '${spec.databaseName}'`);
  if (String(row.port) !== spec.allowedPort) refuse(`server port '${row.port}' is not the allowed port '${spec.allowedPort}'`);
  if (!row.marker || !row.marker.startsWith(DISPOSABLE_DB_MARKER_PREFIX)) {
    refuse(`database '${spec.databaseName}' lacks the '${DISPOSABLE_DB_MARKER_PREFIX}*' marker`);
  }
  return { ...parts, connectedDatabase: row.db, connectedUser: row.usr, serverPort: String(row.port), marker: row.marker! };
}

/**
 * The only sanctioned way for disposable tooling to obtain a handle: validates
 * before connecting, verifies the marker before returning, and closes the
 * connection if verification fails. `connect` is injected so callers keep their
 * own pool settings and tests can prove nothing connects on rejection.
 */
export async function openGuardedDisposableDb(
  spec: DisposableTargetSpec,
  connect: (url: string) => Db,
): Promise<{ db: Db; identity: TargetIdentity }> {
  assertDisposableTargetSpec(spec);
  const db = connect(spec.url as string);
  try {
    return { db, identity: await verifyDisposableMarker(db, spec) };
  } catch (error) {
    await db.close().catch(() => undefined);
    throw error;
  }
}
