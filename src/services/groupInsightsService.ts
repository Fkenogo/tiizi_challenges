import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Challenge, WellnessLog, Workout } from '../types';

export type GroupFeedItem = {
  id: string;
  author: string;
  text: string;
  time: string;
  imageUrl?: string;
  metric?: {
    label: string;
    value: string;
  };
};

export type GroupMemberItem = {
  id: string;
  name: string;
  role: 'Coach' | 'Member';
  streak: string;
  joinedAt?: string;
};

export type GroupLeaderboardEntry = {
  rank: number;
  name: string;
  score: number;
};

function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'Recently';
  const deltaMs = Date.now() - ts;
  const minutes = Math.floor(deltaMs / (60 * 1000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

type GroupMembershipDoc = {
  groupId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  status: 'joined' | 'active' | 'pending' | 'rejected';
  createdAt?: string;
};

type UserDoc = {
  email?: string;
  profile?: {
    personalInfo?: {
      fullName?: string;
      displayName?: string;
    };
  };
};

type ExerciseDoc = {
  name?: string;
};

function shortUserLabel(uid: string, user?: UserDoc): string {
  const displayName =
    user?.profile?.personalInfo?.displayName ||
    user?.profile?.personalInfo?.fullName ||
    user?.email?.split('@')[0];
  if (displayName && displayName.trim().length > 0) return displayName;
  return `Member ${uid.slice(0, 6).toUpperCase()}`;
}

async function loadGroupMemberships(groupId: string): Promise<GroupMembershipDoc[]> {
  const membershipsSnap = await getDocs(
    query(collection(db, 'groupMembers'), where('groupId', '==', groupId)),
  );
  return membershipsSnap.docs
    .map((item) => item.data() as GroupMembershipDoc)
    .filter((membership) => membership.status === 'joined' || membership.status === 'active');
}

async function loadUsersByIds(userIds: string[]): Promise<Map<string, UserDoc>> {
  const unique = Array.from(new Set(userIds));
  const docs = await Promise.all(unique.map((uid) => getDoc(doc(db, 'users', uid))));
  const userMap = new Map<string, UserDoc>();
  docs.forEach((snap, idx) => {
    if (snap.exists()) {
      userMap.set(unique[idx], snap.data() as UserDoc);
    }
  });
  return userMap;
}

async function loadChallengesByGroup(groupId: string): Promise<Map<string, Challenge>> {
  const challengesSnap = await getDocs(query(collection(db, 'challenges'), where('groupId', '==', groupId)));
  const challengeMap = new Map<string, Challenge>();
  challengesSnap.docs.forEach((item) => {
    challengeMap.set(item.id, { id: item.id, ...(item.data() as Omit<Challenge, 'id'>) });
  });
  return challengeMap;
}

async function loadExercisesByIds(exerciseIds: string[]): Promise<Map<string, ExerciseDoc>> {
  const unique = Array.from(new Set(exerciseIds));
  if (unique.length === 0) return new Map();
  const docs = await Promise.all(unique.map((id) => getDoc(doc(db, 'catalogExercises', id))));
  const exerciseMap = new Map<string, ExerciseDoc>();
  docs.forEach((snap, index) => {
    if (snap.exists()) {
      exerciseMap.set(unique[index], snap.data() as ExerciseDoc);
    }
  });
  return exerciseMap;
}

class GroupInsightsService {
  async getHighlightedChallenges(groupId: string): Promise<Challenge[]> {
    const q = query(collection(db, 'challenges'), where('groupId', '==', groupId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }))
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate))
      .slice(0, 3);
  }

  async getGroupFeed(groupId: string): Promise<GroupFeedItem[]> {
    // wellnessLogs requires the Firestore rule to allow isGroupMember reads (fixed in Phase 18I-5A-R).
    // If the wellness query fails (e.g. rules not yet deployed, index not yet built), we fall back
    // to an empty list so workout feed items still appear — never let one query kill the whole feed.
    const [workoutsSnap, wellnessResult, memberships, challengeMap] = await Promise.all([
      getDocs(query(
        collection(db, 'workouts'),
        where('groupId', '==', groupId),
        orderBy('completedAt', 'desc'),
        limit(10),
      )),
      getDocs(query(
        collection(db, 'wellnessLogs'),
        where('groupId', '==', groupId),
        orderBy('loggedAt', 'desc'),
        limit(10),
      )).catch((err: unknown) => {
        console.error('[getGroupFeed] wellnessLogs query failed — check security rules and index deployment:', err);
        return null;
      }),
      loadGroupMemberships(groupId),
      loadChallengesByGroup(groupId),
    ]);
    const workouts = workoutsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, 'id'>) }));
    const wellnessLogs = (wellnessResult?.docs ?? []).map((d) => {
      const data = d.data() as Omit<WellnessLog, 'id'>;
      // loggedAt is stored as ISO string going forward (wellnessLogService fix). Older docs
      // stored a Firestore Timestamp — convert defensively so Date.parse() always gets a string.
      const rawLoggedAt = data.loggedAt as unknown;
      const loggedAt =
        typeof rawLoggedAt === 'string'
          ? rawLoggedAt
          : rawLoggedAt != null && typeof (rawLoggedAt as { toDate?: unknown }).toDate === 'function'
            ? (rawLoggedAt as { toDate: () => Date }).toDate().toISOString()
            : '';
      return { id: d.id, ...data, loggedAt };
    });

    const allUserIds = Array.from(new Set([
      ...memberships.map((m) => m.userId),
      ...workouts.map((w) => w.userId),
      ...wellnessLogs.map((wl) => wl.userId),
    ]));
    const [userMap, exerciseMap] = await Promise.all([
      loadUsersByIds(allUserIds),
      loadExercisesByIds(workouts.map((w) => w.exerciseId)),
    ]);

    const hasActivity = workouts.length > 0 || wellnessLogs.length > 0;

    if (!hasActivity) {
      const challenges = Array.from(challengeMap.values())
        .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
      return challenges.slice(0, 10).map((c) => ({
        id: c.id,
        author: shortUserLabel(c.createdBy, userMap.get(c.createdBy)),
        text: `Created challenge "${c.name}".`,
        time: formatRelativeTime(c.startDate),
      }));
    }

    type RawItem = { id: string; ts: number; item: GroupFeedItem };

    const workoutItems: RawItem[] = workouts.map((w) => ({
      id: `workout:${w.id}`,
      ts: Date.parse(w.completedAt) || 0,
      item: {
        id: w.id,
        author: shortUserLabel(w.userId, userMap.get(w.userId)),
        text: `Logged ${w.value} ${w.unit} for ${challengeMap.get(w.challengeId)?.name || 'group challenge'}.`,
        time: formatRelativeTime(w.completedAt),
        imageUrl: challengeMap.get(w.challengeId)?.coverImageUrl,
        metric: {
          label: exerciseMap.get(w.exerciseId)?.name || 'Workout',
          value: `${w.value} ${w.unit}`,
        },
      },
    }));

    const logTypeLabel: Record<string, string> = {
      fasting: 'Fasting',
      hydration: 'Hydration',
      sleep: 'Sleep',
      meditation: 'Meditation',
    };

    const wellnessItems: RawItem[] = wellnessLogs.map((wl) => ({
      id: `wellness:${wl.id}`,
      ts: Date.parse(wl.loggedAt) || 0,
      item: {
        id: wl.id,
        author: shortUserLabel(wl.userId, userMap.get(wl.userId)),
        text: `Logged ${wl.value} ${wl.unit} in ${challengeMap.get(wl.challengeId)?.name || 'group challenge'}.`,
        time: formatRelativeTime(wl.loggedAt),
        imageUrl: challengeMap.get(wl.challengeId)?.coverImageUrl,
        metric: {
          label: logTypeLabel[wl.logType] ?? 'Wellness',
          value: `${wl.value} ${wl.unit}`,
        },
      },
    }));

    // Deduplicate by composite key, sort newest first, limit to 10.
    const seen = new Set<string>();
    return [...workoutItems, ...wellnessItems]
      .filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 10)
      .map((r) => r.item);
  }

  async getGroupMembers(groupId: string): Promise<GroupMemberItem[]> {
    const [workoutsSnap, memberships] = await Promise.all([
      getDocs(query(collection(db, 'workouts'), where('groupId', '==', groupId))),
      loadGroupMemberships(groupId),
    ]);

    const workouts = workoutsSnap.docs.map((d) => d.data() as Omit<Workout, 'id'>);
    const workoutCountByUser = new Map<string, number>();
    workouts.forEach((w) => {
      workoutCountByUser.set(w.userId, (workoutCountByUser.get(w.userId) ?? 0) + 1);
    });

    const userIds = memberships.map((item) => item.userId);
    const membershipMap = new Map(memberships.map((item) => [item.userId, item]));
    const userMap = await loadUsersByIds(userIds);

    return userIds.map((uid) => {
      const count = workoutCountByUser.get(uid) ?? 0;
      const membership = membershipMap.get(uid);
      const role = membership?.role === 'owner' || membership?.role === 'admin' ? 'Coach' : 'Member';
      return {
        id: uid,
        name: shortUserLabel(uid, userMap.get(uid)),
        role,
        streak: `${count} log${count === 1 ? '' : 's'}`,
        joinedAt: membership?.createdAt,
      };
    });
  }

  async getGroupLeaderboard(groupId: string): Promise<GroupLeaderboardEntry[]> {
    const challengeMembersSnap = await getDocs(
      query(collection(db, 'challengeMembers'), where('groupId', '==', groupId)),
    );
    const memberDocs = challengeMembersSnap.docs.map((d) => d.data() as { userId: string; totalPoints?: number });

    const scores = new Map<string, number>();
    memberDocs.forEach((m) => {
      scores.set(m.userId, (scores.get(m.userId) ?? 0) + Math.max(0, Math.round(Number(m.totalPoints ?? 0))));
    });

    const userIds = Array.from(scores.keys());
    const userMap = await loadUsersByIds(userIds);

    return Array.from(scores.entries())
      .map(([uid, score]) => ({ uid, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((entry, idx) => ({
        rank: idx + 1,
        name: shortUserLabel(entry.uid, userMap.get(entry.uid)),
        score: entry.score,
      }));
  }
}

export const groupInsightsService = new GroupInsightsService();
