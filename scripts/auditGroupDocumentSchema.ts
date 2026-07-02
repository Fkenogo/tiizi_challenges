/**
 * scripts/auditGroupDocumentSchema.ts
 *
 * Scans the `groups` Firestore collection for schema gaps introduced before
 * Phase 18I-6D (group documents written without lifecycle fields).
 *
 * Dry-run by default. Pass --execute --confirm to write safe defaults.
 *
 * Usage:
 *   npx tsx scripts/auditGroupDocumentSchema.ts              # dry-run
 *   npx tsx scripts/auditGroupDocumentSchema.ts --execute --confirm
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Bootstrap Firebase Admin
// ---------------------------------------------------------------------------

function findServiceAccount(): string {
  const candidates = [
    path.join(process.cwd(), 'serviceAccountKey.json'),
    path.join(process.cwd(), 'service-account.json'),
    path.join(process.cwd(), 'firebase-admin-key.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'No service account key found. Place serviceAccountKey.json in project root.',
  );
}

if (getApps().length === 0) {
  const keyPath = findServiceAccount();
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const EXECUTE = process.argv.includes('--execute');
const CONFIRM = process.argv.includes('--confirm');

if (EXECUTE && !CONFIRM) {
  console.error('ERROR: --execute requires --confirm to prevent accidental writes.');
  console.error('Run: npx tsx scripts/auditGroupDocumentSchema.ts --execute --confirm');
  process.exit(1);
}

// Required fields and their safe repair defaults.
// Fields with null as value are NOT repaired (they require business logic).
const REQUIRED_FIELDS: Record<string, unknown> = {
  status: 'active',
  moderationStatus: 'active',
  visibility: null,           // derived from isPrivate — handled specially
  allowMemberChallenges: true,
  requireAdminApproval: false,
  activeChallenges: 0,
  id: null,                   // set to document id — handled specially
};

// Fields that are audited but not auto-repaired.
const AUDIT_ONLY_FIELDS = ['reviewStatus', 'isFeatured', 'isVerified'];

// Inconsistent status/moderationStatus pairs that are bugs.
const STATUS_INCONSISTENCIES: Array<{ status: string; moderationStatus: string; note: string }> = [
  { status: 'active', moderationStatus: 'deactivated', note: 'status=active but moderationStatus=deactivated (admin wrote only one field)' },
  { status: 'inactive', moderationStatus: 'active', note: 'status=inactive but moderationStatus=active (admin wrote only one field)' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GroupAuditResult {
  id: string;
  name: string;
  missingRequired: string[];
  missingAuditOnly: string[];
  inconsistencies: string[];
  repairPayload: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

async function auditGroups(): Promise<GroupAuditResult[]> {
  const snap = await db.collection('groups').get();
  const results: GroupAuditResult[] = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const docId = docSnap.id;

    const missingRequired: string[] = [];
    const missingAuditOnly: string[] = [];
    const inconsistencies: string[] = [];
    const repairPayload: Record<string, unknown> = {};

    // Check required fields
    for (const [field, defaultValue] of Object.entries(REQUIRED_FIELDS)) {
      if (!(field in data) || data[field] === undefined || data[field] === null) {
        missingRequired.push(field);

        if (field === 'id') {
          repairPayload['id'] = docId;
        } else if (field === 'visibility') {
          repairPayload['visibility'] = data['isPrivate'] === true ? 'private' : 'public';
        } else if (defaultValue !== null) {
          // Do not overwrite explicit inactive/deactivated values
          if (field === 'status' && data['status'] === 'inactive') continue;
          if (field === 'status' && data['status'] === 'deactivated') continue;
          if (field === 'moderationStatus' && data['moderationStatus'] === 'deactivated') continue;
          repairPayload[field] = defaultValue;
        }
      }
    }

    // Check audit-only fields
    for (const field of AUDIT_ONLY_FIELDS) {
      if (!(field in data)) {
        missingAuditOnly.push(field);
      }
    }

    // Check inconsistencies
    for (const pair of STATUS_INCONSISTENCIES) {
      const groupStatus = String(data['status'] ?? '');
      const groupModerationStatus = String(data['moderationStatus'] ?? '');
      if (groupStatus === pair.status && groupModerationStatus === pair.moderationStatus) {
        inconsistencies.push(pair.note);
      }
    }

    if (missingRequired.length > 0 || missingAuditOnly.length > 0 || inconsistencies.length > 0) {
      results.push({
        id: docId,
        name: String(data['name'] ?? '(unnamed)'),
        missingRequired,
        missingAuditOnly,
        inconsistencies,
        repairPayload: Object.keys(repairPayload).length > 0 ? repairPayload : null,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n=== Group Document Schema Audit (Phase 18I-6D) ===\n');
  console.log(`Mode: ${EXECUTE && CONFIRM ? 'EXECUTE (writing repairs)' : 'DRY-RUN (no writes)'}\n`);

  const results = await auditGroups();

  if (results.length === 0) {
    console.log('✅ All group documents have the required schema fields.\n');
    return;
  }

  console.log(`⚠️  Found ${results.length} group(s) with schema gaps:\n`);

  let repaired = 0;
  let skipped = 0;

  for (const r of results) {
    console.log(`  Group: "${r.name}" (${r.id})`);
    if (r.missingRequired.length > 0) {
      console.log(`    Missing required: ${r.missingRequired.join(', ')}`);
    }
    if (r.missingAuditOnly.length > 0) {
      console.log(`    Missing (audit-only, not auto-repaired): ${r.missingAuditOnly.join(', ')}`);
    }
    if (r.inconsistencies.length > 0) {
      console.log(`    ⚠️  Inconsistencies: ${r.inconsistencies.join('; ')}`);
    }
    if (r.repairPayload) {
      console.log(`    Repair payload: ${JSON.stringify(r.repairPayload)}`);
    }
    console.log('');
  }

  const repairable = results.filter((r) => r.repairPayload !== null);

  if (!EXECUTE || !CONFIRM) {
    console.log(`DRY-RUN: ${repairable.length} group(s) would be repaired.`);
    console.log('Run with --execute --confirm to apply repairs.\n');
    return;
  }

  // Execute repairs
  console.log(`Applying repairs to ${repairable.length} group(s)...\n`);
  for (const r of repairable) {
    if (!r.repairPayload) continue;
    try {
      await db.collection('groups').doc(r.id).update(r.repairPayload);
      console.log(`  ✅ Repaired "${r.name}" (${r.id}): ${JSON.stringify(r.repairPayload)}`);
      repaired++;
    } catch (err) {
      console.error(`  ❌ Failed to repair "${r.name}" (${r.id}): ${err}`);
      skipped++;
    }
  }

  console.log(`\n=== Repair complete: ${repaired} repaired, ${skipped} failed ===\n`);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
