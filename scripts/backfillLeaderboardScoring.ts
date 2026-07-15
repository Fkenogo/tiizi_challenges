/**
 * Leaderboard scoring backfill — P4H
 *
 * Rebuilds challengeLeaderboards.score from stored workout and wellnessLog data,
 * applying v2 scoring rules where scoringVersion == 'v2' and preserving legacy
 * behavior for older logs.
 *
 * Safety:
 *   - GOOGLE_APPLICATION_CREDENTIALS must be set.
 *   - Apply mode on production requires CONFIRM_PROJECT_ID=tiizi-challenges.
 *   - Default mode is dry-run: reads only, no writes.
 *   - Never modifies workouts or wellnessLogs.
 *   - Only writes to challengeLeaderboards.
 *
 * Usage:
 *   npm run backfill:leaderboard-scoring          # dry-run
 *   npm run backfill:leaderboard-scoring:apply    # apply (non-production)
 *   CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:leaderboard-scoring:apply
 */

import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore, type WriteBatch } from 'firebase-admin/firestore';

// ─── Startup guards ────────────────────────────────────────────────────────────

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('[backfill] ERROR: GOOGLE_APPLICATION_CREDENTIALS is not set.');
  console.error('[backfill]   Export the path to a service account key JSON before running:');
  console.error('[backfill]   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json');
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const applyMode = process.argv.includes('--apply');
const productionProjectIds = new Set(['tiizi-challenges']);

if (!projectId) {
  console.error('[backfill] ERROR: Missing FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID) env var.');
  process.exit(1);
}

if (applyMode && productionProjectIds.has(projectId) && process.env.CONFIRM_PROJECT_ID !== projectId) {
  console.error(`[backfill] ERROR: Refusing to write to production project "${projectId}".`);
  console.error(`[backfill]   Set CONFIRM_PROJECT_ID=${projectId} to confirm.`);
  process.exit(1);
}

// ─── Firebase ─────────────────────────────────────────────────────────────────

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

// ─── Scoring constants (mirrors functions/src/memberActivitySummaries.ts) ──────

const MAX_ACTIVITY_SCORE = 1000;

// ─── Types ─────────────────────────────────────────────────────────────────────

type UserDoc = {
  displayName?: string;
  email?: string;
  profile?: { personalInfo?: { fullName?: string; displayName?: string } };
};

type ScoringVersion = 'v2' | 'legacy' | 'mixed';

type LeaderboardAccumulator = {
  challengeId: string;
  groupId: string;
  userId: string;
  displayName: string;
  activityCount: number;
  score: number;
  lastActivityAt: Timestamp | undefined;
  scoringVersion: ScoringVersion;
  v2LogCount: number;
  legacyLogCount: number;
};

type ExistingLeaderboardDoc = {
  score?: number;
  activityCount?: number;
  lastScoringVersion?: string;
  displayName?: string;
};

type ScoreDelta = {
  docId: string;
  userId: string;
  challengeId: string;
  oldScore: number;
  newScore: number;
  delta: number;
  scoringVersion: ScoringVersion;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function numberValue(row: Record<string, unknown>, key: string): number {
  const v = row[key];
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function stringValue(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === 'string' ? v : '';
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function toTimestamp(value: unknown): Timestamp | undefined {
  if (value instanceof Timestamp) return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) return Timestamp.fromDate(new Date(ms));
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Timestamp.fromMillis(value);
  }
  if (value && typeof value === 'object') {
    const obj = value as { toDate?: () => Date; seconds?: number };
    if (typeof obj.toDate === 'function') return Timestamp.fromDate(obj.toDate());
    if (typeof obj.seconds === 'number') return Timestamp.fromMillis(obj.seconds * 1000);
  }
  return undefined;
}

function newerTimestamp(a: Timestamp | undefined, b: Timestamp | undefined): Timestamp | undefined {
  if (!a) return b;
  if (!b) return a;
  return a.toMillis() >= b.toMillis() ? a : b;
}

function displayNameFor(uid: string, user?: UserDoc): string {
  return user?.profile?.personalInfo?.displayName
    || user?.profile?.personalInfo?.fullName
    || user?.displayName
    || user?.email?.split('@')[0]
    || `Member ${uid.slice(0, 6).toUpperCase()}`;
}

/**
 * Mirrors summarizeWorkoutCreated scoring in functions/src/memberActivitySummaries.ts.
 * v2: stored points, clamped [0, 1000].
 * Legacy: Math.round(value), clamped [1, 1000].
 */
function workoutScore(row: Record<string, unknown>): { score: number; isV2: boolean } {
  const isV2 = stringValue(row, 'scoringVersion') === 'v2';
  if (isV2) {
    return {
      score: clampNumber(numberValue(row, 'points'), 0, MAX_ACTIVITY_SCORE),
      isV2: true,
    };
  }
  return {
    score: clampNumber(Math.round(numberValue(row, 'value')), 1, MAX_ACTIVITY_SCORE),
    isV2: false,
  };
}

/**
 * Mirrors summarizeWellnessLogCreated scoring in functions/src/memberActivitySummaries.ts.
 * v2: stored points, clamped [0, 1000].
 * Legacy: storedPoints || value || 1, clamped [1, 1000].
 */
function wellnessScore(row: Record<string, unknown>): { score: number; isV2: boolean } {
  const isV2 = stringValue(row, 'scoringVersion') === 'v2';
  if (isV2) {
    return {
      score: clampNumber(numberValue(row, 'points'), 0, MAX_ACTIVITY_SCORE),
      isV2: true,
    };
  }
  const storedPoints = numberValue(row, 'points');
  const value = numberValue(row, 'value');
  return {
    score: clampNumber(Math.round(storedPoints || value || 1), 1, MAX_ACTIVITY_SCORE),
    isV2: false,
  };
}

async function commitInChunks(writes: Array<(batch: WriteBatch) => void>): Promise<number> {
  let committed = 0;
  for (let i = 0; i < writes.length; i += 450) {
    const batch = db.batch();
    writes.slice(i, i + 450).forEach((fn) => fn(batch));
    await batch.commit();
    committed += Math.min(450, writes.length - i);
  }
  return committed;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const startedAt = Date.now();

  console.log(`[backfill] mode=${applyMode ? 'APPLY' : 'dry-run'} project=${projectId}`);
  console.log('[backfill] Reading Firestore...');

  const [usersSnap, challengesSnap, workoutsSnap, wellnessSnap, existingLeaderboardSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('challenges').get(),
    db.collection('workouts').get(),
    db.collection('wellnessLogs').get(),
    db.collection('challengeLeaderboards').get(),
  ]);

  console.log(`[backfill] Read: ${workoutsSnap.size} workouts, ${wellnessSnap.size} wellnessLogs, ${existingLeaderboardSnap.size} existing leaderboard docs`);

  // ── Build lookup maps ──────────────────────────────────────────────────────

  const users = new Map<string, UserDoc>();
  usersSnap.docs.forEach((d) => users.set(d.id, d.data() as UserDoc));

  const challengeGroupIds = new Map<string, string>();
  challengesSnap.docs.forEach((d) => {
    const groupId = stringValue(d.data() as Record<string, unknown>, 'groupId');
    if (groupId) challengeGroupIds.set(d.id, groupId);
  });

  const existingLeaderboards = new Map<string, ExistingLeaderboardDoc>();
  existingLeaderboardSnap.docs.forEach((d) => existingLeaderboards.set(d.id, d.data() as ExistingLeaderboardDoc));

  // ── Accumulate scores ──────────────────────────────────────────────────────

  const leaderboard = new Map<string, LeaderboardAccumulator>();
  let skippedWorkouts = 0;
  let skippedWellness = 0;

  function accumulate(
    row: Record<string, unknown>,
    computeScore: (row: Record<string, unknown>) => { score: number; isV2: boolean },
    timestampKeys: string[],
    source: 'workout' | 'wellness',
  ): void {
    const userId = stringValue(row, 'userId');
    const challengeId = stringValue(row, 'challengeId');
    if (!userId || !challengeId) {
      if (source === 'workout') skippedWorkouts++; else skippedWellness++;
      return;
    }
    const groupId = stringValue(row, 'groupId') || challengeGroupIds.get(challengeId) || '';
    if (!groupId) {
      if (source === 'workout') skippedWorkouts++; else skippedWellness++;
      return;
    }

    const { score, isV2 } = computeScore(row);
    const rawTs = timestampKeys.map((k) => toTimestamp(row[k])).find((t) => t !== undefined);
    const key = `${challengeId}_${userId}`;

    const acc = leaderboard.get(key) ?? {
      challengeId,
      groupId,
      userId,
      displayName: displayNameFor(userId, users.get(userId)),
      activityCount: 0,
      score: 0,
      lastActivityAt: undefined,
      scoringVersion: isV2 ? 'v2' as ScoringVersion : 'legacy' as ScoringVersion,
      v2LogCount: 0,
      legacyLogCount: 0,
    };

    acc.activityCount += 1;
    acc.score += score;
    acc.lastActivityAt = newerTimestamp(acc.lastActivityAt, rawTs);
    if (isV2) acc.v2LogCount++; else acc.legacyLogCount++;
    leaderboard.set(key, acc);
  }

  workoutsSnap.docs.forEach((d) =>
    accumulate(d.data() as Record<string, unknown>, workoutScore, ['completedAt', 'loggedAt', 'createdAt'], 'workout'),
  );
  wellnessSnap.docs.forEach((d) =>
    accumulate(d.data() as Record<string, unknown>, wellnessScore, ['loggedAt', 'createdAt', 'date'], 'wellness'),
  );

  // Finalize scoringVersion for mixed entries
  leaderboard.forEach((entry) => {
    if (entry.v2LogCount > 0 && entry.legacyLogCount > 0) entry.scoringVersion = 'mixed';
    else if (entry.v2LogCount > 0) entry.scoringVersion = 'v2';
    else entry.scoringVersion = 'legacy';
  });

  // ── Compute deltas for reporting ───────────────────────────────────────────

  const scoreDeltas: ScoreDelta[] = [];
  leaderboard.forEach((entry, docId) => {
    const existing = existingLeaderboards.get(docId);
    const oldScore = existing?.score ?? 0;
    const delta = entry.score - oldScore;
    scoreDeltas.push({
      docId,
      userId: entry.userId,
      challengeId: entry.challengeId,
      oldScore,
      newScore: entry.score,
      delta,
      scoringVersion: entry.scoringVersion,
    });
  });

  // Docs in existing leaderboard not covered by any logs (stale entries)
  const staleDocIds: string[] = [];
  existingLeaderboards.forEach((_, docId) => {
    if (!leaderboard.has(docId)) staleDocIds.push(docId);
  });

  // ── Build write operations ─────────────────────────────────────────────────
  // Writes ONLY to challengeLeaderboards. workouts and wellnessLogs are never touched.

  const writes: Array<(batch: WriteBatch) => void> = [];

  leaderboard.forEach((entry, docId) => {
    writes.push((batch) => {
      batch.set(
        db.collection('challengeLeaderboards').doc(docId),
        {
          challengeId: entry.challengeId,
          groupId: entry.groupId,
          userId: entry.userId,
          displayName: entry.displayName,
          activityCount: entry.activityCount,
          score: entry.score,
          lastActivityAt: entry.lastActivityAt ?? FieldValue.serverTimestamp(),
          lastScoringVersion: entry.scoringVersion,
          backfilledAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
  });

  // ── Apply (or skip) ────────────────────────────────────────────────────────

  const committedWrites = applyMode ? await commitInChunks(writes) : 0;

  // ── Report ────────────────────────────────────────────────────────────────

  const totalV2Logs = Array.from(leaderboard.values()).reduce((s, e) => s + e.v2LogCount, 0);
  const totalLegacyLogs = Array.from(leaderboard.values()).reduce((s, e) => s + e.legacyLogCount, 0);
  const docsWithDelta = scoreDeltas.filter((d) => d.delta !== 0);

  const report = {
    mode: applyMode ? 'APPLY' : 'dry-run',
    projectId,
    durationMs: Date.now() - startedAt,
    reads: {
      users: usersSnap.size,
      challenges: challengesSnap.size,
      workouts: workoutsSnap.size,
      wellnessLogs: wellnessSnap.size,
      existingLeaderboardDocs: existingLeaderboardSnap.size,
    },
    logs: {
      workoutsProcessed: workoutsSnap.size - skippedWorkouts,
      workoutsSkipped: skippedWorkouts,
      wellnessProcessed: wellnessSnap.size - skippedWellness,
      wellnessSkipped: skippedWellness,
      v2Logs: totalV2Logs,
      legacyLogs: totalLegacyLogs,
    },
    plannedWrites: {
      challengeLeaderboardDocs: writes.length,
      v2OnlyEntries: Array.from(leaderboard.values()).filter((e) => e.scoringVersion === 'v2').length,
      mixedEntries: Array.from(leaderboard.values()).filter((e) => e.scoringVersion === 'mixed').length,
      legacyOnlyEntries: Array.from(leaderboard.values()).filter((e) => e.scoringVersion === 'legacy').length,
    },
    scoreChanges: {
      docsWithScoreDelta: docsWithDelta.length,
      docsUnchanged: scoreDeltas.length - docsWithDelta.length,
      staleLeaderboardDocs: staleDocIds.length,
      // Top 10 largest absolute score changes for manual review
      sampleChanges: docsWithDelta
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 10)
        .map((d) => ({
          docId: d.docId,
          userId: `${d.userId.slice(0, 8)}…`,
          challengeId: `${d.challengeId.slice(0, 8)}…`,
          oldScore: d.oldScore,
          newScore: d.newScore,
          delta: d.delta >= 0 ? `+${d.delta}` : String(d.delta),
          scoringVersion: d.scoringVersion,
        })),
    },
    committedWrites: applyMode ? committedWrites : 0,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!applyMode) {
    console.log('\n[backfill] Dry-run complete — no writes performed.');
    console.log('[backfill] Re-run with --apply to write leaderboard documents.');
    if (productionProjectIds.has(projectId ?? '')) {
      console.log(`[backfill] For production: CONFIRM_PROJECT_ID=${projectId} npm run backfill:leaderboard-scoring:apply`);
    }
  } else {
    console.log(`\n[backfill] Apply complete — ${committedWrites} challengeLeaderboards docs written.`);
  }
}

run().catch((err) => {
  console.error('[backfill] Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
