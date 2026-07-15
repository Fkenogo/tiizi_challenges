/**
 * cleanupSeededChallengeMembers.ts
 *
 * Scans the challengeMembers collection for:
 *   (A) Seeded docs — identified by seedTag, seed_ ID prefixes, or seed_ foreign-key prefixes
 *   (B) Orphaned docs — where the referenced challenge, user, or groupMembers doc does not exist
 *
 * Defaults to dry-run. Pass --execute to delete.
 *
 * Usage:
 *   npm run audit:seeded-challenge-members          # dry-run (safe)
 *   npm run cleanup:seeded-challenge-members        # also dry-run
 *   npm run cleanup:seeded-challenge-members -- --execute   # actually deletes
 */

import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Env validation ────────────────────────────────────────────────────────────

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) {
  throw new Error('Missing FIREBASE_PROJECT_ID (or fallback VITE_FIREBASE_PROJECT_ID) env var.');
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS. Set it to the service-account JSON path.');
}

// ── Init ──────────────────────────────────────────────────────────────────────

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const SEED_TAG = process.env.SEED_TAG ?? 'tiizi_seed_v1';
const executeMode = process.argv.includes('--execute');
const mode = executeMode ? 'execute' : 'dry-run';

// ── Types ─────────────────────────────────────────────────────────────────────

type ChallengeMemberDoc = {
  challengeId?: string;
  userId?: string;
  groupId?: string;
  seedTag?: string;
};

type CandidateDoc = {
  docId: string;
  userId: string;
  challengeId: string;
  groupId: string;
  reason: string;
};

// ── Seed detection ────────────────────────────────────────────────────────────

function isSeedLike(value: string): boolean {
  return value.startsWith('seed_') || value.includes('_seed_') || value.includes('seed-');
}

function detectSeedReason(docId: string, data: ChallengeMemberDoc): string | null {
  if (data.seedTag === SEED_TAG) return `seedTag === '${SEED_TAG}'`;
  if (isSeedLike(docId)) return `doc ID starts with/contains seed pattern: ${docId}`;
  if (data.challengeId && isSeedLike(data.challengeId)) return `challengeId is seed-like: ${data.challengeId}`;
  if (data.userId && isSeedLike(data.userId)) return `userId is seed-like: ${data.userId}`;
  if (data.groupId && isSeedLike(data.groupId)) return `groupId is seed-like: ${data.groupId}`;
  return null;
}

// ── Orphan detection ──────────────────────────────────────────────────────────

async function checkOrphan(data: ChallengeMemberDoc): Promise<string | null> {
  const { challengeId, userId, groupId } = data;
  if (!challengeId || !userId) return 'missing challengeId or userId field';

  const [challengeSnap, userSnap] = await Promise.all([
    db.collection('challenges').doc(challengeId).get(),
    db.collection('users').doc(userId).get(),
  ]);

  if (!challengeSnap.exists) return `challenge doc does not exist: challenges/${challengeId}`;
  if (!userSnap.exists) return `user doc does not exist: users/${userId}`;

  if (groupId) {
    const groupMemberDocId = `${groupId}_${userId}`;
    const gmSnap = await db.collection('groupMembers').doc(groupMemberDocId).get();
    if (!gmSnap.exists) return `groupMembers doc does not exist: groupMembers/${groupMemberDocId}`;
  }

  return null;
}

// ── Batched delete ────────────────────────────────────────────────────────────

async function deleteInBatches(refs: FirebaseFirestore.DocumentReference[]): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < refs.length; i += 400) {
    const chunk = refs.slice(i, i + 400);
    const batch = db.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += chunk.length;
    console.log(`  deleted batch ${Math.floor(i / 400) + 1}: ${chunk.length} docs`);
  }
  return deleted;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`cleanupSeededChallengeMembers — mode: ${mode.toUpperCase()}`);
  console.log(`project: ${projectId}  |  seedTag: ${SEED_TAG}`);
  console.log(`${'─'.repeat(60)}\n`);

  const snap = await db.collection('challengeMembers').get();
  const total = snap.size;
  console.log(`Fetched ${total} challengeMembers docs.\n`);

  const seedCandidates: CandidateDoc[] = [];
  const orphanCandidates: CandidateDoc[] = [];

  // ── Pass 1: seed detection (no extra Firestore reads) ─────────────────────
  for (const docSnap of snap.docs) {
    const data = docSnap.data() as ChallengeMemberDoc;
    const reason = detectSeedReason(docSnap.id, data);
    if (reason) {
      seedCandidates.push({
        docId: docSnap.id,
        userId: data.userId ?? '(missing)',
        challengeId: data.challengeId ?? '(missing)',
        groupId: data.groupId ?? '(none)',
        reason,
      });
    }
  }

  // ── Pass 2: orphan detection (parallel reads for non-seed docs) ───────────
  const nonSeedDocs = snap.docs.filter((d) => !seedCandidates.some((c) => c.docId === d.id));
  console.log(`Checking ${nonSeedDocs.length} non-seed docs for orphans…`);

  const orphanResults = await Promise.all(
    nonSeedDocs.map(async (docSnap) => {
      const data = docSnap.data() as ChallengeMemberDoc;
      const orphanReason = await checkOrphan(data);
      if (orphanReason) {
        return {
          docId: docSnap.id,
          userId: data.userId ?? '(missing)',
          challengeId: data.challengeId ?? '(missing)',
          groupId: data.groupId ?? '(none)',
          reason: `orphan — ${orphanReason}`,
        } satisfies CandidateDoc;
      }
      return null;
    }),
  );

  orphanResults.forEach((r) => { if (r) orphanCandidates.push(r); });

  const allCandidates = [...seedCandidates, ...orphanCandidates];

  // ── Print candidate list ──────────────────────────────────────────────────
  if (allCandidates.length === 0) {
    console.log('✅ No seeded or orphaned challengeMembers docs found.\n');
  } else {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`CANDIDATES FOR DELETION (${allCandidates.length} total)`);
    console.log(`${'─'.repeat(60)}`);

    if (seedCandidates.length > 0) {
      console.log(`\n[SEEDED — ${seedCandidates.length}]`);
      seedCandidates.forEach((c) => {
        console.log(`  docId:       ${c.docId}`);
        console.log(`  userId:      ${c.userId}`);
        console.log(`  challengeId: ${c.challengeId}`);
        console.log(`  groupId:     ${c.groupId}`);
        console.log(`  reason:      ${c.reason}`);
        console.log('');
      });
    }

    if (orphanCandidates.length > 0) {
      console.log(`[ORPHANED — ${orphanCandidates.length}]`);
      orphanCandidates.forEach((c) => {
        console.log(`  docId:       ${c.docId}`);
        console.log(`  userId:      ${c.userId}`);
        console.log(`  challengeId: ${c.challengeId}`);
        console.log(`  groupId:     ${c.groupId}`);
        console.log(`  reason:      ${c.reason}`);
        console.log('');
      });
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(JSON.stringify({
    mode,
    projectId,
    seedTag: SEED_TAG,
    totalChallengeMembers: total,
    candidateDeleteCount: allCandidates.length,
    breakdown: {
      seeded: seedCandidates.length,
      orphaned: orphanCandidates.length,
    },
  }, null, 2));

  if (!executeMode) {
    console.log('\n⚠️  DRY-RUN COMPLETE — nothing was deleted.');
    console.log('   Review the candidate list above, then re-run with --execute to delete.');
    return;
  }

  // ── Execute ───────────────────────────────────────────────────────────────
  if (allCandidates.length === 0) {
    console.log('\nNothing to delete.');
    return;
  }

  console.log('\n⚠️  EXECUTING DELETION — this cannot be undone.\n');

  const refs = allCandidates.map((c) => db.collection('challengeMembers').doc(c.docId));
  const deleted = await deleteInBatches(refs);
  const remaining = (await db.collection('challengeMembers').get()).size;

  console.log(JSON.stringify({ mode: 'execute', deleted, remainingChallengeMembers: remaining }, null, 2));
  console.log('\n✅ Deletion complete.');
}

main().catch((error) => {
  console.error('cleanupSeededChallengeMembers failed:', error);
  process.exit(1);
});
