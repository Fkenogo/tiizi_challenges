/**
 * Shared Create/Edit group validation rules. Both screens previously
 * enforced different minimums (Create: name >= 3, description >= 10; Edit:
 * name non-empty only), which let an existing valid group be edited into a
 * state Create would have rejected outright. Both screens now import this
 * single rule so they cannot drift again.
 */

export const MIN_GROUP_NAME_LENGTH = 3;
export const MIN_GROUP_DESCRIPTION_LENGTH = 10;
// CreateGroupScreen previously capped at 50/240, EditGroupScreen at 60/300 —
// the two had already diverged. Canonicalizing on the larger pair so no
// existing group (created via either screen) becomes un-re-saveable.
export const MAX_GROUP_NAME_LENGTH = 60;
export const MAX_GROUP_DESCRIPTION_LENGTH = 300;

export function isValidGroupDraft(name: string, description: string): boolean {
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  return (
    trimmedName.length >= MIN_GROUP_NAME_LENGTH &&
    trimmedName.length <= MAX_GROUP_NAME_LENGTH &&
    trimmedDescription.length >= MIN_GROUP_DESCRIPTION_LENGTH &&
    trimmedDescription.length <= MAX_GROUP_DESCRIPTION_LENGTH
  );
}
