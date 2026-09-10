/**
 * Phase C2B production Knowledge pin resolver (server-side, database-backed).
 *
 * C1/C2A resolve canonical keys through an injected resolver (stubbed in
 * domain tests). The runtime route needs a production implementation: the
 * canonical key is the published Knowledge item's exact name within its
 * kind. Lookup is exact, published-only, and fail-closed:
 * - unknown key -> null (caller rejects; pins are never invented);
 * - draft/retired items -> null (never accepted for new applications);
 * - ambiguous duplicates -> null (never guessed).
 *
 * No Firebase. Pure domain + `Db`.
 */

import type { Db } from './db.js';
import type { KnowledgePin } from './activityEvents.js';

export async function resolveKnowledgePinByName(
  db: Db,
  kind: 'fitness' | 'wellness',
  canonicalKey: string,
): Promise<KnowledgePin | null> {
  if (kind !== 'fitness' && kind !== 'wellness') return null;
  if (!canonicalKey) return null;
  const result = await db.query<{ knowledge_id: string; current_version: number }>(
    `SELECT knowledge_id, current_version FROM knowledge_items
     WHERE kind = $1 AND name = $2 AND lifecycle = 'published'`,
    [kind, canonicalKey],
  );
  if (result.rows.length !== 1) return null;
  return {
    knowledge_id: String(result.rows[0].knowledge_id),
    current_version: Number(result.rows[0].current_version),
  };
}

/** Route-ready resolver bound to a `Db` (kind comes from the request). */
export function createDbKnowledgeResolver(
  db: Db,
  kind: 'fitness' | 'wellness',
): (canonicalKey: string) => Promise<KnowledgePin | null> {
  return (canonicalKey: string) => resolveKnowledgePinByName(db, kind, canonicalKey);
}
