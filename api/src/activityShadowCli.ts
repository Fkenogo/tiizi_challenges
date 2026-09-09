import 'dotenv/config';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createPool, databaseUrl, type Db } from './db.js';
import { normalizeRow, type ActivityEventRow } from './activityEvents.js';
import { replayChallengeEvents } from './activityReplay.js';
import {
  compareReplayToFirestore,
  type FirestoreMemberSnapshot,
  type ShadowReport,
} from './activityShadow.js';
import type { ChallengeContext } from './engine/types.js';

/**
 * Read-only shadow comparison: replay the PostgreSQL event ledger through the
 * vendored engines and compare against Firestore derived truth.
 *
 * Usage: npm run shadow:activities
 * Writes nothing on either side. Exits non-zero when any material (class C)
 * mismatch exists. Class B (explainable legacy-stale) is reported, not fatal.
 */

interface ChallengeDoc {
  challengeType?: string;
  engineVersion?: string;
  targetType?: string;
  durationDays?: number;
  activities?: Array<{ exerciseId?: string; activityId?: string; targetValue?: number; targetType?: string }>;
  startDate?: string;
  endDate?: string;
  groupCumulativeTarget?: number;
  autoCompleteOnGroupTarget?: boolean;
  requiredConsecutiveDays?: number;
  streakResetOnMiss?: boolean;
  groupCurrentTotal?: number;
}

export interface ShadowRunReport {
  challenges: ShadowReport[];
  skipped: Array<{ legacyChallengeId: string; reason: string }>;
  counts: { A: number; B: number; C: number };
  hasMaterialMismatch: boolean;
}

function toChallengeContext(challengeId: string, doc: ChallengeDoc): ChallengeContext | null {
  if (doc.engineVersion !== 'v2') return null;
  const challengeType = doc.challengeType;
  if (challengeType !== 'collective' && challengeType !== 'competitive' && challengeType !== 'streak') return null;
  return {
    challengeId,
    challengeType,
    engineVersion: 'v2',
    targetType: doc.targetType === 'daily' || doc.targetType === 'cumulative' || doc.targetType === 'group-pool'
      ? doc.targetType
      : 'daily',
    durationDays: typeof doc.durationDays === 'number' && doc.durationDays > 0 ? Math.floor(doc.durationDays) : 1,
    activities: (doc.activities ?? []).map((a) => ({
      exerciseId: a.exerciseId,
      activityId: a.activityId,
      targetValue: typeof a.targetValue === 'number' ? a.targetValue : 0,
      unit: '',
    })),
    startDate: typeof doc.startDate === 'string' ? doc.startDate : '',
    endDate: typeof doc.endDate === 'string' ? doc.endDate : '',
    groupCumulativeTarget: doc.groupCumulativeTarget,
    autoCompleteOnGroupTarget: doc.autoCompleteOnGroupTarget,
    requiredConsecutiveDays: doc.requiredConsecutiveDays,
    streakResetOnMiss: doc.streakResetOnMiss,
  };
}

export async function runShadowComparison(db: Db): Promise<ShadowRunReport> {
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  const fs = getFirestore();
  const memberRows = await db.query<{ member_id: string; auth_subject: string }>(
    `SELECT member_id, auth_subject FROM members WHERE auth_provider = 'firebase'`,
  );
  const memberByUid = new Map(memberRows.rows.map((r) => [String(r.auth_subject), String(r.member_id)]));

  const challengeIds = await db.query<{ legacy_challenge_id: string }>(
    `SELECT DISTINCT legacy_challenge_id FROM activity_events WHERE legacy_challenge_id IS NOT NULL`,
  );
  const challenges: ShadowReport[] = [];
  const skipped: ShadowRunReport['skipped'] = [];
  const counts = { A: 0, B: 0, C: 0 };

  for (const { legacy_challenge_id: challengeId } of challengeIds.rows) {
    const challengeSnap = await fs.collection('challenges').doc(challengeId).get();
    if (!challengeSnap.exists) {
      skipped.push({ legacyChallengeId: challengeId, reason: 'missing_challenge_doc' });
      continue;
    }
    const context = toChallengeContext(challengeId, challengeSnap.data() as ChallengeDoc);
    if (!context) {
      skipped.push({ legacyChallengeId: challengeId, reason: 'unsupported_engine_version_or_type' });
      continue;
    }
    const rawEvents = await db.query(
      `SELECT * FROM v_activity_events_effective WHERE legacy_challenge_id = $1
       ORDER BY occurred_at ASC, recorded_at ASC, event_id ASC`,
      [challengeId],
    );
    const events = rawEvents.rows.map((r) =>
      normalizeRow(r as unknown as ActivityEventRow & { metadata: unknown }),
    );
    const replay = replayChallengeEvents(events, context);

    const membersSnap = await fs.collection('challengeMembers').where('challengeId', '==', challengeId).get();
    const firestoreMembers: FirestoreMemberSnapshot[] = [];
    for (const doc of membersSnap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const uid = typeof data.userId === 'string' ? data.userId : '';
      const memberId = memberByUid.get(uid);
      if (!memberId) continue;
      const lastActivity = data.lastActivityAt;
      firestoreMembers.push({
        memberId,
        status: typeof data.status === 'string' ? data.status : undefined,
        activitiesCompleted: typeof data.activitiesCompleted === 'number' ? data.activitiesCompleted : undefined,
        completionRate: typeof data.completionRate === 'number' ? data.completionRate : undefined,
        totalPoints: typeof data.totalPoints === 'number' ? data.totalPoints : undefined,
        currentStreak: typeof data.currentStreak === 'number' ? data.currentStreak : undefined,
        longestStreak: typeof data.longestStreak === 'number' ? data.longestStreak : undefined,
        cumulativeLoggedValue: typeof data.cumulativeLoggedValue === 'number' ? data.cumulativeLoggedValue : undefined,
        lastActivityAt:
          typeof lastActivity === 'string' ? lastActivity
          : lastActivity instanceof Date ? lastActivity.toISOString()
          : typeof (lastActivity as { toDate?: unknown })?.toDate === 'function'
            ? ((lastActivity as { toDate: () => Date }).toDate().toISOString())
            : null,
      });
    }

    let firestoreGroupTotal: number | undefined;
    let firestoreGroupTotalSource: string | undefined;
    if (context.challengeType === 'collective') {
      const summarySnap = await fs.collection('challengeActivitySummaries').doc(challengeId).get();
      const summaryTotal = summarySnap.exists
        ? (summarySnap.data() as { totalValue?: unknown }).totalValue
        : undefined;
      if (typeof summaryTotal === 'number') {
        firestoreGroupTotal = summaryTotal;
        firestoreGroupTotalSource = 'challengeActivitySummaries.totalValue';
      } else if (typeof (challengeSnap.data() as ChallengeDoc).groupCurrentTotal === 'number') {
        firestoreGroupTotal = (challengeSnap.data() as ChallengeDoc).groupCurrentTotal as number;
        firestoreGroupTotalSource = 'challenges.groupCurrentTotal';
      }
    }
    const lastOccurred = events.length > 0 ? events[events.length - 1].occurred_at : undefined;
    const report = compareReplayToFirestore(replay, firestoreMembers, {
      firestoreGroupTotal,
      firestoreGroupTotalSource,
      lastReplayOccurredAt: lastOccurred,
    });
    challenges.push(report);
    counts.A += report.counts.A;
    counts.B += report.counts.B;
    counts.C += report.counts.C;
  }

  return { challenges, skipped, counts, hasMaterialMismatch: counts.C > 0 };
}

async function main(): Promise<void> {
  const db = createPool(databaseUrl());
  try {
    const report = await runShadowComparison(db);
    console.log(JSON.stringify(report, null, 2));
    if (report.hasMaterialMismatch) process.exitCode = 1;
  } finally {
    await db.close();
  }
}

const invokedAsCli =
  process.argv[1]?.endsWith('activityShadowCli.ts') ||
  process.argv[1]?.endsWith('activityShadowCli.js');
if (invokedAsCli) void main();

export type { Db };
