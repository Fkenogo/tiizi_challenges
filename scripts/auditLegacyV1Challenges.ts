/**
 * Audit: Legacy v1 Challenge Records
 *
 * Read-only by default. Classifies every document in the `challenges`
 * collection by engine version:
 *   - engineVersion === 'v2'         → supported (current engine)
 *   - engineVersion === 'v1'         → legacy, no longer supported
 *   - engineVersion missing/other    → legacy (treated as v1 — the app never
 *                                       silently assumes v2 for undefined)
 *
 * For each legacy challenge found, also counts its related challengeMembers
 * records, since those become orphaned once a challenge is no longer usable.
 *
 * Performs ZERO writes by default. An optional --apply cleanup mode exists
 * but is NOT implemented in this phase — see the "Optional cleanup" section
 * below. Archival/deletion of legacy records is a separate, founder-approved
 * operation for a future phase.
 *
 * Usage:
 *   tsx scripts/auditLegacyV1Challenges.ts
 *
 * Requires Firebase Admin credentials (GOOGLE_APPLICATION_CREDENTIALS or a
 * serviceAccountKey.json in the project root). Skips gracefully if absent.
 */

import { readFileSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');

// ── Optional cleanup mode — NOT implemented ───────────────────────────────────
// Per Phase 5 constraints: "Do not run destructive Firestore writes. Do not
// delete production documents automatically." Archival/deletion of legacy
// challenge records must be a separate, explicitly founder-approved operation
// with its own review — not bundled into a routine audit script. If --apply
// is passed, we say so plainly and exit without touching any data.
if (APPLY) {
  console.log('═══ Legacy v1 Challenge Audit — --apply mode ═══\n');
  console.log('  --apply is not implemented in this script.');
  console.log('  Archiving/deleting legacy challenge records requires a separate,');
  console.log('  explicitly founder-approved operation — not a routine audit run.');
  console.log('  This script only ever reads data and reports counts.\n');
  process.exit(0);
}

type ChallengeRow = {
  id: string;
  engineVersion: string; // normalized: 'v2' | 'v1' | 'missing'
  rawEngineVersion: unknown;
  challengeType?: string;
  status?: string;
  groupId?: string;
  name?: string;
  createdAt?: string;
};

function classifyEngineVersion(raw: unknown): 'v2' | 'v1' | 'missing' {
  if (raw === 'v2') return 'v2';
  if (raw === undefined || raw === null || raw === '') return 'missing';
  return 'v1';
}

async function run(): Promise<void> {
  console.log(`\nLegacy v1 Challenge Audit — ${new Date().toISOString()} [read-only]\n`);

  let admin: typeof import('firebase-admin') | null = null;
  try {
    admin = await import('firebase-admin');
  } catch {
    // firebase-admin not installed — nothing to audit
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
    console.log('  ⚠️  Skipped — no Firebase Admin credentials found.');
    console.log('     Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json');
    console.log('     in the project root to run this audit against live data.\n');
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });
  }
  const db = admin.firestore();

  // ── 1. Read all challenges, classify by engine version ──────────────────────
  const challengesSnap = await db.collection('challenges').get();
  const rows: ChallengeRow[] = challengesSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      rawEngineVersion: data.engineVersion,
      engineVersion: classifyEngineVersion(data.engineVersion),
      challengeType: data.challengeType,
      status: data.status,
      groupId: data.groupId,
      name: data.name,
      createdAt: data.createdAt,
    };
  });

  const v2Rows = rows.filter((r) => r.engineVersion === 'v2');
  const v1Rows = rows.filter((r) => r.engineVersion === 'v1');
  const missingRows = rows.filter((r) => r.engineVersion === 'missing');
  const legacyRows = [...v1Rows, ...missingRows];

  console.log('═══ Summary ═══');
  console.log(`  Total challenges:              ${rows.length}`);
  console.log(`  engineVersion === 'v2':        ${v2Rows.length}  (supported)`);
  console.log(`  engineVersion === 'v1':        ${v1Rows.length}  (legacy — no longer supported)`);
  console.log(`  engineVersion missing/other:   ${missingRows.length}  (legacy — treated as v1)`);
  console.log(`  Total legacy (obsolete):       ${legacyRows.length}\n`);

  if (legacyRows.length === 0) {
    console.log('  ✓ No legacy v1 challenge records found. Nothing further to report.\n');
    return;
  }

  // ── 2. List legacy challenge IDs with basic metadata ────────────────────────
  console.log('═══ Legacy Challenge IDs ═══');
  for (const row of legacyRows) {
    console.log(
      `  ${row.id}` +
      `  type=${row.challengeType ?? 'unknown'}` +
      `  status=${row.status ?? 'unknown'}` +
      `  groupId=${row.groupId ?? 'none'}` +
      `  engineVersion=${JSON.stringify(row.rawEngineVersion)}` +
      (row.name ? `  name="${row.name}"` : ''),
    );
  }
  console.log('');

  // ── 3. Related challengeMembers counts per legacy challenge ─────────────────
  console.log('═══ Related challengeMembers (orphaned once challenge is unsupported) ═══');
  let totalOrphanedMembers = 0;
  const legacyIds = legacyRows.map((r) => r.id);
  const CHUNK = 10; // Firestore 'in' query limit
  for (let i = 0; i < legacyIds.length; i += CHUNK) {
    const chunk = legacyIds.slice(i, i + CHUNK);
    const memberSnap = await db
      .collection('challengeMembers')
      .where('challengeId', 'in', chunk)
      .get();
    const countByChallenge = new Map<string, number>();
    memberSnap.docs.forEach((doc) => {
      const challengeId = String(doc.data().challengeId ?? '');
      countByChallenge.set(challengeId, (countByChallenge.get(challengeId) ?? 0) + 1);
    });
    for (const id of chunk) {
      const count = countByChallenge.get(id) ?? 0;
      totalOrphanedMembers += count;
      if (count > 0) {
        console.log(`  ${id}: ${count} challengeMembers record(s)`);
      }
    }
  }
  console.log(`\n  Total orphaned challengeMembers records: ${totalOrphanedMembers}\n`);

  console.log('═══ Recommendation ═══');
  console.log('  These records are obsolete per founder decision (Phase 5). They are');
  console.log('  already excluded from all user-facing lists and screens (see');
  console.log('  docs/reports/pre-beta-phase-5-legacy-v1-removal.md). No write action');
  console.log('  was taken by this script — archival or deletion requires a separate,');
  console.log('  explicitly founder-approved operation, run with intention outside');
  console.log('  routine audits.\n');
}

run().catch((error) => {
  console.error('Legacy v1 challenge audit failed:', error);
  process.exit(1);
});
