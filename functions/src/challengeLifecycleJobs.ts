import { logger } from 'firebase-functions';
import { type Firestore } from 'firebase-admin/firestore';

/**
 * Finds challenges with status === 'active' whose endDate is in the past
 * and transitions them to status === 'completed'.
 *
 * When this write lands, the onChallengeUpdated Firestore trigger fires,
 * which calls updateActiveChallengeCountForUpdate — decrementing
 * group.activeChallenges by 1 for each completed challenge
 * (ACTIVE_CHALLENGE_STATUSES = Set(['active']), so active→completed is a -1 delta).
 *
 * Returns the number of challenges completed.
 */
export async function expireEndedChallenges(db: Firestore): Promise<number> {
  const nowIso = new Date().toISOString();

  // Firestore does not support inequality filters on two different fields without
  // a composite index on (status, endDate). We query by status first, then filter
  // by endDate in memory. Active challenges are rare (O(10s–100s) at pilot scale)
  // so the full scan is safe.
  const snap = await db
    .collection('challenges')
    .where('status', '==', 'active')
    .get();

  if (snap.empty) return 0;

  const expiredDocs = snap.docs.filter((d) => {
    const endDate = String(d.data().endDate ?? '');
    return endDate.length > 0 && endDate < nowIso;
  });

  if (expiredDocs.length === 0) return 0;

  // Batch writes — max 500 per batch; split if needed
  const BATCH_SIZE = 400;
  let expired = 0;

  for (let i = 0; i < expiredDocs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = expiredDocs.slice(i, i + BATCH_SIZE);
    for (const d of chunk) {
      batch.update(d.ref, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        lifecycleCompletedBy: 'scheduled-function',
        previousStatus: 'active',
      });
    }
    await batch.commit();
    expired += chunk.length;
  }

  logger.info('expireEndedChallenges: auto-completed challenges', {
    count: expired,
    challengeIds: expiredDocs.map((d) => d.id),
  });

  return expired;
}
