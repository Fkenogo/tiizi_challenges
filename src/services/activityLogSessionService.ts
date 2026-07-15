import {
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import type { DocumentReference, FirestoreError } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isGroupActive } from '../utils/groupLifecycle';
import type { ChallengeMember } from '../types';
import {
  ACTIVITY_WRITE_LIMITS,
  assertSafeActivityValue,
  maxWellnessValueForUnit,
  maxWorkoutValueForUnit,
  safeActivityNotes,
} from './activityWriteGuards';
import { computeActivityScore, type ChallengeType } from './scoringConfig';
import { computeRequiredLogs, deriveDailyTargetValue } from './challengeCompletion';

export type ActivitySessionEntry =
  | {
      source: 'workout';
      activityId: string;
      exerciseId: string;
      exerciseName: string;
      value: number;
      unit: string;
      notes?: string;
      points?: number;
      targetValue?: number;
    }
  | {
      source: 'wellness';
      activityId: string;
      activityType: string;
      activityName: string;
      value: number;
      unit: string;
      notes?: string;
      points?: number;
      targetValue?: number;
      metadata?: Record<string, unknown>;
    };

export type ActivitySessionInput = {
  userId: string;
  challengeId: string;
  groupId: string;
  entries: ActivitySessionEntry[];
};

export type ActivitySessionResult = {
  challengeId: string;
  groupId: string;
  userId: string;
  totalPoints: number;
  entries: Array<{
    source: ActivitySessionEntry['source'];
    label: string;
    value: number;
    unit: string;
    points: number;
  }>;
};

function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedDeep(item)) as T;
  }

  if (value && typeof value === 'object') {
    const cleaned = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, removeUndefinedDeep(item)]);
    return Object.fromEntries(cleaned) as T;
  }

  return value;
}

function normalizedWellnessType(activityType: string): 'fasting' | 'hydration' | 'sleep' | 'meditation' {
  const normalized = activityType.toLowerCase();
  if (normalized === 'fasting') return 'fasting';
  if (normalized === 'hydration' || normalized === 'water') return 'hydration';
  if (normalized === 'sleep') return 'sleep';
  return 'meditation';
}

function isAllowedMemberStatus(status: unknown): boolean {
  return status === 'active' || status === 'joined' || status === 'completed';
}

function logActivitySessionDebug(message: string, data: Record<string, unknown>) {
  console.debug(`[activityLogSessionService] ${message}`, data);
}

function summarizeActivityPayload(payload: Record<string, unknown>) {
  const notes = typeof payload.notes === 'string' ? payload.notes : '';
  const safePayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== 'notes'),
  );
  return {
    ...safePayload,
    hasNotes: notes.length > 0,
    notesLength: notes.length,
    createdAt: payload.createdAt ? '[serverTimestamp]' : undefined,
    loggedAt: payload.loggedAt ? '[serverTimestamp]' : undefined,
    completedAt: payload.completedAt ? '[serverTimestamp]' : undefined,
  };
}

// To enable: run `window.__activitySessionDebug = true` in the browser console.
// Each planned write is tested individually before the batch commits.
// Side effects: activity creates produce real (orphan) documents in Firestore.
// The challengeMembers update is applied during the test; if the batch then also
// runs, progress will be double-counted. Disable after debugging.
function isDebugMode(): boolean {
  return typeof window !== 'undefined'
    && (window as unknown as Record<string, unknown>).__activitySessionDebug === true;
}

type PlannedSingleWrite = {
  label: string;
  ref: DocumentReference;
  payload: Record<string, unknown>;
  merge: boolean;
};

async function runIndividualWriteTests(writes: PlannedSingleWrite[]): Promise<void> {
  console.debug('[activityLogSessionService] DEBUG MODE: running each write individually before batch');
  for (const write of writes) {
    const sanitized = summarizeActivityPayload(write.payload);
    console.debug(`[activityLogSessionService] DEBUG testing: ${write.label}`, {
      path: `${write.ref.parent.id}/${write.ref.id}`,
      operation: write.merge ? 'set+merge' : 'set(create)',
      keys: Object.keys(write.payload).sort(),
      payload: sanitized,
    });
    try {
      if (write.merge) {
        await setDoc(write.ref, write.payload, { merge: true });
      } else {
        await setDoc(write.ref, write.payload);
      }
      console.debug(`[activityLogSessionService] DEBUG PASS: ${write.label}`);
    } catch (error) {
      const fe = error as Partial<FirestoreError>;
      console.error(`[activityLogSessionService] DEBUG FAIL: ${write.label}`, {
        path: `${write.ref.parent.id}/${write.ref.id}`,
        code: fe.code,
        message: fe.message,
        keys: Object.keys(write.payload).sort(),
        payload: sanitized,
      });
      throw error;
    }
  }
  console.debug('[activityLogSessionService] DEBUG MODE: all individual writes PASSED');
}

class ActivityLogSessionService {
  async createActivitySession(input: ActivitySessionInput): Promise<ActivitySessionResult> {
    if (input.entries.length === 0) {
      throw new Error('Add at least one activity before saving.');
    }

    let challengeSnap;
    try {
      challengeSnap = await getDoc(doc(db, 'challenges', input.challengeId));
    } catch (err) {
      const fe = err as Partial<FirestoreError>;
      console.error('[activityLogSessionService] getDoc failed', { op: 'challenges read', path: `challenges/${input.challengeId}`, code: fe.code, message: fe.message });
      throw err;
    }
    if (!challengeSnap.exists()) {
      throw new Error('Challenge not found.');
    }

    const challenge = challengeSnap.data() as {
      groupId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      durationDays?: number;
      activities?: unknown[];
      exerciseIds?: unknown[];
      challengeType?: string;
    };
    const configuredActivities = Array.isArray(challenge.activities) ? challenge.activities.length : 0;
    const configuredExerciseIds = Array.isArray(challenge.exerciseIds) ? challenge.exerciseIds.length : 0;
    if (challenge.status !== 'active') {
      throw new Error('Challenge is not active.');
    }
    if (!challenge.groupId || challenge.groupId !== input.groupId) {
      throw new Error('Challenge group does not match.');
    }

    const groupDocSnap = await getDoc(doc(db, 'groups', input.groupId));
    if (!isGroupActive(groupDocSnap.exists() ? (groupDocSnap.data() as { status?: string }) : null)) {
      throw new Error('Activity logging is not available — this group has been deactivated.');
    }

    const nowDate = new Date();
    const startAt = challenge.startDate ? new Date(challenge.startDate) : null;
    const endAt = challenge.endDate ? new Date(challenge.endDate) : null;
    if (startAt && nowDate < startAt) {
      throw new Error('Challenge has not started yet.');
    }
    if (endAt && nowDate > endAt) {
      throw new Error('Challenge has already ended.');
    }

    const groupMemberRef = doc(db, 'groupMembers', `${input.groupId}_${input.userId}`);
    let groupMemberSnap;
    try {
      groupMemberSnap = await getDoc(groupMemberRef);
    } catch (err) {
      const fe = err as Partial<FirestoreError>;
      console.error('[activityLogSessionService] getDoc failed', { op: 'groupMembers read', path: `groupMembers/${input.groupId}_${input.userId}`, code: fe.code, message: fe.message });
      throw err;
    }
    if (!groupMemberSnap.exists()) {
      throw new Error('Join the group before logging challenge activities.');
    }
    const groupMember = groupMemberSnap.data() as { status?: string; userId?: string };
    if (groupMember.userId !== input.userId || !['active', 'joined'].includes(String(groupMember.status))) {
      throw new Error('Your group membership is not active for activity logging.');
    }

    const membershipRef = doc(db, 'challengeMembers', `${input.challengeId}_${input.userId}`);
    let membershipSnap;
    try {
      membershipSnap = await getDoc(membershipRef);
    } catch (err) {
      const fe = err as Partial<FirestoreError>;
      console.error('[activityLogSessionService] getDoc failed', { op: 'challengeMembers read', path: `challengeMembers/${input.challengeId}_${input.userId}`, code: fe.code, message: fe.message });
      throw err;
    }
    if (!membershipSnap.exists()) {
      throw new Error('Join challenge before logging activities.');
    }
    const membership = membershipSnap.data() as ChallengeMember;
    if (
      membership.userId !== input.userId
      || membership.challengeId !== input.challengeId
      || membership.groupId !== input.groupId
      || !isAllowedMemberStatus(membership.status)
    ) {
      throw new Error('Your challenge membership is not active for activity logging.');
    }
    if (membership.status === 'completed') {
      throw new Error('You have already completed this challenge.');
    }

    const batch = writeBatch(db);
    const date = todayIsoDate();
    const summaryEntries: ActivitySessionResult['entries'] = [];
    const plannedWrites: string[] = [];
    const plannedActivityPayloads: Array<{ path: string; payload: Record<string, unknown> }> = [];
    const debugWrites: PlannedSingleWrite[] = [];
    let totalPoints = 0;

    const challengeType = (challenge.challengeType as ChallengeType) ?? 'collective';

    const totalActivities = computeRequiredLogs(challenge.durationDays, Math.max(configuredActivities, configuredExerciseIds));

    input.entries.forEach((entry) => {
      const effectiveTargetValue = deriveDailyTargetValue(entry.targetValue ?? 0, challenge.durationDays, challengeType);
      const scoring = computeActivityScore({
        value: entry.value,
        targetValue: effectiveTargetValue,
        challengeType,
      });
      const points = Math.min(ACTIVITY_WRITE_LIMITS.maxWellnessPoints, Math.max(0, scoring.pointsEarned));
      totalPoints += points;

      if (entry.source === 'workout') {
        assertSafeActivityValue(entry.value, maxWorkoutValueForUnit(entry.unit), 'workout value');
        const workoutRef = doc(collection(db, 'workouts'));
        plannedWrites.push(`workouts/${workoutRef.id}`);
        const basePayload = removeUndefinedDeep({
          userId: input.userId,
          challengeId: input.challengeId,
          groupId: input.groupId,
          activityId: entry.activityId,
          exerciseId: entry.exerciseId,
          exerciseName: entry.exerciseName,
          value: entry.value,
          unit: entry.unit,
          notes: safeActivityNotes(entry.notes),
          date,
          points,
          rawValue: scoring.rawValue,
          targetValue: scoring.targetValue,
          metTarget: scoring.metTarget,
          scoringMethod: scoring.scoringMethod,
          capped: scoring.capped,
          scoringVersion: 'v2',
        });
        const payload = {
          ...basePayload,
          completedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          loggedAt: serverTimestamp(),
        };
        plannedActivityPayloads.push({ path: `workouts/${workoutRef.id}`, payload: summarizeActivityPayload(payload) });
        debugWrites.push({ label: `workout create (entry ${debugWrites.length + 1})`, ref: workoutRef, payload, merge: false });
        batch.set(workoutRef, payload);
        summaryEntries.push({
          source: entry.source,
          label: entry.exerciseName,
          value: entry.value,
          unit: entry.unit,
          points,
        });
        return;
      }

      assertSafeActivityValue(entry.value, maxWellnessValueForUnit(entry.unit), 'wellness value');
      const logRef = doc(collection(db, 'wellnessLogs'));
      plannedWrites.push(`wellnessLogs/${logRef.id}`);
      const basePayload = removeUndefinedDeep({
        userId: input.userId,
        challengeId: input.challengeId,
        groupId: input.groupId,
        activityId: entry.activityId,
        logType: normalizedWellnessType(entry.activityType),
        value: entry.value,
        unit: entry.unit,
        points,
        notes: safeActivityNotes(entry.notes),
        date,
        metTarget: scoring.metTarget,
        rawValue: scoring.rawValue,
        targetValue: scoring.targetValue,
        scoringMethod: scoring.scoringMethod,
        capped: scoring.capped,
        scoringVersion: 'v2',
        metadata: {
          ...(entry.metadata ?? {}),
          activityName: entry.activityName,
          activityType: entry.activityType,
        },
      });
      const payload = {
        ...basePayload,
        createdAt: serverTimestamp(),
        loggedAt: serverTimestamp(),
      };
      plannedActivityPayloads.push({ path: `wellnessLogs/${logRef.id}`, payload: summarizeActivityPayload(payload) });
      debugWrites.push({ label: `wellnessLog create (entry ${debugWrites.length + 1})`, ref: logRef, payload, merge: false });
      batch.set(logRef, payload);
      summaryEntries.push({
        source: entry.source,
        label: entry.activityName,
        value: entry.value,
        unit: entry.unit,
        points,
      });
    });

    const nextCompleted = Math.min(Number(membership.activitiesCompleted ?? 0) + input.entries.length, totalActivities);
    const nextRate = Math.min(100, Math.round((nextCompleted / totalActivities) * 100));
    // sessionContributionTotal uses summaryEntries — exactly the values written to activity docs.
    // Absolute write matches workoutService.ts and wellnessLogService.ts behavior (client-engine-owned field).
    const sessionContributionTotal = summaryEntries.reduce((s, e) => s + Math.max(0, e.value), 0);
    const nextCumulativeLoggedValue = Math.max(0, Number(membership.cumulativeLoggedValue ?? 0)) + sessionContributionTotal;
    const membershipUpdate: Record<string, unknown> = {
      activitiesCompleted: nextCompleted,
      totalPoints: increment(totalPoints),
      lastActivityAt: serverTimestamp(),
      completionRate: nextRate,
      cumulativeLoggedValue: nextCumulativeLoggedValue,
    };
    if (nextRate >= 100) {
      membershipUpdate.status = 'completed';
      membershipUpdate.completedAt = serverTimestamp();
    }
    const ruleRiskChecks = {
      activityCreatesRequireCompletedParticipantAllowed: false,
      progressUpdateWouldBeNoOpForCompletedCount: Number(membership.activitiesCompleted ?? 0) === nextCompleted,
      progressIncrementCount: Math.max(0, nextCompleted - Number(membership.activitiesCompleted ?? 0)),
      configuredBatchLimit: totalActivities,
      pointsIncrement: totalPoints,
      maxAllowedPointsIncrementByLocalRules: totalActivities * ACTIVITY_WRITE_LIMITS.maxWellnessPoints,
    };

    plannedWrites.push(`challengeMembers/${input.challengeId}_${input.userId}`);
    debugWrites.push({ label: 'challengeMembers progress update', ref: membershipRef, payload: membershipUpdate, merge: true });
    batch.set(membershipRef, membershipUpdate, { merge: true });
    logActivitySessionDebug('committing activity session batch', {
      uid: input.userId,
      challengeId: input.challengeId,
      groupId: input.groupId,
      challengeStatus: challenge.status,
      challengeGroupId: challenge.groupId,
      challengeActivityCount: configuredActivities,
      challengeExerciseIdsCount: configuredExerciseIds,
      challengeMember: {
        id: `${input.challengeId}_${input.userId}`,
        status: membership.status,
        activitiesCompleted: Number(membership.activitiesCompleted ?? 0),
        totalActivities: Number(membership.totalActivities ?? 0),
        totalPoints: Number(membership.totalPoints ?? 0),
        completionRate: Number(membership.completionRate ?? 0),
      },
      groupMember: {
        id: `${input.groupId}_${input.userId}`,
        status: groupMember.status,
      },
      entryCount: input.entries.length,
      plannedWrites,
      plannedActivityPayloads,
      plannedChallengeMemberUpdate: summarizeActivityPayload(membershipUpdate),
      ruleRiskChecks,
      nextCompleted,
      totalActivities,
    });

    if (isDebugMode()) {
      // Runs each write individually to isolate which one fails.
      // WARNING: creates orphan activity docs; challengeMembers update is applied here
      // AND again in the batch below, so progress will be double-counted.
      // Disable debug mode immediately after identifying the failing write.
      await runIndividualWriteTests(debugWrites);
    }

    try {
      await batch.commit();
    } catch (error) {
      const firestoreError = error as Partial<FirestoreError>;
      console.error('[activityLogSessionService] batch commit failed', {
        code: firestoreError.code,
        message: error instanceof Error ? error.message : String(error),
        plannedWrites,
        challengeId: input.challengeId,
        groupId: input.groupId,
        entryCount: input.entries.length,
        entryDiagnostics: input.entries.map((entry) => ({
          source: entry.source,
          activityId: entry.activityId,
          activityType: entry.source === 'wellness' ? entry.activityType : undefined,
          value: entry.value,
          unit: entry.unit,
          targetValue: entry.targetValue,
        })),
        ruleRiskChecks,
      });
      throw error;
    }

    return {
      challengeId: input.challengeId,
      groupId: input.groupId,
      userId: input.userId,
      totalPoints,
      entries: summaryEntries,
    };
  }
}

export const activityLogSessionService = new ActivityLogSessionService();
