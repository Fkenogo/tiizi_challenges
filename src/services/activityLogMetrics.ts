import type { WellnessLog, Workout } from '../types';

export type ActivityLogMetric = {
  id: string;
  source: 'workout' | 'wellness';
  userId: string;
  challengeId?: string;
  groupId?: string;
  activityId?: string;
  value: number;
  score: number;
  completedAt?: string;
};

type DateLikeRecord = Record<string, unknown> & {
  toDate?: () => Date;
  seconds?: number;
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
    const value = input as DateLikeRecord;
    if (typeof value.toDate === 'function') {
      const parsed = value.toDate().getTime();
      return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
    }
    if (typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000).toISOString();
    }
  }
  return undefined;
}

function dateKey(input: unknown): string | undefined {
  const iso = toIso(input);
  return iso?.slice(0, 10);
}

function normalizeWorkout(workout: Workout): ActivityLogMetric {
  const completedAt = toIso(workout.completedAt) ?? workout.date;
  const value = Number(workout.value ?? 0);
  return {
    id: workout.id,
    source: 'workout',
    userId: workout.userId,
    challengeId: workout.challengeId,
    groupId: workout.groupId,
    activityId: workout.exerciseId,
    value,
    score: Math.max(1, Math.round(value)),
    completedAt,
  };
}

function normalizeWellnessLog(log: WellnessLog): ActivityLogMetric {
  const completedAt = toIso((log as unknown as Record<string, unknown>).loggedAt) ?? log.date;
  const points = Number(log.points ?? 0);
  const value = Number(log.value ?? 0);
  return {
    id: log.id,
    source: 'wellness',
    userId: log.userId,
    challengeId: log.challengeId,
    groupId: log.groupId,
    activityId: log.activityId,
    value,
    score: Math.max(1, Math.round(points || value || 1)),
    completedAt,
  };
}

function duplicateKey(log: ActivityLogMetric): string | undefined {
  const day = dateKey(log.completedAt);
  if (!day || !log.activityId) return undefined;
  return [
    log.userId,
    log.challengeId ?? '',
    log.groupId ?? '',
    log.activityId,
    day,
  ].join('|');
}

export function mergeActivityLogs(
  workouts: Workout[],
  wellnessLogs: WellnessLog[],
): ActivityLogMetric[] {
  const accepted = new Map<string, ActivityLogMetric>();
  const duplicateKeyToAcceptedKey = new Map<string, string>();

  [...workouts.map(normalizeWorkout), ...wellnessLogs.map(normalizeWellnessLog)].forEach((log) => {
    const uniqueKey = `${log.source}:${log.id}`;
    const naturalKey = duplicateKey(log);
    const existingKey = naturalKey ? duplicateKeyToAcceptedKey.get(naturalKey) : undefined;
    const existing = existingKey ? accepted.get(existingKey) : undefined;

    if (existing && existing.source !== log.source) {
      if (log.score > existing.score) {
        if (existingKey) {
          accepted.delete(existingKey);
        }
        accepted.set(uniqueKey, log);
        if (naturalKey) {
          duplicateKeyToAcceptedKey.set(naturalKey, uniqueKey);
        }
      }
      return;
    }

    accepted.set(uniqueKey, log);
    if (naturalKey && !existingKey) {
      duplicateKeyToAcceptedKey.set(naturalKey, uniqueKey);
    }
  });

  return Array.from(accepted.values());
}

export function sumActivityScoresByUser(logs: ActivityLogMetric[]): Map<string, number> {
  const scores = new Map<string, number>();
  logs.forEach((log) => {
    scores.set(log.userId, (scores.get(log.userId) ?? 0) + log.score);
  });
  return scores;
}

export function countActivitiesByUser(logs: ActivityLogMetric[]): Map<string, number> {
  const counts = new Map<string, number>();
  logs.forEach((log) => {
    counts.set(log.userId, (counts.get(log.userId) ?? 0) + 1);
  });
  return counts;
}
