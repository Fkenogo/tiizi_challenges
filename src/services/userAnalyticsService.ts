import { collection, doc, documentId, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { streakService } from './streakService';
import { toLocalIsoDate } from '../utils/dateUtils';
import { isChallengeOngoing } from '../utils/challengeLifecycle';

export type UserAnalytics = {
  // Groups
  groupsCount: number;           // current active memberships (status joined/active + group is active)
  totalGroupsJoinedCount: number; // all-time historical memberships

  // Challenges — lifecycle-aware
  ongoingChallengesCount: number;   // isChallengeOngoing() — matches ChallengesScreen
  completedChallengesCount: number; // status === 'completed' on the challenge doc
  totalChallengesJoinedCount: number; // all memberships ever

  // Activity logs
  currentStreak: number;
  longestStreak: number;
  fitnessLogsLast7d: number;
  fitnessLogsLast30d: number;
  wellnessLogsLast7d: number;
  wellnessLogsLast30d: number;
  totalLogsLast30d: number;
  mostLoggedActivityName: string | undefined;

  // Daily habits
  habitCompletionRate: number;
  habitDaysTracked: number;
};

function nDaysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalIsoDate(d);
}

function withinDays(dateStr: string, thresholdIso: string): boolean {
  return !!dateStr && dateStr >= thresholdIso;
}

async function fetchChallengeDocsByIds(challengeIds: string[]): Promise<Array<{ startDate: string; endDate: string; status: 'draft' | 'active' | 'completed' | 'expired' }>> {
  const unique = Array.from(new Set(challengeIds)).filter(Boolean);
  if (unique.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));
  const snaps = await Promise.all(
    chunks.map((chunk) => getDocs(query(collection(db, 'challenges'), where(documentId(), 'in', chunk)))),
  );
  return snaps.flatMap((snap) =>
    snap.docs.map((d) => {
      const data = d.data() as { startDate?: string; endDate?: string; status?: string };
      return {
        startDate: data.startDate ?? '',
        endDate: data.endDate ?? '',
        status: (data.status ?? 'active') as 'draft' | 'active' | 'completed' | 'expired',
      };
    }),
  );
}

export const userAnalyticsService = {
  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    const threshold90 = nDaysAgoIso(90);
    const threshold30 = nDaysAgoIso(30);
    const threshold7 = nDaysAgoIso(7);

    // All reads fire in parallel to minimise wall-clock latency.
    const [
      activeGroupMembersSnap,
      allGroupMembersSnap,
      challengeMembersSnap,
      workoutsSnap,
      wellnessLogsSnap,
      streak,
      userSnap,
    ] = await Promise.all([
      // Active group memberships (current groups)
      getDocs(query(
        collection(db, 'groupMembers'),
        where('userId', '==', userId),
        where('status', 'in', ['joined', 'active']),
      )),
      // All-time group memberships (total joined)
      getDocs(query(
        collection(db, 'groupMembers'),
        where('userId', '==', userId),
      )),
      // All challenge memberships — used for lifecycle-aware ongoing count + historical count
      getDocs(query(
        collection(db, 'challengeMembers'),
        where('userId', '==', userId),
      )),
      // Fitness logs — 90-day window
      getDocs(query(
        collection(db, 'workouts'),
        where('userId', '==', userId),
        where('date', '>=', threshold90),
      )),
      // Wellness logs — 90-day window
      getDocs(query(
        collection(db, 'wellnessLogs'),
        where('userId', '==', userId),
        where('date', '>=', threshold90),
      )),
      // Streak — reuse existing service (merges workouts + wellnessLogs)
      streakService.calculateUserStreak(userId),
      // Daily habits analytics — stored counter in user doc
      getDoc(doc(db, 'users', userId)),
    ]);

    // Groups — active memberships (matches useMyGroups filter)
    const groupsCount = activeGroupMembersSnap.size;
    const totalGroupsJoinedCount = allGroupMembersSnap.size;

    // Challenge memberships
    type MemberDoc = { status?: string; challengeId?: string };
    const memberDocs = challengeMembersSnap.docs.map((d) => d.data() as MemberDoc);
    const totalChallengesJoinedCount = memberDocs.length;

    // Completed challenges: count memberships where the challenge doc has status === 'completed'.
    // Also accepted: member doc status === 'completed' as a fast-path when the challenge doc
    // hasn't been fetched yet (same interpretation, just read from the member side).
    const completedChallengesCount = memberDocs.filter((d) => d.status === 'completed').length;

    // Ongoing challenges: must use isChallengeOngoing() so stale 'active' memberships whose
    // challenge endDate has passed are NOT counted — matches ChallengesScreen behaviour.
    const challengeIds = memberDocs.map((d) => d.challengeId ?? '').filter(Boolean);
    const challengeDocs = await fetchChallengeDocsByIds(challengeIds);
    const ongoingChallengesCount = challengeDocs.filter((c) => isChallengeOngoing(c)).length;

    // Fitness logs
    type WorkoutDoc = { date?: string; exerciseId?: string; exerciseName?: string };
    const workoutDocs = workoutsSnap.docs.map((d) => d.data() as WorkoutDoc);
    const fitnessLogsLast30d = workoutDocs.filter((d) => withinDays(d.date ?? '', threshold30)).length;
    const fitnessLogsLast7d = workoutDocs.filter((d) => withinDays(d.date ?? '', threshold7)).length;

    // Wellness logs
    type WellnessLogDoc = { date?: string; activityId?: string; activityType?: string; activityName?: string };
    const wellnessDocs = wellnessLogsSnap.docs.map((d) => d.data() as WellnessLogDoc);
    const wellnessLogsLast30d = wellnessDocs.filter((d) => withinDays(d.date ?? '', threshold30)).length;
    const wellnessLogsLast7d = wellnessDocs.filter((d) => withinDays(d.date ?? '', threshold7)).length;

    const totalLogsLast30d = fitnessLogsLast30d + wellnessLogsLast30d;

    // Most logged activity — prefer display name over ID
    const activityFreq = new Map<string, { count: number; name: string }>();
    workoutDocs
      .filter((d) => withinDays(d.date ?? '', threshold30))
      .forEach((d) => {
        const key = d.exerciseId ?? '';
        if (!key) return;
        const name = d.exerciseName || key;
        const prev = activityFreq.get(key);
        activityFreq.set(key, { count: (prev?.count ?? 0) + 1, name: prev?.name || name });
      });
    wellnessDocs
      .filter((d) => withinDays(d.date ?? '', threshold30))
      .forEach((d) => {
        const key = d.activityId ?? d.activityType ?? '';
        if (!key) return;
        const name = d.activityName || key;
        const prev = activityFreq.get(key);
        activityFreq.set(key, { count: (prev?.count ?? 0) + 1, name: prev?.name || name });
      });
    let mostLoggedActivityName: string | undefined;
    if (activityFreq.size > 0) {
      const top = [...activityFreq.values()].sort((a, b) => b.count - a.count)[0];
      mostLoggedActivityName = top.name;
    }

    // Daily habits — optional, from user doc counter
    type UserDoc = { dailyGoalsAnalytics?: { completionRate?: number; totalDaysTracked?: number; totalGoalsPlanned?: number; totalGoalsCompleted?: number } };
    const userData = userSnap.exists() ? (userSnap.data() as UserDoc) : {};
    const habits = userData.dailyGoalsAnalytics ?? {};
    const habitDaysTracked = Number(habits.totalDaysTracked ?? 0);
    const habitTotalPlanned = Number(habits.totalGoalsPlanned ?? 0);
    const habitTotalCompleted = Number(habits.totalGoalsCompleted ?? 0);
    const habitCompletionRate = habitTotalPlanned > 0
      ? Math.round((habitTotalCompleted / habitTotalPlanned) * 100)
      : 0;

    return {
      groupsCount,
      totalGroupsJoinedCount,
      ongoingChallengesCount,
      completedChallengesCount,
      totalChallengesJoinedCount,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      fitnessLogsLast7d,
      fitnessLogsLast30d,
      wellnessLogsLast7d,
      wellnessLogsLast30d,
      totalLogsLast30d,
      mostLoggedActivityName,
      habitCompletionRate,
      habitDaysTracked,
    };
  },
};
