import 'dotenv/config';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createPool, databaseUrl, type Db } from './db.js';
import {
  runActivityEventParity,
  type ParitySource,
} from './activityEventParity.js';
import type { KnowledgeResolver, LegacyDocSnapshot } from './activityEventImport.js';

/**
 * Read-only event parity: Firestore workouts/wellnessLogs vs PostgreSQL
 * activity_events ledger.
 *
 * Usage: npm run parity:events
 * Writes nothing on either side. Exits non-zero on material mismatch.
 * Legacy/orphan records are surfaced in the report without failing the check.
 */

interface FirestoreDocLike {
  id: string;
  data(): Record<string, unknown>;
}

export async function runEventParityCheck(db: Db): Promise<ReturnType<typeof runActivityEventParity> extends Promise<infer T> ? T : never> {
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  const fs = getFirestore();
  const [workoutSnap, wellnessSnap] = await Promise.all([
    fs.collection('workouts').get(),
    fs.collection('wellnessLogs').get(),
  ]);
  const toSnapshot = (doc: FirestoreDocLike): LegacyDocSnapshot => ({ id: doc.id, data: doc.data() });
  const source: ParitySource = {
    workouts: workoutSnap.docs.map((d) => toSnapshot(d as unknown as FirestoreDocLike)),
    wellnessLogs: wellnessSnap.docs.map((d) => toSnapshot(d as unknown as FirestoreDocLike)),
  };
  const memberRows = await db.query<{ member_id: string; auth_subject: string }>(
    `SELECT member_id, auth_subject FROM members WHERE auth_provider = 'firebase'`,
  );
  const memberMap: Record<string, string> = {};
  for (const row of memberRows.rows) memberMap[String(row.auth_subject)] = String(row.member_id);
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
  const resolveKnowledgePin: KnowledgeResolver = async (canonicalKey) => {
    if (uuidRe.test(canonicalKey)) return byUuid.get(canonicalKey) ?? null;
    return byLegacy.get(canonicalKey) ?? null;
  };
  return runActivityEventParity(db, source, memberMap, resolveKnowledgePin);
}

async function main(): Promise<void> {
  const db = createPool(databaseUrl());
  try {
    const report = await runEventParityCheck(db);
    console.log(JSON.stringify(report, null, 2));
    if (!report.match) process.exitCode = 1;
  } finally {
    await db.close();
  }
}

const invokedAsCli =
  process.argv[1]?.endsWith('activityEventParityCli.ts') ||
  process.argv[1]?.endsWith('activityEventParityCli.js');
if (invokedAsCli) void main();

export type { Db };
