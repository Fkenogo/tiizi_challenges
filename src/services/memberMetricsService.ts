import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type MemberHomePrimaryChallenge = {
  id: string;
  name: string;
  season: string;
  level: string;
  progress: number;
  progressLabel: string;
  day: number;
  totalDays: number;
  groupId?: string;
  challengeType: 'collective' | 'competitive' | 'streak';
  actionLabel: 'Log Workout' | 'Log Activity';
};

export type UserMetrics = {
  userId: string;
  totalWorkouts: number;
  totalWellnessLogs: number;
  totalActivitiesLogged: number;
  workouts7d: number;
  workouts30d: number;
  wellness7d: number;
  wellness30d: number;
  currentStreak: number;
  longestStreak: number;
  activeChallengesCount: number;
  completedChallengesCount: number;
  joinedGroupsCount: number;
  lastActivityAt?: string;
  updatedAt?: string;
  generatedBy?: string;
  sourceVersion?: string;
};

export type MemberHomeSummary = {
  userId: string;
  primaryActiveChallenge: MemberHomePrimaryChallenge | null;
  activeChallengeCount: number;
  completedChallengeCount: number;
  joinedGroupCount: number;
  recentActivityCount: number;
  generatedAt?: string;
  generatedBy?: string;
  sourceVersion?: string;
};

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
    const value = input as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1_000_000)).toISOString();
    }
  }
  return undefined;
}

function numberValue(input: unknown): number {
  const parsed = typeof input === 'number' ? input : Number(input ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapUserMetrics(uid: string, data: Record<string, unknown>): UserMetrics {
  return {
    userId: String(data.userId ?? uid),
    totalWorkouts: numberValue(data.totalWorkouts),
    totalWellnessLogs: numberValue(data.totalWellnessLogs),
    totalActivitiesLogged: numberValue(data.totalActivitiesLogged),
    workouts7d: numberValue(data.workouts7d),
    workouts30d: numberValue(data.workouts30d),
    wellness7d: numberValue(data.wellness7d),
    wellness30d: numberValue(data.wellness30d),
    currentStreak: numberValue(data.currentStreak),
    longestStreak: numberValue(data.longestStreak),
    activeChallengesCount: numberValue(data.activeChallengesCount),
    completedChallengesCount: numberValue(data.completedChallengesCount),
    joinedGroupsCount: numberValue(data.joinedGroupsCount),
    lastActivityAt: toIso(data.lastActivityAt),
    updatedAt: toIso(data.updatedAt),
    generatedBy: typeof data.generatedBy === 'string' ? data.generatedBy : undefined,
    sourceVersion: typeof data.sourceVersion === 'string' ? data.sourceVersion : undefined,
  };
}

function mapMemberHome(uid: string, data: Record<string, unknown>): MemberHomeSummary {
  const primaryActiveChallenge = data.primaryActiveChallenge && typeof data.primaryActiveChallenge === 'object'
    ? data.primaryActiveChallenge as MemberHomePrimaryChallenge
    : null;
  return {
    userId: String(data.userId ?? uid),
    primaryActiveChallenge,
    activeChallengeCount: numberValue(data.activeChallengeCount),
    completedChallengeCount: numberValue(data.completedChallengeCount),
    joinedGroupCount: numberValue(data.joinedGroupCount),
    recentActivityCount: numberValue(data.recentActivityCount),
    generatedAt: toIso(data.generatedAt),
    generatedBy: typeof data.generatedBy === 'string' ? data.generatedBy : undefined,
    sourceVersion: typeof data.sourceVersion === 'string' ? data.sourceVersion : undefined,
  };
}

export const memberMetricsService = {
  async getUserMetrics(uid: string): Promise<UserMetrics | null> {
    const snap = await getDoc(doc(db, 'userMetrics', uid));
    if (!snap.exists()) return null;
    return mapUserMetrics(uid, snap.data());
  },

  async getMemberHome(uid: string): Promise<MemberHomeSummary | null> {
    const snap = await getDoc(doc(db, 'memberHome', uid));
    if (!snap.exists()) return null;
    return mapMemberHome(uid, snap.data());
  },
};
