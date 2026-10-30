import type { V2GroupOptions } from '../../api/groupsApi';
import { GROUP_FOCUS_AREAS } from './groupFocusAreas';
import { GROUP_FOCUS_TAGS_MAX_COUNT, GROUP_FOCUS_TAG_MAX_LENGTH } from './groupDraft';

/**
 * TIIZI-FER-P4-001 — Group Interests (member copy for the stored `focus_tags`).
 *
 * Pure selection rules for the Settings chip selector. They mirror the caps the
 * Group authority already enforces (13 values, at most one value outside the
 * governed vocabulary, 30 characters each, no duplicates) and the Group
 * Wizard's behaviour; the server remains the authority. Values already stored
 * are never rewritten: legacy/custom values pass through untouched.
 */

export interface GroupInterestOption { domain: 'Fitness' | 'Wellness'; label: string }

/** Server vocabulary (`fetchGroupOptions`) when loaded, else the identical governed list the Wizard uses. */
export function interestVocabulary(options?: V2GroupOptions['focusAreas'] | null): GroupInterestOption[] {
  if (options && options.length > 0) return options.map(({ domain, label }) => ({ domain, label }));
  return GROUP_FOCUS_AREAS.map(({ domain, category }) => ({ domain, label: category }));
}

export type InterestIssue = 'too_many' | 'too_long' | 'too_many_custom' | 'duplicate';

/** Same selection regardless of order (re-toggling a chip must not read as an edit). */
export const sameInterestSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v) => b.includes(v));

export function customInterests(tags: readonly string[], vocabulary: readonly GroupInterestOption[]): string[] {
  const labels = new Set(vocabulary.map((option) => option.label));
  return tags.filter((tag) => !labels.has(tag));
}

/** Null when the selection may be saved. An untouched stored selection is always acceptable. */
export function interestIssue(
  tags: readonly string[],
  stored: readonly string[],
  vocabulary: readonly GroupInterestOption[],
): InterestIssue | null {
  if (sameInterestSet(tags, stored)) return null;
  if (tags.length > GROUP_FOCUS_TAGS_MAX_COUNT) return 'too_many';
  if (tags.some((tag) => tag.length > GROUP_FOCUS_TAG_MAX_LENGTH)) return 'too_long';
  if (new Set(tags.map((tag) => tag.toLocaleLowerCase())).size !== tags.length) return 'duplicate';
  if (customInterests(tags, vocabulary).length > 1) return 'too_many_custom';
  return null;
}

export const INTEREST_ISSUE_COPY: Record<InterestIssue, string> = {
  too_many: 'Choose up to 13 Group Interests.',
  too_long: 'Each Group Interest can be up to 30 characters.',
  duplicate: 'Each Group Interest can only be chosen once.',
  too_many_custom: 'Choose listed Group Interests, with at most one other Interest.',
};

export function toggleInterest(tags: readonly string[], label: string): string[] {
  return tags.includes(label) ? tags.filter((tag) => tag !== label) : [...tags, label];
}

/** Adds the single bounded "other" Interest; a no-op when blank, duplicate (any case) or one already exists. */
export function addCustomInterest(
  tags: readonly string[],
  input: string,
  vocabulary: readonly GroupInterestOption[],
): string[] {
  const value = input.trim().slice(0, GROUP_FOCUS_TAG_MAX_LENGTH);
  if (!value) return [...tags];
  const listed = vocabulary.find((option) => option.label.toLocaleLowerCase() === value.toLocaleLowerCase());
  if (listed) return tags.includes(listed.label) ? [...tags] : [...tags, listed.label];
  if (customInterests(tags, vocabulary).length > 0) return [...tags];
  if (tags.some((tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase())) return [...tags];
  return [...tags, value];
}
