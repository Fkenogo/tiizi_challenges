/**
 * Phase C1 event parity: Firestore workouts/wellnessLogs vs PostgreSQL ledger.
 *
 * Compares meaningful semantics (counts total/per-member/per-challenge,
 * occurred_at, value/unit, canonical identity + version pins, associations,
 * correction state). Legacy/orphan records are surfaced separately — they
 * never silently pass, but only MATERIAL differences fail the check
 * (match=false, non-zero CLI exit).
 *
 * Plain-data in, no Firebase import: the CLI supplies Firestore snapshots,
 * the UID->member map, and the knowledge resolver.
 */

import type { Db } from './db.js';
import type { KnowledgeResolver, LegacyDocSnapshot } from './activityEventImport.js';
import { legacyClientKey } from './activityEvents.js';

export interface ParitySource {
  workouts: LegacyDocSnapshot[];
  wellnessLogs: LegacyDocSnapshot[];
}

export type ParityDifferenceKind =
  | 'count_mismatch'
  | 'field_mismatch'
  | 'pg_orphan'
  | 'correction_anomaly';

export interface ParityDifference {
  kind: ParityDifferenceKind;
  collection: 'workouts' | 'wellnessLogs' | 'both';
  detail: string;
  legacy_id?: string;
  field?: string;
  firestoreValue?: unknown;
  pgValue?: unknown;
}

export interface LegacyOrphan {
  collection: 'workouts' | 'wellnessLogs';
  legacy_id: string;
  reason: 'unknown_member' | 'malformed';
  detail: string;
}

export interface ActivityEventParityReport {
  match: boolean;
  firestoreCounts: { workouts: number; wellnessLogs: number };
  pgCounts: { workouts: number; wellnessLogs: number };
  differences: ParityDifference[];
  legacyOrphans: LegacyOrphan[];
}

interface PgEventLite {
  event_id: string;
  client_key: string;
  event_type: string;
  member_id: string;
  legacy_challenge_id: string | null;
  legacy_group_id: string | null;
  canonical_key: string;
  knowledge_id: string | null;
  knowledge_version: number | null;
  occurred_at: string;
  occurred_day: string;
  value: number;
  unit: string;
  points: number;
  legacy_collection: string;
  legacy_id: string;
  log_type: string | null;
  supersedes_event_id: string | null;
  status: string;
}

const FIELD_SAMPLE_LIMIT = 200;

function firestoreEpoch(data: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = data[key];
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const t = Date.parse(value);
      if (!Number.isNaN(t)) return t;
    }
    if (value && typeof value === 'object') {
      const maybe = value as { toDate?: unknown; seconds?: unknown };
      if (typeof maybe.toDate === 'function') {
        const d = (maybe.toDate as () => unknown)();
        if (d instanceof Date && !Number.isNaN(d.getTime())) return d.getTime();
      }
    }
  }
  return null;
}

export async function runActivityEventParity(
  db: Db,
  source: ParitySource,
  memberMap: Record<string, string>,
  resolveKnowledgePin: KnowledgeResolver,
): Promise<ActivityEventParityReport> {
  const differences: ParityDifference[] = [];
  const legacyOrphans: LegacyOrphan[] = [];

  const pgResult = await db.query<PgEventLite>(
    `SELECT event_id, client_key, event_type, member_id, legacy_challenge_id, legacy_group_id,
            canonical_key, knowledge_id, knowledge_version, occurred_at, occurred_day,
            value, unit, points, legacy_collection, legacy_id, log_type,
            supersedes_event_id, status
     FROM activity_events`,
  );
  const pgByClientKey = new Map(pgResult.rows.map((r) => [r.client_key, r]));
  const pgEffective = pgResult.rows.filter((r) => r.status === 'committed');

  // Correction-state anomalies: a superseded row must be the target of a live
  // correction; a correction must reference an existing row.
  const byEventId = new Map(pgResult.rows.map((r) => [String(r.event_id), r]));
  for (const row of pgResult.rows) {
    if (row.status === 'superseded') {
      const hasLiveCorrection = pgResult.rows.some(
        (c) => c.status === 'committed' && String(c.supersedes_event_id) === String(row.event_id),
      );
      if (!hasLiveCorrection) {
        differences.push({
          kind: 'correction_anomaly',
          collection: row.legacy_collection as 'workouts' | 'wellnessLogs',
          detail: `superseded row has no live correction: ${row.legacy_collection}/${row.legacy_id}`,
          legacy_id: row.legacy_id,
        });
      }
    }
    if (row.supersedes_event_id != null && !byEventId.has(String(row.supersedes_event_id))) {
      differences.push({
        kind: 'correction_anomaly',
        collection: row.legacy_collection as 'workouts' | 'wellnessLogs',
        detail: `correction references a missing event: ${row.legacy_collection}/${row.legacy_id}`,
        legacy_id: row.legacy_id,
      });
    }
  }

  const collections = [
    { name: 'workouts' as const, docs: source.workouts, keyField: 'exerciseId', timeKeys: ['completedAt', 'loggedAt', 'date'] },
    { name: 'wellnessLogs' as const, docs: source.wellnessLogs, keyField: 'activityId', timeKeys: ['loggedAt', 'date'] },
  ];

  const firestoreIdsByCollection = new Map<string, Set<string>>();
  const firestoreCountsByMember = new Map<string, number>();
  const firestoreCountsByChallenge = new Map<string, number>();

  for (const { name, docs, keyField, timeKeys } of collections) {
    const idSet = new Set<string>();
    firestoreIdsByCollection.set(name, idSet);
    let fieldSamples = 0;
    for (const doc of docs) {
      idSet.add(doc.id);
      const data = doc.data;
      const uid = typeof data.userId === 'string' ? data.userId : '';
      const memberId = memberMap[uid];
      if (!uid || !memberId) {
        legacyOrphans.push({
          collection: name,
          legacy_id: doc.id,
          reason: 'unknown_member',
          detail: `no PostgreSQL member for uid "${uid || '(missing)'}"`,
        });
        continue;
      }
      const challengeId = typeof data.challengeId === 'string' ? data.challengeId : '';
      if (!challengeId) {
        legacyOrphans.push({ collection: name, legacy_id: doc.id, reason: 'malformed', detail: 'missing challengeId' });
        continue;
      }
      firestoreCountsByMember.set(memberId, (firestoreCountsByMember.get(memberId) ?? 0) + 1);
      firestoreCountsByChallenge.set(challengeId, (firestoreCountsByChallenge.get(challengeId) ?? 0) + 1);

      const pg = pgByClientKey.get(legacyClientKey(name, doc.id));
      if (!pg) {
        differences.push({
          kind: 'count_mismatch',
          collection: name,
          detail: `Firestore record has no ledger row: ${name}/${doc.id}`,
          legacy_id: doc.id,
        });
        continue;
      }
      if (fieldSamples >= FIELD_SAMPLE_LIMIT) continue;
      fieldSamples += 1;
      const check = (field: string, firestoreValue: unknown, pgValue: unknown) => {
        const same = typeof firestoreValue === 'number' && typeof pgValue === 'number'
          ? Math.abs(firestoreValue - pgValue) < 1e-9
          : String(firestoreValue ?? '') === String(pgValue ?? '');
        if (!same) {
          differences.push({
            kind: 'field_mismatch', collection: name,
            detail: `${name}/${doc.id}: ${field} differs`,
            legacy_id: doc.id, field, firestoreValue, pgValue,
          });
        }
      };
      const canonicalKey = typeof data[keyField] === 'string' ? (data[keyField] as string).trim() : '';
      check('canonical_key', canonicalKey, pg.canonical_key);
      check('member_id', memberId, String(pg.member_id));
      check('legacy_challenge_id', challengeId, pg.legacy_challenge_id);
      const fsEpoch = firestoreEpoch(data, timeKeys);
      const pgEpoch = Date.parse(pg.occurred_at);
      if (fsEpoch == null || Number.isNaN(pgEpoch) || fsEpoch !== pgEpoch) {
        differences.push({
          kind: 'field_mismatch', collection: name,
          detail: `${name}/${doc.id}: occurred_at differs`,
          legacy_id: doc.id, field: 'occurred_at', firestoreValue: fsEpoch, pgValue: pgEpoch,
        });
      }
      check('value', typeof data.value === 'string' ? Number(data.value) : data.value, Number(pg.value));
      check('unit', (data.unit as string) ?? '', pg.unit);
      if (pg.status !== 'committed') {
        differences.push({
          kind: 'correction_anomaly', collection: name,
          detail: `${name}/${doc.id}: ledger row unexpectedly superseded with no correction context`,
          legacy_id: doc.id,
        });
      }
      const expectedPin = canonicalKey ? await resolveKnowledgePin(canonicalKey) : null;
      check('knowledge_id', expectedPin?.knowledge_id ?? null, pg.knowledge_id == null ? null : String(pg.knowledge_id));
      check('knowledge_version', expectedPin?.current_version ?? null, pg.knowledge_version == null ? null : Number(pg.knowledge_version));
    }
  }

  // PG orphans: ledger rows whose Firestore record is gone (deletion is not a
  // correction mechanism, so these surface loudly).
  for (const row of pgEffective) {
    const idSet = firestoreIdsByCollection.get(row.legacy_collection);
    if (idSet && !idSet.has(row.legacy_id)) {
      differences.push({
        kind: 'pg_orphan',
        collection: row.legacy_collection as 'workouts' | 'wellnessLogs',
        detail: `ledger row without Firestore record: ${row.legacy_collection}/${row.legacy_id}`,
        legacy_id: row.legacy_id,
      });
    }
  }

  // Aggregate comparison over mapped (non-orphan) records.
  const pgCountsByMember = new Map<string, number>();
  const pgCountsByChallenge = new Map<string, number>();
  for (const row of pgEffective) {
    const memberId = String(row.member_id);
    pgCountsByMember.set(memberId, (pgCountsByMember.get(memberId) ?? 0) + 1);
    if (row.legacy_challenge_id) {
      pgCountsByChallenge.set(row.legacy_challenge_id, (pgCountsByChallenge.get(row.legacy_challenge_id) ?? 0) + 1);
    }
  }
  for (const [memberId, fsCount] of firestoreCountsByMember) {
    const pgCount = pgCountsByMember.get(memberId) ?? 0;
    if (pgCount !== fsCount) {
      differences.push({
        kind: 'count_mismatch', collection: 'both',
        detail: `per-member count differs for member ${memberId}: firestore=${fsCount} pg=${pgCount}`,
      });
    }
  }
  for (const [memberId, pgCount] of pgCountsByMember) {
    if (!firestoreCountsByMember.has(memberId)) {
      differences.push({
        kind: 'count_mismatch', collection: 'both',
        detail: `member ${memberId} has ${pgCount} ledger rows but no mapped Firestore records`,
      });
    }
  }
  for (const [challengeId, fsCount] of firestoreCountsByChallenge) {
    const pgCount = pgCountsByChallenge.get(challengeId) ?? 0;
    if (pgCount !== fsCount) {
      differences.push({
        kind: 'count_mismatch', collection: 'both',
        detail: `per-challenge count differs for ${challengeId}: firestore=${fsCount} pg=${pgCount}`,
      });
    }
  }

  const pgCounts = {
    workouts: pgEffective.filter((r) => r.event_type === 'workout').length,
    wellnessLogs: pgEffective.filter((r) => r.event_type === 'wellness').length,
  };
  return {
    match: differences.length === 0,
    firestoreCounts: { workouts: source.workouts.length, wellnessLogs: source.wellnessLogs.length },
    pgCounts,
    differences: differences.slice(0, 200),
    legacyOrphans: legacyOrphans.slice(0, 200),
  };
}
