/**
 * Phase B strangler: PostgreSQL-first canonical Knowledge resolution for the
 * trusted challenge-creation backend.
 *
 * Authority rule after Phase B: PostgreSQL/API is authoritative for canonical
 * Knowledge. The backend therefore consults PostgreSQL FIRST for every
 * supplied canonical ID (exerciseId/activityId — Tiizi UUID or legacy
 * Firestore document id):
 *
 * - PG hit → the decision is authoritative (published resolves and pins the
 *   authoritative knowledgeVersion; draft/retired/missing-in-PG... see below);
 * - PG reachable but record absent → transitional Firestore read-through for
 *   not-yet-imported records (covers import lag during the strangler window);
 * - PG unreachable/misconfigured (or DATABASE_URL unset) → legacy Firestore
 *   path, unchanged. Rollback is unsetting DATABASE_URL.
 *
 * The Firestore branches below are TRANSITIONAL. Remove them once the
 * knowledge import covers all referenced records and parity is proven —
 * challenge creation must not consult two authorities permanently.
 *
 * Custom/manual activities (no canonical ID) never touch either store and
 * pass through unchanged, exactly as before.
 */

export type KnowledgeAuthorityKind = 'fitness' | 'wellness';

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

/**
 * Standard PostgreSQL reader (node-postgres, lazy pool). No ORM, no Firebase.
 */
export class PgKnowledgeAuthorityReader implements KnowledgeAuthorityReader {
  private pool: { query: (text: string, params: unknown[]) => Promise<{ rows: AuthorityRow[] }>; end: () => Promise<void> } | null = null;

  constructor(private readonly connectionString: string) {}

  private async poolQuery(text: string, params: unknown[]): Promise<{ rows: AuthorityRow[] }> {
    if (!this.pool) {
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: this.connectionString });
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
