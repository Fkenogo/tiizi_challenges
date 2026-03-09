import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

type StreakStats = { current: number; longest: number };

function toIsoDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function uniqueSortedDesc(dates: string[]) {
  return Array.from(new Set(dates)).sort().reverse();
}

function toDateOnly(value: string) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return null;
  return toIsoDate(new Date(ts));
}

export const streakService = {
  calculateStreakFromDates(dates: string[]): StreakStats {
    const sortedDates = uniqueSortedDesc(dates.map((d) => toDateOnly(d)).filter((d): d is string => !!d));

    if (sortedDates.length === 0) {
      return { current: 0, longest: 0 };
    }

    const today = toIsoDate(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = toIsoDate(yesterdayDate);

    let currentStreak = 0;
    let cursor = sortedDates[0] === today ? today : yesterday;

    for (const date of sortedDates) {
      if (date === cursor) {
        currentStreak += 1;
        const prev = new Date(cursor);
        prev.setDate(prev.getDate() - 1);
        cursor = toIsoDate(prev);
      } else if (date < cursor) {
        break;
      }
    }

    let longest = Math.max(1, currentStreak);
    let temp = 1;

    for (let i = 1; i < sortedDates.length; i += 1) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        temp += 1;
        longest = Math.max(longest, temp);
      } else {
        temp = 1;
      }
    }

    return { current: currentStreak, longest };
  },

  async calculateUserStreak(userId: string): Promise<StreakStats> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const threshold = toIsoDate(thirtyDaysAgo);

    try {
      const q = query(
        collection(db, 'workouts'),
        where('userId', '==', userId),
        where('date', '>=', threshold),
        orderBy('date', 'desc'),
      );
      const snapshot = await getDocs(q);
      const workoutDates = snapshot.docs
        .map((item) => {
          const data = item.data() as { date?: string; completedAt?: string };
          return data.date ?? toDateOnly(data.completedAt ?? '') ?? '';
        })
        .filter(Boolean);
      return this.calculateStreakFromDates(workoutDates);
    } catch {
      const fallback = await getDocs(
        query(
          collection(db, 'workouts'),
          where('userId', '==', userId),
          orderBy('completedAt', 'desc'),
        ),
      );
      const workoutDates = fallback.docs
        .slice(0, 120)
        .map((item) => {
          const data = item.data() as { date?: string; completedAt?: string };
          return data.date ?? toDateOnly(data.completedAt ?? '') ?? '';
        })
        .filter(Boolean);
      return this.calculateStreakFromDates(workoutDates);
    }
  },

  async calculateChallengeStreak(userId: string, challengeId: string): Promise<StreakStats> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const threshold = toIsoDate(thirtyDaysAgo);

    try {
      const q = query(
        collection(db, 'workouts'),
        where('userId', '==', userId),
        where('challengeId', '==', challengeId),
        where('date', '>=', threshold),
        orderBy('date', 'desc'),
      );

      const snapshot = await getDocs(q);
      const workoutDates = snapshot.docs
        .map((item) => {
          const data = item.data() as { date?: string; completedAt?: string };
          return data.date ?? toDateOnly(data.completedAt ?? '') ?? '';
        })
        .filter(Boolean);
      return this.calculateStreakFromDates(workoutDates);
    } catch {
      const fallback = await getDocs(
        query(
          collection(db, 'workouts'),
          where('userId', '==', userId),
          where('challengeId', '==', challengeId),
          orderBy('completedAt', 'desc'),
        ),
      );
      const workoutDates = fallback.docs
        .slice(0, 120)
        .map((item) => {
          const data = item.data() as { date?: string; completedAt?: string };
          return data.date ?? toDateOnly(data.completedAt ?? '') ?? '';
        })
        .filter(Boolean);
      return this.calculateStreakFromDates(workoutDates);
    }
  },
};

export type { StreakStats };
