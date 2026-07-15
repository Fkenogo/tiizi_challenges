/**
 * Diagnostic script: Browse Challenges permission-denied investigation
 *
 * Run with:
 *   FIREBASE_PROJECT_ID=tiizi-challenges npx tsx scripts/diagnoseBrowseChallengesPermission.ts
 *
 * This script does NOT modify any data. It performs read-only queries via the
 * Firebase Admin SDK (bypasses security rules) to check document field presence
 * and prints the exact queries the Browse screen sends, so they can be replayed
 * in the Firebase Rules Playground.
 *
 * Output:
 *   - Total challenges and how many have visibility/groupVisibility fields
 *   - First 5 public challenge IDs and their exact field set
 *   - The exact query and rule condition that would be evaluated
 *   - Number of active challenges per group (used to estimate get() call count)
 */

import 'dotenv/config';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('Missing FIREBASE_PROJECT_ID env var.');

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}

const db = getFirestore();

async function run() {
  console.log('\n=== Browse Challenges Permission Diagnostic ===\n');
  console.log('Project:', projectId);
  console.log('Mode: read-only (Admin SDK, bypasses security rules)\n');

  // ── 1. Field presence on challenges ──────────────────────────────────────────

  const challengesSnap = await db.collection('challenges').get();
  const total = challengesSnap.size;

  let missingVisibility = 0;
  let missingGroupVisibility = 0;
  let missingGroupId = 0;
  let activePublicCount = 0;
  let activePrivateCount = 0;
  const groupIdCounts: Record<string, number> = {};

  const samplePublic: Array<{ id: string; fields: Record<string, unknown> }> = [];

  for (const doc of challengesSnap.docs) {
    const data = doc.data();
    if (!('visibility' in data)) missingVisibility++;
    if (!('groupVisibility' in data)) missingGroupVisibility++;
    if (!('groupId' in data) || typeof data.groupId !== 'string') missingGroupId++;

    if (data.status === 'active') {
      if (data.visibility === 'public' || data.groupVisibility === 'public') {
        activePublicCount++;
        if (samplePublic.length < 5) {
          samplePublic.push({
            id: doc.id,
            fields: {
              status: data.status,
              visibility: data.visibility,
              groupVisibility: data.groupVisibility,
              groupId: data.groupId,
              'groupId is string': typeof data.groupId === 'string',
            },
          });
        }
      } else {
        activePrivateCount++;
      }

      const gid = typeof data.groupId === 'string' ? data.groupId : '__missing__';
      groupIdCounts[gid] = (groupIdCounts[gid] ?? 0) + 1;
    }
  }

  console.log('── 1. Field Presence on challenges ─────────────────────────────────────────');
  console.log(`Total challenge documents:       ${total}`);
  console.log(`Missing "visibility" field:      ${missingVisibility} (these are excluded from where('visibility','==','public'))`);
  console.log(`Missing "groupVisibility" field: ${missingGroupVisibility} (these are excluded from where('groupVisibility','==','public'))`);
  console.log(`Missing/non-string "groupId":    ${missingGroupId} (these fail canReadChallenge's outer && data.groupId is string)`);
  console.log(`Active + public challenges:      ${activePublicCount}`);
  console.log(`Active + private challenges:     ${activePrivateCount}`);
  console.log();

  // ── 2. Sample public challenges ──────────────────────────────────────────────

  console.log('── 2. Sample Active Public Challenges (first 5) ────────────────────────────');
  if (samplePublic.length === 0) {
    console.log('NONE FOUND — no active challenges with visibility==public or groupVisibility==public');
    console.log('This means the public Browse query returns 0 results (no error, just empty).');
    console.log('The permission-denied error comes from the MEMBER GROUP query, not the public query.');
  } else {
    for (const s of samplePublic) {
      console.log(`  ${s.id}:`, JSON.stringify(s.fields));
    }
  }
  console.log();

  // ── 3. Queries the Browse screen executes ────────────────────────────────────

  console.log('── 3. Exact Queries Sent by BrowseChallengesScreen ─────────────────────────');
  console.log('Query A (public visibility):');
  console.log('  collection("challenges")');
  console.log('  .where("status", "==", "active")');
  console.log('  .where("visibility", "==", "public")');
  console.log('  .orderBy("startDate", "desc")');
  console.log('  .limit(25)');
  console.log();
  console.log('Query B (group-level public visibility):');
  console.log('  collection("challenges")');
  console.log('  .where("status", "==", "active")');
  console.log('  .where("groupVisibility", "==", "public")');
  console.log('  .orderBy("startDate", "desc")');
  console.log('  .limit(25)');
  console.log();
  console.log('Query C (user\'s member-group challenges — only if user is in groups):');
  console.log('  collection("challenges")');
  console.log('  .where("groupId", "in", [<userGroupIds>])');
  console.log('  .where("status", "==", "active")');
  console.log('  .orderBy("startDate", "desc")');
  console.log('  .limit(25)');
  console.log();

  // ── 4. Rule evaluation trace ─────────────────────────────────────────────────

  console.log('── 4. canReadChallenge Rule Evaluation per Document ────────────────────────');
  console.log('Current rule (post-P5C):');
  console.log('  canReadChallenge(data) =');
  console.log('    isAuthenticated()                               // [A] no get() calls');
  console.log('    && data.groupId is string                       // [B] field check, no calls');
  console.log('    && (');
  console.log('      canModerateChallenges()                       // [C] no get() calls');
  console.log('      || isGroupMember(data.groupId)               // [D] ← 1 exists() + 1-2 get() calls per doc');
  console.log('      || (data.status == "active"');
  console.log('          && (data.visibility == "public"');
  console.log('              || data.groupVisibility == "public")) // [E] field check, no calls');
  console.log('    )');
  console.log();
  console.log('Evaluation order for a regular authenticated user:');
  console.log('  [A] → true');
  console.log('  [B] → true (if groupId is a string)');
  console.log('  [C] → false (not a moderator)');
  console.log('  [D] → evaluated: 1 exists() + conditionally 1-2 get() calls PER DOCUMENT');
  console.log('  [E] → evaluated ONLY if [D] is false');
  console.log();
  console.log('Firebase limit: 10 total exists()/get() calls per LIST query request.');
  console.log();

  // ── 5. Get-call budget estimate ───────────────────────────────────────────────

  console.log('── 5. get()/exists() Call Budget for Query A (public visibility) ─────────');
  console.log(`  Active public challenges: ${activePublicCount}`);
  const worstCaseA = activePublicCount * 3; // 1 exists + 2 get per isGroupMember call
  const bestCaseA = activePublicCount * 1;  // 1 exists if user is not a member (short-circuits after exists)
  console.log(`  isGroupMember calls if evaluated for ALL results: ${activePublicCount} × 1-3 = ${bestCaseA}–${worstCaseA} calls`);
  console.log(`  Firebase limit: 10 calls`);
  if (activePublicCount > 3) {
    console.log(`  ⚠  EXCEEDS LIMIT: ${activePublicCount} documents × minimum 1 call = ${bestCaseA} > 10`);
    console.log('  → Query A will fail with permission-denied if isGroupMember is evaluated before branch [E]');
  } else if (activePublicCount === 0) {
    console.log('  Query A returns 0 results → no get() calls → would succeed (but shows empty Browse)');
  } else {
    console.log(`  Within limit for ${activePublicCount} documents`);
  }
  console.log();

  console.log('── 6. Per-group active challenge counts (for Query C budget) ───────────────');
  const sortedGroups = Object.entries(groupIdCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [gid, count] of sortedGroups) {
    const flag = count * 3 > 10 ? '⚠  EXCEEDS LIMIT' : '✓ within limit';
    console.log(`  groupId ${gid}: ${count} active challenges → up to ${count * 3} calls (${flag})`);
  }
  if (sortedGroups.length === 0) console.log('  No active challenges found.');
  console.log();

  // ── 7. Backfill status ────────────────────────────────────────────────────────

  console.log('── 7. Backfill Status ───────────────────────────────────────────────────────');
  console.log(`  backfillDiscoveryFields.ts EXISTS and handles visibility/groupVisibility backfill`);
  console.log(`  Challenges needing visibility backfill:      ${missingVisibility}`);
  console.log(`  Challenges needing groupVisibility backfill: ${missingGroupVisibility}`);
  if (missingVisibility > 0 || missingGroupVisibility > 0) {
    console.log('  ⚠  Backfill needed. Run:');
    console.log('     npm run backfill:discovery-fields         (dry-run, shows what would change)');
    console.log('     CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:discovery-fields -- --apply');
  } else {
    console.log('  ✓ All challenges have visibility and groupVisibility fields');
  }

  console.log();
  console.log('=== Diagnostic complete ===');
}

run().catch((e) => { console.error(e); process.exit(1); });
