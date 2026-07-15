import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type FeedComment = {
  id: string;
  feedItemId: string;
  groupId: string;
  userId: string;
  authorName: string;
  authorPhotoURL?: string;
  text: string;
  createdAt: unknown;
  updatedAt?: unknown;
  replyCount?: number;
};

export type FeedReply = {
  id: string;
  feedItemId: string;
  commentId: string;
  groupId: string;
  userId: string;
  authorName: string;
  authorPhotoURL?: string;
  text: string;
  createdAt: unknown;
  updatedAt?: unknown;
};

export const MAX_COMMENT_LENGTH = 500;

function commentsCol(feedItemId: string) {
  return collection(db, 'groupActivityFeed', feedItemId, 'comments');
}

function repliesCol(feedItemId: string, commentId: string) {
  return collection(db, 'groupActivityFeed', feedItemId, 'comments', commentId, 'replies');
}

class FeedCommentService {
  async getComments(feedItemId: string): Promise<FeedComment[]> {
    const snap = await getDocs(query(commentsCol(feedItemId), orderBy('createdAt', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeedComment, 'id'>) }));
  }

  async addComment(
    feedItemId: string,
    groupId: string,
    text: string,
    userId: string,
    authorName: string,
    authorPhotoURL?: string,
  ): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) throw new Error('Invalid comment text');
    const payload: Record<string, unknown> = {
      feedItemId, groupId, userId, authorName,
      text: trimmed, replyCount: 0,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    if (authorPhotoURL) payload.authorPhotoURL = authorPhotoURL;
    await addDoc(commentsCol(feedItemId), payload);
  }

  async deleteOwnComment(feedItemId: string, commentId: string): Promise<void> {
    await deleteDoc(doc(db, 'groupActivityFeed', feedItemId, 'comments', commentId));
  }

  async getReplies(feedItemId: string, commentId: string): Promise<FeedReply[]> {
    const snap = await getDocs(query(repliesCol(feedItemId, commentId), orderBy('createdAt', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeedReply, 'id'>) }));
  }

  async addReply(
    feedItemId: string,
    commentId: string,
    groupId: string,
    text: string,
    userId: string,
    authorName: string,
    authorPhotoURL?: string,
  ): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) throw new Error('Invalid reply text');
    const payload: Record<string, unknown> = {
      feedItemId, commentId, groupId, userId, authorName,
      text: trimmed,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    if (authorPhotoURL) payload.authorPhotoURL = authorPhotoURL;
    await addDoc(repliesCol(feedItemId, commentId), payload);
  }

  async deleteOwnReply(feedItemId: string, commentId: string, replyId: string): Promise<void> {
    await deleteDoc(doc(db, 'groupActivityFeed', feedItemId, 'comments', commentId, 'replies', replyId));
  }
}

export const feedCommentService = new FeedCommentService();
