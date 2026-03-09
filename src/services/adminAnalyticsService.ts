import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Challenge, Group, Workout } from '../types';

export type AdminOverviewMetrics = {
  totalUsers: number;
  activeUsers7d: number;
  totalExercises: number;
  activeChallenges: number;
  totalWorkouts: number;
  totalGroups: number;
  recentActivity: Array<{ id: string; message: string; at: string }>;
};

export type UserGrowthPoint = {
  date: string;
  signups: number;
  cumulativeUsers: number;
};

export type AdminEngagementMetrics = {
  dau: number;
  wau: number;
  mau: number;
  workoutsLast30d: number;
  avgWorkoutsPerActiveUser30d: number;
  challengeParticipationUsers30d: number;
  groupActiveUsers30d: number;
};

export type AdminRevenueMetrics = {
  totalDonations: number;
  donations30d: number;
  averageDonation: number;
  activeCampaigns: number;
};

function isRecent(iso: string | undefined, days: number): boolean {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return false;
  const delta = Date.now() - ts;
  return delta <= days * 24 * 60 * 60 * 1000;
}

function parseDateLike(input: unknown): number | null {
  if (!input) return null;
  if (typeof input === 'string') {
    const parsed = Date.parse(input);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : null;
  }
  if (typeof input === 'object') {
    const value = input as { toDate?: () => Date; seconds?: number };
    if (typeof value.toDate === 'function') {
      const date = value.toDate();
      const parsed = date.getTime();
      return Number.isNaN(parsed) ? null : parsed;
    }
    if (typeof value.seconds === 'number') {
      return value.seconds * 1000;
    }
  }
  return null;
}

function toIso(input: unknown): string | undefined {
  const ts = parseDateLike(input);
  if (ts == null) return undefined;
  return new Date(ts).toISOString();
}

function shortId(id: string): string {
  return id.slice(0, 6).toUpperCase();
}

class AdminAnalyticsService {
  async getOverviewMetrics(): Promise<AdminOverviewMetrics> {
    const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [usersCountSnap, exercisesCountSnap, challengesCountSnap, activeChallengesCountSnap, workoutsCountSnap, groupsCountSnap, workouts7dSnap, recentWorkoutsSnap, recentChallengesSnap, recentGroupsSnap] = await Promise.all([
      getCountFromServer(collection(db, 'users')),
      getCountFromServer(collection(db, 'catalogExercises')),
      getCountFromServer(collection(db, 'challenges')),
      getCountFromServer(query(collection(db, 'challenges'), where('status', '==', 'active'))),
      getCountFromServer(collection(db, 'workouts')),
      getCountFromServer(collection(db, 'groups')),
      getDocs(query(collection(db, 'workouts'), where('completedAt', '>=', sevenDaysAgoIso))),
      getDocs(query(collection(db, 'workouts'), orderBy('completedAt', 'desc'), limit(4))),
      getDocs(query(collection(db, 'challenges'), orderBy('startDate', 'desc'), limit(3))),
      getDocs(query(collection(db, 'groups'), orderBy('createdAt', 'desc'), limit(2))),
    ]);

    const workouts7d = workouts7dSnap.docs.map((d) => d.data() as Omit<Workout, 'id'>);
    const recentWorkouts = recentWorkoutsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, 'id'>) }));
    const recentChallenges = recentChallengesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }));
    const recentGroups = recentGroupsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Group, 'id'>) }));

    const activeUsers7d = new Set(
      workouts7d
        .filter((w) => isRecent(toIso((w as unknown as Record<string, unknown>).completedAt), 7))
        .map((w) => w.userId),
    ).size;

    const recentActivity = [
      ...recentWorkouts.map((w) => ({
        id: `workout-${w.id}`,
        message: `Workout logged by user ${shortId(w.userId)} (${w.value} ${w.unit})`,
        at: toIso((w as unknown as Record<string, unknown>).completedAt) || new Date().toISOString(),
      })),
      ...recentChallenges.map((c) => ({
        id: `challenge-${c.id}`,
        message: `Challenge created: ${c.name}`,
        at: toIso((c as unknown as Record<string, unknown>).startDate) || new Date().toISOString(),
      })),
      ...recentGroups.map((g) => ({
        id: `group-${g.id}`,
        message: `Group created: ${g.name}`,
        at: toIso((g as unknown as Record<string, unknown>).createdAt) || new Date().toISOString(),
      })),
    ]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 8);

    return {
      totalUsers: usersCountSnap.data().count,
      activeUsers7d,
      totalExercises: exercisesCountSnap.data().count,
      activeChallenges: activeChallengesCountSnap.data().count,
      totalWorkouts: workoutsCountSnap.data().count,
      totalGroups: groupsCountSnap.data().count,
      recentActivity,
    };
  }

  async getUserGrowth(days = 30): Promise<UserGrowthPoint[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const startIso = start.toISOString();

    const usersSnap = await getDocs(query(collection(db, 'users'), where('createdAt', '>=', startIso)));
    const users = usersSnap.docs.map((d) => d.data() as { createdAt?: unknown });

    const buckets = new Map<string, number>();
    for (let i = 0; i < days; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = date.toISOString().slice(0, 10);
      buckets.set(key, 0);
    }

    users.forEach((u) => {
      const iso = toIso(u.createdAt);
      if (!iso) return;
      const key = iso.slice(0, 10);
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    });

    let cumulative = 0;
    return Array.from(buckets.entries()).map(([date, signups]) => {
      cumulative += signups;
      return { date, signups, cumulativeUsers: cumulative };
    });
  }

  async getEngagementMetrics(): Promise<AdminEngagementMetrics> {
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [workoutSnap, challengeSnap] = await Promise.all([
      getDocs(query(collection(db, 'workouts'), where('completedAt', '>=', thirtyDaysAgoIso))),
      getDocs(query(collection(db, 'challenges'), where('startDate', '>=', thirtyDaysAgoIso))),
    ]);

    const workouts = workoutSnap.docs.map((d) => d.data() as Omit<Workout, 'id'>);
    const challenges = challengeSnap.docs.map((d) => d.data() as Omit<Challenge, 'id'>);

    const users1d = new Set<string>();
    const users7d = new Set<string>();
    const users30d = new Set<string>();
    const challengeParticipants30d = new Set<string>();
    const groupUsers30d = new Set<string>();

    workouts.forEach((w) => {
      const completedIso = toIso((w as unknown as Record<string, unknown>).completedAt);
      if (isRecent(completedIso, 1)) users1d.add(w.userId);
      if (isRecent(completedIso, 7)) users7d.add(w.userId);
      if (isRecent(completedIso, 30)) {
        users30d.add(w.userId);
        if (w.challengeId) challengeParticipants30d.add(w.userId);
        if (w.groupId) groupUsers30d.add(w.userId);
      }
    });

    const workoutsLast30d = workouts.filter((w) => isRecent(toIso((w as unknown as Record<string, unknown>).completedAt), 30)).length;
    const avgWorkoutsPerActiveUser30d = users30d.size === 0 ? 0 : Number((workoutsLast30d / users30d.size).toFixed(2));

    const challengeUsersFromCreated = challenges.map((c) => c.createdBy);
    challengeUsersFromCreated.forEach((uid) => challengeParticipants30d.add(uid));

    return {
      dau: users1d.size,
      wau: users7d.size,
      mau: users30d.size,
      workoutsLast30d,
      avgWorkoutsPerActiveUser30d,
      challengeParticipationUsers30d: challengeParticipants30d.size,
      groupActiveUsers30d: groupUsers30d.size,
    };
  }

  async getRevenueMetrics(): Promise<AdminRevenueMetrics> {
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [campaignsSnap, successfulAllSnap, successful30dSnap] = await Promise.all([
      getDocs(query(collection(db, 'donationCampaigns'), where('status', '==', 'active'))),
      getDocs(query(collection(db, 'donationTransactions'), where('status', '==', 'success'))),
      getDocs(
        query(
          collection(db, 'donationTransactions'),
          where('status', '==', 'success'),
          where('createdAt', '>=', thirtyDaysAgoIso),
        ),
      ),
    ]);
    const successful = successfulAllSnap.docs.map((d) => d.data() as Record<string, unknown>);
    const successful30d = successful30dSnap.docs.map((d) => d.data() as Record<string, unknown>);
    const totalDonations = successful.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const donations30d = successful30d.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const averageDonation = successful.length ? Number((totalDonations / successful.length).toFixed(2)) : 0;
    const activeCampaigns = campaignsSnap.size;

    return {
      totalDonations,
      donations30d,
      averageDonation,
      activeCampaigns,
    };
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
