import { doc, runTransaction, updateDoc, Timestamp } from 'firebase/firestore';
import type { DocumentReference } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cascadeCollectiveCompletion } from './collectiveCompletion';
import { computeGroupTransition } from '../utils/collectiveGroupTransition';
import type { GroupTransitionInput, GroupTransitionResult } from '../utils/collectiveGroupTransition';

// Re-export types and the pure function so callers have a single import surface.
export type { GroupTransitionInput, GroupTransitionResult } from '../utils/collectiveGroupTransition';
export { computeGroupTransition };

/**
 * Atomically increments groupCurrentTotal and triggers exactly-one completion
 * when the new total meets or exceeds groupCumulativeTarget (BUG-001 fix).
 *
 * A Firestore transaction ensures that concurrent log writes cannot both read a
 * sub-threshold total and both skip the cascade. The transaction retries on
 * conflict; the first writer to commit completion wins; subsequent retries read
 * status='completed' and exit without mutation.
 *
 * groupCurrentTotal preserves overshoot — the stored value may exceed the target (V2).
 *
 * @param challengeId         - Challenge document ID
 * @param delta               - Raw logged value to add to the group pool
 * @param triggeringMemberRef - The logging member's challengeMembers document ref
 */
export async function atomicCollectiveGroupUpdate(
  challengeId: string,
  delta: number,
  triggeringMemberRef: DocumentReference,
): Promise<{ wasAlreadyCompleted: boolean; nowCompleted: boolean }> {
  const challengeRef = doc(db, 'challenges', challengeId);
  let result: GroupTransitionResult = { isAlreadyCompleted: false, actualTotal: 0, shouldComplete: false };

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(challengeRef);
    if (!snap.exists()) throw new Error(`Challenge ${challengeId} not found`);

    result = computeGroupTransition(snap.data() as GroupTransitionInput, delta);

    // Already completed — exit without any writes so the transaction is a no-op.
    if (result.isAlreadyCompleted) return;

    const writePayload: Record<string, unknown> = { groupCurrentTotal: result.actualTotal };
    if (result.shouldComplete) {
      writePayload.status = 'completed';
      writePayload.completedAt = Timestamp.now();
    }
    tx.update(challengeRef, writePayload);
  });

  const triggered = result.shouldComplete && !result.isAlreadyCompleted;

  if (triggered) {
    // Mark the triggering member completed, then fan out to remaining active members.
    // Both writes happen after the transaction commits — the challenge status is the
    // authoritative completion gate; these are follow-up propagations.
    await updateDoc(triggeringMemberRef, { status: 'completed', completedAt: Timestamp.now() });
    await cascadeCollectiveCompletion(challengeId, triggeringMemberRef);
  }

  return { wasAlreadyCompleted: result.isAlreadyCompleted, nowCompleted: triggered };
}
