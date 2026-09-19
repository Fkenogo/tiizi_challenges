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
import { isActivityCode, isUuid } from './knowledge.js';

/**
 * PF-01 quarantine note: exact-name pin resolution stays for historical
 * compatibility only (historical Challenges built on name pins must keep
 * resolving). New V2 product contracts MUST use resolveKnowledgePinByIdentity
 * (UUID/code) instead — display names are localizable content, never identity.
 */
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

/**
 * PF-01 governed V2 pin resolver: resolves by immutable identity (UUID or
 * Activity Code), published-only, fail-closed. Unknown identities,
 * malformed keys, drafts/retired items and ambiguous duplicates resolve to
 * null (the caller rejects; pins are never invented). Challenge
 * establishment pins the exemplar by this identity together with the
 * current version, so later edits cannot rewrite what was pinned.
 */
export async function resolveKnowledgePinByIdentity(
  db: Db,
  kind: 'fitness' | 'wellness',
  key: string,
): Promise<KnowledgePin | null> {
  if (kind !== 'fitness' && kind !== 'wellness') return null;
  if (!key) return null;
  const column = isUuid(key) ? 'knowledge_id' : isActivityCode(key) ? 'activity_code' : null;
  if (!column) return null;
  const result = await db.query<{ knowledge_id: string; current_version: number }>(
    `SELECT knowledge_id, current_version FROM knowledge_items
     WHERE kind = $1 AND ${column} = $2 AND lifecycle = 'published'`,
    [kind, key],
  );
  if (result.rows.length !== 1) return null;
  return {
    knowledge_id: String(result.rows[0].knowledge_id),
    current_version: Number(result.rows[0].current_version),
  };
}

/** Route-ready identity resolver bound to a `Db` (kind comes from the request). */
export function createDbKnowledgeIdentityResolver(
  db: Db,
  kind: 'fitness' | 'wellness',
): (key: string) => Promise<KnowledgePin | null> {
  return (key: string) => resolveKnowledgePinByIdentity(db, kind, key);
}

/**
 * TIIZI-S3B-FOUNDER-PREVIEW-CORR-002 — governed application pin resolver.
 *
 * Identity-first: a key that IS an immutable identity (Knowledge UUID or
 * governed Activity Code) resolves by identity — exactly as V2 establishment
 * (`validateChallengeDefinition` / PF-01-CORR-001) and the Challenge read
 * model do. V2 governed establishment always pins that identity, so this is
 * the normal path and the DEFECT-001 correction.
 *
 * A key that is NOT a valid identity falls back to the quarantined
 * exact-NAME resolver, preserving the historical pre-PF-01 name-pinned
 * Challenge contract that the V2 activity-application seam still supports
 * (legacy C2A configs/fixtures). The fallback is narrowly bounded:
 * - it runs ONLY for keys that are not a UUID/Activity Code (no identity key
 *   is ever reinterpreted as a name);
 * - exact published name only — never partial/fuzzy/ambiguous matching;
 * - fail-closed (unknown keys resolve to null; pins are never invented).
 *
 * This is application-side only. Current PF-01/PF-03 establishment is
 * unchanged and still rejects display names as identity, so the fallback can
 * never permit a name-pinned configuration to be created.
 */
export function createDbKnowledgeIdentityFirstResolver(
  db: Db,
  kind: 'fitness' | 'wellness',
): (key: string) => Promise<KnowledgePin | null> {
  return async (key: string) => {
    if (!key) return null;
    if (isUuid(key) || isActivityCode(key)) {
      return resolveKnowledgePinByIdentity(db, kind, key);
    }
    return resolveKnowledgePinByName(db, kind, key);
  };
}
