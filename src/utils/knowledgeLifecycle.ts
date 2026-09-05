/**
 * Canonical Knowledge lifecycle + version tracking (P1-3 / P1-4).
 *
 * Canonical Fitness and Wellness Activities move through:
 *
 *   draft → published → retired
 *
 * - Only `published` Activities are offered to ordinary runtime consumers
 *   (challenge creation, pickers, search).
 * - `draft` Activities are hidden from runtime consumers but visible to admins.
 * - `retired` Activities are never offered for new Challenges; historical
 *   Challenges that already snapshot them remain interpretable (by-ID reads
 *   and stored snapshots are never filtered).
 * - Retirement replaces destructive deletion for canonical Knowledge.
 *
 * Backward compatibility: records without lifecycle state (legacy catalogue)
 * are treated as `published` with version 1, so the existing catalogue never
 * disappears. Use `normalizeKnowledgeVersion` / `isPublishedLifecycle` at
 * every read boundary instead of assuming the fields exist.
 */

export type KnowledgeLifecycleStatus = 'draft' | 'published' | 'retired';

export const KNOWLEDGE_LIFECYCLE_STATUSES: KnowledgeLifecycleStatus[] = [
  'draft',
  'published',
  'retired',
];

/** Version assigned to legacy records that predate version tracking. */
export const KNOWLEDGE_VERSION_INITIAL = 1;

export function isLifecycleStatus(value: unknown): value is KnowledgeLifecycleStatus {
  return value === 'draft' || value === 'published' || value === 'retired';
}

/**
 * True when a canonical record may be offered to ordinary runtime consumers.
 * Missing status (legacy records) counts as published.
 */
export function isPublishedLifecycle(status?: string | null): boolean {
  return status == null || status === 'published';
}

/**
 * Normalizes a knowledge version to a positive integer.
 * Missing/invalid values (legacy records) become KNOWLEDGE_VERSION_INITIAL.
 */
export function normalizeKnowledgeVersion(value?: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return KNOWLEDGE_VERSION_INITIAL;
  return Math.floor(n);
}

/**
 * Next version after a canonical content revision. Legacy records without a
 * version normalize to 1 first, so their first revision becomes 2.
 * Lifecycle-only transitions must NOT call this — meaning is unchanged there.
 */
export function nextKnowledgeVersion(current?: unknown): number {
  return normalizeKnowledgeVersion(current) + 1;
}

/**
 * True when a lifecycle value BLOCKS new Challenge creation (P2-1).
 * Only explicit draft/retired block; missing (legacy) counts as published.
 */
export function isBlockedCanonicalStatus(status?: string | null): boolean {
  return status != null && status !== 'published';
}

/**
 * P2-5: catalogue source selection (pure, unit-tested). Firestore-free so
 * guards can exercise it without emulator dependencies.
 *
 * - Authoritative read that SUCCEEDED (array, even empty) → lifecycle applies
 *   to those records. Empty or all-retired is a VALID empty state returned
 *   as-is — never masked by the local fallback.
 * - Authoritative read UNAVAILABLE/failed (null) → resilience fallback,
 *   itself lifecycle-filtered. Fallback never overrides valid authoritative
 *   lifecycle state.
 */
export interface LifecycleRecord {
  name: string;
  lifecycleStatus?: string | null;
}

export function selectPublishedCatalog<T extends LifecycleRecord>(
  authoritativeItems: T[] | null,
  fallbackItems: T[],
): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const publishedOnly = (items: T[]) => items.filter((item) => isPublishedLifecycle(item.lifecycleStatus));
  if (authoritativeItems !== null) {
    return publishedOnly(authoritativeItems).sort(byName);
  }
  return publishedOnly(fallbackItems).sort(byName);
}

/** Admin display label; legacy (missing) status shows as Published. */
export function lifecycleLabel(status?: string | null): string {
  if (status === 'draft') return 'Draft';
  if (status === 'retired') return 'Retired';
  return 'Published';
}
