import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Db } from './db.js';
import { DB_SERVER_CA_PEM_ENV } from './dbSsl.js';
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
import { listMigrationFiles } from './migrate.js';

/**
 * Governed remote Neon S6 Catalogue publication (TIIZI-COST-004A / CORR-001 / CORR-002).
 *
 * - Preserves `openGuardedDisposableDb` and `knowledgeDevCataloguePublishCli`
 *   unchanged for disposable local databases.
 * - Dry-run by default (remains available without provider authorization).
 * - Requires authenticated Neon API verification (`NEON_API_KEY`) before any
 *   remote `--apply`, verifying project ID, branch ID, and direct read-write
 *   endpoint against paginated provider metadata.
 * - Optional provisioning receipts (`--provisioning-receipt` /
 *   `TIIZI_NEON_PROVISIONING_RECEIPT`) are retained as audit evidence only and
 *   NEVER substitute for live Neon API verification.
 * - Verifies exact migration filename set equality (`schema_migrations` ==
 *   `api/migrations/*.sql`); explicitly reports that `schema_migrations` does
 *   not record SQL content checksums.
 * - Never logs or includes API keys, connection strings, or credentials in errors.
 */

export const REMOTE_NEON_ENV = {
  host: 'TIIZI_REMOTE_DB_HOST',
  project: 'TIIZI_REMOTE_DB_PROJECT',
  branch: 'TIIZI_REMOTE_DB_BRANCH',
  name: 'TIIZI_REMOTE_DB_NAME',
  receipt: 'TIIZI_NEON_PROVISIONING_RECEIPT',
  apiKey: 'NEON_API_KEY',
} as const;

const IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const NEON_DIRECT_HOST_PATTERN = /^ep-[a-z0-9-]+(?:\.[a-z0-9-]+)+\.neon\.tech$/;
const CONNECTION_OVERRIDE_PARAM = /^(host|hostaddr|port|dbname|database|db|user|service|options|target_session_attrs)$/i;
const TLS_PARAM = /^(ssl|sslmode|sslrootcert|uselibpqcompat|sslcert|sslkey)$/i;

export interface RemoteNeonTargetConfirmation {
  provider: string;
  project: string;
  branch: string;
  database: string;
  confirmTarget: string;
  provisioningReceiptPath?: string;
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

export interface NeonProvisioningReceipt {
  provider: 'neon';
  source: 'neon-api' | 'neonctl';
  project: string;
  branch: string;
  database: string;
  endpointHost: string;
  issuedAt: string;
  receiptSha256?: string;
}

export interface AuditReceiptSummary {
  present: true;
  source: 'neon-api' | 'neonctl';
  issuedAt: string;
  authorizesApply: false;
}

export type AuthoritativeVerificationStatus =
  | {
      verified: true;
      method: 'neon-api';
      projectId: string;
      branchId: string;
      endpointHost: string;
      auditReceipt?: AuditReceiptSummary;
    }
  | {
      verified: false;
      method: 'unverified_dry_run_only';
      auditReceipt?: AuditReceiptSummary;
    };

export interface MigrationIntegrityReport {
  mode: 'filename_set_equality';
  migrationsCount: number;
  checksumsVerified: false;
  limitation: string;
}

export interface RemoteNeonBaselineIdentity extends RemoteNeonTargetParts {
  connectedDatabase: string;
  connectedUser: string;
  migrationsCount: number;
  migrationIntegrity: MigrationIntegrityReport;
  memberCount: number;
  groupCount: number;
  challengeCount: number;
  catalogueBaseline: 'initial-migration-seeded' | 'published-s6-baseline';
  authoritativeVerification: AuthoritativeVerificationStatus;
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

/** Compute canonical SHA-256 fingerprint for an optional Neon audit receipt. */
export function computeProvisioningReceiptSha256(
  receipt: Omit<NeonProvisioningReceipt, 'receiptSha256'>,
): string {
  const canonical = [
    receipt.provider,
    receipt.source,
    receipt.project,
    receipt.branch,
    receipt.database,
    receipt.endpointHost.toLowerCase(),
    receipt.issuedAt,
  ].join(':');
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Pure pre-connection validation of the remote Neon target URL, explicit
 * confirmation arguments, and environment allowlists.
 */
export function validateRemoteNeonTarget(
  rawUrl: string | undefined,
  confirmation: RemoteNeonTargetConfirmation,
  allowlist: RemoteNeonAllowlist,
  env: Record<string, string | undefined> = process.env,
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

  if (url.port && url.port !== '5432') {
    refuse(`unexpected port '${url.port}'; Neon direct endpoints require port 5432`);
  }

  const seenLowerKeys = new Set<string>();
  for (const key of url.searchParams.keys()) {
    const lower = key.toLowerCase();
    if (seenLowerKeys.has(lower) || url.searchParams.getAll(key).length > 1) {
      refuse(`duplicate query parameter '${key}' is not allowed`);
    }
    seenLowerKeys.add(lower);
    if (CONNECTION_OVERRIDE_PARAM.test(key)) {
      refuse(`connection override '${key}' is not allowed`);
    }
  }

  const host = url.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  if (host.includes('-pooler.')) {
    refuse(`host '${host}' is a pooled (-pooler) endpoint; use the direct Neon endpoint for migrations and catalogue publication`);
  }
  if (!NEON_DIRECT_HOST_PATTERN.test(host)) {
    refuse(`host '${host}' is not a valid Neon direct-endpoint hostname (*.neon.tech)`);
  }
  if (host !== allowlist.allowedHost.toLowerCase()) {
    refuse(`URL host '${host}' does not match ${REMOTE_NEON_ENV.host} '${allowlist.allowedHost}'`);
  }

  const urlDb = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (urlDb !== database) {
    refuse(`connection database '${urlDb}' does not equal --target-db '${database}'`);
  }

  for (const key of url.searchParams.keys()) {
    if (TLS_PARAM.test(key) && key.toLowerCase() === 'ssl') {
      refuse("conflicting TLS parameter 'ssl' is not allowed; use sslmode=verify-full only");
    }
  }
  const sslmode = (url.searchParams.get('sslmode') ?? '').trim().toLowerCase();
  if (sslmode !== 'verify-full') {
    refuse(`remote host '${host}' requires sslmode=verify-full (found '${sslmode || 'unset'}')`);
  }
  const rootcert = url.searchParams.get('sslrootcert')?.trim() ?? '';
  const inlinePem = (env[DB_SERVER_CA_PEM_ENV] ?? '').trim();
  if (rootcert && inlinePem) {
    refuse(`conflicting trust anchor: both sslrootcert and ${DB_SERVER_CA_PEM_ENV} are set`);
  }
  if (!rootcert && !inlinePem) {
    refuse(`sslmode=verify-full requires a trusted CA via sslrootcert or ${DB_SERVER_CA_PEM_ENV}`);
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

async function parseOptionalAuditReceipt(
  receiptPath: string,
  target: RemoteNeonTargetParts,
): Promise<AuditReceiptSummary> {
  let parsed: Partial<NeonProvisioningReceipt>;
  try {
    const text = await readFile(receiptPath, 'utf8');
    parsed = JSON.parse(text) as Partial<NeonProvisioningReceipt>;
  } catch {
    refuse(`unable to read or parse audit provisioning receipt at '${receiptPath}'`);
  }
  if (parsed.provider !== 'neon') {
    refuse(`audit provisioning receipt provider mismatch (expected 'neon')`);
  }
  if (parsed.source !== 'neon-api' && parsed.source !== 'neonctl') {
    refuse(`audit provisioning receipt source must be 'neon-api' or 'neonctl'`);
  }
  if (parsed.project !== target.project) {
    refuse(`audit provisioning receipt project '${parsed.project ?? 'unset'}' does not match '${target.project}'`);
  }
  if (parsed.branch !== target.branch) {
    refuse(`audit provisioning receipt branch '${parsed.branch ?? 'unset'}' does not match '${target.branch}'`);
  }
  if (parsed.database !== target.database) {
    refuse(`audit provisioning receipt database '${parsed.database ?? 'unset'}' does not match '${target.database}'`);
  }
  if ((parsed.endpointHost ?? '').toLowerCase() !== target.host) {
    refuse(`audit provisioning receipt endpointHost '${parsed.endpointHost ?? 'unset'}' does not match '${target.host}'`);
  }
  if (!parsed.issuedAt || Number.isNaN(Date.parse(parsed.issuedAt))) {
    refuse('audit provisioning receipt issuedAt must be a valid ISO-8601 timestamp');
  }
  if (parsed.receiptSha256) {
    const expectedSha = computeProvisioningReceiptSha256({
      provider: parsed.provider,
      source: parsed.source,
      project: parsed.project,
      branch: parsed.branch,
      database: parsed.database,
      endpointHost: parsed.endpointHost!,
      issuedAt: parsed.issuedAt,
    });
    if (parsed.receiptSha256.toLowerCase() !== expectedSha) {
      refuse('audit provisioning receipt SHA-256 digest mismatch');
    }
  }
  return {
    present: true,
    source: parsed.source,
    issuedAt: parsed.issuedAt,
    authorizesApply: false,
  };
}

async function fetchAllNeonPages<T>(
  baseUrl: string,
  collectionKey: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
  label: string,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();

  for (let page = 0; page < 100; page += 1) {
    const url = new URL(baseUrl);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);

    let res: Response;
    try {
      res = await fetchImpl(url.toString(), { headers });
    } catch {
      refuse(`Neon API ${label} request failed (network or transport error)`);
    }
    if (!res.ok) {
      refuse(`Neon API ${label} verification failed with status ${res.status}`);
    }

    let body: Record<string, unknown>;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      refuse(`Neon API ${label} response was not valid JSON`);
    }

    const pageItems = body[collectionKey];
    if (!Array.isArray(pageItems)) {
      refuse(`Neon API ${label} response missing '${collectionKey}' array`);
    }
    items.push(...(pageItems as T[]));

    const pagination = body.pagination as { cursor?: unknown } | undefined;
    const nextCursor = typeof pagination?.cursor === 'string' && pagination.cursor.trim()
      ? pagination.cursor.trim()
      : undefined;
    if (!nextCursor) break;
    if (seenCursors.has(nextCursor)) {
      refuse(`Neon API ${label} pagination cursor loop detected`);
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  return items;
}

/**
 * Authoritatively verify Neon project ID, branch ID, and active read-write
 * direct endpoint against the authenticated Neon REST API (`NEON_API_KEY`).
 *
 * Provisioning receipts are retained strictly as optional audit evidence and
 * NEVER authorize `--apply`. `--dry-run` remains available without provider
 * authorization.
 */
export async function verifyAuthoritativeNeonTarget(
  target: RemoteNeonTargetParts,
  mode: 'dry-run' | 'apply',
  options: {
    receiptPath?: string;
    env?: Record<string, string | undefined>;
    fetchFn?: typeof fetch;
  } = {},
): Promise<AuthoritativeVerificationStatus> {
  const env = options.env ?? process.env;
  const receiptPath = options.receiptPath?.trim() || env[REMOTE_NEON_ENV.receipt]?.trim();
  const apiKey = env[REMOTE_NEON_ENV.apiKey]?.trim();

  const auditReceipt = receiptPath
    ? await parseOptionalAuditReceipt(receiptPath, target)
    : undefined;

  if (!apiKey) {
    if (mode === 'apply') {
      refuse(
        `authenticated Neon API verification (${REMOTE_NEON_ENV.apiKey}) is required for --apply; audit receipts alone cannot authorize writes`,
      );
    }
    return {
      verified: false,
      method: 'unverified_dry_run_only',
      ...(auditReceipt ? { auditReceipt } : {}),
    };
  }

  const fetchImpl = options.fetchFn ?? fetch;
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };

  const projects = await fetchAllNeonPages<{ id?: string; name?: string }>(
    'https://console.neon.tech/api/v2/projects',
    'projects',
    headers,
    fetchImpl,
    'projects',
  );
  const matchedProject = projects.find(
    (p) => (p.id === target.project || p.name === target.project) && typeof p.id === 'string' && p.id.trim().length > 0,
  );
  if (!matchedProject?.id) {
    refuse(`Neon project '${target.project}' not found in authenticated Neon account`);
  }

  const [branches, endpoints] = await Promise.all([
    fetchAllNeonPages<{ id?: string; name?: string }>(
      `https://console.neon.tech/api/v2/projects/${encodeURIComponent(matchedProject.id)}/branches`,
      'branches',
      headers,
      fetchImpl,
      'branches',
    ),
    fetchAllNeonPages<{ branch_id?: string; host?: string; type?: string; pooler_enabled?: boolean }>(
      `https://console.neon.tech/api/v2/projects/${encodeURIComponent(matchedProject.id)}/endpoints`,
      'endpoints',
      headers,
      fetchImpl,
      'endpoints',
    ),
  ]);

  const matchedBranch = branches.find(
    (b) => (b.id === target.branch || b.name === target.branch) && typeof b.id === 'string' && b.id.trim().length > 0,
  );
  if (!matchedBranch?.id) {
    refuse(`Neon branch '${target.branch}' not found in project '${target.project}'`);
  }

  const matchedEndpoint = endpoints.find(
    (e) =>
      e.branch_id === matchedBranch.id &&
      e.type === 'read_write' &&
      typeof e.host === 'string' &&
      e.host.toLowerCase() === target.host,
  );
  if (!matchedEndpoint?.host) {
    refuse(
      `Neon endpoint '${target.host}' is not an active read_write direct endpoint for project '${target.project}' (${matchedProject.id}) branch '${target.branch}' (${matchedBranch.id})`,
    );
  }

  return {
    verified: true,
    method: 'neon-api',
    projectId: matchedProject.id,
    branchId: matchedBranch.id,
    endpointHost: matchedEndpoint.host.toLowerCase(),
    ...(auditReceipt ? { auditReceipt } : {}),
  };
}

/**
 * Live baseline verification:
 * 1. Confirms database identity.
 * 2. Verifies exact expected migration filenames in `schema_migrations`
 *    (explicitly noting `schema_migrations` records filenames only, not SQL checksums).
 * 3. Verifies `members`, `groups`, and `challenges` are empty.
 * 4. Verifies existing `knowledge_items` match ONLY the migration-014 exemplar
 *    state or a valid idempotent previously published 118-activity S6 baseline.
 */
export async function verifyRemoteNeonBaseline(
  db: Db,
  target: RemoteNeonTargetParts,
  authoritativeVerification: AuthoritativeVerificationStatus,
  expectedCodes: ReadonlySet<string>,
  expectedMigrations?: string[],
): Promise<RemoteNeonBaselineIdentity> {
  const idRes = await db.query<{ db: string; usr: string }>(
    `SELECT current_database() AS db, current_user AS usr`,
  );
  const idRow = idRes.rows[0];
  if (!idRow || idRow.db !== target.database) {
    refuse(`connected database '${idRow?.db ?? 'unknown'}' does not equal '${target.database}'`);
  }

  const expectedFiles = expectedMigrations ?? (await listMigrationFiles());
  const migRes = await db.query<{ filename: string }>(
    `SELECT filename FROM schema_migrations ORDER BY filename`,
  );
  const appliedFiles = migRes.rows.map((r) => r.filename);
  const expectedSet = new Set(expectedFiles);
  const appliedSet = new Set(appliedFiles);
  const missingMigrations = expectedFiles.filter((f) => !appliedSet.has(f));
  const unexpectedMigrations = appliedFiles.filter((f) => !expectedSet.has(f));
  if (missingMigrations.length > 0 || unexpectedMigrations.length > 0) {
    refuse(
      `schema_migrations mismatch (missing=${missingMigrations.join(',') || 'none'}, unexpected=${unexpectedMigrations.join(',') || 'none'})`,
    );
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
      `database '${target.database}' is not an empty baseline (members=${memberCount}, groups=${groupCount}, challenges=${challengeCount})`,
    );
  }

  const kRes = await db.query<{
    activity_code: string | null;
    kind: string;
    lifecycle: string;
    current_version: number;
  }>(
    `SELECT activity_code, kind, lifecycle, current_version FROM knowledge_items ORDER BY activity_code NULLS FIRST`,
  );
  const kRows = kRes.rows;

  const isInitialExemplarBaseline =
    kRows.length === 2 &&
    kRows.some(
      (r) =>
        r.activity_code === 'FIT-STR-001' &&
        r.kind === 'fitness' &&
        r.lifecycle === 'published' &&
        Number(r.current_version) === 1,
    ) &&
    kRows.some(
      (r) =>
        r.activity_code === 'WEL-MND-003' &&
        r.kind === 'wellness' &&
        r.lifecycle === 'published' &&
        Number(r.current_version) === 1,
    );

  let isPublishedS6Baseline = false;
  if (kRows.length === EXPECTED_CATALOGUE.total && expectedCodes.size === EXPECTED_CATALOGUE.total) {
    const seen = new Set<string>();
    let fitnessCount = 0;
    let wellnessCount = 0;
    let allValid = true;
    for (const r of kRows) {
      if (!r.activity_code || !expectedCodes.has(r.activity_code) || seen.has(r.activity_code)) {
        allValid = false;
        break;
      }
      if (r.lifecycle !== 'published') {
        allValid = false;
        break;
      }
      seen.add(r.activity_code);
      if (r.kind === 'fitness') fitnessCount += 1;
      else if (r.kind === 'wellness') wellnessCount += 1;
      else {
        allValid = false;
        break;
      }
    }
    isPublishedS6Baseline =
      allValid &&
      seen.size === EXPECTED_CATALOGUE.total &&
      fitnessCount === EXPECTED_CATALOGUE.fitness &&
      wellnessCount === EXPECTED_CATALOGUE.wellness;
  }

  if (!isInitialExemplarBaseline && !isPublishedS6Baseline) {
    refuse(
      `unexpected knowledge_items baseline (count=${kRows.length}); expected either the 2 migration-014 exemplar activities or a complete published 118-activity S6 baseline`,
    );
  }

  return {
    ...target,
    connectedDatabase: idRow.db,
    connectedUser: idRow.usr,
    migrationsCount: appliedFiles.length,
    migrationIntegrity: {
      mode: 'filename_set_equality',
      migrationsCount: appliedFiles.length,
      checksumsVerified: false,
      limitation:
        'schema_migrations records filename and applied_at only; SQL content checksums are not recorded by migrate.ts',
    },
    memberCount,
    groupCount,
    challengeCount,
    catalogueBaseline: isPublishedS6Baseline ? 'published-s6-baseline' : 'initial-migration-seeded',
    authoritativeVerification,
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
  if (mode === 'apply' && !target.authoritativeVerification.verified) {
    refuse('authenticated Neon API verification is required before --apply');
  }

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
