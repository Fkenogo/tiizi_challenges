/**
 * TIIZI S4a CORR-001 — curated Group cover catalogue.
 *
 * Canonical media references (NOT mock URLs, NOT uploads): eight stable
 * cover ids rendered from local gradients. The server allowlists the same
 * ids (`GROUP_COVER_CATALOGUE`); the client never invents, uploads, or
 * free-types cover content. The catalogue is reusable for Challenge covers
 * later — CORR-001 assembles the Group side only.
 *
 * Groups without a cover (legacy rows, coverId null) render a deterministic
 * fallback derived from the Group id — presentation only, never persisted,
 * never Product Truth.
 */

/** Must stay in sync with the API `GROUP_COVER_CATALOGUE` allowlist. */
export const GROUP_COVER_CATALOGUE = [
  'cover-1',
  'cover-2',
  'cover-3',
  'cover-4',
  'cover-5',
  'cover-6',
  'cover-7',
  'cover-8',
] as const;

export type GroupCoverId = (typeof GROUP_COVER_CATALOGUE)[number];

const COVER_LABELS: Record<GroupCoverId, string> = {
  'cover-1': 'Sunrise',
  'cover-2': 'Savanna',
  'cover-3': 'Highland',
  'cover-4': 'Dusk',
  'cover-5': 'Ember',
  'cover-6': 'Teal',
  'cover-7': 'Bloom',
  'cover-8': 'Night',
};

const COVER_GRADIENTS: Record<GroupCoverId, string> = {
  'cover-1': 'from-orange-500 via-amber-500 to-yellow-400',
  'cover-2': 'from-lime-600 via-green-600 to-emerald-500',
  'cover-3': 'from-sky-600 via-blue-600 to-indigo-500',
  'cover-4': 'from-violet-600 via-purple-600 to-fuchsia-500',
  'cover-5': 'from-red-600 via-orange-600 to-amber-500',
  'cover-6': 'from-teal-600 via-cyan-600 to-sky-500',
  'cover-7': 'from-pink-600 via-rose-500 to-orange-400',
  'cover-8': 'from-slate-800 via-slate-700 to-slate-600',
};

export function isGroupCoverId(value: unknown): value is GroupCoverId {
  return (
    typeof value === 'string' &&
    (GROUP_COVER_CATALOGUE as readonly string[]).includes(value)
  );
}

export function coverLabelFor(coverId: GroupCoverId): string {
  return COVER_LABELS[coverId];
}

export function coverGradientFor(coverId: GroupCoverId): string {
  return COVER_GRADIENTS[coverId];
}

/**
 * Resolve the cover to render. A stored catalogue id wins; otherwise a
 * deterministic fallback from the Group id (stable across renders, never
 * persisted). Unknown stored values fall back rather than rendering raw.
 */
export function coverFor(coverId: string | null | undefined, fallbackKey: string): GroupCoverId {
  if (isGroupCoverId(coverId)) return coverId;
  let hash = 0;
  for (let i = 0; i < fallbackKey.length; i += 1) {
    hash = (hash * 31 + fallbackKey.charCodeAt(i)) >>> 0;
  }
  return GROUP_COVER_CATALOGUE[hash % GROUP_COVER_CATALOGUE.length];
}
