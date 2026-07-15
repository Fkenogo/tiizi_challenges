/**
 * Shared value → human-readable-label lookups for Group metadata fields
 * (groupType, locationScope, activityInterests, wellnessTopics, groupGoals).
 *
 * Derived from the canonical option arrays in groupOptions.ts, plus a small
 * set of legacy aliases for ids that existed in EditGroupScreen's old
 * (pre-consolidation) groupGoals list but were merged into a differently-
 * named canonical id here — so groups saved before consolidation still
 * display correctly without any data migration. See
 * docs/reports/group-detail-focus-enhancement.md and
 * docs/reports/pre-beta-group-detail-onboarding-and-taxonomy-fix.md for the
 * full audit.
 *
 * Every getX() helper falls back to a humanized version of the raw value
 * (dashes/underscores → spaces, title-cased) rather than ever showing
 * "undefined" or a raw id, so unrecognized/legacy values still render
 * reasonably.
 */

import { ACTIVITY_OPTIONS, GROUP_GOALS, GROUP_TYPES, LOCATION_SCOPES, WELLNESS_OPTIONS } from './groupOptions';

function humanize(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const GROUP_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  GROUP_TYPES.map((t) => [t.id, t.label]),
);

export const LOCATION_SCOPE_LABELS: Record<string, string> = Object.fromEntries(
  LOCATION_SCOPES.map((s) => [s.id, s.label]),
);

export const ACTIVITY_LABELS: Record<string, string> = Object.fromEntries(
  ACTIVITY_OPTIONS.map((a) => [a.id, a.name]),
);

export const WELLNESS_LABELS: Record<string, string> = Object.fromEntries(
  WELLNESS_OPTIONS.map((w) => [w.id, w.name]),
);

// Pre-consolidation EditGroupScreen persisted "weightloss" for the goal now
// canonically also called "weightloss" (unchanged) — no aliasing needed for
// most ids since this module's ids were chosen to match the old Edit ids
// exactly wherever a merge didn't occur. No old ids were renamed, so no
// alias table is currently required; kept as an empty extension point.
const LEGACY_GROUP_GOAL_ALIASES: Record<string, string> = {};

export const GROUP_GOAL_ID_LABELS: Record<string, string> = Object.fromEntries(
  GROUP_GOALS.map((g) => [g.id, g.label]),
);

export function getGroupTypeLabel(value: string | undefined | null): string | null {
  if (!value) return null;
  return GROUP_TYPE_LABELS[value] ?? humanize(value);
}

export function getLocationScopeLabel(value: string | undefined | null): string | null {
  if (!value) return null;
  return LOCATION_SCOPE_LABELS[value] ?? humanize(value);
}

export function getActivityLabel(value: string): string {
  return ACTIVITY_LABELS[value] ?? humanize(value);
}

export function getWellnessLabel(value: string): string {
  return WELLNESS_LABELS[value] ?? humanize(value);
}

/**
 * Resolves a persisted groupGoals entry to a display label. Handles all
 * three historical shapes: a canonical id (current), a legacy
 * EditGroupScreen id predating consolidation (via alias table), or a
 * literal label string written directly by the old CreateGroupScreen
 * (returned as-is, since it's already human-readable and — for every
 * pre-existing Create goal — identical to this module's canonical label).
 */
export function getGroupGoalLabel(value: string): string {
  const canonicalId = LEGACY_GROUP_GOAL_ALIASES[value] ?? value;
  return GROUP_GOAL_ID_LABELS[canonicalId] ?? value;
}
