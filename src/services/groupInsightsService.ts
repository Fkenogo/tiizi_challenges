import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Challenge, Workout } from '../types';

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
  status: 'joined' | 'pending' | 'rejected';
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
    query(collection(db, 'groupMembers'), where('groupId', '==', groupId), where('status', '==', 'joined')),
  );
  return membershipsSnap.docs.map((item) => item.data() as GroupMembershipDoc);
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
    const [workoutsSnap, memberships, challengeMap] = await Promise.all([
      getDocs(query(collection(db, 'workouts'), where('groupId', '==', groupId))),
      loadGroupMemberships(groupId),
      loadChallengesByGroup(groupId),
    ]);
    const workouts = workoutsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, 'id'>) }))
      .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
    const userMap = await loadUsersByIds(memberships.map((item) => item.userId));
    const exerciseMap = await loadExercisesByIds(workouts.map((item) => item.exerciseId));

    if (workouts.length > 0) {
      return workouts.slice(0, 10).map((w) => ({
        id: w.id,
        author: shortUserLabel(w.userId, userMap.get(w.userId)),
        text: `Completed ${w.value} ${w.unit} in ${challengeMap.get(w.challengeId)?.name || 'group challenge'}.`,
        time: formatRelativeTime(w.completedAt),
        imageUrl: challengeMap.get(w.challengeId)?.coverImageUrl,
        metric: {
          label: exerciseMap.get(w.exerciseId)?.name || 'Workout',
          value: `${w.value} ${w.unit}`,
        },
      }));
    }

    const challenges = Array.from(challengeMap.values())
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));

    return challenges.slice(0, 10).map((c) => ({
      id: c.id,
      author: shortUserLabel(c.createdBy, userMap.get(c.createdBy)),
      text: `Created challenge "${c.name}".`,
      time: formatRelativeTime(c.startDate),
    }));
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
        streak: `${Math.min(Math.max(count, 1), 30)}d streak`,
      };
    });
  }

  async getGroupLeaderboard(groupId: string): Promise<GroupLeaderboardEntry[]> {
    const [workoutsSnap, memberships] = await Promise.all([
      getDocs(query(collection(db, 'workouts'), where('groupId', '==', groupId))),
      loadGroupMemberships(groupId),
    ]);
    const workouts = workoutsSnap.docs.map((d) => d.data() as Omit<Workout, 'id'>);
    const userMap = await loadUsersByIds(memberships.map((item) => item.userId));

    const scores = new Map<string, number>();
    workouts.forEach((w) => {
      scores.set(w.userId, (scores.get(w.userId) ?? 0) + Math.max(1, Math.round(w.value)));
    });

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
