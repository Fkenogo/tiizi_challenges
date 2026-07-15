/**
 * Named rule for when a group's focus metadata counts as "materially
 * incomplete" for the purpose of the owner-only nudge in GroupDetailsModal.
 *
 * Rule: a group is materially incomplete when it has no groupType AND no
 * activity/wellness/goal data at all. locationScope alone does not count
 * toward completeness (it's a minor detail, not the group's stated
 * purpose), so a group with only a Scope set is still considered
 * materially incomplete and will still see the nudge — this intentionally
 * differs from the modal's separate "Group Focus" *display* section (which
 * shows Type and/or Scope independently, whichever is present).
 *
 * This does NOT fire merely because one optional category (e.g. Wellness
 * Topics) is empty while others are populated — a group that deliberately
 * only uses e.g. Group Type + Activities is not nagged.
 */

import type { Group } from '../../types';

export function isGroupMetadataMateriallyIncomplete(
  group: Pick<Group, 'groupType' | 'activityInterests' | 'wellnessTopics' | 'groupGoals'>,
): boolean {
  const hasType = !!group.groupType;
  const hasActivities = (group.activityInterests?.length ?? 0) > 0;
  const hasWellness = (group.wellnessTopics?.length ?? 0) > 0;
  const hasGoals = (group.groupGoals?.length ?? 0) > 0;
  return !hasType && !hasActivities && !hasWellness && !hasGoals;
}
