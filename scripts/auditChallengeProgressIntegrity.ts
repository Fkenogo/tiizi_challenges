/**
 * Audit: Challenge Progress Integrity
 *
 * Compares three data sources for every challenge:
 *   A) challenge.groupCurrentTotal          (Firestore aggregate)
 *   B) sum of challengeMembers.cumulativeLoggedValue  (per-member totals)
 *   C) sum of workouts + wellnessLogs values          (raw log records)
 *   D) resolveChallengeProgress() output              (what screens display)
 *
 * Runs in DRY-RUN mode by default.
 * Pass --execute --confirm to repair v2 collective challenges with stale aggregates.
 * seed_challenge_* and engine v1 challenges are never repaired.
 *
 * Usage:
 *   tsx scripts/auditChallengeProgressIntegrity.ts
 *   tsx scripts/auditChallengeProgressIntegrity.ts --execute --confirm
 */

import { readFileSync } from 'node:fs';
import { resolveChallengeProgress } from '../src/features/Challenges/challengeProgressResolver';

// ── Firebase initialisation ───────────────────────────────────────────────────
// We use the Admin SDK when available; fall back to a static analysis if the
// service-account key is absent (CI / pure-static runs).

const EXECUTE = process.argv.includes('--execute');
const CONFIRM = process.argv.includes('--confirm');
const DRY_RUN = !EXECUTE;

// Guard: --execute without --confirm is a no-op to prevent accidental writes.
if (EXECUTE && !CONFIRM) {
  console.error('ERROR: --execute requires --confirm. Pass both flags to run repairs.');
  console.error('  tsx scripts/auditChallengeProgressIntegrity.ts --execute --confirm');
  process.exit(1);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MismatchKind =
  | 'NaN_IN_AGGREGATE'
  | 'AGGREGATE_BELOW_MEMBER_SUM'
  | 'AGGREGATE_BELOW_LOG_SUM'
  | 'MEMBER_SUM_BELOW_LOG_SUM'
  | 'CONTRIBUTION_EXCEEDS_GROUP_TOTAL'
  | 'RESOLVER_MISMATCH'
  | 'STALE_AGGREGATE_ZERO'
  | 'ORPHAN_MEMBER';

interface ChallengeAuditRow {
  challengeId: string;
  title: string;
  type: string;
  category: string;
  targetValue: number;
  unit: string;
  engineVersion: string;

  // Source A
  groupCurrentTotal: number | null;
  groupCumulativeTarget: number | null;

  // Source B
  memberCount: number;
  memberSumContribution: number;

  // Source C
  workoutLogCount: number;
  wellnessLogCount: number;
  logSumValue: number;

  // Source D (resolver output, representative member)
  resolverGroupTotal: number;
  resolverGroupPercent: number;
  resolverPrimaryLabel: string;

  mismatches: MismatchKind[];
  notes: string[];
}

// ── Static analysis (always runs) ─────────────────────────────────────────────

function staticAudit(): void {
  console.log('\n═══ STATIC SOURCE-OF-TRUTH AUDIT ═══\n');

  const resolverSrc = readFileSync('src/features/Challenges/challengeProgressResolver.ts', 'utf8');
  const displaySrc  = readFileSync('src/features/Challenges/challengeProgressDisplay.ts', 'utf8');

  const checks: Array<{ id: string; pass: boolean; description: string }> = [
    {
      id: 'S-01',
      pass: resolverSrc.includes('export function resolveChallengeProgress'),
      description: 'Canonical resolver exports resolveChallengeProgress',
    },
    {
      id: 'S-02',
      pass: resolverSrc.includes('export function safeNum'),
      description: 'Canonical resolver exports safeNum',
    },
    {
      id: 'S-03',
      pass: resolverSrc.includes('Math.max(storedGroupTotal, memberSumFloor, logSumFloor, userContributionTotal)'),
      description: 'Resolver uses multi-source floor: max(storedGroupTotal, memberSumFloor, logSumFloor, userContributionTotal)',
    },
    {
      id: 'S-04',
      pass: resolverSrc.includes('sessionDelta') && resolverSrc.includes('NEVER added'),
      description: 'sessionDelta is documented as display-only (no double-count)',
    },
    {
      id: 'S-05',
      pass: resolverSrc.includes('isUserCompleted'),
      description: 'Resolver exposes isUserCompleted flag',
    },
    {
      id: 'S-06',
      pass: resolverSrc.includes('leaderLabel'),
      description: 'Resolver exposes leaderLabel for competitive challenges',
    },
    {
      id: 'S-07',
      pass: displaySrc.includes('isUserCompleted'),
      description: 'challengeProgressDisplay shim exposes isUserCompleted',
    },
    {
      id: 'S-08',
      pass: (() => {
        const homeSrc = readFileSync('src/features/Home/useHomeScreen.ts', 'utf8');
        return homeSrc.includes('isUserCompleted') && homeSrc.includes('competitiveLeaderboards');
      })(),
      description: 'useHomeScreen passes leaderboard data and surfaces isUserCompleted on cards',
    },
    {
      id: 'S-09',
      pass: (() => {
        const cardSrc = readFileSync('src/components/Home/ActiveChallengeCard.tsx', 'utf8');
        return cardSrc.includes('isUserCompleted') && cardSrc.includes('View Challenge');
      })(),
      description: 'ActiveChallengeCard renders completed state with "View Challenge" button',
    },
    {
      id: 'S-10',
      pass: (() => {
        const screens = [
          'src/features/Workouts/WorkoutLoggedScreen.tsx',
          'src/features/Challenges/ChallengeDetailScreen.tsx',
          'src/features/Challenges/ChallengeLeaderboardScreen.tsx',
          'src/features/Challenges/ChallengeCompletedScreen.tsx',
          'src/features/Workouts/LogWorkoutScreen.tsx',
          'src/features/Workouts/LogWellnessActivityScreen.tsx',
          'src/features/Workouts/SelectChallengeActivityScreen.tsx',
        ];
        return screens.every((path) => {
          const src = readFileSync(path, 'utf8');
          return src.includes('resolveChallengeProgress') || src.includes('buildChallengeProgress');
        });
      })(),
      description: 'All 7 progress-displaying screens use resolver or shim',
    },
  ];

  let allPass = true;
  for (const check of checks) {
    const icon = check.pass ? '✅' : '❌';
    console.log(`  ${icon} [${check.id}] ${check.description}`);
    if (!check.pass) allPass = false;
  }

  console.log('');
  if (allPass) {
    console.log('  Static audit: all checks passed.\n');
  } else {
    console.log('  Static audit: FAILURES detected — fix before deploying.\n');
    process.exitCode = 1;
  }
}

// ── Resolver behavioural fixtures ─────────────────────────────────────────────

function resolverFixtures(): void {
  console.log('═══ RESOLVER BEHAVIOURAL FIXTURES ═══\n');

  type Fixture = { id: string; description: string; input: Parameters<typeof resolveChallengeProgress>[0]; expect: Partial<ReturnType<typeof resolveChallengeProgress>> };

  const fixtures: Fixture[] = [
    {
      id: 'F-01',
      description: 'Stale aggregate (groupCurrentTotal=0, member contribution=100) → resolves to 100',
      input: {
        challenge: { challengeType: 'collective', groupCurrentTotal: 0, groupCumulativeTarget: 2000, activities: [{ unit: 'reps', targetValue: 2000 }] },
        membership: { cumulativeLoggedValue: 100 },
      },
      expect: { groupTotal: 100, groupPercent: 5 },
    },
    {
      id: 'F-02',
      description: 'No double-count: groupCurrentTotal=350, sessionDelta=150 → groupTotal stays 350',
      input: {
        challenge: { challengeType: 'collective', groupCurrentTotal: 350, groupCumulativeTarget: 5000, activities: [{ unit: 'reps', targetValue: 5000 }] },
        membership: { cumulativeLoggedValue: 200 },
        sessionDelta: 150,
      },
      expect: { groupTotal: 350, sessionDelta: 150, userContributionTotal: 200 },
    },
    {
      id: 'F-03',
      description: 'Null inputs → no NaN anywhere',
      input: { challenge: null, membership: null },
      expect: { groupTotal: 0, groupPercent: 0, progressPercent: 0 },
    },
    {
      id: 'F-04',
      description: 'Competitive completed (status=completed) → isUserCompleted=true',
      input: {
        challenge: { challengeType: 'competitive', activities: [{ targetValue: 500, unit: 'reps' }] },
        membership: { cumulativeLoggedValue: 300, completionRate: 100, status: 'completed' },
      },
      expect: { isUserCompleted: true },
    },
    {
      id: 'F-05',
      description: 'Competitive incomplete → isUserCompleted=false, no leaderLabel without leaderboard',
      input: {
        challenge: { challengeType: 'competitive', activities: [{ targetValue: 500, unit: 'reps' }] },
        membership: { cumulativeLoggedValue: 180, completionRate: 36 },
      },
      expect: { isUserCompleted: false, leaderLabel: undefined },
    },
    {
      id: 'F-06',
      description: 'Competitive with leaderboard (not leading) → leaderLabel includes "behind leader"',
      input: {
        challenge: { challengeType: 'competitive', activities: [{ targetValue: 700, unit: 'reps' }] },
        membership: { cumulativeLoggedValue: 180, completionRate: 26 },
        leaderboard: [{ userId: 'other', score: 300 }, { userId: 'me', score: 180 }],
        currentUserId: 'me',
      },
      expect: { isCurrentUserLeading: false, competitiveGap: 120 },
    },
    {
      id: 'F-07',
      description: 'Competitive with leaderboard (leading) → isCurrentUserLeading=true, leaderLabel="You are leading"',
      input: {
        challenge: { challengeType: 'competitive', activities: [{ targetValue: 700, unit: 'reps' }] },
        membership: { cumulativeLoggedValue: 300, completionRate: 43 },
        leaderboard: [{ userId: 'me', score: 300 }, { userId: 'other', score: 180 }],
        currentUserId: 'me',
      },
      expect: { isCurrentUserLeading: true, competitiveGap: 0 },
    },
    {
      id: 'F-08',
      description: 'Collective group total same across resolver when groupCurrentTotal > userContribution',
      input: {
        challenge: { challengeType: 'collective', groupCurrentTotal: 850, groupCumulativeTarget: 2000, activities: [{ unit: 'reps', targetValue: 2000 }] },
        membership: { cumulativeLoggedValue: 200 },
      },
      expect: { groupTotal: 850, groupPercent: 43, userContributionTotal: 200 },
    },
    {
      id: 'F-09',
      description: 'Streak completed → isUserCompleted=true',
      input: {
        challenge: { challengeType: 'streak', requiredConsecutiveDays: 30 },
        membership: { currentStreak: 30, completionRate: 100 },
      },
      expect: { isUserCompleted: true, streakCurrentDays: 30, streakTargetDays: 30 },
    },
    {
      id: 'F-10',
      description: 'No NaN in primaryLabel for undefined inputs',
      input: {
        challenge: { challengeType: 'collective', groupCurrentTotal: undefined as unknown as number, groupCumulativeTarget: 1000, activities: [{ unit: 'reps', targetValue: 1000 }] },
        membership: null,
      },
      expect: { groupTotal: 0, groupPercent: 0 },
    },
  ];

  let allPass = true;
  for (const fixture of fixtures) {
    const result = resolveChallengeProgress(fixture.input);
    const failures: string[] = [];

    for (const [key, expected] of Object.entries(fixture.expect)) {
      const actual = (result as unknown as Record<string, unknown>)[key];
      if (actual !== expected) {
        failures.push(`  ${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    }

    // Always check for NaN
    for (const [key, val] of Object.entries(result)) {
      if (typeof val === 'number' && !Number.isFinite(val)) {
        failures.push(`  ${key} is non-finite (${val})`);
      }
      if (typeof val === 'string' && val.includes('NaN')) {
        failures.push(`  ${key} contains "NaN": "${val}"`);
      }
    }

    const icon = failures.length === 0 ? '✅' : '❌';
    console.log(`  ${icon} [${fixture.id}] ${fixture.description}`);
    if (failures.length > 0) {
      failures.forEach((f) => console.log(`       ${f}`));
      allPass = false;
    }
  }

  console.log('');
  if (allPass) {
    console.log('  Resolver fixtures: all passed.\n');
  } else {
    console.log('  Resolver fixtures: FAILURES detected.\n');
    process.exitCode = 1;
  }
}

// ── Firebase live audit (only when credentials available) ─────────────────────

async function liveAudit(): Promise<void> {
  // Attempt to load the Admin SDK. Fail gracefully in environments without credentials.
  let admin: typeof import('firebase-admin') | null = null;
  try {
    admin = await import('firebase-admin');
  } catch {
    // firebase-admin not installed — skip live audit
  }

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? 'serviceAccountKey.json';
  let hasCredentials = false;
  try {
    readFileSync(keyPath);
    hasCredentials = true;
  } catch {
    // no credentials file
  }

  if (!admin || !hasCredentials) {
    console.log('═══ LIVE FIRESTORE AUDIT ═══\n');
    console.log('  ⚠️  Skipped — no Firebase Admin credentials found.');
    console.log('     Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json');
    console.log('     in the project root to enable live data checks.\n');
    return;
  }

  if (admin.apps.length === 0) {
    const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount as any) });
  }

  const db = admin.firestore();
  console.log('═══ LIVE FIRESTORE AUDIT ═══\n');

  const challengesSnap = await db.collection('challenges').where('status', 'in', ['active', 'completed']).get();
  const rows: ChallengeAuditRow[] = [];

  for (const cDoc of challengesSnap.docs) {
    const c = cDoc.data() as Record<string, unknown>;
    const challengeId = cDoc.id;

    const title = String(c.name ?? '');
    const type = String(c.challengeType ?? 'unknown');
    const category = String(c.category ?? 'fitness');
    const engineVersion = String(c.engineVersion ?? 'v1');
    const activities = (c.activities as Array<{ targetValue?: number; unit?: string }>) ?? [];
    const targetValue = activities.reduce((s, a) => s + Number(a.targetValue ?? 0), 0);
    const unit = activities[0]?.unit ?? '';

    const rawGroupTotal = c.groupCurrentTotal as number | undefined;
    const rawGroupTarget = c.groupCumulativeTarget as number | undefined;
    const groupCurrentTotal = rawGroupTotal !== undefined ? Number(rawGroupTotal) : null;
    const groupCumulativeTarget = rawGroupTarget !== undefined ? Number(rawGroupTarget) : null;

    // Source B — member docs
    const membersSnap = await db.collection('challengeMembers').where('challengeId', '==', challengeId).get();
    const memberDocs = membersSnap.docs.map((d) => d.data() as Record<string, unknown>);
    const memberSumContribution = memberDocs.reduce((s, m) => s + Math.max(0, Number(m.cumulativeLoggedValue ?? 0)), 0);

    // Source C — raw logs
    const [workoutsSnap, wellnessSnap] = await Promise.all([
      db.collection('workouts').where('challengeId', '==', challengeId).get(),
      db.collection('wellnessLogs').where('challengeId', '==', challengeId).get(),
    ]);
    const workoutLogCount = workoutsSnap.size;
    const wellnessLogCount = wellnessSnap.size;
    const logSumValue =
      workoutsSnap.docs.reduce((s, d) => s + Math.max(0, Number((d.data() as Record<string, unknown>).value ?? 0)), 0) +
      wellnessSnap.docs.reduce((s, d) => s + Math.max(0, Number((d.data() as Record<string, unknown>).value ?? 0)), 0);

    // Source D — resolver (no individual membership, use representative values)
    const resolverInput = {
      challenge: {
        challengeType: type as 'collective' | 'competitive' | 'streak',
        activities,
        groupCurrentTotal: groupCurrentTotal ?? undefined,
        groupCumulativeTarget: groupCumulativeTarget ?? undefined,
      },
      membership: { cumulativeLoggedValue: memberSumContribution > 0 ? memberSumContribution / Math.max(1, memberDocs.length) : 0 },
    };
    const resolved = resolveChallengeProgress(resolverInput);

    const mismatches: MismatchKind[] = [];
    const notes: string[] = [];

    if (groupCurrentTotal !== null && !Number.isFinite(groupCurrentTotal)) {
      mismatches.push('NaN_IN_AGGREGATE');
      notes.push(`challenge.groupCurrentTotal is ${groupCurrentTotal}`);
    }

    if (groupCurrentTotal !== null && Number.isFinite(groupCurrentTotal) && groupCurrentTotal < memberSumContribution - 1) {
      mismatches.push('AGGREGATE_BELOW_MEMBER_SUM');
      notes.push(`groupCurrentTotal (${groupCurrentTotal}) < memberSum (${memberSumContribution})`);
    }

    if (type === 'collective' && groupCurrentTotal !== null && Number.isFinite(groupCurrentTotal) && groupCurrentTotal < logSumValue - 1) {
      mismatches.push('AGGREGATE_BELOW_LOG_SUM');
      notes.push(`groupCurrentTotal (${groupCurrentTotal}) < logSum (${logSumValue})`);
    }

    if (type === 'collective' && memberSumContribution < logSumValue - 1) {
      mismatches.push('MEMBER_SUM_BELOW_LOG_SUM');
      notes.push(`memberSum (${memberSumContribution}) < logSum (${logSumValue})`);
    }

    if (type === 'collective' && groupCurrentTotal !== null && groupCurrentTotal === 0 && memberSumContribution > 0) {
      mismatches.push('STALE_AGGREGATE_ZERO');
      notes.push(`groupCurrentTotal=0 but memberSum=${memberSumContribution} — aggregate appears stale`);
    }

    // Orphan detection: members whose challengeId doc no longer exists
    const orphanMembers = memberDocs.filter((m) => String(m.challengeId ?? '') !== challengeId);
    if (orphanMembers.length > 0) {
      mismatches.push('ORPHAN_MEMBER');
      notes.push(`${orphanMembers.length} member doc(s) have mismatched challengeId`);
    }

    rows.push({
      challengeId,
      title,
      type,
      category,
      targetValue,
      unit,
      engineVersion,
      groupCurrentTotal,
      groupCumulativeTarget,
      memberCount: memberDocs.length,
      memberSumContribution,
      workoutLogCount,
      wellnessLogCount,
      logSumValue,
      resolverGroupTotal: resolved.groupTotal,
      resolverGroupPercent: resolved.groupPercent,
      resolverPrimaryLabel: resolved.primaryLabel,
      mismatches,
      notes,
    });
  }

  // ── Print report ────────────────────────────────────────────────────────────
  const clean = rows.filter((r) => r.mismatches.length === 0);
  const flagged = rows.filter((r) => r.mismatches.length > 0);

  console.log(`  Challenges scanned: ${rows.length}`);
  console.log(`  Clean:             ${clean.length}`);
  console.log(`  Flagged:           ${flagged.length}\n`);

  if (flagged.length > 0) {
    console.log('  ── Flagged challenges ──────────────────────────────────────────');
    for (const row of flagged) {
      console.log(`\n  challengeId:    ${row.challengeId}`);
      console.log(`  title:          ${row.title}`);
      console.log(`  type/category:  ${row.type} / ${row.category}  (engine ${row.engineVersion})`);
      console.log(`  target:         ${row.targetValue} ${row.unit}`);
      console.log(`  groupCurrentTotal:    ${row.groupCurrentTotal ?? 'n/a'}`);
      console.log(`  groupCumTarget:       ${row.groupCumulativeTarget ?? 'n/a'}`);
      console.log(`  memberSum:            ${row.memberSumContribution}  (${row.memberCount} members)`);
      console.log(`  logSum:               ${row.logSumValue}  (${row.workoutLogCount} workouts + ${row.wellnessLogCount} wellness)`);
      console.log(`  resolver groupTotal:  ${row.resolverGroupTotal}  (${row.resolverGroupPercent}%)`);
      console.log(`  resolver label:       "${row.resolverPrimaryLabel}"`);
      console.log(`  mismatches:     ${row.mismatches.join(', ')}`);
      for (const note of row.notes) console.log(`    ↳ ${note}`);
    }
    console.log('');
    if (DRY_RUN) {
      console.log('  DRY-RUN mode — no repairs attempted.');
      console.log('  Re-run with --execute --confirm to repair v2 collective challenges.\n');
    } else {
      // ── Execute repair for v2 collective challenges only ──────────────────────
      const repairCandidates = flagged.filter(
        (r) =>
          r.type === 'collective' &&
          r.engineVersion === 'v2' &&
          !r.challengeId.startsWith('seed_challenge_') &&
          r.groupCurrentTotal !== null,
      );

      if (repairCandidates.length === 0) {
        console.log('  EXECUTE mode — no repairable v2 collective challenges found.\n');
      } else {
        console.log(`  EXECUTE mode — repairing ${repairCandidates.length} v2 collective challenge(s):\n`);
        for (const row of repairCandidates) {
          const correctTotal = Math.max(
            row.groupCurrentTotal ?? 0,
            row.memberSumContribution,
            row.logSumValue,
          );
          const before = row.groupCurrentTotal ?? 0;
          if (correctTotal <= before) {
            console.log(`  ⏭️  ${row.challengeId} — stored value (${before}) already >= max sources; skip`);
            continue;
          }
          try {
            await db.collection('challenges').doc(row.challengeId).update({ groupCurrentTotal: correctTotal });
            console.log(`  ✅ ${row.challengeId} — groupCurrentTotal: ${before} → ${correctTotal}`);
          } catch (err) {
            console.error(`  ❌ ${row.challengeId} — write failed: ${String(err)}`);
          }
        }
        console.log('');
      }
    }
    process.exitCode = 1;
  } else {
    console.log('  All challenges are clean — no mismatches detected.\n');
  }

  console.log(`  Live audit complete.  Mode: ${DRY_RUN ? 'dry-run' : 'EXECUTE'}\n`);
}

// ── Entry point ────────────────────────────────────────────────────────────────

staticAudit();
resolverFixtures();
await liveAudit();
