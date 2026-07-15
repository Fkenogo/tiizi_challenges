/**
 * Canonical Community Rules options, shared by CreateGroupScreen and
 * EditGroupScreen (previously each defined its own, divergent 6-item list —
 * same underlying problem as the pre-consolidation group taxonomy).
 *
 * Unlike groupGoals (which had an id-vs-literal-label divergence), both
 * screens' rule lists were already plain literal strings with genuinely
 * different wording — there is no canonical "id" layer to merge through, and
 * renaming one screen's wording to match the other's would silently change
 * text a real owner may have already selected and persisted. So this module
 * is the straightforward union of both screens' original lists (12 distinct
 * strings, no renaming, no semantic merging), plus a documented dedup
 * policy for user-typed custom rules.
 */

// Union of CreateGroupScreen's and EditGroupScreen's previous DEFAULT_RULES —
// every rule either screen ever offered as a selectable default.
export const DEFAULT_GROUP_RULES = [
  'Be respectful',
  'No spam',
  'Encourage others',
  'Log honestly',
  'Keep health information private',
  'No unsafe advice',
  'Be respectful and supportive',
  'No spam or self-promotion',
  'Keep activity logs honest',
  'Support fellow members',
  'Stay on topic',
  'Have fun and stay consistent',
] as const;

// CreateGroupScreen previously preselected its first 3 defaults
// ('Be respectful', 'No spam', 'Encourage others'). Preserved here as an
// explicit count against the new canonical (now 12-item) list so that
// intended initial behavior — a small, sensible starting set, not an
// overwhelming wall of checkboxes — is retained rather than silently
// reinterpreted as "preselect the first 3 of 12".
export const INITIAL_SELECTED_RULES: readonly string[] = DEFAULT_GROUP_RULES.slice(0, 3);

const CANONICAL_RULE_SET = new Set<string>(DEFAULT_GROUP_RULES);

/** Rules present on an existing group that aren't part of the canonical checkbox list — i.e. owner-typed custom rules. */
export function getCustomGroupRules(existingRules: string[]): string[] {
  return existingRules.filter((rule) => !CANONICAL_RULE_SET.has(rule));
}

/**
 * Case-insensitive, trim-based duplicate check for adding a custom rule.
 * Policy: two rules that differ only in case or surrounding whitespace are
 * considered the same rule (prevents "Be Kind" and "be kind " both existing).
 */
export function isDuplicateGroupRule(candidate: string, existingRules: string[]): boolean {
  const normalized = candidate.trim().toLowerCase();
  return existingRules.some((rule) => rule.trim().toLowerCase() === normalized);
}
