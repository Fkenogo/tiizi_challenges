/**
 * Phase 18D-3C — Read-Only Firestore Wellness Catalog Migration Audit
 *
 * READ ONLY. No writes. No deletions. No seeds.
 * Exits non-zero if the comparison cannot be completed.
 */

import 'dotenv/config';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { WELLNESS_ACTIVITIES_CATALOG } from '../src/data/wellnessActivitiesCatalog';
import type { WellnessActivity } from '../src/types/wellnessActivity';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('Missing FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID');

if (!getApps().length) {
  initializeApp({ projectId });
}
const db = getFirestore();

// ── Types ─────────────────────────────────────────────────────────────────────

interface FirestoreDoc {
  id: string;
  name: string;
  shortName: string;
  category: string;
  activityType: string;
  targetType?: string;
  defaultTargetValue?: number;
  defaultMetricUnit?: string;
}

interface FieldDiff {
  field: string;
  firestore: unknown;
  catalog: unknown;
}

interface ChangedDoc {
  id: string;
  diffs: FieldDiff[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fromRaw(id: string, d: FirebaseFirestore.DocumentData): FirestoreDoc {
  return {
    id,
    name: String(d.name ?? ''),
    shortName: String(d.shortName ?? ''),
    category: String(d.category ?? ''),
    activityType: String(d.activityType ?? ''),
    targetType: d.targetType ? String(d.targetType) : undefined,
    defaultTargetValue: d.defaultTargetValue != null ? Number(d.defaultTargetValue) : undefined,
    defaultMetricUnit: d.defaultMetricUnit ? String(d.defaultMetricUnit) : undefined,
  };
}

function diffDocs(fs: FirestoreDoc, cat: WellnessActivity): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const checks: Array<[string, unknown, unknown]> = [
    ['name', fs.name, cat.name],
    ['category', fs.category, cat.category],
    ['activityType', fs.activityType, cat.activityType],
    ['targetType', fs.targetType ?? null, cat.targetType ?? null],
    ['defaultTargetValue', fs.defaultTargetValue ?? null, cat.defaultTargetValue],
    ['defaultMetricUnit', fs.defaultMetricUnit ?? null, cat.defaultMetricUnit],
  ];
  for (const [field, fVal, cVal] of checks) {
    if (String(fVal) !== String(cVal)) diffs.push({ field, firestore: fVal, catalog: cVal });
  }
  return diffs;
}

// ── Read Firestore ─────────────────────────────────────────────────────────────

async function run() {
  console.log('\nPhase 18D-3C — Read-Only Firestore Wellness Catalog Migration Audit');
  console.log('═'.repeat(70));
  console.log('READ ONLY — no writes, no deletes, no seeds');
  console.log('═'.repeat(70));

  // 1. Read Firestore
  const snapshot = await db.collection('wellnessActivities').get();
  const fsDocs: FirestoreDoc[] = snapshot.docs.map((doc) => fromRaw(doc.id, doc.data()));
  const fsMap = new Map(fsDocs.map((d) => [d.id, d]));

  // 2. Build local catalog map
  const localMap = new Map(WELLNESS_ACTIVITIES_CATALOG.map((a) => [a.id, a]));

  // 3. Comparison sets
  const fsIds = new Set(fsDocs.map((d) => d.id));
  const localIds = new Set(WELLNESS_ACTIVITIES_CATALOG.map((a) => a.id));

  const inBoth = [...fsIds].filter((id) => localIds.has(id));
  const onlyInFs = [...fsIds].filter((id) => !localIds.has(id));    // deletion candidates
  const onlyInLocal = [...localIds].filter((id) => !fsIds.has(id)); // insertion candidates

  const changed: ChangedDoc[] = [];
  for (const id of inBoth) {
    const fs = fsMap.get(id)!;
    const cat = localMap.get(id)!;
    const diffs = diffDocs(fs, cat);
    if (diffs.length > 0) changed.push({ id, diffs });
  }

  // 4. Legacy embedded-quantity names in Firestore
  const legacyNamePatterns = [
    /\d+-Min\b/i,
    /\b\d+L\b/i,
    /\b\d+hr\b/i,
    /\b\d+-Hour\b/i,
    /\b\d+ml\b/i,
    /\b\d+-a-Day\b/i,
    /\b\d+min\b/i,
  ];
  const legacyNames = fsDocs
    .filter((d) => legacyNamePatterns.some((p) => p.test(d.name)))
    .map((d) => `  ${d.id.padEnd(40)} → "${d.name}"`);

  // 5. Reference audit — scan project source for any of the deletion-candidate IDs
  const srcFiles = [
    'src/services/wellnessTemplateService.ts',
    'src/services/wellnessActivityService.ts',
    'src/data/wellnessActivitiesCatalog.ts',
    'scripts/seedWellnessActivities.ts',
    'scripts/seedWellnessTemplates.ts',
    'scripts/seedAppData.ts',
    'scripts/seedBaselineData.ts',
  ];

  interface Orphan { id: string; file: string; line: number; excerpt: string }
  const orphans: Orphan[] = [];
  for (const relPath of srcFiles) {
    const absPath = resolve(__dirname, '..', relPath);
    let content: string;
    try { content = readFileSync(absPath, 'utf-8'); } catch { continue; }
    const lines = content.split('\n');
    for (const id of onlyInFs) {
      lines.forEach((line, idx) => {
        if (line.includes(id)) {
          orphans.push({ id, file: relPath, line: idx + 1, excerpt: line.trim().slice(0, 120) });
        }
      });
    }
  }

  // ── Print report ─────────────────────────────────────────────────────────────

  const LINE = '─'.repeat(70);

  console.log(`\n${'A. FIRESTORE DOCUMENT COUNT'.padEnd(40)} ${fsDocs.length}`);
  console.log(`${'B. LOCAL CATALOG COUNT'.padEnd(40)} ${WELLNESS_ACTIVITIES_CATALOG.length}`);
  console.log(`${'C. IDs IN BOTH'.padEnd(40)} ${inBoth.length}`);
  console.log(`${'D. IDs ONLY IN FIRESTORE (deletions)'.padEnd(40)} ${onlyInFs.length}`);
  console.log(`${'E. IDs ONLY IN LOCAL CATALOG (inserts)'.padEnd(40)} ${onlyInLocal.length}`);
  console.log(`${'F. SAME ID, CHANGED FIELDS (updates)'.padEnd(40)} ${changed.length}`);

  console.log(`\n${LINE}`);
  console.log('C. IDs existing in BOTH (retained, may have field changes)');
  console.log(LINE);
  for (const id of [...inBoth].sort()) console.log(`  ${id}`);

  console.log(`\n${LINE}`);
  console.log('D. IDs only in Firestore — DELETION CANDIDATES');
  console.log(LINE);
  for (const id of [...onlyInFs].sort()) {
    const d = fsMap.get(id)!;
    console.log(`  ${id.padEnd(48)} name: "${d.name}"   cat: ${d.category}`);
  }

  console.log(`\n${LINE}`);
  console.log('E. IDs only in local catalog — INSERTION CANDIDATES');
  console.log(LINE);
  for (const id of [...onlyInLocal].sort()) {
    const a = localMap.get(id)!;
    console.log(`  ${id.padEnd(48)} name: "${a.name}"   cat: ${a.category}`);
  }

  console.log(`\n${LINE}`);
  console.log('F. Same ID, changed fields — UPDATE CANDIDATES');
  console.log(LINE);
  if (changed.length === 0) {
    console.log('  (none)');
  } else {
    for (const { id, diffs } of changed.sort((a, b) => a.id.localeCompare(b.id))) {
      console.log(`\n  ${id}`);
      for (const d of diffs) {
        console.log(`    ${d.field.padEnd(24)} firestore: ${JSON.stringify(d.firestore)}`);
        console.log(`    ${''.padEnd(24)} catalog:   ${JSON.stringify(d.catalog)}`);
      }
    }
  }

  console.log(`\n${LINE}`);
  console.log('G. Legacy embedded-quantity display names in Firestore');
  console.log(LINE);
  if (legacyNames.length === 0) {
    console.log('  (none found)');
  } else {
    for (const l of legacyNames) console.log(l);
  }

  console.log(`\n${LINE}`);
  console.log('REFERENCE AUDIT — deletion candidates referenced in source files');
  console.log(LINE);
  if (orphans.length === 0) {
    console.log('  (no hardcoded references to deletion-candidate IDs found)');
  } else {
    for (const o of orphans) {
      console.log(`  ⚠️  ${o.id}  →  ${o.file}:${o.line}`);
      console.log(`       ${o.excerpt}`);
    }
  }

  // ── Migration statistics ────────────────────────────────────────────────────

  const fsCategories = new Set(fsDocs.map((d) => d.category));
  const localCategories = new Set(WELLNESS_ACTIVITIES_CATALOG.map((a) => a.category));
  const fsTypes = new Set(fsDocs.map((d) => d.activityType));
  const localTypes = new Set(WELLNESS_ACTIVITIES_CATALOG.map((a) => a.activityType));

  const renames = changed.filter((c) => c.diffs.some((d) => d.field === 'name'));

  console.log(`\n${LINE}`);
  console.log('MIGRATION STATISTICS');
  console.log(LINE);
  console.log(`  Current Firestore activities:   ${fsDocs.length}`);
  console.log(`  New catalog activities:         ${WELLNESS_ACTIVITIES_CATALOG.length}`);
  console.log(`  Activities retained (same ID):  ${inBoth.length}`);
  console.log(`  Activities renamed (name diff): ${renames.length}`);
  console.log(`  Activities inserted (new IDs):  ${onlyInLocal.length}`);
  console.log(`  Activities removed (old IDs):   ${onlyInFs.length}`);
  console.log(`  Categories (Firestore):         ${fsCategories.size}  [${[...fsCategories].sort().join(', ')}]`);
  console.log(`  Categories (catalog):           ${localCategories.size}  [${[...localCategories].sort().join(', ')}]`);
  console.log(`  Activity types (Firestore):     ${fsTypes.size}  [${[...fsTypes].sort().join(', ')}]`);
  console.log(`  Activity types (catalog):       ${localTypes.size}  [${[...localTypes].sort().join(', ')}]`);

  // ── Risk assessment ─────────────────────────────────────────────────────────

  console.log(`\n${LINE}`);
  console.log('MIGRATION RISK ASSESSMENT');
  console.log(LINE);

  let riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'SAFE';
  const riskFactors: string[] = [];

  if (orphans.length > 0) {
    riskLevel = 'HIGH';
    riskFactors.push(`${orphans.length} deletion-candidate ID(s) are hardcoded in source files → fix before seeding`);
  }

  if (onlyInFs.length > 30) {
    if (riskLevel === 'SAFE') riskLevel = 'MEDIUM';
    riskFactors.push(`${onlyInFs.length} documents removed — large deletion count; verify no active challenges reference them`);
  } else if (onlyInFs.length > 0) {
    if (riskLevel === 'SAFE') riskLevel = 'LOW';
    riskFactors.push(`${onlyInFs.length} documents removed — verify no active challenges reference deleted IDs`);
  }

  if (changed.length > 0) {
    if (riskLevel === 'SAFE') riskLevel = 'LOW';
    riskFactors.push(`${changed.length} documents have field changes — existing challenge.activities[] entries store names/units at creation time; in-flight challenges will not break`);
  }

  if (riskFactors.length === 0) {
    riskFactors.push('No references to deletion candidates, no unexpected changes');
  }

  console.log(`  Risk level: ${riskLevel}`);
  for (const f of riskFactors) console.log(`  • ${f}`);

  console.log(`\n${'═'.repeat(70)}`);
  console.log('NO WRITES PERFORMED. This script is read-only.');
  console.log('═'.repeat(70));

  // Return structured data for the report generator
  return {
    fsCount: fsDocs.length,
    localCount: WELLNESS_ACTIVITIES_CATALOG.length,
    inBoth: inBoth.length,
    onlyInFs,
    onlyInLocal,
    changed,
    legacyNames,
    orphans,
    riskLevel,
    riskFactors,
    fsDocs,
    fsCategories,
    localCategories,
    fsTypes,
    localTypes,
    renames: renames.length,
  };
}

run().then((result) => {
  if (result.riskLevel === 'HIGH') {
    console.error('\nExiting with code 1 — HIGH risk level requires manual review before proceeding.\n');
    process.exit(1);
  }
  process.exit(0);
}).catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
