import {
  normalizeLifecycle,
  normalizeVersion,
  type KnowledgeKind,
} from './knowledge.js';
import type { KnowledgeSourceCollection } from './knowledgeImport.js';

/**
 * Phase B Knowledge parity: compares meaningful canonical semantics between
 * Firestore and PostgreSQL — identity coverage, lifecycle (with legacy
 * missing → published normalization), knowledgeVersion (missing → 1), and
 * name. Pure comparison logic (no I/O) so tests exercise it directly; the
 * Firestore/PostgreSQL wiring lives in knowledgeParityCli.ts.
 *
 * Malformed Firestore records (reported, never imported) surface here as
 * `missing_in_api` by design — PostgreSQL refuses to fabricate canonical
 * Knowledge, the same principle behind the accepted Phase A2 orphan rows.
 */

export interface KnowledgeParityEntry {
  legacyId: string;
  collection: KnowledgeSourceCollection;
  lifecycle: string;
  knowledgeVersion: number;
  name: string;
}

export type KnowledgeParityDifferenceKind =
  | 'missing_in_api'
  | 'missing_in_firestore'
  | 'lifecycle_mismatch'
  | 'version_mismatch'
  | 'name_mismatch';

export interface KnowledgeParityDifference {
  kind: KnowledgeParityDifferenceKind;
  legacyId: string;
  collection: KnowledgeSourceCollection;
  firestore?: string;
  api?: string;
}

export function firestoreParityEntry(
  legacyId: string,
  collection: KnowledgeSourceCollection,
  data: Record<string, unknown>,
): KnowledgeParityEntry {
  return {
    legacyId,
    collection,
    lifecycle: normalizeLifecycle(data.lifecycleStatus),
    knowledgeVersion: normalizeVersion(data.knowledgeVersion),
    name: typeof data.name === 'string' ? data.name.trim() : '',
  };
}

export interface ApiParityRow {
  legacy_firestore_id: string;
  legacy_collection: string;
  lifecycle: string;
  current_version: number;
  name: string;
}

export function apiParityEntry(row: ApiParityRow): KnowledgeParityEntry {
  return {
    legacyId: row.legacy_firestore_id,
    collection: row.legacy_collection as KnowledgeSourceCollection,
    lifecycle: normalizeLifecycle(row.lifecycle),
    knowledgeVersion: normalizeVersion(row.current_version),
    name: row.name ?? '',
  };
}

export function compareKnowledgeParity(
  firestore: KnowledgeParityEntry[],
  api: KnowledgeParityEntry[],
): KnowledgeParityDifference[] {
  const key = (collection: string, legacyId: string) => `${collection}/${legacyId}`;
  const apiByKey = new Map(api.map((entry) => [key(entry.collection, entry.legacyId), entry]));
  const firestoreByKey = new Map(
    firestore.map((entry) => [key(entry.collection, entry.legacyId), entry]),
  );
  const differences: KnowledgeParityDifference[] = [];

  for (const fs of firestore) {
    // Records without a usable name are importer-malformed, not parity
    // content: they surface as missing_in_api (never fabricated).
    const match = apiByKey.get(key(fs.collection, fs.legacyId));
    if (!match) {
      differences.push({ kind: 'missing_in_api', legacyId: fs.legacyId, collection: fs.collection });
      continue;
    }
    if (match.lifecycle !== fs.lifecycle) {
      differences.push({
        kind: 'lifecycle_mismatch',
        legacyId: fs.legacyId,
        collection: fs.collection,
        firestore: fs.lifecycle,
        api: match.lifecycle,
      });
    }
    if (match.knowledgeVersion !== fs.knowledgeVersion) {
      differences.push({
        kind: 'version_mismatch',
        legacyId: fs.legacyId,
        collection: fs.collection,
        firestore: String(fs.knowledgeVersion),
        api: String(match.knowledgeVersion),
      });
    }
    if (match.name !== fs.name) {
      differences.push({
        kind: 'name_mismatch',
        legacyId: fs.legacyId,
        collection: fs.collection,
        firestore: fs.name,
        api: match.name,
      });
    }
  }

  for (const entry of api) {
    if (!firestoreByKey.has(key(entry.collection, entry.legacyId))) {
      differences.push({
        kind: 'missing_in_firestore',
        legacyId: entry.legacyId,
        collection: entry.collection,
      });
    }
  }

  differences.sort((a, b) =>
    a.collection.localeCompare(b.collection) || a.legacyId.localeCompare(b.legacyId),
  );
  return differences;
}

export interface KnowledgeParityReport {
  firestoreItems: number;
  apiItems: number;
  differences: KnowledgeParityDifference[];
}

export function knowledgeParityMatches(report: KnowledgeParityReport): boolean {
  return report.differences.length === 0;
}

export function summarizeKnowledgeParity(
  firestore: KnowledgeParityEntry[],
  api: KnowledgeParityEntry[],
): KnowledgeParityReport {
  return {
    firestoreItems: firestore.length,
    apiItems: api.length,
    differences: compareKnowledgeParity(firestore, api),
  };
}

export function knowledgeKindLabel(collection: KnowledgeSourceCollection): KnowledgeKind {
  return collection === 'catalogExercises' ? 'fitness' : 'wellness';
}
