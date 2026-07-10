/**
 * Diagnostic script: audit group feed data after a workout/wellness log.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=<path-to-sa.json> npx tsx scripts/auditGroupFeedAfterLog.ts <groupId>
 *
 * What it does:
 *   1. Queries workouts where groupId == supplied groupId (newest 10)
 *   2. Queries wellnessLogs where groupId == supplied groupId (newest 10)
 *   3. Reports document counts, key field presence, and sample payloads
 *   4. Calls groupInsightsService.getGroupFeed(groupId) and prints transformed feed
 *
 * NOTE: This script uses the Firebase Admin SDK so it bypasses security rules.
 * Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON before running.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

const groupId = process.argv[2];
if (!groupId) {
  console.error('Usage: npx tsx scripts/auditGroupFeedAfterLog.ts <groupId>');
  process.exit(1);
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error('Error: GOOGLE_APPLICATION_CREDENTIALS environment variable must be set to service account JSON path.');
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(path.resolve(credPath)) });
}
const db = getFirestore();

function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'Recently (NaN parse)';
  const deltaMs = Date.now() - ts;
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function run() {
  console.log(`\n=== Group Feed Audit: groupId="${groupId}" ===\n`);

  // ── 1. workouts query ──────────────────────────────────────────────────────
  console.log('─── workouts (groupId filter, newest 10) ───');
  let workoutDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  try {
    const snap = await db.collection('workouts')
      .where('groupId', '==', groupId)
      .orderBy('completedAt', 'desc')
      .limit(10)
      .get();
    workoutDocs = snap.docs;
    console.log(`  Found: ${snap.size} docs`);
    snap.docs.forEach((d, i) => {
      const data = d.data();
      const missing: string[] = [];
      ['groupId', 'challengeId', 'userId', 'completedAt', 'exerciseId', 'value', 'unit'].forEach((f) => {
        if (data[f] == null) missing.push(f);
      });
      console.log(`  [${i}] id=${d.id}`);
      console.log(`       groupId=${data.groupId ?? '⚠ MISSING'}`);
      console.log(`       userId=${data.userId ?? '⚠ MISSING'}`);
      console.log(`       challengeId=${data.challengeId ?? '⚠ MISSING'}`);
      console.log(`       exerciseId=${data.exerciseId ?? '⚠ MISSING'}`);
      console.log(`       value=${data.value ?? '⚠ MISSING'}, unit=${data.unit ?? '⚠ MISSING'}`);
      console.log(`       completedAt=${data.completedAt ?? '⚠ MISSING'} → ${data.completedAt ? formatRelativeTime(data.completedAt) : 'N/A'}`);
      if (missing.length) console.log(`       ⚠ MISSING FIELDS: ${missing.join(', ')}`);
    });
    if (snap.size === 0) {
      console.log('  ⚠ No workout docs found for this groupId.');
      console.log('  Possible causes: groupId not written to workout, different groupId in URL vs challenge.groupId');
    }
  } catch (err) {
    console.error('  ✗ workouts query FAILED:', (err as Error).message);
    console.log('  Possible cause: missing composite index [groupId ASC, completedAt DESC]');
  }

  // ── 2. wellnessLogs query ──────────────────────────────────────────────────
  console.log('\n─── wellnessLogs (groupId filter, newest 10) ───');
  let wellnessDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  try {
    const snap = await db.collection('wellnessLogs')
      .where('groupId', '==', groupId)
      .orderBy('loggedAt', 'desc')
      .limit(10)
      .get();
    wellnessDocs = snap.docs;
    console.log(`  Found: ${snap.size} docs`);
    snap.docs.forEach((d, i) => {
      const data = d.data();
      const loggedAt = data.loggedAt;
      const loggedAtType = loggedAt && typeof loggedAt === 'object' && typeof loggedAt.toDate === 'function'
        ? 'Timestamp (⚠ should be ISO string)'
        : typeof loggedAt === 'string'
          ? 'ISO string ✓'
          : `unknown type: ${typeof loggedAt}`;
      console.log(`  [${i}] id=${d.id}`);
      console.log(`       groupId=${data.groupId ?? '⚠ MISSING'}`);
      console.log(`       userId=${data.userId ?? '⚠ MISSING'}`);
      console.log(`       loggedAt=${loggedAt} (${loggedAtType})`);
      console.log(`       value=${data.value ?? '⚠ MISSING'}, unit=${data.unit ?? '⚠ MISSING'}`);
    });
    if (snap.size === 0) {
      console.log('  No wellnessLog docs for this groupId (OK if only fitness challenge logged).');
    }
  } catch (err) {
    console.error('  ✗ wellnessLogs query FAILED:', (err as Error).message);
    console.log('  Possible causes: missing composite index [groupId ASC, loggedAt DESC], or security rule blocking');
  }

  // ── 3. getGroupFeed simulation (admin SDK — bypasses rules) ─────────────────
  console.log('\n─── getGroupFeed simulation (admin SDK, no security rules) ───');
  try {
    const allUserIds = new Set<string>();
    workoutDocs.forEach((d) => { if (d.data().userId) allUserIds.add(d.data().userId); });
    wellnessDocs.forEach((d) => { if (d.data().userId) allUserIds.add(d.data().userId); });

    const userMap = new Map<string, string>();
    for (const uid of allUserIds) {
      const userSnap = await db.doc(`users/${uid}`).get();
      if (userSnap.exists) {
        const data = userSnap.data() as { profile?: { personalInfo?: { displayName?: string; fullName?: string } }; email?: string };
        const name = data.profile?.personalInfo?.displayName
          || data.profile?.personalInfo?.fullName
          || data.email?.split('@')[0]
          || `Member ${uid.slice(0, 6).toUpperCase()}`;
        userMap.set(uid, name);
      }
    }

    const challengeMap = new Map<string, string>();
    const challengeSnap = await db.collection('challenges').where('groupId', '==', groupId).get();
    challengeSnap.docs.forEach((d) => { challengeMap.set(d.id, (d.data() as { name?: string }).name ?? 'Group Challenge'); });

    const feedItems: Array<{ type: string; author: string; text: string; time: string }> = [];

    workoutDocs.forEach((d) => {
      const data = d.data();
      const author = userMap.get(data.userId) ?? `Member ${(data.userId ?? '').slice(0, 6).toUpperCase()}`;
      const challengeName = challengeMap.get(data.challengeId) ?? 'group challenge';
      feedItems.push({
        type: 'workout',
        author,
        text: `Completed ${data.value} ${data.unit} in ${challengeName}.`,
        time: data.completedAt ? formatRelativeTime(data.completedAt) : 'Recently',
      });
    });

    wellnessDocs.forEach((d) => {
      const data = d.data();
      const rawLoggedAt = data.loggedAt;
      const loggedAt = typeof rawLoggedAt === 'string'
        ? rawLoggedAt
        : rawLoggedAt && typeof rawLoggedAt.toDate === 'function'
          ? rawLoggedAt.toDate().toISOString()
          : '';
      const author = userMap.get(data.userId) ?? `Member ${(data.userId ?? '').slice(0, 6).toUpperCase()}`;
      const challengeName = challengeMap.get(data.challengeId) ?? 'group challenge';
      feedItems.push({
        type: 'wellness',
        author,
        text: `Logged ${data.value} ${data.unit} in ${challengeName}.`,
        time: loggedAt ? formatRelativeTime(loggedAt) : 'Recently',
      });
    });

    feedItems.sort((a, b) => {
      // rough sort by time string for display
      return 0;
    });

    console.log(`  Simulated feed items: ${feedItems.length}`);
    if (feedItems.length === 0) {
      console.log('  ⚠ Feed would show "No updates yet" — no workout or wellness docs found for groupId');
    } else {
      feedItems.forEach((item, i) => {
        console.log(`  [${i}] [${item.type}] ${item.author}: "${item.text}" — ${item.time}`);
      });
    }
  } catch (err) {
    console.error('  ✗ getGroupFeed simulation failed:', (err as Error).message);
  }

  // ── 4. Diagnosis summary ───────────────────────────────────────────────────
  console.log('\n─── Diagnosis ───');
  if (workoutDocs.length === 0 && wellnessDocs.length === 0) {
    console.log('  ✗ ROOT CAUSE: No docs in workouts or wellnessLogs for groupId=' + groupId);
    console.log('    → Workout was likely logged WITHOUT groupId in the URL (groupId not written to Firestore doc)');
    console.log('    → Check: navigate from /app/group/:id → challenge → log, not from /app/challenges directly');
  } else if (workoutDocs.length > 0) {
    console.log('  ✓ Workout docs exist for groupId. Feed should populate after security rules are deployed.');
    console.log('    → If browser still shows empty feed: deploy updated firestore.rules');
  }
  console.log('\n  Key security rule fix (Phase 18I-5A-R):');
  console.log('    wellnessLogs: allow read if isGroupMember(resource.data.groupId)');
  console.log('    Required for: getDocs(wellnessLogs where groupId==groupId)');
  console.log('    Without this: PERMISSION_DENIED → Promise.all fails → workout items also lost');
  console.log('\n  Required deploys:');
  console.log('    firebase deploy --only firestore:rules');
  console.log('    firebase deploy --only firestore:indexes');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
