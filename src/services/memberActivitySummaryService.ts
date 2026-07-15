import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ActivityLogMetric } from './activityLogMetrics';
import type {
  ChallengeActivitySummary,
  GroupActivityFeedSummary,
  ChallengeLeaderboardSummary,
  GroupLeaderboardSummary,
  GroupMemberStatSummary,
} from '../types';

function toIso(input: unknown): string | undefined {
  if (!input) return undefined;
  if (typeof input === 'string') {
    const parsed = Date.parse(input);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
  }
  if (typeof input === 'number' && Number.isFinite(input)) {
    return new Date(input).toISOString();
  }
  if (typeof input === 'object') {
    const value = input as { toDate?: () => Date; seconds?: number };
    if (typeof value.toDate === 'function') {
      return value.toDate().toISOString();
    }
    if (typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000).toISOString();
    }
  }
  return undefined;
}

function formatRelativeTime(input: unknown): string {
  const iso = toIso(input);
  if (!iso) return 'Recently';
  const deltaMs = Date.now() - Date.parse(iso);
  const minutes = Math.floor(deltaMs / (60 * 1000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function shortUserLabel(uid: string, displayName?: string): string {
  if (displayName && displayName.trim().length > 0) return displayName;
  return `Member ${uid.slice(0, 6).toUpperCase()}`;
}

class MemberActivitySummaryService {
  readonly challengeSummariesCollection = 'challengeActivitySummaries';
  readonly groupFeedCollection = 'groupActivityFeed';
  readonly groupMemberStatsCollection = 'groupMemberStats';
  readonly groupLeaderboardsCollection = 'groupLeaderboards';
  readonly challengeLeaderboardsCollection = 'challengeLeaderboards';

  groupUserDocId(groupId: string, userId: string): string {
    return `${groupId}_${userId}`;
  }

  async getChallengeSummary(challengeId: string): Promise<ChallengeActivitySummary | null> {
    const snap = await getDoc(doc(db, this.challengeSummariesCollection, challengeId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<ChallengeActivitySummary, 'id'>) };
  }

  async getGroupFeed(groupId: string, pageSize = 20): Promise<GroupActivityFeedSummary[]> {
    const snap = await getDocs(
      query(
        collection(db, this.groupFeedCollection),
        where('groupId', '==', groupId),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
      ),
    );
    return snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<GroupActivityFeedSummary, 'id'>) }));
  }

  async getChallengeActivityLogs(challengeId: string, pageSize = 50): Promise<ActivityLogMetric[]> {
    const snap = await getDocs(
      query(
        collection(db, this.groupFeedCollection),
        where('challengeId', '==', challengeId),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
      ),
    );
    return snap.docs.map((item) => {
      const data = item.data() as Omit<GroupActivityFeedSummary, 'id'>;
      return {
        id: item.id,
        source: (data.source ?? 'wellness') as ActivityLogMetric['source'],
        userId: data.userId,
        challengeId: data.challengeId,
        groupId: data.groupId,
        value: Number(data.value ?? 0),
        score: Number(data.score ?? 0),
        completedAt: toIso(data.createdAt),
      };
    });
  }

  async getGroupMemberStats(groupId: string, pageSize = 100): Promise<GroupMemberStatSummary[]> {
    const snap = await getDocs(
      query(
        collection(db, this.groupMemberStatsCollection),
        where('groupId', '==', groupId),
        orderBy('score', 'desc'),
        limit(pageSize),
      ),
    );
    return snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<GroupMemberStatSummary, 'id'>) }));
  }

  async getGroupLeaderboard(groupId: string, pageSize = 20): Promise<GroupLeaderboardSummary[]> {
    const snap = await getDocs(
      query(
        collection(db, this.groupLeaderboardsCollection),
        where('groupId', '==', groupId),
        orderBy('score', 'desc'),
        limit(pageSize),
      ),
    );
    return snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<GroupLeaderboardSummary, 'id'>) }));
  }

  async getChallengeLeaderboard(challengeId: string, groupId: string, pageSize = 20): Promise<ChallengeLeaderboardSummary[]> {
    const snap = await getDocs(
      query(
        collection(db, this.challengeLeaderboardsCollection),
        where('challengeId', '==', challengeId),
        where('groupId', '==', groupId),
        orderBy('score', 'desc'),
        limit(pageSize),
      ),
    );
    return snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ChallengeLeaderboardSummary, 'id'>) }));
  }

  toFeedItem(item: GroupActivityFeedSummary) {
    return {
      id: item.id,
      author: shortUserLabel(item.userId, item.authorName),
      text: item.text,
      time: formatRelativeTime(item.createdAt),
      imageUrl: item.challengeCoverImageUrl,
      metric: {
        label: item.activityLabel,
        value: item.valueLabel,
      },
    };
  }
}

export const memberActivitySummaryService = new MemberActivitySummaryService();
export { formatRelativeTime as formatSummaryRelativeTime, toIso as summaryDateToIso };
