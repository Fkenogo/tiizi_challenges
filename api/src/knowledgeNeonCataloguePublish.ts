import type { Db } from './db.js';
import {
  importS6Catalogue,
  type S6Candidate,
  type S6Inventory,
} from './knowledgeCatalogueImport.js';
import {
  EXPECTED_CATALOGUE,
  publishDevCatalogue,
  type PublicationReport,
} from './knowledgeDevCataloguePublish.js';

/**
 * Governed remote Neon S6 Catalogue publication (TIIZI-COST-004A).
 *
 * - Preserves `openGuardedDisposableDb` and `knowledgeDevCataloguePublishCli`
 *   unchanged for disposable local databases.
 * - Dry-run by default.
 * - Requires explicit confirmation of provider (`neon`), project, branch,
 *   database, and matching environment allowlists before opening a connection.
 * - Requires a verified empty baseline (`members = 0`, `groups = 0`,
 *   `challenges = 0`) and rejects non-direct (`-pooler`) Neon endpoints and
 *   unverified TLS modes.
 * - Reuses `importS6Catalogue` and `publishDevCatalogue` (`setKnowledgeLifecycle`)
 *   so all PF-01/S6 versioning, readiness, and lifecycle invariants are preserved.
 * - Never logs or includes connection strings, credentials, or secrets in errors.
 */

export const REMOTE_NEON_ENV = {
  host: 'TIIZI_REMOTE_DB_HOST',
  project: 'TIIZI_REMOTE_DB_PROJECT',
  branch: 'TIIZI_REMOTE_DB_BRANCH',
  name: 'TIIZI_REMOTE_DB_NAME',
} as const;

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export interface RemoteNeonTargetConfirmation {
  provider: string;
  project: string;
  branch: string;
  database: string;
  confirmTarget: string;
}

export interface RemoteNeonAllowlist {
  allowedHost: string | undefined;
  allowedProject: string | undefined;
  allowedBranch: string | undefined;
  allowedDatabase: string | undefined;
}

export interface RemoteNeonTargetParts {
  host: string;
  port: string;
  database: string;
  provider: 'neon';
  project: string;
  branch: string;
}

export interface RemoteNeonBaselineIdentity extends RemoteNeonTargetParts {
  connectedDatabase: string;
  connectedUser: string;
  migrationsCount: number;
  memberCount: number;
  groupCount: number;
  challengeCount: number;
}

export interface RemoteNeonPublicationResult {
  target: RemoteNeonBaselineIdentity;
  import: {
    mode: 'dry-run' | 'apply';
    expected: number;
    received: number;
    created: number;
    updated: number;
    unchanged: number;
    conflicts: number;
    applied: number;
    readyForIngestion: boolean;
    errors: string[];
  };
  publication: PublicationReport | { note: string };
}

function refuse(reason: string): never {
  throw new Error(`remote neon target refused: ${reason}`);
}

export function remoteNeonAllowlistFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): RemoteNeonAllowlist {
  return {
    allowedHost: env[REMOTE_NEON_ENV.host]?.trim(),
    allowedProject: env[REMOTE_NEON_ENV.project]?.trim(),
    allowedBranch: env[REMOTE_NEON_ENV.branch]?.trim(),
    allowedDatabase: env[REMOTE_NEON_ENV.name]?.trim(),
  };
}

/**
 * Pure pre-connection validation of the remote Neon target URL, explicit
 * confirmation arguments, and environment allowlists.
 */
export function validateRemoteNeonTarget(
  rawUrl: string | undefined,
  confirmation: RemoteNeonTargetConfirmation,
  allowlist: RemoteNeonAllowlist,
): RemoteNeonTargetParts {
  if (!rawUrl || !rawUrl.trim()) refuse('DATABASE_URL is unset');

  const provider = confirmation.provider.trim().toLowerCase();
  const project = confirmation.project.trim();
  const branch = confirmation.branch.trim();
  const database = confirmation.database.trim();
  const confirmTarget = confirmation.confirmTarget.trim();

  if (provider !== 'neon') {
    refuse(`--target-provider must be 'neon' (received '${confirmation.provider || 'empty'}')`);
  }
  if (!project || !IDENTIFIER_PATTERN.test(project)) {
    refuse('--target-project is required and must be a valid identifier');
  }
  if (!branch || !IDENTIFIER_PATTERN.test(branch)) {
    refuse('--target-branch is required and must be a valid identifier');
  }
  if (!database || !IDENTIFIER_PATTERN.test(database)) {
    refuse('--target-db is required and must be a valid identifier');
  }

  const expectedConfirm = `neon:${project}:${branch}:${database}`;
  if (confirmTarget !== expectedConfirm) {
    refuse(`--confirm-target must equal '${expectedConfirm}'`);
  }

  if (!allowlist.allowedHost) refuse(`${REMOTE_NEON_ENV.host} is unset`);
  if (!allowlist.allowedProject) refuse(`${REMOTE_NEON_ENV.project} is unset`);
  if (!allowlist.allowedBranch) refuse(`${REMOTE_NEON_ENV.branch} is unset`);
  if (!allowlist.allowedDatabase) refuse(`${REMOTE_NEON_ENV.name} is unset`);

  if (project !== allowlist.allowedProject) {
    refuse(`--target-project '${project}' does not match ${REMOTE_NEON_ENV.project} '${allowlist.allowedProject}'`);
  }
  if (branch !== allowlist.allowedBranch) {
    refuse(`--target-branch '${branch}' does not match ${REMOTE_NEON_ENV.branch} '${allowlist.allowedBranch}'`);
  }
  if (database !== allowlist.allowedDatabase) {
    refuse(`--target-db '${database}' does not match ${REMOTE_NEON_ENV.name} '${allowlist.allowedDatabase}'`);
  }

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    refuse('DATABASE_URL is not a valid URL');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    refuse(`unsupported protocol '${url.protocol}'`);
  }
  for (const key of url.searchParams.keys()) {
    if (/^(host|hostaddr|port|dbname|database|db|user|service|options)$/i.test(key)) {
      refuse(`connection override '${key}' is not allowed`);
    }
  }

  const host = url.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  if (host !== allowlist.allowedHost.toLowerCase()) {
    refuse(`URL host '${host}' does not match ${REMOTE_NEON_ENV.host} '${allowlist.allowedHost}'`);
  }
  if (host.includes('-pooler.')) {
    refuse(`host '${host}' is a pooled (-pooler) endpoint; use the direct Neon endpoint for migrations and catalogue publication`);
  }

  const urlDb = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (urlDb !== database) {
    refuse(`connection database '${urlDb}' does not equal --target-db '${database}'`);
  }

  if (!LOOPBACK_HOSTS.has(host)) {
    const sslmode = (url.searchParams.get('sslmode') ?? '').trim().toLowerCase();
    if (sslmode !== 'verify-full') {
      refuse(`remote host '${host}' requires sslmode=verify-full (found '${sslmode || 'unset'}')`);
    }
  }

  return {
    host,
    port: url.port || '5432',
    database,
    provider: 'neon',
    project,
    branch,
  };
}

/**
 * Live baseline verification: confirms database identity, schema_migrations
 * presence, and strictly zero existing domain rows in `members`, `groups`,
 * and `challenges`.
 */
export async function verifyRemoteNeonBaseline(
  db: Db,
  rawUrl: string | undefined,
  confirmation: RemoteNeonTargetConfirmation,
  allowlist: RemoteNeonAllowlist,
): Promise<RemoteNeonBaselineIdentity> {
  const parts = validateRemoteNeonTarget(rawUrl, confirmation, allowlist);
  const idRes = await db.query<{ db: string; usr: string }>(
    `SELECT current_database() AS db, current_user AS usr`,
  );
  const idRow = idRes.rows[0];
  if (!idRow || idRow.db !== parts.database) {
    refuse(`connected database '${idRow?.db ?? 'unknown'}' does not equal '${parts.database}'`);
  }

  const migRes = await db.query<{ cnt: string | number }>(
    `SELECT COUNT(*) AS cnt FROM schema_migrations`,
  );
  const migrationsCount = Number(migRes.rows[0]?.cnt ?? 0);
  if (migrationsCount < 34) {
    refuse(`expected at least 34 applied migrations in schema_migrations, found ${migrationsCount}`);
  }

  const countsRes = await db.query<{
    members_cnt: string | number;
    groups_cnt: string | number;
    challenges_cnt: string | number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM members) AS members_cnt,
       (SELECT COUNT(*) FROM groups) AS groups_cnt,
       (SELECT COUNT(*) FROM challenges) AS challenges_cnt`,
  );
  const counts = countsRes.rows[0];
  const memberCount = Number(counts?.members_cnt ?? 0);
  const groupCount = Number(counts?.groups_cnt ?? 0);
  const challengeCount = Number(counts?.challenges_cnt ?? 0);

  if (memberCount > 0 || groupCount > 0 || challengeCount > 0) {
    refuse(
      `database '${parts.database}' is not an empty baseline (members=${memberCount}, groups=${groupCount}, challenges=${challengeCount})`,
    );
  }

  return {
    ...parts,
    connectedDatabase: idRow.db,
    connectedUser: idRow.usr,
    migrationsCount,
    memberCount,
    groupCount,
    challengeCount,
  };
}

/**
 * Execute governed S6 import and publication against a verified remote Neon
 * empty baseline.
 */
export async function executeRemoteNeonCataloguePublish(
  db: Db,
  target: RemoteNeonBaselineIdentity,
  candidate: S6Candidate,
  inventory: S6Inventory,
  mode: 'dry-run' | 'apply',
): Promise<RemoteNeonPublicationResult> {
  const codes = new Set<string>(
    (candidate.records ?? []).map((record) => record.activityCode).filter(Boolean),
  );
  if (codes.size !== EXPECTED_CATALOGUE.total) {
    throw new Error(
      `remote neon catalogue refused: expected ${EXPECTED_CATALOGUE.total} canonical activity codes in candidate, found ${codes.size}`,
    );
  }
  const inventoryCodes = new Set<string>(
    (inventory.activities ?? []).map((activity) => activity.activityCode).filter(Boolean),
  );
  if (inventoryCodes.size !== EXPECTED_CATALOGUE.total) {
    throw new Error(
      `remote neon catalogue refused: expected ${EXPECTED_CATALOGUE.total} canonical activity codes in inventory, found ${inventoryCodes.size}`,
    );
  }

  const imported = await importS6Catalogue(db, candidate, inventory, mode);
  const importSummary = {
    mode: imported.mode,
    expected: imported.expected,
    received: imported.received,
    created: imported.created,
    updated: imported.updated,
    unchanged: imported.unchanged,
    conflicts: imported.conflicts,
    applied: imported.applied,
    readyForIngestion: imported.readyForIngestion,
    errors: imported.errors,
  };

  if (!imported.readyForIngestion) {
    return {
      target,
      import: importSummary,
      publication: { note: 'aborted before publication: S6 catalogue import is not ready for ingestion' },
    };
  }

  if (mode === 'dry-run' && imported.created + imported.updated > 0) {
    return {
      target,
      import: importSummary,
      publication: {
        note: 'dry-run: publication is planned after import; re-run --dry-run after --apply for a full plan',
      },
    };
  }

  const published = await publishDevCatalogue(db, codes, mode);
  return {
    target,
    import: importSummary,
    publication: published,
  };
}
