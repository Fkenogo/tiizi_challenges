import 'dotenv/config';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createPool, databaseUrl, type Db } from './db.js';
import type { KnowledgeSourceCollection } from './knowledgeImport.js';
import {
  apiParityEntry,
  firestoreParityEntry,
  knowledgeParityMatches,
  summarizeKnowledgeParity,
  type ApiParityRow,
  type KnowledgeParityEntry,
  type KnowledgeParityReport,
} from './knowledgeParity.js';

/**
 * Read-only parity check: compares Firestore canonical Knowledge
 * (catalogExercises + wellnessActivities) against PostgreSQL authority on
 * identity, lifecycle, version, and name. Writes nothing on either side and
 * never switches authority.
 */
export async function runKnowledgeParityCheck(db: Db): Promise<KnowledgeParityReport> {
  const fs = getFirestore();
  const [fitnessSnap, wellnessSnap, pgRows] = await Promise.all([
    fs.collection('catalogExercises').get(),
    fs.collection('wellnessActivities').get(),
    db.query<ApiParityRow>(
      `SELECT legacy_firestore_id, legacy_collection, lifecycle, current_version, name
       FROM knowledge_items
       WHERE legacy_firestore_id IS NOT NULL`,
    ),
  ]);

  const firestore: KnowledgeParityEntry[] = [];
  const collect = (snap: { docs: Array<{ id: string; data(): unknown }> }, collection: KnowledgeSourceCollection) => {
    for (const doc of snap.docs) {
      firestore.push(
        firestoreParityEntry(doc.id, collection, doc.data() as Record<string, unknown>),
      );
    }
  };
  collect(fitnessSnap, 'catalogExercises');
  collect(wellnessSnap, 'wellnessActivities');

  const api = pgRows.rows.map(apiParityEntry);
  return summarizeKnowledgeParity(firestore, api);
}

async function main(): Promise<void> {
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  const db = createPool(databaseUrl());
  try {
    const report = await runKnowledgeParityCheck(db);
    console.log(
      JSON.stringify({ ...report, match: knowledgeParityMatches(report) }, null, 2),
    );
    if (!knowledgeParityMatches(report)) process.exitCode = 1;
  } finally {
    await db.close();
  }
}

const invokedAsCli =
  process.argv[1]?.endsWith('knowledgeParityCli.ts') ||
  process.argv[1]?.endsWith('knowledgeParityCli.js');
if (invokedAsCli) void main();
