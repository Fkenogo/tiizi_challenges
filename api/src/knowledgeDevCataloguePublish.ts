import type { Db } from './db.js';
import {
  listKnowledgeForAdmin,
  listPublishedKnowledge,
  setKnowledgeLifecycle,
  type ApiKnowledgeItem,
} from './knowledge.js';

/**
 * DEVELOPMENT-ONLY helper (TIIZI-FER-P0-001): publish the already-imported S6
 * catalogue in a verified DISPOSABLE database.
 *
 * - Publication goes only through the governed `setKnowledgeLifecycle`
 *   operation (no direct SQL lifecycle changes, no content/version changes).
 * - Dry-run by default; the CLI additionally requires a positive disposable
 *   database identity before any write (see `knowledgeDevCataloguePublishCli`).
 * - Fails closed on unexpected codes, counts, versions or lifecycle states and
 *   is safe to re-run (already-published records are skipped).
 */

export const DISPOSABLE_DB_MARKER_PREFIX = 'tiizi-disposable-preview:';
export const EXPECTED_CATALOGUE = { total: 118, fitness: 84, wellness: 34 } as const;

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
// Never a valid target, whatever its marker: the shared development database
// and any name that looks like a deployed environment.
const PROTECTED_DATABASE_NAMES = new Set(['tiizi', 'postgres', 'template0', 'template1']);
const PROTECTED_NAME_PATTERN = /(^|[_-])(prod|production|staging|stage|shared|dev|development)([_-]|$)/i;
const DISPOSABLE_NAME_PATTERN = /^tiizi_[a-z0-9_]*(p0|preview|disposable)[a-z0-9_]*$/;

export interface TargetUrlParts {
  host: string;
  port: string;
  database: string;
}

/** Pure URL-level checks. Throws when the target cannot be treated as disposable. */
export function validateDisposableTargetUrl(rawUrl: string, targetDb: string): TargetUrlParts {
  if (!targetDb) throw new Error('target refused: --target-db is required');
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('target refused: DATABASE_URL is not a valid URL');
  }
  if (process.env.NODE_ENV === 'production') throw new Error('target refused: NODE_ENV=production');
  const host = url.hostname;
  if (!LOOPBACK_HOSTS.has(host)) throw new Error(`target refused: host '${host}' is not loopback`);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (database !== targetDb) {
    throw new Error(`target refused: connection database '${database}' does not equal --target-db '${targetDb}'`);
  }
  if (PROTECTED_DATABASE_NAMES.has(database) || PROTECTED_NAME_PATTERN.test(database)) {
    throw new Error(`target refused: database '${database}' is protected`);
  }
  if (!DISPOSABLE_NAME_PATTERN.test(database)) {
    throw new Error(`target refused: database '${database}' does not match the disposable naming pattern`);
  }
  return { host, port: url.port || '5432', database };
}

export interface TargetIdentity extends TargetUrlParts {
  connectedDatabase: string;
  connectedUser: string;
  serverPort: string;
  marker: string;
}

/** Positive identification: the live connection must report the declared database and carry the disposable marker. */
export async function verifyDisposableTarget(db: Db, rawUrl: string, targetDb: string): Promise<TargetIdentity> {
  const parts = validateDisposableTargetUrl(rawUrl, targetDb);
  const res = await db.query<{ db: string; usr: string; port: string; marker: string | null }>(
    `SELECT current_database() AS db, current_user AS usr, current_setting('port') AS port,
            shobj_description((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_database') AS marker`,
  );
  const row = res.rows[0];
  if (!row || row.db !== targetDb) {
    throw new Error(`target refused: connected database '${row?.db ?? 'unknown'}' does not equal '${targetDb}'`);
  }
  if (!row.marker || !row.marker.startsWith(DISPOSABLE_DB_MARKER_PREFIX)) {
    throw new Error(`target refused: database '${targetDb}' lacks the '${DISPOSABLE_DB_MARKER_PREFIX}*' disposable marker`);
  }
  return { ...parts, connectedDatabase: row.db, connectedUser: row.usr, serverPort: row.port, marker: row.marker };
}

export interface PublicationReport {
  mode: 'dry-run' | 'apply';
  expected: number;
  found: number;
  alreadyPublished: number;
  toPublish: number;
  published: number;
  skipped: number;
  errors: string[];
  verification?: {
    total: number;
    published: number;
    byKind: Record<string, number>;
    composerSelectable: number;
    duplicateCodes: number;
  };
}

function isCanonicalCode(code: string | null): code is string {
  return !!code && /^[A-Z]{3}-[A-Z]{3}-[0-9]{3}$/.test(code);
}

/**
 * Plan (always) and optionally apply publication of the imported catalogue.
 * `expectedCodes` is the canonical 118-code set from the S6 candidate.
 */
export async function publishDevCatalogue(
  db: Db,
  expectedCodes: ReadonlySet<string>,
  mode: 'dry-run' | 'apply',
): Promise<PublicationReport> {
  const report: PublicationReport = {
    mode,
    expected: expectedCodes.size,
    found: 0,
    alreadyPublished: 0,
    toPublish: 0,
    published: 0,
    skipped: 0,
    errors: [],
  };
  if (expectedCodes.size !== EXPECTED_CATALOGUE.total) {
    report.errors.push(`expected code set has ${expectedCodes.size} entries, not ${EXPECTED_CATALOGUE.total}`);
    return report;
  }

  const all = (await listKnowledgeForAdmin(db, {})).filter((item) => isCanonicalCode(item.activityCode));
  report.found = all.length;
  const seen = new Map<string, ApiKnowledgeItem>();
  for (const item of all) {
    const code = item.activityCode as string;
    if (seen.has(code)) report.errors.push(`${code}: duplicate Activity Code`);
    seen.set(code, item);
    if (!expectedCodes.has(code)) report.errors.push(`${code}: unexpected Activity Code`);
    if (item.lifecycle === 'retired') report.errors.push(`${code}: unexpected lifecycle 'retired'`);
  }
  for (const code of expectedCodes) {
    if (!seen.has(code)) report.errors.push(`${code}: missing (run the S6 import first)`);
  }
  if (all.length !== EXPECTED_CATALOGUE.total) {
    report.errors.push(`expected ${EXPECTED_CATALOGUE.total} canonical Activities, found ${all.length}`);
  }
  const drafts = all.filter((item) => item.lifecycle === 'draft');
  for (const item of drafts) {
    if (!item.publicationReady) report.errors.push(`${item.activityCode}: draft is not publication-ready`);
  }
  report.alreadyPublished = all.filter((item) => item.lifecycle === 'published').length;
  report.toPublish = drafts.length;
  if (report.errors.length > 0 || mode === 'dry-run') {
    report.verification = await verify(db, all.length);
    return report;
  }

  for (const draft of drafts) {
    const code = draft.activityCode as string;
    const current = (await listKnowledgeForAdmin(db, {})).find((item) => item.activityCode === code);
    if (!current || current.id !== draft.id || current.knowledgeVersion !== draft.knowledgeVersion) {
      report.errors.push(`${code}: identity or version changed during publication`);
      break;
    }
    if (current.lifecycle === 'published') {
      report.skipped += 1;
      continue;
    }
    const after = await setKnowledgeLifecycle(db, draft.id, 'published');
    if (after.knowledgeVersion !== draft.knowledgeVersion || after.lifecycle !== 'published') {
      report.errors.push(`${code}: post-publication version/lifecycle mismatch`);
      break;
    }
    report.published += 1;
  }
  report.verification = await verify(db, all.length);
  if (report.errors.length === 0) {
    const v = report.verification;
    if (v.published !== EXPECTED_CATALOGUE.total) report.errors.push(`expected ${EXPECTED_CATALOGUE.total} published, found ${v.published}`);
    if (v.composerSelectable !== EXPECTED_CATALOGUE.total) report.errors.push(`expected ${EXPECTED_CATALOGUE.total} composer-selectable, found ${v.composerSelectable}`);
    if (v.byKind.fitness !== EXPECTED_CATALOGUE.fitness || v.byKind.wellness !== EXPECTED_CATALOGUE.wellness) {
      report.errors.push(`expected ${EXPECTED_CATALOGUE.fitness} Fitness / ${EXPECTED_CATALOGUE.wellness} Wellness, found ${v.byKind.fitness ?? 0} / ${v.byKind.wellness ?? 0}`);
    }
    if (v.duplicateCodes !== 0) report.errors.push('duplicate Activity Codes present');
  }
  return report;
}

async function verify(db: Db, total: number): Promise<NonNullable<PublicationReport['verification']>> {
  const all = (await listKnowledgeForAdmin(db, {})).filter((item) => isCanonicalCode(item.activityCode));
  const byKind: Record<string, number> = {};
  for (const item of all) byKind[item.kind] = (byKind[item.kind] ?? 0) + 1;
  const composer = await listPublishedKnowledge(db, { composerSelectable: true, canonicalOnly: true });
  const codes = new Set(all.map((item) => item.activityCode));
  return {
    total,
    published: all.filter((item) => item.lifecycle === 'published').length,
    byKind,
    composerSelectable: composer.length,
    duplicateCodes: all.length - codes.size,
  };
}
