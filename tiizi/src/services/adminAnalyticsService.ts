import { collection, getDocs } from 'firebase/firestore';
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

function shortId(id: string): string {
  return id.slice(0, 6).toUpperCase();
}

class AdminAnalyticsService {
  async getOverviewMetrics(): Promise<AdminOverviewMetrics> {
    const [usersSnap, exercisesSnap, challengesSnap, workoutsSnap, groupsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'catalogExercises')),
      getDocs(collection(db, 'challenges')),
      getDocs(collection(db, 'workouts')),
      getDocs(collection(db, 'groups')),
    ]);

    const challenges = challengesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }));
    const workouts = workoutsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, 'id'>) }));
    const groups = groupsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Group, 'id'>) }));

    const activeUsers7d = new Set(
      workouts.filter((w) => isRecent(w.completedAt, 7)).map((w) => w.userId),
    ).size;

    const recentActivity = [
      ...workouts
        .filter((w) => w.completedAt)
        .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
        .slice(0, 4)
        .map((w) => ({
          id: `workout-${w.id}`,
          message: `Workout logged by user ${shortId(w.userId)} (${w.value} ${w.unit})`,
          at: w.completedAt,
        })),
      ...challenges
        .filter((c) => c.startDate)
        .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate))
        .slice(0, 3)
        .map((c) => ({
          id: `challenge-${c.id}`,
          message: `Challenge created: ${c.name}`,
          at: c.startDate,
        })),
      ...groups
        .filter((g) => g.createdAt)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 2)
        .map((g) => ({
          id: `group-${g.id}`,
          message: `Group created: ${g.name}`,
          at: g.createdAt,
        })),
    ]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 8);

    return {
      totalUsers: usersSnap.size,
      activeUsers7d,
      totalExercises: exercisesSnap.size,
      activeChallenges: challenges.filter((c) => c.status === 'active').length,
      totalWorkouts: workouts.length,
      totalGroups: groups.length,
      recentActivity,
    };
  }

  async getUserGrowth(days = 30): Promise<UserGrowthPoint[]> {
    const usersSnap = await getDocs(collection(db, 'users'));
    const users = usersSnap.docs.map((d) => d.data() as { createdAt?: string });

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const buckets = new Map<string, number>();
    for (let i = 0; i < days; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = date.toISOString().slice(0, 10);
      buckets.set(key, 0);
    }

    users.forEach((u) => {
      if (!u.createdAt) return;
      const key = u.createdAt.slice(0, 10);
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
    const [workoutSnap, challengeSnap] = await Promise.all([
      getDocs(collection(db, 'workouts')),
      getDocs(collection(db, 'challenges')),
    ]);

    const workouts = workoutSnap.docs.map((d) => d.data() as Omit<Workout, 'id'>);
    const challenges = challengeSnap.docs.map((d) => d.data() as Omit<Challenge, 'id'>);

    const users1d = new Set<string>();
    const users7d = new Set<string>();
    const users30d = new Set<string>();
    const challengeParticipants30d = new Set<string>();
    const groupUsers30d = new Set<string>();

    workouts.forEach((w) => {
      if (isRecent(w.completedAt, 1)) users1d.add(w.userId);
      if (isRecent(w.completedAt, 7)) users7d.add(w.userId);
      if (isRecent(w.completedAt, 30)) {
        users30d.add(w.userId);
        if (w.challengeId) challengeParticipants30d.add(w.userId);
        if (w.groupId) groupUsers30d.add(w.userId);
      }
    });

    const workoutsLast30d = workouts.filter((w) => isRecent(w.completedAt, 30)).length;
    const avgWorkoutsPerActiveUser30d = users30d.size === 0 ? 0 : Number((workoutsLast30d / users30d.size).toFixed(2));

    const challengeUsersFromCreated = challenges
      .filter((c) => isRecent(c.startDate, 30))
      .map((c) => c.createdBy);
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
    const [campaignsSnap, transactionsSnap] = await Promise.all([
      getDocs(collection(db, 'donationCampaigns')),
      getDocs(collection(db, 'donationTransactions')),
    ]);
    const transactions = transactionsSnap.docs.map((d) => d.data() as Record<string, unknown>);
    const successful = transactions.filter((t) => String(t.status ?? 'pending') === 'success');
    const totalDonations = successful.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const now = Date.now();
    const donations30d = successful
      .filter((row) => {
        const ts = Date.parse(String(row.createdAt ?? ''));
        return !Number.isNaN(ts) && now - ts <= 30 * 24 * 60 * 60 * 1000;
      })
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    const averageDonation = successful.length ? Number((totalDonations / successful.length).toFixed(2)) : 0;
    const activeCampaigns = campaignsSnap.docs
      .map((d) => d.data() as Record<string, unknown>)
      .filter((c) => c.status === 'active').length;

    return {
      totalDonations,
      donations30d,
      averageDonation,
      activeCampaigns,
    };
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
