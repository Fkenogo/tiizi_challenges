/**
 * Task 4C — Validate repair payload for 7 Category A memberships.
 * DRY-RUN only: zero writes performed.
 */
import 'dotenv/config';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('Missing FIREBASE_PROJECT_ID');
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

// The 4 Category A challenge IDs from Task 4 audit
const CATEGORY_A_CHALLENGE_IDS = [
  '1S7cXHuHkwAONHhtSgLD',
  'K4eBvaSLKe4yi1taOWCc',
  'Uqx8beHESmfbyelkkmZ0',
  'bIMrgnrblJ0ajQaVtcnF',
];

function computeRequiredLogs(durationDays: number | undefined, activityCount: number): number {
  const days = Math.max(1, Number(durationDays) || 1);
  return Math.max(1, activityCount) * days;
}

async function run() {
  const now = Date.now();

  // Fetch all challenges
  const challengeSnaps = await Promise.all(
    CATEGORY_A_CHALLENGE_IDS.map(id => db.collection('challenges').doc(id).get())
  );
  const challenges = new Map<string, Record<string, unknown>>();
  for (const snap of challengeSnaps) {
    if (snap.exists) challenges.set(snap.id, { id: snap.id, ...snap.data() });
  }

  // Fetch all completed memberships for these challenges
  const memberSnaps = await Promise.all(
    CATEGORY_A_CHALLENGE_IDS.map(id =>
      db.collection('challengeMembers')
        .where('challengeId', '==', id)
        .where('status', '==', 'completed')
        .get()
    )
  );

  type MemberRow = {
    docId: string;
    challengeId: string;
    challengeName: string;
    userId: string;
    endDate: string;
    endDateInFuture: boolean;
    durationDays: number | undefined;
    activitiesCompleted: number;
    totalActivitiesCurrent: number;  // what's in Firestore now
    totalActivitiesCorrect: number;  // what it should be (durationDays * activityCount)
    activityCount: number;
    completionRateCurrent: number;
    completionRateAfterSimpleRevert: number;  // if only status='active', completedAt=null
    completionRateAfterFullRevert: number;    // if also totalActivities and completionRate are corrected
    simpleRevertLeavesAt100: boolean;
    recommendedPayload: Record<string, unknown>;
  };

  const rows: MemberRow[] = [];

  for (const snap of memberSnaps) {
    for (const doc of snap.docs) {
      const m = doc.data() as Record<string, unknown>;
      const challengeId = String(m.challengeId ?? '');
      const challenge = challenges.get(challengeId);
      if (!challenge) continue;

      const endDate = String(challenge.endDate ?? '');
      const endMs = Date.parse(endDate);
      const endDateInFuture = !Number.isNaN(endMs) && endMs > now;
      if (!endDateInFuture) continue; // Only Category A (future end date)

      const durationDays = challenge.durationDays !== undefined
        ? Number(challenge.durationDays)
        : undefined;
      const activities = Array.isArray(challenge.activities) ? challenge.activities : [];
      const activityCount = Math.max(1, activities.length);
      const totalActivitiesCorrect = computeRequiredLogs(durationDays, activityCount);

      const activitiesCompleted = Number(m.activitiesCompleted ?? 0);
      const totalActivitiesCurrent = Number(m.totalActivities ?? 0);
      const completionRateCurrent = Number(m.completionRate ?? 0);

      // After simple revert: only status='active', completedAt=null — nothing else changes
      const completionRateAfterSimpleRevert = completionRateCurrent; // unchanged

      // After full revert: also update totalActivities and recompute completionRate
      const completionRateAfterFullRevert = Math.min(
        100,
        Math.round((activitiesCompleted / totalActivitiesCorrect) * 100)
      );

      const simpleRevertLeavesAt100 = completionRateAfterSimpleRevert >= 100;

      // Recommended payload
      const recommendedPayload: Record<string, unknown> = {
        status: 'active',
        completedAt: null,
      };
      if (totalActivitiesCurrent !== totalActivitiesCorrect) {
        recommendedPayload.totalActivities = totalActivitiesCorrect;
      }
      if (completionRateCurrent !== completionRateAfterFullRevert) {
        recommendedPayload.completionRate = completionRateAfterFullRevert;
      }

      rows.push({
        docId: doc.id,
        challengeId,
        challengeName: String(challenge.name ?? '').slice(0, 40),
        userId: String(m.userId ?? ''),
        endDate: endDate.slice(0, 10),
        endDateInFuture,
        durationDays,
        activitiesCompleted,
        totalActivitiesCurrent,
        totalActivitiesCorrect,
        activityCount,
        completionRateCurrent,
        completionRateAfterSimpleRevert,
        completionRateAfterFullRevert,
        simpleRevertLeavesAt100,
        recommendedPayload,
      });
    }
  }

  const simpleRevertBroken = rows.filter(r => r.simpleRevertLeavesAt100);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Task 4C — Repair Payload Validation');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total Category A memberships fetched: ${rows.length}`);
  console.log(`Simple revert leaves completionRate >= 100 with status=active: ${simpleRevertBroken.length}`);

  console.log('\n─── Per-membership detail ───────────────────────────────────────');
  for (const r of rows) {
    console.log(`\nDoc: ${r.docId}`);
    console.log(`  Challenge:             ${r.challengeName} (${r.challengeId})`);
    console.log(`  User:                  ${r.userId}`);
    console.log(`  endDate:               ${r.endDate} (in future: ${r.endDateInFuture})`);
    console.log(`  durationDays:          ${r.durationDays ?? 'MISSING'}`);
    console.log(`  activityCount:         ${r.activityCount}`);
    console.log(`  activitiesCompleted:   ${r.activitiesCompleted}`);
    console.log(`  totalActivities NOW:   ${r.totalActivitiesCurrent}`);
    console.log(`  totalActivities FIX:   ${r.totalActivitiesCorrect}  (= durationDays × activityCount)`);
    console.log(`  completionRate NOW:    ${r.completionRateCurrent}%`);
    console.log(`  completionRate after simple revert (status+completedAt only): ${r.completionRateAfterSimpleRevert}%`);
    console.log(`  completionRate after full revert:  ${r.completionRateAfterFullRevert}%`);
    console.log(`  ⚠ Simple revert leaves at 100%: ${r.simpleRevertLeavesAt100}`);
    console.log(`  Recommended payload: ${JSON.stringify(r.recommendedPayload)}`);
  }

  console.log('\n─── Summary ─────────────────────────────────────────────────────');
  console.log(`Records where simple revert leaves completionRate=100 AND status=active: ${simpleRevertBroken.length}`);
  if (simpleRevertBroken.length > 0) {
    console.log('\nThese records need additional fields in the repair payload:');
    for (const r of simpleRevertBroken) {
      console.log(`  ${r.docId}`);
      console.log(`    totalActivities: ${r.totalActivitiesCurrent} → ${r.totalActivitiesCorrect}`);
      console.log(`    completionRate:  ${r.completionRateCurrent}% → ${r.completionRateAfterFullRevert}%`);
    }
  }

  console.log('\n─── Challenges with missing durationDays ────────────────────────');
  const missingDuration = rows.filter(r => r.durationDays === undefined || Number.isNaN(r.durationDays));
  if (missingDuration.length === 0) {
    console.log('None — all challenges have durationDays set.');
  } else {
    for (const r of missingDuration) {
      console.log(`  ${r.challengeName} (${r.challengeId}) — durationDays MISSING`);
    }
  }

  console.log('\n\nZERO WRITES PERFORMED — DRY-RUN ONLY.\n');

  // Return structured data for report generation
  return rows;
}

run().catch((err) => { console.error(err); process.exit(1); });
