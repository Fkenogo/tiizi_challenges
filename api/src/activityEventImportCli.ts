import 'dotenv/config';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createPool, databaseUrl, type Db } from './db.js';
import {
  runActivityEventImport,
  type ImportResolvers,
  type LegacyDocSnapshot,
} from './activityEventImport.js';

/**
 * Read-only Firestore -> PostgreSQL activity-event import (C1 shadow).
 *
 * Usage: npm run activity:import -- --dry-run | --apply
 *   --dry-run predicts the import without writing PostgreSQL.
 *   --apply writes idempotently (deterministic client keys converge).
 * Writes nothing to Firestore, ever. PostgreSQL writes use the verified-TLS
 * connection contract inherited from createPool.
 */

interface FirestoreDocLike {
  id: string;
  data(): Record<string, unknown>;
}

async function loadSnapshots(): Promise<{ workouts: LegacyDocSnapshot[]; wellnessLogs: LegacyDocSnapshot[] }> {
  const fs = getFirestore();
  const [workoutSnap, wellnessSnap] = await Promise.all([
    fs.collection('workouts').get(),
    fs.collection('wellnessLogs').get(),
  ]);
  const toSnapshot = (doc: FirestoreDocLike): LegacyDocSnapshot => ({ id: doc.id, data: doc.data() });
  return {
    workouts: workoutSnap.docs.map((d) => toSnapshot(d as unknown as FirestoreDocLike)),
    wellnessLogs: wellnessSnap.docs.map((d) => toSnapshot(d as unknown as FirestoreDocLike)),
  };
}

async function buildResolvers(db: Db): Promise<ImportResolvers> {
  const memberRows = await db.query<{ member_id: string; auth_subject: string }>(
    `SELECT member_id, auth_subject FROM members WHERE auth_provider = 'firebase'`,
  );
  const memberByUid = new Map(memberRows.rows.map((r) => [String(r.auth_subject), String(r.member_id)]));
  const knowledgeRows = await db.query<{ knowledge_id: string; legacy_firestore_id: string | null; current_version: number }>(
    `SELECT knowledge_id, legacy_firestore_id, current_version FROM knowledge_items`,
  );
  const byUuid = new Map<string, { knowledge_id: string; current_version: number }>();
  const byLegacy = new Map<string, { knowledge_id: string; current_version: number }>();
  for (const row of knowledgeRows.rows) {
    const pin = { knowledge_id: String(row.knowledge_id), current_version: Number(row.current_version) };
    byUuid.set(String(row.knowledge_id), pin);
    if (row.legacy_firestore_id) byLegacy.set(String(row.legacy_firestore_id), pin);
  }
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return {
    resolveMemberId: async (_provider, uid) => memberByUid.get(uid) ?? null,
    resolveKnowledgePin: async (canonicalKey) => {
      if (uuidRe.test(canonicalKey)) return byUuid.get(canonicalKey) ?? null;
      return byLegacy.get(canonicalKey) ?? null;
    },
  };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  if (!apply && !process.argv.includes('--dry-run')) {
    console.log('Usage: npm run activity:import -- --dry-run | --apply');
    console.log('  --dry-run predicts the import without writing PostgreSQL.');
    console.log('  --apply writes idempotently; safe to re-run. Writes nothing to Firestore.');
    process.exit(2);
  }
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  const db = createPool(databaseUrl());
  try {
    const source = await loadSnapshots();
    const resolvers = await buildResolvers(db);
    const report = await runActivityEventImport(db, source, resolvers, { dryRun: !apply });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await db.close();
  }
}

const invokedAsCli =
  process.argv[1]?.endsWith('activityEventImportCli.ts') ||
  process.argv[1]?.endsWith('activityEventImportCli.js');
if (invokedAsCli) void main();

export type { Db };
