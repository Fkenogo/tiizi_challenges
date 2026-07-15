import { collection, DocumentReference, getDocs, query, Timestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { chunkArray, MAX_WRITES_PER_BATCH } from './collectiveCompletionUtils';

export { chunkArray, MAX_WRITES_PER_BATCH } from './collectiveCompletionUtils';

/**
 * Marks all active members of a collective challenge as 'completed', chunked
 * into sequential batches of MAX_WRITES_PER_BATCH to stay within Firestore's
 * 500-write-per-batch limit.
 *
 * Call this AFTER the primary batch (challenge doc + triggering member) commits.
 * Members already 'completed' are excluded by the query filter (idempotent).
 * The triggering member's ref is also excluded as a safety belt (their status
 * was set to 'completed' in the primary batch).
 *
 * If any batch fails the function throws immediately and logs the failure.
 * Partial completion is recoverable: a re-run re-queries 'active' members
 * and only updates those not yet marked.
 */
export async function cascadeCollectiveCompletion(
  challengeId: string,
  excludeRef: DocumentReference,
): Promise<void> {
  const activeMembersSnap = await getDocs(
    query(
      collection(db, 'challengeMembers'),
      where('challengeId', '==', challengeId),
      where('status', '==', 'active'),
    ),
  );

  const otherDocs = activeMembersSnap.docs.filter((d) => d.ref.path !== excludeRef.path);
  if (otherDocs.length === 0) return;

  const completedAt = Timestamp.now();
  const chunks = chunkArray(otherDocs, MAX_WRITES_PER_BATCH);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkBatch = writeBatch(db);
    for (const memberDoc of chunk) {
      chunkBatch.set(memberDoc.ref, { status: 'completed', completedAt }, { merge: true });
    }
    try {
      await chunkBatch.commit();
    } catch (err) {
      console.error(
        '[cascadeCollectiveCompletion] batch commit failed — stopping cascade',
        {
          challengeId,
          batchIndex: i,
          batchSize: chunk.length,
          totalBatches: chunks.length,
          message: (err as Error).message,
        },
      );
      throw err;
    }
  }
}
