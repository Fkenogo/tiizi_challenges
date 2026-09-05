/**
 * Creation-boundary canonical Knowledge gate (P2-1, CORR-1).
 *
 * A supplied exerciseId/activityId is a canonical identity claim and MUST
 * resolve to its canonical Firestore document:
 *   - exerciseId → catalogExercises must exist and be published;
 *   - activityId → wellnessActivities must exist and be published.
 * Legacy records without lifecycle state count as published. Custom/manual
 * entries are permitted ONLY when they carry NO canonical ID — a dangling
 * ID is never silently converted to custom. Historical snapshots are never
 * re-validated.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isBlockedCanonicalStatus } from './knowledgeLifecycle';

export interface CanonicalActivityRef {
  exerciseId?: string;
  activityId?: string;
}

/**
 * Returns referenced canonical IDs that must block creation: missing
 * documents plus draft/retired records. Empty array = clear to create.
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
        !snap.exists() ||
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
        !snap.exists() ||
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
      `These activities cannot start a new challenge (missing, retired, or draft canonical record): ${blocked.join(', ')}. Please replace them.`,
    );
  }
}
