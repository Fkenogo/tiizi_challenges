/**
 * Phase B strangler: PostgreSQL-first canonical Knowledge resolution for the
 * trusted challenge-creation backend.
 *
 * Authority rule after Phase B: PostgreSQL/API is authoritative for canonical
 * Knowledge. Which stores participate is governed by KnowledgeAuthorityMode
 * (see below); the backend consults PostgreSQL FIRST for every supplied
 * canonical ID (exerciseId/activityId — Tiizi UUID or legacy Firestore
 * document id) in `transition` and `postgres` modes.
 *
 * The Firestore fallback branches in challengeCreationBackend are
 * TRANSITIONAL (allowed only in `transition` mode). In `postgres` mode
 * Firestore is NEVER consulted for canonical resolution.
 *
 * Custom/manual activities (no canonical ID) never touch either store and
 * pass through unchanged, exactly as before.
 */

export type KnowledgeAuthorityKind = 'fitness' | 'wellness';

/**
 * Explicit canonical Knowledge authority mode
 * (TIIZI_KNOWLEDGE_AUTHORITY_MODE):
 *
 * - `firestore`: legacy pre-cutover behavior. Canonical resolution uses
 *   Firestore only; PostgreSQL is never consulted.
 * - `transition`: temporary migration mode. PostgreSQL first; controlled
 *   Firestore fallback is allowed for not-yet-imported records and
 *   migration compatibility. TRANSITIONAL — remove with the last fallback.
 * - `postgres`: final Phase B authority mode. PostgreSQL/API only:
 *   published hit → accept; draft/retired → reject; missing → reject the
 *   canonical ID; unavailable → fail closed; Firestore is NEVER consulted.
 */
export type KnowledgeAuthorityMode = 'firestore' | 'transition' | 'postgres';

export const KNOWLEDGE_AUTHORITY_MODES: KnowledgeAuthorityMode[] = [
  'firestore',
  'transition',
  'postgres',
];

export function isKnowledgeAuthorityMode(value: unknown): value is KnowledgeAuthorityMode {
  return value === 'firestore' || value === 'transition' || value === 'postgres';
}

/**
 * Reads the authority mode. Unset/blank defaults to `transition` (current
 * Phase B migration behavior). An explicit invalid value throws — failing
 * loud at startup is safer than silently running the wrong authority.
 */
export function knowledgeAuthorityModeFromEnv(
  env: Record<string, string | undefined> = process.env,
): KnowledgeAuthorityMode {
  const raw = (env.TIIZI_KNOWLEDGE_AUTHORITY_MODE ?? '').trim().toLowerCase();
  if (!raw) return 'transition';
  if (isKnowledgeAuthorityMode(raw)) return raw;
  throw new Error(
    `Invalid TIIZI_KNOWLEDGE_AUTHORITY_MODE "${env.TIIZI_KNOWLEDGE_AUTHORITY_MODE}". ` +
      'Expected firestore, transition, or postgres.',
  );
}

export interface KnowledgeAuthorityRecord {
  /** Authoritative Tiizi knowledge UUID. */
  knowledgeId: string;
  kind: KnowledgeAuthorityKind;
  legacyId: string | null;
  lifecycle: string;
  knowledgeVersion: number;
  metricType?: string;
  tier1?: string;
  tier2?: string;
}

export interface KnowledgeAuthorityReader {
  /**
   * Resolves a canonical ID (Tiizi UUID or legacy Firestore document id) to
   * its authoritative record. Returns null when the ID is unknown here.
   * Throws only on infrastructure failure (unreachable database, ...); the
   * caller treats a throw as "authority unavailable" and falls back to the
   * transitional Firestore path.
   */
  findCanonical(id: string): Promise<KnowledgeAuthorityRecord | null>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AuthorityRow {
  knowledge_id: string;
  kind: string;
  legacy_firestore_id: string | null;
  lifecycle: string;
  current_version: number;
  metric_unit: string | null;
  category: string | null;
  subcategory: string | null;
}

function mapAuthorityRow(row: AuthorityRow): KnowledgeAuthorityRecord | null {
  if (row.kind !== 'fitness' && row.kind !== 'wellness') return null;
  const version = Number(row.current_version);
  return {
    knowledgeId: String(row.knowledge_id),
    kind: row.kind,
    legacyId: row.legacy_firestore_id,
    lifecycle: String(row.lifecycle ?? 'published'),
    knowledgeVersion: Number.isFinite(version) && version >= 1 ? Math.floor(version) : 1,
    metricType: row.metric_unit ?? undefined,
    tier1: row.kind === 'fitness' ? (row.category ?? undefined) : undefined,
    tier2: row.kind === 'fitness' ? (row.subcategory ?? undefined) : undefined,
  };
}

/** Default pool ceiling: small enough for callable warm instances. */
export const AUTHORITY_POOL_MAX_DEFAULT = 3;
/** Pool ceiling bounds: callable workloads stay within 1..5 connections. */
export const AUTHORITY_POOL_MAX_MIN = 1;
export const AUTHORITY_POOL_MAX_MAX = 5;

/**
 * Resolves the pg pool ceiling to a bounded integer. Non-numeric input keeps
 * the default; out-of-range input clamps to [1, 5].
 */
export function resolveAuthorityPoolMax(value: unknown = AUTHORITY_POOL_MAX_DEFAULT): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return AUTHORITY_POOL_MAX_DEFAULT;
  return Math.min(AUTHORITY_POOL_MAX_MAX, Math.max(AUTHORITY_POOL_MAX_MIN, n));
}

/**
 * Standard PostgreSQL reader (node-postgres, lazy pool). No ORM, no Firebase.
 * The pool is created once per reader and reused across requests on a warm
 * instance; its ceiling is bounded for callable workloads.
 */
export class PgKnowledgeAuthorityReader implements KnowledgeAuthorityReader {
  private pool: { query: (text: string, params: unknown[]) => Promise<{ rows: AuthorityRow[] }>; end: () => Promise<void> } | null = null;

  readonly maxConnections: number;

  constructor(
    private readonly connectionString: string,
    maxConnections?: number,
  ) {
    this.maxConnections = resolveAuthorityPoolMax(maxConnections);
  }

  private async poolQuery(text: string, params: unknown[]): Promise<{ rows: AuthorityRow[] }> {
    if (!this.pool) {
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: this.connectionString, max: this.maxConnections });
      this.pool = {
        query: (queryText: string, queryParams: unknown[]) => pool.query(queryText, queryParams as never[]) as Promise<{ rows: AuthorityRow[] }>,
        end: () => pool.end(),
      };
    }
    return this.pool.query(text, params);
  }

  async findCanonical(id: string): Promise<KnowledgeAuthorityRecord | null> {
    const trimmed = id.trim();
    if (!trimmed) return null;
    const byUuid = UUID_RE.test(trimmed);
    const result = await this.poolQuery(
      byUuid
        ? `SELECT knowledge_id, kind, legacy_firestore_id, lifecycle, current_version,
                  metric_unit, category, subcategory
           FROM knowledge_items WHERE knowledge_id = $1`
        : `SELECT knowledge_id, kind, legacy_firestore_id, lifecycle, current_version,
                  metric_unit, category, subcategory
           FROM knowledge_items WHERE legacy_firestore_id = $1`,
      [trimmed],
    );
    const row = result.rows[0];
    return row ? mapAuthorityRow(row) : null;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

let cachedReader: KnowledgeAuthorityReader | null | undefined;

/**
 * Builds the authority reader from the standard DATABASE_URL environment
 * variable. Returns null when unset/empty — the backend then runs the legacy
 * Firestore-only path (safe rollback: unset DATABASE_URL).
 */
export function createKnowledgeAuthorityFromEnv(): KnowledgeAuthorityReader | null {
  if (cachedReader !== undefined) return cachedReader;
  const connectionString = (process.env.DATABASE_URL ?? '').trim();
  cachedReader = connectionString ? new PgKnowledgeAuthorityReader(connectionString) : null;
  return cachedReader;
}

/** Test seam: overrides the cached reader (pass null for Firestore-only). */
export function setKnowledgeAuthorityForTests(reader: KnowledgeAuthorityReader | null | undefined): void {
  cachedReader = reader;
}
