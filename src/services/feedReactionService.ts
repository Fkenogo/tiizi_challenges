import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type ReactionType = 'like' | 'applaud' | 'inspired';

export type ReactionSummary = {
  counts: { like: number; applaud: number; inspired: number };
  userReaction?: ReactionType;
};

function reactionsCol(feedItemId: string) {
  return collection(db, 'groupActivityFeed', feedItemId, 'reactions');
}

function reactionDoc(feedItemId: string, userId: string) {
  return doc(db, 'groupActivityFeed', feedItemId, 'reactions', userId);
}

class FeedReactionService {
  async getReactionSummaries(
    feedItemIds: string[],
    currentUserId: string,
  ): Promise<Map<string, ReactionSummary>> {
    if (feedItemIds.length === 0) return new Map();

    const snaps = await Promise.all(
      feedItemIds.map((id) => getDocs(reactionsCol(id)).then((s) => ({ id, s }))),
    );

    const out = new Map<string, ReactionSummary>();
    for (const { id, s } of snaps) {
      const counts: ReactionSummary['counts'] = { like: 0, applaud: 0, inspired: 0 };
      let userReaction: ReactionType | undefined;
      for (const d of s.docs) {
        const rt = d.data().reactionType as ReactionType;
        if (rt in counts) counts[rt]++;
        if (d.id === currentUserId) userReaction = rt;
      }
      out.set(id, { counts, userReaction });
    }
    return out;
  }

  async setReaction(
    feedItemId: string,
    groupId: string,
    userId: string,
    reactionType: ReactionType,
  ): Promise<void> {
    await setDoc(reactionDoc(feedItemId, userId), {
      feedItemId,
      groupId,
      userId,
      reactionType,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  async clearReaction(feedItemId: string, userId: string): Promise<void> {
    await deleteDoc(reactionDoc(feedItemId, userId));
  }
}

export const feedReactionService = new FeedReactionService();
