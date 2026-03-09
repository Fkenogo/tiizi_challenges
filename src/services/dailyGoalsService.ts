import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type DailyGoalItem = {
  id: string;
  text: string;
  completed: boolean;
};

type DailyGoalsPayload = {
  date: string;
  items: DailyGoalItem[];
};

export type DailyGoalsAnalytics = {
  totalDaysTracked: number;
  totalGoalsPlanned: number;
  totalGoalsCompleted: number;
  completionRate: number;
  lastUpdatedDate?: string;
};

type DailyGoalsAnalyticsPayload = {
  totalDaysTracked?: number;
  totalGoalsPlanned?: number;
  totalGoalsCompleted?: number;
  lastUpdatedDate?: string;
};

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sanitizeGoals(items: DailyGoalItem[]): DailyGoalItem[] {
  return items
    .map((item) => ({
      id: item.id,
      text: item.text.trim(),
      completed: !!item.completed,
    }))
    .filter((item) => item.text.length > 0)
    .slice(0, 3);
}

class DailyGoalsService {
  async getTodayGoals(uid: string): Promise<DailyGoalItem[]> {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return [];
    const data = snap.data() as { dailyGoals?: DailyGoalsPayload };
    const payload = data.dailyGoals;
    if (!payload || payload.date !== todayIsoDate()) return [];
    return sanitizeGoals(payload.items ?? []);
  }

  async saveTodayGoals(uid: string, items: DailyGoalItem[]): Promise<DailyGoalItem[]> {
    const normalized = sanitizeGoals(items);
    const today = todayIsoDate();
    const planned = normalized.length;
    const completed = normalized.filter((item) => item.completed).length;
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() as {
      dailyGoals?: DailyGoalsPayload;
      dailyGoalsAnalytics?: DailyGoalsAnalyticsPayload;
    } : {};
    const prevGoals = userData.dailyGoals;
    const prevAnalytics = userData.dailyGoalsAnalytics ?? {};
    const prevWasToday = prevGoals?.date === today;
    const prevPlanned = prevWasToday ? (prevGoals?.items?.length ?? 0) : 0;
    const prevCompleted = prevWasToday
      ? (prevGoals?.items?.filter((item) => !!item.completed).length ?? 0)
      : 0;

    const totalDaysTracked = Number(prevAnalytics.totalDaysTracked ?? 0) + (prevWasToday ? 0 : 1);
    const totalGoalsPlanned = Number(prevAnalytics.totalGoalsPlanned ?? 0) + (planned - prevPlanned);
    const totalGoalsCompleted = Number(prevAnalytics.totalGoalsCompleted ?? 0) + (completed - prevCompleted);

    await setDoc(
      userRef,
      {
        dailyGoals: {
          date: today,
          items: normalized,
        },
        dailyGoalsAnalytics: {
          totalDaysTracked: Math.max(0, totalDaysTracked),
          totalGoalsPlanned: Math.max(0, totalGoalsPlanned),
          totalGoalsCompleted: Math.max(0, totalGoalsCompleted),
          lastUpdatedDate: today,
        },
      },
      { merge: true },
    );
    return normalized;
  }

  async getAnalytics(uid: string): Promise<DailyGoalsAnalytics> {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) {
      return {
        totalDaysTracked: 0,
        totalGoalsPlanned: 0,
        totalGoalsCompleted: 0,
        completionRate: 0,
      };
    }
    const data = userSnap.data() as { dailyGoalsAnalytics?: DailyGoalsAnalyticsPayload };
    const analytics = data.dailyGoalsAnalytics ?? {};
    const totalGoalsPlanned = Number(analytics.totalGoalsPlanned ?? 0);
    const totalGoalsCompleted = Number(analytics.totalGoalsCompleted ?? 0);
    const completionRate = totalGoalsPlanned > 0
      ? Math.round((totalGoalsCompleted / totalGoalsPlanned) * 100)
      : 0;

    return {
      totalDaysTracked: Number(analytics.totalDaysTracked ?? 0),
      totalGoalsPlanned,
      totalGoalsCompleted,
      completionRate,
      lastUpdatedDate: analytics.lastUpdatedDate,
    };
  }
}

export const dailyGoalsService = new DailyGoalsService();
