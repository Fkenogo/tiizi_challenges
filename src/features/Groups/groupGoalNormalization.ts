/**
 * Normalizes legacy groupGoals values to canonical ids (see groupOptions.ts).
 *
 * Before taxonomy consolidation, CreateGroupScreen persisted the literal
 * label string (e.g. "Keep Fit Together") while EditGroupScreen persisted an
 * id (e.g. "consistency"). Display already handles both forms gracefully
 * (groupOptionLabels.getGroupGoalLabel falls back to the raw value). This
 * module additionally normalizes legacy literals to canonical ids at Edit
 * hydration time, so that:
 *   - the correct chip shows as selected in the Edit picker (a raw literal
 *     like "Keep Fit Together" would never match GROUP_GOALS.find(g => g.id
 *     === value), so without this it silently showed as unselected even
 *     though the group did have that goal);
 *   - saving a legacy document doesn't just re-persist the old, unmapped
 *     literal string forever.
 *
 * Unknown values (not a recognized legacy literal, and not a canonical id)
 * are preserved as-is rather than dropped — the modal's display fallback
 * already handles rendering unknown values via humanize(), so silently
 * discarding them here would lose real (if unrecognized) group data.
 */

import { GROUP_GOALS } from './groupOptions';

// Maps every pre-consolidation CreateGroupScreen literal label to its
// canonical id (see docs/reports/pre-beta-group-detail-onboarding-and-taxonomy-fix.md §6).
const LEGACY_GOAL_LITERAL_TO_ID: Record<string, string> = {
  'Keep Fit Together': 'keep-fit-together',
  'Lose Weight': 'weightloss',
  'Build Strength': 'strength',
  'Improve Mental Health': 'mental-health',
  'Stay Consistent': 'consistency',
  'Train for an Event': 'athletic-performance',
  'Support a Cause': 'charity',
  'Build Workplace Wellness': 'workplace-wellness',
  'Family / Friends Accountability': 'family-accountability',
  'Other': 'other',
};

const CANONICAL_GOAL_IDS: Set<string> = new Set(GROUP_GOALS.map((g): string => g.id));

/** Normalizes a single legacy or canonical groupGoals value to a canonical id where recognized. */
export function normalizeGroupGoalId(value: string): string {
  if (CANONICAL_GOAL_IDS.has(value)) return value;
  return LEGACY_GOAL_LITERAL_TO_ID[value] ?? value;
}

/**
 * Normalizes a full groupGoals array: maps recognized legacy literals to
 * canonical ids and de-duplicates (a document could theoretically have
 * ended up with both the literal and its canonical id if edited across the
 * consolidation boundary).
 */
export function normalizeGroupGoals(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeGroupGoalId(value);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}
