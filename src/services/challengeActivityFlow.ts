import type { Challenge } from '../types';

export type ChallengeActivityItem = NonNullable<Challenge['activities']>[number];

type MaybeChallenge = Challenge | null | undefined;

/**
 * Resolve the wellness activityType for a log URL.
 *
 * Priority: configured activity.activityType → inferred from activity name → inferred from
 * challenge category → 'meditation' (safe final fallback — always a valid Firestore logType).
 *
 * 'wellness' is intentionally never returned because it is not in the Firestore rule allowlist
 * ['fasting', 'hydration', 'sleep', 'meditation'] and would silently route to logMeditation
 * with a misleading logType stored in the database.
 */
export function resolveWellnessActivityType(
  activityType: string | undefined,
  activityName: string,
  category: string | undefined,
): string {
  if (activityType) return activityType.toLowerCase();

  const name = activityName.toLowerCase();
  if (name.includes('sleep')) return 'sleep';
  if (name.includes('fast') || name.includes('intermittent')) return 'fasting';
  if (name.includes('hydrat') || name.includes('water') || name.includes('drink')) return 'hydration';
  if (name.includes('meditat') || name.includes('mindful') || name.includes('breath')) return 'meditation';

  const cat = (category ?? '').toLowerCase();
  if (cat === 'sleep') return 'sleep';
  if (cat === 'fasting') return 'fasting';
  if (cat === 'hydration') return 'hydration';
  if (cat === 'meditation' || cat === 'mindfulness') return 'meditation';

  return 'meditation';
}

export function isWellnessActivity(challenge: MaybeChallenge, activity: ChallengeActivityItem): boolean {
  const exerciseId = String(activity.exerciseId ?? activity.activityId ?? '').toLowerCase();
  return Boolean(
    (challenge?.category && challenge.category !== 'fitness')
      || activity.activityType
      || exerciseId.startsWith('wellness:'),
  );
}

export function findActivityIndex(
  activities: ChallengeActivityItem[],
  current: { activityIndex?: number; exerciseId?: string; activityId?: string },
): number {
  if (
    current.activityIndex !== undefined
    && Number.isInteger(current.activityIndex)
    && current.activityIndex >= 0
    && current.activityIndex < activities.length
  ) {
    return current.activityIndex;
  }

  return activities.findIndex((activity) => {
    const exerciseMatches = current.exerciseId && activity.exerciseId === current.exerciseId;
    const activityMatches = current.activityId && (activity.activityId === current.activityId || activity.exerciseId === current.activityId);
    return Boolean(exerciseMatches || activityMatches);
  });
}

export function buildActivityLogPath(
  challenge: MaybeChallenge,
  activity: ChallengeActivityItem,
  activityIndex: number,
  context: { challengeId: string; groupId?: string; loggedActivityIndexes?: number[] },
): string {
  const qs = new URLSearchParams();
  qs.set('challengeId', context.challengeId);
  qs.set('activityIndex', String(activityIndex));
  if (context.groupId) qs.set('groupId', context.groupId);
  if (context.loggedActivityIndexes && context.loggedActivityIndexes.length > 0) {
    qs.set('loggedActivityIndexes', context.loggedActivityIndexes.join(','));
  }

  const activityName = activity.exerciseName || 'Activity';
  const unit = activity.unit || 'count';
  const targetValue = Number(activity.targetValue ?? 1);

  if (isWellnessActivity(challenge, activity)) {
    qs.set('activityId', activity.activityId || activity.exerciseId || `wellness:${activityName.toLowerCase().replace(/\s+/g, '-')}`);
    qs.set('activityType', resolveWellnessActivityType(activity.activityType, activityName, challenge?.category));
    qs.set('activityName', activityName);
    qs.set('unit', unit);
    qs.set('targetValue', String(Number.isFinite(targetValue) ? targetValue : 1));
    return `/app/workouts/log-wellness?${qs.toString()}`;
  }

  qs.set('exerciseId', activity.exerciseId || activity.activityId || activityName);
  qs.set('unit', unit);
  qs.set('exerciseName', activityName);
  qs.set('targetValue', String(Number.isFinite(targetValue) ? targetValue : 1));
  return `/app/workouts/log?${qs.toString()}`;
}

export function getNextActivityLogPath(
  challenge: MaybeChallenge,
  context: {
    challengeId: string;
    groupId?: string;
    activityIndex?: number;
    exerciseId?: string;
    activityId?: string;
    loggedActivityIndexes?: number[];
  },
): string | null {
  const activities = challenge?.activities ?? [];
  if (activities.length === 0) return null;

  const currentIndex = findActivityIndex(activities, context);
  const loggedIndexes = new Set(context.loggedActivityIndexes ?? []);
  if (currentIndex >= 0) loggedIndexes.add(currentIndex);

  const orderedCandidateIndexes = [
    ...activities.map((_, index) => index).filter((index) => currentIndex >= 0 && index > currentIndex),
    ...activities.map((_, index) => index).filter((index) => currentIndex < 0 || index <= currentIndex),
  ];
  const nextIndex = orderedCandidateIndexes.find((index) => !loggedIndexes.has(index));
  if (nextIndex === undefined) return null;
  const nextActivity = activities[nextIndex];
  if (!nextActivity) return null;

  return buildActivityLogPath(challenge, nextActivity, nextIndex, {
    challengeId: context.challengeId,
    groupId: context.groupId,
    loggedActivityIndexes: Array.from(loggedIndexes).sort((a, b) => a - b),
  });
}

export function parseLoggedActivityIndexes(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0);
}

export function buildChallengeCompletedPath(context: { challengeId: string; groupId?: string; challengeName?: string }): string {
  const qs = new URLSearchParams({ challengeId: context.challengeId });
  if (context.groupId) qs.set('groupId', context.groupId);
  if (context.challengeName) qs.set('name', context.challengeName);
  return `/app/challenges/completed?${qs.toString()}`;
}

export function buildActivitySuccessPath(context: {
  challengeId: string;
  groupId?: string;
  source: 'workout' | 'wellness';
  activityId?: string;
  exerciseId?: string;
  activityName: string;
  value: number;
  unit: string;
  targetValue?: number;
  points?: number;
  metTarget?: boolean;
  scoringMethod?: string;
  entries?: Array<{
    label: string;
    value: number;
    unit: string;
    points: number;
    source?: 'workout' | 'wellness';
  }>;
}): string {
  const qs = new URLSearchParams({
    challengeId: context.challengeId,
    source: context.source,
    exerciseName: context.activityName,
    value: String(context.value),
    unit: context.unit,
    target: String(context.targetValue ?? context.value),
    points: String(context.points ?? 0),
  });
  if (context.groupId) qs.set('groupId', context.groupId);
  if (context.exerciseId) qs.set('exerciseId', context.exerciseId);
  if (context.activityId) qs.set('activityId', context.activityId);
  if (context.metTarget !== undefined) qs.set('metTarget', String(context.metTarget));
  if (context.scoringMethod) qs.set('scoringMethod', context.scoringMethod);
  if (context.entries && context.entries.length > 0) {
    qs.set('entries', JSON.stringify(context.entries));
  }
  return `/app/workouts/success?${qs.toString()}`;
}
