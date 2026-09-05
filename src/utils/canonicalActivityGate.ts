/**
 * Creation-boundary canonical Knowledge gate (P2-1).
 *
 * Used by direct-write creation paths (challengeService.createChallenge,
 * adminChallengeService.createChallengeFromAdmin). The Cloud Function backend
 * enforces the same invariant server-side for the callable path.
 *
 * Rule: an activity entry that references a canonical record
 * (catalogExercises / wellnessActivities doc) may only be used for a NEW
 * challenge when that record is published (legacy records without lifecycle
 * state count as published). Entries that resolve to no canonical record
 * (custom/manual entries, local fallback IDs) carry no canonical claim and
 * are preserved as-is — historical snapshots are never re-validated.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isBlockedCanonicalStatus } from './knowledgeLifecycle';

export interface CanonicalActivityRef {
  exerciseId?: string;
  activityId?: string;
}

/**
 * Returns the referenced canonical IDs that are NOT available for new
 * challenges (draft or retired). Empty array = clear to create.
 */
export async function findBlockedCanonicalActivities(
  activities: CanonicalActivityRef[],
): Promise<string[]> {
  const blocked: string[] = [];
  for (const activity of activities ?? []) {
    const exerciseId = activity?.exerciseId?.trim();
    if (exerciseId) {
      const snap = await getDoc(doc(db, 'catalogExercises', exerciseId));
      if (
        snap.exists() &&
        isBlockedCanonicalStatus(
          (snap.data() as { lifecycleStatus?: string | null }).lifecycleStatus,
        )
      ) {
        blocked.push(exerciseId);
      }
      continue;
    }
    const activityId = activity?.activityId?.trim();
    if (activityId) {
      const snap = await getDoc(doc(db, 'wellnessActivities', activityId));
      if (
        snap.exists() &&
        isBlockedCanonicalStatus(
          (snap.data() as { lifecycleStatus?: string | null }).lifecycleStatus,
        )
      ) {
        blocked.push(activityId);
      }
    }
  }
  return blocked;
}

/**
 * Throws when any referenced canonical Activity is unavailable for new
 * challenges. Message names the blocked IDs for the caller to surface.
 */
export async function assertCanonicalActivitiesAvailable(
  activities: CanonicalActivityRef[],
): Promise<void> {
  const blocked = await findBlockedCanonicalActivities(activities);
  if (blocked.length > 0) {
    throw new Error(
      `These activities are no longer available for new challenges (retired or draft): ${blocked.join(', ')}. Please replace them.`,
    );
  }
}
